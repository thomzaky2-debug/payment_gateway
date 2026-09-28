import React from 'react';
import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Smartphone,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export function OverviewPage() {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Dashboard Overview</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Monitor your payment gateway performance</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          title="Total Revenue"
          value="12,450.00 EGP"
          subtitle="This month"
          trend="+12.5%"
          trendUp={true}
          icon={<TrendingUp className="w-5 h-5" />}
          color="#3b82f6"
        />
        <StatCard
          title="Pending Reviews"
          value="3"
          subtitle="Requires attention"
          icon={<AlertCircle className="w-5 h-5" />}
          color="#f59e0b"
        />
        <StatCard
          title="Total Checkouts"
          value="142"
          subtitle="All time"
          trend="+8.2%"
          trendUp={true}
          icon={<CreditCard className="w-5 h-5" />}
          color="#10b981"
        />
        <StatCard
          title="Detector Status"
          value="Online"
          subtitle="Last seen 2 min ago"
          icon={<Smartphone className="w-5 h-5" />}
          color="#06b6d4"
          isOnline
        />
      </div>

      {/* Recent Transactions */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>Recent Transactions</h3>
          <button style={{ fontSize: '14px', color: '#2563eb', fontWeight: 500, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>
            View All
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { id: 'ORD-7842', amount: '150.00', sender: 'ahmed@instapay', status: 'PAID', time: '2 min ago' },
            { id: 'ORD-7841', amount: '89.50', sender: 'sara.m@instapay', status: 'PAID', time: '15 min ago' },
            { id: 'ORD-7840', amount: '250.00', sender: 'youssef@instapay', status: 'NEEDS_REVIEW', time: '32 min ago' },
            { id: 'ORD-7839', amount: '75.00', sender: 'nour@instapay', status: 'PENDING', time: '1 hr ago' },
            { id: 'ORD-7838', amount: '320.00', sender: 'khaled@instapay', status: 'PAID', time: '2 hrs ago' },
          ].map((tx) => (
            <div key={tx.id} style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', borderRadius: '12px', transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '12px',
                  backgroundColor: tx.status === 'PAID' ? '#d1fae5' : tx.status === 'NEEDS_REVIEW' ? '#fed7aa' : '#fef3c7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {tx.status === 'PAID' ? <CheckCircle2 className="w-5 h-5" style={{ color: '#059669' }} /> :
                   tx.status === 'NEEDS_REVIEW' ? <AlertCircle className="w-5 h-5" style={{ color: '#ea580c' }} /> :
                   <Clock className="w-5 h-5" style={{ color: '#d97706' }} />}
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
    <div style={{ 
      backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', 
      padding: '20px', transition: 'all 0.3s', cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'translateY(0)';
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
          <span style={{ fontSize: '12px', fontWeight: 500, color: trendUp ? '#059669' : '#dc2626' }}>
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
