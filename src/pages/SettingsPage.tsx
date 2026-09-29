import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, Shield, Globe, Clock, RefreshCw } from 'lucide-react';
import { settingsApi } from '../services/api';

interface SettingsPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function SettingsPage({ showToast }: SettingsPageProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [businessName, setBusinessName] = useState('');
  const [instapayHandle, setInstapayHandle] = useState('');
  const [instapayPaymentUrl, setInstapayPaymentUrl] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [checkoutTtlMin, setCheckoutTtlMin] = useState(10);
  const [webhookSecret, setWebhookSecret] = useState('');

  useEffect(() => {
    settingsApi
      .get()
      .then((res) => {
        if (res.ok && res.settings) {
          const s = res.settings;
          setBusinessName(s.businessName || '');
          setInstapayHandle(s.instapayHandle || '');
          setInstapayPaymentUrl(s.instapayPaymentUrl || '');
          setWebhookUrl(s.webhookUrl || '');
          setCheckoutTtlMin(s.checkoutTtlMin || 10);
          setWebhookSecret(s.webhookSecret || '');
        }
      })
      .catch(() => {
        if (showToast) showToast('error', 'Failed to load merchant settings');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.update({
        businessName,
        instapayPaymentUrl,
        webhookUrl,
        checkoutTtlMin: Number(checkoutTtlMin),
      });

      if (res.ok) {
        setSaved(true);
        if (showToast) showToast('success', 'Settings updated successfully!');
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      if (showToast) showToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Gateway Settings</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Configure static payment links, webhooks, and expiration TTL</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: '#10b981',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '10px',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 15px -3px rgba(16,185,129,0.3)',
          }}
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#10b981' }} />
            Loading settings...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Business Display Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Receiving InstaPay Handle (Locked)
                </label>
                <input
                  type="text"
                  disabled
                  value={instapayHandle}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '14px', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Static InstaPay Payment / Share URL
              </label>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px 0' }}>
                Copy your exact share payment URL from the official InstaPay app (e.g. <code>https://ipn.eg/S/username/instapay/TOKEN</code>).
              </p>
              <input
                type="url"
                value={instapayPaymentUrl}
                onChange={(e) => setInstapayPaymentUrl(e.target.value)}
                placeholder="https://ipn.eg/S/..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Merchant Webhook URL
              </label>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px 0' }}>
                The endpoint where HMAC-SHA256 signed payment confirmation events will be posted.
              </p>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/webhooks/instapay"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Checkout Session Lifetime (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={checkoutTtlMin}
                  onChange={(e) => setCheckoutTtlMin(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Webhook Signing Secret
                </label>
                <input
                  type="text"
                  disabled
                  value={webhookSecret || 'Auto-generated upon approval'}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '13px', fontFamily: 'monospace' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
