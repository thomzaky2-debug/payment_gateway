import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Smartphone,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  X,
  Copy,
  Check,
  Printer,
  FileText,
  Activity,
  Wifi,
  WifiOff,
  Zap,
  Shield,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { transactionsApi, settingsApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface OverviewPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  onNavigate?: (page: any, subPath?: string) => void;
}

function formatTxDate(dateString: string | Date | undefined, isRtl: boolean): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateString);
  }
}

function getRelativeTime(dateString: string | Date | undefined, isRtl: boolean): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const diffMs = Date.now() - d.getTime();
    if (isNaN(diffMs) || diffMs < 0) return '';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return isRtl ? 'الآن' : 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return isRtl ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return isRtl ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return isRtl ? 'أمس' : 'Yesterday';
    if (diffDays < 7) return isRtl ? `منذ ${diffDays} أيام` : `${diffDays}d ago`;
    return d.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getPurchaseTypeInfo(tx: any, isRtl: boolean): { label: string; category: string; icon: string } {
  if (tx.purpose === 'SUBSCRIPTION') {
    const plan = tx.subscriptionPlanName ? tx.subscriptionPlanName.toUpperCase() : 'PRO';
    return {
      label: tx.note || (isRtl ? `اشتراك باقة ${plan}` : `${plan} Plan Subscription`),
      category: isRtl ? 'ترقية باقة' : 'Plan Upgrade',
      icon: '💎',
    };
  }

  if (tx.note && typeof tx.note === 'string' && tx.note.trim()) {
    return {
      label: tx.note.trim(),
      category: isRtl ? 'شراء طلب' : 'Product Order',
      icon: '🛍️',
    };
  }

  return {
    label: isRtl ? 'طلب متجر إلكتروني' : 'Store Product Checkout',
    category: isRtl ? 'عملية شراء' : 'Standard Checkout',
    icon: '🛒',
  };
}

