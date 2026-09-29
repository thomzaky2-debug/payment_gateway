import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, AlertCircle, XCircle, Search, RefreshCw, ExternalLink } from 'lucide-react';
import { transactionsApi } from '../services/api';

interface TransactionsPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

interface TransactionItem {
  id: string;
  sessionId: string;
  amountEgp: number;
  currency: string;
  senderHandle: string;
  recipientHandle: string;
  status: string;
  detectedRef?: string | null;
  detectedAt?: string | null;
  createdAt: string;
  note?: string | null;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  CONFIRMED: { bg: '#d1fae5', text: '#047857' },
  PAID: { bg: '#d1fae5', text: '#047857' },
  PENDING: { bg: '#fef3c7', text: '#b45309' },
  UNDERPAID: { bg: '#fed7aa', text: '#c2410c' },
  EXPIRED: { bg: '#f1f5f9', text: '#475569' },
};

export function TransactionsPage({ showToast }: TransactionsPageProps) {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await transactionsApi.list({
        status: filter === 'ALL' ? undefined : filter,
        search: searchTerm.trim() || undefined,
      });
      if (data.ok && data.transactions) {
        setTransactions(data.transactions);
      }
    } catch (err: any) {
      if (showToast) {
        showToast('error', 'Failed to fetch transactions from server');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions();
  };

  const handleExport = () => {
    window.open(transactionsApi.getExportUrl(), '_blank');
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>All Transactions</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Manage and monitor all payment checkouts</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchTransactions}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              backgroundColor: 'white',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExport}
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
              cursor: 'pointer',
              boxShadow: '0 8px 15px -3px rgba(16,185,129,0.3)',
            }}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['ALL', 'CONFIRMED', 'PENDING', 'UNDERPAID', 'EXPIRED'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filter === f ? '#0f172a' : '#f1f5f9',
                color: filter === f ? '#38bdf8' : '#475569',
                transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search session or handle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '6px 12px 6px 30px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                width: '220px',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '6px 14px',
              backgroundColor: '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#10b981' }} />
            Loading transactions from gateway...
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            No transactions found matching your criteria.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Session</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Sender</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Reference</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Date</th>
                <th style={{ textAlign: 'right', padding: '14px 20px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Checkout</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const badge = statusColors[tx.status] || { bg: '#f1f5f9', text: '#475569' };
                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                      {tx.sessionId}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {tx.amountEgp.toFixed(2)} EGP
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#475569' }}>
                      {tx.senderHandle}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          backgroundColor: badge.bg,
                          color: badge.text,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                      {tx.detectedRef || '—'}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '12px', color: '#64748b' }}>
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <a
                        href={`/pay/${tx.sessionId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#2563eb',
                          fontSize: '12px',
                          textDecoration: 'none',
                          fontWeight: 500,
                        }}
                      >
                        View <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
