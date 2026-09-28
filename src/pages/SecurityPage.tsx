import React from 'react';
import { useState } from 'react';
import { Shield, Key, Globe, Lock, Smartphone, AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type { ConfirmAction } from '../App';

interface SecurityPageProps {
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showConfirm: (action: Omit<ConfirmAction, 'id'>) => void;
}

export function SecurityPage({ showToast, showConfirm }: SecurityPageProps) {
  const [twoFAEnabled, setTwoFAEnabled] = useState(true);
  const [ipWhitelist, setIpWhitelist] = useState([
    { id: 1, ip: '197.45.123.45', label: 'Office - Cairo', addedAt: '2026-09-01' },
    { id: 2, ip: '41.33.55.77', label: 'Home - Alex', addedAt: '2026-08-15' },
  ]);
  const [newIp, setNewIp] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [rateLimit, setRateLimit] = useState('100');
  const [sessionTimeout, setSessionTimeout] = useState('30');

  const handleAddIp = () => {
    if (!newIp || !newLabel) {
      showToast('error', 'Please fill in both IP address and label');
      return;
    }
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(newIp)) {
      showToast('error', 'Please enter a valid IP address');
      return;
    }
    setIpWhitelist([...ipWhitelist, { id: Date.now(), ip: newIp, label: newLabel, addedAt: new Date().toISOString().split('T')[0] }]);
    setNewIp('');
    setNewLabel('');
    showToast('success', 'IP address added to whitelist');
  };

  const handleRemoveIp = (id: number, ip: string) => {
    showConfirm({
      title: 'Remove IP Address',
      message: `Are you sure you want to remove ${ip} from the whitelist? Requests from this IP will be blocked.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      variant: 'danger',
      onConfirm: () => {
        setIpWhitelist(ipWhitelist.filter((i) => i.id !== id));
        showToast('success', 'IP address removed from whitelist');
      },
    });
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Security Settings</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Manage authentication, access control, and security policies</p>
      </div>

      {/* Security Score */}
      <div
        style={{
          background: 'linear-gradient(135deg, #059669, #10b981)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
            }}
          >
            🛡️
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Security Score: Excellent</h3>
            <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>Your account is well protected</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>92</p>
            <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>Score</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>5/6</p>
            <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>Checks</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Two-Factor Authentication */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Smartphone size={20} style={{ color: '#2563eb' }} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: 0, flex: 1 }}>Two-Factor Auth</h3>
            <span style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 500, borderRadius: '9999px', backgroundColor: twoFAEnabled ? '#d1fae5' : '#fee2e2', color: twoFAEnabled ? '#047857' : '#991b1b' }}>
              {twoFAEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            Add an extra layer of security with TOTP-based authentication via authenticator app.
          </p>
          <button
            onClick={() => {
              setTwoFAEnabled(!twoFAEnabled);
              showToast('success', twoFAEnabled ? '2FA disabled' : '2FA enabled successfully');
            }}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: twoFAEnabled ? '#fef2f2' : '#d1fae5',
              color: twoFAEnabled ? '#991b1b' : '#047857',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {twoFAEnabled ? 'Disable 2FA' : 'Enable 2FA'}
          </button>
        </div>

        {/* Session Management */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={20} style={{ color: '#d97706' }} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Session Timeout</h3>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
            Auto-logout after inactivity period
          </p>
          <select
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '14px',
              color: '#1e293b',
              outline: 'none',
              marginBottom: '12px',
            }}
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
          </select>
          <button
            onClick={() => showToast('success', 'Session timeout updated')}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#2563eb',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Update Timeout
          </button>
        </div>

        {/* API Rate Limiting */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={20} style={{ color: '#7c3aed' }} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: 0 }}>API Rate Limit</h3>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
            Max requests per minute per API key
          </p>
          <input
            type="number"
            value={rateLimit}
            onChange={(e) => setRateLimit(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '14px',
              color: '#1e293b',
              outline: 'none',
              marginBottom: '12px',
            }}
          />
          <button
            onClick={() => showToast('success', `Rate limit set to ${rateLimit} requests/minute`)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#7c3aed',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Update Rate Limit
          </button>
        </div>

        {/* Active Sessions */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={20} style={{ color: '#dc2626' }} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Active Sessions</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {[
              { device: 'Chrome on Windows', location: 'Cairo, Egypt', current: true },
              { device: 'Safari on iPhone', location: 'Alexandria, Egypt', current: false },
            ].map((session, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '10px' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b', margin: 0 }}>{session.device}</p>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{session.location}</p>
                </div>
                {session.current ? (
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#059669', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '9999px' }}>Current</span>
                ) : (
                  <button style={{ fontSize: '11px', color: '#dc2626', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => showToast('info', 'All other sessions have been revoked')}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Revoke All Other Sessions
          </button>
        </div>
      </div>

      {/* IP Whitelist */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} style={{ color: '#059669' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: 0 }}>IP Whitelist</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Only allow API requests from these IP addresses</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder="192.168.1.1"
            style={{
              flex: 1,
              minWidth: '150px',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '14px',
              outline: 'none',
              fontFamily: 'monospace',
            }}
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g., Office)"
            style={{
              flex: 1,
              minWidth: '150px',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAddIp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              backgroundColor: '#059669',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            Add IP
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ipWhitelist.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle2 size={16} style={{ color: '#059669' }} />
                <div>
                  <p style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 500, color: '#1e293b', margin: 0 }}>{entry.ip}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{entry.label} • Added {entry.addedAt}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveIp(entry.id, entry.ip)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          ))}
          {ipWhitelist.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
              No IP addresses in whitelist. All IPs are allowed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
