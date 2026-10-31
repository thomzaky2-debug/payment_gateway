import React from 'react';
import type { Page } from '../App';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  Cpu,
  CreditCard,
  FileCheck2,
  Globe,
  Layers,
  LifeBuoy,
  Link2,
  Lock,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Wallet,
  Webhook,
  Zap,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { PublicLinks } from '../components/PublicLinks';

interface AboutPageProps {
  inApp?: boolean;
  onNavigate?: (page: Page, subPath?: string) => void;
}

export function AboutPage({ inApp = false, onNavigate }: AboutPageProps) {
  const { isDark } = useTheme();
  const { isRtl } = useLanguage();

  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? 'rgba(51, 65, 85, 0.55)' : '#e2e8f0';
  const cardBg = isDark ? '#111827' : '#ffffff';
  const subcardBg = isDark ? 'rgba(22, 32, 51, 0.65)' : '#f8fafc';

  const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    backgroundColor: cardBg,
    border: `1px solid ${borderColor}`,
    borderRadius: '18px',
    padding: '24px',
    boxShadow: isDark
      ? '0 10px 25px -5px rgba(0, 0, 0, 0.45), 0 8px 10px -6px rgba(0, 0, 0, 0.3)'
      : '0 4px 18px rgba(15, 23, 42, 0.05)',
    ...extra,
  });

  const subcard = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    backgroundColor: subcardBg,
    border: `1px solid ${borderColor}`,
    borderRadius: '14px',
    padding: '18px',
    ...extra,
  });

  const highlights = [
    {
      icon: <Wallet size={20} color="#10b981" />,
      badgeBg: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ecfdf5',
      titleEn: 'Direct-to-Merchant Settlement (0s Hold)',
      titleAr: 'تسوية فورية مباشرة لحساب التاجر (بدون احتجاز)',
      descEn:
        'Customer transfers go directly from their bank or wallet into your own InstaPay account. NilePay never holds or delays your funds.',
      descAr:
        'تنتقل تحويلات العملاء مباشرة من حسابهم البنكي أو محفظتهم إلى حسابك في إنستاباي فوراً دون أي وسطاء أو فترات احتجاز للأموال.',
    },
    {
      icon: <Smartphone size={20} color="#3b82f6" />,
      badgeBg: isDark ? 'rgba(59, 130, 246, 0.14)' : '#eff6ff',
      titleEn: '24/7 Continuous Android Companion',
      titleAr: 'تطبيق كاشف أندرويد يعمل باستمرار 24/7',
      descEn:
        'Powered by a protected foreground service, WakeLock capture, and unrestricted battery mode so incoming InstaPay notifications are detected in real time.',
      descAr:
        'يعمل بخدمة أمامية محمية وإعفاء من قيود البطارية لرصد إشعارات إنستاباي فور وصولها حتى أثناء قفل الشاشة.',
    },
    {
      icon: <Sliders size={20} color="#8b5cf6" />,
      badgeBg: isDark ? 'rgba(139, 92, 246, 0.14)' : '#f5f3ff',
      titleEn: 'Smart Settlement & Tolerance Engine',
      titleAr: 'محرك مطابقة ذكي وقواعد مرنة للمدفوعات',
      descEn:
        'Automatically reconciles exact payments, applies your custom overpayment/underpayment rules, and routes exceptions to Manual Review.',
      descAr:
        'يطابق المبالغ الصحيحة تلقائياً، ويطبق قواعدك الخاصة للدفعات الزائدة أو الناقصة، ويحول الحالات الاستثنائية للمراجعة اليدوية.',
    },
    {
      icon: <Webhook size={20} color="#06b6d4" />,
      badgeBg: isDark ? 'rgba(6, 182, 212, 0.14)' : '#ecfeff',
      titleEn: 'HMAC-SHA256 Webhooks & Real-Time Sync',
      titleAr: 'ويب هوك مشفر HMAC وتحديثات لحظية',
      descEn:
        'Instant Socket.IO dashboard updates and cryptographically signed webhook deliveries with automated exponential backoff retries.',
      descAr:
        'إشعارات فورية للوحة التحكم وإرسال Webhook موقع رقمياً بتشفير HMAC-SHA256 إلى خادمك مع إعادة المحاولة التلقائية.',
    },
  ];

  const lifecycleSteps = [
    {
      step: '01',
      color: '#2563eb',
      icon: <Layers size={19} color="white" />,
      titleEn: 'Merchant Onboarding & Checkout Configuration',
      titleAr: 'إعداد حساب التاجر ورابط الدفع',
      descEn:
        'After verifying your email and receiving account approval, configure your Business Display Name and Brand Avatar in Merchant Profile, then paste your official InstaPay share link (https://ipn.eg/S/.../instapay/...) in Checkout Settings. NilePay automatically extracts and validates your receiving InstaPay IPA handle.',
      descAr:
        'بعد تفعيل حسابك والموافقة عليه، قم بضبط الاسم التجاري وشعار المتجر في "ملف التاجر"، ثم أضف رابط الدفع الرسمي الخاص بك من تطبيق إنستاباي في "إعدادات الدفع". يقوم النظام باستخراج والتحقق من عنوان الاستلام (IPA) تلقائياً.',
      tagsEn: ['Email OTP Verification', 'Auto-Derived IPA Handle', 'Custom Session TTL (5–180m)'],
      tagsAr: ['تحقق عبر رمز البريد', 'استخراج تلقائي للـ IPA', 'مهلة جلسة مرنة (5–180 دقيقة)'],
    },
    {
      step: '02',
      color: '#7c3aed',
      icon: <Smartphone size={19} color="white" />,
      titleEn: 'Android Companion App Enrollment & Keep-Alive Protection',
      titleAr: 'ربط تطبيق NilePay Merchant وحماية العمل بالخلفية',
      descEn:
        'Download and install the signed NilePay Merchant APK on the Android phone that receives your InstaPay notifications. Sign in with your merchant email, password, and 6-digit OTP, accept the privacy disclosure, enable Notification Access, and allow Unrestricted Battery Usage. The app runs a continuous foreground service with 90-second heartbeats and automatic boot recovery.',
      descAr:
        'ثبّت تطبيق NilePay Merchant الرسمي على هاتف الأندرويد المستلم لإشعارات إنستاباي. سجّل الدخول ببريدك وكلمة المرور ورمز التحقق، وفعّل صلاحية الوصول للإشعارات والعمل غير المقيّد للبطارية لضمان عمل الكاشف باستمرار وإرسال نبضات اتصال كل 90 ثانية.',
      tagsEn: ['Foreground Keep-Alive Service', '90s Live Heartbeat', 'Offline Local Queue (Room DB)'],
      tagsAr: ['خدمة خلفية مستمرة', 'نبضة اتصال كل 90 ثانية', 'طابور تخزين محلي عند انقطاع الإنترنت'],
    },
    {
      step: '03',
      color: '#0284c7',
      icon: <Code2 size={19} color="white" />,
      titleEn: 'Creating a Customer Checkout Session',
      titleAr: 'إنشاء جلسة دفع للعميل (Checkout Session)',
      descEn:
        'When a customer checks out on your website or app, your backend calls POST /api/v1/checkout/sessions using your Live API Key (X-Api-Key) with the expected amount in EGP, customer sender IPA/phone, and order metadata. NilePay creates a time-bounded PENDING session and returns the hosted checkout URL and payment instructions.',
      descAr:
        'عندما يطلب العميل الدفع في متجرك، يرسل خادمك طلباً إلى POST /api/v1/checkout/sessions باستخدام مفتاح الـ API الحي مع تحديد المبلغ بالجنيه ومعرّف المرسل وبيانات الطلب. ينشئ النظام جلسة دفع بحالة PENDING ويعيد رابط صفحة الدفع المستضافة.',
      tagsEn: ['REST API v1', 'Hosted Checkout UI', 'Idempotent Session Tracking'],
      tagsAr: ['واجهة برمجية REST v1', 'صفحة دفع مستضافة جاهزة', 'تتبع دقيق للجلسات'],
    },
    {
      step: '04',
      color: '#059669',
      icon: <CreditCard size={19} color="white" />,
      titleEn: 'Customer Transfers via Official InstaPay App',
      titleAr: 'تحويل العميل عبر تطبيق إنستاباي الرسمي',
      descEn:
        'The customer views your verified store identity on the checkout screen, opens your InstaPay payment link or QR code, and authorizes the instant transfer inside the official InstaPay app (com.egyptianbanks.instapay). The money settles directly into your linked bank account or wallet within seconds.',
      descAr:
        'يرى العميل هوية متجرك الموثقة في شاشة الدفع، ويفتح رابط إنستاباي لإتمام التحويل اللحظي عبر تطبيق إنستاباي الرسمي. تصل الأموال مباشرة إلى حسابك البنكي خلال ثوانٍ.',
      tagsEn: ['Instant Bank Transfer', 'Verified Store Branding', 'Zero Middleman Custody'],
      tagsAr: ['تحويل بنكي لحظي', 'هوية متجر موثقة', 'إيداع مباشر بحسابك البنكي'],
    },
    {
      step: '05',
      color: '#d97706',
      icon: <Cpu size={19} color="white" />,
      titleEn: 'Instant Notification Parsing & Settlement Matching',
      titleAr: 'التقاط الإشعار والمطابقة الذكية للمدفوعات',
      descEn:
        'As soon as the InstaPay receipt notification lands on your Android phone, NilePay Merchant acquires a WakeLock, parses the amount, sender handle, bank reference, and timestamp, and dispatches an expedited HTTPS webhook to NilePay. The Settlement Engine matches the payment against active PENDING sessions and applies your configured tolerance rules.',
      descAr:
        'فور وصول إشعار الإيصال من تطبيق إنستاباي على هاتفك، يستخرج تطبيق NilePay Merchant المبلغ، عنوان المرسل، والمرجع البنكي، ويرسلها فوراً عبر اتصال مشفر HTTPS إلى خادم نايل باي لمطابقتها مع الجلسات النشطة وتطبيق قواعد الدفعات الزائدة أو الناقصة.',
      tagsEn: ['Exact → CONFIRMED', 'Overpaid / Underpaid Rules', 'Unmatched & Late Detection'],
      tagsAr: ['مطابقة تامة ← مؤكدة', 'قواعد الزيادة والنقصان', 'رصد التحويلات المتأخرة وغير المطابقة'],
    },
    {
      step: '06',
      color: '#10b981',
      icon: <Webhook size={19} color="white" />,
      titleEn: 'Signed Webhook Delivery & Real-Time Order Fulfillment',
      titleAr: 'إرسال الويب هوك وتنفيذ طلب العميل تلقائياً',
      descEn:
        'Once confirmed (either automatically or after manual review approval), NilePay broadcasts a live Socket.IO event to your web/mobile dashboard and sends an HMAC-SHA256 signed POST webhook to your backend URL. If your server is temporarily unreachable, the background Webhook Retry Worker automatically retries delivery.',
      descAr:
        'بمجرد تأكيد الدفعة (تلقائياً أو بعد اعتمادها من المراجعة اليدوية)، يحدث النظام لوحة التحكم لحظياً ويرسل إشعار Webhook موقعاً بتشفير HMAC-SHA256 إلى متجرك لتأكيد الطلب تلقائياً، مع نظام إعادة محاولة تلقائي في حال انشغال خادمك.',
      tagsEn: ['X-InstaPay-Signature (HMAC-SHA256)', 'Auto Retry Worker (30s cycle)', 'Live Socket.IO Alerts'],
      tagsAr: ['توقيع رقمي HMAC-SHA256', 'إعادة محاولة تلقائية للويب هوك', 'تنبيهات لحظية عبر Socket.IO'],
    },
  ];

  const settlementStatuses = [
    {
      status: 'CONFIRMED',
      color: '#10b981',
      bg: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ecfdf5',
      titleEn: 'Confirmed Payment',
      titleAr: 'دفعة مؤكدة (Confirmed)',
      descEn: 'Received amount matches the expected session amount (or falls within your auto-confirm overpayment rule) before expiry.',
      descAr: 'المبلغ المستلم يطابق مبلغ جلسة الدفع (أو يقع ضمن حد القبول التلقائي للزيادة) قبل انتهاء صلاحية الجلسة.',
    },
    {
      status: 'PENDING',
      color: '#3b82f6',
      bg: isDark ? 'rgba(59, 130, 246, 0.14)' : '#eff6ff',
      titleEn: 'Pending Customer Transfer',
      titleAr: 'بانتظار التحويل (Pending)',
      descEn: 'Active checkout session waiting for the customer to complete the InstaPay transfer within the configured session TTL.',
      descAr: 'جلسة دفع نشطة بانتظار إتمام العميل للتحويل عبر إنستاباي خلال المهلة المحددة.',
    },
    {
      status: 'OVERPAID / UNDERPAID',
      color: '#f59e0b',
      bg: isDark ? 'rgba(245, 158, 11, 0.14)' : '#fffbeb',
      titleEn: 'Amount Variance (Review Queue)',
      titleAr: 'مبلغ زائد أو ناقص (مراجعة يدوية)',
      descEn: 'Customer transferred more or less than expected. Recorded with exact expected vs. received difference for 1-click merchant decision.',
      descAr: 'حوّل العميل مبلغاً أكبر أو أقل من المطلوب. يتم تسجيل الفرق بدقة ليتمكن التاجر من اعتماده أو رفضه من قسم المراجعة اليدوية.',
    },
    {
      status: 'UNMATCHED / LATE_EXPIRED',
      color: '#8b5cf6',
      bg: isDark ? 'rgba(139, 92, 246, 0.14)' : '#f5f3ff',
      titleEn: 'Unmatched or Late Transfer',
      titleAr: 'تحويل غير مطابق أو متأخر',
      descEn: 'An InstaPay transfer arrived without an active session or after session expiry. Safely captured so no customer payment is ever lost.',
      descAr: 'تحويل وصل بعد انتهاء مهلة الجلسة أو بدون جلسة مطابقة؛ يتم حفظه في المراجعة اليدوية لضمان عدم ضياع أي تحويل للعملاء.',
    },
    {
      status: 'SENDER_MISMATCH / DUPLICATE',
      color: '#ef4444',
      bg: isDark ? 'rgba(239, 68, 68, 0.14)' : '#fef2f2',
      titleEn: 'Risk & Anomaly Protection',
      titleAr: 'حماية من التكرار واختلاف المرسل',
      descEn: 'Flags duplicate bank references or mismatched sender handles and holds them for merchant verification before fulfilling the order.',
      descAr: 'يرصد المراجع البنكية المكررة أو اختلاف معرّف المرسل ويضعها قيد التحقق لحماية التاجر من الاحتيال أو التكرار.',
    },
  ];

  const portalModules = [
    {
      emoji: '📊',
      page: 'overview' as Page,
      titleEn: 'Overview & Live Telemetry',
      titleAr: 'الرئيسية والإحصائيات الحية',
      descEn: 'Real-time daily and monthly confirmed volume, transaction counts, pending sessions, and subscription quota tracking.',
      descAr: 'متابعة لحظية لإجمالي المبالغ المؤكدة، عدد العمليات، الجلسات النشطة، ونسبة استهلاك الباقة.',
    },
    {
      emoji: '💳',
      page: 'transactions' as Page,
      titleEn: 'Transactions Ledger',
      titleAr: 'سجل المعاملات الكامل',
      descEn: 'Searchable, filterable history of all checkout sessions with sender IPA, bank reference, timestamps, and variance breakdown.',
      descAr: 'سجل شامل قابل للبحث والتصفية لجميع المعاملات مع عنوان المرسل، الرقم المرجعي البنكي، وتفاصيل المبالغ.',
    },
    {
      emoji: '🛡️',
      page: 'review' as Page,
      titleEn: 'Manual Review Queue',
      titleAr: 'طابور المراجعة اليدوية',
      descEn: 'Inspect and resolve overpaid, underpaid, late, or unmatched transfers and trigger webhook notifications upon approval.',
      descAr: 'مراجعة واعتماد أو رفض الدفعات الزائدة والناقصة والمتأخرة وغير المطابقة بضغطة واحدة.',
    },
    {
      emoji: '📱',
      page: 'detector' as Page,
      titleEn: 'Detector Companion Center',
      titleAr: 'مركز تطبيق الكاشف (Detector)',
      descEn: 'Download the latest signed NilePay Merchant release APK and monitor your Android phone’s live heartbeat and connection status.',
      descAr: 'تنزيل أحدث نسخة رسمية من تطبيق NilePay Merchant ومراقبة حالة اتصال الهاتف ونبضات الخلفية.',
    },
    {
      emoji: '💻',
      page: 'developers' as Page,
      titleEn: 'Developer Portal & API Docs',
      titleAr: 'بوابة المطورين والتوثيق البرمجي',
      descEn: 'Manage your Live API Key, Companion Detector Token, Webhook Secret, and explore code examples in Node.js, Python, and PHP.',
      descAr: 'إدارة مفاتيح الـ API ورمز الكاشف وسر الويب هوك مع أمثلة برمجية متكاملة بـ Node.js و Python و PHP.',
    },
    {
      emoji: '🔒',
      page: 'security' as Page,
      titleEn: 'Security, Privacy & Audit Log',
      titleAr: 'الأمان والخصوصية وسجل العمليات',
      descEn: 'Configure Two-Factor Authentication (TOTP), review active web/mobile sessions, and inspect the immutable security audit trail.',
      descAr: 'تفعيل المصادقة الثنائية (2FA)، إدارة الجلسات والأجهزة المتصلة، ومراجعة سجل العمليات الأمني.',
    },
  ];

  const innerContent = (
    <div
      className="merchant-page-container"
      style={{
        maxWidth: '1320px',
        margin: '0 auto',
        padding: inApp ? '24px' : '0',
        direction: isRtl ? 'rtl' : 'ltr',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {!inApp && (
        <div>
          <a
            href="#overview/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
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
            <span>{isRtl ? 'العودة إلى بوابة نايل باي' : 'Back to NilePay Portal'}</span>
          </a>
        </div>
      )}

      {/* ─── Hero Overview Card ─── */}
      <div
        style={{
          ...card({ padding: '32px' }),
          background: isDark
            ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(15, 23, 42, 0.95) 55%, rgba(6, 182, 212, 0.14) 100%)'
            : 'linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #ecfeff 100%)',
          border: isDark ? '1px solid rgba(59, 130, 246, 0.32)' : '1px solid #bfdbfe',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '15px',
                  backgroundColor: '#081426',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 22px rgba(37, 99, 235, 0.28)',
                  flexShrink: 0,
                }}
              >
                <img src="/brand/nilepay-mark.png" alt="NilePay" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 800, color: textPrimary, margin: 0, letterSpacing: '-0.4px' }}>
                    {isRtl ? 'عن بوابة نايل باي (NilePay) وكيف تعمل بالتفصيل' : 'About NilePay & How It Works'}
                  </h1>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.16)' : '#e0f2fe',
                      color: isDark ? '#38bdf8' : '#0284c7',
                      border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd',
                    }}
                  >
                    {isRtl ? 'بنية الدفع اللحظي المتكاملة' : 'REAL-TIME INSTAPAY INFRASTRUCTURE'}
                  </span>
                </div>
                <p style={{ fontSize: '13.5px', color: textSecondary, margin: '4px 0 0 0' }}>
                  {isRtl
                    ? 'دليل شامل لدورة حياة المدفوعات، تطبيق الكاشف على أندرويد، محرك المطابقة الذكي، والتكامل البرمجي.'
                    : 'Complete guide to the NilePay payment lifecycle, Android companion detector, smart reconciliation engine, and API integration.'}
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '11px',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#dcfce7',
                border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #86efac',
                color: isDark ? '#34d399' : '#059669',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              <ShieldCheck size={16} />
              <span>{isRtl ? 'إيداع مباشر 100% في حسابك البنكي' : '100% Direct-to-Bank Settlement'}</span>
            </div>
          </div>

          <p style={{ fontSize: '14px', lineHeight: 1.75, color: isDark ? '#cbd5e1' : '#334155', margin: 0, maxWidth: '980px' }}>
            {isRtl
              ? 'نايل باي (NilePay) هي بوابة دفع وتأكيد آلي للمدفوعات اللحظية عبر شبكة إنستاباي (InstaPay) في مصر. تتيح للتجار والشركات والمتاجر الإلكترونية استقبال التحويلات البنكية اللحظية مباشرة في حساباتهم البنكية الخاصة دون أي وسيط مالي يحتجز الأموال، مع أتمتة كاملة لعملية التحقق من الإيصالات، مطابقة المبالغ، وتأكيد الطلبات لحظياً عبر تطبيق NilePay Merchant والواجهة البرمجية (REST API & Webhooks).'
              : 'NilePay is an automated payment orchestration and verification gateway built for Egypt’s InstaPay real-time payment network. It empowers merchants, e-commerce stores, and SaaS platforms to accept instant bank transfers directly into their own InstaPay accounts with zero intermediary fund custody — automating receipt detection, amount reconciliation, exception handling, and webhook order fulfillment in real time.'}
          </p>

          {/* 4 Core Pillars */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
              gap: '14px',
              marginTop: '4px',
            }}
          >
            {highlights.map((item, idx) => (
              <div
                key={idx}
                style={{
                  ...subcard({ padding: '16px' }),
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.9)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: item.badgeBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  <h3 style={{ fontSize: '13.5px', fontWeight: 700, color: textPrimary, margin: 0, lineHeight: 1.35 }}>
                    {isRtl ? item.titleAr : item.titleEn}
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: textSecondary, margin: 0, lineHeight: 1.6 }}>
                  {isRtl ? item.descAr : item.descEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── End-to-End 6-Step Payment Lifecycle ─── */}
      <div style={card()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              flexShrink: 0,
            }}
          >
            <Zap size={20} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: textPrimary, margin: 0 }}>
              {isRtl ? 'كيف تعمل نايل باي خطوة بخطوة (دورة حياة العملية)' : 'How NilePay Works Step-by-Step (End-to-End Lifecycle)'}
            </h2>
            <p style={{ fontSize: '12.5px', color: textSecondary, margin: '2px 0 0 0' }}>
              {isRtl
                ? 'من لحظة إعداد متجرك وإنشاء جلسة الدفع وحتى تأكيد الطلب تلقائياً عبر الويب هوك'
                : 'From store configuration and checkout session creation to automatic payment confirmation and webhook delivery'}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
            gap: '16px',
          }}
        >
          {lifecycleSteps.map((step) => (
            <div
              key={step.step}
              style={{
                ...subcard({ padding: '20px' }),
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: step.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 4px 12px ${step.color}40`,
                      }}
                    >
                      {step.icon}
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: textPrimary, margin: 0, lineHeight: 1.35 }}>
                      {isRtl ? step.titleAr : step.titleEn}
                    </h3>
                  </div>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '12px',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
                      color: isDark ? '#60a5fa' : '#2563eb',
                      flexShrink: 0,
                    }}
                  >
                    {isRtl ? `خطوة ${step.step}` : `STEP ${step.step}`}
                  </span>
                </div>

                <p style={{ fontSize: '12.5px', color: textSecondary, margin: 0, lineHeight: 1.65 }}>
                  {isRtl ? step.descAr : step.descEn}
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '10px', borderTop: `1px solid ${borderColor}` }}>
                {(isRtl ? step.tagsAr : step.tagsEn).map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Visual Guide: How Merchants Find Their InstaPay IPN Link ("رابط") ─── */}
      <div style={card()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '11px',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                flexShrink: 0,
              }}
            >
              <Link2 size={20} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl
                  ? 'دليل التاجر المصور: كيف تحصل على رابط الدفع (IPN Link) من تطبيق إنستاباي؟'
                  : 'Merchant Guide: How to Find Your InstaPay IPN Link ("رابط")'}
              </h2>
              <p style={{ fontSize: '12.5px', color: textSecondary, margin: '3px 0 0 0' }}>
                {isRtl
                  ? 'اضغط على خيار "رابط" المحدد باللون الأخضر داخل بطاقة حسابك في تطبيق إنستاباي لنسخ رابط الاستلام المباشر'
                  : 'Select the highlighted "رابط" (Link) button on your account card inside the InstaPay app to copy your direct share URL'}
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('settings', 'checkout')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>{isRtl ? 'إعداد رابط الدفع الآن' : 'Configure Payment Link'}</span>
              <ArrowRight size={14} style={isRtl ? { transform: 'rotate(180deg)' } : undefined} />
            </button>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 310px), 1fr))',
            gap: '24px',
            alignItems: 'center',
          }}
        >
          {/* Highlighted Screenshot */}
          <div
            style={{
              borderRadius: '16px',
              overflow: 'hidden',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
              backgroundColor: '#0b101e',
              boxShadow: '0 14px 32px rgba(0, 0, 0, 0.25)',
              maxWidth: '420px',
              width: '100%',
              margin: '0 auto',
            }}
          >
            <img
              src="/guides/instapay-ipn-link-guide.jpg"
              alt={isRtl ? 'تحديد زر رابط في تطبيق إنستاباي' : 'Selecting رابط in the InstaPay app'}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>

          {/* 3-Step Walkthrough */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              {
                num: '01',
                color: '#8b5cf6',
                titleEn: 'Open InstaPay & Find Your Bank Account Card',
                titleAr: 'افتح تطبيق إنستاباي وانتقل إلى قسم "الحسابات"',
                descEn: 'From the InstaPay home screen under "الحسابات" (Accounts), swipe to the bank account card where you want customer transfers deposited (e.g. username@instapay).',
                descAr: 'في الشاشة الرئيسية لتطبيق إنستاباي وتحت قسم "الحسابات"، اختر بطاقة الحساب البنكي الذي تريد استقبال مدفوعات العملاء عليه.',
              },
              {
                num: '02',
                color: '#10b981',
                titleEn: 'Tap "رابط" (Link) — Highlighted in Green',
                titleAr: 'اضغط على زر "رابط" (المحدد باللون الأخضر في الصورة)',
                descEn: 'Below your account handle, tap the middle action button labeled "رابط" (between "مشاركة QR" and "الرصيد") to copy your official InstaPay payment link.',
                descAr: 'أسفل عنوان حسابك ستجد ثلاثة أزرار: (مشاركة QR - رابط - الرصيد). اضغط على الزر الأوسط "رابط" لنسخ رابط الدفع الرسمي الخاص بك.',
              },
              {
                num: '03',
                color: '#3b82f6',
                titleEn: 'Paste into Store Settings → Checkout',
                titleAr: 'الصق الرابط في إعدادات المتجر ← الدفع (Checkout)',
                descEn: 'Paste the copied link (https://ipn.eg/S/username/instapay/TOKEN) into NilePay. The gateway automatically extracts the clean URL and derives your receiving IPA handle (username@instapay).',
                descAr: 'الصق الرابط المنسوخ (https://ipn.eg/S/username/instapay/TOKEN) في بوابة نايل باي، وسيقوم النظام تلقائياً باستخراج الرابط النظيف ومعرف الاستلام (username@instapay).',
              },
            ].map((item) => (
              <div
                key={item.num}
                style={{
                  ...subcard({ padding: '16px' }),
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  borderLeft: isRtl ? undefined : `3px solid ${item.color}`,
                  borderRight: isRtl ? `3px solid ${item.color}` : undefined,
                }}
              >
                <div
                  style={{
                    minWidth: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    backgroundColor: `${item.color}18`,
                    border: `1px solid ${item.color}40`,
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    fontFamily: "'JetBrains Mono', monospace",
                    flexShrink: 0,
                  }}
                >
                  {item.num}
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: textPrimary, marginBottom: '4px' }}>
                    {isRtl ? item.titleAr : item.titleEn}
                  </div>
                  <div style={{ fontSize: '12px', color: textSecondary, lineHeight: 1.6 }}>
                    {isRtl ? item.descAr : item.descEn}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Two-Column Deep Dive: Settlement States + Android Detector Architecture ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap: '20px',
          alignItems: 'stretch',
        }}
      >
        {/* Left Card: Settlement Engine & Transaction States */}
        <div style={card()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '11px',
                background: 'linear-gradient(135deg, #059669, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                flexShrink: 0,
              }}
            >
              <FileCheck2 size={20} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? 'محرك التسوية وحالات المعاملات' : 'Settlement Engine & Payment States'}
              </h2>
              <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                {isRtl
                  ? 'كيف يتعامل النظام مع المبالغ المطابقة، الزائدة، الناقصة، أو المتأخرة'
                  : 'How NilePay classifies exact, overpaid, underpaid, and late transfers'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {settlementStatuses.map((item, idx) => (
              <div
                key={idx}
                style={{
                  ...subcard({ padding: '14px 16px' }),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '13.5px', color: textPrimary }}>
                    {isRtl ? item.titleAr : item.titleEn}
                  </strong>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: item.bg,
                      color: item.color,
                    }}
                  >
                    {item.status}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: textSecondary, margin: 0, lineHeight: 1.55 }}>
                  {isRtl ? item.descAr : item.descEn}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Card: Android Companion & Security Architecture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ ...card(), flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '11px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                  flexShrink: 0,
                }}
              >
                <Smartphone size={20} color="white" />
              </div>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'بنية تطبيق الكاشف (NilePay Merchant APK)' : 'Android Companion Detector Architecture'}
                </h2>
                <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                  {isRtl
                    ? 'مصمم للعمل المتواصل بدون توقف بسبب موفر البطارية'
                    : 'Engineered for continuous background reliability without battery termination'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                {
                  titleEn: 'Strict Package Filtering & Privacy',
                  titleAr: 'خصوصية تامة وفلترة مخصصة لإنستاباي فقط',
                  descEn:
                    'The NotificationListenerService only inspects notifications from com.egyptianbanks.instapay. All other apps on your phone are completely ignored, and raw notification text is never stored on the server.',
                  descAr:
                    'يفحص التطبيق إشعارات حزمة تطبيق إنستاباي الرسمي فقط (com.egyptianbanks.instapay) ويتجاهل أي إشعارات أخرى على الهاتف تماماً للحفاظ على الخصوصية.',
                },
                {
                  titleEn: 'Continuous Foreground Keep-Alive & Battery Protection',
                  titleAr: 'خدمة أمامية مستمرة وحماية من إغلاق البطارية',
                  descEn:
                    'Runs a persistent START_STICKY foreground service with a 90-second heartbeat loop, Unrestricted Battery Optimization exemption, and automatic restart on phone boot or task swipe.',
                  descAr:
                    'يعمل التطبيق بخدمة أمامية مستمرة (START_STICKY) مع نبضة اتصال كل 90 ثانية، وإعفاء من قيود البطارية، وإعادة تشغيل تلقائية عند إعادة تشغيل الهاتف.',
                },
                {
                  titleEn: 'Offline-Resilient Local Queue & Idempotency',
                  titleAr: 'طابور محلي ذكي ومنع تكرار العمليات',
                  descEn:
                    'If your phone briefly loses internet connectivity, detected payments are encrypted and stored in a local Room database queue and automatically uploaded with a unique X-Instapay-Event-Id once reconnected.',
                  descAr:
                    'في حال انقطاع الإنترنت مؤقتاً على الهاتف، تُحفظ الدفعات المرصودة في قاعدة بيانات محلية على الجهاز وتُرفع تلقائياً فور عودة الاتصال دون أي فقدان أو تكرار.',
                },
              ].map((row, idx) => (
                <div key={idx} style={subcard({ padding: '14px 16px' })}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }} />
                    <strong style={{ fontSize: '13.5px', color: textPrimary }}>
                      {isRtl ? row.titleAr : row.titleEn}
                    </strong>
                  </div>
                  <p style={{ fontSize: '12px', color: textSecondary, margin: 0, lineHeight: 1.6 }}>
                    {isRtl ? row.descAr : row.descEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Portal Modules Directory ─── */}
      <div style={card()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
              flexShrink: 0,
            }}
          >
            <BookOpen size={20} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: textPrimary, margin: 0 }}>
              {isRtl ? 'دليل أقسام بوابة التاجر' : 'Merchant Portal Modules & Capabilities'}
            </h2>
            <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
              {isRtl
                ? 'استكشف وظيفة كل قسم في لوحة التحكم وكيف يساعدك في إدارة مدفوعاتك'
                : 'Explore every workspace section and jump directly to the tool you need'}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: '14px',
          }}
        >
          {portalModules.map((mod) => (
            <div
              key={mod.page}
              onClick={() => onNavigate?.(mod.page)}
              style={{
                ...subcard({ padding: '16px 18px' }),
                cursor: onNavigate ? 'pointer' : 'default',
                transition: 'transform 0.18s ease, border-color 0.18s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '10px',
              }}
              onMouseEnter={(e) => {
                if (onNavigate) {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (onNavigate) {
                  e.currentTarget.style.borderColor = borderColor;
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }} aria-hidden="true">
                    {mod.emoji}
                  </span>
                  <strong style={{ fontSize: '14px', color: textPrimary }}>
                    {isRtl ? mod.titleAr : mod.titleEn}
                  </strong>
                </div>
                <p style={{ fontSize: '12px', color: textSecondary, margin: 0, lineHeight: 1.55 }}>
                  {isRtl ? mod.descAr : mod.descEn}
                </p>
              </div>
              {onNavigate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 700, color: '#3b82f6' }}>
                  <span>{isRtl ? 'فتح القسم' : 'Open section'}</span>
                  {isRtl ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
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

