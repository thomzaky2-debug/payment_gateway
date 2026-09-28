import React from 'react';
import { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const reviewItems = [
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
];

export function ReviewPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);

  const remainingItems = reviewItems.filter((item) => !confirmed.includes(item.id));

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Manual Review Queue</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Review payments that need manual approval</p>
        </div>
        <span style={{ padding: '6px 12px', backgroundColor: '#fed7aa', color: '#c2410c', fontSize: '14px', fontWeight: 500, borderRadius: '8px' }}>
          {remainingItems.length} pending
        </span>
      </div>

      {remainingItems.length === 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '48px', textAlign: 'center' }}>
          <CheckCircle2 size={64} style={{ color: '#10b981', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b', margin: '0 0 8px 0' }}>All caught up!</h3>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>No payments need manual review at this time.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {remainingItems.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertCircle size={24} style={{ color: '#ea580c' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: 0 }}>{item.orderId}</h4>
                      <span style={{ padding: '2px 8px', backgroundColor: '#fed7aa', color: '#c2410c', fontSize: '12px', fontWeight: 500, borderRadius: '9999px' }}>
                        Needs Review
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                      Received {item.receivedAt} • {item.language === 'en' ? 'English' : 'Arabic'} notification
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{item.expectedAmount}</span>
                  <span style={{ fontSize: '20px', color: '#94a3b8' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                    <div style={{ backgroundColor: '#eff6ff', borderRadius: '12px', padding: '16px' }}>
                      <h5 style={{ fontSize: '14px', fontWeight: 600, color: '#1e40af', margin: '0 0 12px 0' }}>👁️ Expected Payment</h5>
                      <div>
                        <p style={{ fontSize: '12px', color: '#3b82f6', margin: '0 0 4px 0' }}>Amount</p>
                        <p style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 500, color: '#1e293b', margin: '0 0 12px 0' }}>{item.expectedAmount}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: '#3b82f6', margin: '0 0 4px 0' }}>Expected Sender</p>
                        <p style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 500, color: '#1e293b', margin: 0 }}>{item.expectedSender}</p>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#fffbeb', borderRadius: '12px', padding: '16px' }}>
                      <h5 style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', margin: '0 0 12px 0' }}>⚠️ Detected Payment</h5>
                      <div>
                        <p style={{ fontSize: '12px', color: '#d97706', margin: '0 0 4px 0' }}>Amount</p>
                        <p style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 500, color: '#1e293b', margin: '0 0 12px 0' }}>{item.detectedAmount}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: '#d97706', margin: '0 0 4px 0' }}>Detected Sender</p>
                        <p style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 500, color: '#1e293b', margin: '0 0 12px 0' }}>{item.detectedSender}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div>
                          <p style={{ fontSize: '12px', color: '#d97706', margin: '0 0 4px 0' }}>Confidence</p>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: item.confidence >= 80 ? '#059669' : item.confidence >= 60 ? '#d97706' : '#dc2626', margin: 0 }}>{item.confidence}%</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', color: '#d97706', margin: '0 0 4px 0' }}>Match Score</p>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: item.matchScore >= 80 ? '#059669' : item.matchScore >= 60 ? '#d97706' : '#dc2626', margin: 0 }}>{item.matchScore}%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', margin: '0 0 8px 0' }}>Raw Notification Text</p>
                    <div style={{ backgroundColor: '#0f172a', color: '#4ade80', borderRadius: '12px', padding: '16px', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                      {item.rawNotification}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setConfirmed([...confirmed, item.id])}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 20px', backgroundColor: '#059669', color: 'white',
                        fontSize: '14px', fontWeight: 500, borderRadius: '12px',
                        border: 'none', cursor: 'pointer',
                        boxShadow: '0 10px 15px -3px rgba(5,150,105,0.2)'
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Confirm Payment
                    </button>
                    <button style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 20px', backgroundColor: '#dc2626', color: 'white',
                      fontSize: '14px', fontWeight: 500, borderRadius: '12px',
                      border: 'none', cursor: 'pointer',
                      boxShadow: '0 10px 15px -3px rgba(220,38,38,0.2)'
                    }}>
                      <XCircle size={16} />
                      Reject Payment
                    </button>
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
