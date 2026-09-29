import React, { useState, useEffect } from 'react';
import { Key, Copy, Eye, EyeOff, CheckCircle2, Play, ExternalLink, RefreshCw, Terminal } from 'lucide-react';
import { settingsApi } from '../services/api';

interface DevelopersPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showConfirm?: (action: any) => void;
}

export function DevelopersPage({ showToast, showConfirm }: DevelopersPageProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Simulator state
  const [testAmount, setTestAmount] = useState('50.00');
  const [testSender, setTestSender] = useState('customer@instapay');
  const [testNote, setTestNote] = useState('Test Order #101');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.get();
      if (data.ok) {
        setSettings(data.settings);
      }
    } catch (err: any) {
      if (showToast) {
        showToast('error', 'Failed to load developer keys');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRotateKeys = () => {
    if (showConfirm) {
      showConfirm({
        title: 'Rotate API Keys',
        message: 'Are you sure you want to rotate your API key and detect token? Any active services using the old keys will stop working immediately.',
        confirmLabel: 'Rotate Keys',
        cancelLabel: 'Cancel',
        variant: 'danger',
        onConfirm: async () => {
          try {
            const res = await settingsApi.rotateKeys();
            if (res.ok) {
              setSettings((prev: any) => ({ ...prev, apiKey: res.apiKey, detectToken: res.detectToken }));
              if (showToast) showToast('success', 'API Keys rotated successfully!');
            }
          } catch {
            if (showToast) showToast('error', 'Failed to rotate keys');
          }
        },
      });
    }
  };

  const handleRunSimulator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings?.apiKey) {
      if (showToast) showToast('error', 'API Key not available. Account may be pending approval.');
      return;
    }

    setSimLoading(true);
    setSimResult(null);

    try {
      const res = await fetch('/api/v1/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          amountEgp: Number(testAmount),
          senderHandle: testSender,
          note: testNote,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSimResult(data.checkout);
        if (showToast) showToast('success', 'Checkout session created successfully!');
      } else {
        if (showToast) showToast('error', data.error || 'Simulator checkout failed');
      }
    } catch {
      if (showToast) showToast('error', 'Failed to run simulator');
    } finally {
      setSimLoading(false);
    }
  };

  const apiKey = settings?.apiKey || 'Waiting for account approval...';

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Developer Portal</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>API credentials, simulator tools, and integration documentation</p>
      </div>

      {/* API Key Box */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Live Merchant API Key</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Pass in `Authorization: Bearer &lt;KEY&gt;` header</p>
            </div>
          </div>
          <button
            onClick={handleRotateKeys}
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 600, color: '#dc2626', backgroundColor: '#fee2e2', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            🔄 Rotate Keys
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: '12px', padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#4ade80', overflowX: 'auto' }}>
            {showApiKey ? apiKey : '••••••••••••••••••••••••••••••••••••••••••••'}
          </div>
          <button onClick={() => setShowApiKey(!showApiKey)} style={{ padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>
            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button onClick={() => handleCopy(apiKey)} style={{ padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>
            {copiedKey ? <CheckCircle2 size={16} style={{ color: '#059669' }} /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Simulator */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Interactive Checkout Simulator</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Generate real checkout sessions directly from your dashboard</p>
          </div>
        </div>

        <form onSubmit={handleRunSimulator} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '4px' }}>Amount (EGP)</label>
            <input
              type="number"
              step="0.01"
              value={testAmount}
              onChange={(e) => setTestAmount(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '4px' }}>Sender InstaPay Handle</label>
            <input
              type="text"
              value={testSender}
              onChange={(e) => setTestSender(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '4px' }}>Note / Reference</label>
            <input
              type="text"
              value={testNote}
              onChange={(e) => setTestNote(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              disabled={simLoading}
              style={{
                width: '100%',
                padding: '9px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {simLoading ? 'Creating...' : '⚡ Generate Test Checkout'}
            </button>
          </div>
        </form>

        {simResult && (
          <div style={{ padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>✓ Checkout Created: {simResult.sessionId}</span>
              <a
                href={simResult.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#166534', fontWeight: 600 }}
              >
                Open Checkout Page <ExternalLink size={14} />
              </a>
            </div>
            <p style={{ fontSize: '12px', color: '#15803d', fontFamily: 'monospace', margin: 0 }}>
              URL: {simResult.checkoutUrl}
            </p>
          </div>
        )}
      </div>

      {/* Code Snippet */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0' }}>💻 Quick Start - Create Checkout via cURL</h3>
        <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', padding: '16px', overflowX: 'auto' }}>
          <pre style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: 'monospace', margin: 0 }}>
{`curl -X POST http://localhost:3001/api/v1/checkout/create \\
  -H "Authorization: Bearer ${showApiKey ? apiKey : 'egp_live_***'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amountEgp": 50.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1042"
  }'`}
          </pre>
        </div>
      </div>
    </div>
  );
}
