import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  AlertCircle,
  QrCode,
  Smartphone,
  Laptop,
  Share2,
  Download,
  RefreshCw,
  User,
  UserCheck,
  Edit2,
  Check,
  Sun,
  Moon,
  Globe,
  Lock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Gift,
} from 'lucide-react';
import { useDevicePlatform } from '../hooks/useDevicePlatform';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface CheckoutData {
  sessionId: string;
  businessName: string;
  recipientHandle: string;
  senderHandle: string;
  amountEgp: number;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'UNDERPAID';
  deepLinkUrl: string;
  expiresAt: string;
  secondsRemaining: number;
  checkoutTtlMin?: number;
  detectedRef?: string | null;
  detectedAt?: string | null;
  detectedAmountEgp?: number | null;
  note?: string | null;
  purpose?: string | null;
  subscriptionPlanName?: string | null;
  bundleInfo?: { name: string; displayName: string; extraTx: number; priceEgp: number } | null;
  basePeriodDays?: number | null;
  bonusDays?: number | null;
  periodDays?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  checkoutUrl?: string | null;
}

export function CheckoutPayPage() {
  const { sessionId: paramSessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const device = useDevicePlatform();
  const { theme, toggleTheme, isDark } = useTheme();
  const { lang, setLang, isRtl } = useLanguage();

  // If no sessionId in URL, default to active test demo session
  const effectiveSessionId = paramSessionId || 'cmt_test_local_session';

  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [sessionLookupInput, setSessionLookupInput] = useState<string>('');
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);

  // Customer InstaPay Sender Handle state
  const [senderInput, setSenderInput] = useState<string>('');
  const [isEditingSender, setIsEditingSender] = useState<boolean>(false);
  const [isSavingSender, setIsSavingSender] = useState<boolean>(false);
  const [senderSaveSuccess, setSenderSaveSuccess] = useState<boolean>(false);
  const [senderSaveError, setSenderSaveError] = useState<string | null>(null);

  // Fetch Checkout Session
  useEffect(() => {
    setLoading(true);
    setError(null);

    const isTest = effectiveSessionId === 'cmt_test_local_session';
    const initialUrl = isTest ? `/api/checkout/${effectiveSessionId}?fresh=1` : `/api/checkout/${effectiveSessionId}`;

    fetch(initialUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.checkout) {
          setCheckout(data.checkout);
          setTimeLeft(data.checkout.secondsRemaining || 0);
          if (data.checkout.senderHandle && data.checkout.senderHandle !== 'pending@instapay') {
            const usernameOnly = data.checkout.senderHandle.replace(/@instapay$/i, '').replace(/^@/, '');
            setSenderInput(usernameOnly);
          }
          if (data.checkout.status === 'CONFIRMED') {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          }
        } else {
          setError(data.error || (isRtl ? 'لم يتم العثور على جلسة الدفع المطلوبة' : 'Checkout session not found'));
        }
      })
      .catch(() => {
        setError(isRtl ? 'تعذر الاتصال ببوابة الدفع' : 'Failed to connect to checkout gateway');
      })
      .finally(() => setLoading(false));
  }, [effectiveSessionId, isRtl]);

  const handleRestartSession = async () => {
    try {
      const res = await fetch(`/api/checkout/${effectiveSessionId}?fresh=1`);
      const data = await res.json();
      if (data.ok && data.checkout) {
        setCheckout(data.checkout);
        setTimeLeft(data.checkout.secondsRemaining || 0);
      }
    } catch {}
  };

  // Handle saving customer sender handle
  const handleSaveSender = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUser = senderInput.replace(/@instapay/gi, '').replace(/^@/, '').trim();
    if (!effectiveSessionId || !cleanUser) {
      setSenderSaveError(isRtl ? 'يرجى إدخال اسم مستخدم إنستاباي' : 'Please enter your InstaPay username');
      return;
    }

    const fullHandle = `${cleanUser}@instapay`;
    setIsSavingSender(true);
    setSenderSaveError(null);

    try {
      const res = await fetch(`/api/checkout/${effectiveSessionId}/sender`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderHandle: fullHandle }),
      });
      const data = await res.json();
      if (data.ok && data.senderHandle) {
        setCheckout((prev) => (prev ? { ...prev, senderHandle: data.senderHandle } : null));
        setSenderInput(data.senderHandle.replace(/@instapay$/i, '').replace(/^@/, ''));
        setIsEditingSender(false);
        setSenderSaveSuccess(true);
        setTimeout(() => setSenderSaveSuccess(false), 4000);
      } else {
        setSenderSaveError(data.error || (isRtl ? 'فشل حفظ اسم المستخدم' : 'Failed to update InstaPay username'));
      }
    } catch {
      setSenderSaveError(isRtl ? 'خطأ في الاتصال أثناء تحديث الحساب' : 'Connection error while updating username');
    } finally {
      setIsSavingSender(false);
    }
  };

  // Polling fallback
  useEffect(() => {
    if (!effectiveSessionId || checkout?.status === 'CONFIRMED' || checkout?.status === 'EXPIRED') return;

    const poll = setInterval(() => {
      fetch(`/api/checkout/${effectiveSessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.checkout) {
            setCheckout((prev) => {
              if (!prev || prev.status !== data.checkout.status) {
                if (data.checkout.status === 'CONFIRMED') {
                  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
                }
                return { ...prev, ...data.checkout };
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    }, 4000);

    return () => clearInterval(poll);
  }, [effectiveSessionId, checkout?.status]);

  // Socket.IO Real-time updates
  useEffect(() => {
    if (!effectiveSessionId) return;

    const socket: Socket = io();

    socket.on('connect', () => {
      socket.emit('checkout:join', effectiveSessionId);
    });

    socket.on('checkout:update', (payload: any) => {
      if (payload.sessionId === effectiveSessionId) {
        setCheckout((prev) =>
          prev
            ? {
                ...prev,
                status: payload.status,
                detectedRef: payload.detectedRef,
                detectedAt: payload.detectedAt,
                detectedAmountEgp: payload.detectedAmountEgp,
              }
            : null
        );

        if (payload.status === 'CONFIRMED') {
          confetti({
            particleCount: 130,
            spread: 80,
            origin: { y: 0.6 },
          });
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [effectiveSessionId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || checkout?.status !== 'PENDING') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCheckout((curr) => (curr ? { ...curr, status: 'EXPIRED' } : null));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, checkout?.status]);

  const copyToClipboard = (text: string, label: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShare = async () => {
    if (device.supportsWebShare && checkout) {
      try {
        await navigator.share({
          title: `InstaPay Payment to ${checkout.businessName}`,
          text: `Pay ${checkout.amountEgp.toFixed(2)} EGP to ${checkout.recipientHandle} via InstaPay`,
          url: window.location.href,
        });
      } catch {}
    } else {
      copyToClipboard(window.location.href, 'link');
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionLookupInput.trim()) {
      navigate(`/pay/${sessionLookupInput.trim()}`);
      setShowLookupModal(false);
    }
  };

  // Color tokens matching the merchant website
  const bgPage = isDark ? '#090d16' : '#f1f5f9';
  const bgCard = isDark ? '#111827' : '#ffffff';
  const bgSubCard = isDark ? '#162033' : '#f8fafc';
  const bgBox = isDark ? '#0f172a' : '#f1f5f9';
  const borderCard = isDark ? 'rgba(51, 65, 85, 0.6)' : '#e2e8f0';
  const borderSubtle = isDark ? '#334155' : '#cbd5e1';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: bgPage,
          color: textPrimary,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Inter', sans-serif",
          transition: 'all 0.25s ease',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: '#512772',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(81, 39, 114, 0.45)',
            marginBottom: '20px',
            padding: '8px',
          }}
        >
          <img
            src="/Logo.png"
            alt="InstaPay"
            style={{
              width: '46px',
              height: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
        <RefreshCw size={24} className="animate-spin" style={{ color: '#2563eb', marginBottom: '12px' }} />
        <p style={{ color: textSecondary, fontSize: '15px', fontWeight: 500 }}>
          {isRtl ? 'جاري تجهيز وتأمين بوابة الدفع...' : 'Securing InstaPay checkout session...'}
        </p>
      </div>
    );
  }

  if (error || !checkout) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: bgPage,
          color: textPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          style={{
            backgroundColor: bgCard,
            border: `1px solid ${borderCard}`,
            borderRadius: '24px',
            padding: '36px',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}
          >
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', color: textPrimary }}>
            {isRtl ? 'جلسة الدفع غير متوفرة' : 'Checkout Not Found'}
          </h2>
          <p style={{ fontSize: '13px', color: textSecondary, margin: '0 0 24px 0', lineHeight: 1.5 }}>
            {error || (isRtl ? 'الرابط غير صحيح أو انتهت صلاحية الجلسة' : 'The session ID is invalid or has expired.')}
          </p>

          {/* Quick Session Lookup Form */}
          <form onSubmit={handleLookupSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              value={sessionLookupInput}
              onChange={(e) => setSessionLookupInput(e.target.value)}
              placeholder={isRtl ? 'أدخل معرّف الجلسة (مثال: cmt_...)' : 'Enter Session ID (e.g. cmt_...)'}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${borderSubtle}`,
                backgroundColor: bgSubCard,
                color: textPrimary,
                fontSize: '13px',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 18px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {isRtl ? 'بحث' : 'Find'}
            </button>
          </form>

          <button
            onClick={() => navigate('/pay/cmt_test_local_session')}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              color: isDark ? '#38bdf8' : '#0284c7',
              border: `1px solid ${borderSubtle}`,
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isRtl ? '⚡ تحميل الجلسة التجريبية (Demo Session)' : '⚡ Load Demo Test Session'}
          </button>
        </div>
      </div>
    );
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(
    checkout.recipientHandle
  )}`;

  const isBundle =
    checkout.purpose === 'SUBSCRIPTION' &&
    (Boolean(checkout.bundleInfo) || (checkout.subscriptionPlanName?.startsWith('BUNDLE:') ?? false));
  const bundleDisplayName =
    checkout.bundleInfo?.displayName ||
    (checkout.subscriptionPlanName ? checkout.subscriptionPlanName.replace('BUNDLE:', '') : 'Top-Up Bundle');
  const bundleExtraTx = checkout.bundleInfo?.extraTx;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100dvh',
        width: '100%',
        backgroundColor: bgPage,
        color: textPrimary,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        transition: 'background-color 0.25s ease, color 0.25s ease',
        overflowX: 'hidden',
      }}
    >
      {/* ─── Top Header Bar (Matching Merchant Portal Design) ─── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          backgroundColor: bgCard,
          borderBottom: `1px solid ${borderCard}`,
          padding: '12px clamp(12px, 3vw, 24px)',
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.25s ease',
          minHeight: '60px',
        }}
      >
        {/* Brand / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#512772',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(81, 39, 114, 0.4)',
              padding: '4px',
            }}
          >
            <img
              src="/Logo.png"
              alt="InstaPay"
              style={{
                width: '30px',
                height: 'auto',
                maxWidth: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: textPrimary }}>InstaPay</span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd',
                }}
              >
                GATEWAY
              </span>
            </div>
            <p style={{ fontSize: '11px', color: textSecondary, margin: 0 }}>
              {isRtl ? 'بوابة الدفع الإلكتروني المباشر' : 'Direct Merchant Transfer'}
            </p>
          </div>
        </div>

        {/* Header Right Actions: Badges, Theme, Language, Share */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Subscription Return Link */}
          {checkout.purpose === 'SUBSCRIPTION' && (
            <button
              onClick={() => {
                const merchantHost = window.location.host.replace(/^checkout\./, '');
                window.location.href = `${window.location.protocol}//${merchantHost}/#settings/Billing`;
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                backgroundColor: bgSubCard,
                border: `1px solid ${borderSubtle}`,
                color: textPrimary,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <ArrowLeft size={13} />
              <span>{isRtl ? 'العودة للوحة التحكم' : 'Dashboard'}</span>
            </button>
          )}
          {/* Security Badge */}
          <div
            style={{
              display: 'none',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
              border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid #a7f3d0',
              color: isDark ? '#34d399' : '#059669',
              fontSize: '11px',
              fontWeight: 600,
            }}
            className="sm:flex"
          >
            <Lock size={12} />
            <span>{isRtl ? 'تشفير آمن 256-bit' : '256-bit SSL Verified'}</span>
          </div>

          {/* Share Button */}
          <button
            onClick={handleShare}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              backgroundColor: bgSubCard,
              border: `1px solid ${borderSubtle}`,
              color: textPrimary,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title={isRtl ? 'مشاركة رابط الدفع' : 'Share Checkout Link'}
          >
            <Share2 size={13} />
            <span className="hidden sm:inline">
              {copied === 'link' ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'مشاركة' : 'Share')}
            </span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              backgroundColor: bgSubCard,
              border: `1px solid ${borderSubtle}`,
              color: textPrimary,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDark ? <Sun size={15} style={{ color: '#fbbf24' }} /> : <Moon size={15} style={{ color: '#6366f1' }} />}
          </button>

          {/* Language Toggle Button */}
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 12px',
              borderRadius: '8px',
              backgroundColor: bgSubCard,
              border: `1px solid ${borderSubtle}`,
              color: textPrimary,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title={isRtl ? 'Switch to English' : 'التحويل إلى العربية'}
          >
            <Globe size={13} style={{ color: '#0ea5e9' }} />
            <span>{lang === 'en' ? 'عربي' : 'EN'}</span>
          </button>
        </div>
      </header>

      {/* ─── Main Container ─── */}
      <main style={{ flex: 1, padding: '24px 16px', maxWidth: '1000px', width: '100%', margin: '0 auto' }}>
        {/* ─── Status 1: CONFIRMED State ─── */}
        {checkout.status === 'CONFIRMED' ? (
          <div
            style={{
              backgroundColor: bgCard,
              border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #bbf7d0',
              borderRadius: '24px',
              padding: '40px 24px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              maxWidth: '540px',
              margin: '20px auto',
              animation: 'fadeIn 0.3s ease-out',
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid #10b981',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto',
                boxShadow: '0 0 24px rgba(16, 185, 129, 0.3)',
              }}
            >
              <CheckCircle2 size={40} />
            </div>

            <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 6px 0', color: textPrimary }}>
              {isRtl ? 'تم تأكيد الدفع بنجاح!' : 'Payment Confirmed!'}
            </h2>
            <p style={{ fontSize: '14px', color: '#10b981', fontWeight: 600, margin: '0 0 24px 0' }}>
              {isRtl ? 'تم التحقق من التحويل آلياً عبر إشعار إنستاباي الرسمي' : 'Receipt detected and verified automatically via official InstaPay notification'}
            </p>

            {/* Receipt Summary Card */}
            <div
              style={{
                backgroundColor: bgSubCard,
                borderRadius: '16px',
                border: `1px solid ${borderCard}`,
                padding: '20px',
                textAlign: isRtl ? 'right' : 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: textSecondary }}>{isRtl ? 'المبلغ المدفوع:' : 'Amount Paid:'}</span>
                <span style={{ fontWeight: 800, color: '#10b981', fontSize: '15px' }}>
                  {checkout.amountEgp.toFixed(2)} EGP
                </span>
              </div>
              {checkout.purpose === 'SUBSCRIPTION' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: textSecondary }}>
                      {isRtl ? (isBundle ? 'الحزمة المفعلة:' : 'الخطة المفعلة:') : (isBundle ? 'Activated Bundle:' : 'Activated Plan:')}
                    </span>
                    <span style={{ fontWeight: 700, color: isBundle ? '#f59e0b' : '#6366f1' }}>
                      {isBundle
                        ? `${bundleDisplayName}${bundleExtraTx ? ` (+${bundleExtraTx} ${isRtl ? 'معاملة إضافية' : 'extra tx'})` : ''}`
                        : `${checkout.subscriptionPlanName || 'Subscription'} (${checkout.periodDays || 30} ${isRtl ? 'يوم' : 'Days'})`}
                    </span>
                  </div>
                  {isBundle && bundleExtraTx && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: textSecondary }}>{isRtl ? 'المعاملات المضافة فوراً:' : 'Quota Added Instantly:'}</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>
                        +{bundleExtraTx} {isRtl ? 'معاملة' : 'extra transactions'}
                      </span>
                    </div>
                  )}
                  {checkout.bonusDays && checkout.bonusDays > 0 && !isBundle && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: textSecondary }}>{isRtl ? 'أيام التجربة المضافة:' : 'Trial Rollover Days:'}</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>
                        +{checkout.bonusDays} {isRtl ? 'يوم إضافي محفوظ' : 'Bonus Days Kept'}
                      </span>
                    </div>
                  )}
                  {checkout.endDate && !isBundle && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: textSecondary }}>{isRtl ? 'تاريخ الانتهاء:' : 'Valid Until:'}</span>
                      <span style={{ fontFamily: 'monospace', color: textPrimary, fontWeight: 600 }}>
                        {new Date(checkout.endDate).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: textSecondary }}>{isRtl ? 'المتجر المستلم:' : 'Merchant:'}</span>
                  <span style={{ fontWeight: 600, color: textPrimary }}>{checkout.businessName}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: textSecondary }}>{isRtl ? 'حساب المرسل:' : 'Sender Account:'}</span>
                <span style={{ fontFamily: 'monospace', color: textPrimary, fontWeight: 600 }}>
                  {checkout.senderHandle}
                </span>
              </div>
              {checkout.detectedRef && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: textSecondary }}>{isRtl ? 'رقم الإشعار المرجعي:' : 'Reference ID:'}</span>
                  <span style={{ fontFamily: 'monospace', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 700 }}>
                    {checkout.detectedRef}
                  </span>
                </div>
              )}
              {checkout.detectedAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: textSecondary }}>{isRtl ? 'وقت التأكيد:' : 'Verified Time:'}</span>
                  <span style={{ color: textSecondary }}>
                    {new Date(checkout.detectedAt).toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US')}
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: bgSubCard,
                  border: `1px solid ${borderSubtle}`,
                  color: textPrimary,
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {isRtl ? 'طباعة الإيصال' : 'Print Receipt'}
              </button>
              <button
                onClick={() => {
                  const merchantHost = window.location.host.replace(/^checkout\./, '');
                  window.location.href = `${window.location.protocol}//${merchantHost}/#settings/Billing`;
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                }}
              >
                {checkout.purpose === 'SUBSCRIPTION'
                  ? (isRtl ? 'العودة للوحة التحكم' : 'Return to Dashboard')
                  : (isRtl ? 'إغلاق والعودة للمتجر' : 'Done & Return')}
              </button>
            </div>
          </div>
        ) : checkout.status === 'UNDERPAID' ? (
          /* ─── Status 2: UNDERPAID State ─── */
          <div
            style={{
              backgroundColor: bgCard,
              border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a',
              borderRadius: '24px',
              padding: '36px 24px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              maxWidth: '540px',
              margin: '20px auto',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <AlertCircle size={36} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px 0', color: textPrimary }}>
              {isRtl ? 'تم اكتشاف دفع جزئي' : 'Underpayment Detected'}
            </h2>
            <p style={{ fontSize: '14px', color: '#f59e0b', margin: '0 0 20px 0' }}>
              {isRtl
                ? `تم استلام ${(checkout.detectedAmountEgp || 0).toFixed(2)} جنيه، والمطلوب ${checkout.amountEgp.toFixed(2)} جنيه.`
                : `Received ${(checkout.detectedAmountEgp || 0).toFixed(2)} EGP, but ${checkout.amountEgp.toFixed(2)} EGP was required.`}
            </p>

            <div
              style={{
                backgroundColor: bgSubCard,
                borderRadius: '16px',
                border: `1px solid ${borderCard}`,
                padding: '20px',
                textAlign: isRtl ? 'right' : 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: textSecondary }}>{isRtl ? 'المبلغ الإجمالي المطلوب:' : 'Total Required:'}</span>
                <span style={{ fontWeight: 600, color: textPrimary }}>{checkout.amountEgp.toFixed(2)} EGP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: textSecondary }}>{isRtl ? 'المبلغ المستلم:' : 'Amount Received:'}</span>
                <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                  {(checkout.detectedAmountEgp || 0).toFixed(2)} EGP
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderTop: `1px solid ${borderCard}`,
                  paddingTop: '10px',
                  color: '#ef4444',
                }}
              >
                <span>{isRtl ? 'المبلغ المتبقي للتحويل:' : 'Remaining Balance:'}</span>
                <span>
                  {Math.max(0, checkout.amountEgp - (checkout.detectedAmountEgp || 0)).toFixed(2)} EGP
                </span>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: textSecondary }}>
              {isRtl
                ? `يرجى تحويل الفرق المتبقي إلى حساب ${checkout.recipientHandle} لإتمام الطلب فوراً.`
                : `Please transfer the remaining balance to ${checkout.recipientHandle} to complete your order.`}
            </p>
          </div>
        ) : checkout.status === 'EXPIRED' ? (
          /* ─── Status 3: EXPIRED State ─── */
          <div
            style={{
              backgroundColor: bgCard,
              border: isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fecaca',
              borderRadius: '24px',
              padding: '36px 24px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              maxWidth: '540px',
              margin: '20px auto',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <Clock size={36} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px 0', color: textPrimary }}>
              {isRtl ? 'انتهت صلاحية جلسة الدفع' : 'Session Expired'}
            </h2>
            <p style={{ fontSize: '13px', color: textSecondary, margin: '0 0 24px 0', lineHeight: 1.5 }}>
              {isRtl
                ? 'انتهى الوقت المحدد لإتمام هذه العملية. إذا قمت بالتحويل بالفعل، يرجى التواصل مع المتجر وتزويدهم بالرقم المرجعي.'
                : 'This checkout session has timed out. If you already sent the transfer, please contact the merchant with your reference number.'}
            </p>
            {effectiveSessionId === 'cmt_test_local_session' && (
              <button
                onClick={handleRestartSession}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  margin: '0 auto',
                  transition: 'opacity 0.2s',
                }}
              >
                <RefreshCw size={15} />
                {isRtl ? 'إعادة تشغيل جلسة التجربة' : 'Restart Test Session'}
              </button>
            )}
          </div>
        ) : (
          /* ─── Status 4: Active PENDING State (Two-Column Layout) ─── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Hero Card: Merchant Name, Amount, & Live Timer */}
            <div
              style={{
                backgroundColor: bgCard,
                borderRadius: '20px',
                border: `1px solid ${borderCard}`,
                padding: '24px',
                boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              {/* Merchant / Subscription Title & Details */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: isBundle ? '#f59e0b' : (isDark ? '#38bdf8' : '#0284c7'),
                    }}
                  >
                    {isBundle
                      ? (isRtl ? 'حزمة معاملات إضافية' : 'EXTRA TOP-UP BUNDLE')
                      : checkout.purpose === 'SUBSCRIPTION'
                      ? (isRtl ? 'اشتراك باقة المنصة' : 'SUBSCRIPTION PLAN')
                      : (isRtl ? 'الدفع لصالح' : 'PAYING TO')}
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                      color: '#10b981',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={11} />{' '}
                    {checkout.purpose === 'SUBSCRIPTION'
                      ? (isRtl ? 'بوابة المنصة الرسمية' : 'Platform Subscription')
                      : (isRtl ? 'متجر معتمد' : 'Verified Merchant')}
                  </span>
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: textPrimary }}>
                  {isBundle
                    ? bundleDisplayName
                    : checkout.purpose === 'SUBSCRIPTION' && checkout.subscriptionPlanName
                    ? `${checkout.subscriptionPlanName} Plan`
                    : checkout.businessName}
                </h2>
                {checkout.purpose === 'SUBSCRIPTION' && (
                  <>
                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      {isBundle ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)',
                            color: isDark ? '#fbbf24' : '#d97706',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          <Sparkles size={12} />
                          +{bundleExtraTx || ''} {isRtl ? 'معاملة إضافية فورية' : 'Extra Transactions Stacked'}
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                            color: isDark ? '#a5b4fc' : '#4f46e5',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          <Sparkles size={12} />
                          {checkout.periodDays || 30} {isRtl ? 'يوم صلاحية' : 'Days Validity'}
                        </span>
                      )}
                      {checkout.bonusDays && checkout.bonusDays > 0 && !isBundle ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                            color: isDark ? '#6ee7b7' : '#059669',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          <Gift size={12} />
                          +{checkout.bonusDays} {isRtl ? 'يوم ترحيل من التجربة' : 'Trial Rollover Days'}
                        </span>
                      ) : null}
                      {checkout.startDate && checkout.endDate && (
                        <span
                          style={{
                            fontSize: '12px',
                            color: textSecondary,
                            fontFamily: 'monospace',
                          }}
                        >
                          {new Date(checkout.startDate).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' → '}
                          {new Date(checkout.endDate).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>

                    {checkout.bonusDays && checkout.bonusDays > 0 ? (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                          border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid #a7f3d0',
                          color: isDark ? '#34d399' : '#047857',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 600,
                        }}
                      >
                        <Gift size={14} />
                        <span>
                          {isRtl
                            ? `رصيد التجربة محفوظ: تمت إضافة +${checkout.bonusDays} يوم متبقية من فترتك التجريبية إلى باقة ${checkout.subscriptionPlanName} (${checkout.basePeriodDays || 30} باقة + ${checkout.bonusDays} تجربة = ${checkout.periodDays} يوم إجمالي).`
                            : `Trial Rollover: +${checkout.bonusDays} remaining trial days added onto your ${checkout.subscriptionPlanName} plan (${checkout.basePeriodDays || 30} plan + ${checkout.bonusDays} trial = ${checkout.periodDays} total days).`}
                        </span>
                      </div>
                    ) : null}
                  </>
                )}
                {checkout.note && (
                  <p style={{ fontSize: '13px', color: textSecondary, margin: '4px 0 0 0' }}>
                    {checkout.note}
                  </p>
                )}
              </div>

              {/* Amount & Timer Box */}
              <div style={{ textAlign: isRtl ? 'left' : 'right', minWidth: '180px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: textSecondary,
                  }}
                >
                  {isRtl ? 'المبلغ المطلوب' : 'TOTAL DUE'}
                </span>
                <div
                  style={{
                    fontSize: '30px',
                    fontWeight: 900,
                    color: '#10b981',
                    lineHeight: 1.1,
                    margin: '2px 0 6px 0',
                    fontFamily: 'monospace',
                  }}
                >
                  {checkout.amountEgp.toFixed(2)} <span style={{ fontSize: '16px', fontWeight: 700 }}>EGP</span>
                </div>

                {/* Countdown pill */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    backgroundColor: timeLeft < 120
                      ? 'rgba(239, 68, 68, 0.15)'
                      : (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'),
                    color: timeLeft < 120 ? '#ef4444' : (isDark ? '#fbbf24' : '#b45309'),
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    border: timeLeft < 120
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : (isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a'),
                  }}
                >
                  <Clock size={13} />
                  <span>{formatTimer(timeLeft)}</span>
                  <span style={{ fontSize: '10px', fontWeight: 500, opacity: 0.8 }}>
                    {isRtl ? 'متبقي' : 'left'}
                  </span>
                  {checkout?.checkoutTtlMin && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                        opacity: 0.85,
                      }}
                      title={isRtl ? `مدة صلاحية الجلسة المحددة: ${checkout.checkoutTtlMin} دقيقة` : `Merchant session limit: ${checkout.checkoutTtlMin} min`}
                    >
                      {checkout.checkoutTtlMin} {isRtl ? 'د' : 'm'}
                    </span>
                  )}
                  {effectiveSessionId === 'cmt_test_local_session' && (
                    <button
                      onClick={handleRestartSession}
                      title={isRtl ? 'إعادة ضبط مؤقت التجربة' : 'Restart demo session timer'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'inherit',
                        padding: '1px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        marginLeft: isRtl ? undefined : '2px',
                        marginRight: isRtl ? '2px' : undefined,
                        opacity: 0.75,
                      }}
                    >
                      <RefreshCw size={11} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Two-Column Layout Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
              {/* ─── Column 1: Payment Steps & Account Input ─── */}
              <div
                style={{
                  backgroundColor: bgCard,
                  borderRadius: '20px',
                  border: `1px solid ${borderCard}`,
                  padding: '24px',
                  boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.4)' : '0 10px 20px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                }}
              >
                {/* Step 1: Customer Sender Handle Input */}
                <div
                  style={{
                    backgroundColor: bgSubCard,
                    borderRadius: '16px',
                    border: `1px solid ${borderCard}`,
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontWeight: 700,
                        }}
                      >
                        1
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>
                        {isRtl ? 'حسابك في إنستاباي (المُرسل)' : 'Your InstaPay Username (Sender)'}
                      </span>
                    </div>

                    {!isEditingSender && checkout.senderHandle && checkout.senderHandle !== 'pending@instapay' && (
                      <button
                        onClick={() => {
                          const usernameOnly = (checkout.senderHandle || '').replace(/@instapay$/i, '').replace(/^@/, '');
                          setSenderInput(usernameOnly);
                          setIsEditingSender(true);
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${borderSubtle}`,
                          backgroundColor: 'transparent',
                          color: isDark ? '#38bdf8' : '#0284c7',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Edit2 size={11} /> {isRtl ? 'تعديل' : 'Edit'}
                      </button>
                    )}
                  </div>

                  {!isEditingSender && checkout.senderHandle && checkout.senderHandle !== 'pending@instapay' ? (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        backgroundColor: bgBox,
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserCheck size={18} style={{ color: '#10b981' }} />
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: textPrimary }}>
                          {checkout.senderHandle}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                        }}
                      >
                        {isRtl ? 'مربوط للمطابقة الآلية' : 'Auto-Match Ready'}
                      </span>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveSender} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '11px', color: textSecondary, margin: 0 }}>
                        {isRtl
                          ? 'أدخل اسم المستخدم فقط وسنربطه تلقائياً بـ @instapay ليتم تأكيد طلبك فوراً.'
                          : 'Enter your InstaPay username only (without @instapay) for automated instant verification.'}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <div
                          style={{
                            position: 'relative',
                            flex: 1,
                            minWidth: '220px',
                            display: 'flex',
                            alignItems: 'stretch',
                            borderRadius: '10px',
                            border: `1px solid ${borderSubtle}`,
                            backgroundColor: bgBox,
                            overflow: 'hidden',
                          }}
                        >
                          <input
                            type="text"
                            value={senderInput}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/@instapay/gi, '').replace(/^@/, '');
                              setSenderInput(cleaned);
                              if (senderSaveError) setSenderSaveError(null);
                            }}
                            placeholder={isRtl ? 'اسم_المستخدم' : 'username'}
                            dir="ltr"
                            style={{
                              flex: 1,
                              padding: '10px 14px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: textPrimary,
                              fontSize: '13px',
                              fontFamily: 'monospace',
                              outline: 'none',
                              minWidth: 0,
                            }}
                          />
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0 12px',
                              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
                              color: isDark ? '#a5b4fc' : '#4f46e5',
                              borderInlineStart: `1px solid ${borderSubtle}`,
                              fontSize: '12px',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              userSelect: 'none',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            @instapay
                          </span>
                        </div>
                        <button
                          type="submit"
                          disabled={isSavingSender || !senderInput.trim()}
                          style={{
                            padding: '10px 16px',
                            backgroundColor: '#10b981',
                            color: '#022c22',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {isSavingSender ? <RefreshCw size={13} className="animate-spin" /> : <Check size={14} />}
                          <span>{isSavingSender ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'تأكيد الحساب' : 'Confirm')}</span>
                        </button>
                        {isEditingSender && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingSender(false);
                              if (checkout.senderHandle) {
                                setSenderInput(checkout.senderHandle.replace(/@instapay$/i, '').replace(/^@/, ''));
                              }
                              setSenderSaveError(null);
                            }}
                            style={{
                              padding: '10px 12px',
                              backgroundColor: 'transparent',
                              color: textSecondary,
                              border: `1px solid ${borderSubtle}`,
                              borderRadius: '10px',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            {isRtl ? 'إلغاء' : 'Cancel'}
                          </button>
                        )}
                      </div>

                      {senderSaveError && (
                        <div style={{ fontSize: '11px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={12} /> {senderSaveError}
                        </div>
                      )}
                      {senderSaveSuccess && (
                        <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> {isRtl ? 'تم حفظ الحساب بنجاح!' : 'Username confirmed successfully!'}
                        </div>
                      )}
                    </form>
                  )}
                </div>

                {/* Step 2: Transfer Details (Recipient IPA & Amount) */}
                <div
                  style={{
                    backgroundColor: bgSubCard,
                    borderRadius: '16px',
                    border: `1px solid ${borderCard}`,
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 700,
                      }}
                    >
                      2
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>
                      {isRtl ? 'بيانات التحويل عبر إنستاباي' : 'Transfer Details (Recipient IPA)'}
                    </span>
                  </div>

                  {/* Recipient Handle Box */}
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', color: textSecondary, display: 'block', marginBottom: '4px' }}>
                      {isRtl ? 'عنوان الدفع اللحظي (IPA):' : 'InstaPay Address (IPA):'}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        backgroundColor: bgBox,
                        border: `1px solid ${borderCard}`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '13px',
                          color: textPrimary,
                          userSelect: 'all',
                        }}
                      >
                        {checkout.recipientHandle}
                      </span>
                    </div>
                  </div>

                  {/* Exact Amount Box */}
                  <div>
                    <span style={{ fontSize: '11px', color: textSecondary, display: 'block', marginBottom: '4px' }}>
                      {isRtl ? 'المبلغ بالضبط بدون زيادة أو نقصان:' : 'Exact Amount to Transfer:'}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        backgroundColor: bgBox,
                        border: `1px solid ${borderCard}`,
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '14px', color: '#10b981' }}>
                        {checkout.amountEgp.toFixed(2)} EGP
                      </span>
                      <button
                        onClick={() => copyToClipboard(checkout.amountEgp.toString(), 'amount')}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                          border: 'none',
                          color: textPrimary,
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Copy size={12} />
                        <span>{copied === 'amount' ? (isRtl ? 'تم النسخ' : 'Copied!') : (isRtl ? 'نسخ المبلغ' : 'Copy')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button: Open in InstaPay App */}
                <a
                  href={checkout.deepLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '16px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '15px',
                    textDecoration: 'none',
                    boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s',
                  }}
                >
                  <Smartphone size={18} />
                  <span>
                    {isRtl
                      ? 'فتح تطبيق إنستاباي مباشرة للتحويل'
                      : device.isIOS
                      ? 'Open in InstaPay (iPhone)'
                      : device.isAndroid
                      ? 'Open in InstaPay (Android)'
                      : 'Open in InstaPay App'}
                  </span>
                  <ExternalLink size={15} />
                </a>
              </div>

              {/* ─── Column 2: Instant QR Code Scanner Station ─── */}
              <div
                style={{
                  backgroundColor: bgCard,
                  borderRadius: '20px',
                  border: `1px solid ${borderCard}`,
                  padding: '24px',
                  boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.4)' : '0 10px 20px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
                    color: isDark ? '#38bdf8' : '#0284c7',
                    fontSize: '11px',
                    fontWeight: 700,
                    marginBottom: '12px',
                  }}
                >
                  <QrCode size={13} />
                  <span>{isRtl ? 'المسح السريع عبر الهاتف' : 'Instant Phone Scanner'}</span>
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0', color: textPrimary }}>
                  {isRtl ? 'امسح الرمز بواسطة الكاميرا أو تطبيق البنك' : 'Scan to Transfer Instantly'}
                </h3>
                <p style={{ fontSize: '12px', color: textSecondary, margin: '0 0 20px 0' }}>
                  {isRtl ? 'افتح كاميرا هاتفك لمسح الكود والتحويل مباشرة' : 'Scan with your banking app or camera to pay'}
                </p>

                {/* QR Code Container with sleek border */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '16px',
                    borderRadius: '20px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    position: 'relative',
                    marginBottom: '20px',
                  }}
                >
                  <img
                    src={qrImageUrl}
                    alt="InstaPay QR Code"
                    style={{
                      width: '210px',
                      height: '210px',
                      borderRadius: '12px',
                      display: 'block',
                    }}
                  />
                </div>

                {/* Handle Copy Bar */}
                <div
                  style={{
                    width: '100%',
                    backgroundColor: bgSubCard,
                    border: `1px solid ${borderCard}`,
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ textAlign: isRtl ? 'right' : 'left', overflow: 'hidden' }}>
                    <span style={{ fontSize: '10px', color: textSecondary, textTransform: 'uppercase', display: 'block' }}>
                      {isRtl ? 'العنوان الممسوح' : 'SCANNED IPA'}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: textPrimary, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>
                      {checkout.recipientHandle}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(checkout.recipientHandle, 'qr-handle')}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                      border: 'none',
                      color: textPrimary,
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {copied === 'qr-handle' ? (isRtl ? 'تم!' : 'Copied!') : (isRtl ? 'نسخ' : 'Copy')}
                  </button>
                </div>

                {/* Live Real-time Status Card */}
                <div
                  style={{
                    width: '100%',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#f0fdf4',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #bbf7d0',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: isRtl ? 'right' : 'left',
                  }}
                >
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      boxShadow: '0 0 8px #10b981',
                      animation: 'pulseGreen 2s ease-in-out infinite',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ fontSize: '11px', color: isDark ? '#86efac' : '#166534', lineHeight: 1.4 }}>
                    <strong>{isRtl ? 'نظام التحقق اللحظي نشط: ' : 'Live Verification Active: '}</strong>
                    {isRtl
                      ? 'فور إتمام التحويل، ستتحدث هذه الصفحة تلقائياً دون الحاجة لإعادة التحميل.'
                      : 'This screen updates automatically within 3 seconds of completing the transfer.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── Footer (Consistent with Merchant Gateway) ─── */}
      <footer
        style={{
          borderTop: `1px solid ${borderCard}`,
          backgroundColor: bgCard,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          fontSize: '12px',
          color: textSecondary,
          transition: 'all 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Powered by</span>
          <strong style={{ color: textPrimary }}>InstaPay Gateway Engine v2.0</strong>
          <span>•</span>
          <span>{isRtl ? 'نظام التحقق الآلي المباشر' : 'Automated Verification'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
          <span>{device.platformLabel} • {device.browserLabel}</span>
          <span>•</span>
          <button
            onClick={() => setShowLookupModal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: isDark ? '#38bdf8' : '#0284c7',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {isRtl ? 'معاينة جلسة أخرى' : 'Lookup Session'}
          </button>
        </div>
      </footer>

      {/* Lookup Modal */}
      {showLookupModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setShowLookupModal(false)}
        >
          <div
            style={{
              backgroundColor: bgCard,
              border: `1px solid ${borderCard}`,
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 12px 0', color: textPrimary }}>
              {isRtl ? 'معاينة جلسة دفع أخرى' : 'Lookup Checkout Session'}
            </h3>
            <form onSubmit={handleLookupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                value={sessionLookupInput}
                onChange={(e) => setSessionLookupInput(e.target.value)}
                placeholder="cmt_test_local_session"
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${borderSubtle}`,
                  backgroundColor: bgSubCard,
                  color: textPrimary,
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {isRtl ? 'عرض الجلسة' : 'View Session'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLookupModal(false)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: bgSubCard,
                    border: `1px solid ${borderSubtle}`,
                    color: textPrimary,
                    borderRadius: '10px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
