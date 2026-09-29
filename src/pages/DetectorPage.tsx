import React, { useState, useEffect } from 'react';
import { Smartphone, CheckCircle2, AlertTriangle, Wifi, Battery, Clock, Download, RefreshCw } from 'lucide-react';
import { settingsApi } from '../services/api';

interface DetectorPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function DetectorPage({ showToast }: DetectorPageProps) {
  const [devices, setDevices] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetectorData = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.get();
      if (data.ok) {
        setDevices(data.devices || []);
        setSettings(data.settings || null);
      }
    } catch (err: any) {
      if (showToast) {
        showToast('error', 'Failed to load detector heartbeat data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetectorData();
  }, []);

  const latestDevice = devices.length > 0 ? devices[0] : null;
  const isOnline = latestDevice && (Date.now() - new Date(latestDevice.lastSeenAt).getTime()) < 10 * 60 * 1000;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Detector Companion</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Monitor your Android detector device running NotificationListenerService</p>
        </div>
        <button
          onClick={fetchDetectorData}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: 'white',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Status
        </button>
      </div>

      {/* Status Banner */}
      <div style={{ 
        background: isOnline ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #64748b, #475569)',
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
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                {isOnline ? 'Detector Phone Connected' : 'No Active Heartbeat Detected'}
              </h3>
              {isOnline && (
                <div style={{ 
                  width: '10px', height: '10px', borderRadius: '50%', 
                  backgroundColor: 'white',
                  animation: 'pulseGreen 2s ease-in-out infinite'
                }} />
              )}
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', margin: '4px 0 0 0' }}>
              {latestDevice
                ? `Last seen: ${new Date(latestDevice.lastSeenAt).toLocaleTimeString()} (${latestDevice.deviceId})`
                : 'Install the companion APK on your receiving phone to start automatic payment detection.'}
            </p>
          </div>
        </div>
      </div>

      {/* APK Setup Guide & Download Box */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px 0' }}>📲 Detector Companion Setup</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              The native Android Detector APK runs in the background on your payment phone, captures official Egyptian banks InstaPay push receipts, and reports them to your gateway.
            </p>
          </div>
          <a
            href="/api/apks/detector"
            download="InstaPay-Detector.apk"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 22px',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '14px',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
              cursor: 'pointer',
            }}
          >
            <Download size={18} />
            Download Detector APK (v2.0)
          </a>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px 0' }}>1. Download APK</h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              Click the download button above or download <strong>InstaPay-Detector.apk</strong> directly to your Android device and install it.
            </p>
          </div>

          <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px 0' }}>2. Login with Credentials</h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              Sign in with your merchant email and password to securely link the device token.
            </p>
          </div>

          <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px 0' }}>3. Enable Notification Access</h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              Grant "Notification Listener Permission" when prompted so the listener can parse receipts.
            </p>
          </div>
        </div>
      </div>

      {/* Device Info */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0' }}>🖥️ Device & Integration Info</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <InfoRow label="Merchant Handle" value={settings?.instapayHandle || 'Not set'} />
          <InfoRow label="App Version" value={latestDevice?.appVersion || '2.0.0'} />
          <InfoRow label="Android Version" value={latestDevice?.androidVersion || 'Android 12+'} />
          <InfoRow label="Target Package" value="com.egyptianbanks.instapay" />
          <InfoRow label="Detector Token Status" value={settings?.detectToken ? 'Configured & Active' : 'Pending Approval'} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: '13px', color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}
