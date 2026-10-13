import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Globe, LogOut, RefreshCw, Shield, ShieldCheck, Smartphone, X } from 'lucide-react';
import { settingsApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import type { ConfirmAction } from '../App';

interface SecurityPageProps {
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showConfirm: (action: Omit<ConfirmAction, 'id'>) => void;
}

interface ActiveSession { id: string; device: string; browser: string; location: string; ipAddress: string; lastSeenAt: string; current: boolean; }

export function SecurityPage({ showToast, showConfirm }: SecurityPageProps) {
  const { isDark } = useTheme();
  const { isRtl } = useLanguage();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const textPrimary = isDark ? '#f8fafc' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? 'rgba(51,65,85,.5)' : '#e2e8f0';
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: isDark ? '#111827' : '#fff', border: `1px solid ${borderColor}`, borderRadius: 18, boxShadow: isDark ? '0 10px 25px -5px rgba(0,0,0,.45)' : '0 4px 16px rgba(0,0,0,.06)', ...extra });

  const loadSessions = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true); else setLoading(true);
    try {
      const result = await settingsApi.getSessions();
      if (!result?.ok) throw new Error(result?.error || 'Unable to load active sessions');
      setSessions(result.sessions || []);
      if (manual) showToast('success', isRtl ? 'تم تحديث الجلسات النشطة' : 'Active sessions refreshed');
    } catch (error: any) {
      showToast('error', error.response?.data?.error || error.message || (isRtl ? 'تعذر تحميل الجلسات النشطة' : 'Unable to load active sessions'));
    } finally { setLoading(false); setRefreshing(false); }
  }, [isRtl, showToast]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const relativeTime = (value: string) => {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return isRtl ? 'الآن' : 'Active now';
    if (seconds < 3600) return isRtl ? `منذ ${Math.floor(seconds / 60)} دقيقة` : `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return isRtl ? `منذ ${Math.floor(seconds / 3600)} ساعة` : `${Math.floor(seconds / 3600)}h ago`;
    return isRtl ? `منذ ${Math.floor(seconds / 86400)} يوم` : `${Math.floor(seconds / 86400)}d ago`;
  };

  const revokeOne = (id: string) => void settingsApi.revokeSession(id).then(async (result) => {
    if (!result?.ok) throw new Error(result?.error || 'Unable to revoke session');
    await loadSessions(); showToast('success', isRtl ? 'تم إنهاء الجلسة' : 'Session revoked');
  }).catch((error: any) => showToast('error', error.response?.data?.error || error.message || (isRtl ? 'تعذر إنهاء الجلسة' : 'Unable to revoke session')));

  const revokeOthers = () => showConfirm({
    title: isRtl ? 'إنهاء الجلسات الأخرى' : 'Revoke All Other Sessions',
    message: isRtl ? 'سيتم تسجيل الخروج من جميع الأجهزة والمتصفحات الأخرى.' : 'All other browsers and devices will be signed out.',
    confirmLabel: isRtl ? 'إنهاء الجلسات' : 'Revoke Sessions', cancelLabel: isRtl ? 'إلغاء' : 'Cancel', variant: 'warning',
    onConfirm: () => void settingsApi.revokeOtherSessions().then(async (result) => {
      if (!result?.ok) throw new Error(result?.error || 'Unable to revoke sessions');
      await loadSessions(); showToast('success', isRtl ? 'تم إنهاء الجلسات الأخرى' : 'Other sessions revoked');
    }).catch((error: any) => showToast('error', error.response?.data?.error || error.message || (isRtl ? 'تعذر إنهاء الجلسات' : 'Unable to revoke sessions'))),
  });

  const controls = [
    { icon: <Smartphone size={19} />, title: isRtl ? 'التحقق عند تسجيل الدخول' : 'Sign-in verification', value: isRtl ? 'رمز البريد الإلكتروني مطلوب' : 'Email OTP required', detail: isRtl ? 'تتحقق الخدمة من جلسة التاجر.' : 'The server verifies merchant sessions.' },
    { icon: <Clock size={19} />, title: isRtl ? 'مدة الجلسة' : 'Session lifetime', value: isRtl ? '7 أيام' : '7 days', detail: isRtl ? 'تنتهي الجلسات تلقائياً ويمكن إلغاؤها.' : 'Sessions expire automatically and can be revoked.' },
    { icon: <Shield size={19} />, title: isRtl ? 'حماية الطلبات' : 'Request protection', value: isRtl ? 'مُدارة من المنصة' : 'Platform managed', detail: isRtl ? 'الحدود والتحقق من المصدر مفروضان على API.' : 'Rate limits and origin checks are enforced at the API.' },
  ];

  return <div className="merchant-page-container" style={{ maxWidth: 1100, margin: '0 auto', padding: 24, direction: isRtl ? 'rtl' : 'ltr' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#059669,#0d9488)', display: 'grid', placeItems: 'center' }}><ShieldCheck size={22} color="white" /></div><div><h2 style={{ color: textPrimary, margin: 0, fontSize: 22 }}>{isRtl ? 'الأمان والوصول' : 'Security & Access'}</h2><p style={{ color: textSecondary, margin: '3px 0 0', fontSize: 13 }}>{isRtl ? 'بيانات حية من جلسات حسابك وإعدادات الحماية الفعلية.' : 'Live account-session data and enforced platform protections.'}</p></div></div>
      <button type="button" onClick={() => void loadSessions(true)} disabled={refreshing} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '10px 15px', borderRadius: 10, border: `1px solid ${borderColor}`, color: textPrimary, background: isDark ? '#162033' : '#fff', cursor: refreshing ? 'wait' : 'pointer', fontWeight: 700 }}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />{refreshing ? (isRtl ? 'جارٍ التحديث' : 'Refreshing') : (isRtl ? 'تحديث' : 'Refresh')}</button>
    </div>
    <div style={{ ...card({ padding: 20, marginBottom: 20 }), display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>{controls.map((control) => <div key={control.title} style={{ padding: 14, background: isDark ? '#162033' : '#f8fafc', border: `1px solid ${borderColor}`, borderRadius: 12 }}><div style={{ display: 'flex', gap: 9, alignItems: 'center', color: '#38bdf8' }}>{control.icon}<strong style={{ color: textPrimary, fontSize: 14 }}>{control.title}</strong></div><p style={{ color: '#10b981', fontWeight: 700, margin: '12px 0 4px', fontSize: 13 }}>{control.value}</p><p style={{ color: textSecondary, margin: 0, fontSize: 12, lineHeight: 1.45 }}>{control.detail}</p></div>)}</div>
    <div style={card({ padding: 22 })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}><div style={{ display: 'flex', gap: 11, alignItems: 'center' }}><div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#dc2626,#ef4444)', display: 'grid', placeItems: 'center' }}><Globe size={19} color="white" /></div><div><h3 style={{ color: textPrimary, margin: 0, fontSize: 16 }}>{isRtl ? 'جلسات المتصفح النشطة' : 'Active Browser Sessions'}</h3><p style={{ color: textSecondary, margin: '2px 0 0', fontSize: 12 }}>{isRtl ? `${sessions.length} جلسة مسجلة` : `${sessions.length} active session${sessions.length === 1 ? '' : 's'}`}</p></div></div></div>
      {loading ? <p style={{ color: textSecondary, margin: 0 }}>{isRtl ? 'جارٍ تحميل الجلسات...' : 'Loading sessions...'}</p> : sessions.length === 0 ? <p style={{ color: textSecondary, margin: 0 }}>{isRtl ? 'لا توجد جلسات متاحة.' : 'No active browser sessions found.'}</p> : <div style={{ display: 'grid', gap: 10 }}>{sessions.map((session) => <div key={session.id} style={{ padding: '13px 14px', background: isDark ? '#162033' : '#f8fafc', border: `1px solid ${borderColor}`, borderRadius: 12, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><div><div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}><strong style={{ color: textPrimary, fontSize: 14 }}>{session.device}</strong><span style={{ color: textSecondary, fontSize: 12 }}>({session.browser})</span>{session.current && <span style={{ color: '#059669', fontSize: 11, fontWeight: 700 }}>{isRtl ? 'الجلسة الحالية' : 'Current'}</span>}</div><p style={{ color: textSecondary, fontSize: 12, margin: '4px 0 0' }}>{session.ipAddress} · {session.location} · {relativeTime(session.lastSeenAt)}</p></div>{!session.current && <button type="button" onClick={() => revokeOne(session.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#dc2626', background: isDark ? 'rgba(220,38,38,.12)' : '#fef2f2', border: isDark ? '1px solid rgba(220,38,38,.3)' : '1px solid #fecaca', padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}><X size={13} />{isRtl ? 'إنهاء' : 'Revoke'}</button>}</div>)}</div>}
      {sessions.some((session) => !session.current) && <button type="button" onClick={revokeOthers} style={{ width: '100%', marginTop: 16, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#dc2626', background: isDark ? 'rgba(220,38,38,.12)' : '#fef2f2', border: isDark ? '1px solid rgba(220,38,38,.3)' : '1px solid #fecaca', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}><LogOut size={15} />{isRtl ? 'إنهاء كل الجلسات الأخرى' : 'Revoke All Other Sessions'}</button>}
    </div>
  </div>;
}
