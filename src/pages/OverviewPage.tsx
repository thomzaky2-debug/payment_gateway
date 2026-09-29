import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Smartphone,
  CheckCircle2,
  Clock,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { transactionsApi, settingsApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface OverviewPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function OverviewPage({ showToast }: OverviewPageProps) {
  const { t, isRtl } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
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
      } catch (err: any) {
        if (showToast) {
          showToast('error', 'Could not refresh dashboard statistics');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Compute checklist progress
  const hasPaymentUrl = !!settings?.instapayPaymentUrl;
  const hasDetector = devices.length > 0;
  const hasWebhook = !!settings?.webhookUrl;
  const hasApiKey = !!settings?.apiKey;
  const checklistTotal = 4;
  const checklistCompleted = [hasPaymentUrl, hasDetector, hasWebhook, hasApiKey].filter(Boolean).length;
  const checklistPercent = Math.round((checklistCompleted / checklistTotal) * 100);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
          {isRtl ? 'لوحة التحكم الرئيسية' : 'Dashboard Overview'}
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
          {isRtl ? 'متابعة بوابة الدفع والعمليات المباشرة عبر إنستاباي' : 'Monitor your live InstaPay payment gateway'}
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          title={isRtl ? 'المدفوعات المؤكدة اليوم' : "Today's Confirmed"}
          value={stats?.today?.totalEgp != null ? `${Number(stats.today.totalEgp).toFixed(2)} EGP` : '0.00 EGP'}
          subtitle={stats?.today?.count != null ? (isRtl ? `${stats.today.count} معاملة اليوم` : `${stats.today.count} transactions today`) : 'Loading...'}
          trend="+100%"
          trendUp={true}
          icon={<TrendingUp className="w-5 h-5" />}
          color="#3b82f6"
        />
        <StatCard
          title={isRtl ? 'إيرادات 7 أيام' : '7-Day Revenue'}
          value={stats?.sevenDays?.totalEgp != null ? `${Number(stats.sevenDays.totalEgp).toFixed(2)} EGP` : '0.00 EGP'}
          subtitle={stats?.sevenDays?.count != null ? (isRtl ? `${stats.sevenDays.count} معاملة مؤكدة` : `${stats.sevenDays.count} confirmed orders`) : 'Loading...'}
          icon={<CreditCard className="w-5 h-5" />}
          color="#10b981"
        />
        <StatCard
          title={isRtl ? 'في انتظار التحويل' : 'Pending Checkouts'}
          value={stats?.pending?.count != null ? `${stats.pending.count}` : '0'}
          subtitle={isRtl ? 'بانتظار دفع العميل' : 'Awaiting transfer'}
          icon={<AlertCircle className="w-5 h-5" />}
          color="#f59e0b"
        />
        <StatCard
          title={isRtl ? 'الباقة والحد الشهري' : 'Monthly Plan Quota'}
          value={stats?.quota?.limit != null ? `${stats.quota.count ?? 0} / ${stats.quota.limit}` : 'Trial Plan'}
          subtitle={stats?.quota?.plan || (isRtl ? 'اشتراك نشط' : 'Active Subscription')}
          icon={<Smartphone className="w-5 h-5" />}
          color="#06b6d4"
          isOnline
        />
      </div>

      {/* Merchant Setup Checklist Card */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              📋 {isRtl ? 'قائمة إعداد وتفعيل المتجر' : 'Merchant Go-Live Checklist'}
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
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
        <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden', marginBottom: '16px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: hasPaymentUrl ? '#f0fdf4' : '#f8fafc',
              border: hasPaymentUrl ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <CheckCircle2 size={20} color={hasPaymentUrl ? '#16a34a' : '#94a3b8'} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                {isRtl ? '1. رابط إنستاباي الثابت' : '1. Static Payment URL'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {hasPaymentUrl ? (isRtl ? 'تم الضبط بنجاح' : 'Configured') : (isRtl ? 'اضبطه في الإعدادات' : 'Configure in Settings')}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: hasDetector ? '#f0fdf4' : '#f8fafc',
              border: hasDetector ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <CheckCircle2 size={20} color={hasDetector ? '#16a34a' : '#94a3b8'} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                {isRtl ? '2. ربط تطبيق الكاشف' : '2. Detector APK Connected'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {hasDetector ? (isRtl ? 'جهاز نشط متصل' : 'Device listening') : (isRtl ? 'حمل وثبت التطبيق' : 'Install companion APK')}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: hasWebhook ? '#f0fdf4' : '#f8fafc',
              border: hasWebhook ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <CheckCircle2 size={20} color={hasWebhook ? '#16a34a' : '#94a3b8'} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                {isRtl ? '3. رابط الويب هوك (Webhook)' : '3. Webhook Endpoint'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {hasWebhook ? (isRtl ? 'مفعل وجاهز للاستقبال' : 'Ready for callbacks') : (isRtl ? 'اختياري للتكامل البرمجي' : 'Optional for auto-fulfill')}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: hasApiKey ? '#f0fdf4' : '#f8fafc',
              border: hasApiKey ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <CheckCircle2 size={20} color={hasApiKey ? '#16a34a' : '#94a3b8'} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                {isRtl ? '4. مفاتيح API والمحاكي' : '4. API Keys & Simulator'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {hasApiKey ? (isRtl ? 'مفاتيح الربط جاهزة' : 'Keys active') : (isRtl ? 'في انتظار الاعتماد' : 'Awaiting approval')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>Recent Activity</h3>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#10b981' }} />
            Syncing recent transactions...
          </div>
        ) : recentTransactions.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            No recent payment activity yet. Use the Developer simulator to test a checkout!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: tx.status === 'CONFIRMED' ? '#d1fae5' : '#fef3c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {tx.status === 'CONFIRMED' ? (
                      <CheckCircle2 size={18} style={{ color: '#059669' }} />
                    ) : (
                      <Clock size={18} style={{ color: '#d97706' }} />
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                      {tx.sessionId}
                    </p>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                      From: {tx.senderHandle}
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {tx.amountEgp.toFixed(2)} EGP
                  </p>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      backgroundColor: tx.status === 'CONFIRMED' ? '#d1fae5' : '#fef3c7',
                      color: tx.status === 'CONFIRMED' ? '#047857' : '#b45309',
                    }}
                  >
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
}: {
  title: string;
  value: string;
  subtitle: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  color: string;
  isOnline?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: `${color}15`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
        {isOnline && (
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 0 4px rgba(16,185,129,0.2)',
            }}
          />
        )}
      </div>
      <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{value}</p>
      <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>{subtitle}</p>
    </div>
  );
}
