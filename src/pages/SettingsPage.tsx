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
  LayoutGrid,
  List,
  Camera,
  Trash2,
} from 'lucide-react';
import { settingsApi, notificationsApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import './SettingsPage.css';

import { settingsSections, parseSettingsSection, type SettingsSection } from '../config/settingsNavigation';
export type SettingsTab = SettingsSection;

interface SettingsPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  subPath?: string;
  onSubPathChange?: (subPath: string) => void;
  onProfileImageChange?: (profileImageData: string | null) => void;
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

export function SettingsPage({ showToast, subPath, onSubPathChange, onProfileImageChange }: SettingsPageProps) {
  const { isRtl } = useLanguage();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => parseSettingsSection(subPath));
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
  const [profileImageData, setProfileImageData] = useState<string | null>(null);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);

  // Payment Precision & Review Policies
  const [autoAcceptOverpaid, setAutoAcceptOverpaid] = useState(true);
  const [overpaidMaxExcessEgp, setOverpaidMaxExcessEgp] = useState<number | string>(100);
  const [underpaidToleranceEnabled, setUnderpaidToleranceEnabled] = useState(false);
  const [underpaidToleranceEgp, setUnderpaidToleranceEgp] = useState<number | string>(5.0);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [notifViewMode, setNotifViewMode] = useState<'grid' | 'list'>('grid');

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
    setActiveTab(parseSettingsSection(subPath));
  }, [subPath]);

  const switchTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSaved(false);
    onSubPathChange?.(settingsSections.find(section => section.key === tab)?.path || 'profile');
  };

  /* ──────────────── Theme Tokens ──────────────── */
  const textPrimary = isDark ? '#f8fafc' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0';

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    backgroundColor: isDark ? '#111827' : '#ffffff',
    borderRadius: '16px',
    border: `1px solid ${borderColor}`,
    boxShadow: isDark
      ? '0 10px 25px -5px rgba(0,0,0,0.45), 0 8px 10px -6px rgba(0,0,0,0.3)'
      : '0 4px 16px rgba(0,0,0,0.06)',
    padding: 'clamp(14px, 3.5vw, 24px)',
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
        setProfileImageData(s.profileImageData || null);
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

  const uploadProfileImage = async (profileImage: string | null) => {
    setUploadingProfileImage(true);
    try {
      const result = await settingsApi.updateProfileImage(profileImage);
      if (!result?.ok) throw new Error(result?.error || 'Unable to update profile image');
      const savedImage = result.profileImageData || null;
      setProfileImageData(savedImage);
      onProfileImageChange?.(savedImage);
      showToast?.('success', profileImage ? (isRtl ? 'تم تحديث صورة الملف الشخصي' : 'Profile photo updated') : (isRtl ? 'تمت إزالة صورة الملف الشخصي' : 'Profile photo removed'));
    } catch (error: any) {
      showToast?.('error', error.response?.data?.error || error.message || (isRtl ? 'تعذر تحديث صورة الملف الشخصي' : 'Unable to update profile photo'));
    } finally {
      setUploadingProfileImage(false);
    }
  };

  const handleProfileImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0];
    event.target.value = '';
    if (!image) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
      showToast?.('error', isRtl ? 'استخدم صورة PNG أو JPEG أو WebP فقط.' : 'Use a PNG, JPEG, or WebP image.');
      return;
    }
    if (image.size > 750 * 1024) {
      showToast?.('error', isRtl ? 'يجب أن يكون حجم الصورة أقل من 750 كيلوبايت.' : 'Profile photo must be smaller than 750 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => void uploadProfileImage(String(reader.result));
    reader.onerror = () => showToast?.('error', isRtl ? 'تعذر قراءة الصورة المختارة.' : 'Unable to read the selected image.');
    reader.readAsDataURL(image);
  };

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
      if (activeTab === 'notifications') return;
      const payload = activeTab === 'general' ? { businessName }
        : activeTab === 'checkout' ? { instapayHandle: instapayHandle.trim(), instapayPaymentUrl, checkoutTtlMin: Number(checkoutTtlMin) }
        : activeTab === 'webhooks' ? { webhookUrl }
        : { autoAcceptOverpaid, overpaidMaxExcessEgp: overpaidMaxExcessEgp !== '' && overpaidMaxExcessEgp != null ? Number(overpaidMaxExcessEgp) : null, underpaidToleranceEnabled, underpaidToleranceEgp: Number(underpaidToleranceEgp) || 0 };
      const res = await settingsApi.update(payload);

      if (res.ok) {
        setSaved(true);
        setLastRefreshedAt(new Date());
        if (showToast) {
          showToast('success', isRtl ? 'تم حفظ إعدادات هذا القسم بنجاح.' : 'Section settings saved.');
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

  const activeSection = settingsSections.find(section => section.key === activeTab)!;
  const ActiveSectionIcon = activeSection.icon;
  const tabItems = settingsSections.map(section => ({
    key: section.key, labelEn: section.en, labelAr: section.ar,
    icon: <section.icon size={15} />,
    count: section.key === 'notifications' ? notifications.filter(n => !n.readAt).length : undefined,
  }));

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'unread') return !n.readAt;
    if (notifFilter === 'urgent') return n.severity === 'URGENT';
    return true;
  });

  return (
    <div className="merchant-page-container merchant-settings-page" style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '13px',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
          }}>
            <ActiveSectionIcon size={22} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
              {isRtl ? activeSection.ar : activeSection.en}
            </h2>
            <p style={{ fontSize: '13px', color: textSecondary, margin: '2px 0 0 0' }}>
              {isRtl ? activeSection.descriptionAr : activeSection.descriptionEn}
            </p>
          </div>
        </div>

        {/* Header Actions & Live Last Synced Badge */}
        {activeTab !== 'notifications' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="settings-sync-status" style={{
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
              disabled={saving || loading}
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
        )}
      </div>

      {/* ─── Modern Sub-Navigation Tabs ─── */}
      <div className="merchant-settings-tabs" role="tablist" aria-label={isRtl ? 'أقسام الإعدادات' : 'Settings sections'} style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        paddingBottom: '8px',
        marginBottom: '24px',
        borderBottom: `1px solid ${borderColor}`,
      }}>
        {tabItems.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => switchTab(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: 'clamp(7px, 2vw, 10px) clamp(11px, 2.5vw, 18px)',
                borderRadius: '12px',
                fontSize: 'clamp(11.5px, 2vw, 13px)',
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
              TAB 1A: MERCHANT PROFILE
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* ─── Hero Brand Identity Banner ─── */}
              <div style={{
                ...card({ padding: '26px 28px' }),
                background: isDark
                  ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.16) 0%, rgba(15, 23, 42, 0.92) 60%, rgba(6, 182, 212, 0.10) 100%)'
                  : 'linear-gradient(135deg, #eff6ff 0%, #ffffff 60%, #f0f9ff 100%)',
                border: isDark ? '1px solid rgba(59, 130, 246, 0.28)' : '1px solid #bfdbfe',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '20px',
                  flexWrap: 'wrap',
                  position: 'relative',
                  zIndex: 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px', minWidth: 0, flex: '1 1 280px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div
                        className="merchant-profile-photo"
                        style={{
                          width: '76px',
                          height: '76px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 800,
                          fontSize: '26px',
                          border: isDark ? '3px solid rgba(96, 165, 250, 0.45)' : '3px solid #ffffff',
                          boxShadow: '0 8px 22px rgba(37, 99, 235, 0.28)',
                        }}
                      >
                        {profileImageData ? (
                          <img src={profileImageData} alt="Merchant profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          businessName?.[0]?.toUpperCase() || <Store size={28} />
                        )}
                      </div>
                      <div style={{
                        position: 'absolute',
                        bottom: '0',
                        [isRtl ? 'left' : 'right']: '0',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        border: isDark ? '2px solid #0f172a' : '2px solid #ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(16,185,129,0.4)',
                      }}>
                        <Check size={13} color="white" strokeWidth={3} />
                      </div>
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <h3 style={{
                          fontSize: '20px',
                          fontWeight: 800,
                          color: textPrimary,
                          margin: 0,
                          letterSpacing: '-0.3px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {businessName.trim() || (isRtl ? 'اسم المتجر التجاري' : 'Your Business Name')}
                        </h3>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '999px',
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : '#dcfce7',
                          color: isDark ? '#34d399' : '#059669',
                          border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #86efac',
                        }}>
                          <ShieldCheck size={12} />
                          {isRtl ? 'هوية تاجر موثقة' : 'Verified Brand Identity'}
                        </span>
                      </div>

                      <p style={{ fontSize: '12.5px', color: textSecondary, margin: '0 0 10px 0', lineHeight: 1.5 }}>
                        {isRtl
                          ? 'تظهر هوية متجرك وصورتك الرمزية تلقائياً في صفحات الدفع المستضافة، إيصالات العملاء، وتطبيق NilePay Merchant.'
                          : 'Your store name and circular brand avatar appear across hosted checkout pages, customer receipts, and the NilePay Merchant app.'}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.85)',
                          color: textSecondary,
                          border: `1px solid ${borderColor}`,
                        }}>
                          {profileImageData
                            ? (isRtl ? '📸 شعار مخصص مفعّل' : '📸 Custom Avatar Active')
                            : (isRtl ? '🔤 شعار بالحروف الأولى' : '🔤 Initials Badge Active')}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.85)',
                          color: textSecondary,
                          border: `1px solid ${borderColor}`,
                        }}>
                          {isRtl ? '🌐 متزامن مع الويب والموبايل' : '🌐 Synced Across Web & Mobile'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Avatar Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <label style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '10px 16px',
                      borderRadius: '11px',
                      cursor: uploadingProfileImage ? 'wait' : 'pointer',
                      color: 'white',
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                      opacity: uploadingProfileImage ? 0.65 : 1,
                      transition: 'all 0.2s ease',
                    }}>
                      <Camera size={15} />
                      <span>
                        {uploadingProfileImage
                          ? (isRtl ? 'جارٍ الرفع...' : 'Uploading...')
                          : profileImageData
                          ? (isRtl ? 'تغيير شعار المتجر' : 'Change Brand Logo')
                          : (isRtl ? 'رفع شعار المتجر' : 'Upload Brand Logo')}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleProfileImageSelection}
                        disabled={uploadingProfileImage}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {profileImageData && (
                      <button
                        type="button"
                        onClick={() => void uploadProfileImage(null)}
                        disabled={uploadingProfileImage}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 14px',
                          borderRadius: '11px',
                          cursor: uploadingProfileImage ? 'wait' : 'pointer',
                          color: '#dc2626',
                          background: isDark ? 'rgba(220, 38, 38, 0.14)' : '#fef2f2',
                          border: isDark ? '1px solid rgba(220, 38, 38, 0.32)' : '1px solid #fecaca',
                          fontSize: '12.5px',
                          fontWeight: 700,
                        }}
                      >
                        <Trash2 size={14} />
                        <span>{isRtl ? 'إزالة الشعار' : 'Remove'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── Two-Column Brand Studio Grid ─── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px', alignItems: 'stretch' }}>
                {/* Card 1: Store Brand & Display Settings */}
                <div style={{ ...card({ padding: '24px' }), display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
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
                          {isRtl ? 'إعدادات الاسم التجاري والشعار' : 'Store Brand & Display Settings'}
                        </h3>
                        <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                          {isRtl ? 'تخصيص الاسم التجاري وصورة العرض لعملائك' : 'Configure how your business name and logo are presented'}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      {/* Business Display Name Input */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontSize: '12.5px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                            {isRtl ? 'الاسم التجاري للمتجر' : 'Business Display Name'}
                          </label>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: textSecondary,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>
                            {businessName.length}/60
                          </span>
                        </div>
                        <input
                          type="text"
                          maxLength={60}
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder={isRtl ? 'مثال: متجر التقنية الحديثة' : 'e.g. Acme Superstore'}
                          style={inputStyle}
                        />
                        <span style={{ fontSize: '11.5px', color: textSecondary, marginTop: '6px', display: 'block', lineHeight: 1.5 }}>
                          {isRtl
                            ? 'يظهر هذا الاسم في رأس صفحة الدفع، الإيصالات الرقمية، ولوحة تحكم التاجر.'
                            : 'Displayed prominently at the top of hosted checkout sessions, digital receipts, and your merchant workspace.'}
                        </span>
                      </div>

                      {/* Avatar Upload & Specifications Card */}
                      <div style={{
                        ...subcard({ padding: '16px' }),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: textPrimary }}>
                              {isRtl ? 'مواصفات الصورة الرمزية للمتجر' : 'Brand Avatar Specifications'}
                            </div>
                            <div style={{ fontSize: '11.5px', color: textSecondary, marginTop: '2px' }}>
                              {isRtl ? 'تُعرض داخل إطار دائري متناسق في جميع الشاشات' : 'Rendered inside a circular badge across web and mobile'}
                            </div>
                          </div>
                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            cursor: uploadingProfileImage ? 'wait' : 'pointer',
                            backgroundColor: isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff',
                            color: isDark ? '#60a5fa' : '#2563eb',
                            border: isDark ? '1px solid rgba(37, 99, 235, 0.3)' : '1px solid #bfdbfe',
                            fontSize: '11.5px',
                            fontWeight: 700,
                          }}>
                            <Camera size={13} />
                            <span>{isRtl ? 'اختيار ملف' : 'Browse File'}</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={handleProfileImageSelection}
                              disabled={uploadingProfileImage}
                              style={{ display: 'none' }}
                            />
                          </label>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                          gap: '8px',
                        }}>
                          {[
                            {
                              titleEn: 'Formats',
                              titleAr: 'الصيغ المدعومة',
                              valEn: 'PNG, JPG, WebP',
                              valAr: 'PNG, JPG, WebP',
                            },
                            {
                              titleEn: 'Max File Size',
                              titleAr: 'الحجم الأقصى',
                              valEn: 'Up to 750 KB',
                              valAr: 'حتى 750 كيلوبايت',
                            },
                            {
                              titleEn: 'Aspect Ratio',
                              titleAr: 'الأبعاد الموصى بها',
                              valEn: '1:1 Square / Circle',
                              valAr: '1:1 مربع / دائري',
                            },
                          ].map((spec, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.55)' : '#ffffff',
                                border: `1px solid ${borderColor}`,
                              }}
                            >
                              <div style={{ fontSize: '10px', fontWeight: 600, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                {isRtl ? spec.titleAr : spec.titleEn}
                              </div>
                              <div style={{ fontSize: '11.5px', fontWeight: 700, color: textPrimary, marginTop: '2px' }}>
                                {isRtl ? spec.valAr : spec.valEn}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subtle Footer Tip */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    paddingTop: '14px',
                    borderTop: `1px solid ${borderColor}`,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: '11.5px', color: textSecondary }}>
                      {isRtl
                        ? '💡 تلميح: اضغط على "حفظ التعديلات" في الأعلى بعد تعديل الاسم التجاري.'
                        : '💡 Tip: Click "Save Changes" in the header after updating your business name.'}
                    </span>
                  </div>
                </div>

                {/* Card 2: Live Customer Checkout & Portal Preview */}
                <div style={{ ...card({ padding: '24px' }), display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '18px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '11px',
                        background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(2,132,199,0.3)',
                      }}>
                        <Sparkles size={20} color="white" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                          {isRtl ? 'معاينة الهوية المباشرة' : 'Live Brand Experience Preview'}
                        </h3>
                        <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                          {isRtl ? 'كيف تظهر هوية متجرك للعملاء في صفحة الدفع' : 'Real-time preview of how customers see your store at checkout'}
                        </p>
                      </div>
                    </div>

                    {/* Simulated Hosted Checkout Card */}
                    <div style={{
                      ...subcard({ padding: '18px' }),
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      background: isDark
                        ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.75) 0%, rgba(15, 23, 42, 0.45) 100%)'
                        : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                    }}>
                      {/* Mock Browser / Checkout Top Bar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: '12px',
                        borderBottom: `1px solid ${borderColor}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', opacity: 0.75 }} />
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', opacity: 0.75 }} />
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', opacity: 0.75 }} />
                          <span style={{
                            fontSize: '10.5px',
                            color: textSecondary,
                            fontFamily: "'JetBrains Mono', monospace",
                            [isRtl ? 'marginRight' : 'marginLeft']: '6px',
                          }}>
                            checkout.nilepay.eg
                          </span>
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#dcfce7',
                          color: '#10b981',
                        }}>
                          {isRtl ? 'معاينة حية' : 'LIVE PREVIEW'}
                        </span>
                      </div>

                      {/* Store Header inside Checkout */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            flexShrink: 0,
                            background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: '18px',
                            boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                          }}>
                            {profileImageData ? (
                              <img src={profileImageData} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              businessName?.[0]?.toUpperCase() || <Store size={20} />
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong style={{ fontSize: '15px', color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {businessName.trim() || (isRtl ? 'اسم المتجر التجاري' : 'Your Business Name')}
                              </strong>
                              <ShieldCheck size={15} color="#10b981" style={{ flexShrink: 0 }} />
                            </div>
                            <span style={{ fontSize: '11.5px', color: textSecondary }}>
                              {isRtl ? 'بوابة الدفع الموثقة عبر نايل باي' : 'Verified NilePay Merchant Checkout'}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: isRtl ? 'left' : 'right' }}>
                          <div style={{ fontSize: '10.5px', color: textSecondary }}>
                            {isRtl ? 'نموذج فاتورة' : 'Sample Invoice'}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>
                            1,250.00 EGP
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Brand Readiness Status */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '10px',
                  }}>
                    {[
                      {
                        done: Boolean(businessName.trim()),
                        labelEn: 'Display Name',
                        labelAr: 'الاسم التجاري',
                        valueEn: businessName.trim() ? 'Configured & Ready' : 'Not set yet',
                        valueAr: businessName.trim() ? 'مكتمل وجاهز' : 'غير محدد بعد',
                      },
                      {
                        done: Boolean(profileImageData),
                        labelEn: 'Store Avatar',
                        labelAr: 'شعار المتجر',
                        valueEn: profileImageData ? 'Custom logo uploaded' : 'Using initials badge',
                        valueAr: profileImageData ? 'تم رفع شعار مخصص' : 'يستخدم الحرف الافتراضي',
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.55)' : '#f8fafc',
                          border: `1px solid ${borderColor}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <CheckCircle2 size={14} color={item.done ? '#10b981' : '#3b82f6'} />
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: textPrimary }}>
                            {isRtl ? item.labelAr : item.labelEn}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isRtl ? item.valueAr : item.valueEn}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 1B: CHECKOUT CONFIGURATION
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'checkout' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px', alignItems: 'start' }}>
              {/* Card 1: Checkout Link & Lifetime Configuration */}
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
                        {isRtl ? 'رابط الدفع' : 'Payment Link'}
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
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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

              {/* Card 2: Derived Receiving IPA & Session Lifecycle Summary */}
              <div style={{ ...card({ padding: '24px' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '11px',
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                  }}>
                    <Shield size={20} color="white" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                      {isRtl ? 'ملخص التوجيه وجلسة الدفع' : 'Routing & Session Summary'}
                    </h3>
                    <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                      {isRtl ? 'المعرف المستخرج وقواعد مطابقة الجلسات النشطة' : 'Derived receiving IPA and active session matching window'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ ...subcard({ padding: '14px 16px' }), display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, display: 'block' }}>
                        {isRtl ? 'عنوان الاستلام المستخرج (IPA)' : 'Derived Receiving IPA'}
                      </span>
                      <code style={{ fontSize: '13.5px', fontWeight: 700, color: instapayHandle ? '#10b981' : textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                        {instapayHandle || (isRtl ? 'غير مضبوط بعد' : 'Not configured yet')}
                      </code>
                    </div>
                    {instapayHandle && (
                      <button
                        type="button"
                        onClick={() => handleCopy(instapayHandle, 'checkout-handle')}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${borderColor}`,
                          backgroundColor: isDark ? '#111827' : '#ffffff',
                          color: copiedKey === 'checkout-handle' ? '#10b981' : textPrimary,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        {copiedKey === 'checkout-handle' ? <Check size={13} /> : <Copy size={13} />}
                        <span>{isRtl ? 'نسخ' : 'Copy'}</span>
                      </button>
                    )}
                  </div>

                  <div style={{ ...subcard({ padding: '14px 16px' }), display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, display: 'block' }}>
                        {isRtl ? 'نافذة المطابقة التلقائية' : 'Active Matching Window'}
                      </span>
                      <strong style={{ fontSize: '13.5px', color: textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>
                        {checkoutTtlMin || 10} {isRtl ? 'دقائق لكل جلسة' : 'minutes per session'}
                      </strong>
                    </div>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
                      color: '#3b82f6',
                    }}>
                      TTL
                    </span>
                  </div>

                  <div style={{
                    ...subcard({ padding: '12px 14px' }),
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    borderLeft: isRtl ? 'none' : '3px solid #10b981',
                    borderRight: isRtl ? '3px solid #10b981' : 'none',
                  }}>
                    <Info size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '11.5px', color: textSecondary, lineHeight: 1.55 }}>
                      {isRtl
                        ? 'عند فتح العميل لصفحة الدفع، يتم توجيهه مباشرة إلى رابط إنستاباي الخاص بك مع مراقبة التحويلات الواردة خلال نافذة الجلسة المحددة.'
                        : 'Buyers are directed to your verified InstaPay share link while the detector matches incoming transfers within the active TTL window.'}
                    </span>
                  </div>
                </div>
              </div>
              </div>

              {/* Card 3: Visual Guide — How to Find Your InstaPay IPN Link ("رابط") */}
              <div style={{ ...card({ padding: '24px' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '11px',
                      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                    }}>
                      <Sparkles size={20} color="white" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: 0 }}>
                        {isRtl
                          ? 'دليل مصور: كيف تحصل على رابط الدفع (IPN Link) من تطبيق إنستاباي؟'
                          : 'Visual Guide: How to Find Your InstaPay IPN Link ("رابط")'}
                      </h3>
                      <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                        {isRtl
                          ? 'اتبع الخطوات الموضحة في الصورة لاستخراج رابط الدفع المباشر بالضغط على خيار "رابط"'
                          : 'Follow the highlighted screenshot below and tap "رابط" (Link) inside the InstaPay app'}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}>
                    {isRtl ? 'اختر "رابط" من بطاقة الحساب' : 'Select "رابط" on Account Card'}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                  gap: '22px',
                  alignItems: 'center',
                }}>
                  {/* Annotated Guide Screenshot */}
                  <div style={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
                    backgroundColor: '#0b101e',
                    boxShadow: '0 14px 32px rgba(0, 0, 0, 0.22)',
                    maxWidth: '420px',
                    width: '100%',
                    margin: '0 auto',
                  }}>
                    <img
                      src="/guides/instapay-ipn-link-guide.jpg"
                      alt={isRtl ? 'شرح استخراج رابط إنستاباي عبر الضغط على زر رابط' : 'How to find your InstaPay IPN link by tapping رابط'}
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                      }}
                    />
                  </div>

                  {/* Step-by-Step Instructions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      {
                        step: '01',
                        titleEn: 'Open InstaPay & Locate Your Account Card',
                        titleAr: 'افتح تطبيق إنستاباي وانتقل لقسم "الحسابات"',
                        descEn: 'On the InstaPay home screen under "الحسابات" (Accounts), find the bank account card where you want to receive customer payments (e.g. username@instapay).',
                        descAr: 'في الشاشة الرئيسية لتطبيق إنستاباي أسفل قسم "الحسابات"، حدد بطاقة الحساب البنكي الذي ترغب في استقبال مدفوعات العملاء عليه.',
                        color: '#8b5cf6',
                      },
                      {
                        step: '02',
                        titleEn: 'Tap "رابط" (Share Link) — Highlighted in Green',
                        titleAr: 'اضغط على أيقونة "رابط" (المحددة بالأخضر في الصورة)',
                        descEn: 'Directly below your account name, you will see three buttons: "مشاركة QR", "رابط", and "الرصيد". Tap the middle button "رابط" (Link) to copy or share your official IPN payment link.',
                        descAr: 'أسفل اسم حسابك مباشرة ستجد 3 خيارات: (مشاركة QR - رابط - الرصيد). اضغط على الخيار الأوسط "رابط" لنسخ رابط الدفع الرسمي الخاص بحسابك.',
                        color: '#10b981',
                      },
                      {
                        step: '03',
                        titleEn: 'Paste into NilePay Payment Link Field',
                        titleAr: 'الصق الرابط في خانة "رابط الدفع" أعلاه',
                        descEn: 'Paste the copied text or URL (formatted like https://ipn.eg/S/username/instapay/TOKEN) into the Payment Link box above. NilePay automatically extracts the clean URL and derives your IPA handle!',
                        descAr: 'الصق الرسالة أو الرابط المنسوخ (بصيغة https://ipn.eg/S/username/instapay/TOKEN) في حقل "رابط الدفع" بالأعلى، وسيقوم النظام تلقائياً باستخراج الرابط النظيف وعنوان الـ IPA الخاص بك!',
                        color: '#3b82f6',
                      },
                    ].map((item) => (
                      <div
                        key={item.step}
                        style={{
                          ...subcard({ padding: '16px' }),
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '14px',
                          borderLeft: isRtl ? undefined : `3px solid ${item.color}`,
                          borderRight: isRtl ? `3px solid ${item.color}` : undefined,
                        }}
                      >
                        <div style={{
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
                        }}>
                          {item.step}
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
                        {isRtl
                          ? `${unreadCount} إشعار غير مقروء · إجمالي ${notifications.length}`
                          : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'} · ${notifications.length} total`}
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
                      padding: '5px 10px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff',
                      border: isDark ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid #bfdbfe',
                      fontSize: '11px',
                      color: isDark ? '#60a5fa' : '#1d4ed8',
                      fontWeight: 600,
                    }}>
                      <Clock size={12} color="#3b82f6" />
                      <span>
                        {isRtl ? 'آخر تحديث: ' : 'Synced: '}
                        <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {lastNotifRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </strong>
                        <span style={{ opacity: 0.8, [isRtl ? 'marginRight' : 'marginLeft']: '4px' }}>
                          ({formatRelativeTime(lastNotifRefreshedAt.toISOString())})
                        </span>
                      </span>
                    </div>

                    {/* Filter Pills */}
                    <div style={{ display: 'flex', gap: '3px', backgroundColor: isDark ? '#162033' : '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                      {(['all', 'unread', 'urgent'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setNotifFilter(filter)}
                          style={{
                            padding: '4px 9px',
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

                    {/* Multi-column Grid vs List View Toggle */}
                    <div style={{ display: 'flex', gap: '2px', backgroundColor: isDark ? '#162033' : '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setNotifViewMode('grid')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: notifViewMode === 'grid' ? 700 : 500,
                          backgroundColor: notifViewMode === 'grid' ? '#2563eb' : 'transparent',
                          color: notifViewMode === 'grid' ? 'white' : textSecondary,
                        }}
                        title={isRtl ? 'عرض شبكي متعدد الأعمدة' : 'Multi-column grid'}
                      >
                        <LayoutGrid size={12} />
                        <span>{isRtl ? 'شبكة' : 'Grid'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifViewMode('list')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: notifViewMode === 'list' ? 700 : 500,
                          backgroundColor: notifViewMode === 'list' ? '#2563eb' : 'transparent',
                          color: notifViewMode === 'list' ? 'white' : textSecondary,
                        }}
                        title={isRtl ? 'عرض قائمة' : 'List view'}
                      >
                        <List size={12} />
                        <span>{isRtl ? 'قائمة' : 'List'}</span>
                      </button>
                    </div>

                    <button
                      onClick={async () => {
                        await fetchNotificationsList();
                        if (showToast) showToast('info', isRtl ? 'تم تحديث صندوق التنبيهات' : 'Notification inbox refreshed');
                      }}
                      disabled={loadingNotifs}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: isDark ? '#162033' : '#ffffff',
                        border: `1px solid ${borderColor}`,
                        color: textPrimary,
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <RefreshCw size={12} style={loadingNotifs ? { animation: 'spin 1s linear infinite' } : {}} />
                      <span>{isRtl ? 'تحديث' : 'Refresh'}</span>
                    </button>

                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                        }}
                      >
                        <CheckCheck size={13} />
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
                ) : notifViewMode === 'grid' ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
                      gap: '12px',
                    }}
                  >
                    {filteredNotifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          borderRadius: '14px',
                          backgroundColor: n.readAt
                            ? (isDark ? '#162033' : '#f8fafc')
                            : (isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff'),
                          border: n.readAt
                            ? `1px solid ${borderColor}`
                            : (isDark ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid #bfdbfe'),
                          boxShadow: isDark
                            ? '0 4px 12px rgba(0,0,0,0.2)'
                            : '0 2px 8px rgba(0,0,0,0.04)',
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {!n.readAt && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '3px',
                              backgroundColor: n.severity === 'URGENT' ? '#ef4444' : '#2563eb',
                            }}
                          />
                        )}

                        <div>
                          {/* Card Header Row */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  backgroundColor: n.severity === 'URGENT'
                                    ? (isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2')
                                    : (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe'),
                                  color: n.severity === 'URGENT' ? '#f87171' : '#0284c7',
                                  border: n.severity === 'URGENT'
                                    ? (isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca')
                                    : (isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd'),
                                  flexShrink: 0,
                                }}
                              >
                                {n.severity}
                              </span>
                              {!n.readAt && (
                                <span
                                  style={{
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    backgroundColor: '#2563eb',
                                    display: 'inline-block',
                                    flexShrink: 0,
                                  }}
                                  title={isRtl ? 'غير مقروء' : 'Unread'}
                                />
                              )}
                            </div>

                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: textSecondary,
                                fontFamily: "'JetBrains Mono', monospace",
                                flexShrink: 0,
                                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)',
                                padding: '2px 6px',
                                borderRadius: '5px',
                              }}
                            >
                              <Clock size={11} color="#3b82f6" />
                              <span>{formatRelativeTime(n.createdAt)}</span>
                            </div>
                          </div>

                          {/* Title */}
                          <h4
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: textPrimary,
                              margin: '0 0 6px 0',
                              lineHeight: 1.35,
                            }}
                          >
                            {n.title}
                          </h4>

                          {/* Message Body (Takes 100% full width of card) */}
                          <p
                            style={{
                              fontSize: '12px',
                              color: textSecondary,
                              margin: '0 0 14px 0',
                              lineHeight: 1.55,
                              wordBreak: 'break-word',
                            }}
                          >
                            {n.message}
                          </p>
                        </div>

                        {/* Card Footer Divider & Metadata Actions */}
                        <div
                          style={{
                            paddingTop: '10px',
                            borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid rgba(226, 232, 240, 0.8)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '10.5px',
                              color: textMuted,
                              fontFamily: "'JetBrains Mono', monospace",
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatFullTimestamp(n.createdAt)}
                          </span>

                          {n.readAt ? (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: '#10b981',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: isDark ? '1px solid rgba(16,185,129,0.25)' : '1px solid #a7f3d0',
                              }}
                            >
                              <Check size={11} />
                              <span>{isRtl ? `قُرئ ${formatRelativeTime(n.readAt)}` : `Read ${formatRelativeTime(n.readAt)}`}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMarkSingleRead(n.id)}
                              style={{
                                fontSize: '11px',
                                color: '#2563eb',
                                backgroundColor: isDark ? 'rgba(37,99,235,0.12)' : '#eff6ff',
                                border: isDark ? '1px solid rgba(37,99,235,0.3)' : '1px solid #bfdbfe',
                                cursor: 'pointer',
                                fontWeight: 700,
                                padding: '3px 9px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s',
                              }}
                            >
                              <Check size={11} />
                              <span>{isRtl ? 'تحديد كمقروء' : 'Mark read'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredNotifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '12px',
                          backgroundColor: n.readAt
                            ? (isDark ? '#162033' : '#f8fafc')
                            : (isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff'),
                          border: n.readAt
                            ? `1px solid ${borderColor}`
                            : (isDark ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid #bfdbfe'),
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '9.5px',
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
                            <span style={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>
                              {n.title}
                            </span>
                            {!n.readAt && (
                              <span style={{
                                width: '7px', height: '7px', borderRadius: '50%',
                                backgroundColor: '#2563eb', display: 'inline-block',
                              }} />
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={11} color="#3b82f6" />
                              <span style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, fontFamily: "'JetBrains Mono', monospace" }}>
                                {formatRelativeTime(n.createdAt)}
                              </span>
                            </div>
                            {n.readAt ? (
                              <span style={{
                                fontSize: '10px',
                                color: '#10b981',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5',
                                padding: '1px 6px',
                                borderRadius: '4px',
                              }}>
                                <Check size={11} />
                                <span>{isRtl ? 'مقروء' : 'Read'}</span>
                              </span>
                            ) : (
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
                                }}
                              >
                                {isRtl ? 'تحديد كمقروء' : 'Mark read'}
                              </button>
                            )}
                          </div>
                        </div>

                        <p style={{ fontSize: '12px', color: textSecondary, margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>
                          {n.message}
                        </p>

                        <div style={{ fontSize: '10.5px', color: textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatFullTimestamp(n.createdAt)}
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
