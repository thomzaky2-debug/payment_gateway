import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Facebook,
  LifeBuoy,
  Mail,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { getPublicSiteContent, type PublicSiteContent } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { PublicLinks } from '../components/PublicLinks';

function SupportMethodDetails({
  method,
  label,
  subtitle,
  value,
}: {
  method: 'email' | 'whatsapp' | 'facebook';
  label: string;
  subtitle: string;
  value: string;
}) {
  const { isDark } = useTheme();
  const color =
    method === 'whatsapp'
      ? isDark
        ? '#4ade80'
        : '#15803d'
      : method === 'facebook'
      ? isDark
        ? '#38bdf8'
        : '#0284c7'
      : isDark
      ? '#60a5fa'
      : '#2563eb';

  const bg =
    method === 'whatsapp'
      ? isDark
        ? 'rgba(34, 197, 94, 0.14)'
        : '#dcfce7'
      : method === 'facebook'
      ? isDark
        ? 'rgba(56, 189, 248, 0.14)'
        : '#e0f2fe'
      : isDark
      ? 'rgba(37, 99, 235, 0.16)'
      : '#dbeafe';

  const border =
    method === 'whatsapp'
      ? isDark
        ? '1px solid rgba(34, 197, 94, 0.3)'
        : '1px solid #86efac'
      : method === 'facebook'
      ? isDark
        ? '1px solid rgba(56, 189, 248, 0.3)'
        : '1px solid #bae6fd'
      : isDark
      ? '1px solid rgba(37, 99, 235, 0.3)'
      : '1px solid #bfdbfe';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: 14,
            color,
            backgroundColor: bg,
            border,
          }}
        >
          {method === 'email' ? (
            <Mail size={23} />
          ) : method === 'facebook' ? (
            <Facebook size={23} />
          ) : (
            <svg
              width="25"
              height="25"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z" />
              <path
                d="m8.3 6.8-1.1.6c-.5.3-.6 1.1-.3 1.9 1.2 3.4 3.4 5.6 6.8 6.8.8.3 1.6.2 1.9-.3l.6-1.1-2.6-1.5-.9.9a10 10 0 0 1-3.8-3.8l.9-.9-1.5-2.6Z"
                fill="currentColor"
                strokeWidth="0.6"
              />
            </svg>
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: '15px', fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a', display: 'block' }}>
            {label}
          </strong>
          <span style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', display: 'block', marginTop: '2px' }}>
            {subtitle}
          </span>
          <div
            dir={method === 'whatsapp' || method === 'email' ? 'ltr' : undefined}
            style={{
              marginTop: 6,
              color,
              fontSize: 13.5,
              fontWeight: 700,
              fontFamily: method === 'whatsapp' || method === 'email' ? "'JetBrains Mono', monospace" : undefined,
            }}
          >
            {value}
          </div>
        </div>
      </div>

      <span
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: isDark ? '#162033' : '#f8fafc',
          border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0'}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isDark ? '#94a3b8' : '#64748b',
          flexShrink: 0,
        }}
      >
        <ExternalLink size={15} />
      </span>
    </div>
  );
}

