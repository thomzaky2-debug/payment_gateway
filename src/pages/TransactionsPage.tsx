import React from 'react';
import { useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react';

const transactions = [
  { id: 'ORD-7842', orderId: 'INV-2024-001', amount: '150.00', sender: 'ahmed@instapay', status: 'PAID', date: '2026-09-28 14:32', confidence: 95 },
  { id: 'ORD-7841', orderId: 'INV-2024-002', amount: '89.50', sender: 'sara.m@instapay', status: 'PAID', date: '2026-09-28 14:15', confidence: 95 },
  { id: 'ORD-7840', orderId: 'INV-2024-003', amount: '250.00', sender: 'youssef@instapay', status: 'NEEDS_REVIEW', date: '2026-09-28 13:58', confidence: 70 },
  { id: 'ORD-7839', orderId: 'INV-2024-004', amount: '75.00', sender: 'nour@instapay', status: 'PENDING', date: '2026-09-28 13:30', confidence: 0 },
  { id: 'ORD-7838', orderId: 'INV-2024-005', amount: '320.00', sender: 'khaled@instapay', status: 'PAID', date: '2026-09-28 12:45', confidence: 95 },
  { id: 'ORD-7837', orderId: 'INV-2024-006', amount: '180.00', sender: 'fatma@instapay', status: 'PAID', date: '2026-09-28 11:20', confidence: 85 },
  { id: 'ORD-7836', orderId: 'INV-2024-007', amount: '95.00', sender: 'omar.k@instapay', status: 'REJECTED', date: '2026-09-28 10:15', confidence: 40 },
  { id: 'ORD-7835', orderId: 'INV-2024-008', amount: '450.00', sender: 'mariam@instapay', status: 'PAID', date: '2026-09-27 18:30', confidence: 95 },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  PAID: { bg: '#d1fae5', text: '#047857' },
  PENDING: { bg: '#fef3c7', text: '#b45309' },
  NEEDS_REVIEW: { bg: '#fed7aa', text: '#c2410c' },
  REJECTED: { bg: '#fee2e2', text: '#b91c1c' },
  EXPIRED: { bg: '#f1f5f9', text: '#475569' },
};

export function TransactionsPage() {
  const [filter, setFilter] = useState('ALL');

  const filtered = transactions.filter((tx) => filter === 'ALL' || tx.status === filter);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>All Transactions</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Manage and monitor all payment checkouts</p>
        </div>
        <button style={{ 
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 20px', backgroundColor: '#2563eb', color: 'white',
          fontSize: '14px', fontWeight: 500, borderRadius: '12px',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 10px 15px -3px rgba(37,99,235,0.2)'
        }}>
          📥 Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['ALL', 'PAID', 'PENDING', 'NEEDS_REVIEW', 'REJECTED'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 500,
                borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: filter === f ? '#2563eb' : '#f1f5f9',
                color: filter === f ? 'white' : '#475569',
              }}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Order</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Amount</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Sender</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Confidence</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '16px 24px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', margin: 0 }}>{tx.id}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{tx.orderId}</p>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{tx.amount} EGP</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{ fontSize: '14px', color: '#334155' }}>{tx.sender}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px', fontSize: '12px', fontWeight: 500, borderRadius: '9999px',
                    backgroundColor: statusColors[tx.status]?.bg || '#f1f5f9',
                    color: statusColors[tx.status]?.text || '#475569'
                  }}>
                    {tx.status.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '64px', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', borderRadius: '3px',
                        backgroundColor: tx.confidence >= 90 ? '#10b981' : tx.confidence >= 70 ? '#f59e0b' : tx.confidence > 0 ? '#ef4444' : '#cbd5e1',
                        width: `${tx.confidence}%`
                      }} />
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{tx.confidence}%</span>
                  </div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{ fontSize: '14px', color: '#64748b' }}>{tx.date}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