export function OverviewPage({ showToast, onNavigate }: OverviewPageProps) {
  const { t, isRtl } = useLanguage();
  const { isDark } = useTheme();
  const [stats, setStats] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [, setTick] = useState(0);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState(false);

  // Auto tick every 10s for real-time relative timestamps
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [statsData, txData, settingsData] = await Promise.all([
        transactionsApi.getStats(),
        transactionsApi.list({ limit: 5 }),
        settingsApi.get().catch(() => ({ ok: false })),
      ]);

      if (statsData.ok && statsData.stats) {
        setStats(statsData.stats);
      }
      if (txData.ok && txData.transactions) {
        setRecentTransactions(txData.transactions);
      }
      if (settingsData.ok) {
        setSettings(settingsData.settings || null);
        setDevices(settingsData.devices || []);
      }
      setLastRefreshedAt(new Date());
      if (isManualRefresh && showToast) {
        showToast('success', isRtl ? 'تم تحديث لوحة التحكم بنجاح' : 'Dashboard refreshed successfully');
      }
    } catch (err: any) {
      if (showToast) {
        showToast('error', isRtl ? 'تعذر تحديث إحصائيات لوحة التحكم' : 'Could not refresh dashboard statistics');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = (isManual = true) => {
    loadData(isManual);
  };

  const formatRelativeTime = (date: Date) => {
    try {
      const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
      if (diffSeconds < 5) return isRtl ? 'الآن' : 'Just now';
      if (diffSeconds < 60) return isRtl ? `منذ ${diffSeconds} ث` : `${diffSeconds}s ago`;
      if (diffSeconds < 3600) return isRtl ? `منذ ${Math.floor(diffSeconds / 60)} د` : `${Math.floor(diffSeconds / 60)}m ago`;
      return isRtl ? `منذ ${Math.floor(diffSeconds / 3600)} س` : `${Math.floor(diffSeconds / 3600)}h ago`;
    } catch {
      return '';
    }
  };

  // Compute checklist progress
  const hasPaymentUrl = !!settings?.instapayPaymentUrl;
  const hasDetector = devices.length > 0;
  const hasWebhook = !!settings?.webhookUrl;
  const hasApiKey = !!settings?.apiKey;
  const checklistTotal = 4;
  const checklistCompleted = [hasPaymentUrl, hasDetector, hasWebhook, hasApiKey].filter(Boolean).length;
  const checklistPercent = Math.round((checklistCompleted / checklistTotal) * 100);

  /* ──────────────── Shared "Detector Companion" Theme Styles ──────────────── */
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

  const latestDevice = devices.length > 0 ? devices[0] : null;
  const isDetectorOnline = latestDevice && (Date.now() - new Date(latestDevice.lastSeenAt).getTime()) < 10 * 60 * 1000;
  const timeSinceLastSeen = latestDevice
    ? Math.floor((Date.now() - new Date(latestDevice.lastSeenAt).getTime()) / 1000)
    : null;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ─── Page Header (Detector Companion Style) ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '26px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)',
              }}
            >
              <TrendingUp size={22} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
                {isRtl ? 'لوحة التحكم الرئيسية' : 'Dashboard Overview'}
              </h2>
              <p style={{ fontSize: '13px', color: textSecondary, margin: '2px 0 0 0' }}>
                {isRtl ? 'مراقبة ومتابعة عمليات الدفع اللحظية وخدمة كاشف إنستاباي' : 'Real-time overview of InstaPay payments and active detector companion'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Live Sync Status Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
              color: '#0284c7',
              border: isDark ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid #bae6fd',
            }}
          >
            <Clock size={13} />
            <span>
              {isRtl ? 'آخر مزامنة:' : 'Last Synced:'}{' '}
              {lastRefreshedAt.toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
            <span
              style={{
                fontSize: '11px',
                opacity: 0.85,
                fontWeight: 500,
              }}
            >
              ({formatRelativeTime(lastRefreshedAt)})
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => handleRefresh(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              backgroundColor: isDark ? '#1e293b' : 'white',
              border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
              color: textPrimary,
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '12px',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              boxShadow: isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.06)',
              transition: 'all 0.2s ease',
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            <RefreshCw
              size={14}
              style={{
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>{refreshing ? (isRtl ? 'جارِ التحديث...' : 'Refreshing...') : (isRtl ? 'تحديث البيانات' : 'Refresh')}</span>
          </button>
        </div>
      </div>

      {/* ─── Hero Status Banner (Detector Companion Signature) ─── */}
      <div
        style={{
          ...card(),
          background: isDetectorOnline
            ? (isDark
              ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1))'
              : 'linear-gradient(135deg, #10b981, #06b6d4)')
            : (isDark
              ? 'linear-gradient(135deg, rgba(100,116,139,0.15), rgba(51,65,85,0.2))'
              : 'linear-gradient(135deg, #64748b, #475569)'),
          border: isDetectorOnline
            ? (isDark ? '1px solid rgba(16,185,129,0.35)' : 'none')
            : (isDark ? '1px solid rgba(100,116,139,0.3)' : 'none'),
          padding: '24px 28px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Decorative Circles */}
        <div
          style={{
            position: 'absolute',
            top: '-30px',
            right: isRtl ? 'auto' : '-30px',
            left: isRtl ? '-30px' : 'auto',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: isDetectorOnline ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-50px',
            right: isRtl ? 'auto' : '60px',
            left: isRtl ? '60px' : 'auto',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: isDetectorOnline ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', position: 'relative', zIndex: 1 }}>
          <div
            style={{
              width: '58px',
              height: '58px',
              borderRadius: '16px',
              background: isDetectorOnline
                ? (isDark ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.2)')
                : (isDark ? 'rgba(100,116,139,0.25)' : 'rgba(255,255,255,0.15)'),
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
              flexShrink: 0,
            }}
          >
            {isDetectorOnline ? (
              <Wifi size={28} color={isDark ? '#34d399' : 'white'} />
            ) : (
              <WifiOff size={28} color={isDark ? '#94a3b8' : 'rgba(255,255,255,0.8)'} />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3
                style={{
                  fontSize: '19px',
                  fontWeight: 800,
                  margin: 0,
                  color: isDetectorOnline ? (isDark ? '#34d399' : 'white') : (isDark ? '#94a3b8' : 'white'),
                }}
              >
                {isDetectorOnline
                  ? (isRtl ? 'بوابة الكشف متصلة وتعمل بنجاح' : 'Payment Gateway & Detector Live')
                  : (isRtl ? 'تطبيق الكاشف غير متصل حالياً' : 'Detector Phone Offline')}
              </h3>
              {isDetectorOnline && (
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: isDark ? '#34d399' : 'white',
                    boxShadow: isDark ? '0 0 10px rgba(52,211,153,0.5)' : '0 0 10px rgba(255,255,255,0.6)',
                  }}
                />
              )}
            </div>
            <p
              style={{
                fontSize: '12.5px',
                color: isDetectorOnline
                  ? (isDark ? 'rgba(52,211,153,0.85)' : 'rgba(255,255,255,0.92)')
                  : (isDark ? '#94a3b8' : 'rgba(255,255,255,0.75)'),
                margin: '4px 0 0 0',
              }}
            >
              {isDetectorOnline ? (
                <>
                  {isRtl ? 'المستلم: ' : 'Receiver: '}
                  <strong>{settings?.instapayHandle || 'InstaPay'}</strong>
                  {latestDevice && ` • ${latestDevice.deviceId}`}
                  {timeSinceLastSeen !== null && ` (${timeSinceLastSeen}s heartbeat)`}
                </>
              ) : (
                isRtl
                  ? 'قم بتشغيل تطبيق الكاشف على هاتف الاستقبال لبدء المطابقة الآلية لإيصالات إنستاباي.'
                  : 'Start the Detector Companion app on your receiving phone for instant automatic matching.'
              )}
            </p>
          </div>
        </div>

        {/* Hero Glass Status Metrics */}
        <div style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '10px 18px',
              backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.18)',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.25)',
              textAlign: 'center',
              minWidth: '100px',
            }}
          >
            <div style={{ fontSize: '10.5px', fontWeight: 600, color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {isRtl ? 'إيراد اليوم' : "Today's Vol"}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: isDark ? '#34d399' : 'white', marginTop: '2px' }}>
              {stats?.today?.totalEgp != null ? `${Number(stats.today.totalEgp).toFixed(0)} EGP` : '0 EGP'}
            </div>
          </div>
          <div
            style={{
              padding: '10px 18px',
              backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.18)',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.25)',
              textAlign: 'center',
              minWidth: '100px',
            }}
          >
            <div style={{ fontSize: '10.5px', fontWeight: 600, color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {isRtl ? 'بانتظار الدفع' : 'Pending'}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: isDark ? '#fbbf24' : 'white', marginTop: '2px' }}>
              {stats?.pending?.count ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          title={isRtl ? 'المدفوعات المؤكدة اليوم' : "Today's Confirmed"}
          value={stats?.today?.totalEgp != null ? `${Number(stats.today.totalEgp).toFixed(2)} EGP` : '0.00 EGP'}
          subtitle={stats?.today?.count != null ? (isRtl ? `${stats.today.count} معاملة اليوم` : `${stats.today.count} transactions today`) : 'Loading...'}
          trend="+100%"
          trendUp={true}
          icon={<TrendingUp size={20} />}
          color="#3b82f6"
          isDark={isDark}
        />
        <StatCard
          title={isRtl ? 'إيرادات 7 أيام' : '7-Day Revenue'}
          value={stats?.sevenDays?.totalEgp != null ? `${Number(stats.sevenDays.totalEgp).toFixed(2)} EGP` : '0.00 EGP'}
          subtitle={stats?.sevenDays?.count != null ? (isRtl ? `${stats.sevenDays.count} معاملة مؤكدة` : `${stats.sevenDays.count} confirmed orders`) : 'Loading...'}
          icon={<CreditCard size={20} />}
          color="#10b981"
          isDark={isDark}
        />
        <StatCard
          title={isRtl ? 'في انتظار التحويل' : 'Pending Checkouts'}
          value={stats?.pending?.count != null ? `${stats.pending.count}` : '0'}
          subtitle={isRtl ? 'بانتظار دفع العميل' : 'Awaiting transfer'}
          icon={<AlertCircle size={20} />}
          color="#f59e0b"
          isDark={isDark}
        />
        <StatCard
          title={isRtl ? 'الباقة والحد الشهري' : 'Monthly Plan Quota'}
          value={stats?.quota?.limit != null ? `${stats.quota.count ?? 0} / ${stats.quota.limit}` : 'Trial Plan'}
          subtitle={stats?.quota?.plan || (isRtl ? 'اشتراك نشط' : 'Active Subscription')}
          icon={<Smartphone size={20} />}
          color="#06b6d4"
          isOnline={isDetectorOnline}
          isDark={isDark}
        />
      </div>

      {/* Merchant Setup Checklist Card */}
      <div
        style={{
          ...card({ padding: '24px', marginBottom: '24px' }),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
              📋 {isRtl ? 'قائمة إعداد وتفعيل المتجر' : 'Merchant Go-Live Checklist'}
            </h3>
            <p style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', margin: '4px 0 0 0' }}>
              {isRtl
                ? `أكملت ${checklistCompleted} من أصل ${checklistTotal} خطوات لتشغيل المدفوعات التلقائية بكفاءة`
                : `Completed ${checklistCompleted} of ${checklistTotal} tasks to enable fully automated payment detection`}
            </p>
          </div>
          <div style={{ textAlign: isRtl ? 'left' : 'right' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: checklistCompleted === 4 ? '#10b981' : '#2563eb' }}>
              {checklistPercent}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: '6px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: '9999px', overflow: 'hidden', marginBottom: '16px' }}>
          <div
            style={{
              height: '100%',
              width: `${checklistPercent}%`,
              backgroundColor: checklistCompleted === 4 ? '#10b981' : '#2563eb',
              borderRadius: '9999px',
              transition: 'width 0.4s ease-in-out',
            }}
          />
        </div>

        {/* Checklist Steps Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '12px' }}>
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: hasPaymentUrl
                ? (isDark ? 'rgba(16, 185, 129, 0.12)' : '#f0fdf4')
                : (isDark ? '#162033' : '#f8fafc'),
              border: hasPaymentUrl
                ? (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0')
                : (isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0'),
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <CheckCircle2 size={20} color={hasPaymentUrl ? '#16a34a' : '#94a3b8'} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: isDark ? '#f8fafc' : '#1e293b' }}>
                {isRtl ? '1. رابط إنستاباي الثابت' : '1. Static Payment URL'}
              </div>
              <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                {hasPaymentUrl ? (isRtl ? 'تم الضبط بنجاح' : 'Configured') : (isRtl ? 'اضبطه في الإعدادات' : 'Configure in Settings')}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: hasDetector
                ? (isDark ? 'rgba(16, 185, 129, 0.12)' : '#f0fdf4')
                : (isDark ? '#162033' : '#f8fafc'),
              border: hasDetector
                ? (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0')
                : (isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0'),
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <CheckCircle2 size={20} color={hasDetector ? '#16a34a' : '#94a3b8'} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: isDark ? '#f8fafc' : '#1e293b' }}>
                {isRtl ? '2. ربط تطبيق الكاشف' : '2. Detector APK Connected'}
              </div>
              <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                {hasDetector ? (isRtl ? 'جهاز نشط متصل' : 'Device listening') : (isRtl ? 'حمل وثبت التطبيق' : 'Install companion APK')}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: hasWebhook
                ? (isDark ? 'rgba(16, 185, 129, 0.12)' : '#f0fdf4')
                : (isDark ? '#162033' : '#f8fafc'),
              border: hasWebhook
                ? (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0')
                : (isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0'),
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: onNavigate ? 'pointer' : 'default',
              transition: 'transform 0.15s ease',
            }}
            onClick={() => onNavigate?.('settings', 'Webhooks')}
            title={isRtl ? 'إعدادات الويب هوك' : 'Go to Webhooks Settings'}
          >
            <CheckCircle2 size={20} color={hasWebhook ? '#16a34a' : '#94a3b8'} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: isDark ? '#f8fafc' : '#1e293b' }}>
                {isRtl ? '3. رابط الويب هوك (Webhook)' : '3. Webhook Endpoint'}
              </div>
              <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                {hasWebhook ? (isRtl ? 'مفعل وجاهز للاستقبال' : 'Ready for callbacks') : (isRtl ? 'اختياري للتكامل البرمجي' : 'Optional for auto-fulfill')}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: hasApiKey
                ? (isDark ? 'rgba(16, 185, 129, 0.12)' : '#f0fdf4')
                : (isDark ? '#162033' : '#f8fafc'),
              border: hasApiKey
                ? (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0')
                : (isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0'),
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: onNavigate ? 'pointer' : 'default',
              transition: 'transform 0.15s ease',
            }}
            onClick={() => onNavigate?.('developers')}
            title={isRtl ? 'بوابة المطورين ومفاتيح API' : 'Go to Developers Portal'}
          >
            <CheckCircle2 size={20} color={hasApiKey ? '#16a34a' : '#94a3b8'} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: isDark ? '#f8fafc' : '#1e293b' }}>
                {isRtl ? '4. مفاتيح API والمحاكي' : '4. API Keys & Simulator'}
              </div>
              <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                {hasApiKey ? (isRtl ? 'مفاتيح الربط جاهزة' : 'Keys active') : (isRtl ? 'في انتظار الاعتماد' : 'Awaiting approval')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div
        style={{
          ...card({ padding: '24px', marginBottom: '24px' }),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
              {t('recent_activity') || 'Recent Activity'}
            </h3>
            <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', margin: '2px 0 0 0' }}>
              {isRtl ? 'أحدث المعاملات مع توقيت الدفع ونوع المشتريات' : 'Latest checkouts with exact timestamp and purchase details'}
            </p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('transactions')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#eff6ff',
                color: isDark ? '#38bdf8' : '#2563eb',
                border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bfdbfe',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isRtl ? 'عرض كافة المعاملات' : 'View All Transactions'} →
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#10b981' }} />
            {isRtl ? 'جاري مزامنة المعاملات الأخيرة...' : 'Syncing recent transactions...'}
          </div>
        ) : recentTransactions.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            {isRtl
              ? 'لا توجد معاملات دفع بعد. استخدم بوابة المطورين لتجربة دفع تجريبية!'
              : 'No recent payment activity yet. Use the Developer simulator to test a checkout!'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentTransactions
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((tx, index) => {
                const isConfirmed = tx.status === 'CONFIRMED';
                const purchaseInfo = getPurchaseTypeInfo(tx, isRtl);
                const formattedDate = formatTxDate(tx.createdAt, isRtl);
                const relativeTime = getRelativeTime(tx.createdAt, isRtl);

                return (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      border: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9',
                      gap: '16px',
                      flexWrap: 'wrap',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Left: Counter, Status icon & Transaction Details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px', flex: 1 }}>
                      {/* Counter Badge (#1, #2, ...) */}
                      <div
                        style={{
                          minWidth: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                          color: isDark ? '#94a3b8' : '#64748b',
                          fontSize: '11px',
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                        }}
                        title={isRtl ? `معاملة رقم ${index + 1}` : `Transaction #${index + 1}`}
                      >
                        #{index + 1}
                      </div>

                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          backgroundColor: isConfirmed
                            ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5')
                            : (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'),
                          border: isConfirmed
                            ? (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0')
                            : (isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a'),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                      {isConfirmed ? (
                        <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                      ) : (
                        <Clock size={20} style={{ color: '#f59e0b' }} />
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Line 1: Session ID + Purchase Type Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: isDark ? '#f8fafc' : '#0f172a',
                          }}
                        >
                          {tx.sessionId}
                        </span>

                        {/* Client Purchase Type Badge */}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: tx.purpose === 'SUBSCRIPTION'
                              ? (isDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff')
                              : (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff'),
                            color: tx.purpose === 'SUBSCRIPTION'
                              ? (isDark ? '#c084fc' : '#7e22ce')
                              : (isDark ? '#60a5fa' : '#1d4ed8'),
                            border: tx.purpose === 'SUBSCRIPTION'
                              ? (isDark ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid #e9d5ff')
                              : (isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #dbeafe'),
                          }}
                          title={isRtl ? `نوع المشتريات: ${purchaseInfo.category}` : `Purchase Type: ${purchaseInfo.category}`}
                        >
                          <span>{purchaseInfo.icon}</span>
                          <span>{purchaseInfo.label}</span>
                        </span>
                      </div>

                      {/* Line 2: Sender Handle + Timestamp */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '12px',
                          color: isDark ? '#94a3b8' : '#64748b',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          <strong style={{ color: isDark ? '#cbd5e1' : '#475569' }}>
                            {isRtl ? 'العميل: ' : 'From: '}
                          </strong>
                          {tx.senderHandle || 'customer@instapay'}
                        </span>

                        <span>•</span>

                        {/* Timestamp with Clock Icon */}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: isDark ? '#94a3b8' : '#475569',
                          }}
                          title={formattedDate}
                        >
                          <Clock size={12} style={{ color: '#0ea5e9' }} />
                          <span style={{ fontWeight: 500 }}>{formattedDate}</span>
                          {relativeTime && (
                            <span style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: '11px' }}>
                              ({relativeTime})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Status Badge & Checkout link */}
                  <div style={{ textAlign: isRtl ? 'left' : 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 800,
                        color: isDark ? '#f8fafc' : '#0f172a',
                        marginBottom: '4px',
                      }}
                    >
                      {tx.amountEgp.toFixed(2)} EGP
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: isRtl ? 'flex-start' : 'flex-end' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          letterSpacing: '0.02em',
                          backgroundColor: isConfirmed
                            ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5')
                            : (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'),
                          color: isConfirmed ? '#10b981' : '#f59e0b',
                          border: isConfirmed
                            ? (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0')
                            : (isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a'),
                        }}
                      >
                        {tx.status}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTx(tx);
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#f0f9ff',
                          border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd',
                          color: isDark ? '#38bdf8' : '#0284c7',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        title={isRtl ? 'عرض إيصال وتفاصيل المعاملة' : 'View Transaction Receipt & Details'}
                      >
                        <Eye size={13} />
                        <span>{isRtl ? 'الإيصال' : 'Receipt'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Transaction Receipt & Details Modal ─── */}
      {selectedTx && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
          }}
          onClick={() => setSelectedTx(null)}
        >
          <div
            style={{
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderRadius: '20px',
              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              color: isDark ? '#f8fafc' : '#0f172a',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                    color: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID' ? '#10b981' : '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                    {isRtl ? 'إيصال وتفاصيل المعاملة' : 'Transaction Receipt & Details'}
                  </h3>
                  <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', margin: '2px 0 0 0' }}>
                    {isRtl ? 'بيانات العملية المسجلة في بوابة الدفع' : 'Gateway recorded transaction details'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTx(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  color: isDark ? '#94a3b8' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Hero Amount & Status Box */}
            <div
              style={{
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center',
                marginBottom: '20px',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  marginBottom: '8px',
                  backgroundColor: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(245, 158, 11, 0.15)',
                  color: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID' ? '#10b981' : '#f59e0b',
                }}
              >
                {(selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID') && <CheckCircle2 size={12} />}
                {selectedTx.status}
              </span>

              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  color: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID' ? '#10b981' : (isDark ? '#f8fafc' : '#0f172a'),
                  fontFamily: 'monospace',
                }}
              >
                {selectedTx.amountEgp.toFixed(2)} <span style={{ fontSize: '16px', fontWeight: 700 }}>EGP</span>
              </div>

              <p style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', margin: '4px 0 0 0' }}>
                {getPurchaseTypeInfo(selectedTx, isRtl).label}
              </p>
            </div>

            {/* Detailed Key-Value Rows */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '13px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'معرف الجلسة:' : 'Session ID:'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <code style={{ fontFamily: 'monospace', fontSize: '12px', color: isDark ? '#38bdf8' : '#0284c7' }}>
                    {selectedTx.sessionId}
                  </code>
                  <button
                    onClick={() => {
                      if (navigator?.clipboard?.writeText) {
                        navigator.clipboard.writeText(selectedTx.sessionId);
                      }
                      setCopiedSessionId(true);
                      setTimeout(() => setCopiedSessionId(false), 2000);
                    }}
                    title="Copy Session ID"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b', display: 'inline-flex', alignItems: 'center' }}
                  >
                    {copiedSessionId ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {selectedTx.detectedRef && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'رقم الإشعار المرجعي:' : 'InstaPay Ref ID:'}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#10b981' }}>
                    {selectedTx.detectedRef}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'حساب العميل الراسل:' : 'Sender InstaPay Handle:'}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {selectedTx.senderHandle || '—'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'حساب المتجر المستلم:' : 'Merchant Recipient IPA:'}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {selectedTx.recipientHandle || settings?.instapayHandle || '—'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'تصنيف المعاملة:' : 'Purchase Category:'}</span>
                <span style={{ fontWeight: 600 }}>
                  {getPurchaseTypeInfo(selectedTx, isRtl).category}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'توقيت الإنشاء:' : 'Created Time:'}</span>
                <span>{formatTxDate(selectedTx.createdAt, isRtl)}</span>
              </div>

              {selectedTx.detectedAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'توقيت التأكيد:' : 'Verified Time:'}</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>{formatTxDate(selectedTx.detectedAt, isRtl)}</span>
                </div>
              )}

              {selectedTx.note && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'ملاحظة الطلب:' : 'Order Note:'}</span>
                  <span>{selectedTx.note}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                  color: isDark ? '#f8fafc' : '#334155',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <Printer size={15} />
                <span>{isRtl ? 'طباعة الإيصال' : 'Print Receipt'}</span>
              </button>

              <button
                onClick={() => setSelectedTx(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                }}
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendUp,
  icon,
  color,
  isOnline,
  isDark,
}: {
  title: string;
  value: string;
  subtitle: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  color: string;
  isOnline?: boolean;
  isDark?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderRadius: '20px',
        border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0',
        padding: '22px',
        boxShadow: isDark
          ? '0 10px 25px -5px rgba(0,0,0,0.45), 0 8px 10px -6px rgba(0,0,0,0.3)'
          : '0 4px 16px rgba(0,0,0,0.06)',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: isDark ? `${color}20` : `${color}15`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: isDark ? `1px solid ${color}35` : `1px solid ${color}25`,
            boxShadow: `0 4px 12px ${color}20`,
          }}
        >
          {icon}
        </div>
        {isOnline && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981' }}>Live</span>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 0 4px rgba(16,185,129,0.2)',
              }}
            />
          </div>
        )}
      </div>
      <div>
        <p style={{ fontSize: '24px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>{value}</p>
        <p style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', margin: '5px 0 0 0', fontWeight: 500 }}>{subtitle}</p>
      </div>
    </div>
  );
}
