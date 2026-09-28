import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';

interface ReviewItem {
  id: string;
  orderId: string;
  expectedAmount: string;
  expectedSender: string;
  detectedAmount: string;
  detectedSender: string;
  confidence: number;
  matchScore: number;
  rawNotification: string;
  language: string;
  receivedAt: string;
}

const reviewItems: ReviewItem[] = [
  {
    id: 'PE-001',
    orderId: 'ORD-7840',
    expectedAmount: '250.00 EGP',
    expectedSender: 'youssef@instapay',
    detectedAmount: '250.00 EGP',
    detectedSender: 'youssef.h@instapay',
    confidence: 70,
    matchScore: 85,
    rawNotification: 'You have received 250.00 EGP from\nyoussef.h@instapay',
    language: 'en',
    receivedAt: '2026-09-28 13:58',
  },
  {
    id: 'PE-002',
    orderId: 'ORD-7835',
    expectedAmount: '180.00 EGP',
    expectedSender: 'customer@instapay',
    detectedAmount: '180.00 EGP',
    detectedSender: 'cust0mer@instapay',
    confidence: 60,
    matchScore: 80,
    rawNotification: 'You have received 180.00 EGP from\ncust0mer@instapay',
    language: 'en',
    receivedAt: '2026-09-28 11:20',
  },
  {
    id: 'PE-003',
    orderId: 'ORD-7830',
    expectedAmount: '500.00 EGP',
    expectedSender: 'any',
    detectedAmount: '500.00 EGP',
    detectedSender: 'unknown_sender',
    confidence: 40,
    matchScore: 60,
    rawNotification: 'لقد استلمت 500.00 جنيه من unknown_sender',
    language: 'ar',
    receivedAt: '2026-09-27 16:45',
  },
];

export function ReviewPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);

  const handleConfirm = (id: string) => {
    setActionLoading(id);
    setTimeout(() => {
      setConfirmed((prev) => [...prev, id]);
      setActionLoading(null);
    }, 800);
  };

  const handleReject = (id: string) => {
    setActionLoading(id);
    setTimeout(() => {
      setRejected((prev) => [...prev, id]);
      setActionLoading(null);
    }, 800);
  };

  const remainingItems = reviewItems.filter(
    (item) => !confirmed.includes(item.id) && !rejected.includes(item.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manual Review Queue</h2>
          <p className="text-sm text-slate-500">
            Review and approve payments that couldn't be automatically matched
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg">
            {remainingItems.length} pending
          </span>
        </div>
      </div>

      {/* Success/Rejected Messages */}
      {confirmed.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-700">
            {confirmed.length} payment(s) confirmed successfully
          </p>
        </div>
      )}
      {rejected.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">
            {rejected.length} payment(s) rejected
          </p>
        </div>
      )}

      {/* Empty State */}
      {remainingItems.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-800 mb-2">All caught up!</h3>
          <p className="text-slate-500">No payments need manual review at this time.</p>
        </div>
      )}

      {/* Review Cards */}
      <div className="space-y-4">
        {remainingItems.map((item) => {
          const isExpanded = expandedId === item.id;
          const isLoading = actionLoading === item.id;

          return (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Card Header */}
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-800">{item.orderId}</h4>
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                        Needs Review
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Received {item.receivedAt} • {item.language === 'en' ? 'English' : 'Arabic'} notification
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-800">{item.expectedAmount}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-5 animate-fade-in">
                  {/* Comparison Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Expected */}
                    <div className="bg-blue-50 rounded-xl p-4">
                      <h5 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Expected Payment
                      </h5>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-blue-600">Amount</p>
                          <p className="text-sm font-mono font-medium text-slate-800">{item.expectedAmount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-600">Expected Sender</p>
                          <p className="text-sm font-mono font-medium text-slate-800">{item.expectedSender}</p>
                        </div>
                      </div>
                    </div>

                    {/* Detected */}
                    <div className="bg-amber-50 rounded-xl p-4">
                      <h5 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Detected Payment
                      </h5>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-amber-600">Amount</p>
                          <p className="text-sm font-mono font-medium text-slate-800">{item.detectedAmount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-amber-600">Detected Sender</p>
                          <p className="text-sm font-mono font-medium text-slate-800">{item.detectedSender}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-xs text-amber-600">Confidence</p>
                            <p className={`text-sm font-semibold ${
                              item.confidence >= 80 ? 'text-emerald-600' :
                              item.confidence >= 60 ? 'text-amber-600' : 'text-red-600'
                            }`}>{item.confidence}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-amber-600">Match Score</p>
                            <p className={`text-sm font-semibold ${
                              item.matchScore >= 80 ? 'text-emerald-600' :
                              item.matchScore >= 60 ? 'text-amber-600' : 'text-red-600'
                            }`}>{item.matchScore}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Raw Notification */}
                  <div className="mb-5">
                    <p className="text-xs font-medium text-slate-500 mb-2">Raw Notification Text</p>
                    <div className="bg-slate-900 text-green-400 rounded-xl p-4 font-mono text-xs whitespace-pre-wrap">
                      {item.rawNotification}
                    </div>
                  </div>

                  {/* Notes & Actions */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1.5 block">Review Notes</label>
                      <textarea
                        placeholder="Add notes about this review (optional)..."
                        value={notes[item.id] || ''}
                        onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleConfirm(item.id)}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isLoading ? 'Confirming...' : 'Confirm Payment'}
                      </button>
                      <button
                        onClick={() => handleReject(item.id)}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 shadow-lg shadow-red-600/20"
                      >
                        <XCircle className="w-4 h-4" />
                        {isLoading ? 'Rejecting...' : 'Reject Payment'}
                      </button>
                      <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                        <MessageSquare className="w-4 h-4" />
                        Contact Support
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
