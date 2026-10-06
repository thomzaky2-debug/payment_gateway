import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone, CheckCircle2, AlertTriangle, Wifi, WifiOff,
  Battery, Clock, Download, RefreshCw, Shield, Activity,
  Signal, Cpu, Server, Zap, ArrowRight, ExternalLink,
  Copy, Check
} from 'lucide-react';
import { settingsApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface DetectorPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function DetectorPage({ showToast }: DetectorPageProps) {
  const { isDark } = useTheme();
  const { lang, isRtl } = useLanguage();
  const [devices, setDevices] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchDetectorData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await settingsApi.get();
      if (data.ok) {
        setDevices(data.devices || []);
        setSettings(data.settings || null);
      }
      if (isRefresh && showToast) {
        showToast('success', isRtl ? 'تم تحديث البيانات بنجاح' : 'Detector data refreshed successfully');
      }
    } catch (err: any) {
      if (showToast) {
        showToast('error', isRtl ? 'فشل تحميل بيانات الكاشف' : 'Failed to load detector heartbeat data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast, isRtl]);

  useEffect(() => {
    fetchDetectorData();
    const interval = setInterval(() => fetchDetectorData(), 30000);
    return () => clearInterval(interval);
  }, [fetchDetectorData]);

  const latestDevice = devices.length > 0 ? devices[0] : null;
  const isOnline = latestDevice && (Date.now() - new Date(latestDevice.lastSeenAt).getTime()) < 10 * 60 * 1000;
  const timeSinceLastSeen = latestDevice
    ? Math.floor((Date.now() - new Date(latestDevice.lastSeenAt).getTime()) / 1000)
    : null;

  const formatTimeSince = (seconds: number) => {
    if (seconds < 60) return isRtl ? `منذ ${seconds} ثوانٍ` : `${seconds}s ago`;
    if (seconds < 3600) return isRtl ? `منذ ${Math.floor(seconds / 60)} دقيقة` : `${Math.floor(seconds / 60)}m ago`;
    return isRtl ? `منذ ${Math.floor(seconds / 3600)} ساعة` : `${Math.floor(seconds / 3600)}h ago`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    if (showToast) showToast('success', isRtl ? 'تم النسخ' : `Copied ${label}`);
  };

  /* ──────────────── Shared styles ──────────────── */
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

  const textPrimary = isDark ? '#f8fafc' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const accent = '#38bdf8';
  const accentPurple = '#8b5cf6';

  /* ──────────────── Loading state ──────────────── */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <RefreshCw size={32} className="animate-spin" style={{ color: accent }} />
        <p style={{ fontSize: '14px', color: textSecondary, fontWeight: 500 }}>
          {isRtl ? 'جاري تحميل بيانات الكاشف...' : 'Loading detector data...'}
        </p>
      </div>
    );
  }

  /* ──────────────── Setup steps ──────────────── */
  const setupSteps = isRtl ? [
    { num: '1', title: 'تحميل التطبيق', desc: 'قم بتنزيل ملف APK على جهاز الأندرويد الخاص بك وثبّته.', icon: <Download size={20} /> },
    { num: '2', title: 'تسجيل الدخول', desc: 'استخدم بيانات اعتماد التاجر لربط الجهاز بحسابك.', icon: <Shield size={20} /> },
    { num: '3', title: 'تفعيل الإشعارات', desc: 'امنح إذن "الوصول إلى الإشعارات" لرصد إيصالات إنستاباي.', icon: <Zap size={20} /> },
  ] : [
    { num: '1', title: 'Download APK', desc: 'Download & install the companion APK on your Android receiving phone.', icon: <Download size={20} /> },
    { num: '2', title: 'Login with Credentials', desc: 'Sign in with your merchant email & password to securely link the device.', icon: <Shield size={20} /> },
    { num: '3', title: 'Enable Notification Access', desc: 'Grant "Notification Listener Permission" to capture InstaPay receipts.', icon: <Zap size={20} /> },
  ];

  /* ──────────────── Device info rows ──────────────── */
  const deviceInfo = [
    { label: isRtl ? 'معرّف التاجر' : 'Merchant Handle', value: settings?.instapayHandle || (isRtl ? 'لم يتم التعيين' : 'Not set'), icon: <Signal size={15} /> },
    { label: isRtl ? 'نسخة التطبيق' : 'App Version', value: latestDevice?.appVersion || '2.0.0', icon: <Cpu size={15} /> },
    { label: isRtl ? 'إصدار أندرويد' : 'Android Version', value: latestDevice?.androidVersion || 'Android 12+', icon: <Smartphone size={15} /> },
    { label: isRtl ? 'الحزمة المستهدفة' : 'Target Package', value: 'com.egyptianbanks.instapay', icon: <Server size={15} />, copyable: true },
    { label: isRtl ? 'حالة رمز الكشف' : 'Token Status', value: settings?.detectToken ? (isRtl ? 'مُفعّل ونشط' : 'Configured & Active') : (isRtl ? 'في انتظار الموافقة' : 'Pending Approval'), icon: <Shield size={15} />, isStatus: true },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            }}>
              <Activity size={22} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
                {isRtl ? 'رفيق الكاشف' : 'Detector Companion'}
              </h2>
              <p style={{ fontSize: '13px', color: textSecondary, margin: 0 }}>
                {isRtl ? 'مراقبة جهاز الكاشف على أندرويد وخدمة NotificationListenerService' : 'Monitor your Android detector running NotificationListenerService'}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchDetectorData(true)}
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
            : (isRtl ? 'تحديث الحالة' : 'Refresh Status')}
        </button>
      </div>

      {/* ─── Hero Status Banner ─── */}
      <div style={{
        ...card(),
        background: isOnline
          ? (isDark
            ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1))'
            : 'linear-gradient(135deg, #10b981, #06b6d4)')
          : (isDark
            ? 'linear-gradient(135deg, rgba(100,116,139,0.15), rgba(51,65,85,0.2))'
            : 'linear-gradient(135deg, #64748b, #475569)'),
        border: isOnline
          ? (isDark ? '1px solid rgba(16,185,129,0.35)' : 'none')
          : (isDark ? '1px solid rgba(100,116,139,0.3)' : 'none'),
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
        {/* Decorative circles */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: isRtl ? 'auto' : '-30px',
          left: isRtl ? '-30px' : 'auto',
          width: '120px', height: '120px', borderRadius: '50%',
          background: isOnline
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(255,255,255,0.04)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-50px',
          right: isRtl ? 'auto' : '60px',
          left: isRtl ? '60px' : 'auto',
          width: '180px', height: '180px', borderRadius: '50%',
          background: isOnline
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(255,255,255,0.02)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: isOnline
              ? (isDark ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.2)')
              : (isDark ? 'rgba(100,116,139,0.25)' : 'rgba(255,255,255,0.15)'),
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
          }}>
            {isOnline
              ? <Wifi size={30} color={isDark ? '#34d399' : 'white'} />
              : <WifiOff size={30} color={isDark ? '#94a3b8' : 'rgba(255,255,255,0.8)'} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 800,
                margin: 0,
                color: isOnline
                  ? (isDark ? '#34d399' : 'white')
                  : (isDark ? '#94a3b8' : 'white'),
              }}>
                {isOnline
                  ? (isRtl ? 'جهاز الكاشف متصل' : 'Detector Phone Connected')
                  : (isRtl ? 'لم يتم اكتشاف نبضات' : 'No Active Heartbeat Detected')}
              </h3>
              {isOnline && (
                <div style={{
                  width: '12px', height: '12px', borderRadius: '50%',
                  backgroundColor: isDark ? '#34d399' : 'white',
                  animation: 'pulseGreen 2s ease-in-out infinite',
                  boxShadow: isDark
                    ? '0 0 10px rgba(52,211,153,0.5)'
                    : '0 0 10px rgba(255,255,255,0.6)',
                }} />
              )}
            </div>
            <p style={{
              fontSize: '13px',
              color: isOnline
                ? (isDark ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.9)')
                : (isDark ? '#64748b' : 'rgba(255,255,255,0.7)'),
              margin: '6px 0 0 0',
              lineHeight: 1.5,
            }}>
              {latestDevice ? (
                <>
                  {isRtl ? 'آخر ظهور: ' : 'Last seen: '}
                  <strong>{new Date(latestDevice.lastSeenAt).toLocaleTimeString()}</strong>
                  {timeSinceLastSeen !== null && ` (${formatTimeSince(timeSinceLastSeen)})`}
                  {' • '}{latestDevice.deviceId}
                </>
              ) : (
                isRtl
                  ? 'قم بتثبيت تطبيق الكاشف على هاتف الاستقبال لبدء كشف المدفوعات تلقائياً.'
                  : 'Install the companion APK on your receiving phone to start automatic payment detection.'
              )}
            </p>
          </div>
        </div>

        {/* Status metrics */}
        {latestDevice && (
          <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
            {[
              { label: isRtl ? 'الحالة' : 'Status', value: isOnline ? (isRtl ? 'متصل' : 'Online') : (isRtl ? 'غير متصل' : 'Offline'), color: isOnline ? '#34d399' : '#f87171' },
              { label: isRtl ? 'النبضة' : 'Heartbeat', value: timeSinceLastSeen !== null ? formatTimeSince(timeSinceLastSeen) : '—', color: accent },
            ].map((m, i) => (
              <div key={i} style={{
                padding: '12px 20px',
                backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.18)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.25)',
                textAlign: 'center',
                minWidth: '90px',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.7)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: m.color }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Two-column layout: Setup + Device Info ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* APK Setup Card */}
        <div style={{ ...card({ padding: '28px' }) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Smartphone size={16} color="white" />
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'إعداد تطبيق الكاشف' : 'Detector Companion Setup'}
                </h3>
              </div>
              <p style={{ fontSize: '12.5px', color: textSecondary, margin: 0, lineHeight: 1.6 }}>
                {isRtl
                  ? 'يعمل تطبيق الكاشف في الخلفية على هاتف أندرويد لرصد إيصالات إنستاباي تلقائياً وإرسالها إلى البوابة.'
                  : 'The native Android Detector APK runs in the background, captures InstaPay push receipts, and reports them to your gateway.'}
              </p>
            </div>
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            {setupSteps.map((step, i) => (
              <div
                key={i}
                style={{
                  ...subcard({ padding: '16px 18px' }),
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: isDark
                    ? `linear-gradient(135deg, rgba(99,102,241,${0.2 + i * 0.08}), rgba(139,92,246,${0.15 + i * 0.06}))`
                    : `linear-gradient(135deg, ${['#eef2ff', '#f3e8ff', '#ecfdf5'][i]}, ${['#e0e7ff', '#ede9fe', '#d1fae5'][i]})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  color: isDark ? accent : ['#6366f1', '#8b5cf6', '#10b981'][i],
                }}>
                  {step.icon}
                </div>
                <div>
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: textPrimary, margin: '0 0 4px 0' }}>
                    {step.title}
                  </h4>
                  <p style={{ fontSize: '12px', color: textSecondary, margin: 0, lineHeight: 1.55 }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Download Button */}
          <a
            href="/api/apks/detector"
            download="InstaPay-Detector.apk"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#ffffff',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '14px',
              textDecoration: 'none',
              boxShadow: '0 6px 20px rgba(79, 70, 229, 0.35)',
              transition: 'all 0.25s ease',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <Download size={18} />
            {isRtl ? 'تحميل تطبيق الكاشف (v2.0)' : 'Download Detector APK (v2.0)'}
          </a>
        </div>

        {/* Device & Integration Info Card */}
        <div style={{ ...card({ padding: '28px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Cpu size={16} color="white" />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: textPrimary, margin: 0 }}>
              {isRtl ? 'معلومات الجهاز والتكامل' : 'Device & Integration Info'}
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {deviceInfo.map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '13px 16px',
                  borderRadius: '10px',
                  backgroundColor: i % 2 === 0
                    ? (isDark ? 'rgba(22,32,51,0.5)' : '#f8fafc')
                    : 'transparent',
                  transition: 'background-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{row.icon}</span>
                  <span style={{ fontSize: '13px', color: textSecondary, fontWeight: 500 }}>
                    {row.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {row.isStatus ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '8px',
                      backgroundColor: settings?.detectToken
                        ? (isDark ? 'rgba(16,185,129,0.15)' : '#d1fae5')
                        : (isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7'),
                      color: settings?.detectToken
                        ? (isDark ? '#34d399' : '#059669')
                        : (isDark ? '#fbbf24' : '#b45309'),
                      border: settings?.detectToken
                        ? (isDark ? '1px solid rgba(16,185,129,0.3)' : '1px solid #a7f3d0')
                        : (isDark ? '1px solid rgba(245,158,11,0.3)' : '1px solid #fde68a'),
                    }}>
                      {settings?.detectToken
                        ? <CheckCircle2 size={12} />
                        : <AlertTriangle size={12} />}
                      {row.value}
                    </span>
                  ) : (
                    <>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: textPrimary,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      }}>
                        {row.value}
                      </span>
                      {row.copyable && (
                        <button
                          onClick={() => copyToClipboard(row.value, row.label)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px', height: '26px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: isDark ? 'rgba(56,189,248,0.1)' : '#f0f9ff',
                            cursor: 'pointer',
                            color: accent,
                            transition: 'all 0.2s',
                          }}
                          title={isRtl ? 'نسخ' : 'Copy'}
                        >
                          {copied === row.label ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Connection Quality Indicator */}
          <div style={{
            marginTop: '20px',
            ...subcard({ padding: '16px 20px' }),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={16} color={isOnline ? '#34d399' : '#f87171'} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: textPrimary }}>
                {isRtl ? 'جودة الاتصال' : 'Connection Quality'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {[1, 2, 3, 4, 5].map((bar) => (
                <div
                  key={bar}
                  style={{
                    width: '4px',
                    height: `${8 + bar * 4}px`,
                    borderRadius: '2px',
                    backgroundColor: isOnline
                      ? (bar <= (timeSinceLastSeen !== null && timeSinceLastSeen < 60 ? 5 : timeSinceLastSeen !== null && timeSinceLastSeen < 300 ? 3 : 1)
                        ? '#34d399'
                        : (isDark ? '#334155' : '#e2e8f0'))
                      : (isDark ? '#334155' : '#e2e8f0'),
                    transition: 'background-color 0.3s ease',
                  }}
                />
              ))}
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: isOnline ? '#34d399' : '#f87171',
                marginLeft: '6px',
                marginRight: isRtl ? '6px' : '0',
              }}>
                {isOnline
                  ? (timeSinceLastSeen !== null && timeSinceLastSeen < 60
                    ? (isRtl ? 'ممتاز' : 'Excellent')
                    : timeSinceLastSeen !== null && timeSinceLastSeen < 300
                      ? (isRtl ? 'جيد' : 'Good')
                      : (isRtl ? 'ضعيف' : 'Fair'))
                  : (isRtl ? 'غير متصل' : 'Offline')}
              </span>
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
          ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(56,189,248,0.06))'
          : 'linear-gradient(135deg, #eef2ff, #f0f9ff)',
        border: isDark ? '1px solid rgba(99,102,241,0.2)' : '1px solid #c7d2fe',
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Shield size={20} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: textPrimary, margin: '0 0 3px 0' }}>
            {isRtl ? 'اتصال آمن ومشفّر' : 'Secure & Encrypted Connection'}
          </p>
          <p style={{ fontSize: '12px', color: textSecondary, margin: 0, lineHeight: 1.5 }}>
            {isRtl
              ? 'جميع الاتصالات بين الكاشف والبوابة مشفرة بالكامل باستخدام TLS. يتم إرسال النبضات كل 30 ثانية.'
              : 'All communication between the detector and gateway is end-to-end encrypted via TLS. Heartbeat pings are sent every 30 seconds.'}
          </p>
        </div>
      </div>
    </div>
  );
}
