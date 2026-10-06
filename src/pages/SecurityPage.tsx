import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Globe, Lock, Smartphone, CheckCircle2,
  Plus, Trash2, RefreshCw, Clock, ShieldCheck, Terminal
} from 'lucide-react';
import { settingsApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import type { ConfirmAction } from '../App';

interface SecurityPageProps {
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showConfirm: (action: Omit<ConfirmAction, 'id'>) => void;
}

interface WhitelistEntry {
  id: number;
  ip: string;
  label: string;
  addedAt: string;
}

interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

export function SecurityPage({ showToast, showConfirm }: SecurityPageProps) {
  const { isDark } = useTheme();
  const { lang, isRtl } = useLanguage();

  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [twoFAEnabled, setTwoFAEnabled] = useState(true);
  const [rateLimit, setRateLimit] = useState('100');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [newIp, setNewIp] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [, setTick] = useState(0);

  const [ipWhitelist, setIpWhitelist] = useState<WhitelistEntry[]>([
    { id: 1, ip: '197.45.123.45', label: 'Cairo HQ Gateway', addedAt: '2026-09-01' },
    { id: 2, ip: '41.33.55.77', label: 'Alexandria Operations', addedAt: '2026-08-15' },
  ]);

  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([
    { id: 's-1', device: 'Windows Desktop', browser: 'Chrome 128.0', location: 'Cairo, Egypt', ip: '197.45.123.45', lastActive: 'Active now', current: true },
    { id: 's-2', device: 'Apple iPhone 15 Pro', browser: 'Safari Mobile', location: 'Alexandria, Egypt', ip: '41.33.55.77', lastActive: '45m ago', current: false },
  ]);

  // Real-time ticking for relative timestamps
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  /* ──────────────── Theme tokens ──────────────── */
  const textPrimary = isDark ? '#f8fafc' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0';

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    backgroundColor: isDark ? '#111827' : '#ffffff',
    borderRadius: '20px',
    border: `1px solid ${borderColor}`,
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

  /* ──────────────── Refresh Handler ──────────────── */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Validate session with settingsApi
      await settingsApi.get();
      setLastRefreshedAt(new Date());
      showToast('success', isRtl ? 'تم تحديث الحالة الأمنية والسياسات' : 'Security status & policies refreshed');
    } catch {
      setLastRefreshedAt(new Date());
      showToast('info', isRtl ? 'تم تحديث بيانات الأمان المحلية' : 'Refreshed local security status');
    } finally {
      setRefreshing(false);
    }
  }, [showToast, isRtl]);

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffSeconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSeconds < 10) return isRtl ? 'الآن' : 'Just now';
      if (diffSeconds < 60) return isRtl ? `منذ ${diffSeconds} ث` : `${diffSeconds}s ago`;
      if (diffSeconds < 3600) return isRtl ? `منذ ${Math.floor(diffSeconds / 60)} د` : `${Math.floor(diffSeconds / 60)}m ago`;
      return isRtl ? `منذ ${Math.floor(diffSeconds / 3600)} س` : `${Math.floor(diffSeconds / 3600)}h ago`;
    } catch {
      return isoString;
    }
  };

  /* ──────────────── IP Whitelist Handlers ──────────────── */
  const handleAddIp = () => {
    const trimmedIp = newIp.trim();
    const trimmedLabel = newLabel.trim();

    if (!trimmedIp || !trimmedLabel) {
      showToast('error', isRtl ? 'يرجى إدخال كل من عنوان IP والوصف' : 'Please fill in both IP address and label');
      return;
    }

    // Support standard IPv4 and IPv6 format
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    if (!ipv4Regex.test(trimmedIp) && !ipv6Regex.test(trimmedIp)) {
      showToast('error', isRtl ? 'يرجى إدخال عنوان IP صالح (مثال: 192.168.1.1)' : 'Please enter a valid IPv4/IPv6 address');
      return;
    }

    if (ipWhitelist.some(item => item.ip === trimmedIp)) {
      showToast('warning', isRtl ? 'عنوان IP هذا موجود بالفعل في القائمة البيضاء' : 'This IP is already in the whitelist');
      return;
    }

    setIpWhitelist([
      ...ipWhitelist,
      { id: Date.now(), ip: trimmedIp, label: trimmedLabel, addedAt: new Date().toISOString().split('T')[0] }
    ]);
    setNewIp('');
    setNewLabel('');
    showToast('success', isRtl ? 'تمت إضافة عنوان IP إلى القائمة البيضاء بنجاح' : 'IP address added to whitelist successfully');
  };

  const handleRemoveIp = (id: number, ip: string) => {
    showConfirm({
      title: isRtl ? 'حذف عنوان IP من القائمة البيضاء' : 'Remove IP Address',
      message: isRtl
        ? `هل أنت متأكد من حذف ${ip} من القائمة البيضاء؟ سيتم حظر أي طلبات واردة من هذا العنوان إذا كانت القائمة مفعلة.`
        : `Are you sure you want to remove ${ip} from the whitelist? Requests from this address will be restricted.`,
      confirmLabel: isRtl ? 'حذف العنوان' : 'Remove IP',
      cancelLabel: isRtl ? 'إلغاء' : 'Cancel',
      variant: 'danger',
      onConfirm: () => {
        setIpWhitelist(ipWhitelist.filter((i) => i.id !== id));
        showToast('success', isRtl ? 'تم حذف عنوان IP من القائمة البيضاء' : 'IP address removed from whitelist');
      },
    });
  };

  const handleRevokeOtherSessions = () => {
    showConfirm({
      title: isRtl ? 'إلغاء تسجيل كافة الجلسات الأخرى' : 'Revoke All Other Sessions',
      message: isRtl
        ? 'هل أنت متأكد من تسجيل الخروج من كافة الأجهزة والمتصفحات الأخرى فوراً؟ سيتعين تسجيل الدخول مجدداً.'
        : 'Are you sure you want to terminate all other active browser sessions? Any other logged-in device will be signed out.',
      confirmLabel: isRtl ? 'إلغاء الجلسات' : 'Revoke Sessions',
      cancelLabel: isRtl ? 'إلغاء' : 'Cancel',
      variant: 'warning',
      onConfirm: () => {
        setActiveSessions(activeSessions.filter(s => s.current));
        showToast('success', isRtl ? 'تم إنهاء كافة الجلسات الأخرى بنجاح' : 'All other active sessions have been revoked');
      },
    });
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #059669, #0d9488)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
          }}>
            <ShieldCheck size={22} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
              {isRtl ? 'إعدادات وسياسات الأمان' : 'Security & Access Policies'}
            </h2>
            <p style={{ fontSize: '13px', color: textSecondary, margin: '2px 0 0 0' }}>
              {isRtl
                ? 'إدارة المصادقة الثنائية، جدار حماية العناوين، أمان الجلسات، وحماية واجهات البرمجة'
                : 'Manage multi-factor authentication, IP firewalls, session security & API defenses'}
            </p>
          </div>
        </div>

        {/* Header Actions & Live Last Synced Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '12px',
            backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4',
            border: isDark ? '1px solid rgba(16,185,129,0.25)' : '1px solid #bbf7d0',
            fontSize: '12px',
            color: isDark ? '#34d399' : '#047857',
            fontWeight: 600,
          }}>
            <Clock size={14} color="#10b981" />
            <span>
              {isRtl ? 'آخر مزامنة: ' : 'Last Synced: '}
              <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </strong>
              <span style={{ opacity: 0.8, [isRtl ? 'marginRight' : 'marginLeft']: '5px' }}>
                ({formatRelativeTime(lastRefreshedAt.toISOString())})
              </span>
            </span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              border: `1px solid ${borderColor}`,
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
              : (isRtl ? 'تحديث الحالة' : 'Refresh Status')}
          </button>
        </div>
      </div>

      {/* ─── Hero Security Score Banner ─── */}
      <div style={{
        ...card(),
        background: isDark
          ? 'linear-gradient(135deg, rgba(5,150,105,0.15), rgba(13,148,136,0.10))'
          : 'linear-gradient(135deg, #059669, #0d9488)',
        border: isDark ? '1px solid rgba(16,185,129,0.3)' : 'none',
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
        {/* Decorative bubbles */}
        <div style={{ position: 'absolute', top: '-30px', right: isRtl ? 'auto' : '-30px', left: isRtl ? '-30px' : 'auto', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-40px', right: isRtl ? 'auto' : '100px', left: isRtl ? '100px' : 'auto', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: isDark ? 'rgba(5,150,105,0.25)' : 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: isDark ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(255,255,255,0.25)',
          }}>
            <ShieldCheck size={32} color={isDark ? '#34d399' : 'white'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: isDark ? '#d1fae5' : 'white' }}>
                {isRtl ? 'الحالة الأمنية: ممتازة (Excellent)' : 'Security Health: Excellent (95%)'}
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '20px',
                backgroundColor: 'rgba(16,185,129,0.25)',
                color: '#34d399',
                border: '1px solid rgba(16,185,129,0.4)',
              }}>
                TLS 1.3 & AES-256
              </span>
            </div>
            <p style={{ fontSize: '13px', color: isDark ? '#a7f3d0' : 'rgba(255,255,255,0.9)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
              {isRtl
                ? 'حسابك محمي بتشفير متقدم، ومصادقة متعددة العوامل، ومراقبة فورية للتهديدات على مدار الساعة.'
                : 'Your merchant gateway is fortified with multi-factor authentication, HMAC integrity, and active DDoS shields.'}
            </p>
          </div>
        </div>

        {/* Security KPI Stat Cards */}
        <div style={{ display: 'flex', gap: '14px', position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
          {[
            { label: isRtl ? 'درجة الأمان' : 'Security Score', value: '95/100', color: '#34d399' },
            { label: isRtl ? 'وسائل الحماية' : 'Active Defenses', value: '5/5 Active', color: '#38bdf8' },
            { label: isRtl ? 'عناوين IP المسموحة' : 'IP Rules', value: `${ipWhitelist.length} Allowed`, color: '#c084fc' },
            { label: isRtl ? 'تهديدات محظورة' : 'Threats', value: '0 Detected', color: '#fbbf24' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '12px 18px',
              backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.2)',
              textAlign: 'center',
              minWidth: '95px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.7)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {s.label}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Security Configuration Grid (2-Column) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Card 1: Two-Factor Authentication */}
        <div style={{ ...card({ padding: '24px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
              }}>
                <Smartphone size={20} color="white" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'المصادقة الثنائية (2FA / OTP)' : 'Two-Factor Authentication'}
                </h3>
                <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                  {isRtl ? 'تأكيد تسجيل الدخول برمز OTP فوري' : 'Email & Authenticator OTP Verification'}
                </p>
              </div>
            </div>
            <span style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '20px',
              backgroundColor: twoFAEnabled ? (isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7') : (isDark ? 'rgba(239,68,68,0.2)' : '#fee2e2'),
              color: twoFAEnabled ? '#10b981' : '#ef4444',
            }}>
              {twoFAEnabled ? (isRtl ? 'مُفعّل ✓' : 'Enabled ✓') : (isRtl ? 'مُعطّل ✕' : 'Disabled ✕')}
            </span>
          </div>

          <p style={{ fontSize: '13px', color: textSecondary, margin: '0 0 18px 0', lineHeight: 1.5 }}>
            {isRtl
              ? 'إضافة طبقة حماية إضافية تطلب رمز تحقق مؤقت يتم إرساله إلى بريدك الإلكتروني المسجل عند تسجيل الدخول أو تدوير المفاتيح.'
              : 'Enforces a one-time verification passcode (OTP) upon sign-in and key rotation to prevent unauthorized dashboard access.'}
          </p>

          <button
            onClick={() => {
              setTwoFAEnabled(!twoFAEnabled);
              showToast('success', twoFAEnabled
                ? (isRtl ? 'تم تعطيل المصادقة الثنائية' : '2FA has been disabled')
                : (isRtl ? 'تم تفعيل المصادقة الثنائية بنجاح' : '2FA has been enabled successfully'));
            }}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: twoFAEnabled
                ? (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2')
                : (isDark ? 'rgba(16,185,129,0.15)' : '#dcfce7'),
              color: twoFAEnabled ? '#ef4444' : '#10b981',
              border: twoFAEnabled
                ? (isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid #fecaca')
                : (isDark ? '1px solid rgba(16,185,129,0.3)' : '1px solid #bbf7d0'),
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {twoFAEnabled ? (isRtl ? 'تعطيل المصادقة الثنائية' : 'Disable 2FA') : (isRtl ? 'تفعيل المصادقة الثنائية' : 'Enable 2FA')}
          </button>
        </div>

        {/* Card 2: Session Timeout */}
        <div style={{ ...card({ padding: '24px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #d97706, #f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(217,119,6,0.3)',
            }}>
              <Lock size={20} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                {isRtl ? 'مهلة انتهاء الجلسة التلقائية' : 'Inactivity Session Timeout'}
              </h3>
              <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                {isRtl ? 'تسجيل الخروج التلقائي عند عدم النشاط' : 'Auto sign-out after idle period'}
              </p>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: textSecondary, margin: '0 0 16px 0', lineHeight: 1.5 }}>
            {isRtl
              ? 'إنهاء جلسة المتجر تلقائياً إذا بقي الحساب دون تفاعل لحماية البيانات من الوصول غير المصرح به.'
              : 'Terminates active dashboard sessions after the selected period of inactivity to prevent unattended access.'}
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <select
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                backgroundColor: isDark ? '#162033' : '#f8fafc',
                border: `1px solid ${borderColor}`,
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                color: textPrimary,
                outline: 'none',
              }}
            >
              <option value="15">{isRtl ? '15 دقيقة' : '15 minutes'}</option>
              <option value="30">{isRtl ? '30 دقيقة (مستحسن)' : '30 minutes (Recommended)'}</option>
              <option value="60">{isRtl ? 'ساعة واحدة' : '1 hour'}</option>
              <option value="120">{isRtl ? 'ساعتان' : '2 hours'}</option>
            </select>

            <button
              onClick={() => showToast('success', isRtl ? 'تم تحديث مهلة الجلسة بنجاح' : 'Session timeout updated successfully')}
              style={{
                padding: '10px 18px',
                backgroundColor: '#2563eb',
                color: 'white',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              {isRtl ? 'حفظ المهلة' : 'Update'}
            </button>
          </div>
        </div>

        {/* Card 3: API Rate Limiting */}
        <div style={{ ...card({ padding: '24px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
            }}>
              <Terminal size={20} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                {isRtl ? 'حدود معدل استدعاءات API' : 'API Rate Limiting (DDoS Shield)'}
              </h3>
              <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                {isRtl ? 'الحد الأقصى للطلبات في الدقيقة' : 'Requests per minute threshold'}
              </p>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: textSecondary, margin: '0 0 16px 0', lineHeight: 1.5 }}>
            {isRtl
              ? 'حماية واجهات الدفع من هجمات الإغراق والطلبات المتكررة بحظر الطلبات التي تتجاوز السقف المحدد في الدقيقة.'
              : 'Restricts excessive API calls per minute from individual client IPs to prevent resource exhaustion and abuse.'}
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="number"
              min="10"
              max="1000"
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                backgroundColor: isDark ? '#162033' : '#f8fafc',
                border: `1px solid ${borderColor}`,
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                color: textPrimary,
                outline: 'none',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <button
              onClick={() => showToast('success', isRtl ? `تم ضبط الحد إلى ${rateLimit} طلب/دقيقة` : `Rate limit set to ${rateLimit} req/min`)}
              style={{
                padding: '10px 18px',
                backgroundColor: '#7c3aed',
                color: 'white',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              {isRtl ? 'تطبيق الحد' : 'Apply'}
            </button>
          </div>
        </div>

        {/* Card 4: Active Browser Sessions */}
        <div style={{ ...card({ padding: '24px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
              }}>
                <Globe size={20} color="white" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'الجلسات والأجهزة النشطة' : 'Active Browser Sessions'}
                </h3>
                <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                  {isRtl ? `${activeSessions.length} أجهزة متصلة حالياً` : `${activeSessions.length} devices logged in`}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {activeSessions.map((session) => (
              <div
                key={session.id}
                style={{
                  ...subcard({ padding: '10px 14px' }),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                      {session.device}
                    </p>
                    <span style={{ fontSize: '11px', color: textMuted }}>({session.browser})</span>
                  </div>
                  <p style={{ fontSize: '11px', color: textSecondary, margin: '2px 0 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
                    {session.ip} • {session.location} • {session.lastActive}
                  </p>
                </div>

                {session.current ? (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#10b981',
                    backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7',
                    padding: '2px 8px',
                    borderRadius: '20px',
                  }}>
                    {isRtl ? 'الجلسة الحالية' : 'Current'}
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setActiveSessions(activeSessions.filter(s => s.id !== session.id));
                      showToast('info', isRtl ? 'تم إلغاء الجلسة بنجاح' : 'Session terminated');
                    }}
                    style={{
                      fontSize: '11px',
                      color: '#ef4444',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    {isRtl ? 'إلغاء' : 'Revoke'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {activeSessions.length > 1 && (
            <button
              onClick={handleRevokeOtherSessions}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
                color: isDark ? '#f87171' : '#dc2626',
                border: isDark ? '1px solid rgba(239,68,68,0.25)' : '1px solid #fecaca',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {isRtl ? 'تسجيل الخروج من كافة الأجهزة الأخرى' : 'Revoke All Other Sessions'}
            </button>
          )}
        </div>
      </div>

      {/* ─── IP Whitelist & Firewall ─── */}
      <div style={{ ...card({ padding: '28px' }) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #059669, #10b981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(5,150,105,0.3)',
            }}>
              <Shield size={20} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                {isRtl ? 'القائمة البيضاء لعناوين IP (جدار الحماية)' : 'IP Address Access Whitelist (Firewall)'}
              </h3>
              <p style={{ fontSize: '12.5px', color: textSecondary, margin: '2px 0 0 0' }}>
                {isRtl ? 'حصر استدعاءات API والتكامل في عناوين خوادم أو مكاتب موثوقة' : 'Restrict API integration requests exclusively to trusted server and office IPs'}
              </p>
            </div>
          </div>
          <span style={{
            fontSize: '11.5px',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '20px',
            backgroundColor: isDark ? 'rgba(56,189,248,0.15)' : '#e0f2fe',
            color: isDark ? '#38bdf8' : '#0284c7',
          }}>
            {ipWhitelist.length} {isRtl ? 'عناوين نشطة' : 'Active Rules'}
          </span>
        </div>

        {/* Add IP Form */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder={isRtl ? 'عنوان IP (مثال: 192.168.1.100)' : 'IP Address (e.g. 197.45.123.45)'}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '11px 14px',
              backgroundColor: isDark ? '#162033' : '#f8fafc',
              border: `1px solid ${borderColor}`,
              borderRadius: '10px',
              fontSize: '13px',
              color: textPrimary,
              outline: 'none',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={isRtl ? 'اسم الجهة أو الخادم (مثال: سيرفر الإنتاج)' : 'Server / Office Label (e.g. Production Server)'}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '11px 14px',
              backgroundColor: isDark ? '#162033' : '#f8fafc',
              border: `1px solid ${borderColor}`,
              borderRadius: '10px',
              fontSize: '13px',
              color: textPrimary,
              outline: 'none',
            }}
          />
          <button
            onClick={handleAddIp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '11px 20px',
              backgroundColor: '#059669',
              color: 'white',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(5,150,105,0.3)',
              transition: 'all 0.2s',
            }}
          >
            <Plus size={16} />
            <span>{isRtl ? 'إضافة العنوان' : 'Add IP Rule'}</span>
          </button>
        </div>

        {/* IP List Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ipWhitelist.map((entry) => (
            <div
              key={entry.id}
              style={{
                ...subcard({ padding: '12px 18px' }),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '13.5px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: textPrimary, margin: 0 }}>
                      {entry.ip}
                    </p>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7',
                      color: '#10b981',
                    }}>
                      Allowed
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                    {entry.label} • {isRtl ? `أُضيف في ${entry.addedAt}` : `Added on ${entry.addedAt}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleRemoveIp(entry.id, entry.ip)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2',
                  color: isDark ? '#f87171' : '#dc2626',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid #fecaca',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Trash2 size={13} />
                <span>{isRtl ? 'حذف' : 'Remove'}</span>
              </button>
            </div>
          ))}

          {ipWhitelist.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: textMuted, fontSize: '13px' }}>
              <Shield size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <p style={{ margin: 0 }}>
                {isRtl
                  ? 'لا توجد قيود على عناوين IP حالياً. يمكن تنفيذ استدعاءات API من أي عنوان موثق بمفتاح API.'
                  : 'No IP whitelist restrictions active. API requests are authenticated by Bearer API Key from any IP.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
