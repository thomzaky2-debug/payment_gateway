import { useEffect, useState } from 'react';
import { Facebook, Mail } from 'lucide-react';
import { getPublicSiteContent, type PublicSiteContent } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { PublicLinks } from '../components/PublicLinks';

function SupportMethodDetails({ method, label, value }: { method: 'email' | 'whatsapp' | 'facebook'; label: string; value: string }) {
  const { isDark } = useTheme();
  const color = method === 'whatsapp' ? (isDark ? '#4ade80' : '#15803d') : (isDark ? '#60a5fa' : '#2563eb');
  return <>
    <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 48, height: 48, flexShrink: 0, borderRadius: 14, color, backgroundColor: method === 'whatsapp' ? (isDark ? '#123528' : '#dcfce7') : (isDark ? '#162d4d' : '#dbeafe') }}>
      {method === 'email' ? <Mail size={25} /> : method === 'facebook' ? <Facebook size={25} /> : (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z" />
          <path d="m8.3 6.8-1.1.6c-.5.3-.6 1.1-.3 1.9 1.2 3.4 3.4 5.6 6.8 6.8.8.3 1.6.2 1.9-.3l.6-1.1-2.6-1.5-.9.9a10 10 0 0 1-3.8-3.8l.9-.9-1.5-2.6Z" fill="currentColor" strokeWidth="0.6" />
        </svg>
      )}
    </span>
    <div style={{ minWidth: 0 }}>
      <strong>{label}</strong>
      <div dir={method === 'whatsapp' ? 'ltr' : undefined} style={{ marginTop: 5, color: isDark ? '#cbd5e1' : '#475569', fontSize: 14 }}>{value}</div>
    </div>
  </>;
}

export function SupportPage() {
  const { isDark } = useTheme();
  const [content, setContent] = useState<PublicSiteContent | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    getPublicSiteContent().then(data => { if (active) setContent(data); }).catch(() => { if (active) setError('Support details are temporarily unavailable. Please try again.'); });
    return () => { active = false; };
  }, [reload]);
  const card = { display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, border: '1px solid ' + (isDark ? '#334155' : '#cbd5e1'), color: 'inherit', textDecoration: 'none', overflowWrap: 'anywhere' as const };
  return <main style={{ minHeight: '100vh', background: isDark ? '#090d16' : '#f1f5f9', color: isDark ? '#f8fafc' : '#0f172a', padding: '32px 20px' }}>
    <div style={{ maxWidth: 720, margin: 'auto' }}>
      <a href="#overview/">← Back to NilePay</a><h1 style={{ marginTop: 24 }}>How can we help?</h1>
      <p>Contact NilePay support. Never share your password, OTP, or API credentials.</p>
      {error ? <div role="alert">{error} <button onClick={() => setReload(v => v + 1)}>Retry</button></div> : !content ? <p role="status">Loading support details…</p> : <>
        <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
          <a style={card} href={`mailto:${content.supportEmail}`}><SupportMethodDetails method="email" label="Email support" value={content.supportEmail} /></a>
          <a style={card} href={`https://wa.me/${content.whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"><SupportMethodDetails method="whatsapp" label="WhatsApp" value={content.whatsappNumber} /></a>
          {content.facebookUrl ? <a style={card} href={content.facebookUrl} target="_blank" rel="noopener noreferrer"><SupportMethodDetails method="facebook" label="Facebook" value={content.facebookName} /></a> : <div style={card}><SupportMethodDetails method="facebook" label="Facebook" value={content.facebookName} /></div>}
        </div><p style={{ marginTop: 24 }}>Operated by {content.operatorName}</p>
      </>}
      <PublicLinks />
    </div>
  </main>;
}
