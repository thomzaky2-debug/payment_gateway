export type Severity = 'INFO' | 'WARNING' | 'ALERT';
export interface NotificationDraft { audience: 'ALL' | 'SINGLE'; clientId: string; title: string; message: string; severity: Severity }
export const emptyNotification: NotificationDraft = {audience:'SINGLE',clientId:'',title:'',message:'',severity:'INFO'};
export const notificationTemplates: Array<{name:string;title:string;message:string;severity:Severity}> = [
  {name:'Maintenance',title:'Scheduled maintenance',message:'Maintenance window (Cairo time): [date and time].\nExpected impact: [details].\nWe will post an update when service is restored.',severity:'WARNING'},
  {name:'Service restored',title:'Service restored',message:'Service has been restored. Thank you for your patience.',severity:'INFO'},
  {name:'Action required',title:'Action required',message:'Please [action and deadline]. Contact support if you need assistance.',severity:'ALERT'},
];
export function isNotificationRecipient(m: {isActive?:boolean;approvalStatus?:string}) { return m.isActive === true && m.approvalStatus === 'APPROVED'; }
export function notificationError(d: NotificationDraft, count: number): string {
  if (!d.title.trim() || !d.message.trim()) return 'Enter a title and message.';
  if(d.title.trim().length>150 || d.message.trim().length>2000) return 'Title limit: 150 characters. Message limit: 2,000 characters.';
  if(!['INFO','WARNING','ALERT'].includes(d.severity)) return 'Choose a notification type.';
  if(/\[(date and time|details|action and deadline)\]/.test(d.message)) return 'Replace the template placeholders before sending.';
  if(!count || (d.audience === 'SINGLE' && !d.clientId)) return 'Choose an active approved merchant.';
  return '';
}
export function notificationFingerprint(d: NotificationDraft) {return JSON.stringify([d.title.trim(),d.message.trim(),d.severity,d.audience==='ALL'?'ALL':d.clientId]);}
export function restoreNotificationDraft(raw: string | null): NotificationDraft | null {
  try { const d=JSON.parse(raw || 'null');
    if (!d || !['ALL','SINGLE'].includes(d.audience) || !['INFO','WARNING','ALERT'].includes(d.severity) || !['clientId','title','message'].every(k=>typeof d[k]==='string') || d.title.length>150 || d.message.length>2000 || d.clientId.length>128) return null;
    return {audience:d.audience,clientId:d.clientId,title:d.title,message:d.message,severity:d.severity};
  } catch {return null;}
}
export interface NotificationPayload {target?:string;clientId?:string;title:string;message:string;severity:Severity;requestId:string;expectedCount:number}
export interface NotificationAttempt {fingerprint:string;payload:NotificationPayload}
export function restoreNotificationAttempt(raw:string|null): {draft:NotificationDraft;attempt:NotificationAttempt}|null {
  try { const a=JSON.parse(raw||'null'), p=a?.payload;
    if(!p || typeof p.requestId!=='string' || !/^[A-Za-z0-9_-]{16,128}$/.test(p.requestId) || !Number.isSafeInteger(p.expectedCount) || p.expectedCount<1 || (p.target!==undefined && p.target!=='ALL')) return null;
    const draft=restoreNotificationDraft(JSON.stringify({audience:p.clientId?'SINGLE':'ALL',clientId:p.clientId||'',title:p.title,message:p.message,severity:p.severity}));
    if(!draft || notificationError(draft,p.expectedCount) || notificationFingerprint(draft)!==a.fingerprint) return null;
    return {draft,attempt:{fingerprint:a.fingerprint,payload:{title:draft.title,message:draft.message,severity:draft.severity,requestId:p.requestId,expectedCount:p.expectedCount,...(draft.audience==='ALL'?{target:'ALL'}:{clientId:draft.clientId})}}};
  } catch {return null;}
}
export function notificationRequestId() { return Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''); }
