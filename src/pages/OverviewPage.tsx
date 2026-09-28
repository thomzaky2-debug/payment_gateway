import React, { useState } from 'react';
import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Smartphone,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  DollarSign,
  Users,
  Zap,
} from 'lucide-react';

interface OverviewPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

const revenueData = [
  { day: 'Mon', revenue: 4200, transactions: 12 },
  { day: 'Tue', revenue: 3800, transactions: 10 },
  { day: 'Wed', revenue: 5100, transactions: 15 },
  { day: 'Thu', revenue: 4600, transactions: 13 },
  { day: 'Fri', revenue: 6200, transactions: 18 },
  { day: 'Sat', revenue: 7800, transactions: 22 },
  { day: 'Sun', revenue: 5400, transactions: 16 },
];

const recentTransactions = [
  { id: 'ORD-7842', amount: '150.00', sender: 'ahmed@instapay', status: 'PAID', time: '2 min ago' },
  { id: 'ORD-7841', amount: '89.50', sender: 'sara.m@instapay', status: 'PAID', time: '15 min ago' },
  { id: 'ORD-7840', amount: '250.00', sender: 'youssef@instapay', status: 'NEEDS_REVIEW', time: '32 min ago' },
  { id: 'ORD-7839', amount: '75.00', sender: 'nour@instapay', status: 'PENDING', time: '1 hr ago' },
  { id: 'ORD-7838', amount: '320.00', sender: 'khaled@instapay', status: 'PAID', time: '2 hrs ago' },
];

