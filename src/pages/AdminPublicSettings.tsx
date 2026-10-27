import { useEffect, useState } from 'react';
import { adminApi, apiUrl, type PublicSiteContent } from '../services/api';

const fields: Array<[keyof PublicSiteContent, string]> = [
  ['operatorName', 'Business / operator name'], ['supportEmail', 'Support email'],
  ['whatsappNumber', 'WhatsApp number (international format)'], ['facebookName', 'Facebook page name'], ['facebookUrl', 'Facebook page URL'],
];

export function AdminPublicSettings() {
  const [content, setContent] = useState<PublicSiteContent | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setMessage('');
    adminApi.getPublicSiteSettings().then(data => { if (active) setContent(data); }).catch(() => { if (active) setMessage('Could not load website settings. Check the API and database migration.'); });
    return () => { active = false; };
  }, [reload]);
  if (!content) return <div role="status">{message || 'Loading website settings…'} {message && <button onClick={() => setReload(v => v + 1)}>Retry</button>}</div>;
  return <form onSubmit={async event => {
    event.preventDefault(); setSaving(true); setMessage('');
    try { setContent(await adminApi.savePublicSiteSettings(content)); setMessage('Saved. Public pages will use these details when opened or refreshed.'); }
    catch (error: any) { setMessage(error.response?.data?.error || 'Unable to save changes. Please try again.'); }
    finally { setSaving(false); }
  }} style={{ maxWidth: 850, display: 'grid', gap: 18 }}>
    <p>Manage the public support contacts and privacy policy. These settings are visible without signing in.</p>
    <fieldset disabled={saving} style={{ border: 0, padding: 0, display: 'grid', gap: 18 }}>
      {fields.map(([key, label]) => <label key={key} style={{ display: 'grid', gap: 6 }}>{label}<input type={key === 'supportEmail' ? 'email' : key === 'facebookUrl' ? 'url' : 'text'} required={key !== 'facebookUrl'} maxLength={320} value={content[key]} onChange={event => setContent({ ...content, [key]: event.target.value })} style={{ padding: 12, borderRadius: 10, border: '1px solid #64748b', background: 'transparent', color: 'inherit', width: '100%' }} /></label>)}
      <label style={{ display: 'grid', gap: 6 }}>Privacy policy text<textarea rows={16} maxLength={40000} value={content.privacyText} onChange={event => setContent({ ...content, privacyText: event.target.value })} style={{ padding: 12, borderRadius: 10, border: '1px solid #64748b', background: 'transparent', color: 'inherit', width: '100%' }} /></label>
      <small>Leave blank to use the built-in NilePay policy. Enter plain text to replace it. HTML is displayed as text. Policy edits do not change actual retention or processing behavior.</small>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}><button type="submit" style={{ padding: '12px 24px', borderRadius: 10, background: '#2563eb', color: '#fff' }}>{saving ? 'Saving…' : 'Save public settings'}</button><a href={apiUrl('/privacy')} target="_blank" rel="noopener noreferrer">View published privacy policy</a></div>
    </fieldset>
    {message && <p role="status">{message}</p>}
  </form>;
}
