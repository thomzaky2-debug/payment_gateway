export type AdminScope = 'merchants' | 'payments' | 'webhooks' | 'audit';
export type AdminRecord = Record<string, any>;
export interface ControlFilters { query: string; status: string; merchantId: string; days: string; sort: string; min: string; max: string }
export const initialControlFilters: ControlFilters = { query: '', status: 'ALL', merchantId: '', days: '', sort: 'newest', min: '', max: '' };
export const recordKey = (scope: AdminScope, row: AdminRecord) => `${scope}:${row.id || row.sessionId}`;
export const effectiveAmount = (row: AdminRecord) => Number(row.detectedAmountEgp ?? row.amountEgp ?? 0);
export function filterControlRecords(scope: AdminScope, rows: AdminRecord[], f: ControlFilters, now = new Date()): AdminRecord[] {
  const q = f.query.trim().toLowerCase();
  const cutoff = new Date(now);
  cutoff.setTime(now.getTime() - Number(f.days || 0) * 86400000);
  const filtered = rows.filter(row => {
    const searchable = [row.businessName, row.email, row.instapayHandle, row.sessionId, row.senderHandle, row.status,
      row.client?.businessName, row.client?.email, row.detectedRef, row.reference, row.event, row.action, row.details].filter(Boolean).join(' ').toLowerCase();
    if (q && !searchable.includes(q)) return false;
    if (f.merchantId && (scope === 'merchants' ? row.id : row.clientId || row.client?.id) !== f.merchantId) return false;
    if (f.days && !(new Date(row.createdAt).getTime() >= cutoff.getTime() && new Date(row.createdAt).getTime() <= now.getTime())) return false;
    if (scope === 'payments' && ((f.min && effectiveAmount(row) < Number(f.min)) || (f.max && effectiveAmount(row) > Number(f.max)))) return false;
    if (f.status === 'ALL') return true;
    if (scope === 'merchants') {
      if (f.status === 'ACTIVE') return row.approvalStatus === 'APPROVED' && row.isActive;
      if (f.status === 'SUSPENDED') return row.approvalStatus === 'APPROVED' && !row.isActive;
      if (f.status === 'EXPIRING') { const expiry = Date.parse(row.subscriptionEndsAt); return expiry >= now.getTime() && expiry <= now.getTime() + 7 * 86400000; }
      if (f.status === 'QUOTA') return row.txLimit > 0 && row.txCount / row.txLimit >= 0.8;
      return row.approvalStatus === f.status;
    }
    if (scope === 'webhooks') {
      if (f.status === 'SUCCESS') return row.isSuccess === true;
      if (f.status === 'REVIEW') return row.outcomeKnown === false;
      return row.isSuccess === false;
    }
    return (scope === 'audit' ? row.action : row.status) === f.status;
  });
  return [...filtered].sort((a, b) => {
    if (f.sort === 'amount-high') return effectiveAmount(b) - effectiveAmount(a);
    if (f.sort === 'amount-low') return effectiveAmount(a) - effectiveAmount(b);
    if (f.sort === 'name') return String(a.businessName || a.client?.businessName || a.action || '').localeCompare(String(b.businessName || b.client?.businessName || b.action || ''));
    const time = (row: AdminRecord) => Number.isFinite(Date.parse(row.createdAt)) ? Date.parse(row.createdAt) : (f.sort === 'oldest' ? Infinity : -Infinity);
    return f.sort === 'oldest' ? time(a) - time(b) : time(b) - time(a);
  });
}
export function amountFilterError(f: ControlFilters): string {
  if ([f.min, f.max].some(value => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0))) return 'Amounts must be valid non-negative numbers.';
  if (f.min !== '' && f.max !== '' && Number(f.min) > Number(f.max)) return 'Minimum amount must not exceed maximum amount.';
  return '';
}
export function adminCsv(scope: AdminScope, rows: AdminRecord[]): string {
  const columns: Array<[string, (r: AdminRecord) => unknown]> = scope === 'merchants' ? [
    ['Merchant', r => r.businessName], ['Email', r => r.email], ['Approval', r => r.approvalStatus], ['Active', r => r.isActive],
    ['Plan', r => r.subscriptionPlan], ['Transactions used', r => r.txCount], ['Quota', r => r.txLimit], ['Subscription ends', r => r.subscriptionEndsAt],
  ] : scope === 'payments' ? [
    ['Session ID', r => r.sessionId], ['Merchant', r => r.client?.businessName], ['Sender', r => r.senderHandle],
    ['Expected EGP', r => r.amountEgp], ['Detected EGP', r => r.detectedAmountEgp], ['Status', r => r.status], ['Reference', r => r.detectedRef], ['Created', r => r.createdAt],
  ] : scope === 'webhooks' ? [
    ['Merchant', r => r.client?.businessName], ['Event', r => r.event], ['Successful', r => r.isSuccess], ['HTTP status', r => r.statusCode],
    ['Attempt', r => r.attemptCount], ['Outcome known', r => r.outcomeKnown], ['Created', r => r.createdAt],
  ] : [['Action', r => r.action], ['Details', r => r.details], ['Created', r => r.createdAt]];
  const cell = (value: unknown) => { let s = String(value ?? ''); if (/^[\s]*[=+\-@]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  return '\uFEFF' + [columns.map(([title]) => cell(title)).join(','), ...rows.map(row => columns.map(([, read]) => cell(read(row))).join(','))].join('\r\n');
}
export function exportAdminCsv(scope: AdminScope, rows: AdminRecord[]) {
  const csv = adminCsv(scope, rows);
  const filename = `NilePay-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
  if (navigator.userAgent.includes('NilePayAdmin/')) {
    window.location.href = `nilepay-export://csv?filename=${encodeURIComponent(filename)}&csv=${encodeURIComponent(csv)}`;
  } else {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