export function OverviewPage({ showToast }: OverviewPageProps = {}) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  const maxRevenue = Math.max(...revenueData.map(d => d.revenue));

  const handleStatClick = (stat: string) => {
    showToast?.('info', `Viewing ${stat} details...`);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Title with Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Dashboard Overview</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Monitor your payment gateway performance</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => showToast?.('info', 'Creating new checkout...')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', backgroundColor: '#2563eb', color: 'white',
              fontSize: '14px', fontWeight: 500, borderRadius: '12px',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 10px 15px -3px rgba(37,99,235,0.2)',
            }}
          >
            <Zap size={16} />
            New Checkout
          </button>
          <button
            onClick={() => showToast?.('success', 'Report downloaded!')}
            style={{
              padding: '10px 20px', backgroundColor: 'white', color: '#475569',
              fontSize: '14px', fontWeight: 500, borderRadius: '12px',
              border: '1px solid #e2e8f0', cursor: 'pointer',
            }}
          >
            📊 Export Report
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          title="Total Revenue"
          value="12,450.00 EGP"
          subtitle="This month"
          trend="+12.5%"
          trendUp={true}
          icon={<DollarSign size={20} />}
          color="#3b82f6"
          onClick={() => handleStatClick('Revenue')}
          isHovered={hoveredStat === 'revenue'}
          onHover={(h) => setHoveredStat(h ? 'revenue' : null)}
        />
        <StatCard
          title="Pending Reviews"
          value="3"
          subtitle="Requires attention"
          icon={<AlertCircle size={20} />}
          color="#f59e0b"
          onClick={() => handleStatClick('Pending Reviews')}
          isHovered={hoveredStat === 'pending'}
          onHover={(h) => setHoveredStat(h ? 'pending' : null)}
        />
        <StatCard
          title="Total Checkouts"
          value="142"
          subtitle="All time"
          trend="+8.2%"
          trendUp={true}
          icon={<CreditCard size={20} />}
          color="#10b981"
          onClick={() => handleStatClick('Checkouts')}
          isHovered={hoveredStat === 'checkouts'}
          onHover={(h) => setHoveredStat(h ? 'checkouts' : null)}
        />
        <StatCard
          title="Detector Status"
          value="Online"
          subtitle="Last seen 2 min ago"
          icon={<Smartphone size={20} />}
          color="#06b6d4"
          isOnline
          onClick={() => handleStatClick('Detector')}
          isHovered={hoveredStat === 'detector'}
          onHover={(h) => setHoveredStat(h ? 'detector' : null)}
        />
      </div>

      {/* Revenue Chart */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Revenue Overview</h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Weekly transaction volume</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['week', 'month', 'year'] as const).map((period) => (
              <button
                key={period}
                onClick={() => {
                  setSelectedPeriod(period);
                  showToast?.('info', `Switched to ${period} view`);
                }}
                style={{
                  padding: '6px 14px', fontSize: '13px', fontWeight: 500,
                  borderRadius: '8px', border: 'none', cursor: 'pointer',
                  backgroundColor: selectedPeriod === period ? '#2563eb' : '#f1f5f9',
                  color: selectedPeriod === period ? 'white' : '#475569',
                }}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Simple Bar Chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '200px', padding: '0 8px' }}>
          {revenueData.map((data, index) => (
            <div
              key={data.day}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${(data.revenue / maxRevenue) * 100}%`,
                  background: `linear-gradient(180deg, #3b82f6 0%, #60a5fa 100%)`,
                  borderRadius: '8px 8px 0 0',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                title={`${data.day}: ${data.revenue} EGP`}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scaleY(1.05)';
                  e.currentTarget.style.boxShadow = '0 -10px 20px -5px rgba(59,130,246,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scaleY(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{data.day}</span>
            </div>
          ))}
        </div>

        {/* Chart Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'linear-gradient(180deg, #3b82f6, #60a5fa)' }} />
            <span style={{ fontSize: '13px', color: '#64748b' }}>Revenue (EGP)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={14} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '13px', color: '#64748b' }}>Total: 36,700 EGP</span>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Recent Transactions</h3>
          <button
            onClick={() => showToast?.('info', 'Viewing all transactions...')}
            style={{ fontSize: '14px', color: '#2563eb', fontWeight: 500, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
          >
            View All →
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {recentTransactions.map((tx) => (
            <div
              key={tx.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px', borderRadius: '12px', transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
              onClick={() => showToast?.('info', `Viewing transaction ${tx.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  backgroundColor: tx.status === 'PAID' ? '#d1fae5' : tx.status === 'NEEDS_REVIEW' ? '#fed7aa' : '#fef3c7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {tx.status === 'PAID' ? <CheckCircle2 size={20} style={{ color: '#059669' }} /> :
                   tx.status === 'NEEDS_REVIEW' ? <AlertCircle size={20} style={{ color: '#ea580c' }} /> :
                   <Clock size={20} style={{ color: '#d97706' }} />}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', margin: 0 }}>{tx.id}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{tx.sender}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: 0 }}>{tx.amount} EGP</p>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', fontSize: '12px', fontWeight: 500, borderRadius: '9999px',
                  backgroundColor: tx.status === 'PAID' ? '#d1fae5' : tx.status === 'NEEDS_REVIEW' ? '#fed7aa' : '#fef3c7',
                  color: tx.status === 'PAID' ? '#047857' : tx.status === 'NEEDS_REVIEW' ? '#c2410c' : '#b45309'
                }}>
                  {tx.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
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
  onClick,
  isHovered,
  onHover,
}: {
  title: string;
  value: string;
  subtitle: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  color: string;
  isOnline?: boolean;
  onClick?: () => void;
  isHovered?: boolean;
  onHover?: (hovered: boolean) => void;
}) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      style={{
        backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0',
        padding: '20px', transition: 'all 0.3s', cursor: onClick ? 'pointer' : 'default',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 20px 25px -5px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          backgroundColor: `${color}20`, color: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {icon}
        </div>
        {trend && (
          <span style={{ fontSize: '12px', fontWeight: 500, color: trendUp ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', gap: '2px' }}>
            {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </span>
        )}
        {isOnline && (
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            backgroundColor: '#10b981',
            animation: 'pulseGreen 2s ease-in-out infinite'
          }} />
        )}
      </div>
      <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{value}</p>
      <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>{subtitle}</p>
    </div>
  );
}
