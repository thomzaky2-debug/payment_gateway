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

    const executeConfirm = async () => {
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
    };

    if (!showConfirm) {
      if (window.confirm(isRtl ? `تأكيد الجلسة ${item.sessionId} بمبلغ ${detected.toFixed(2)} EGP؟` : `Confirm session ${item.sessionId} for ${detected.toFixed(2)} EGP?`)) {
        void executeConfirm();
      }
      return;
    }

    showConfirm({
      title: isRtl ? `تأكيد المعاملة (${caseTitle})` : `Accept & Confirm (${caseTitle})`,
      message: isRtl
        ? `هل أنت متأكد من رغبتك في اعتماد الجلسة ${item.sessionId} كمؤكدة بمبلغ ${detected.toFixed(2)} EGP؟ سيتم إتمام الطلب وتفعيل الويب هوك الخاص بك.`
        : `Are you sure you want to mark session ${item.sessionId} as CONFIRMED for ${detected.toFixed(2)} EGP? This will complete the order and trigger your webhook callback.`,
      confirmLabel: isRtl ? 'قبول وتأكيد' : 'Accept & Confirm',
      cancelLabel: isRtl ? 'إلغاء' : 'Cancel',
      variant: 'warning',
      onConfirm: executeConfirm,
    });
  };

  // Handler for Reject
  const handleRejectSession = (item: any) => {
    const executeReject = async () => {
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
    };

    if (!showConfirm) {
      if (window.confirm(isRtl ? `هل أنت متأكد من رفض الجلسة ${item.sessionId}؟` : `Reject session ${item.sessionId}?`)) {
        void executeReject();
      }
      return;
    }

    showConfirm({
      title: isRtl ? 'رفض المعاملة' : 'Reject Transaction',
      message: isRtl
        ? `هل أنت متأكد من رفض الجلسة ${item.sessionId} وإلغائها؟ سيتم وسمها كـ REJECTED.`
        : `Are you sure you want to reject and cancel session ${item.sessionId}? It will be marked as REJECTED.`,
      confirmLabel: isRtl ? 'رفض وإلغاء' : 'Reject & Cancel',
      cancelLabel: isRtl ? 'تراجع' : 'Back',
      variant: 'danger',
      onConfirm: executeReject,
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
        className="review-tx-card"
        style={{
          backgroundColor: isDark ? '#111827' : '#ffffff',
          borderRadius: '16px',
          border: isDark ? `1px solid ${cfg.badgeBorderDark}` : `1px solid ${cfg.badgeBorderLight}`,
          overflow: 'hidden',
          boxShadow: isDark
            ? '0 6px 18px -4px rgba(0,0,0,0.35)'
            : '0 4px 14px rgba(0,0,0,0.05)',
          transition: 'all 0.25s ease',
        }}
      >
        {/* Header: Counter, Icon, Session ID, and Status Badge */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.3)' : '1px solid #f1f5f9',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            {/* Counter Badge */}
            <div
              style={{
                minWidth: '26px',
                height: '26px',
                borderRadius: '7px',
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

            {/* Case Icon */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '9px',
                backgroundColor: isDark ? cfg.badgeBgDark : cfg.badgeBgLight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: isDark ? `1px solid ${cfg.badgeBorderDark}` : `1px solid ${cfg.badgeBorderLight}`,
              }}
            >
              {cfg.icon}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                {item.sessionId}
              </span>
            </div>
          </div>

          <span
            style={{
              padding: '3px 8px',
              backgroundColor: isDark ? cfg.badgeBgDark : cfg.badgeBgLight,
              color: cfg.badgeColor,
              fontSize: '10.5px',
              fontWeight: 800,
              borderRadius: '6px',
              border: isDark ? `1px solid ${cfg.badgeBorderDark}` : `1px solid ${cfg.badgeBorderLight}`,
              letterSpacing: '0.02em',
              flexShrink: 0,
            }}
          >
            {cfg.badgeText}
          </span>
        </div>

        {/* Note / Purpose (if available) */}
        {item.note && (
          <div
            style={{
              padding: '6px 16px',
              fontSize: '11.5px',
              color: isDark ? '#cbd5e1' : '#475569',
              fontWeight: 500,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.2)' : '1px solid #f1f5f9',
            }}
          >
            🛍️ <span>{item.note}</span>
          </div>
        )}

        {/* Comparison Data Box (Expected, Transferred, Variance) */}
        <div
          style={{
            backgroundColor: isDark ? '#162033' : '#f8fafc',
            padding: '12px 16px',
            borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.3)' : '1px solid #f1f5f9',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              textAlign: 'center',
            }}
          >
            {/* Expected */}
            <div
              style={{
                padding: '8px',
                borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'white',
                border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                {isRtl ? 'المطلوب' : 'Expected'}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', marginTop: '2px' }}>
                {expected.toFixed(0)} <span style={{ fontSize: '10px', fontWeight: 600 }}>EGP</span>
              </div>
            </div>

            {/* Transferred */}
            <div
              style={{
                padding: '8px',
                borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'white',
                border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                {isRtl ? 'المحول' : 'Transferred'}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                {detected.toFixed(0)} <span style={{ fontSize: '10px', fontWeight: 600 }}>EGP</span>
              </div>
            </div>

            {/* Variance */}
            <div
              style={{
                padding: '8px',
                borderRadius: '10px',
                backgroundColor: diff < 0
                  ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2')
                  : diff > 0
                  ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5')
                  : (isDark ? 'rgba(0,0,0,0.25)' : 'white'),
                border: diff < 0
                  ? (isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fca5a5')
                  : diff > 0
                  ? (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0')
                  : (isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0'),
              }}
            >
              <div style={{ fontSize: '10px', color: diff < 0 ? '#ef4444' : diff > 0 ? '#10b981' : (isDark ? '#94a3b8' : '#64748b'), fontWeight: 600, textTransform: 'uppercase' }}>
                {isRtl ? 'الفارق' : 'Variance'}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: diff < 0 ? '#ef4444' : diff > 0 ? '#10b981' : (isDark ? '#f8fafc' : '#0f172a'), marginTop: '2px' }}>
                {diff < 0 ? `-${Math.abs(diff).toFixed(0)}` : diff > 0 ? `+${diff.toFixed(0)}` : '0'} <span style={{ fontSize: '10px', fontWeight: 600 }}>EGP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata Row: Sender, Ref ID, and Time */}
        <div
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: '11.5px',
            color: isDark ? '#94a3b8' : '#64748b',
            borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.3)' : '1px solid #f1f5f9',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
            <span>{isRtl ? 'المرسل:' : 'From:'}</span>
            <strong style={{ fontFamily: 'monospace', color: isDark ? '#f8fafc' : '#0f172a' }}>
              {item.senderHandle || '—'}
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {item.detectedRef && (
              <span style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 700, fontSize: '11px' }}>
                #{item.detectedRef}
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}>
              <Clock size={11} />
              {formatReviewDate(item.createdAt, isRtl)}
            </span>
          </div>
        </div>

        {/* Thumb-friendly Action Buttons */}
        <div
          className="review-card-actions"
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: isDark ? '#111827' : '#ffffff',
          }}
        >
          <button
            className="review-btn-confirm"
            onClick={() => handleConfirmSession(item, cfg.caseTitle)}
            style={{
              flex: 2,
              minHeight: '40px',
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            {cfg.actionIcon}
            <span>{cfg.actionLabel}</span>
          </button>

          <button
            className="review-btn-reject"
            onClick={() => handleRejectSession(item)}
            style={{
              flex: 1,
              minHeight: '40px',
              padding: '8px 14px',
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              color: isDark ? '#94a3b8' : '#64748b',
              border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={13} />
            <span>{isRtl ? 'رفض' : 'Reject'}</span>
          </button>
        </div>
      </div>
    );
  };

  /* ──────────────── Shared "Detector Companion" Theme Styles ──────────────── */
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    backgroundColor: isDark ? '#111827' : '#ffffff',
    borderRadius: '20px',
    border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0',
    boxShadow: isDark
      ? '0 10px 25px -5px rgba(0,0,0,0.45), 0 8px 10px -6px rgba(0,0,0,0.3)'
      : '0 4px 16px rgba(0,0,0,0.06)',
    transition: 'all 0.3s ease',
    ...extra,
  });

  const subcard = (extra?: React.CSSProperties): React.CSSProperties => ({
    backgroundColor: isDark ? '#162033' : '#f8fafc',
    borderRadius: '14px',
    border: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0',
    ...extra,
  });

  const textPrimary = isDark ? '#f8fafc' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const accent = '#38bdf8';

  return (
    <div className="merchant-page-container" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ─── Page Header (Detector Companion Style) ─── */}
      <div
        className="review-header-row"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '22px',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={20} color="white" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 'clamp(18px, 2.5vw, 22px)', fontWeight: 800, color: textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
                  {isRtl ? 'قائمة المراجعة اليدوية' : 'Manual Review Queue'}
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    backgroundColor:
                      totalPending > 0
                        ? isDark
                          ? 'rgba(234, 88, 12, 0.18)'
                          : '#fed7aa'
                        : isDark
                        ? 'rgba(16, 185, 129, 0.18)'
                        : '#d1fae5',
                    color: totalPending > 0 ? '#ea580c' : '#10b981',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    borderRadius: '7px',
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
                      <AlertCircle size={12} />
                      <span>{isRtl ? `${totalPending} حالات معلقة` : `${totalPending} Pending Cases`}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={12} />
                      <span>{isRtl ? 'كل المعاملات معتمدة' : 'All Clear'}</span>
                    </>
                  )}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
                {isRtl
                  ? 'مراجعة كافة حالات المدفوعات غير القياسية: مبالغ ناقصة، مبالغ زائدة، دفع متأخر، واختلاف اسم المرسل.'
                  : 'Review all payment anomaly cases: underpaid, overpaid, late expired, and sender mismatch.'}
              </p>
            </div>
          </div>
        </div>

        <div className="review-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchQueue}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              padding: '8px 16px',
              backgroundColor: isDark ? '#1e293b' : 'white',
              border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
              color: textPrimary,
              borderRadius: '11px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.06)',
              whiteSpace: 'nowrap',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{isRtl ? 'تحديث البيانات' : 'Refresh Queue'}</span>
          </button>
        </div>
      </div>

      {/* ─── Hero Review Status Banner (Detector Companion Style) ─── */}
      <div
        className="review-hero-card"
        style={{
          ...card(),
          background: totalPending > 0
            ? (isDark
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.12))'
              : 'linear-gradient(135deg, #f59e0b, #ef4444)')
            : (isDark
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.1))'
              : 'linear-gradient(135deg, #10b981, #06b6d4)'),
          border: totalPending > 0
            ? (isDark ? '1px solid rgba(245, 158, 11, 0.35)' : 'none')
            : (isDark ? '1px solid rgba(16, 185, 129, 0.35)' : 'none'),
          padding: '22px 26px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative', zIndex: 1, minWidth: 0, flex: 1 }}>
          <div
            className="review-hero-icon"
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backdropFilter: 'blur(10px)',
              border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : 'none',
            }}
          >
            <ShieldAlert size={24} color={isDark ? '#fbbf24' : 'white'} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3
                className="review-hero-title"
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  margin: 0,
                  color: isDark ? '#fbbf24' : 'white',
                }}
              >
                {totalPending > 0
                  ? (isRtl ? `${totalPending} حالات بحاجة للمراجعة اليدوية` : `${totalPending} Anomalies Awaiting Review`)
                  : (isRtl ? 'جميع الحالات محلولة ومعتمدة' : 'All Anomaly Cases Resolved & Clear')}
              </h3>
              <div
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: totalPending > 0
                    ? (isDark ? '#fbbf24' : 'white')
                    : (isDark ? '#34d399' : 'white'),
                  animation: 'pulseGreen 2s ease-in-out infinite',
                  boxShadow: isDark
                    ? (totalPending > 0 ? '0 0 10px rgba(251,191,36,0.6)' : '0 0 10px rgba(52,211,153,0.5)')
                    : '0 0 10px rgba(255,255,255,0.6)',
                }}
              />
            </div>
            <p
              className="review-hero-desc"
              style={{
                fontSize: '12px',
                margin: '3px 0 0 0',
                color: isDark ? '#94a3b8' : 'rgba(255, 255, 255, 0.9)',
                fontWeight: 500,
              }}
            >
              {totalPending > 0
                ? (isRtl
                  ? 'تم رصد مبالغ غير متطابقة أو دفع متأخر تتطلب إجراء منك'
                  : 'Action needed on detected amounts, late checkouts, or sender discrepancies')
                : (isRtl
                  ? 'الكاشف الآلي يقوم بمطابقة التحويلات الواردة فورياً بدقة 100%'
                  : 'Automated companion is live and matching incoming transfers in real time')}
            </p>
          </div>
        </div>

        {/* Frosted Metric Pills */}
        <div className="review-hero-metrics" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <div
            className="review-hero-metric-pill"
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.3)',
              textAlign: isRtl ? 'right' : 'left',
              minWidth: '95px',
            }}
          >
            <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              {isRtl ? 'الحالات المعلقة' : 'Pending Cases'}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: isDark ? '#f8fafc' : 'white', fontFamily: 'monospace', marginTop: '2px' }}>
              {totalPending}
            </div>
          </div>

          <div
            className="review-hero-metric-pill"
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.3)',
              textAlign: isRtl ? 'right' : 'left',
              minWidth: '95px',
            }}
          >
            <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              {isRtl ? 'حالة المطابقة' : 'Auto Matching'}
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: isDark ? '#34d399' : 'white', marginTop: '2px' }}>
              {isRtl ? 'نشط ولحظي' : 'Active & Live'}
            </div>
          </div>
        </div>
      </div>

      {/* Tolerance & Auto-Acceptance Guidance Subcard */}
      <div
        className="review-guidance-card"
        style={{
          ...subcard({ padding: '14px 18px', marginBottom: '18px' }),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0',
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.06)' : '#f0fdf4',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>💡</span>
          <span style={{ fontSize: '12.5px', color: isDark ? '#cbd5e1' : '#1e293b', fontWeight: 500, lineHeight: 1.4 }}>
            {isRtl
              ? 'يمكنك ضبط القبول التلقائي للمبالغ الزائدة وتحديد هامش دقة مسموح به للعجز في الدفع من صفحة الإعدادات لتجنب تعليق الطلبات.'
              : 'You can control automatic acceptance of overpaid transfers and configure agreed underpaid precision tolerances in Settings.'}
          </span>
        </div>
        {onNavigate && (
          <button
            className="review-guidance-btn"
            onClick={() => onNavigate('settings', 'Precision')}
            style={{
              padding: '7px 14px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '9px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            {isRtl ? '⚙️ قواعد السماحية' : '⚙️ Precision Rules'}
          </button>
        )}
      </div>

      {/* Case Category Tabs / Filter Chips */}
      <div
        className="review-categories-scroll"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '6px',
          marginBottom: '20px',
          whiteSpace: 'nowrap',
        }}
      >
        {categories.map((cat) => {
          const isActive = activeTab === cat.type;
          const Icon = cat.icon;
          return (
            <button
              key={cat.type}
              className="review-category-btn"
              onClick={() => handleTabClick(cat.type)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 14px',
                borderRadius: '11px',
                fontSize: '12px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                backgroundColor: isActive
                  ? cat.color
                  : isDark
                  ? '#1e293b'
                  : '#ffffff',
                color: isActive ? 'white' : isDark ? '#cbd5e1' : '#475569',
                border: isActive
                  ? `1px solid ${cat.color}`
                  : isDark
                  ? '1px solid #334155'
                  : '1px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? `0 4px 12px ${cat.color}40` : (isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.04)'),
                flexShrink: 0,
              }}
            >
              <Icon size={13} />
              <span>{isRtl ? cat.labelAr : cat.labelEn}</span>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: '7px',
                  fontSize: '10.5px',
                  fontWeight: 800,
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
                      backgroundColor: isDark ? '#111827' : '#ffffff',
                      borderRadius: '18px',
                      border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fecaca',
                      overflow: 'hidden',
                      boxShadow: isDark
                        ? '0 6px 18px -4px rgba(0,0,0,0.35)'
                        : '0 4px 14px rgba(0,0,0,0.05)',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px 20px',
                        flexWrap: 'wrap',
                        gap: '14px',
                        borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.3)' : '1px solid #f1f5f9',
                      }}
                    >
                      {/* Left Info with Counter */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                        {/* Counter Badge */}
                        <div
                          style={{
                            minWidth: '30px',
                            height: '30px',
                            borderRadius: '9px',
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
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fca5a5',
                          }}
                        >
                          <XCircle size={22} style={{ color: '#dc2626' }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: 800, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
                              {isRtl ? 'تحويل بنكي يتيم' : 'Orphaned Bank Transfer'}
                            </span>
                            <span
                              style={{
                                padding: '2px 8px',
                                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                                color: '#b91c1c',
                                fontSize: '10.5px',
                                fontWeight: 800,
                                borderRadius: '6px',
                                border: isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fecaca',
                                letterSpacing: '0.03em',
                              }}
                            >
                              UNMATCHED
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
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <X size={13} />
                          <span>{isRtl ? 'تجاهل السجل' : 'Dismiss Record'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Details Subcard Block */}
                    <div
                      style={{
                        backgroundColor: isDark ? '#162033' : '#f8fafc',
                        padding: '12px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '12.5px',
                        color: isDark ? '#cbd5e1' : '#475569',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'من حساب:' : 'From:'}</span>
                        <strong style={{ fontFamily: 'monospace', color: isDark ? '#f8fafc' : '#0f172a' }}>{item.senderHandle || '—'}</strong>
                      </span>

                      <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>•</span>

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'المبلغ المحول:' : 'Amount:'}</span>
                        <strong style={{ color: '#10b981' }}>{Number(item.amountEgp).toFixed(2)} EGP</strong>
                      </span>

                      {item.reference && (
                        <>
                          <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>•</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'المرجع البنكي:' : 'Ref:'}</span>
                            <span style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>
                              {item.reference}
                            </span>
                          </span>
                        </>
                      )}

                      <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>•</span>

                      <span style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={12} />
                        {formatReviewDate(item.createdAt, isRtl)}
                      </span>
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
