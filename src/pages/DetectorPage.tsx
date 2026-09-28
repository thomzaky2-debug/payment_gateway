import React from 'react';
import { Smartphone, CheckCircle2, AlertTriangle, Wifi, Battery, Clock } from 'lucide-react';

export function DetectorPage() {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Detector Health</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Monitor your Android detector device</p>
      </div>

      {/* Status Banner */}
      <div style={{ 
        background: 'linear-gradient(135deg, #10b981, #14b8a6)',
        borderRadius: '16px', padding: '24px', color: 'white', marginBottom: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            width: '56px', height: '56px', borderRadius: '16px',
            backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Smartphone size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Detector Online</h3>
              <div style={{ 
                width: '12px', height: '12px', borderRadius: '50%', 
                backgroundColor: 'white',
                animation: 'pulseGreen 2s ease-in-out infinite'
              }} />
            </div>
            <p style={{ fontSize: '14px', color: '#d1fae5', margin: 0 }}>Last heartbeat: 2 minutes ago</p>
          </div>
        </div>
        <button style={{ 
          padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
          color: 'white', fontSize: '14px', fontWeight: 500, borderRadius: '12px',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          🔄 Refresh
        </button>
      </div>

      {/* Health Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <MetricCard icon={<Wifi size={20} />} label="Listener Status" value="Active" color="#10b981" />
        <MetricCard icon={<Battery size={20} />} label="Battery Optimization" value="Exempt" color="#10b981" />
        <MetricCard icon={<Clock size={20} />} label="Uptime" value="14h 32m" color="#3b82f6" />
        <MetricCard icon={<span style={{ fontSize: '20px' }}>📊</span>} label="Notifications Today" value="23" color="#06b6d4" />
      </div>

      {/* Device Info */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0' }}>🖥️ Device Information</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <InfoRow label="Device Name" value="Samsung Galaxy A54" />
          <InfoRow label="Android Version" value="14 (API 34)" />
          <InfoRow label="Min SDK Supported" value="Android 8.0 (API 26)" />
          <InfoRow label="App Version" value="2.0.0" />
          <InfoRow label="Package Name" value="com.instapaydetector.merchant" />
          <InfoRow label="InstaPay Package" value="com.egyptianbanks.instapay" />
          <InfoRow label="Recipient Handle" value="merchant@instapay" />
        </div>
      </div>

      {/* OEM Warning */}
      <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', margin: '0 0 8px 0' }}>OEM Battery Protection</h4>
            <p style={{ fontSize: '12px', color: '#78350f', margin: '0 0 8px 0' }}>Some manufacturers aggressively kill background apps. Ensure you:</p>
            <ul style={{ fontSize: '12px', color: '#78350f', margin: 0, paddingLeft: '16px' }}>
              <li><strong>Xiaomi/Redmi:</strong> Enable auto-start in Security app</li>
              <li><strong>Samsung:</strong> Disable battery optimization in Device Care</li>
              <li><strong>Huawei/Honor:</strong> Add to "Launch Manager" whitelist</li>
              <li><strong>Oppo/Realme:</strong> Enable auto-start in Battery settings</li>
              <li><strong>Vivo:</strong> Allow background activity in iManager</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ 
          width: '40px', height: '40px', borderRadius: '12px',
          backgroundColor: `${color}20`, color: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {icon}
        </div>
        <CheckCircle2 size={16} style={{ color: '#10b981' }} />
      </div>
      <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{value}</p>
      <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: '14px', color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}
