import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, MessageSquare, ChevronDown, ChevronUp, Eye, Send } from 'lucide-react';
import type { ConfirmAction } from '../App';

interface ReviewPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showConfirm?: (action: Omit<ConfirmAction, 'id'>) => void;
}

const reviewItems = [
  {
    id: 'PE-001',
    orderId: 'ORD-7840',
    expectedAmount: '250.00 EGP',
    expectedSender: 'y.ibrahim@instapay',
    detectedAmount: '250.00 EGP',
    detectedSender: 'y.ibrahim.h@instapay',
    confidence: 70,
    matchScore: 85,
    rawNotification: 'You have received 250.00 EGP from\ny.ibrahim.h@instapay',
    language: 'en',
    receivedAt: '2026-09-28 13:58',
    matchMethod: 'local_username',
    amountMatch: true,
    senderMismatch: true,
  },
  {
    id: 'PE-002',
    orderId: 'ORD-7835',
    expectedAmount: '180.00 EGP',
    expectedSender: 'client@instapay',
    detectedAmount: '180.00 EGP',
    detectedSender: 'cl1ent@instapay',
    confidence: 60,
    matchScore: 80,
    rawNotification: 'You have received 180.00 EGP from\ncl1ent@instapay',
    language: 'en',
    receivedAt: '2026-09-28 11:20',
    matchMethod: 'local_username',
    amountMatch: true,
    senderMismatch: true,
  },
  {
    id: 'PE-003',
    orderId: 'ORD-7830',
    expectedAmount: '500.00 EGP',
    expectedSender: 'any',
    detectedAmount: '500.00 EGP',
    detectedSender: 'sender_unknown',
    confidence: 40,
    matchScore: 60,
    rawNotification: 'لقد استلمت 500.00 جنيه من sender_unknown',
    language: 'ar',
    receivedAt: '2026-09-27 16:45',
    matchMethod: 'amount_only',
    amountMatch: true,
    senderMismatch: false,
  },
];

