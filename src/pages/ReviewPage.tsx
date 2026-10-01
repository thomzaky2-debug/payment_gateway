import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldAlert,
  ArrowRight,
  Check,
  User,
  Hash,
  TrendingUp,
  AlertTriangle,
  Repeat,
  DollarSign,
  HelpCircle,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { transactionsApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface ReviewPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showConfirm?: (action: any) => void;
  onNavigate?: (page: any, subPath?: string) => void;
  subPath?: string;
  onSubPathChange?: (subPath?: string) => void;
}

function formatReviewDate(dateString: string | Date | undefined, isRtl: boolean): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateString);
  }
}

type CaseType =
  | 'ALL'
  | 'UNDERPAID'
  | 'OVERPAID'
  | 'LATE_PAYMENT'
  | 'HANDLE_MISMATCH'
  | 'DUPLICATE_SUSPECT'
  | 'HIGH_VALUE_REVIEW'
  | 'UNMATCHED';

function parseCaseTypeFromSubPath(sub?: string): CaseType {
  if (!sub) return 'ALL';
  const clean = sub.toLowerCase().replace(/[-_]/g, '');
  if (clean.includes('underpaid')) return 'UNDERPAID';
  if (clean.includes('overpaid')) return 'OVERPAID';
  if (clean.includes('late')) return 'LATE_PAYMENT';
  if (clean.includes('handle') || clean.includes('sender')) return 'HANDLE_MISMATCH';
  if (clean.includes('dup')) return 'DUPLICATE_SUSPECT';
  if (clean.includes('risk') || clean.includes('high')) return 'HIGH_VALUE_REVIEW';
  if (clean.includes('unmatch')) return 'UNMATCHED';
  return 'ALL';
}

function subPathFromCaseType(caseType: CaseType): string {
  switch (caseType) {
    case 'UNDERPAID':
      return 'underpaid';
    case 'OVERPAID':
      return 'overpaid';
    case 'LATE_PAYMENT':
      return 'late';
    case 'HANDLE_MISMATCH':
      return 'sender';
    case 'DUPLICATE_SUSPECT':
      return 'duplicate';
    case 'HIGH_VALUE_REVIEW':
      return 'risk';
    case 'UNMATCHED':
      return 'unmatched';
    default:
      return '';
  }
}

