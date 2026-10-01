import React, { useState, useEffect, useCallback } from 'react';
import {
  Key, Copy, Eye, EyeOff, CheckCircle2, Play, ExternalLink,
  RefreshCw, Terminal, Code2, Shield, Zap, BookOpen, Hash,
  ArrowRight, Lock, Unlock, RotateCcw, Braces, Check, Clipboard,
  FileCode2, Globe, ChevronRight
} from 'lucide-react';
import { settingsApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface DevelopersPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showConfirm?: (action: any) => void;
}

export function DevelopersPage({ showToast, showConfirm }: DevelopersPageProps) {
  const { isDark } = useTheme();
  const { lang, isRtl } = useLanguage();

  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Simulator state
  const [testAmount, setTestAmount] = useState('50.00');
  const [testSender, setTestSender] = useState('customer@instapay');
  const [testNote, setTestNote] = useState('Test Order #101');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  /* ──────────────── Theme tokens ──────────────── */
  const textPrimary = isDark ? '#f8fafc' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const accent = '#38bdf8';

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    backgroundColor: isDark ? '#111827' : '#ffffff',
    borderRadius: '20px',
    border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0',
    boxShadow: isDark
      ? '0 10px 25px -5px rgba(0,0,0,0.45), 0 8px 10px -6px rgba(0,0,0,0.3)'
      : '0 4px 16px rgba(0,0,0,0.06)',
    transition: 'all 0.3s ease',
    ...extra,
  });

  const subcard = (extra?: React.CSSProperties): React.CSSProperties => ({
    backgroundColor: isDark ? '#162033' : '#f8fafc',
    borderRadius: '14px',
    border: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0',
    ...extra,
  });

  const terminalBg: React.CSSProperties = {
    backgroundColor: isDark ? '#070b14' : '#0f172a',
    borderRadius: '12px',
    border: isDark ? '1px solid #1e293b' : 'none',
  };

  /* ──────────────── Data fetching ──────────────── */
  const fetchSettings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await settingsApi.get();
      if (data.ok) {
        setSettings(data.settings);
      }
      if (isRefresh && showToast) {
        showToast('success', isRtl ? 'تم تحديث بيانات المطور' : 'Developer data refreshed');
      }
    } catch {
      if (showToast) {
        showToast('error', isRtl ? 'فشل تحميل مفاتيح API' : 'Failed to load developer keys');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast, isRtl]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  /* ──────────────── Handlers ──────────────── */
  const handleCopy = (text: string, type: 'key' | 'secret' | 'snippet') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') { setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }
    else if (type === 'secret') { setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000); }
    else { setCopiedSnippet(true); setTimeout(() => setCopiedSnippet(false), 2000); }
    if (showToast) showToast('success', isRtl ? 'تم النسخ' : 'Copied to clipboard');
  };

  const handleRotateKeys = () => {
    if (showConfirm) {
      showConfirm({
        title: isRtl ? 'تدوير مفاتيح API' : 'Rotate API Keys',
        message: isRtl
          ? 'هل أنت متأكد من تدوير مفتاح API ورمز الكشف وسر الويب هوك؟ ستتوقف أي خدمات نشطة تستخدم المفاتيح القديمة فورًا.'
          : 'Are you sure you want to rotate your API key, detect token, and webhook secret? Any active services using the old keys will stop working immediately.',
        confirmLabel: isRtl ? 'تدوير المفاتيح' : 'Rotate Keys',
        cancelLabel: isRtl ? 'إلغاء' : 'Cancel',
        variant: 'danger',
        onConfirm: async () => {
          try {
            const res = await settingsApi.rotateKeys();
            if (res.ok) {
              setSettings((prev: any) => ({
                ...prev,
                apiKey: res.apiKey,
                detectToken: res.detectToken,
                webhookSecret: res.webhookSecret,
              }));
              if (showToast) showToast('success', isRtl ? 'تم تدوير المفاتيح بنجاح!' : 'API Keys and Webhook Secret rotated successfully!');
            }
          } catch {
            if (showToast) showToast('error', isRtl ? 'فشل تدوير المفاتيح' : 'Failed to rotate keys');
          }
        },
      });
    }
  };

  const handleRunSimulator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings?.apiKey) {
      if (showToast) showToast('error', isRtl ? 'مفتاح API غير متاح. الحساب قد يكون في انتظار الموافقة.' : 'API Key not available. Account may be pending approval.');
      return;
    }

    setSimLoading(true);
    setSimResult(null);

    try {
      const res = await fetch('/api/v1/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          amountEgp: Number(testAmount),
          senderHandle: testSender,
          note: testNote,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSimResult(data.checkout);
        if (showToast) showToast('success', isRtl ? 'تم إنشاء جلسة الدفع بنجاح!' : 'Checkout session created successfully!');
      } else {
        if (showToast) showToast('error', data.error || (isRtl ? 'فشل إنشاء جلسة المحاكاة' : 'Simulator checkout failed'));
      }
    } catch {
      if (showToast) showToast('error', isRtl ? 'فشل تشغيل المحاكي' : 'Failed to run simulator');
    } finally {
      setSimLoading(false);
    }
  };

  const apiKey = settings?.apiKey || (isRtl ? 'في انتظار موافقة الحساب...' : 'Waiting for account approval...');
  const webhookSecret = settings?.webhookSecret || (isRtl ? 'في انتظار موافقة الحساب...' : 'Waiting for account approval...');

  const curlSnippet = `curl -X POST http://localhost:3001/api/v1/checkout/create \\
  -H "Authorization: Bearer ${showApiKey ? apiKey : 'egp_live_***'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amountEgp": 50.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1042"
  }'`;

  /* ──────────────── Shared secret/key field component ──────────────── */
  const SecretField = ({
    label,
    sublabel,
    value,
    show,
    setShow,
    copied: isCopied,
    onCopy,
    icon,
    iconBg,
    iconColor,
    valueColor,
  }: {
    label: string;
    sublabel: string;
    value: string;
    show: boolean;
    setShow: (v: boolean) => void;
    copied: boolean;
    onCopy: () => void;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    valueColor: string;
  }) => (
    <div style={{ ...card({ padding: '24px', marginBottom: '20px' }) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${iconColor}30`,
          }}>
            {icon}
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: textPrimary, margin: 0 }}>{label}</h3>
            <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: '-0.2px' }}>
              {sublabel}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <div style={{
          flex: 1,
          ...terminalBg,
          padding: '14px 18px',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: '13px',
          color: valueColor,
          overflowX: 'auto',
          display: 'flex',
          alignItems: 'center',
          letterSpacing: show ? '0.3px' : '2px',
          transition: 'letter-spacing 0.2s ease',
        }}>
          {show ? value : '•'.repeat(40)}
        </div>
        <button
          onClick={() => setShow(!show)}
          style={{
            padding: '12px 14px',
            ...subcard(),
            border: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: textSecondary,
            transition: 'all 0.2s',
          }}
          title={show ? (isRtl ? 'إخفاء' : 'Hide') : (isRtl ? 'إظهار' : 'Show')}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button
          onClick={onCopy}
          style={{
            padding: '12px 14px',
            ...subcard(),
            border: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isCopied ? '#34d399' : textSecondary,
            transition: 'all 0.2s',
          }}
          title={isRtl ? 'نسخ' : 'Copy'}
        >
          {isCopied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  );

  /* ──────────────── Loading state ──────────────── */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <RefreshCw size={32} className="animate-spin" style={{ color: accent }} />
        <p style={{ fontSize: '14px', color: textSecondary, fontWeight: 500 }}>
          {isRtl ? 'جاري تحميل بيانات المطور...' : 'Loading developer portal...'}
        </p>
      </div>
    );
  }

  /* ──────────────── Render ──────────────── */
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
          }}>
            <Code2 size={22} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
              {isRtl ? 'بوابة المطورين' : 'Developer Portal'}
            </h2>
            <p style={{ fontSize: '13px', color: textSecondary, margin: 0 }}>
              {isRtl ? 'مفاتيح API، أدوات المحاكاة، ووثائق التكامل' : 'API credentials, simulator tools & integration docs'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => fetchSettings(true)}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: refreshing ? 'wait' : 'pointer',
              color: textPrimary,
              transition: 'all 0.25s ease',
              opacity: refreshing ? 0.7 : 1,
              boxShadow: isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.06)',
            }}
          >
            <RefreshCw size={15} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
            {refreshing
              ? (isRtl ? 'جاري التحديث...' : 'Refreshing...')
              : (isRtl ? 'تحديث' : 'Refresh')}
          </button>
          <button
            onClick={handleRotateKeys}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
              border: isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid #fecaca',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              color: isDark ? '#f87171' : '#dc2626',
              transition: 'all 0.25s ease',
            }}
          >
            <RotateCcw size={14} />
            {isRtl ? 'تدوير المفاتيح' : 'Rotate Keys'}
          </button>
        </div>
      </div>

      {/* ─── Hero Banner ─── */}
      <div style={{
        ...card(),
        background: isDark
          ? 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(6,182,212,0.08))'
          : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
        border: isDark ? '1px solid rgba(37,99,235,0.25)' : 'none',
        padding: '28px 32px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: '-20px', right: isRtl ? 'auto' : '-20px', left: isRtl ? '-20px' : 'auto', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-40px', right: isRtl ? 'auto' : '80px', left: isRtl ? '80px' : 'auto', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', top: '10px', left: isRtl ? 'auto' : '40%', right: isRtl ? '40%' : 'auto', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: isDark ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: isDark ? '1px solid rgba(56,189,248,0.15)' : '1px solid rgba(255,255,255,0.25)',
          }}>
            <Braces size={30} color={isDark ? '#38bdf8' : 'white'} />
          </div>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: isDark ? '#e0f2fe' : 'white' }}>
              {isRtl ? 'واجهة برمجة REST API' : 'REST API Integration'}
            </h3>
            <p style={{ fontSize: '13px', color: isDark ? '#7dd3fc' : 'rgba(255,255,255,0.85)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
              {isRtl
                ? 'إنشاء جلسات دفع، تلقي ردود الويب هوك، والتحقق من حالة المعاملات برمجياً.'
                : 'Create checkout sessions, receive webhook callbacks, and verify transaction status programmatically.'}
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: '14px', position: 'relative', zIndex: 1 }}>
          {[
            { label: 'API', value: settings?.apiKey ? (isRtl ? 'مُفعّل' : 'Active') : (isRtl ? 'معلّق' : 'Pending'), color: settings?.apiKey ? '#34d399' : '#fbbf24' },
            { label: 'Webhook', value: settings?.webhookSecret ? (isRtl ? 'مُهيّأ' : 'Configured') : (isRtl ? 'معلّق' : 'Pending'), color: settings?.webhookSecret ? '#34d399' : '#fbbf24' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '12px 20px',
              backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.2)',
              textAlign: 'center',
              minWidth: '100px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.7)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {s.label}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── API Key ─── */}
      <SecretField
        label={isRtl ? 'مفتاح API التجاري الحي' : 'Live Merchant API Key'}
        sublabel={isRtl ? 'أرسل في ترويسة Authorization: Bearer <KEY>' : 'Pass in Authorization: Bearer <KEY> header'}
        value={apiKey}
        show={showApiKey}
        setShow={setShowApiKey}
        copied={copiedKey}
        onCopy={() => handleCopy(apiKey, 'key')}
        icon={<Key size={20} color="white" />}
        iconBg="linear-gradient(135deg, #2563eb, #3b82f6)"
        iconColor="#2563eb"
        valueColor="#4ade80"
      />

      {/* ─── Webhook Secret ─── */}
      <SecretField
        label={isRtl ? 'مفتاح توقيع HMAC للويب هوك' : 'Webhook HMAC Signing Secret'}
        sublabel={isRtl ? 'للتحقق من ترويسة X-Instapay-Signature' : 'Verify X-Instapay-Signature header on callbacks'}
        value={webhookSecret}
        show={showWebhookSecret}
        setShow={setShowWebhookSecret}
        copied={copiedSecret}
        onCopy={() => handleCopy(webhookSecret, 'secret')}
        icon={<Lock size={20} color="white" />}
        iconBg="linear-gradient(135deg, #d97706, #f59e0b)"
        iconColor="#d97706"
        valueColor="#fbbf24"
      />

      {/* ─── Two-column: Simulator + cURL ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Simulator */}
        <div style={{ ...card({ padding: '28px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '11px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
            }}>
              <Zap size={18} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                {isRtl ? 'محاكي الدفع التفاعلي' : 'Checkout Simulator'}
              </h3>
              <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                {isRtl ? 'إنشاء جلسات دفع تجريبية مباشرة' : 'Generate real checkout sessions directly'}
              </p>
            </div>
          </div>

          <form onSubmit={handleRunSimulator}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
              {/* Amount */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {isRtl ? 'المبلغ (ج.م)' : 'Amount (EGP)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    color: textPrimary,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  }}
                />
              </div>

              {/* Sender */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {isRtl ? 'معرّف إنستاباي للمرسل' : 'Sender InstaPay Handle'}
                </label>
                <input
                  type="text"
                  value={testSender}
                  onChange={(e) => setTestSender(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '13px',
                    borderRadius: '10px',
                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    color: textPrimary,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                />
              </div>

              {/* Note */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {isRtl ? 'ملاحظة / مرجع' : 'Note / Reference'}
                </label>
                <input
                  type="text"
                  value={testNote}
                  onChange={(e) => setTestNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '13px',
                    borderRadius: '10px',
                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    color: textPrimary,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={simLoading}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: simLoading
                  ? (isDark ? '#1e293b' : '#94a3b8')
                  : 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 700,
                borderRadius: '12px',
                border: 'none',
                cursor: simLoading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: simLoading ? 'none' : '0 4px 14px rgba(16,185,129,0.35)',
                transition: 'all 0.25s ease',
              }}
            >
              {simLoading ? (
                <>
                  <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  {isRtl ? 'جاري الإنشاء...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Zap size={15} />
                  {isRtl ? 'إنشاء جلسة دفع تجريبية' : 'Generate Test Checkout'}
                </>
              )}
            </button>
          </form>

          {/* Simulator Result */}
          {simResult && (
            <div style={{
              marginTop: '18px',
              padding: '18px',
              backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4',
              border: isDark ? '1px solid rgba(16,185,129,0.25)' : '1px solid #bbf7d0',
              borderRadius: '14px',
              animation: 'fadeIn 0.3s ease-out',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: isDark ? '#34d399' : '#166534' }}>
                  <CheckCircle2 size={15} />
                  {isRtl ? 'تم الإنشاء' : 'Checkout Created'}
                </span>
                <a
                  href={simResult.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    color: isDark ? '#38bdf8' : '#2563eb',
                    fontWeight: 700,
                    textDecoration: 'none',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'rgba(56,189,248,0.1)' : '#eff6ff',
                    transition: 'all 0.2s',
                  }}
                >
                  {isRtl ? 'فتح صفحة الدفع' : 'Open Checkout'} <ExternalLink size={12} />
                </a>
              </div>
              <div style={{
                ...terminalBg,
                padding: '10px 14px',
                fontSize: '11.5px',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                color: '#94a3b8',
                overflowX: 'auto',
              }}>
                <span style={{ color: '#64748b' }}>session:</span>{' '}
                <span style={{ color: '#4ade80' }}>{simResult.sessionId}</span>
                <br />
                <span style={{ color: '#64748b' }}>url:</span>{' '}
                <span style={{ color: '#38bdf8' }}>{simResult.checkoutUrl}</span>
              </div>
            </div>
          )}
        </div>

        {/* cURL Quick Start */}
        <div style={{ ...card({ padding: '28px' }) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '11px',
                background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
              }}>
                <Terminal size={18} color="white" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'البدء السريع — cURL' : 'Quick Start — cURL'}
                </h3>
                <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                  {isRtl ? 'إنشاء جلسة دفع عبر الطرفية' : 'Create checkout via terminal'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCopy(curlSnippet, 'snippet')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: isDark ? 'rgba(139,92,246,0.12)' : '#f5f3ff',
                color: isDark ? '#a78bfa' : '#7c3aed',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {copiedSnippet ? <Check size={13} /> : <Clipboard size={13} />}
              {copiedSnippet ? (isRtl ? 'تم!' : 'Copied!') : (isRtl ? 'نسخ' : 'Copy')}
            </button>
          </div>

          {/* Terminal window */}
          <div style={{
            ...terminalBg,
            overflow: 'hidden',
          }}>
            {/* Terminal header bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderBottom: isDark ? '1px solid #1e293b' : '1px solid rgba(255,255,255,0.05)',
              backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
            }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
              <span style={{ marginLeft: '10px', fontSize: '11px', color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                bash — checkout/create
              </span>
            </div>
            <pre style={{
              padding: '18px 20px',
              fontSize: '12px',
              color: '#cbd5e1',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              margin: 0,
              overflowX: 'auto',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              <span style={{ color: '#4ade80' }}>$</span>{' '}
              <span style={{ color: '#fbbf24' }}>curl</span>{' '}
              <span style={{ color: '#94a3b8' }}>-X POST</span>{' '}
              <span style={{ color: '#38bdf8' }}>http://localhost:3001/api/v1/checkout/create</span>{' \\\n'}
              {'  '}<span style={{ color: '#94a3b8' }}>-H</span>{' '}
              <span style={{ color: '#fb923c' }}>"Authorization: Bearer {showApiKey ? apiKey : 'egp_live_***'}"</span>{' \\\n'}
              {'  '}<span style={{ color: '#94a3b8' }}>-H</span>{' '}
              <span style={{ color: '#fb923c' }}>"Content-Type: application/json"</span>{' \\\n'}
              {'  '}<span style={{ color: '#94a3b8' }}>-d</span>{' '}
              <span style={{ color: '#a78bfa' }}>{'\'{\n'}</span>
              <span style={{ color: '#a78bfa' }}>{'    '}"amountEgp": <span style={{ color: '#4ade80' }}>50.00</span>,{'\n'}</span>
              <span style={{ color: '#a78bfa' }}>{'    '}"senderHandle": <span style={{ color: '#38bdf8' }}>"customer@instapay"</span>,{'\n'}</span>
              <span style={{ color: '#a78bfa' }}>{'    '}"note": <span style={{ color: '#38bdf8' }}>"Order #1042"</span>{'\n'}</span>
              <span style={{ color: '#a78bfa' }}>{'  }\''}</span>
            </pre>
          </div>

          {/* API Endpoints Reference */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: textSecondary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isRtl ? 'نقاط النهاية المتاحة' : 'Available Endpoints'}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { method: 'POST', path: '/api/v1/checkout/create', desc: isRtl ? 'إنشاء جلسة دفع' : 'Create checkout session' },
                { method: 'GET', path: '/api/v1/checkout/:id', desc: isRtl ? 'التحقق من حالة الجلسة' : 'Check session status' },
                { method: 'POST', path: '/api/v1/webhook/test', desc: isRtl ? 'اختبار تسليم الويب هوك' : 'Test webhook delivery' },
              ].map((ep, i) => (
                <div
                  key={i}
                  style={{
                    ...subcard({ padding: '10px 14px' }),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontFamily: "'JetBrains Mono', monospace",
                      backgroundColor: ep.method === 'POST'
                        ? (isDark ? 'rgba(16,185,129,0.15)' : '#d1fae5')
                        : (isDark ? 'rgba(56,189,248,0.15)' : '#dbeafe'),
                      color: ep.method === 'POST'
                        ? (isDark ? '#34d399' : '#059669')
                        : (isDark ? '#38bdf8' : '#2563eb'),
                    }}>
                      {ep.method}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>
                      {ep.path}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: textMuted }}>
                    {ep.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom info banner ─── */}
      <div style={{
        ...card({ padding: '20px 24px' }),
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        background: isDark
          ? 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(56,189,248,0.06))'
          : 'linear-gradient(135deg, #f5f3ff, #eff6ff)',
        border: isDark ? '1px solid rgba(139,92,246,0.2)' : '1px solid #ddd6fe',
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <BookOpen size={20} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: textPrimary, margin: '0 0 3px 0' }}>
            {isRtl ? 'التوثيق ودعم التكامل' : 'Documentation & Integration Support'}
          </p>
          <p style={{ fontSize: '12px', color: textSecondary, margin: 0, lineHeight: 1.5 }}>
            {isRtl
              ? 'جميع استدعاءات API موثقة بأمثلة كاملة. تحقق من التوقيعات باستخدام HMAC-SHA256 مع مفتاح الويب هوك أعلاه.'
              : 'All API calls are documented with full examples. Verify webhook signatures using HMAC-SHA256 with your webhook secret above.'}
          </p>
        </div>
        <ChevronRight size={18} color={textMuted} />
      </div>
    </div>
  );
}
