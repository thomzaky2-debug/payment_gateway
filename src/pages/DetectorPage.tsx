import React, { useState } from 'react';
import { Smartphone, CheckCircle2, AlertTriangle, Wifi, Battery, Clock, RefreshCw, Download, Shield } from 'lucide-react';

interface DetectorPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function DetectorPage({ showToast }: DetectorPageProps = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefresh(new Date());
      showToast?.('success', 'Detector status refreshed! All systems operational.');
    }, 1500);
  };

  const handleDownloadApk = () => {
    showToast?.('info', 'Preparing APK download...');
    setTimeout(() => {
      showToast?.('success', 'APK download started! (instapay-detector-v2.0.0.apk)');
    }, 800);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Detector Health</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Monitor your Android detector device and notification listener</p>
      </div>

      {/* Status Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981, #14b8a6)',
        borderRadius: '16px', padding: '24px', color: 'white', marginBottom: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Smartphone size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Detector Online</h3>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'white', animation: 'pulseGreen 2s ease-in-out infinite' }} />
            </div>
            <p style={{ fontSize: '14px', color: '#d1fae5', margin: 0 }}>
              Last heartbeat: {Math.floor((Date.now() - lastRefresh.getTime()) / 60000)} min ago
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            color: 'white', fontSize: '14px', fontWeight: 500, borderRadius: '12px',
            border: 'none', cursor: isRefreshing ? 'not-allowed' : 'pointer',
            opacity: isRefreshing ? 0.7 : 1,
          }}
        >
          <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Health Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <MetricCard icon={<Wifi size={20} />} label="Listener Status" value="Active" color="#10b981" status="good" />
        <MetricCard icon={<Battery size={20} />} label="Battery Optimization" value="Exempt" color="#10b981" status="good" />
        <MetricCard icon={<Clock size={20} />} label="Uptime" value="14h 32m" color="#3b82f6" status="neutral" />
        <MetricCard icon={<span style={{ fontSize: '20px' }}>📊</span>} label="Notifications Today" value="23" color="#06b6d4" status="neutral" />
      </div>

      {/* Device Info & Heartbeat */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Device Info */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0' }}>🖥️ Device Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {[
              { label: 'Device Name', value: 'Samsung Galaxy A54' },
              { label: 'Android Version', value: '14 (API 34)' },
              { label: 'Min SDK Supported', value: 'Android 8.0 (API 26)' },
              { label: 'App Version', value: '2.0.0' },
              { label: 'Package Name', value: 'com.instapaydetector.merchant' },
              { label: 'InstaPay Package', value: 'com.egyptianbanks.instapay' },
              { label: 'Recipient Handle', value: 'merchant@instapay' },
              { label: 'Device ID', value: 'dev_a1b2c3d4e5' },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{row.label}</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b', fontFamily: 'monospace' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Heartbeat Timeline */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0' }}>💓 Heartbeat History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { time: '14:32', status: 'success', message: 'Heartbeat received - All systems OK' },
              { time: '14:17', status: 'success', message: 'Heartbeat received - All systems OK' },
              { time: '14:02', status: 'success', message: 'Heartbeat received - All systems OK' },
              { time: '13:47', status: 'success', message: 'Heartbeat received - All systems OK' },
              { time: '13:32', status: 'warning', message: 'Delayed heartbeat - 18 min gap' },
              { time: '13:14', status: 'success', message: 'Heartbeat received - All systems OK' },
            ].map((hb, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: hb.status === 'success' ? '#10b981' : '#f59e0b',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hb.message}</p>
                </div>
                <span style={{ fontSize: '12px', color: '#94a3b8', flexShrink: 0 }}>{hb.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* APK Setup */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={18} style={{ color: '#2563eb' }} />
          Detector APK Setup
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { num: 1, title: 'Download APK', desc: 'Get the latest detector APK', icon: <Download size={20} /> },
            { num: 2, title: 'Grant Permissions', desc: 'Enable notification access', icon: <Shield size={20} /> },
            { num: 3, title: 'Configure Token', desc: 'Enter your detect token', icon: <CheckCircle2 size={20} /> },
          ].map((step) => (
            <div key={step.num} style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '12px', right: '12px', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#2563eb', color: 'white', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {step.num}
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                {step.icon}
              </div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: '0 0 4px 0' }}>{step.title}</h4>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{step.desc}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleDownloadApk}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 24px', backgroundColor: '#2563eb', color: 'white',
            fontSize: '14px', fontWeight: 500, borderRadius: '12px',
            border: 'none', cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgba(37,99,235,0.2)',
          }}
        >
          <Download size={16} />
          Download Detector APK (v2.0.0)
        </button>
      </div>

      {/* OEM Warning */}
      <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', margin: '0 0 8px 0' }}>OEM Battery Protection</h4>
            <p style={{ fontSize: '12px', color: '#78350f', margin: '0 0 8px 0' }}>Some manufacturers aggressively kill background apps. Ensure you:</p>
            <ul style={{ fontSize: '12px', color: '#78350f', margin: 0, paddingLeft: '16px', lineHeight: 1.8 }}>
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

function MetricCard({ icon, label, value, color, status }: { icon: React.ReactNode; label: string; value: string; color: string; status: 'good' | 'bad' | 'neutral' }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          backgroundColor: `${color}20`, color: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        {status === 'good' && <CheckCircle2 size={16} style={{ color: '#10b981' }} />}
        {status === 'bad' && <AlertTriangle size={16} style={{ color: '#ef4444' }} />}
      </div>
      <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{value}</p>
      <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>{label}</p>
    </div>
  );
}
