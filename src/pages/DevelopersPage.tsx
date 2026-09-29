import React, { useState } from 'react';
import { Key, Webhook, Copy, Eye, EyeOff, CheckCircle2, Send, FileCode, Terminal, RefreshCw, AlertCircle } from 'lucide-react';
import type { ConfirmAction } from '../App';

interface DevelopersPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showConfirm?: (action: Omit<ConfirmAction, 'id'>) => void;
}

export function DevelopersPage({ showToast, showConfirm }: DevelopersPageProps = {}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'docs'>('keys');

  const apiKey = 'ipg_live_sk_7f8a9b2c4d6e1f3a5b8c9d2e4f6a1b3c';
  const webhookSecret = 'whsec_9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b';

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    showToast?.('success', `Copied ${id} to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTestWebhook = () => {
    setTestResult('sending');
    setTimeout(() => {
      setTestResult('success');
      showToast?.('success', 'Test webhook delivered successfully!');
      setTimeout(() => setTestResult('idle'), 3000);
    }, 1500);
  };

  const handleRegenerateKey = () => {
    showConfirm?.({
      title: 'Regenerate API Key',
      message: 'This will invalidate your current API key. All integrations using the old key will stop working. Are you sure?',
      confirmLabel: 'Regenerate Key',
      cancelLabel: 'Cancel',
      variant: 'danger',
      onConfirm: () => {
        showToast?.('success', 'New API key generated. Old key has been revoked.');
      },
    });
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Developer Portal</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>API keys, webhooks, and integration documentation</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content', marginBottom: '24px' }}>
        {[
          { id: 'keys' as const, label: 'API Keys', icon: Key },
          { id: 'webhooks' as const, label: 'Webhooks', icon: Webhook },
          { id: 'docs' as const, label: 'Documentation', icon: FileCode },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', fontSize: '14px', fontWeight: 500,
                borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? '#1e293b' : '#64748b',
                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* API Keys Tab */}
      {activeTab === 'keys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s' }}>
          {/* API Key Card */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Key size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Live API Key</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Used for creating checkouts via API</p>
                </div>
              </div>
              <button
                onClick={handleRegenerateKey}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', fontSize: '12px', fontWeight: 500,
                  color: '#dc2626', backgroundColor: '#fee2e2',
                  borderRadius: '8px', border: 'none', cursor: 'pointer',
                }}
              >
                <RefreshCw size={12} />
                Regenerate
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: '12px', padding: '12px 16px', fontFamily: 'monospace', fontSize: '14px', color: '#4ade80', overflowX: 'auto' }}>
                {showApiKey ? apiKey : '•'.repeat(40)}
              </div>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? <EyeOff size={16} style={{ color: '#475569' }} /> : <Eye size={16} style={{ color: '#475569' }} />}
              </button>
              <button
                onClick={() => handleCopy(apiKey, 'api-key')}
                style={{ padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
                aria-label="Copy API key"
              >
                {copied === 'api-key' ? <CheckCircle2 size={16} style={{ color: '#059669' }} /> : <Copy size={16} style={{ color: '#475569' }} />}
              </button>
            </div>
          </div>

          {/* Quick Start */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={16} style={{ color: '#2563eb' }} />
              Quick Start - Create a Checkout
            </h3>
            <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', padding: '16px', overflowX: 'auto', position: 'relative' }}>
              <button
                onClick={() => {
                  const code = `curl -X POST https://api.instapay-gateway.com/v1/checkouts \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "amountPiastres": 15000,\n    "currency": "EGP",\n    "merchantOrderId": "INV-2024-001",\n    "expectedSenderHandle": "customer-handle@instapay",\n    "expiresIn": 3600\n  }'`;
                  handleCopy(code, 'curl-example');
                }}
                style={{
                  position: 'absolute', top: '12px', right: '12px',
                  padding: '6px 10px', backgroundColor: '#1e293b', color: '#94a3b8',
                  fontSize: '11px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                {copied === 'curl-example' ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                {copied === 'curl-example' ? 'Copied!' : 'Copy'}
              </button>
              <pre style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: 'monospace', margin: 0, lineHeight: 1.6 }}>
{`curl -X POST https://api.instapay-gateway.com/v1/checkouts \\
  -H "Authorization: Bearer ${showApiKey ? apiKey : 'ipg_live_sk_***'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amountPiastres": 15000,
    "currency": "EGP",
    "merchantOrderId": "INV-2024-001",
    "expectedSenderHandle": "customer-handle@instapay",
    "expiresIn": 3600
  }'`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s' }}>
          {/* Webhook URL */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Webhook size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Webhook Endpoint</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Where we send payment notifications</p>
                </div>
              </div>
              <span style={{ padding: '4px 10px', backgroundColor: '#d1fae5', color: '#047857', fontSize: '12px', fontWeight: 500, borderRadius: '9999px' }}>
                Active
              </span>
            </div>
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '12px 16px', fontFamily: 'monospace', fontSize: '14px', color: '#334155', marginBottom: '16px' }}>
              https://yourdomain.com/api/webhooks/instapay
            </div>

            {/* Webhook Secret */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', margin: '0 0 8px 0' }}>Webhook Signing Secret</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: '12px', padding: '12px 16px', fontFamily: 'monospace', fontSize: '14px', color: '#4ade80', overflowX: 'auto' }}>
                  {showWebhookSecret ? webhookSecret : '•'.repeat(36)}
                </div>
                <button
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  style={{ padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
                >
                  {showWebhookSecret ? <EyeOff size={16} style={{ color: '#475569' }} /> : <Eye size={16} style={{ color: '#475569' }} />}
                </button>
                <button
                  onClick={() => handleCopy(webhookSecret, 'webhook-secret')}
                  style={{ padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
                >
                  {copied === 'webhook-secret' ? <CheckCircle2 size={16} style={{ color: '#059669' }} /> : <Copy size={16} style={{ color: '#475569' }} />}
                </button>
              </div>
            </div>
          </div>

          {/* Webhook Tester */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={16} style={{ color: '#7c3aed' }} />
              Webhook Simulator
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
              Send a test webhook to verify your endpoint is configured correctly.
            </p>

            <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', padding: '16px', marginBottom: '16px', overflowX: 'auto' }}>
              <pre style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: 'monospace', margin: 0, lineHeight: 1.6 }}>
{`{
  "event": "checkout.paid",
  "checkoutId": "chk_8f3a2b1c",
  "merchantOrderId": "INV-2024-001",
  "status": "PAID",
  "amountPiastres": "15000",
  "currency": "EGP",
  "matchedBy": "exact_sender_handle",
  "matchScore": 95,
  "paymentDetectedAt": "2026-09-28T14:32:00.000Z",
  "confirmedAt": "2026-09-28T14:32:05.000Z"
}`}
              </pre>
            </div>

            <button
              onClick={handleTestWebhook}
              disabled={testResult === 'sending'}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', backgroundColor: '#7c3aed', color: 'white',
                fontSize: '14px', fontWeight: 500, borderRadius: '12px',
                border: 'none', cursor: testResult === 'sending' ? 'not-allowed' : 'pointer',
                opacity: testResult === 'sending' ? 0.7 : 1,
              }}
            >
              {testResult === 'sending' ? (
                <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <Send size={16} />
              )}
              {testResult === 'sending' ? 'Sending...' : 'Send Test Webhook'}
            </button>

            {testResult === 'success' && (
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: '#d1fae5', borderRadius: '10px' }}>
                <CheckCircle2 size={16} style={{ color: '#059669' }} />
                <span style={{ fontSize: '13px', color: '#047857' }}>Webhook delivered successfully! (HTTP 200)</span>
              </div>
            )}
          </div>

          {/* Recent Deliveries */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0' }}>Recent Deliveries</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { event: 'checkout.paid', status: 200, time: '2 min ago', orderId: 'ORD-7842' },
                { event: 'checkout.paid', status: 200, time: '15 min ago', orderId: 'ORD-7841' },
                { event: 'checkout.paid', status: 200, time: '1 hr ago', orderId: 'ORD-7838' },
                { event: 'checkout.expired', status: 200, time: '2 hrs ago', orderId: 'ORD-7834' },
              ].map((delivery, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: delivery.status === 200 ? '#10b981' : '#ef4444' }} />
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b', margin: 0 }}>{delivery.event}</p>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{delivery.orderId}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 500, color: delivery.status === 200 ? '#059669' : '#dc2626' }}>
                      {delivery.status}
                    </span>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{delivery.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Documentation Tab */}
      {activeTab === 'docs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0' }}>API Reference</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { method: 'POST', path: '/v1/checkouts', description: 'Create a new payment checkout' },
                { method: 'GET', path: '/v1/checkouts/:id', description: 'Retrieve checkout status' },
                { method: 'GET', path: '/v1/checkouts', description: 'List all checkouts with filters' },
                { method: 'POST', path: '/v1/checkouts/:id/expire', description: 'Expire a pending checkout' },
                { method: 'GET', path: '/v1/transactions', description: 'List all payment events' },
                { method: 'GET', path: '/v1/detector/status', description: 'Get detector device health' },
              ].map((endpoint, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#f1f5f9';
                  }}
                  onClick={() => showToast?.('info', `Opening docs for ${endpoint.path}`)}
                >
                  <span style={{
                    padding: '4px 10px', fontSize: '12px', fontWeight: 'bold', borderRadius: '6px',
                    backgroundColor: endpoint.method === 'POST' ? '#d1fae5' : '#dbeafe',
                    color: endpoint.method === 'POST' ? '#047857' : '#1e40af'
                  }}>
                    {endpoint.method}
                  </span>
                  <code style={{ fontSize: '14px', fontFamily: 'monospace', color: '#334155', flex: 1 }}>{endpoint.path}</code>
                  <span style={{ fontSize: '14px', color: '#64748b' }}>{endpoint.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Response Format */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0' }}>Response Format</h3>
            <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', padding: '16px', overflowX: 'auto' }}>
              <pre style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: 'monospace', margin: 0, lineHeight: 1.6 }}>
{`{
  "id": "chk_8f3a2b1c",
  "merchantOrderId": "INV-2024-001",
  "status": "PENDING",
  "amountPiastres": "15000",
  "currency": "EGP",
  "expectedSenderHandle": "customer-handle@instapay",
  "expiresAt": "2026-09-28T15:32:00.000Z",
  "createdAt": "2026-09-28T14:32:00.000Z",
  "paymentUrl": "https://pay.instapay-gateway.com/chk_8f3a2b1c"
}`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
