import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Database,
  ExternalLink,
  FileText,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  ShieldAlert,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { apiUrl, getPublicSiteContent, type PublicSiteContent } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { PublicLinks } from '../components/PublicLinks';

interface PrivacyPageProps {
  inApp?: boolean;
}

export function PrivacyPage({ inApp = false }: PrivacyPageProps) {
  const { isDark } = useTheme();
  const { isRtl } = useLanguage();
  const [content, setContent] = useState<PublicSiteContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPublicSiteContent();
      setContent(data);
    } catch {
      setError(
        isRtl
          ? 'تعذر تحميل سياسة الخصوصية. يرجى المحاولة مرة أخرى.'
          : 'Failed to load privacy policy. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? 'rgba(51, 65, 85, 0.55)' : '#e2e8f0';
  const cardBg = isDark ? '#111827' : '#ffffff';
  const subcardBg = isDark ? 'rgba(22, 32, 51, 0.65)' : '#f8fafc';

  const cardStyle: React.CSSProperties = {
    padding: '24px',
    borderRadius: 18,
    backgroundColor: cardBg,
    border: `1px solid ${borderColor}`,
    boxShadow: isDark
      ? '0 10px 25px -5px rgba(0,0,0,0.45), 0 8px 10px -6px rgba(0,0,0,0.3)'
      : '0 4px 16px rgba(0,0,0,0.06)',
    marginBottom: '20px',
  };

  const sections = [
    {
      icon: <Database size={20} color="#38bdf8" />,
      titleEn: '1. Information We Process',
      titleAr: '١. البيانات والمعلومات التي نعالجها',
      contentEn:
        'We process merchant profile details (business name, registered email address, optional profile picture, payment handle/URL), encrypted access credentials, subscription status, transaction reconciliation records, device identifiers, and security metadata (IP address, client user-agent). Account passwords and sensitive secrets are hashed and never stored or transmitted in plain text.',
      contentAr:
        'نعالج بيانات حساب التاجر (اسم النشاط، البريد الإلكتروني، رابط الدفع/المعرف)، وبيانات الاعتماد المشفرة، وحالة الاشتراك، وسجلات مطابقة المدفوعات، ومعرّفات الأجهزة، وبيانات الأمان (عنوان IP وبيانات المتصفح/الجهاز). لا يتم مطلقاً تخزين أو إرسال كلمات المرور بشكل غير مشفر.',
    },
    {
      icon: <Smartphone size={20} color="#a855f7" />,
      titleEn: '2. Notification Access & Background Detection',
      titleAr: '٢. الوصول إلى الإشعارات والكشف التلقائي في الخلفية',
      contentEn:
        'With explicit merchant consent and system permissions, the NilePay Merchant APK processes only payment notifications received from the official InstaPay application. It parses transaction amounts, sender identifiers, references, and timestamps, then transmits them securely via encrypted HTTPS to match customer payments to merchant invoices. Other applications’ notifications are strictly ignored. Raw notification text is never stored or shared.',
      contentAr:
        'بموجب موافقة صريحة من التاجر وأذونات نظام أندرويد، يعالج تطبيق NilePay Merchant حصرياً إشعارات الدفع الواردة من تطبيق إنستاباي الرسمي. يتم استخراج مبالغ التحويلات، اسم/معرّف الراسل، والرقم المرجعي وإرسالها مشفرة عبر HTTPS لمطابقة الفواتير. يتم تجاهل إشعارات أي تطبيقات أخرى بالكامل، ولا يتم حفظ أو مشاركة نصوص الإشعارات الأصلية.',
    },
    {
      icon: <Shield size={20} color="#10b981" />,
      titleEn: '3. Purposes & Data Processors',
      titleAr: '٣. أغراض المعالجة والجهات المعالجة للبيانات',
      contentEn:
        'Data is used solely to authenticate merchants, verify incoming payments, provide transaction dashboards, dispatch secure webhooks to your store, administer subscriptions, and prevent fraud. NilePay does not sell personal data, nor does it use payment notifications for advertising or marketing.',
      contentAr:
        'تُستخدم البيانات فقط للتحقق من هوية التاجر، ومطابقة المدفوعات الواردة، وإرسال تنبيهات الويب المشفرة (Webhooks) لمتجرك، وإدارة الاشتراك، ومكافحة الاحتيال. لا تقوم نايل باي ببيع أي بيانات شخصية ولا تستخدم الإشعارات في الإعلانات.',
    },
    {
      icon: <Lock size={20} color="#f59e0b" />,
      titleEn: '4. Data Retention & Cleanup Policies',
      titleAr: '٤. سياسات حفظ البيانات والتنظيف الدوري',
      contentEn:
        'Active account information is maintained while your account remains open. Verified account deletion requests initiate a 72-hour cancellation window, after which personal identifiable data is permanently wiped by our automated cleanup system. Limited pseudonymized payment records are retained strictly for financial reconciliation and dispute resolution as required by financial safeguards.',
      contentAr:
        'يتم الاحتفاظ ببيانات الحساب طالما كان الحساب نشطاً. عند تقديم طلب حذف موثق، تبدأ فترة إلغاء مدتها 72 ساعة، ثم تُمسح البيانات الشخصية نهائياً عبر نظام التنظيف التلقائي. قد تُحفظ سجلات تسوية مدفوعات مجهولة الهوية لفترة محددة لأغراض النزاعات المالية.',
    },
    {
      icon: <Trash2 size={20} color="#ef4444" />,
      titleEn: '5. Account & Data Deletion Rights',
      titleAr: '٥. حقوق التاجر وحذف الحساب بالكامل',
      contentEn:
        'You have full control over your data. You can delete your account and associated credentials at any time through our self-service Account Deletion page or by contacting support. Deletion permanently revokes all mobile sessions, API keys, and device tokens.',
      contentAr:
        'لك كامل الحق في حذف حسابك وبياناتك في أي وقت مباشرة عبر صفحة حذف الحساب الذاتية أو عبر التواصل مع الدعم. يؤدي الحذف إلى إبطال كل جلسات الهواتف ومفاتيح API نهائياً.',
    },
  ];

  const operator = content?.operatorName || 'Premium Service';
  const supportEmail = content?.supportEmail || 'nilepay.customers@gmail.com';

  const innerContent = (
    <div
      className="merchant-page-container"
      style={{
        maxWidth: inApp ? '1100px' : '820px',
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
              backgroundColor: cardBg,
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
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FileText size={22} color="#ffffff" />
          </div>
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: textPrimary,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {isRtl ? 'سياسة الخصوصية وحماية البيانات' : 'NilePay Privacy Policy'}
            </h1>
            <p
              style={{
                fontSize: '13px',
                color: textSecondary,
                margin: '4px 0 0',
              }}
            >
              {isRtl
                ? `المشغّل المسؤول: ${operator} · آخر تحديث: أكتوبر 2026`
                : `Operator: ${operator} · Last updated: October 2026`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchContent}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '10px',
            backgroundColor: isDark ? '#162033' : '#ffffff',
            border: `1px solid ${borderColor}`,
            color: textPrimary,
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{isRtl ? 'تحديث' : 'Refresh'}</span>
        </button>
      </div>

      {/* Operator & Summary Notice */}
      <div
        style={{
          ...cardStyle,
          background: isDark
            ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(79, 70, 229, 0.05))'
            : 'linear-gradient(135deg, #f5f3ff, #eef2ff)',
          borderColor: isDark ? 'rgba(124, 58, 237, 0.3)' : '#ddd6fe',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: 1.7,
            color: textPrimary,
          }}
        >
          {isRtl
            ? `تلتزم منصة نايل باي المشغّلة بواسطة ${operator} بحماية خصوصية وأمان بيانات التجار والمستخدمين. تسري هذه السياسة على موقع وتطبيق نايل باي NilePay Merchant وعلى واجهات برمجة التطبيقات (API).`
            : `NilePay, operated by ${operator}, is committed to protecting the privacy and security of merchant and customer data. This policy covers NilePay Merchant, the web portal, and the NilePay API.`}
        </p>
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '13px',
            color: textSecondary,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Mail size={14} color="#7c3aed" />
            <a
              href={`mailto:${supportEmail}`}
              style={{ color: '#7c3aed', textDecoration: 'none', fontWeight: 600 }}
            >
              {supportEmail}
            </a>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Trash2 size={14} color="#ef4444" />
            <a
              href={apiUrl('/account-deletion')}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#ef4444', textDecoration: 'none', fontWeight: 600 }}
            >
              {isRtl ? 'طلب حذف الحساب والبيانات' : 'Request account deletion'}
            </a>
          </span>
        </div>
      </div>

      {/* Custom Admin Privacy Policy Text (if configured in settings) */}
      {content?.privacyText && content.privacyText.trim().length > 0 && (
        <div style={cardStyle}>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: textPrimary,
              margin: '0 0 12px 0',
            }}
          >
            {isRtl ? 'بنود الخصوصية المعتمدة' : 'Official Policy Details'}
          </h2>
          <div
            style={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              lineHeight: 1.7,
              fontSize: '13.5px',
              color: textSecondary,
            }}
          >
            {content.privacyText}
          </div>
        </div>
      )}

      {/* Comprehensive Standard Sections */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {sections.map((section, idx) => (
          <div key={idx} style={cardStyle}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '10px',
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {section.icon}
              </div>
              <h2
                style={{
                  fontSize: '15.5px',
                  fontWeight: 700,
                  color: textPrimary,
                  margin: 0,
                }}
              >
                {isRtl ? section.titleAr : section.titleEn}
              </h2>
            </div>
            <p
              style={{
                fontSize: '13.5px',
                lineHeight: 1.75,
                color: textSecondary,
                margin: 0,
              }}
            >
              {isRtl ? section.contentAr : section.contentEn}
            </p>
          </div>
        ))}
      </div>

      {/* Account Deletion Callout Card */}
      <div
        style={{
          ...cardStyle,
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2',
          borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#fecaca',
          marginTop: '10px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <ShieldAlert size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: isDark ? '#fca5a5' : '#b91c1c',
                margin: '0 0 6px',
              }}
            >
              {isRtl ? 'حذف الحساب وإلغاء الربط' : 'Exercising Your Right to Deletion'}
            </h3>
            <p
              style={{
                fontSize: '13px',
                lineHeight: 1.65,
                color: isDark ? '#fecaca' : '#7f1d1d',
                margin: '0 0 12px',
              }}
            >
              {isRtl
                ? 'يمكنك في أي وقت تقديم طلب حذف لحسابك وجميع البيانات المقترنة به من خلال صفحة الحذف العامة المعتمدة بدون الحاجة لإعادة تثبيت التطبيق.'
                : 'You may request full account and data erasure anytime via our automated deletion page. The process verifies your identity via registered email OTP.'}
            </p>
            <a
              href={apiUrl('/account-deletion')}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <span>{isRtl ? 'الانتقال إلى صفحة حذف الحساب' : 'Go to Account Deletion Page'}</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  if (inApp) {
    return innerContent;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: isDark ? '#090d16' : '#f1f5f9',
        color: textPrimary,
        padding: '32px 16px',
        transition: 'background-color 0.25s ease',
      }}
    >
      {innerContent}
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <PublicLinks />
      </div>
    </div>
  );
}
