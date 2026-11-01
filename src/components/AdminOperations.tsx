import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { adminApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { amountFilterError, exportAdminCsv, filterControlRecords, initialControlFilters, recordKey } from '../utils/adminControls';
import type { AdminRecord, AdminScope } from '../utils/adminControls';
import './AdminOperations.css';

interface Props {
  merchants: AdminRecord[]; transactions: AdminRecord[]; webhooks: AdminRecord[]; audit: AdminRecord[];
  loading: boolean; syncedAt: Date | null; onRefresh: () => Promise<void>;
  onInspectMerchant: (id: string) => void; onReviewPayment: (id: string) => void; onNavigate: (tab: 'plans' | 'webhooks' | 'notifications') => void;
}
const scopes: Array<[AdminScope | 'health', string]> = [['merchants','Merchants'],['payments','Payments'],['webhooks','Deliveries'],['audit','Audit'],['health','Health']];
const date = (value: unknown) => value && !Number.isNaN(Date.parse(String(value))) ? new Date(String(value)).toLocaleString(undefined, { timeZone: 'Africa/Cairo' }) : '—';
const message = (error: any) => error?.response?.data?.error || error?.message || 'The action could not be completed.';
export function AdminOperations(props: Props) {
  const { isDark } = useTheme();
  const [scope, setScope] = useState<AdminScope | 'health'>('merchants');
  const [filters, setFilters] = useState(initialControlFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<AdminRecord | null>(null);
  const [detailMessage, setDetailMessage] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');
  const [automatic, setAutomatic] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [healthError, setHealthError] = useState('');
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthCheckedAt, setHealthCheckedAt] = useState<Date | null>(null);
  const refreshRef = useRef(props.onRefresh); refreshRef.current = props.onRefresh;
  const search = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const healthRun = useRef(0);
  const loadHealth = async () => {
    const run = ++healthRun.current;
    setHealthLoading(true);
    try { const res = await adminApi.getDeliveryHealth(); if (run === healthRun.current) { setHealth(res.webhooks); setHealthCheckedAt(new Date()); setHealthError(''); } }
    catch (error) { if (run === healthRun.current) { setHealth(null); setHealthError(message(error)); } }
    finally { if (run === healthRun.current) setHealthLoading(false); }
  };
  useEffect(() => { if (scope === 'health') void loadHealth(); return () => { healthRun.current++; }; }, [scope]);
  useEffect(() => {
    if (!automatic) return;
    const timer = window.setInterval(async () => {
      if (document.hidden || running.current) return;
      running.current = true;
      try { await refreshRef.current(); if (scope === 'health') await loadHealth(); }
      finally { running.current = false; }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [automatic, scope]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && search.current) { event.preventDefault(); search.current?.focus(); } if (event.key === 'Escape') setDetails(null); };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, []);
  useEffect(() => {
    setDetailMessage('');
    if (!details) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => dialog.current?.querySelector('button')?.focus());
    return () => { cancelAnimationFrame(frame); if (previous?.isConnected) previous.focus(); };
  }, [details]);
  const changeScope = (value: typeof scope) => { setScope(value); setFilters(initialControlFilters); setSelected(new Set()); setDetails(null); setFeedback(''); };
  const rows = scope === 'merchants' ? props.merchants : scope === 'payments' ? props.transactions : scope === 'webhooks' ? props.webhooks : scope === 'audit' ? props.audit : [];
  const filtered = useMemo(() => scope === 'health' ? [] : filterControlRecords(scope, rows, filters), [scope, rows, filters]);
  const validation = scope === 'payments' ? amountFilterError(filters) : '';
  const selectedShown = scope === 'health' ? [] : filtered.filter(row => selected.has(recordKey(scope, row)));
  const statuses = scope === 'merchants' ? ['ALL','PENDING','APPROVED','REJECTED','ACTIVE','SUSPENDED','EXPIRING','QUOTA']
    : scope === 'webhooks' ? ['ALL','FAILED','SUCCESS','REVIEW'] : ['ALL', ...Array.from(new Set(rows.map(row => scope === 'audit' ? row.action : row.status))).filter(Boolean)];
  const run = async (key: string, action: () => Promise<any>, success: string) => {
    if (busy) return;
    if (!navigator.onLine) { setFeedback('You are offline. Reconnect before applying an admin action.'); return; }
    setBusy(key); setFeedback('');
    try { const res = await action(); if (res?.ok === false) throw new Error(res.error || 'Action rejected.'); setFeedback(success); await props.onRefresh(); }
    catch (error) { setFeedback(message(error)); } finally { setBusy(''); }
  };
  const merchantAction = (row: AdminRecord, type: 'access' | 'sessions') => {
    const activating = !row.isActive;
    const impact = type === 'sessions' ? 'Sign this merchant out of every active session?'
      : activating ? 'Reactivate access for this approved merchant?' : 'Suspend merchant access and revoke all active sessions?';
    if (!window.confirm(`${row.businessName}\n\n${impact}`)) return;
    void run(`${row.id}:${type}`, () => type === 'sessions' ? adminApi.revokeClientSessions(row.id) : adminApi.setClientAccess(row.id, activating), 'Merchant control applied.');
  };
  const exportRows = () => { if (scope === 'health' || validation) return; try { exportAdminCsv(scope, selectedShown.length ? selectedShown : filtered); } catch (error) { setFeedback(message(error)); } };
  const theme = { '--ops-text': isDark ? '#f8fafc' : '#1e293b', '--ops-muted': isDark ? '#94a3b8' : '#475569', '--ops-panel': isDark ? '#111827' : '#fff', '--ops-input': isDark ? '#0f172a' : '#f8fafc', '--ops-border': isDark ? '#334155' : '#cbd5e1' } as CSSProperties;
  return <div className="admin-controls" style={theme}>
    <section className="ops-panel"><h2>Operations workspace</h2>
      <div className="ops-row"><button disabled={props.loading || !!busy} onClick={() => void props.onRefresh()}>Refresh</button>
        <button aria-pressed={automatic} onClick={() => setAutomatic(value => !value)}>Auto: {automatic ? '30 seconds' : 'Off'}</button>
        </div>
      <details><summary>Plans, quotas & messaging</summary><div className="ops-row"><button onClick={() => props.onNavigate('plans')}>Plans & quotas</button><button onClick={() => props.onNavigate('notifications')}>Send notification</button></div></details>
      <small>Last successful sync: {props.syncedAt ? date(props.syncedAt) : 'Not yet synced'} · Times shown in Cairo time.</small>
    </section>
    <div className="ops-row ops-tabs" role="group" aria-label="Control categories">{scopes.map(([value,label]) => <button key={value} aria-pressed={scope === value} onClick={() => changeScope(value)}>{label}</button>)}</div>
    {feedback && <div className="ops-status" role="status">{feedback}</div>}
    {scope === 'health' ? <section className="ops-panel"><h3>Webhook delivery health</h3><p>Live queue signals from the platform.</p>
      <button disabled={healthLoading} onClick={() => void loadHealth()}>{healthLoading ? 'Checking…' : 'Check health'}</button>{healthError && <p role="alert">{healthError}</p>}
      {health && <dl><div><dt>Delivery status</dt><dd><span style={{color:health.healthy ? '#10b981' : '#f87171'}}>{health.healthy ? 'Healthy' : 'Needs attention'}</span></dd></div><div><dt>Oldest overdue delivery</dt><dd>{health.oldestDueAgeSeconds} seconds</dd></div><div><dt>Unknown delivery outcomes</dt><dd>{health.unknownOutcomeCount}</dd></div></dl>}
      <small>Checked: {healthCheckedAt ? date(healthCheckedAt) : 'Not yet checked'}</small><button onClick={() => props.onNavigate('webhooks')}>Open delivery reviews</button></section> : <>
      <section className="ops-panel"><div className="ops-grid">
        <label>Search loaded records<input ref={search} placeholder="Name, email, session, reference, or action" value={filters.query} onChange={e => setFilters({...filters, query:e.target.value})}/></label>
        <label>Status<select value={filters.status} onChange={e => setFilters({...filters,status:e.target.value})}>{statuses.map(value => <option key={value} value={value}>{({EXPIRING:'Expiring within 7 days',QUOTA:'80% or more quota used',REVIEW:'Unknown outcome / review'} as Record<string,string>)[value] || value}</option>)}</select></label>
      </div><details className="ops-filters"><summary>More filters & sorting{Object.entries(filters).some(([key,value]) => key !== 'query' && key !== 'status' && value !== initialControlFilters[key as keyof typeof filters]) ? ' · Active' : ''}</summary><div className="ops-grid">
        {(scope === 'merchants' || scope === 'payments') && <label>Merchant<select value={filters.merchantId} onChange={e => setFilters({...filters,merchantId:e.target.value})}><option value="">All merchants</option>{props.merchants.map(row => <option value={row.id} key={row.id}>{row.businessName}</option>)}</select></label>}
        <label>Created within<select value={filters.days} onChange={e => setFilters({...filters,days:e.target.value})}><option value="">Any time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
        <label>Sort<select value={filters.sort} onChange={e => setFilters({...filters,sort:e.target.value})}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Merchant / action name</option>{scope === 'payments' && <><option value="amount-high">Highest detected amount</option><option value="amount-low">Lowest detected amount</option></>}</select></label>
        {scope === 'payments' && <><label>Minimum EGP<input type="number" min="0" step="0.01" value={filters.min} onChange={e => setFilters({...filters,min:e.target.value})}/></label><label>Maximum EGP<input type="number" min="0" step="0.01" value={filters.max} onChange={e => setFilters({...filters,max:e.target.value})}/></label></>}
      </div></details><small>Filters, selection, and CSV exports apply to this loaded snapshot: {rows.length} records. Transaction, delivery, and audit lists are limited by the server.</small>
      {validation && <p role="alert">{validation}</p>}<div className="ops-row"><button onClick={() => setFilters(initialControlFilters)}>Reset</button>
        <button disabled={!filtered.length || !!validation} onClick={() => setSelected(new Set(filtered.map(row => recordKey(scope,row))))}>Select shown</button><button disabled={!selected.size} onClick={() => setSelected(new Set())}>Clear</button>
        <button className="ops-primary" disabled={!filtered.length || !!validation} onClick={exportRows} title={selectedShown.length ? 'Export selected shown records' : 'Export shown records'}>Export CSV ({selectedShown.length || filtered.length})</button></div>
      <small>{filtered.length} shown · {selectedShown.length} selected shown</small></section>
      <div className="ops-grid">{!validation && filtered.map(row => <section className="ops-panel ops-record" key={recordKey(scope,row)}>
        <div className="ops-row"><input type="checkbox" aria-label={`Select ${row.businessName || row.sessionId || row.id}`} checked={selected.has(recordKey(scope,row))} onChange={() => setSelected(current => { const next = new Set(current); const key = recordKey(scope,row); next.has(key) ? next.delete(key) : next.add(key); return next; })}/>
          <strong style={{flex:1}}>{row.businessName || row.client?.businessName || row.action || 'Platform record'}</strong><span className="ops-badge">{scope === 'merchants' ? (row.isActive ? row.approvalStatus : `${row.approvalStatus} · Inactive`) : scope === 'webhooks' ? (row.isSuccess ? 'Delivered' : row.outcomeKnown === false ? 'Review required' : 'Failed') : row.status || row.action}</span></div>
        <p>{scope === 'merchants' ? row.email : scope === 'payments' ? row.sessionId : scope === 'webhooks' ? `${row.event} · HTTP ${row.statusCode ?? '—'}` : row.details}</p>
        {scope === 'merchants' && <><small>{row.subscriptionPlan} · {row.txCount} / {row.txLimit} transactions · Ends {date(row.subscriptionEndsAt)}</small><div className="ops-row"><button onClick={() => props.onInspectMerchant(row.id)}>Profile & subscription</button>{row.approvalStatus === 'APPROVED' && <><button disabled={!!busy || props.loading} onClick={() => merchantAction(row,'access')}>{row.isActive ? 'Suspend access' : 'Reactivate'}</button><button disabled={!!busy || props.loading} onClick={() => merchantAction(row,'sessions')}>Revoke sessions</button></>}</div></>}
        {scope === 'payments' && <><strong>{row.amountEgp} EGP expected · {row.detectedAmountEgp ?? '—'} EGP detected</strong><small>{row.senderHandle} · {date(row.createdAt)}</small><button onClick={() => setDetails(row)}>Inspect payment</button></>}
        {scope === 'webhooks' && <><small>Attempt {row.attemptCount ?? '—'} · {date(row.createdAt)}</small>{!row.isSuccess && <div className="ops-row"><button disabled={!!busy || props.loading || row.outcomeKnown === false} onClick={() => { if (window.confirm('Retry this webhook delivery? The merchant endpoint may receive this event again.')) void run(row.id, () => adminApi.resendWebhook(row.id), 'Retry request submitted.'); }}>Retry delivery</button><button onClick={() => props.onNavigate('webhooks')}>Open review controls</button></div>}</>}
        {scope === 'audit' && <small>{date(row.createdAt)}</small>}
      </section>)}</div>{!filtered.length && !validation && <section className="ops-panel"><p>{props.loading ? 'Loading records…' : 'No loaded records match these filters.'}</p></section>}
    </>}
    {details && <div className="ops-dialog" onClick={() => setDetails(null)}><section ref={dialog} className="ops-panel" role="dialog" aria-modal="true" aria-label="Payment inspection" onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) { e.preventDefault(); buttons[0].focus(); }
    }}>
      <div className="ops-row"><h3 style={{flex:1}}>Payment inspection</h3><button data-admin-close autoFocus onClick={() => setDetails(null)}>Close</button></div>
      <dl>{[['Session',details.sessionId],['Merchant',details.client?.businessName],['Sender',details.senderHandle],['Status',details.status],['Expected EGP',details.amountEgp],['Detected EGP',details.detectedAmountEgp],['Reference',details.detectedRef],['Created (Cairo)',date(details.createdAt)],['Checkout expiry (Cairo)',date(details.expiresAt)],['Note',details.note]].map(([label,value]) => <div key={String(label)}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>
      <button onClick={() => { navigator.clipboard.writeText(details.sessionId).then(() => setDetailMessage('Session ID copied.')).catch(() => setDetailMessage('Could not copy. Select the session ID text to copy it.')); }}>Copy session ID</button>
      {detailMessage && <p role="status">{detailMessage}</p>}
      {details.status !== 'CONFIRMED' && <button onClick={() => props.onReviewPayment(details.sessionId)}>Open manual confirmation</button>}
    </section></div>}
  </div>;
}