export function ReviewPage({ showToast, showConfirm, onNavigate, subPath, onSubPathChange }: ReviewPageProps) {
  const { isRtl } = useLanguage();
  const { isDark } = useTheme();

  const [mismatched, setMismatched] = useState<any[]>([]);
  const [underpaid, setUnderpaid] = useState<any[]>([]);
  const [overpaid, setOverpaid] = useState<any[]>([]);
  const [latePayments, setLatePayments] = useState<any[]>([]);
  const [handleMismatch, setHandleMismatch] = useState<any[]>([]);
  const [duplicateSuspect, setDuplicateSuspect] = useState<any[]>([]);
  const [highValueRisk, setHighValueRisk] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CaseType>(() => parseCaseTypeFromSubPath(subPath));

  useEffect(() => {
    if (subPath !== undefined) {
      setActiveTab(parseCaseTypeFromSubPath(subPath));
    }
  }, [subPath]);

  const handleTabClick = (caseType: CaseType) => {
    setActiveTab(caseType);
    onSubPathChange?.(subPathFromCaseType(caseType));
  };

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await transactionsApi.getReviewQueue();
      if (data.ok && data.reviewQueue) {
        setMismatched(data.reviewQueue.mismatched || []);
        setUnderpaid(data.reviewQueue.underpaid || []);
        setOverpaid(data.reviewQueue.overpaid || []);
        setLatePayments(data.reviewQueue.latePayments || []);
        setHandleMismatch(data.reviewQueue.handleMismatch || []);
        setDuplicateSuspect(data.reviewQueue.duplicateSuspect || []);
        setHighValueRisk(data.reviewQueue.highValueRisk || []);
      }
    } catch {
      if (showToast) {
        showToast('error', isRtl ? 'فشل تحميل قائمة المراجعة اليدوية' : 'Failed to fetch manual review queue');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const totalPending =
    mismatched.length +
    underpaid.length +
    overpaid.length +
    latePayments.length +
    handleMismatch.length +
    duplicateSuspect.length +
    highValueRisk.length;

  // Case category configuration
  const categories = [
    {
      type: 'ALL' as CaseType,
      labelEn: 'All Cases',
      labelAr: 'جميع الحالات',
      count: totalPending,
      icon: SlidersHorizontal,
      color: '#3b82f6',
      bgDark: 'rgba(59, 130, 246, 0.15)',
      bgLight: '#eff6ff',
      borderDark: 'rgba(59, 130, 246, 0.3)',
      borderLight: '#bfdbfe',
    },
    {
      type: 'UNDERPAID' as CaseType,
      labelEn: 'Underpaid',
      labelAr: 'مبالغ ناقصة',
      count: underpaid.length,
      icon: AlertCircle,
      color: '#ea580c',
      bgDark: 'rgba(234, 88, 12, 0.15)',
      bgLight: '#fef3c7',
      borderDark: 'rgba(234, 88, 12, 0.35)',
      borderLight: '#fed7aa',
    },
    {
      type: 'OVERPAID' as CaseType,
      labelEn: 'Overpaid',
      labelAr: 'مبالغ زائدة',
      count: overpaid.length,
      icon: TrendingUp,
      color: '#059669',
      bgDark: 'rgba(5, 150, 105, 0.15)',
      bgLight: '#d1fae5',
      borderDark: 'rgba(5, 150, 105, 0.35)',
      borderLight: '#a7f3d0',
    },
    {
      type: 'LATE_PAYMENT' as CaseType,
      labelEn: 'Late / Expired',
      labelAr: 'دفع متأخر',
      count: latePayments.length,
      icon: Clock,
      color: '#8b5cf6',
      bgDark: 'rgba(139, 92, 246, 0.15)',
      bgLight: '#ede9fe',
      borderDark: 'rgba(139, 92, 246, 0.35)',
      borderLight: '#ddd6fe',
    },
    {
      type: 'HANDLE_MISMATCH' as CaseType,
      labelEn: 'Sender Mismatch',
      labelAr: 'اختلاف المرسل',
      count: handleMismatch.length,
      icon: User,
      color: '#0284c7',
      bgDark: 'rgba(2, 132, 199, 0.15)',
      bgLight: '#e0f2fe',
      borderDark: 'rgba(2, 132, 199, 0.35)',
      borderLight: '#bae6fd',
    },
    {
      type: 'DUPLICATE_SUSPECT' as CaseType,
      labelEn: 'Duplicate Suspect',
      labelAr: 'اشتباه تكرار',
      count: duplicateSuspect.length,
      icon: Repeat,
      color: '#d97706',
      bgDark: 'rgba(217, 119, 6, 0.15)',
      bgLight: '#fef3c7',
      borderDark: 'rgba(217, 119, 6, 0.35)',
      borderLight: '#fde68a',
    },
    {
      type: 'HIGH_VALUE_REVIEW' as CaseType,
      labelEn: 'Risk Review',
      labelAr: 'مراجعة أمنية',
      count: highValueRisk.length,
      icon: ShieldAlert,
      color: '#9333ea',
      bgDark: 'rgba(147, 51, 234, 0.15)',
      bgLight: '#f3e8ff',
      borderDark: 'rgba(147, 51, 234, 0.35)',
      borderLight: '#e9d5ff',
    },
    {
      type: 'UNMATCHED' as CaseType,
      labelEn: 'Unmatched Direct',
      labelAr: 'تحويلات يتيمة',
      count: mismatched.length,
      icon: HelpCircle,
      color: '#dc2626',
      bgDark: 'rgba(220, 38, 38, 0.15)',
      bgLight: '#fee2e2',
      borderDark: 'rgba(220, 38, 38, 0.35)',
      borderLight: '#fecaca',
    },
  ];

  // Handler for Confirm / Accept
  const handleConfirmSession = (item: any, caseTitle: string) => {
    const detected = Number(item.detectedAmountEgp || item.amountEgp || 0);
    if (!showConfirm) return;

    showConfirm({
      title: isRtl ? `تأكيد المعاملة (${caseTitle})` : `Accept & Confirm (${caseTitle})`,
      message: isRtl
        ? `هل أنت متأكد من رغبتك في اعتماد الجلسة ${item.sessionId} كمؤكدة بمبلغ ${detected.toFixed(2)} EGP؟ سيتم إتمام الطلب وتفعيل الويب هوك الخاص بك.`
        : `Are you sure you want to mark session ${item.sessionId} as CONFIRMED for ${detected.toFixed(2)} EGP? This will complete the order and trigger your webhook callback.`,
      confirmLabel: isRtl ? 'قبول وتأكيد' : 'Accept & Confirm',
      cancelLabel: isRtl ? 'إلغاء' : 'Cancel',
      variant: 'warning',
      onConfirm: async () => {
        try {
          const res = await transactionsApi.confirm(item.sessionId);
          if (res.ok) {
            if (showToast) {
              showToast(
                'success',
                isRtl ? `تم تأكيد الجلسة ${item.sessionId} بنجاح!` : `Session ${item.sessionId} confirmed!`
              );
            }
            fetchQueue();
          } else {
            if (showToast) showToast('error', res.error || (isRtl ? 'فشل التأكيد' : 'Failed to confirm'));
          }
        } catch {
          if (showToast) showToast('error', isRtl ? 'خطأ أثناء تأكيد المعاملة' : 'Error confirming payment');
        }
      },
    });
  };

  // Handler for Reject
  const handleRejectSession = (item: any) => {
    if (!showConfirm) return;

    showConfirm({
      title: isRtl ? 'رفض المعاملة' : 'Reject Transaction',
      message: isRtl
        ? `هل أنت متأكد من رفض الجلسة ${item.sessionId} وإلغائها؟ سيتم وسمها كـ REJECTED.`
        : `Are you sure you want to reject and cancel session ${item.sessionId}? It will be marked as REJECTED.`,
      confirmLabel: isRtl ? 'رفض وإلغاء' : 'Reject & Cancel',
      cancelLabel: isRtl ? 'تراجع' : 'Back',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await transactionsApi.reject(item.sessionId);
          if (res.ok) {
            if (showToast) {
              showToast(
                'info',
                isRtl ? `تم رفض الجلسة ${item.sessionId}` : `Session ${item.sessionId} rejected`
              );
            }
            fetchQueue();
          } else {
            if (showToast) showToast('error', res.error || (isRtl ? 'فشل الرفض' : 'Failed to reject'));
          }
        } catch {
          if (showToast) showToast('error', isRtl ? 'خطأ أثناء رفض المعاملة' : 'Error rejecting payment');
        }
      },
    });
  };

  // Render a Transaction Card
  const renderTransactionCard = (
    item: any,
    index: number,
    cfg: {
      badgeText: string;
      badgeColor: string;
      badgeBgDark: string;
      badgeBgLight: string;
      badgeBorderDark: string;
      badgeBorderLight: string;
      actionLabel: string;
      actionIcon: React.ReactNode;
      caseTitle: string;
      icon: React.ReactNode;
    }
  ) => {
    const expected = Number(item.amountEgp || 0);
    const detected = Number(item.detectedAmountEgp || item.amountEgp || 0);
    const diff = detected - expected;

    return (
      <div
        key={item.id}
        style={{
          backgroundColor: isDark ? '#111827' : 'white',
          borderRadius: '16px',
          border: isDark ? `1px solid ${cfg.badgeBorderDark}` : `1px solid ${cfg.badgeBorderLight}`,
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          transition: 'all 0.2s',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 20px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Left Info with Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
            {/* Counter Badge */}
            <div
              style={{
                minWidth: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                color: isDark ? '#94a3b8' : '#64748b',
                fontSize: '11px',
                fontWeight: 800,
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
              }}
            >
              #{index + 1}
            </div>

            {/* Case Icon Circle */}
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: isDark ? cfg.badgeBgDark : cfg.badgeBgLight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {cfg.icon}
            </div>

            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h4
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: isDark ? '#38bdf8' : '#0284c7',
                    margin: 0,
                  }}
                >
                  {item.sessionId}
                </h4>

                <span
                  style={{
                    padding: '2px 8px',
                    backgroundColor: isDark ? cfg.badgeBgDark : cfg.badgeBgLight,
                    color: cfg.badgeColor,
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: isDark ? `1px solid ${cfg.badgeBorderDark}` : `1px solid ${cfg.badgeBorderLight}`,
                  }}
                >
                  {cfg.badgeText}
                </span>

                {item.note && (
                  <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                    ({item.note})
                  </span>
                )}
              </div>

              {/* Details Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: isDark ? '#cbd5e1' : '#475569',
                  marginTop: '4px',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <strong>{isRtl ? 'المرسل:' : 'Sender:'}</strong>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{item.senderHandle || '—'}</span>
                </span>
                <span>•</span>
                <span>
                  {isRtl ? 'المطلوب: ' : 'Expected: '}
                  <strong style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>{expected.toFixed(2)} EGP</strong>
                </span>
                <span>•</span>
                <span>
                  {isRtl ? 'المحول: ' : 'Transferred: '}
                  <strong style={{ color: '#10b981' }}>{detected.toFixed(2)} EGP</strong>
                </span>

                {/* Diff Tag */}
                {diff < 0 && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>
                      ({isRtl ? `عجز ${Math.abs(diff).toFixed(2)} EGP` : `Short by ${Math.abs(diff).toFixed(2)} EGP`})
                    </span>
                  </>
                )}
                {diff > 0 && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>
                      ({isRtl ? `زيادة +${diff.toFixed(2)} EGP` : `Excess +${diff.toFixed(2)} EGP`})
                    </span>
                  </>
                )}

                {item.detectedRef && (
                  <>
                    <span>•</span>
                    <span>
                      {isRtl ? 'المرجع:' : 'Ref:'}{' '}
                      <span style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 600 }}>
                        {item.detectedRef}
                      </span>
                    </span>
                  </>
                )}

                <span>•</span>
                <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#94a3b8' }}>
                  <Clock size={11} style={{ display: 'inline', marginInlineEnd: '3px' }} />
                  {formatReviewDate(item.createdAt, isRtl)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => handleConfirmSession(item, cfg.caseTitle)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '9px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.15s',
              }}
            >
              {cfg.actionIcon}
              <span>{cfg.actionLabel}</span>
            </button>

            <button
              onClick={() => handleRejectSession(item)}
              style={{
                padding: '8px 12px',
                backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                color: isDark ? '#94a3b8' : '#64748b',
                border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                borderRadius: '9px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s',
              }}
            >
              <X size={13} />
              <span>{isRtl ? 'رفض' : 'Reject'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
              {isRtl ? 'قائمة المراجعة اليدوية (جميع الحالات)' : 'Manual Review Queue (All Cases)'}
            </h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 10px',
                backgroundColor:
                  totalPending > 0
                    ? isDark
                      ? 'rgba(234, 88, 12, 0.18)'
                      : '#fed7aa'
                    : isDark
                    ? 'rgba(16, 185, 129, 0.18)'
                    : '#d1fae5',
                color: totalPending > 0 ? '#ea580c' : '#10b981',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '8px',
                border:
                  totalPending > 0
                    ? isDark
                      ? '1px solid rgba(234, 88, 12, 0.3)'
                      : '1px solid #fdba74'
                    : isDark
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : '1px solid #a7f3d0',
              }}
            >
              {totalPending > 0 ? (
                <>
                  <AlertCircle size={13} />
                  <span>{isRtl ? `${totalPending} حالات معلقة تتطلب تدخلك` : `${totalPending} Pending Cases`}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} />
                  <span>{isRtl ? 'كل المعاملات معتمدة' : 'All Clear'}</span>
                </>
              )}
            </span>
          </div>
          <p style={{ fontSize: '14px', color: isDark ? '#94a3b8' : '#64748b', margin: '4px 0 0 0' }}>
            {isRtl
              ? 'مراجعة كافة حالات المدفوعات غير القياسية: مبالغ ناقصة، مبالغ زائدة، دفع متأخر، اختلاف اسم المرسل، اشتباه التكرار، والتحويلات اليتيمة.'
              : 'Review all payment anomaly cases: underpaid, overpaid, late expired, sender mismatch, suspected duplicate, risk review, and unmatched transfers.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={fetchQueue}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              backgroundColor: isDark ? '#1e293b' : 'white',
              border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
              color: isDark ? '#f8fafc' : '#334155',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {isRtl ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Tolerance & Auto-Acceptance Guidance Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#f0fdf4',
          border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid #bbf7d0',
          borderRadius: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>💡</span>
          <span style={{ fontSize: '13px', color: isDark ? '#cbd5e1' : '#1e293b' }}>
            {isRtl
              ? 'يمكنك ضبط القبول التلقائي للمبالغ الزائدة وتحديد هامش دقة مسموح به للعجز في الدفع من صفحة الإعدادات لتجنب تعليق الطلبات.'
              : 'You can control automatic acceptance of overpaid transfers and configure agreed underpaid precision tolerances in Settings.'}
          </span>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('settings', 'Precision')}
            style={{
              padding: '7px 14px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
            }}
          >
            {isRtl ? '⚙️ ضبط قواعد السماحية' : '⚙️ Configure Precision Rules'}
          </button>
        )}
      </div>

      {/* Case Category Tabs / Filter Chips */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '24px',
          whiteSpace: 'nowrap',
        }}
      >
        {categories.map((cat) => {
          const isActive = activeTab === cat.type;
          const Icon = cat.icon;
          return (
            <button
              key={cat.type}
              onClick={() => handleTabClick(cat.type)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                backgroundColor: isActive
                  ? cat.color
                  : isDark
                  ? '#1e293b'
                  : 'white',
                color: isActive ? 'white' : isDark ? '#cbd5e1' : '#475569',
                border: isActive
                  ? `1px solid ${cat.color}`
                  : isDark
                  ? '1px solid #334155'
                  : '1px solid #e2e8f0',
                transition: 'all 0.15s',
                boxShadow: isActive ? `0 4px 10px ${cat.color}33` : 'none',
              }}
            >
              <Icon size={14} />
              <span>{isRtl ? cat.labelAr : cat.labelEn}</span>
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: isActive
                    ? 'rgba(255, 255, 255, 0.25)'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#f1f5f9',
                  color: isActive ? 'white' : cat.color,
                }}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div
          style={{
            padding: '64px',
            textAlign: 'center',
            color: isDark ? '#94a3b8' : '#64748b',
            backgroundColor: isDark ? '#111827' : 'white',
            borderRadius: '20px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0',
          }}
        >
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#10b981' }} />
          <div>{isRtl ? 'جاري تحميل قائمة المراجعة...' : 'Loading review queue...'}</div>
        </div>
      ) : totalPending === 0 ? (
        <div
          style={{
            backgroundColor: isDark ? '#111827' : 'white',
            borderRadius: '20px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0',
            padding: '56px 24px',
            textAlign: 'center',
          }}
        >
          <CheckCircle2 size={56} style={{ color: '#10b981', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: isDark ? '#f8fafc' : '#1e293b', margin: '0 0 8px 0' }}>
            {isRtl ? 'جميع المدفوعات مطابقة ومعتمدة!' : 'All caught up!'}
          </h3>
          <p style={{ fontSize: '14px', color: isDark ? '#94a3b8' : '#64748b', margin: 0 }}>
            {isRtl
              ? 'لا توجد معاملات أو تحويلات بحاجة لمراجعة يدوية في الوقت الحالي.'
              : 'No payments need manual review at this time.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* 1. Underpaid Checkouts Section */}
          {(activeTab === 'ALL' || activeTab === 'UNDERPAID') && underpaid.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
                  {isRtl ? '⚠️ مدفوعات بمبلغ أقل من المطلوب (Underpaid Checkouts)' : '⚠️ Underpaid Checkouts'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(234, 88, 12, 0.15)' : '#fed7aa',
                    color: '#ea580c',
                    border: isDark ? '1px solid rgba(234, 88, 12, 0.3)' : '1px solid #fdba74',
                  }}
                >
                  {underpaid.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {underpaid.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'UNDERPAID',
                    badgeColor: '#ea580c',
                    badgeBgDark: 'rgba(234, 88, 12, 0.15)',
                    badgeBgLight: '#fed7aa',
                    badgeBorderDark: 'rgba(234, 88, 12, 0.35)',
                    badgeBorderLight: '#fdba74',
                    actionLabel: isRtl ? 'قبول وتأكيد' : 'Accept & Confirm',
                    actionIcon: <Check size={14} />,
                    caseTitle: isRtl ? 'مبلغ ناقص' : 'Underpaid',
                    icon: <AlertCircle size={22} style={{ color: '#ea580c' }} />,
                  })
                )}
              </div>
            </div>
          )}

          {/* 2. Overpaid Checkouts Section */}
          {(activeTab === 'ALL' || activeTab === 'OVERPAID') && overpaid.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
                  {isRtl ? '🟢 مدفوعات بمبلغ زائد (Overpaid / Excess Checkouts)' : '🟢 Overpaid Checkouts (Excess Amount)'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#d1fae5',
                    color: '#059669',
                    border: isDark ? '1px solid rgba(5, 150, 105, 0.3)' : '1px solid #a7f3d0',
                  }}
                >
                  {overpaid.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {overpaid.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'OVERPAID',
                    badgeColor: '#059669',
                    badgeBgDark: 'rgba(5, 150, 105, 0.15)',
                    badgeBgLight: '#d1fae5',
                    badgeBorderDark: 'rgba(5, 150, 105, 0.35)',
                    badgeBorderLight: '#a7f3d0',
                    actionLabel: isRtl ? 'قبول وإضافة الفائض' : 'Accept & Credit',
                    actionIcon: <Check size={14} />,
                    caseTitle: isRtl ? 'مبلغ زائد' : 'Overpaid',
                    icon: <TrendingUp size={22} style={{ color: '#059669' }} />,
                  })
                )}
              </div>
            </div>
          )}

          {/* 3. Late / Expired Session Payments Section */}
          {(activeTab === 'ALL' || activeTab === 'LATE_PAYMENT') && latePayments.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
                  {isRtl ? '⏱️ مدفوعات متأخرة بعد انتهاء الجلسة (Late / Expired Payments)' : '⏱️ Late / Expired Session Payments'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe',
                    color: '#8b5cf6',
                    border: isDark ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid #ddd6fe',
                  }}
                >
                  {latePayments.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {latePayments.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'LATE PAYMENT',
                    badgeColor: '#8b5cf6',
                    badgeBgDark: 'rgba(139, 92, 246, 0.15)',
                    badgeBgLight: '#ede9fe',
                    badgeBorderDark: 'rgba(139, 92, 246, 0.35)',
                    badgeBorderLight: '#ddd6fe',
                    actionLabel: isRtl ? 'اعتماد الطلب' : 'Honor & Confirm',
                    actionIcon: <Check size={14} />,
                    caseTitle: isRtl ? 'دفع متأخر' : 'Late Payment',
                    icon: <Clock size={22} style={{ color: '#8b5cf6' }} />,
                  })
                )}
              </div>
            </div>
          )}

          {/* 4. Sender Handle Discrepancy Section */}
          {(activeTab === 'ALL' || activeTab === 'HANDLE_MISMATCH') && handleMismatch.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
                  {isRtl ? '👤 اختلاف حساب المرسل (Sender Handle Discrepancy)' : '👤 Sender Handle Discrepancy (Third-Party Payer)'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe',
                    color: '#0284c7',
                    border: isDark ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid #bae6fd',
                  }}
                >
                  {handleMismatch.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {handleMismatch.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'HANDLE MISMATCH',
                    badgeColor: '#0284c7',
                    badgeBgDark: 'rgba(2, 132, 199, 0.15)',
                    badgeBgLight: '#e0f2fe',
                    badgeBorderDark: 'rgba(2, 132, 199, 0.35)',
                    badgeBorderLight: '#bae6fd',
                    actionLabel: isRtl ? 'اعتماد الحساب وتأكيد' : 'Approve & Confirm',
                    actionIcon: <Check size={14} />,
                    caseTitle: isRtl ? 'اختلاف حساب المرسل' : 'Sender Mismatch',
                    icon: <User size={22} style={{ color: '#0284c7' }} />,
                  })
                )}
              </div>
            </div>
          )}

          {/* 5. Suspected Duplicate Payments Section */}
          {(activeTab === 'ALL' || activeTab === 'DUPLICATE_SUSPECT') && duplicateSuspect.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
                  {isRtl ? '🔁 اشتباه تحويل مكرر (Suspected Duplicate Payments)' : '🔁 Suspected Duplicate Transfers'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#fef3c7',
                    color: '#d97706',
                    border: isDark ? '1px solid rgba(217, 119, 6, 0.3)' : '1px solid #fde68a',
                  }}
                >
                  {duplicateSuspect.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {duplicateSuspect.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'DUPLICATE SUSPECT',
                    badgeColor: '#d97706',
                    badgeBgDark: 'rgba(217, 119, 6, 0.15)',
                    badgeBgLight: '#fef3c7',
                    badgeBorderDark: 'rgba(217, 119, 6, 0.35)',
                    badgeBorderLight: '#fde68a',
                    actionLabel: isRtl ? 'تأكيد كطلب منفصل' : 'Confirm Separate',
                    actionIcon: <Repeat size={14} />,
                    caseTitle: isRtl ? 'اشتباه تكرار' : 'Duplicate Suspect',
                    icon: <Repeat size={22} style={{ color: '#d97706' }} />,
                  })
                )}
              </div>
            </div>
          )}

          {/* 6. High-Value / Risk Review Section */}
          {(activeTab === 'ALL' || activeTab === 'HIGH_VALUE_REVIEW') && highValueRisk.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
                  {isRtl ? '🛡️ مراجعة أمنية / مبالغ كبيرة (Risk & High-Value Clearance)' : '🛡️ High-Value & Risk Velocity Review'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(147, 51, 234, 0.15)' : '#f3e8ff',
                    color: '#9333ea',
                    border: isDark ? '1px solid rgba(147, 51, 234, 0.3)' : '1px solid #e9d5ff',
                  }}
                >
                  {highValueRisk.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {highValueRisk.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'HIGH-VALUE REVIEW',
                    badgeColor: '#9333ea',
                    badgeBgDark: 'rgba(147, 51, 234, 0.15)',
                    badgeBgLight: '#f3e8ff',
                    badgeBorderDark: 'rgba(147, 51, 234, 0.35)',
                    badgeBorderLight: '#e9d5ff',
                    actionLabel: isRtl ? 'الموافقة والإفراج' : 'Approve Payment',
                    actionIcon: <ShieldAlert size={14} />,
                    caseTitle: isRtl ? 'مراجعة أمنية' : 'Risk Review',
                    icon: <ShieldAlert size={22} style={{ color: '#9333ea' }} />,
                  })
                )}
              </div>
            </div>
          )}

          {/* 7. Unmatched Direct Transfers Section */}
          {(activeTab === 'ALL' || activeTab === 'UNMATCHED') && mismatched.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
                  {isRtl ? '🔍 تحويلات مباشرة بدون جلسة دفع (Unmatched Direct Transfers)' : '🔍 Unmatched Direct Transfers'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                    color: '#ef4444',
                    border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fca5a5',
                  }}
                >
                  {mismatched.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {mismatched.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: isDark ? '#111827' : 'white',
                      borderRadius: '16px',
                      border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #e2e8f0',
                      overflow: 'hidden',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '18px 20px',
                        flexWrap: 'wrap',
                        gap: '16px',
                      }}
                    >
                      {/* Left Info with Counter */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
                        {/* Counter Badge */}
                        <div
                          style={{
                            minWidth: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                            color: isDark ? '#94a3b8' : '#64748b',
                            fontSize: '11px',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                          }}
                        >
                          #{index + 1}
                        </div>

                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <XCircle size={22} style={{ color: '#dc2626' }} />
                        </div>

                        <div style={{ flex: 1, minWidth: '220px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
                              {isRtl ? 'تحويل بنكي يتيم' : 'Orphaned Bank Transfer'}
                            </h4>
                            <span
                              style={{
                                padding: '2px 8px',
                                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                                color: '#b91c1c',
                                fontSize: '11px',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fecaca',
                              }}
                            >
                              UNMATCHED
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              color: isDark ? '#cbd5e1' : '#475569',
                              marginTop: '4px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span>
                              <strong>{isRtl ? 'من حساب:' : 'From:'}</strong>{' '}
                              <span style={{ fontFamily: 'monospace' }}>{item.senderHandle}</span>
                            </span>
                            <span>•</span>
                            <span>
                              {isRtl ? 'المبلغ المحول:' : 'Amount:'}{' '}
                              <strong style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                                {Number(item.amountEgp).toFixed(2)} EGP
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              {isRtl ? 'المرجع البنكي:' : 'Ref:'}{' '}
                              <span style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 600 }}>
                                {item.reference || '—'}
                              </span>
                            </span>
                            <span>•</span>
                            <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#94a3b8' }}>
                              <Clock size={11} style={{ display: 'inline', marginInlineEnd: '3px' }} />
                              {formatReviewDate(item.createdAt, isRtl)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button: Dismiss */}
                      <div>
                        <button
                          onClick={async () => {
                            try {
                              const res = await transactionsApi.dismissReviewItem(item.id);
                              if (res.ok) {
                                if (showToast) {
                                  showToast('info', isRtl ? 'تم تجاهل السجل وحفظه' : 'Unmatched record dismissed');
                                }
                                fetchQueue();
                              }
                            } catch {
                              if (showToast) showToast('error', isRtl ? 'فشل تجاهل السجل' : 'Failed to dismiss item');
                            }
                          }}
                          style={{
                            padding: '8px 14px',
                            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                            color: isDark ? '#cbd5e1' : '#475569',
                            border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                            borderRadius: '9px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {isRtl ? 'تجاهل السجل' : 'Dismiss Record'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
