import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { adminApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { emptyNotification, isNotificationRecipient, notificationError, notificationFingerprint, notificationRequestId, notificationTemplates, restoreNotificationAttempt, restoreNotificationDraft } from '../utils/adminNotifications';
import type { NotificationAttempt, NotificationDraft } from '../utils/adminNotifications';
import './AdminNotificationCenter.css';
interface Merchant {id:string;businessName:string;email:string;isActive:boolean;approvalStatus:string}
const DRAFT='nilepay.admin.notification.draft.v1', PENDING='nilepay.admin.notification.pending.v1';
const errorText=(e:any)=>e?.response?.data?.error || e?.message || 'Unable to complete the request.';
function stored(key:string) {try{return localStorage.getItem(key);}catch{return null;}}
function remove(key:string) {try{localStorage.removeItem(key);}catch{/* Private storage may be disabled. */}}
export const AdminNotificationCenter=memo(function AdminNotificationCenter({merchants:initialMerchants}:{merchants:Merchant[]}) {
  const {isDark}=useTheme();
  const [draft,setDraft]=useState<NotificationDraft>(emptyNotification);
  const [merchants,setMerchants]=useState(initialMerchants),[query,setQuery]=useState('');
  const deferredQuery=useDeferredValue(query);
  const [history,setHistory]=useState<any[]>([]),[historyError,setHistoryError]=useState('');
  const [advanced,setAdvanced]=useState(false),[ready,setReady]=useState(false),[refreshing,setRefreshing]=useState(false);
  const [sending,setSending]=useState(false),[review,setReview]=useState(false),[audienceReviewed,setAudienceReviewed]=useState(false);
  const [feedback,setFeedback]=useState(''),[saved,setSaved]=useState(false),[uncertain,setUncertain]=useState(false);
  const attempt=useRef<NotificationAttempt|null>(null),busy=useRef(false),generation=useRef(0),dialog=useRef<HTMLDivElement>(null),reviewTrigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>setMerchants(initialMerchants),[initialMerchants]);
  async function refresh(signal?:AbortSignal) {
    const current=++generation.current;setRefreshing(true);
    const results=await Promise.allSettled([adminApi.listClients(signal),adminApi.getNotificationCenter(signal).catch(async(e:any)=>{
      if(![404,405].includes(e?.response?.status)) throw e;
      const data=await adminApi.getAuditLogs(signal);
      return {broadcasts:(data.logs||[]).filter((r:any)=>r.action==='BROADCAST_NOTIFICATION').slice(0,25),capabilities:{}};
    })]);
    if(signal?.aborted || current!==generation.current)return;
    const [clients,center]=results;
    if(clients.status==='fulfilled' && Array.isArray(clients.value.clients)){setMerchants(clients.value.clients);setReady(true);}else{setReady(false);setFeedback('Recipient refresh failed. Refresh before sending.');}
    if(center.status==='fulfilled' && Array.isArray(center.value.broadcasts)){setHistory(center.value.broadcasts);setAdvanced(center.value.capabilities?.idempotentSending===true && center.value.capabilities?.strictAudience===true);setHistoryError('');}
    else {setAdvanced(false);setHistoryError('Broadcast history is unavailable. Refresh to try again.');}
    setRefreshing(false);
  }
  useEffect(()=>{
    const pending=restoreNotificationAttempt(stored(PENDING));
    if(pending){attempt.current=pending.attempt;setDraft(pending.draft);setUncertain(true);setFeedback('A previous send has an unknown result. Check history before retrying.');}
    setSaved(!!restoreNotificationDraft(stored(DRAFT)));
    const controller=new AbortController();void refresh(controller.signal);
    return ()=>{controller.abort();generation.current++;};
  },[]);
  useEffect(()=>{if(review){setAudienceReviewed(false);dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();}else reviewTrigger.current?.focus();},[review]);
  const eligible=useMemo(()=>merchants.filter(isNotificationRecipient),[merchants]);
  const matches=useMemo(()=>{const term=deferredQuery.trim().toLowerCase();return eligible.filter(m=>`${m.businessName} ${m.email} ${m.id}`.toLowerCase().includes(term));},[eligible,deferredQuery]);
  const selected=eligible.find(m=>m.id===draft.clientId);
  const count=draft.audience==='ALL'?eligible.length:selected?1:0;
  const validation=notificationError(draft,count);
  const fingerprint=notificationFingerprint(draft);
  const sameAttempt=attempt.current?.fingerprint===fingerprint;
  const previewCount=advanced && sameAttempt?attempt.current!.payload.expectedCount:count;
  const locked=uncertain && !advanced;
  function edit(patch:Partial<NotificationDraft>){if(sending || uncertain)return;setDraft(d=>({...d,...patch}));}
  function closeReview(){if(!busy.current)setReview(false);}
  function saveDraft(){try{localStorage.setItem(DRAFT,JSON.stringify(draft));setSaved(true);setFeedback('Draft saved privately on this device.');}catch{setFeedback('This device could not save the draft.');}}
  function clearDraft(){if(uncertain || !window.confirm('Clear this notification draft?'))return;setDraft(emptyNotification);remove(DRAFT);setSaved(false);setFeedback('Draft cleared.');}
  async function send(){
    if(busy.current || validation || !ready || refreshing || locked || (draft.audience==='ALL'&&!audienceReviewed))return;
    if(!navigator.onLine){setFeedback('You are offline. Your message has not been sent.');return;}
    busy.current=true;setSending(true);
    const current=advanced&&sameAttempt?attempt.current!:{fingerprint,payload:{title:draft.title.trim(),message:draft.message.trim(),severity:draft.severity,requestId:notificationRequestId(),expectedCount:count,...(draft.audience==='ALL'?{target:'ALL'}:{clientId:draft.clientId})}};
    attempt.current=current;
    try{
      // Persist the exact attempt before sending, so interrupted sends can be reviewed safely.
      localStorage.setItem(PENDING,JSON.stringify(current));
    }catch{setFeedback('Cannot save send recovery information. Enable private app storage and try again.');setSending(false);busy.current=false;return;}
    try{
      const result=await adminApi.sendNotification(current.payload);
      if(result.ok!==true || !Number.isSafeInteger(result.sentCount) || result.sentCount<0)throw new Error('The server returned an unknown delivery result.');
      setFeedback(`${result.replayed?'Previous send confirmed':'Notification saved'}: ${result.sentCount} merchant inbox${result.sentCount===1?'':'es'}. This does not confirm it was read.`);
      attempt.current=null;remove(PENDING);remove(DRAFT);setSaved(false);setUncertain(false);setDraft(emptyNotification);setReview(false);void refresh();
    }catch(e:any){
      const status=e?.response?.status, code=e?.response?.data?.code;
      const definiteNoSend=typeof status==='number' && status>=400 && status<500 && ![408,409].includes(status);
      if(definiteNoSend || ['AUDIENCE_CHANGED','NO_RECIPIENTS','INVALID_NOTIFICATION','SEND_REQUEST_CONFLICT'].includes(code)){
        attempt.current=null;remove(PENDING);setUncertain(false);setFeedback(errorText(e));
        if(['AUDIENCE_CHANGED','NO_RECIPIENTS'].includes(code))void refresh();
      }else{setUncertain(true);setFeedback(`Send result unknown. ${advanced?'Retry the unchanged message to safely check this same request.':'Check recent broadcasts before allowing another send.'}`);}
      setReview(false);
    }finally{busy.current=false;setSending(false);}
  }
  const style={ '--notice-text':isDark?'#f1f5f9':'#172033','--notice-muted':isDark?'#94a3b8':'#526176','--notice-panel':isDark?'#101827':'#ffffff','--notice-input':isDark?'#182235':'#f3f5fa','--notice-border':isDark?'#334155':'#d5dce7'} as CSSProperties;
  const preview=<div className="notice-preview"><p>{draft.severity} · {previewCount} recipient{previewCount===1?'':'s'}</p><h3>{draft.title.trim()||'Notification title'}</h3><p className="notice-body">{draft.message.trim()||'Your message preview appears here.'}</p></div>;
  return <section className="admin-notifications" style={style} aria-label="Merchant notification center">
    <div className="notice-row"><button disabled={refreshing||sending} onClick={()=>void refresh()}>{refreshing?'Refreshing…':'Refresh recipients & history'}</button><span className="notice-counter">{eligible.length} active approved merchants</span></div>
    {feedback&&<div className="notice-feedback" role="status">{feedback}</div>}
    {uncertain&&<div className="notice-feedback"><p>The pending message is locked while its result is checked. It will never resend automatically.</p>{advanced?<p>Duplicate-send protection is available. Review and retry this same request.</p>:<button onClick={()=>{if(window.confirm('Confirm you checked recent broadcasts. A previous send may have succeeded. Allow a new send?')){attempt.current=null;remove(PENDING);setUncertain(false);setFeedback('Review the audience and message before sending again.');}}}>I checked history — allow a new send</button>}</div>}
    <div className="notice-grid"><div className="notice-panel notice-stack">
      <div><h3>Compose notification</h3><p>Send operational updates to merchant portal inboxes.</p></div>
      <div className="notice-row">{notificationTemplates.map(t=><button key={t.name} disabled={sending||uncertain} onClick={()=>{if((draft.title||draft.message)&&!window.confirm('Replace the current message with this template?'))return;edit({title:t.title,message:t.message,severity:t.severity});}}>{t.name}</button>)}</div>
      <label>Audience<select value={draft.audience} disabled={sending||uncertain} onChange={e=>edit({audience:e.target.value as NotificationDraft['audience']})}><option value="SINGLE">One merchant</option><option value="ALL">All active approved merchants ({eligible.length})</option></select></label>
      {draft.audience==='SINGLE'&&<><label>Find merchant<input type="search" value={query} disabled={sending||uncertain} onChange={e=>setQuery(e.target.value)} placeholder="Business name or email"/></label><div className="notice-recipients">{matches.slice(0,50).map(m=><button key={m.id} aria-pressed={draft.clientId===m.id} disabled={sending||uncertain} onClick={()=>edit({clientId:m.id})}>{m.businessName}<small>{m.email}</small></button>)}</div><p>{matches.length>50?`Showing 50 of ${matches.length}. Refine your search.`:matches.length===0?'No eligible merchants found.':''}{selected?` Selected: ${selected.businessName}.`:''}</p></>}
      {draft.audience==='ALL'&&<p>This broadcast reaches {eligible.length} active approved merchants. You must confirm the full audience before sending.</p>}
      <div className="notice-row" role="group" aria-label="Notification type">{(['INFO','WARNING','ALERT'] as const).map(s=><button key={s} aria-pressed={draft.severity===s} disabled={sending||uncertain} onClick={()=>edit({severity:s})}>{s==='INFO'?'Information':s==='WARNING'?'Warning':'Urgent alert'}</button>)}</div>
      <label>Title<input maxLength={150} value={draft.title} disabled={sending||uncertain} onChange={e=>edit({title:e.target.value})}/><span className="notice-counter">{draft.title.length}/150</span></label>
      <label>Message<textarea rows={5} maxLength={2000} value={draft.message} disabled={sending||uncertain} onChange={e=>edit({message:e.target.value})}/><span className="notice-counter">{draft.message.length}/2,000</span></label>
      <div className="notice-row"><button disabled={sending||uncertain} onClick={saveDraft}>Save draft</button>{saved&&<button disabled={sending||uncertain} onClick={()=>{const d=restoreNotificationDraft(stored(DRAFT));if(d&&(!(draft.title||draft.message)||window.confirm('Replace the current message with your saved draft?'))){setDraft(d);setFeedback('Saved draft restored.');}}}>Restore draft</button>}<button disabled={sending||uncertain} onClick={clearDraft}>Clear</button></div>
    </div><div className="notice-stack"><div className="notice-panel notice-stack"><h3>Merchant preview</h3>{preview}<p>{validation||(!ready?'Refresh recipients before sending.':'Ready to review. Sending requires confirmation.')}</p><button className="primary" ref={reviewTrigger} disabled={!!validation||!ready||refreshing||sending||locked} onClick={()=>{if(!navigator.onLine){setFeedback('You are offline. Connect before sending.');return;}setReview(true);}}>{uncertain?'Review & retry same request':'Review notification'}</button></div>
      <div className="notice-panel"><h3>Recent broadcasts</h3><p>Latest 25 sends. Inbox delivery is separate from merchant read status.</p>{historyError&&<p role="status">{historyError}</p>}<div className="notice-history">{history.map(row=><article key={row.id}><strong>{row.notification?.title||'Merchant notification'}</strong><p>{row.notification?`${row.notification.severity} · ${row.notification.sentCount} inboxes`:row.details}</p><p>{new Date(row.createdAt).toLocaleString(undefined,{timeZone:'Africa/Cairo'})} · Cairo</p></article>)}{!refreshing&&!history.length&&!historyError&&<p>No broadcasts recorded yet.</p>}</div></div>
    </div></div>
    {review&&<div className="notice-dialog-backdrop" onClick={e=>{if(e.target===e.currentTarget)closeReview();}}><div className="notice-panel notice-dialog notice-stack" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="notification-review-title" onKeyDown={e=>{if(e.key==='Escape')closeReview();if(e.key==='Tab'){const buttons=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}><div className="notice-row"><h3 id="notification-review-title">Review notification</h3><button data-admin-close disabled={sending} onClick={closeReview}>Close</button></div><p>{draft.audience==='ALL'?`All active approved merchants (${previewCount})`:selected?.businessName}</p>{preview}{draft.audience==='ALL'&&<label className="notice-check"><input type="checkbox" checked={audienceReviewed} disabled={sending} onChange={e=>setAudienceReviewed(e.target.checked)}/>I reviewed the full broadcast audience.</label>}<p>This saves the notification immediately. It cannot be recalled.</p><button className="primary" disabled={sending||!!validation||!ready||refreshing||locked||(draft.audience==='ALL'&&!audienceReviewed)} onClick={()=>void send()}>{sending?'Sending…':uncertain?'Retry same send request':`Send to ${previewCount} merchant${previewCount===1?'':'s'}`}</button></div></div>}
  </section>;
});
