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
import { transactionsApi } from '../services/api';

interface OverviewPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function OverviewPage({ showToast }: OverviewPageProps) {
  const [stats, setStats] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [statsData, txData] = await Promise.all([
          transactionsApi.getStats(),
          transactionsApi.list({ limit: 5 }),
        ]);

        if (statsData.ok && statsData.stats) {
          setStats(statsData.stats);
        }
        if (txData.ok && txData.transactions) {
          setRecentTransactions(txData.transactions);
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

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Dashboard Overview</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Monitor your live InstaPay payment gateway</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          title="Today's Confirmed"
          value={stats ? `${stats.today.totalEgp.toFixed(2)} EGP` : '0.00 EGP'}
          subtitle={stats ? `${stats.today.count} transactions today` : 'Loading...'}
          trend="+100%"
          trendUp={true}
          icon={<TrendingUp className="w-5 h-5" />}
          color="#3b82f6"
        />
        <StatCard
          title="7-Day Revenue"
          value={stats ? `${stats.sevenDays.totalEgp.toFixed(2)} EGP` : '0.00 EGP'}
          subtitle={stats ? `${stats.sevenDays.count} confirmed orders` : 'Loading...'}
          icon={<CreditCard className="w-5 h-5" />}
          color="#10b981"
        />
        <StatCard
          title="Pending Checkouts"
          value={stats ? `${stats.pending.count}` : '0'}
          subtitle="Awaiting transfer"
          icon={<AlertCircle className="w-5 h-5" />}
          color="#f59e0b"
        />
        <StatCard
          title="Monthly Plan Quota"
          value={stats?.quota ? `${stats.quota.count} / ${stats.quota.limit}` : 'Trial Plan'}
          subtitle={stats?.quota?.plan || 'Active Subscription'}
          icon={<Smartphone className="w-5 h-5" />}
          color="#06b6d4"
          isOnline
        />
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
