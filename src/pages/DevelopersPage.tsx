import React from 'react';
import { useState } from 'react';
import { Key, Webhook, Copy, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

import type { ConfirmAction } from '../App';

interface DevelopersPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showConfirm?: (action: Omit<ConfirmAction, 'id'>) => void;
}

export function DevelopersPage({ showToast, showConfirm }: DevelopersPageProps = {}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const apiKey = 'ipg_live_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Developer Portal</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>API keys, webhooks, and integration documentation</p>
      </div>

      {/* API Key */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Live API Key</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Used for creating checkouts via API</p>
            </div>
          </div>
          <button style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 500, color: '#475569', backgroundColor: '#f1f5f9', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            🔄 Regenerate
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: '12px', padding: '12px 16px', fontFamily: 'monospace', fontSize: '14px', color: '#4ade80', overflowX: 'auto' }}>
            {showApiKey ? apiKey : '•'.repeat(40)}
          </div>
          <button onClick={() => setShowApiKey(!showApiKey)} style={{ padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>
            {showApiKey ? <EyeOff size={16} style={{ color: '#475569' }} /> : <Eye size={16} style={{ color: '#475569' }} />}
          </button>
          <button onClick={handleCopy} style={{ padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>
            {copied ? <CheckCircle2 size={16} style={{ color: '#059669' }} /> : <Copy size={16} style={{ color: '#475569' }} />}
          </button>
        </div>
      </div>

      {/* Quick Start */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0' }}>💻 Quick Start - Create a Checkout</h3>
        <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', padding: '16px', overflowX: 'auto' }}>
          <pre style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: 'monospace', margin: 0 }}>
{`curl -X POST https://api.instapay-gateway.com/v1/checkouts \\
  -H "Authorization: Bearer ${showApiKey ? apiKey : 'ipg_live_sk_***'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amountPiastres": 15000,
    "currency": "EGP",
    "merchantOrderId": "INV-2024-001",
    "expectedSenderHandle": "customer@instapay",
    "expiresIn": 3600
  }'`}
          </pre>
        </div>
      </div>

      {/* API Endpoints */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px 0' }}>API Reference</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Endpoint method="POST" path="/v1/checkouts" description="Create a new payment checkout" />
          <Endpoint method="GET" path="/v1/checkouts/:id" description="Retrieve checkout status" />
          <Endpoint method="GET" path="/v1/checkouts" description="List all checkouts with filters" />
          <Endpoint method="POST" path="/v1/checkouts/:id/expire" description="Expire a pending checkout" />
          <Endpoint method="GET" path="/v1/transactions" description="List all payment events" />
          <Endpoint method="GET" path="/v1/detector/status" description="Get detector device health" />
        </div>
      </div>
    </div>
  );
}

function Endpoint({ method, path, description }: { method: string; path: string; description: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
      <span style={{ 
        padding: '4px 10px', fontSize: '12px', fontWeight: 'bold', borderRadius: '6px',
        backgroundColor: method === 'POST' ? '#d1fae5' : '#dbeafe',
        color: method === 'POST' ? '#047857' : '#1e40af'
      }}>
        {method}
      </span>
      <code style={{ fontSize: '14px', fontFamily: 'monospace', color: '#334155', flex: 1 }}>{path}</code>
      <span style={{ fontSize: '14px', color: '#64748b' }}>{description}</span>
    </div>
  );
}
