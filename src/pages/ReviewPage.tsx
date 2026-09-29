import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { transactionsApi } from '../services/api';

interface ReviewPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showConfirm?: (action: any) => void;
}

export function ReviewPage({ showToast, showConfirm }: ReviewPageProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mismatched, setMismatched] = useState<any[]>([]);
  const [underpaid, setUnderpaid] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await transactionsApi.getReviewQueue();
      if (data.ok && data.reviewQueue) {
        setMismatched(data.reviewQueue.mismatched || []);
        setUnderpaid(data.reviewQueue.underpaid || []);
      }
    } catch (err: any) {
      if (showToast) {
        showToast('error', 'Failed to fetch manual review queue');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const totalPending = mismatched.length + underpaid.length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Manual Review Queue</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Review unmatched or underpaid payments that need attention</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={fetchQueue}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <span style={{ padding: '6px 12px', backgroundColor: '#fed7aa', color: '#c2410c', fontSize: '13px', fontWeight: 600, borderRadius: '8px' }}>
            {totalPending} pending items
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', backgroundColor: 'white', borderRadius: '16px' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#10b981' }} />
          Loading review queue...
        </div>
      ) : totalPending === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '48px', textAlign: 'center' }}>
          <CheckCircle2 size={56} style={{ color: '#10b981', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 8px 0' }}>All caught up!</h3>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>No payments need manual review at this time.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {underpaid.map((item) => (
            <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #fed7aa', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertCircle size={22} style={{ color: '#ea580c' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: 0 }}>{item.sessionId}</h4>
                      <span style={{ padding: '2px 8px', backgroundColor: '#fef3c7', color: '#b45309', fontSize: '11px', fontWeight: 700, borderRadius: '9999px' }}>
                        UNDERPAID
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                      Sender: {item.senderHandle} • Expected {item.amountEgp.toFixed(2)} EGP, detected {item.detectedAmountEgp?.toFixed(2) || '0.00'} EGP
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {mismatched.map((item) => (
            <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <XCircle size={22} style={{ color: '#dc2626' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Unmatched Payment</h4>
                      <span style={{ padding: '2px 8px', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 700, borderRadius: '9999px' }}>
                        ORPHANED
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                      From {item.senderHandle} • Amount: {item.amountEgp.toFixed(2)} EGP • Ref: {item.reference || '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