export function ReviewPage({ showToast, showConfirm }: ReviewPageProps = {}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);

  const remainingItems = reviewItems.filter(
    (item) => !confirmed.includes(item.id) && !rejected.includes(item.id)
  );

  const handleConfirm = (id: string) => {
    showConfirm?.({
      title: 'Confirm Payment',
      message: `Are you sure you want to confirm payment for ${id}? This will mark the checkout as PAID and send a webhook to the merchant.`,
      confirmLabel: 'Confirm Payment',
      cancelLabel: 'Cancel',
      variant: 'info',
      onConfirm: () => {
        setActionLoading(id);
        setTimeout(() => {
          setConfirmed((prev) => [...prev, id]);
          setActionLoading(null);
          showToast?.('success', `Payment ${id} confirmed successfully! Webhook sent to merchant.`);
        }, 1000);
      },
    });
  };

  const handleReject = (id: string) => {
    showConfirm?.({
      title: 'Reject Payment',
      message: `Are you sure you want to reject payment for ${id}? This action cannot be undone. The checkout will be marked as REJECTED.`,
      confirmLabel: 'Reject Payment',
      cancelLabel: 'Cancel',
      variant: 'danger',
      onConfirm: () => {
        setActionLoading(id);
        setTimeout(() => {
          setRejected((prev) => [...prev, id]);
          setActionLoading(null);
          showToast?.('warning', `Payment ${id} has been rejected.`);
        }, 1000);
      },
    });
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Manual Review Queue</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
            Review payments that couldn't be automatically matched
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ padding: '6px 14px', backgroundColor: '#fed7aa', color: '#c2410c', fontSize: '14px', fontWeight: 500, borderRadius: '10px' }}>
            {remainingItems.length} pending
          </span>
          {confirmed.length > 0 && (
            <span style={{ padding: '6px 14px', backgroundColor: '#d1fae5', color: '#047857', fontSize: '14px', fontWeight: 500, borderRadius: '10px' }}>
              {confirmed.length} confirmed
            </span>
          )}
          {rejected.length > 0 && (
            <span style={{ padding: '6px 14px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '14px', fontWeight: 500, borderRadius: '10px' }}>
              {rejected.length} rejected
            </span>
          )}
        </div>
      </div>

      {/* Empty State */}
      {remainingItems.length === 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '60px 24px', textAlign: 'center' }}>
          <CheckCircle2 size={64} style={{ color: '#10b981', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b', margin: '0 0 8px 0' }}>All caught up!</h3>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>No payments need manual review at this time.</p>
          <button
            onClick={() => showToast?.('info', 'Refreshing review queue...')}
            style={{
              marginTop: '20px', padding: '10px 20px', backgroundColor: '#2563eb', color: 'white',
              fontSize: '14px', fontWeight: 500, borderRadius: '10px', border: 'none', cursor: 'pointer',
            }}
          >
            Refresh Queue
          </button>
        </div>
      )}

      {/* Review Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {remainingItems.map((item) => {
          const isExpanded = expandedId === item.id;
          const isLoading = actionLoading === item.id;

          return (
            <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {/* Card Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', cursor: 'pointer', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertCircle size={24} style={{ color: '#ea580c' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: 0 }}>{item.orderId}</h4>
                      <span style={{ padding: '2px 8px', backgroundColor: '#fed7aa', color: '#c2410c', fontSize: '11px', fontWeight: 500, borderRadius: '9999px' }}>
                        Needs Review
                      </span>
                      <span style={{ padding: '2px 8px', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 500, borderRadius: '9999px' }}>
                        {item.language === 'en' ? '🇬🇧 EN' : '🇸🇦 AR'}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                      Received {item.receivedAt} • Match method: {item.matchMethod}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{item.expectedAmount}</span>
                  {isExpanded ? <ChevronUp size={20} style={{ color: '#94a3b8' }} /> : <ChevronDown size={20} style={{ color: '#94a3b8' }} />}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid #f1f5f9', paddingTop: '20px', animation: 'fadeIn 0.3s' }}>
                  {/* Comparison Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    {/* Expected */}
                    <div style={{ backgroundColor: '#eff6ff', borderRadius: '12px', padding: '16px' }}>
                      <h5 style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Eye size={14} />
                        Expected Payment
                      </h5>
                      <div style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '11px', color: '#3b82f6', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</p>
                        <p style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 500, color: '#1e293b', margin: 0 }}>{item.expectedAmount}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '11px', color: '#3b82f6', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expected Sender</p>
                        <p style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 500, color: '#1e293b', margin: 0 }}>{item.expectedSender}</p>
                      </div>
                    </div>

                    {/* Detected */}
                    <div style={{ backgroundColor: '#fffbeb', borderRadius: '12px', padding: '16px' }}>
                      <h5 style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={14} />
                        Detected Payment
                      </h5>
                      <div style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '11px', color: '#d97706', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</p>
                        <p style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 500, color: '#1e293b', margin: 0 }}>
                          {item.detectedAmount}
                          {item.amountMatch && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#059669' }}>✓ Match</span>}
                        </p>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '11px', color: '#d97706', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detected Sender</p>
                        <p style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 500, color: '#1e293b', margin: 0 }}>
                          {item.detectedSender}
                          {item.senderMismatch && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#dc2626' }}>⚠ Mismatch</span>}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div>
                          <p style={{ fontSize: '11px', color: '#d97706', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</p>
                          <p style={{ fontSize: '16px', fontWeight: 600, color: item.confidence >= 80 ? '#059669' : item.confidence >= 60 ? '#d97706' : '#dc2626', margin: 0 }}>{item.confidence}%</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '11px', color: '#d97706', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Match Score</p>
                          <p style={{ fontSize: '16px', fontWeight: 600, color: item.matchScore >= 80 ? '#059669' : item.matchScore >= 60 ? '#d97706' : '#dc2626', margin: 0 }}>{item.matchScore}%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Raw Notification */}
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', margin: '0 0 8px 0' }}>Raw Notification Text</p>
                    <div style={{ backgroundColor: '#0f172a', color: '#4ade80', borderRadius: '12px', padding: '16px', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {item.rawNotification}
                    </div>
                  </div>

                  {/* Notes & Actions */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>Review Notes (optional)</label>
                    <textarea
                      placeholder="Add notes about this review..."
                      value={notes[item.id] || ''}
                      onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                      style={{
                        width: '100%', padding: '12px 16px', backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px',
                        resize: 'none', height: '80px', outline: 'none', fontFamily: 'inherit',
                        marginBottom: '16px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleConfirm(item.id)}
                        disabled={isLoading}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '10px 20px', backgroundColor: '#059669', color: 'white',
                          fontSize: '14px', fontWeight: 500, borderRadius: '12px',
                          border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                          opacity: isLoading ? 0.7 : 1,
                          boxShadow: '0 10px 15px -3px rgba(5,150,105,0.2)',
                        }}
                      >
                        {isLoading ? (
                          <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        {isLoading ? 'Processing...' : 'Confirm Payment'}
                      </button>
                      <button
                        onClick={() => handleReject(item.id)}
                        disabled={isLoading}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '10px 20px', backgroundColor: '#dc2626', color: 'white',
                          fontSize: '14px', fontWeight: 500, borderRadius: '12px',
                          border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                          opacity: isLoading ? 0.7 : 1,
                          boxShadow: '0 10px 15px -3px rgba(220,38,38,0.2)',
                        }}
                      >
                        {isLoading ? (
                          <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        ) : (
                          <XCircle size={16} />
                        )}
                        {isLoading ? 'Processing...' : 'Reject Payment'}
                      </button>
                      <button
                        onClick={() => showToast?.('info', 'Support ticket created')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '10px 20px', backgroundColor: '#f1f5f9', color: '#475569',
                          fontSize: '14px', fontWeight: 500, borderRadius: '12px',
                          border: 'none', cursor: 'pointer',
                        }}
                      >
                        <MessageSquare size={16} />
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
