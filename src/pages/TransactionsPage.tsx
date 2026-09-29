import React, { useState } from 'react';
import { Search, Download, CheckCircle2, Clock, AlertCircle, XCircle, X, Eye, Copy, ExternalLink } from 'lucide-react';

interface TransactionsPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

const transactions = [
  { id: 'ORD-7842', orderId: 'INV-2024-001', amount: '150.00', sender: 'a.hassan@instapay', senderLocal: 'a.hassan', status: 'PAID', date: '2026-09-28 14:32', confidence: 95, method: 'exact_sender_handle', matchScore: 95 },
  { id: 'ORD-7841', orderId: 'INV-2024-002', amount: '89.50', sender: 's.mahmoud@instapay', senderLocal: 's.mahmoud', status: 'PAID', date: '2026-09-28 14:15', confidence: 95, method: 'exact_sender_handle', matchScore: 95 },
  { id: 'ORD-7840', orderId: 'INV-2024-003', amount: '250.00', sender: 'y.ibrahim@instapay', senderLocal: 'y.ibrahim', status: 'NEEDS_REVIEW', date: '2026-09-28 13:58', confidence: 70, method: 'local_username', matchScore: 85 },
  { id: 'ORD-7839', orderId: 'INV-2024-004', amount: '75.00', sender: 'n.ali@instapay', senderLocal: 'n.ali', status: 'PENDING', date: '2026-09-28 13:30', confidence: 0, method: null, matchScore: 0 },
  { id: 'ORD-7838', orderId: 'INV-2024-005', amount: '320.00', sender: 'k.fathy@instapay', senderLocal: 'k.fathy', status: 'PAID', date: '2026-09-28 12:45', confidence: 95, method: 'exact_sender_handle', matchScore: 95 },
  { id: 'ORD-7837', orderId: 'INV-2024-006', amount: '180.00', sender: 'f.nasser@instapay', senderLocal: 'f.nasser', status: 'PAID', date: '2026-09-28 11:20', confidence: 85, method: 'local_username', matchScore: 85 },
  { id: 'ORD-7836', orderId: 'INV-2024-007', amount: '95.00', sender: 'o.khaled@instapay', senderLocal: 'o.khaled', status: 'REJECTED', date: '2026-09-28 10:15', confidence: 40, method: null, matchScore: 40 },
  { id: 'ORD-7835', orderId: 'INV-2024-008', amount: '450.00', sender: 'm.said@instapay', senderLocal: 'm.said', status: 'PAID', date: '2026-09-27 18:30', confidence: 95, method: 'exact_sender_handle', matchScore: 95 },
  { id: 'ORD-7834', orderId: 'INV-2024-009', amount: '60.00', sender: 'h.amin@instapay', senderLocal: 'h.amin', status: 'EXPIRED', date: '2026-09-27 16:00', confidence: 0, method: null, matchScore: 0 },
  { id: 'ORD-7833', orderId: 'INV-2024-010', amount: '200.00', sender: 'l.farouk@instapay', senderLocal: 'l.farouk', status: 'PAID', date: '2026-09-27 14:22', confidence: 95, method: 'exact_sender_handle', matchScore: 95 },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  PAID: { bg: '#d1fae5', text: '#047857' },
  PENDING: { bg: '#fef3c7', text: '#b45309' },
  NEEDS_REVIEW: { bg: '#fed7aa', text: '#c2410c' },
  REJECTED: { bg: '#fee2e2', text: '#b91c1c' },
  EXPIRED: { bg: '#f1f5f9', text: '#475569' },
};