export function SupportPage({ inApp = false }: { inApp?: boolean }) {
  const { isDark } = useTheme();
  const { isRtl } = useLanguage();
  const [content, setContent] = useState<PublicSiteContent | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setError('');
    getPublicSiteContent()
      .then((data) => {
        if (active) setContent(data);
      })
      .catch(() => {
        if (active) {
          setError(
            isRtl
              ? 'بيانات الدعم غير متاحة مؤقتاً. يرجى المحاولة مرة أخرى.'
              : 'Support details are temporarily unavailable. Please try again.'
          );
        }
      });
    return () => {
      active = false;
    };
  }, [reload, isRtl]);

  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0';

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '20px 22px',
    borderRadius: 16,
    backgroundColor: isDark ? '#111827' : '#ffffff',
    border: `1px solid ${borderColor}`,
    boxShadow: isDark
      ? '0 10px 25px -5px rgba(0,0,0,0.45), 0 8px 10px -6px rgba(0,0,0,0.3)'
      : '0 4px 16px rgba(0,0,0,0.06)',
    color: 'inherit',
    textDecoration: 'none',
    overflowWrap: 'anywhere',
    transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
  };

  const innerContent = (
    <div
      className="merchant-page-container"
      style={{
        maxWidth: inApp ? '1100px' : '780px',
        margin: '0 auto',
        padding: inApp ? '24px' : '0',
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      {!inApp && (
        <div style={{ marginBottom: '20px' }}>
          <a
            href="#overview/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '10px',
              backgroundColor: isDark ? '#111827' : '#ffffff',
              border: `1px solid ${borderColor}`,
              color: textPrimary,
              fontSize: '12.5px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {isRtl ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
            <span>{isRtl ? 'العودة إلى بوابة نايل باي' : 'Back to NilePay'}</span>
          </a>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '13px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              flexShrink: 0,
            }}
          >
            <LifeBuoy size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
              {isRtl ? 'مركز المساعدة والدعم الفني' : 'How can we help?'}
            </h1>
            <p style={{ fontSize: '13px', color: textSecondary, margin: '2px 0 0 0' }}>
              {isRtl
                ? 'تواصل مع فريق دعم نايل باي مباشرة عبر القنوات الرسمية المعتمدة.'
                : 'Reach NilePay support directly through our verified merchant channels.'}
            </p>
          </div>
        </div>

        {content && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff',
              border: isDark ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid #bfdbfe',
              color: isDark ? '#60a5fa' : '#1d4ed8',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <Sparkles size={14} />
            <span>
              {isRtl ? `بإدارة ${content.operatorName}` : `Operated by ${content.operatorName}`}
            </span>
          </div>
        )}
      </div>

      {/* Security Notice Banner */}
      <div
        style={{
          marginBottom: '22px',
          padding: '14px 18px',
          borderRadius: '14px',
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
          border: isDark ? '1px solid rgba(245, 158, 11, 0.28)' : '1px solid #fde68a',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <ShieldAlert size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '12.5px', color: isDark ? '#fcd34d' : '#92400e', lineHeight: 1.5, fontWeight: 500 }}>
          {isRtl
            ? 'تنبيه أمني: لا تشارك كلمة المرور أو رمز التحقق (OTP) أو مفاتيح الـ API الخاصة بك مع أي شخص، بما في ذلك موظفو الدعم.'
            : 'Contact NilePay support. Never share your password, OTP, or API credentials.'}
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            ...cardStyle,
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#fecaca',
          }}
        >
          <span style={{ fontSize: '13.5px', color: isDark ? '#f87171' : '#dc2626', fontWeight: 600 }}>{error}</span>
          <button
            type="button"
            onClick={() => setReload((v) => v + 1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: 'white',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            <span>{isRtl ? 'إعادة المحاولة' : 'Retry'}</span>
          </button>
        </div>
      ) : !content ? (
        <div
          role="status"
          style={{
            ...cardStyle,
            justifyContent: 'center',
            padding: '48px 24px',
            flexDirection: 'column',
            textAlign: 'center',
          }}
        >
          <RefreshCw size={26} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ margin: '8px 0 0 0', fontSize: '13.5px', color: textSecondary, fontWeight: 600 }}>
            {isRtl ? 'جاري تحميل قنوات التواصل مع الدعم…' : 'Loading support details…'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: 16,
          }}
        >
          <a
            style={cardStyle}
            href={`mailto:${content.supportEmail}`}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = borderColor;
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <SupportMethodDetails
              method="email"
              label={isRtl ? 'الدعم عبر البريد الإلكتروني' : 'Email support'}
              subtitle={isRtl ? 'للاستفسارات الفنية، الحسابات، والتسويات' : 'For technical inquiries, billing, and account support'}
              value={content.supportEmail}
            />
          </a>

          <a
            style={cardStyle}
            href={`https://wa.me/${content.whatsappNumber.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#22c55e';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = borderColor;
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <SupportMethodDetails
              method="whatsapp"
              label={isRtl ? 'الدعم المباشر عبر واتساب' : 'WhatsApp'}
              subtitle={isRtl ? 'محادثة فورية مع فريق تشغيل التاجر' : 'Direct chat with merchant operations'}
              value={content.whatsappNumber}
            />
          </a>

          {content.facebookUrl ? (
            <a
              style={cardStyle}
              href={content.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#38bdf8';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = borderColor;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <SupportMethodDetails
                method="facebook"
                label={isRtl ? 'صفحة فيسبوك الرسمية' : 'Facebook'}
                subtitle={isRtl ? 'التحديثات الرسمية والتواصل الاجتماعي' : 'Official announcements & community updates'}
                value={content.facebookName}
              />
            </a>
          ) : (
            <div style={cardStyle}>
              <SupportMethodDetails
                method="facebook"
                label={isRtl ? 'صفحة فيسبوك الرسمية' : 'Facebook'}
                subtitle={isRtl ? 'التحديثات الرسمية والتواصل الاجتماعي' : 'Official announcements & community updates'}
                value={content.facebookName}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (inApp) {
    return innerContent;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: isDark ? '#090d16' : '#f1f5f9',
        color: textPrimary,
        padding: '32px 20px',
      }}
    >
      {innerContent}
      <PublicLinks />
    </main>
  );
}
