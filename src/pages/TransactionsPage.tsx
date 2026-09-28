import React, { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type Status = 'ALL' | 'PAID' | 'PENDING' | 'NEEDS_REVIEW' | 'REJECTED' | 'EXPIRED';

const transactions = [
  { id: 'ORD-7842', orderId: 'INV-2024-001', amount: '150.00', sender: 'ahmed@instapay', senderLocal: 'ahmed', status: 'PAID', date: '2026-09-28 14:32', confidence: 95 },
  { id: 'ORD-7841', orderId: 'INV-2024-002', amount: '89.50', sender: 'sara.m@instapay', senderLocal: 'sara.m', status: 'PAID', date: '2026-09-28 14:15', confidence: 95 },
  { id: 'ORD-7840', orderId: 'INV-2024-003', amount: '250.00', sender: 'youssef@instapay', senderLocal: 'youssef', status: 'NEEDS_REVIEW', date: '2026-09-28 13:58', confidence: 70 },
  { id: 'ORD-7839', orderId: 'INV-2024-004', amount: '75.00', sender: 'nour@instapay', senderLocal: 'nour', status: 'PENDING', date: '2026-09-28 13:30', confidence: 0 },
  { id: 'ORD-7838', orderId: 'INV-2024-005', amount: '320.00', sender: 'khaled@instapay', senderLocal: 'khaled', status: 'PAID', date: '2026-09-28 12:45', confidence: 95 },
  { id: 'ORD-7837', orderId: 'INV-2024-006', amount: '180.00', sender: 'fatma@instapay', senderLocal: 'fatma', status: 'PAID', date: '2026-09-28 11:20', confidence: 85 },
  { id: 'ORD-7836', orderId: 'INV-2024-007', amount: '95.00', sender: 'omar.k@instapay', senderLocal: 'omar.k', status: 'REJECTED', date: '2026-09-28 10:15', confidence: 40 },
  { id: 'ORD-7835', orderId: 'INV-2024-008', amount: '450.00', sender: 'mariam@instapay', senderLocal: 'mariam', status: 'PAID', date: '2026-09-27 18:30', confidence: 95 },
  { id: 'ORD-7834', orderId: 'INV-2024-009', amount: '60.00', sender: 'hassan@instapay', senderLocal: 'hassan', status: 'EXPIRED', date: '2026-09-27 16:00', confidence: 0 },
  { id: 'ORD-7833', orderId: 'INV-2024-010', amount: '200.00', sender: 'layla@instapay', senderLocal: 'layla', status: 'PAID', date: '2026-09-27 14:22', confidence: 95 },
];

const statusConfig: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  PAID: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  PENDING: { color: 'bg-amber-100 text-amber-700', icon: Clock },
  NEEDS_REVIEW: { color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  REJECTED: { color: 'bg-red-100 text-red-700', icon: XCircle },
  EXPIRED: { color: 'bg-slate-100 text-slate-600', icon: Clock },
};

export function TransactionsPage() {
  const [filter, setFilter] = useState<Status>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = transactions.filter((tx) => {
    const matchesFilter = filter === 'ALL' || tx.status === filter;
    const matchesSearch = searchQuery === '' ||
      tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.amount.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  const filters: { label: string; value: Status; count?: number }[] = [
    { label: 'All', value: 'ALL', count: transactions.length },
    { label: 'Paid', value: 'PAID', count: transactions.filter(t => t.status === 'PAID').length },
    { label: 'Pending', value: 'PENDING', count: transactions.filter(t => t.status === 'PENDING').length },
    { label: 'Review', value: 'NEEDS_REVIEW', count: transactions.filter(t => t.status === 'NEEDS_REVIEW').length },
    { label: 'Rejected', value: 'REJECTED', count: transactions.filter(t => t.status === 'REJECTED').length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">All Transactions</h2>
          <p className="text-sm text-slate-500">Manage and monitor all payment checkouts</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by order ID, sender, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  filter === f.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label} {f.count !== undefined && `(${f.count})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions Table (Desktop) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sender</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Confidence</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => {
              const StatusIcon = statusConfig[tx.status]?.icon || Clock;
              return (
                <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{tx.id}</p>
                      <p className="text-xs text-slate-500">{tx.orderId}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-slate-800">{tx.amount} EGP</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-slate-700">{tx.sender}</p>
                      <p className="text-xs text-slate-500">{tx.senderLocal}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${statusConfig[tx.status]?.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {tx.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            tx.confidence >= 90 ? 'bg-emerald-500' :
                            tx.confidence >= 70 ? 'bg-amber-500' :
                            tx.confidence > 0 ? 'bg-red-500' : 'bg-slate-300'
                          }`}
                          style={{ width: `${tx.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{tx.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500">{tx.date}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Transactions Cards (Mobile) */}
      <div className="md:hidden space-y-3">
        {filtered.map((tx) => {
          const StatusIcon = statusConfig[tx.status]?.icon || Clock;
          return (
            <div key={tx.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig[tx.status]?.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {tx.status.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-sm font-semibold text-slate-800">{tx.amount} EGP</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{tx.id}</p>
                  <p className="text-xs text-slate-500">from {tx.sender}</p>
                </div>
                <span className="text-xs text-slate-400">{tx.date}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Showing {filtered.length} of {transactions.length} transactions</p>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50" disabled>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg">1</button>
          <button className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">2</button>
          <button className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">3</button>
          <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
