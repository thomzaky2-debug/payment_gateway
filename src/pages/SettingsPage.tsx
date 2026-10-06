import React, { useState, useEffect, useCallback } from 'react';
import {
  Save,
  CheckCircle2,
  Shield,
  Globe,
  Clock,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Sliders,
  Check,
  Bell,
  Link,
  Store,
  CheckCheck,
  AlertTriangle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Code,
  Key,
  ShieldCheck,
  Smartphone,
  Info,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { settingsApi, notificationsApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export type SettingsTab = 'general' | 'precision' | 'webhooks' | 'notifications';

interface SettingsPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  subPath?: string;
  onSubPathChange?: (subPath: string) => void;
}

interface NotificationItem {
  id: string;
  merchantId?: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'URGENT';
  readAt: string | null;
  createdAt: string;
  metadata?: any;
}

function parseTabFromSubPath(sub?: string): SettingsTab {
  if (!sub) return 'general';
  const clean = sub.toLowerCase();
  if (clean.includes('notification')) return 'notifications';
  if (clean.includes('precision') || clean.includes('tolerance')) return 'precision';
  if (clean.includes('webhook')) return 'webhooks';
  return 'general';
}

export function SettingsPage({ showToast, subPath, onSubPathChange }: SettingsPageProps) {
  const { isRtl } = useLanguage();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => parseTabFromSubPath(subPath));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [lastNotifRefreshedAt, setLastNotifRefreshedAt] = useState<Date>(new Date());
  const [, setTick] = useState(0);

  // General Gateway settings
  const [businessName, setBusinessName] = useState('');
  const [instapayHandle, setInstapayHandle] = useState('');
  const [instapayPaymentUrl, setInstapayPaymentUrl] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [checkoutTtlMin, setCheckoutTtlMin] = useState(10);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Payment Precision & Review Policies
  const [autoAcceptOverpaid, setAutoAcceptOverpaid] = useState(true);
  const [overpaidMaxExcessEgp, setOverpaidMaxExcessEgp] = useState<number | string>(100);
  const [underpaidToleranceEnabled, setUnderpaidToleranceEnabled] = useState(false);
  const [underpaidToleranceEgp, setUnderpaidToleranceEgp] = useState<number | string>(5.0);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [notifyOnUnderpaid, setNotifyOnUnderpaid] = useState(true);
  const [notifyOnOverpaid, setNotifyOnOverpaid] = useState(true);
  const [notifyOnUnmatched, setNotifyOnUnmatched] = useState(true);
  const [notifyOnDetectorOffline, setNotifyOnDetectorOffline] = useState(true);

  // Webhook Code language tab
  const [codeLang, setCodeLang] = useState<'nodejs' | 'python' | 'php'>('nodejs');

  // Helper to extract IPA handle from InstaPay Share / Payment URLs
  const extractIpaFromUrl = (url: string): string | null => {
    if (!url) return null;
    const match = url.match(/ipn\.eg\/S\/([^\/\s?#]+)/i) || url.match(/\/S\/([^\/\?#]+)/i);
    if (match && match[1]) {
      const clean = match[1].toLowerCase().replace(/^@/, '');
      return `${clean}@instapay`;
    }
    return null;
  };

  const handlePaymentUrlChange = (val: string) => {
    setInstapayPaymentUrl(val);
    const derived = extractIpaFromUrl(val);
    if (derived) {
      setInstapayHandle(derived);
    } else if (!val.trim()) {
      setInstapayHandle('');
    }
  };

  // Real-time ticking for relative timestamps
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // Sync tab when subPath changes
  useEffect(() => {
    if (subPath !== undefined) {
      setActiveTab(parseTabFromSubPath(subPath));
    }
  }, [subPath]);

  const switchTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    let target = '';
    if (tab === 'notifications') target = 'Notifications';
    else if (tab === 'precision') target = 'Precision';
    else if (tab === 'webhooks') target = 'Webhooks';
    onSubPathChange?.(target);
  };

  /* ──────────────── Theme Tokens ──────────────── */
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '10px',
    border: `1px solid ${borderColor}`,
    backgroundColor: isDark ? '#162033' : '#f8fafc',
    color: textPrimary,
    fontSize: '13.5px',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  /* ──────────────── Data Fetching ──────────────── */
  const fetchSettings = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await settingsApi.get();
      if (res.ok && res.settings) {
        const s = res.settings;
        setBusinessName(s.businessName || '');
        setInstapayHandle(s.instapayHandle || '');
        setInstapayPaymentUrl(s.instapayPaymentUrl || '');
        setWebhookUrl(s.webhookUrl || '');
        setCheckoutTtlMin(s.checkoutTtlMin || 10);
        setWebhookSecret(s.webhookSecret || '');

        setAutoAcceptOverpaid(s.autoAcceptOverpaid ?? true);
        setOverpaidMaxExcessEgp(s.overpaidMaxExcessEgp ?? 100);
        setUnderpaidToleranceEnabled(s.underpaidToleranceEnabled ?? false);
        setUnderpaidToleranceEgp(s.underpaidToleranceEgp ?? 5.0);
      }
      setLastRefreshedAt(new Date());
      if (isManualRefresh && showToast) {
        showToast('success', isRtl ? 'تم تحديث الإعدادات والقواعد بنجاح' : 'Settings & rules refreshed successfully');
      }
    } catch {
      if (showToast) {
        showToast('error', isRtl ? 'فشل تحميل إعدادات التاجر' : 'Failed to load merchant settings');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast, isRtl]);

  const fetchNotificationsList = useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const res = await notificationsApi.list();
      if (res?.ok) {
        setNotifications(res.notifications || []);
      }
      setLastNotifRefreshedAt(new Date());
    } catch {
      // silently ignore or notify if needed
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  const handleRefresh = async () => {
    await fetchSettings(true);
    if (activeTab === 'notifications') {
      await fetchNotificationsList();
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchNotificationsList();
    }
  }, [activeTab, fetchNotificationsList]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.update({
        businessName,
        instapayHandle: instapayHandle.trim(),
        instapayPaymentUrl,
        webhookUrl,
        checkoutTtlMin: Number(checkoutTtlMin),
        autoAcceptOverpaid,
        overpaidMaxExcessEgp:
          overpaidMaxExcessEgp !== '' && overpaidMaxExcessEgp != null
            ? Number(overpaidMaxExcessEgp)
            : null,
        underpaidToleranceEnabled,
        underpaidToleranceEgp: Number(underpaidToleranceEgp) || 0,
      });

      if (res.ok) {
        setSaved(true);
        setLastRefreshedAt(new Date());
        if (showToast) {
          showToast('success', isRtl ? 'تم حفظ الإعدادات وتحديث معرّف IPA بنجاح!' : 'Settings & InstaPay IPA updated successfully!');
        }
        setTimeout(() => setSaved(false), 2500);
      } else {
        if (showToast) showToast('error', res.error || (isRtl ? 'فشل الحفظ' : 'Failed to save settings'));
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || (isRtl ? 'فشل الحفظ' : 'Failed to save settings');
      if (showToast) showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (showToast) {
      showToast('info', isRtl ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard');
    }
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      if (showToast) showToast('success', isRtl ? 'تم تحديد كافة التنبيهات كمقروءة' : 'All notifications marked as read');
      fetchNotificationsList();
    } catch {}
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
      if (showToast) showToast('info', isRtl ? 'تم تحديد الإشعار كمقروء' : 'Notification marked as read');
    } catch {}
  };

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

  const formatFullTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const dateStr = date.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const timeStr = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return `${dateStr} • ${timeStr}`;
    } catch {
      return isoString;
    }
  };

  const tabItems: { key: SettingsTab; labelEn: string; labelAr: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'general', labelEn: 'Store & Credentials', labelAr: 'بيانات المتجر والحساب', icon: <Store size={15} /> },
    { key: 'precision', labelEn: 'Precision & Review Rules', labelAr: 'قواعد السماحية والمراجعة', icon: <Sliders size={15} /> },
    { key: 'webhooks', labelEn: 'Webhooks & API', labelAr: 'الويب هوك وبوابة المطور', icon: <Link size={15} /> },
    {
      key: 'notifications',
      labelEn: 'Notifications & Inbox',
      labelAr: 'التنبيهات وصندوق الوارد',
      icon: <Bell size={15} />,
      count: notifications.filter((n) => !n.readAt).length,
    },
  ];

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'unread') return !n.readAt;
    if (notifFilter === 'urgent') return n.severity === 'URGENT';
    return true;
  });

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '13px',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
          }}>
            <Sliders size={22} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
              {isRtl ? 'إعدادات المتجر وقواعد البوابة' : 'Settings & Precision Controls'}
            </h2>
            <p style={{ fontSize: '13px', color: textSecondary, margin: '2px 0 0 0' }}>
              {isRtl
                ? 'تخصيص بيانات المتجر، وسماحية المبالغ الزائدة والناقصة، وتكامل الويب هوك والتنبيهات'
                : 'Configure payment links, overpaid & underpaid precision tolerances, webhooks and notifications'}
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
            backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff',
            border: isDark ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid #bfdbfe',
            fontSize: '12px',
            color: isDark ? '#60a5fa' : '#1d4ed8',
            fontWeight: 600,
          }}>
            <Clock size={14} color="#3b82f6" />
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
            <span>
              {refreshing
                ? (isRtl ? 'جاري التحديث...' : 'Refreshing...')
                : (isRtl ? 'تحديث الإعدادات' : 'Refresh')}
            </span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              backgroundColor: '#10b981',
              color: 'white',
              fontSize: '13.5px',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              cursor: saving ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
              transition: 'all 0.2s ease',
              opacity: saving ? 0.8 : 1,
            }}
          >
            {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            <span>
              {saving
                ? (isRtl ? 'جاري الحفظ...' : 'Saving...')
                : saved
                ? (isRtl ? 'تم الحفظ!' : 'Saved!')
                : (isRtl ? 'حفظ التعديلات' : 'Save Changes')}
            </span>
          </button>
        </div>
      </div>

      {/* ─── Hero Overview Banner (Store Status & Health) ─── */}
      <div style={{
        ...card(),
        background: isDark
          ? 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(16,185,129,0.10))'
          : 'linear-gradient(135deg, #1e40af, #2563eb)',
        border: isDark ? '1px solid rgba(59,130,246,0.3)' : 'none',
        padding: '26px 30px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle background glow bubbles */}
        <div style={{ position: 'absolute', top: '-25px', right: isRtl ? 'auto' : '-25px', left: isRtl ? '-25px' : 'auto', width: '130px', height: '130px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-40px', right: isRtl ? 'auto' : '120px', left: isRtl ? '120px' : 'auto', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '16px',
            background: isDark ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: isDark ? '1px solid rgba(96,165,250,0.3)' : '1px solid rgba(255,255,255,0.25)',
          }}>
            <Store size={30} color={isDark ? '#60a5fa' : 'white'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '19px', fontWeight: 800, margin: 0, color: isDark ? '#dbeafe' : 'white' }}>
                {businessName || (isRtl ? 'المتجر الإلكتروني' : 'Merchant Gateway')}
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
                {instapayHandle ? `@${instapayHandle}` : 'Active Gateway'}
              </span>
              {webhookUrl && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(56,189,248,0.25)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56,189,248,0.4)',
                }}>
                  Webhooks Live
                </span>
              )}
            </div>
            <p style={{ fontSize: '13px', color: isDark ? '#bfdbfe' : 'rgba(255,255,255,0.9)', margin: '5px 0 0 0', lineHeight: 1.5 }}>
              {isRtl
                ? 'محرك الدفع الآلي يعمل بكفاءة مع قواعد مطابقة التسامح والدقة وحماية المعاملات الفورية.'
                : 'Smart InstaPay gateway engine active with automated precision tolerances and instant callbacks.'}
            </p>
          </div>
        </div>

        {/* KPI Mini Stat Cards */}
        <div style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
          {[
            { label: isRtl ? 'صلاحية الجلسة' : 'Session TTL', value: `${checkoutTtlMin} Mins`, color: '#38bdf8' },
            {
              label: isRtl ? 'سماحية الزيادة' : 'Overpaid Rule',
              value: autoAcceptOverpaid ? `≤ ${overpaidMaxExcessEgp || 0} EGP` : 'Disabled',
              color: '#34d399',
            },
            {
              label: isRtl ? 'سماحية العجز' : 'Underpaid Rule',
              value: underpaidToleranceEnabled ? `±${underpaidToleranceEgp || 0} EGP` : 'Strict 0',
              color: underpaidToleranceEnabled ? '#fbbf24' : '#94a3b8',
            },
            {
              label: isRtl ? 'تنبيهات غير مقروءة' : 'Unread Alerts',
              value: `${unreadCount} Alerts`,
              color: unreadCount > 0 ? '#f87171' : '#34d399',
            },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '10px 16px',
              backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.2)',
              textAlign: 'center',
              minWidth: '100px',
            }}>
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.7)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Modern Sub-Navigation Tabs ─── */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '8px',
        marginBottom: '24px',
        borderBottom: `1px solid ${borderColor}`,
      }}>
        {tabItems.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 600,
                cursor: 'pointer',
                backgroundColor: isActive
                  ? '#2563eb'
                  : isDark
                  ? '#162033'
                  : '#ffffff',
                color: isActive ? 'white' : textSecondary,
                border: isActive
                  ? '1px solid #2563eb'
                  : `1px solid ${borderColor}`,
                transition: 'all 0.2s',
                boxShadow: isActive ? '0 4px 12px rgba(37, 99, 235, 0.35)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon}
              <span>{isRtl ? tab.labelAr : tab.labelEn}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 800,
                  backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#ef4444',
                  color: 'white',
                  [isRtl ? 'marginRight' : 'marginLeft']: '4px',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Loading State ─── */}
      {loading ? (
        <div style={{ ...card({ padding: '60px 24px', textAlign: 'center' }) }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px auto', color: '#2563eb' }} />
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
            {isRtl ? 'جاري تحميل إعدادات وقواعد المتجر...' : 'Loading Merchant Settings...'}
          </h4>
          <p style={{ fontSize: '13px', color: textSecondary, margin: '6px 0 0 0' }}>
            {isRtl ? 'يتم الاتصال بقاعدة البيانات ومزامنة مفاتيح البوابة' : 'Connecting to gateway database and retrieving active configuration'}
          </p>
        </div>
      ) : (
        <div>
          {/* ══════════════════════════════════════════════════════════════════════
              TAB 1: STORE & CREDENTIALS
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'general' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
              {/* Card 1: Store Profile & Identity */}
              <div style={{ ...card({ padding: '24px' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '11px',
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                  }}>
                    <Store size={20} color="white" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                      {isRtl ? 'هوية المتجر وحساب الاستلام' : 'Store Identity & Receiving Account'}
                    </h3>
                    <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                      {isRtl ? 'الاسم الظاهر للعميل وحساب إنستاباي المعتمد' : 'Customer-facing store name & validated InstaPay IPA'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: textPrimary, marginBottom: '6px' }}>
                      {isRtl ? 'الاسم التجاري للمتجر' : 'Business Display Name'}
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={isRtl ? 'مثال: متجر التقنية الحديثة' : 'e.g. Acme Superstore'}
                      style={inputStyle}
                    />
                    <span style={{ fontSize: '11px', color: textSecondary, marginTop: '4px', display: 'block' }}>
                      {isRtl ? 'يظهر هذا الاسم في صفحة الفاتورة وشاشات الدفع للعملاء.' : 'Appears on customer checkout receipts and hosted payment pages.'}
                    </span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12.5px', fontWeight: 600, color: textPrimary, margin: 0 }}>
                        {isRtl ? 'عنوان الدفع اللحظي (InstaPay IPA / Handle)' : 'Receiving InstaPay IPA / Handle'}
                      </label>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '6px',
                        backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff',
                        color: isDark ? '#a5b4fc' : '#6366f1',
                        border: isDark ? '1px solid rgba(99,102,241,0.3)' : '1px solid #c7d2fe',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        <span>🔒</span> {isRtl ? 'تلقائي من الرابط' : 'Auto-synced from URL'}
                      </span>
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        readOnly
                        value={instapayHandle}
                        placeholder={isRtl ? 'يتم استخراجه تلقائياً من رابط الدفع أدناه' : 'Auto-derived from Payment URL below'}
                        style={{
                          ...inputStyle,
                          fontFamily: "'JetBrains Mono', monospace",
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f1f5f9',
                          cursor: 'default',
                          color: instapayHandle ? textPrimary : textSecondary,
                          paddingRight: isRtl ? '14px' : '42px',
                          paddingLeft: isRtl ? '42px' : '14px',
                        }}
                      />
                      {instapayHandle && (
                        <button
                          type="button"
                          onClick={() => handleCopy(instapayHandle, 'handle')}
                          style={{
                            position: 'absolute',
                            [isRtl ? 'left' : 'right']: '10px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: copiedKey === 'handle' ? '#10b981' : textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px',
                          }}
                          title={isRtl ? 'نسخ المعرف' : 'Copy handle'}
                        >
                          {copiedKey === 'handle' ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: textSecondary }}>
                        {isRtl
                          ? 'عنوان الـ IPA يتم تحديثه ومزامنته تلقائياً عند تعديل رابط المشاركة أدناه لاستلام ومطابقة التحويلات بدقة.'
                          : 'Your InstaPay Payment Address (IPA) is automatically synced from the Static Payment URL below to receive customer transfers.'}
                      </span>
                      {instapayHandle && (
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5',
                          color: isDark ? '#34d399' : '#059669',
                          border: isDark ? '1px solid rgba(16,185,129,0.25)' : '1px solid #a7f3d0',
                        }}>
                          ⚡ {instapayHandle}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Checkout Link & Lifetime Configuration */}
              <div style={{ ...card({ padding: '24px' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '11px',
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(5,150,105,0.3)',
                  }}>
                    <Globe size={20} color="white" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                      {isRtl ? 'رابط الدفع ومدة الجلسة' : 'Payment Link & Session Lifetime'}
                    </h3>
                    <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                      {isRtl ? 'رابط الدفع الثابت ومهلة انتهاء صلاحية الفاتورة' : 'Static payment share link and session timeout TTL'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12.5px', fontWeight: 600, color: textPrimary, margin: 0 }}>
                        {isRtl ? 'رابط المشاركة الثابت لإنستاباي (Static InstaPay URL)' : 'Static InstaPay Payment / Share URL'}
                      </label>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '6px',
                        backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5',
                        color: isDark ? '#34d399' : '#059669',
                        border: isDark ? '1px solid rgba(16,185,129,0.25)' : '1px solid #a7f3d0',
                      }}>
                        ⚡ {isRtl ? 'يستخرج الـ IPA تلقائياً' : 'Auto-derives IPA'}
                      </span>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="url"
                        value={instapayPaymentUrl}
                        onChange={(e) => handlePaymentUrlChange(e.target.value)}
                        placeholder="https://ipn.eg/S/mohammedshabana77/instapay/fdef45"
                        style={{
                          ...inputStyle,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '12.5px',
                          paddingRight: isRtl ? '14px' : '42px',
                          paddingLeft: isRtl ? '42px' : '14px',
                        }}
                      />
                      {instapayPaymentUrl && (
                        <button
                          type="button"
                          onClick={() => handleCopy(instapayPaymentUrl, 'url')}
                          style={{
                            position: 'absolute',
                            [isRtl ? 'left' : 'right']: '10px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: copiedKey === 'url' ? '#10b981' : textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px',
                          }}
                          title={isRtl ? 'نسخ الرابط' : 'Copy link'}
                        >
                          {copiedKey === 'url' ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: textSecondary, marginTop: '4px', display: 'block' }}>
                      {isRtl
                        ? 'رابط إنستاباي المباشر (مثل: https://ipn.eg/S/username/instapay/TOKEN). يقوم تلقائياً بملء معرف الحساب (IPA) كـ username@instapay.'
                        : 'InstaPay share link (e.g. https://ipn.eg/S/mohammedshabana77/instapay/fdef45). Automatically populates your Receiving IPA as mohammedshabana77@instapay.'}
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: textPrimary, marginBottom: '6px' }}>
                      {isRtl ? 'صلاحية جلسة الدفع بالدقائق (Session TTL)' : 'Checkout Session Lifetime (Minutes)'}
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={checkoutTtlMin}
                        onChange={(e) => setCheckoutTtlMin(Number(e.target.value))}
                        style={{
                          ...inputStyle,
                          maxWidth: '120px',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                        }}
                      />
                      {/* Quick preset buttons */}
                      {[5, 10, 15, 30].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setCheckoutTtlMin(mins)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: checkoutTtlMin === mins ? '1px solid #2563eb' : `1px solid ${borderColor}`,
                            backgroundColor: checkoutTtlMin === mins ? (isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff') : (isDark ? '#162033' : '#f8fafc'),
                            color: checkoutTtlMin === mins ? '#3b82f6' : textSecondary,
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', color: textSecondary, marginTop: '4px', display: 'block' }}>
                      {isRtl
                        ? 'المدة التي تظل فيها جلسة العميل نشطة لانتظار التحويل قبل انتهاء صلاحيتها (الموصى به: 10 دقائق).'
                        : 'Active window awaiting buyer payment before the checkout session expires (recommended: 10 mins).'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 2: PRECISION & REVIEW RULES
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'precision' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
                {/* Rule Card 1: Overpaid Acceptance */}
                <div style={{ ...card({ padding: '24px' }) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '11px',
                        background: 'linear-gradient(135deg, #059669, #10b981)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                      }}>
                        <TrendingUp size={20} color="white" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                          {isRtl ? 'قبول المبالغ الزائدة تلقائياً' : 'Auto-Accept Overpaid Transfers'}
                        </h3>
                        <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                          {isRtl ? 'تأكيد المعاملة إذا دفع العميل مبلغاً أعلى' : 'Confirm orders when customer sends excess funds'}
                        </p>
                      </div>
                    </div>

                    {/* Switch Toggle */}
                    <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '26px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={autoAcceptOverpaid}
                        onChange={(e) => setAutoAcceptOverpaid(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: autoAcceptOverpaid ? '#10b981' : isDark ? '#334155' : '#cbd5e1',
                        borderRadius: '26px', transition: '0.2s',
                      }}>
                        <span style={{
                          position: 'absolute', height: '20px', width: '20px',
                          left: autoAcceptOverpaid ? (isRtl ? '4px' : '22px') : (isRtl ? '22px' : '4px'),
                          bottom: '3px', backgroundColor: 'white', borderRadius: '50%',
                          transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }} />
                      </span>
                    </label>
                  </div>

                  <p style={{ fontSize: '13px', color: textSecondary, margin: '0 0 16px 0', lineHeight: 1.5 }}>
                    {isRtl
                      ? 'عند التفعيل، يتم قبول المعاملات التي يدفع فيها العميل مبلغاً أعلى من المطلوب تلقائياً وتأكيد الطلب مع تسجيل المبلغ الزائد كفائض لصالح المتجر دون إيقاف المعاملة.'
                      : 'Automatically accepts transactions when the customer transfers more than requested, marking the session CONFIRMED and crediting the excess.'}
                  </p>

                  {autoAcceptOverpaid && (
                    <div style={{ ...subcard({ padding: '16px', marginTop: '12px' }) }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: textPrimary, marginBottom: '6px' }}>
                        {isRtl ? 'الحد الأقصى للمبلغ الزائد المسموح به (EGP)' : 'Max Auto-Accepted Excess Buffer (EGP)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={overpaidMaxExcessEgp}
                        onChange={(e) => setOverpaidMaxExcessEgp(e.target.value)}
                        placeholder="100.00"
                        style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
                      />
                      <span style={{ fontSize: '11px', color: textSecondary, marginTop: '6px', display: 'block' }}>
                        {isRtl
                          ? `إذا تجاوزت الزيادة ${overpaidMaxExcessEgp || 0} EGP، فستُحال المعاملة إلى قائمة المراجعة اليدوية للموافقة عليها يدوياً.`
                          : `Overpayments exceeding ${overpaidMaxExcessEgp || 0} EGP will be flagged in Manual Review for merchant verification.`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Rule Card 2: Underpaid Tolerance */}
                <div style={{ ...card({ padding: '24px' }) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '11px',
                        background: 'linear-gradient(135deg, #ea580c, #f97316)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(234,88,12,0.3)',
                      }}>
                        <AlertCircle size={20} color="white" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                          {isRtl ? 'سماحية العجز في الدفع (Underpaid Tolerance)' : 'Underpaid Precision Tolerance'}
                        </h3>
                        <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                          {isRtl ? 'تجاوز فروق التقريب والرسوم البنكية الطفيفة' : 'Absorb minor rounding & transfer fee differences'}
                        </p>
                      </div>
                    </div>

                    {/* Switch Toggle */}
                    <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '26px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={underpaidToleranceEnabled}
                        onChange={(e) => setUnderpaidToleranceEnabled(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: underpaidToleranceEnabled ? '#ea580c' : isDark ? '#334155' : '#cbd5e1',
                        borderRadius: '26px', transition: '0.2s',
                      }}>
                        <span style={{
                          position: 'absolute', height: '20px', width: '20px',
                          left: underpaidToleranceEnabled ? (isRtl ? '4px' : '22px') : (isRtl ? '22px' : '4px'),
                          bottom: '3px', backgroundColor: 'white', borderRadius: '50%',
                          transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }} />
                      </span>
                    </label>
                  </div>

                  <p style={{ fontSize: '13px', color: textSecondary, margin: '0 0 16px 0', lineHeight: 1.5 }}>
                    {isRtl
                      ? 'في حال موافقة التاجر على هامش دقة معين (مثلاً خصم رسوم بنكية طفيفة أو تقريب قروش)، يتم تأكيد المعاملة تلقائياً إذا كان النقص ضمن هذا الحد دون تعطيل العميل.'
                      : 'If customer transfers an amount short by up to this agreed tolerance (e.g. transfer fees or decimal rounding), automatically accept and mark CONFIRMED.'}
                  </p>

                  {underpaidToleranceEnabled && (
                    <div style={{ ...subcard({ padding: '16px', marginTop: '12px' }) }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: textPrimary, marginBottom: '6px' }}>
                        {isRtl ? 'حد دقة السماحية المقبول (EGP)' : 'Agreed Precision Tolerance Limit (EGP)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={underpaidToleranceEgp}
                        onChange={(e) => setUnderpaidToleranceEgp(e.target.value)}
                        placeholder="5.00"
                        style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
                      />
                      <span style={{ fontSize: '11px', color: textSecondary, marginTop: '6px', display: 'block' }}>
                        {isRtl
                          ? `أي عجز أكبر من ${underpaidToleranceEgp || 0} EGP سيتم تحويله تلقائياً إلى قائمة المراجعة اليدوية.`
                          : `Any shortage exceeding ${underpaidToleranceEgp || 0} EGP will be flagged in Manual Review queue.`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Policy Explanation Callout */}
              <div style={{
                ...subcard({ padding: '18px 22px' }),
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                borderLeft: isRtl ? 'none' : '4px solid #3b82f6',
                borderRight: isRtl ? '4px solid #3b82f6' : 'none',
              }}>
                <Info size={22} color="#3b82f6" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '12.5px', color: textSecondary, lineHeight: 1.6 }}>
                  <strong style={{ color: textPrimary }}>
                    {isRtl ? 'كيف تحمي قواعد السماحية مبيعات متجرك؟ ' : 'How precision policies safeguard your revenue: '}
                  </strong>
                  {isRtl
                    ? 'تمنع هذه القواعد إلغاء المعاملات الناجحة بسبب فروق قروش طفيفة وتجنب تجربة الشراء المعطلة، بينما يتم عزل أي فروق غير طبيعية وإرسالها إلى شاشة المراجعة اليدوية لاتخاذ الإجراء المناسب.'
                    : 'These rules prevent frictionless checkout interruptions due to trivial cents differences, while routing abnormal discrepancies safely to the Manual Review queue.'}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 3: WEBHOOKS & API INTEGRATION
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'webhooks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
                {/* Webhook Configuration Card */}
                <div style={{ ...card({ padding: '24px' }) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '11px',
                      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
                    }}>
                      <Link size={20} color="white" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                        {isRtl ? 'رابط الويب هوك ومفتاح التوقيع' : 'Webhook Endpoint & Signing Secret'}
                      </h3>
                      <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                        {isRtl ? 'استقبال إشعارات الدفع الفورية المشفرة' : 'Receive instant cryptographically signed callbacks'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: textPrimary, marginBottom: '6px' }}>
                        {isRtl ? 'رابط خادمك لاستقبال الويب هوك (URL)' : 'Merchant Webhook URL'}
                      </label>
                      <input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://api.yourdomain.com/webhooks/instapay"
                        style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px' }}
                      />
                      <span style={{ fontSize: '11px', color: textSecondary, marginTop: '4px', display: 'block' }}>
                        {isRtl
                          ? 'الرابط الذي ستصل إليه طلبات POST المشفرة فور تطابق وتأكيد أي تحويل.'
                          : 'The POST endpoint that receives real-time payment notifications (JSON payload).'}
                      </span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: textPrimary, margin: 0 }}>
                          {isRtl ? 'مفتاح توقيع الويب هوك (Webhook Secret)' : 'Webhook Signing Secret'}
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'transparent',
                            border: 'none',
                            color: textSecondary,
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                          <span>{showSecret ? (isRtl ? 'إخفاء' : 'Hide') : (isRtl ? 'إظهار' : 'Show')}</span>
                        </button>
                      </div>

                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showSecret ? 'text' : 'password'}
                          disabled
                          value={webhookSecret || 'whsec_••••••••••••••••••••••••'}
                          style={{
                            ...inputStyle,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9',
                            color: textSecondary,
                            fontFamily: "'JetBrains Mono', monospace",
                            paddingRight: isRtl ? '14px' : '42px',
                            paddingLeft: isRtl ? '42px' : '14px',
                          }}
                        />
                        {webhookSecret && (
                          <button
                            type="button"
                            onClick={() => handleCopy(webhookSecret, 'secret')}
                            style={{
                              position: 'absolute',
                              [isRtl ? 'left' : 'right']: '10px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: copiedKey === 'secret' ? '#10b981' : textSecondary,
                              display: 'flex',
                              alignItems: 'center',
                              padding: '4px',
                            }}
                            title={isRtl ? 'نسخ المفتاح' : 'Copy secret'}
                          >
                            {copiedKey === 'secret' ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: textSecondary, marginTop: '4px', display: 'block' }}>
                        {isRtl
                          ? 'استخدم هذا المفتاح للتحقق من ترويسة x-instapay-signature لحماية خادمك من الهجمات المزورة.'
                          : 'Verify the x-instapay-signature HTTP header to prevent spoofing or replay attacks.'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subscribed Events Card */}
                <div style={{ ...card({ padding: '24px' }) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '11px',
                      background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(2,132,199,0.3)',
                    }}>
                      <Bell size={20} color="white" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                        {isRtl ? 'أحداث الويب هوك النشطة' : 'Subscribed Gateway Events'}
                      </h3>
                      <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                        {isRtl ? 'الأحداث المرسلة تلقائياً إلى خادمك' : 'Events automatically dispatched to your endpoint'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { event: 'payment.confirmed', labelAr: 'تأكيد الدفع ومطابقة التحويل', labelEn: 'Payment successfully confirmed & matched', color: '#10b981' },
                      { event: 'payment.overpaid', labelAr: 'استلام مبلغ زائد عن المطلوب', labelEn: 'Overpayment detected & credited', color: '#3b82f6' },
                      { event: 'payment.underpaid', labelAr: 'عجز في قيمة التحويل', labelEn: 'Underpaid transfer requiring action', color: '#ea580c' },
                      { event: 'payment.expired', labelAr: 'انتهاء صلاحية جلسة الدفع', labelEn: 'Checkout session expired (TTL timeout)', color: '#64748b' },
                      { event: 'detector.offline', labelAr: 'انقطاع اتصال جهاز الكاشف', labelEn: 'Android companion detector offline alert', color: '#ef4444' },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          ...subcard({ padding: '10px 14px' }),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <code style={{ fontSize: '12.5px', fontWeight: 700, color: item.color, fontFamily: "'JetBrains Mono', monospace" }}>
                            {item.event}
                          </code>
                          <p style={{ fontSize: '11px', color: textSecondary, margin: '2px 0 0 0' }}>
                            {isRtl ? item.labelAr : item.labelEn}
                          </p>
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '6px',
                          backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7',
                          color: '#10b981',
                        }}>
                          Subscribed
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Code Example Verification Box */}
              <div style={{ ...card({ padding: '24px' }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Code size={18} color="#2563eb" />
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                      {isRtl ? 'مثال التحقق من التوقيع (HMAC-SHA256 Signature Verification)' : 'HMAC-SHA256 Signature Verification Example'}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(['nodejs', 'python', 'php'] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setCodeLang(l)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: codeLang === l ? '#2563eb' : isDark ? '#1e293b' : '#f1f5f9',
                          color: codeLang === l ? 'white' : textSecondary,
                          border: 'none',
                          textTransform: 'uppercase',
                        }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <pre style={{
                  margin: 0,
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: isDark ? '#0b1120' : '#1e293b',
                  color: '#e2e8f0',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  lineHeight: 1.6,
                  overflowX: 'auto',
                }}>
                  {codeLang === 'nodejs' && `const crypto = require('crypto');

// req.headers['x-instapay-signature'] and req.headers['x-instapay-timestamp']
function verifyWebhook(rawPayload, signatureHeader, timestampHeader, secret) {
  if (!signatureHeader || !timestampHeader) {
    throw new Error('Missing X-Instapay-Signature or X-Instapay-Timestamp');
  }

  // 1. Anti-Replay: allow up to 5 minutes tolerance (timestamp in seconds)
  const currentTime = Math.floor(Date.now() / 1000);
  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp) || Math.abs(currentTime - timestamp) > 300) {
    throw new Error('Webhook timestamp expired or outside 5-minute tolerance');
  }

  // 2. Extract digest from 'v1=<sig>' header
  const signature = signatureHeader.startsWith('v1=')
    ? signatureHeader.slice(3)
    : signatureHeader;

  // 3. Compute expected HMAC-SHA256 signature: "<timestamp>.<rawPayload>"
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${rawPayload}\`)
    .digest('hex');

  // 4. Timing-safe comparison to prevent side-channel timing attacks
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expBuffer = Buffer.from(expectedSig, 'utf8');
  return sigBuffer.length === expBuffer.length && crypto.timingSafeEqual(sigBuffer, expBuffer);
}`}
                  {codeLang === 'python' && `import hmac, hashlib, time

# request.headers.get("X-Instapay-Signature") and request.headers.get("X-Instapay-Timestamp")
def verify_webhook(raw_payload: str, signature_header: str, timestamp_header: str, secret: str) -> bool:
    if not signature_header or not timestamp_header:
        raise ValueError("Missing webhook signature or timestamp header")

    # 1. Anti-Replay: allow up to 300 seconds tolerance
    current_time = int(time.time())
    timestamp = int(timestamp_header)
    if abs(current_time - timestamp) > 300:
        raise ValueError("Webhook timestamp expired or invalid")

    # 2. Extract digest from 'v1=<sig>'
    signature = signature_header.replace("v1=", "")

    # 3. Compute expected HMAC-SHA256 hex digest: "<timestamp>.<raw_payload>"
    base_string = f"{timestamp}.{raw_payload}"
    expected = hmac.new(
        secret.encode("utf-8"),
        base_string.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    # 4. Constant-time comparison
    return hmac.compare_digest(signature, expected)`}
                  {codeLang === 'php' && `<?php
// $_SERVER['HTTP_X_INSTAPAY_SIGNATURE'] and $_SERVER['HTTP_X_INSTAPAY_TIMESTAMP']
function verify_webhook($rawPayload, $signatureHeader, $timestampHeader, $secret) {
    if (empty($signatureHeader) || empty($timestampHeader)) {
        return false;
    }

    // 1. Anti-Replay: 300 seconds tolerance
    $currentTime = time();
    $timestamp = intval($timestampHeader);
    if (abs($currentTime - $timestamp) > 300) {
        return false;
    }

    // 2. Strip 'v1=' prefix if present
    $signature = str_starts_with($signatureHeader, 'v1=')
        ? substr($signatureHeader, 3)
        : $signatureHeader;

    // 3. Compute expected signature: "<timestamp>.<rawPayload>"
    $baseString = "{$timestamp}.{$rawPayload}";
    $expected = hash_hmac('sha256', $baseString, $secret);

    // 4. Constant-time string comparison
    return hash_equals($expected, $signature);
}`}
                </pre>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 4: NOTIFICATIONS & INBOX
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Notification Triggers Configuration Card */}
              <div style={{ ...card({ padding: '24px' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '11px',
                    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(217,119,6,0.3)',
                  }}>
                    <Bell size={20} color="white" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                      {isRtl ? 'قنوات وتفضيلات التنبيه الفوري' : 'Real-Time Alert Preferences'}
                    </h3>
                    <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                      {isRtl ? 'اختر الحالات التي ترغب في تلقي إشعارات فورية لها في لوحة التحكم' : 'Customize event triggers for merchant dashboard notifications'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {[
                    {
                      titleAr: 'تنبيهات المدفوعات الناقصة',
                      titleEn: 'Underpaid Payment Alerts',
                      subAr: 'إشعار فوري عند وجود عجز في قيمة التحويل',
                      subEn: 'Alert immediately when a customer pays short',
                      checked: notifyOnUnderpaid,
                      setter: setNotifyOnUnderpaid,
                    },
                    {
                      titleAr: 'تنبيهات المبالغ الزائدة',
                      titleEn: 'Overpaid Payment Alerts',
                      subAr: 'إشعار عند تحويل العميل لمبالغ أعلى من المطلوب',
                      subEn: 'Alert when a customer overpays and buffer applies',
                      checked: notifyOnOverpaid,
                      setter: setNotifyOnOverpaid,
                    },
                    {
                      titleAr: 'تنبيهات التحويلات اليتيمة',
                      titleEn: 'Unmatched Direct Transfers',
                      subAr: 'إشعار بأي تحويل بنكي مباشر بدون رقم جلسة',
                      subEn: 'Alert for direct bank transfers lacking order sessions',
                      checked: notifyOnUnmatched,
                      setter: setNotifyOnUnmatched,
                    },
                    {
                      titleAr: 'حالة جهاز الكاشف (Companion)',
                      titleEn: 'Detector Health Warnings',
                      subAr: 'تنبيه عاجل إذا انقطع اتصال تطبيق الكاشف بالإنترنت',
                      subEn: 'Urgent warning if Android detector goes offline',
                      checked: notifyOnDetectorOffline,
                      setter: setNotifyOnDetectorOffline,
                    },
                  ].map((pref, i) => (
                    <div
                      key={i}
                      style={{
                        ...subcard({ padding: '14px 16px' }),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>
                          {isRtl ? pref.titleAr : pref.titleEn}
                        </div>
                        <div style={{ fontSize: '11px', color: textSecondary, marginTop: '2px' }}>
                          {isRtl ? pref.subAr : pref.subEn}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={pref.checked}
                        onChange={(e) => pref.setter(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Real-time Notifications Inbox */}
              <div style={{ ...card({ padding: '24px' }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Bell size={18} color="white" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                        {isRtl ? 'صندوق التنبيهات وسجل الإشعارات' : 'Merchant Notification Inbox'}
                      </h3>
                      <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                        {isRtl ? `${notifications.length} إشعار مسجل في النظام` : `${notifications.length} events logged`}
                      </p>
                    </div>
                  </div>

                  {/* Filter & Action Buttons with Live Synced Timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Live Timestamp for Merchant Notification Inbox */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff',
                      border: isDark ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid #bfdbfe',
                      fontSize: '11.5px',
                      color: isDark ? '#60a5fa' : '#1d4ed8',
                      fontWeight: 600,
                    }}>
                      <Clock size={13} color="#3b82f6" />
                      <span>
                        {isRtl ? 'آخر تحديث للصندوق: ' : 'Inbox Synced: '}
                        <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {lastNotifRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </strong>
                        <span style={{ opacity: 0.8, [isRtl ? 'marginRight' : 'marginLeft']: '4px' }}>
                          ({formatRelativeTime(lastNotifRefreshedAt.toISOString())})
                        </span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', backgroundColor: isDark ? '#162033' : '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                      {(['all', 'unread', 'urgent'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setNotifFilter(filter)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: notifFilter === filter ? 700 : 500,
                            cursor: 'pointer',
                            border: 'none',
                            backgroundColor: notifFilter === filter ? '#2563eb' : 'transparent',
                            color: notifFilter === filter ? 'white' : textSecondary,
                            textTransform: 'capitalize',
                          }}
                        >
                          {filter === 'all'
                            ? (isRtl ? 'الكل' : 'All')
                            : filter === 'unread'
                            ? (isRtl ? 'غير المقروء' : 'Unread')
                            : (isRtl ? 'العاجلة' : 'Urgent')}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={async () => {
                        await fetchNotificationsList();
                        if (showToast) showToast('info', isRtl ? 'تم تحديث صندوق التنبيهات' : 'Notification inbox refreshed');
                      }}
                      disabled={loadingNotifs}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: isDark ? '#162033' : '#ffffff',
                        border: `1px solid ${borderColor}`,
                        color: textPrimary,
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <RefreshCw size={12} style={loadingNotifs ? { animation: 'spin 1s linear infinite' } : {}} />
                      <span>{isRtl ? 'تحديث' : 'Refresh'}</span>
                    </button>

                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                        }}
                      >
                        <CheckCheck size={14} />
                        <span>{isRtl ? 'تحديد الكل كمقروء' : 'Mark all read'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {loadingNotifs ? (
                  <div style={{ padding: '36px', textAlign: 'center', color: textSecondary }}>
                    <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px auto', color: '#2563eb' }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      {isRtl ? 'جاري مزامنة الإشعارات...' : 'Loading notifications...'}
                    </p>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: textMuted }}>
                    <CheckCircle2 size={38} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: textPrimary }}>
                      {isRtl ? 'صندوق الوارد نظيف تماماً!' : 'Inbox is all clear!'}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: textSecondary }}>
                      {isRtl ? 'لا توجد تنبيهات تطابق الفلتر المحدد حالياً.' : 'No alerts match the selected filter.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredNotifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          padding: '14px 18px',
                          borderRadius: '12px',
                          backgroundColor: n.readAt
                            ? (isDark ? '#162033' : '#f8fafc')
                            : (isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff'),
                          border: n.readAt
                            ? `1px solid ${borderColor}`
                            : (isDark ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid #bfdbfe'),
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '14px',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '6px',
                                backgroundColor: n.severity === 'URGENT'
                                  ? (isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2')
                                  : (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe'),
                                color: n.severity === 'URGENT' ? '#f87171' : '#0284c7',
                              }}
                            >
                              {n.severity}
                            </span>
                            <span style={{ fontSize: '13.5px', fontWeight: 700, color: textPrimary }}>
                              {n.title}
                            </span>
                            {!n.readAt && (
                              <span style={{
                                width: '7px', height: '7px', borderRadius: '50%',
                                backgroundColor: '#2563eb', display: 'inline-block',
                              }} />
                            )}
                          </div>
                          <p style={{ fontSize: '12.5px', color: textSecondary, margin: 0, lineHeight: 1.5 }}>
                            {n.message}
                          </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isRtl ? 'flex-start' : 'flex-end', gap: '4px', flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Clock size={12} color="#3b82f6" />
                            <span style={{ fontSize: '11.5px', fontWeight: 700, color: textPrimary, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                          <span style={{ fontSize: '10.5px', color: textMuted, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
                            {formatFullTimestamp(n.createdAt)}
                          </span>
                          {n.readAt && (
                            <span style={{
                              fontSize: '10px',
                              color: '#10b981',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5',
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}>
                              <Check size={11} />
                              <span>{isRtl ? `قُرئ ${formatRelativeTime(n.readAt)}` : `Read ${formatRelativeTime(n.readAt)}`}</span>
                            </span>
                          )}
                          {!n.readAt && (
                            <button
                              type="button"
                              onClick={() => handleMarkSingleRead(n.id)}
                              style={{
                                fontSize: '11px',
                                color: '#2563eb',
                                background: isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff',
                                border: isDark ? '1px solid rgba(37,99,235,0.25)' : '1px solid #bfdbfe',
                                cursor: 'pointer',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                marginTop: '2px',
                                transition: 'all 0.15s',
                              }}
                            >
                              {isRtl ? 'تحديد كمقروء' : 'Mark read'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
