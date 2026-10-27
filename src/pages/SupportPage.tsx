import { useEffect, useState } from 'react';
import { getPublicSiteContent, type PublicSiteContent } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { PublicLinks } from '../components/PublicLinks';

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
  const card = { display: 'block', padding: 20, borderRadius: 16, border: '1px solid ' + (isDark ? '#334155' : '#cbd5e1'), color: 'inherit', textDecoration: 'none', overflowWrap: 'anywhere' as const };
  return <main style={{ minHeight: '100vh', background: isDark ? '#090d16' : '#f1f5f9', color: isDark ? '#f8fafc' : '#0f172a', padding: '32px 20px' }}>
    <div style={{ maxWidth: 720, margin: 'auto' }}>
      <a href="#overview/">← Back to NilePay</a><h1 style={{ marginTop: 24 }}>How can we help?</h1>
      <p>Contact NilePay support. Never share your password, OTP, or API credentials.</p>
      {error ? <div role="alert">{error} <button onClick={() => setReload(v => v + 1)}>Retry</button></div> : !content ? <p role="status">Loading support details…</p> : <>
        <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
          <a style={card} href={`mailto:${content.supportEmail}`}><strong>Email support</strong><div>{content.supportEmail}</div></a>
          <a style={card} href={`https://wa.me/${content.whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"><strong>WhatsApp</strong><div dir="ltr">{content.whatsappNumber}</div></a>
          {content.facebookUrl ? <a style={card} href={content.facebookUrl} target="_blank" rel="noopener noreferrer"><strong>Facebook</strong><div>{content.facebookName}</div></a> : <div style={card}>Facebook: {content.facebookName}</div>}
        </div><p style={{ marginTop: 24 }}>Operated by {content.operatorName}</p>
      </>}
      <PublicLinks />
    </div>
  </main>;
}