export function TransactionsPage({ showToast }: TransactionsPageProps = {}) {
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<typeof transactions[0] | null>(null);
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = transactions
    .filter((tx) => {
      const matchesFilter = filter === 'ALL' || tx.status === filter;
      const matchesSearch = searchQuery === '' ||
        tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.amount.includes(searchQuery);
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'amount') {
        return (parseFloat(a.amount) - parseFloat(b.amount)) * mul;
      }
      return a.date.localeCompare(b.date) * mul;
    });

  const handleExport = () => {
    const csv = [
      'Order ID,Invoice,Amount,Sender,Status,Confidence,Date',
      ...filtered.map(tx => `${tx.id},${tx.orderId},${tx.amount},${tx.sender},${tx.status},${tx.confidence}%,${tx.date}`)
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instapay-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.('success', `Exported ${filtered.length} transactions to CSV`);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    showToast?.('success', `Copied ${id} to clipboard`);
  };

  const toggleSort = (field: 'date' | 'amount') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const counts = {
    ALL: transactions.length,
    PAID: transactions.filter(t => t.status === 'PAID').length,
    PENDING: transactions.filter(t => t.status === 'PENDING').length,
    NEEDS_REVIEW: transactions.filter(t => t.status === 'NEEDS_REVIEW').length,
    REJECTED: transactions.filter(t => t.status === 'REJECTED').length,
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>All Transactions</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
            Showing {filtered.length} of {transactions.length} transactions
          </p>
        </div>
        <button
          onClick={handleExport}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', backgroundColor: '#2563eb', color: 'white',
            fontSize: '14px', fontWeight: 500, borderRadius: '12px',
            border: 'none', cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgba(37,99,235,0.2)',
          }}
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Search & Filters */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by order ID, sender, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px 10px 40px',
                backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: '10px', fontSize: '14px', outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(counts).map(([key, count]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '8px 14px', fontSize: '12px', fontWeight: 500,
                  borderRadius: '8px', border: 'none', cursor: 'pointer',
                  backgroundColor: filter === key ? '#2563eb' : '#f1f5f9',
                  color: filter === key ? 'white' : '#475569',
                  whiteSpace: 'nowrap',
                }}
              >
                {key === 'NEEDS_REVIEW' ? 'Review' : key.charAt(0) + key.slice(1).toLowerCase()} ({count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order</th>
                <th
                  onClick={() => toggleSort('amount')}
                  style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none' }}
                >
                  Amount {sortField === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sender</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</th>
                <th
                  onClick={() => toggleSort('date')}
                  style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none' }}
                >
                  Date {sortField === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                    <Search size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <p style={{ fontSize: '14px', margin: 0 }}>No transactions match your search</p>
                  </td>
                </tr>
              ) : filtered.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', margin: 0 }}>{tx.id}</p>
                      <button
                        onClick={() => handleCopyId(tx.id)}
                        style={{ padding: '2px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                        title="Copy ID"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>{tx.orderId}</p>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{tx.amount} EGP</span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <p style={{ fontSize: '14px', color: '#334155', margin: 0 }}>{tx.sender}</p>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px', fontSize: '12px', fontWeight: 500, borderRadius: '9999px',
                      backgroundColor: statusColors[tx.status]?.bg || '#f1f5f9',
                      color: statusColors[tx.status]?.text || '#475569'
                    }}>
                      {tx.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '64px', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '3px',
                          backgroundColor: tx.confidence >= 90 ? '#10b981' : tx.confidence >= 70 ? '#f59e0b' : tx.confidence > 0 ? '#ef4444' : '#cbd5e1',
                          width: `${tx.confidence}%`
                        }} />
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b', minWidth: '32px' }}>{tx.confidence}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>{tx.date}</span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <button
                      onClick={() => setSelectedTx(tx)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569',
                        fontSize: '12px', fontWeight: 500, borderRadius: '8px',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      <Eye size={12} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onCopy={handleCopyId}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function TransactionDetailModal({
  transaction: tx,
  onClose,
  onCopy,
  showToast,
}: {
  transaction: typeof transactions[0];
  onClose: () => void;
  onCopy: (id: string) => void;
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s' }} onClick={onClose} />
      <div style={{
        position: 'relative', backgroundColor: 'white', borderRadius: '20px',
        padding: '28px', maxWidth: '520px', width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        animation: 'scaleIn 0.2s ease-out',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', padding: '4px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }} aria-label="Close">
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            backgroundColor: statusColors[tx.status]?.bg || '#f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {tx.status === 'PAID' ? <CheckCircle2 size={24} style={{ color: '#059669' }} /> :
             tx.status === 'NEEDS_REVIEW' ? <AlertCircle size={24} style={{ color: '#ea580c' }} /> :
             tx.status === 'PENDING' ? <Clock size={24} style={{ color: '#d97706' }} /> :
             <XCircle size={24} style={{ color: '#dc2626' }} />}
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: 0 }}>{tx.id}</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>{tx.orderId}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <DetailItem label="Amount" value={`${tx.amount} EGP`} />
          <DetailItem label="Status" value={tx.status.replace('_', ' ')} />
          <DetailItem label="Sender" value={tx.sender} />
          <DetailItem label="Local Handle" value={tx.senderLocal} />
          <DetailItem label="Confidence" value={`${tx.confidence}%`} />
          <DetailItem label="Match Score" value={`${tx.matchScore}%`} />
          <DetailItem label="Match Method" value={tx.method || 'N/A'} />
          <DetailItem label="Date" value={tx.date} />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { onCopy(tx.id); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569',
              fontSize: '13px', fontWeight: 500, borderRadius: '10px',
              border: 'none', cursor: 'pointer',
            }}
          >
            <Copy size={14} />
            Copy ID
          </button>
          <button
            onClick={() => {
              showToast?.('info', 'Opening webhook details...');
              onClose();
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569',
              fontSize: '13px', fontWeight: 500, borderRadius: '10px',
              border: 'none', cursor: 'pointer',
            }}
          >
            <ExternalLink size={14} />
            View Webhook
          </button>
          {tx.status === 'NEEDS_REVIEW' && (
            <button
              onClick={() => {
                showToast?.('success', 'Sent to manual review queue');
                onClose();
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', backgroundColor: '#2563eb', color: 'white',
                fontSize: '13px', fontWeight: 500, borderRadius: '10px',
                border: 'none', cursor: 'pointer',
              }}
            >
              Go to Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', margin: 0, fontFamily: label === 'Sender' || label === 'Local Handle' || label === 'Match Method' ? 'monospace' : 'inherit' }}>{value}</p>
    </div>
  );
}
