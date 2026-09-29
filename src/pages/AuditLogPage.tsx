import React from 'react';
import { useState } from 'react';
import { FileText, Filter, Download, User, Key, Shield, CreditCard, Settings } from 'lucide-react';

const auditLogs = [
  { id: 1, action: 'checkout.created', user: 'admin@company.com', ip: '197.45.123.45', timestamp: '2026-09-28 14:32:15', details: 'Created checkout ORD-7842 for 150.00 EGP', category: 'transaction' },
  { id: 2, action: 'checkout.paid', user: 'system', ip: '10.0.0.1', timestamp: '2026-09-28 14:32:18', details: 'Payment matched for ORD-7842 via detector', category: 'transaction' },
  { id: 3, action: 'api_key.viewed', user: 'admin@company.com', ip: '197.45.123.45', timestamp: '2026-09-28 14:30:00', details: 'API key revealed in dashboard', category: 'security' },
  { id: 4, action: 'webhook.sent', user: 'system', ip: '10.0.0.1', timestamp: '2026-09-28 14:32:20', details: 'Webhook delivered to https://yourdomain.com/api/webhook (200)', category: 'webhook' },
  { id: 5, action: 'login.success', user: 'admin@company.com', ip: '197.45.123.45', timestamp: '2026-09-28 14:00:00', details: 'Successful login from Chrome on Windows', category: 'auth' },
  { id: 6, action: 'login.failed', user: 'unknown@external.com', ip: '45.67.89.12', timestamp: '2026-09-28 13:45:22', details: 'Failed login attempt - invalid password', category: 'auth' },
  { id: 7, action: 'settings.updated', user: 'admin@company.com', ip: '197.45.123.45', timestamp: '2026-09-28 12:30:00', details: 'Updated webhook URL', category: 'settings' },
  { id: 8, action: 'detector.heartbeat', user: 'system', ip: '41.33.55.77', timestamp: '2026-09-28 14:17:00', details: 'Heartbeat received from device dev_8f3a2b', category: 'system' },
  { id: 9, action: 'checkout.expired', user: 'system', ip: '10.0.0.1', timestamp: '2026-09-28 11:00:00', details: 'Checkout ORD-7834 expired (no payment received)', category: 'transaction' },
  { id: 10, action: 'api_key.regenerated', user: 'admin@company.com', ip: '197.45.123.45', timestamp: '2026-09-27 16:00:00', details: 'API key regenerated - old key revoked', category: 'security' },
];

const categoryIcons: Record<string, any> = {
  transaction: CreditCard,
  security: Shield,
  webhook: FileText,
  auth: User,
  settings: Settings,
  system: Key,
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  transaction: { bg: '#dbeafe', text: '#1e40af' },
  security: { bg: '#fee2e2', text: '#991b1b' },
  webhook: { bg: '#f3e8ff', text: '#6b21a8' },
  auth: { bg: '#fef3c7', text: '#92400e' },
  settings: { bg: '#d1fae5', text: '#065f46' },
  system: { bg: '#f1f5f9', text: '#475569' },
};

export function AuditLogPage() {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? auditLogs : auditLogs.filter((log) => log.category === filter);

  const handleExport = () => {
    const csv = [
      'ID,Action,Category,User,IP,Timestamp,Details',
      ...filtered.map(log => `${log.id},"${log.action}","${log.category}","${log.user}","${log.ip}","${log.timestamp}","${log.details}"`)
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Audit Log</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Track all actions and security events</p>
        </div>
        <button
          onClick={handleExport}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: '#2563eb',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgba(37,99,235,0.2)',
          }}
        >
          <Download size={16} />
          Export Logs
        </button>
      </div>

      {/* Security Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e40af, #7c3aed)',
          borderRadius: '16px',
          padding: '20px 24px',
          color: 'white',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Security Monitoring Active</h3>
            <p style={{ fontSize: '13px', opacity: 0.9, margin: 0 }}>All events are logged and retained for 90 days</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <div>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{auditLogs.length}</p>
            <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>Total Events</p>
          </div>
          <div>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>0</p>
            <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>Threats</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Filter size={16} style={{ color: '#64748b' }} />
          {['all', 'auth', 'transaction', 'security', 'webhook', 'settings', 'system'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filter === f ? '#2563eb' : '#f1f5f9',
                color: filter === f ? 'white' : '#475569',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Log Entries */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {filtered.map((log, index) => {
          const Icon = categoryIcons[log.category] || FileText;
          const colors = categoryColors[log.category] || categoryColors.system;
          return (
            <div
              key={log.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                padding: '16px 24px',
                borderBottom: index < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: colors.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={18} style={{ color: colors.text }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <code
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#1e293b',
                      fontFamily: 'monospace',
                      backgroundColor: '#f8fafc',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {log.action}
                  </code>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: colors.bg,
                      color: colors.text,
                      textTransform: 'capitalize',
                    }}
                  >
                    {log.category}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 4px 0' }}>{log.details}</p>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#94a3b8', flexWrap: 'wrap' }}>
                  <span>👤 {log.user}</span>
                  <span>🌐 {log.ip}</span>
                  <span>🕐 {log.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
