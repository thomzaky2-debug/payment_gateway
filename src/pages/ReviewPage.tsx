import React, { useState, useEffect, useMemo } from 'react';
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
  Copy,
  Search,
  ExternalLink,
  Sliders,
  Sparkles,
  ChevronRight,
  Info,
  ShieldCheck,
  ShoppingBag,
  ArrowUpRight,
  CreditCard,
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

function getRelativeTime(dateString: string | Date | undefined, isRtl: boolean): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const diffMs = Date.now() - d.getTime();
    if (isNaN(diffMs) || diffMs < 0) return '';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return isRtl ? 'الآن' : 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return isRtl ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return isRtl ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return isRtl ? 'أمس' : 'Yesterday';
    if (diffDays < 7) return isRtl ? `منذ ${diffDays} أيام` : `${diffDays}d ago`;
    return d.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (subPath !== undefined) {
      setActiveTab(parseCaseTypeFromSubPath(subPath));
    }
  }, [subPath]);

  const handleTabClick = (caseType: CaseType) => {
    setActiveTab(caseType);
    onSubPathChange?.(subPathFromCaseType(caseType));
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
    if (showToast) {
      showToast('info', isRtl ? 'تم النسخ للحافظة' : 'Copied to clipboard');
    }
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

  // Filter helper based on search query
  const matchesSearch = (item: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (item.sessionId && item.sessionId.toLowerCase().includes(q)) ||
      (item.senderHandle && item.senderHandle.toLowerCase().includes(q)) ||
      (item.detectedRef && item.detectedRef.toLowerCase().includes(q)) ||
      (item.reference && item.reference.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q)) ||
      (item.amountEgp && String(item.amountEgp).includes(q))
    );
  };

  // Filtered lists
  const filteredUnderpaid = useMemo(() => underpaid.filter(matchesSearch), [underpaid, searchQuery]);
  const filteredOverpaid = useMemo(() => overpaid.filter(matchesSearch), [overpaid, searchQuery]);
  const filteredLate = useMemo(() => latePayments.filter(matchesSearch), [latePayments, searchQuery]);
  const filteredHandle = useMemo(() => handleMismatch.filter(matchesSearch), [handleMismatch, searchQuery]);
  const filteredDuplicate = useMemo(() => duplicateSuspect.filter(matchesSearch), [duplicateSuspect, searchQuery]);
  const filteredRisk = useMemo(() => highValueRisk.filter(matchesSearch), [highValueRisk, searchQuery]);
  const filteredMismatched = useMemo(() => mismatched.filter(matchesSearch), [mismatched, searchQuery]);

  const totalFilteredCount =
    (activeTab === 'ALL' || activeTab === 'LATE_PAYMENT' ? filteredLate.length : 0) +
    (activeTab === 'ALL' || activeTab === 'HANDLE_MISMATCH' ? filteredHandle.length : 0) +
    (activeTab === 'ALL' || activeTab === 'DUPLICATE_SUSPECT' ? filteredDuplicate.length : 0) +
    (activeTab === 'ALL' || activeTab === 'HIGH_VALUE_REVIEW' ? filteredRisk.length : 0) +
    (activeTab === 'ALL' || activeTab === 'UNMATCHED' ? filteredMismatched.length : 0) +
    (activeTab === 'ALL' || activeTab === 'UNDERPAID' ? filteredUnderpaid.length : 0) +
    (activeTab === 'ALL' || activeTab === 'OVERPAID' ? filteredOverpaid.length : 0);

  // Handler for Confirm / Accept
  const handleConfirmSession = (item: any, caseTitle: string) => {
    const detected = Number(item.detectedAmountEgp || item.amountEgp || 0);

    const executeConfirm = async () => {
      setProcessingId(item.sessionId);
      try {
        const res = await transactionsApi.confirm(item.sessionId);
        if (res.ok) {
          if (showToast) {
            showToast(
              'success',
              isRtl ? `تم اعتماد وتأكيد الجلسة ${item.sessionId} بنجاح!` : `Session ${item.sessionId} confirmed!`
            );
          }
          fetchQueue();
        } else {
          if (showToast) showToast('error', res.error || (isRtl ? 'فشل التأكيد' : 'Failed to confirm'));
        }
      } catch {
        if (showToast) showToast('error', isRtl ? 'خطأ أثناء تأكيد المعاملة' : 'Error confirming payment');
      } finally {
        setProcessingId(null);
      }
    };

    if (!showConfirm) {
      if (
        window.confirm(
          isRtl
            ? `تأكيد الجلسة ${item.sessionId} بمبلغ ${detected.toFixed(2)} EGP؟`
            : `Confirm session ${item.sessionId} for ${detected.toFixed(2)} EGP?`
        )
      ) {
        void executeConfirm();
      }
      return;
    }

    showConfirm({
      title: isRtl ? `تأكيد المعاملة (${caseTitle})` : `Accept & Confirm (${caseTitle})`,
      message: isRtl
        ? `هل أنت متأكد من رغبتك في اعتماد الجلسة ${item.sessionId} كمؤكدة بمبلغ ${detected.toFixed(2)} EGP؟ سيتم إتمام الطلب وتفعيل إشعار الويب هوك الخاص بك.`
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
      setProcessingId(item.sessionId);
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
      } finally {
        setProcessingId(null);
      }
    };

    if (!showConfirm) {
      if (
        window.confirm(
          isRtl
            ? `هل أنت متأكد من رفض الجلسة ${item.sessionId}؟`
            : `Reject session ${item.sessionId}?`
        )
      ) {
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

  // Categories config
  const categories = [
    {
      type: 'ALL' as CaseType,
      labelEn: 'All Cases',
      labelAr: 'جميع الحالات',
      count: totalPending,
      icon: SlidersHorizontal,
      color: '#3b82f6',
    },
    {
      type: 'LATE_PAYMENT' as CaseType,
      labelEn: 'Late / Expired',
      labelAr: 'دفع متأخر',
      count: latePayments.length,
      icon: Clock,
      color: '#a855f7',
    },
    {
      type: 'HANDLE_MISMATCH' as CaseType,
      labelEn: 'Sender Mismatch',
      labelAr: 'اختلاف المرسل',
      count: handleMismatch.length,
      icon: User,
      color: '#0ea5e9',
    },
    {
      type: 'DUPLICATE_SUSPECT' as CaseType,
      labelEn: 'Duplicate Suspect',
      labelAr: 'اشتباه تكرار',
      count: duplicateSuspect.length,
      icon: Repeat,
      color: '#f59e0b',
    },
    {
      type: 'HIGH_VALUE_REVIEW' as CaseType,
      labelEn: 'Risk Review',
      labelAr: 'مراجعة أمنية',
      count: highValueRisk.length,
      icon: ShieldAlert,
      color: '#ec4899',
    },
    {
      type: 'UNMATCHED' as CaseType,
      labelEn: 'Direct Unmatched',
      labelAr: 'تحويلات يتيمة',
      count: mismatched.length,
      icon: HelpCircle,
      color: '#ef4444',
    },
    {
      type: 'UNDERPAID' as CaseType,
      labelEn: 'Underpaid',
      labelAr: 'مبالغ ناقصة',
      count: underpaid.length,
      icon: AlertCircle,
      color: '#f97316',
    },
    {
      type: 'OVERPAID' as CaseType,
      labelEn: 'Overpaid',
      labelAr: 'مبالغ زائدة',
      count: overpaid.length,
      icon: TrendingUp,
      color: '#10b981',
    },
  ];

  // Render a Transaction Card
  const renderTransactionCard = (
    item: any,
    index: number,
    cfg: {
      badgeText: string;
      badgeColor: string;
      badgeBg: string;
      badgeBorder: string;
      actionLabel: string;
      actionIcon: React.ReactNode;
      caseTitle: string;
      icon: React.ReactNode;
      explanationEn: string;
      explanationAr: string;
    }
  ) => {
    const expected = Number(item.amountEgp || 0);
    const detected = Number(item.detectedAmountEgp || item.amountEgp || 0);
    const diff = detected - expected;
    const isProcessing = processingId === item.sessionId;

    // Extract contextual hints from note if present
    const noteRaw = item.note || '';
    const expectedHandleMatch = noteRaw.match(/\(Expected:\s*([^)]+)\)/i);
    const dupNoteMatch = noteRaw.match(/\(Duplicate[^\)]*\)/i);

    const cleanNote = noteRaw
      .replace(/\s*\(Expected:\s*[^)]+\)/i, '')
      .replace(/\s*\(Duplicate[^\)]*\)/i, '')
      .replace(/\s*\(Flagged[^\)]*\)/i, '')
      .trim();

    const expectedHandle = expectedHandleMatch ? expectedHandleMatch[1].trim() : null;
    const dupNote = dupNoteMatch ? dupNoteMatch[0].replace(/[()]/g, '').trim() : null;

    return (
      <div
        key={item.id}
        className="review-tx-card"
        style={{
          backgroundColor: isDark ? '#111827' : '#ffffff',
          borderRadius: '16px',
          border: isDark ? '1px solid rgba(51, 65, 85, 0.45)' : '1px solid #e2e8f0',
          boxShadow: isDark
            ? '0 6px 20px -4px rgba(0,0,0,0.45)'
            : '0 4px 16px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        }}
      >
        {/* Card Header: Type Badge, Index, Session ID, Relative Time */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            background: isDark
              ? 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
              : 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {/* Category Pill */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                borderRadius: '8px',
                backgroundColor: cfg.badgeBg,
                border: `1px solid ${cfg.badgeBorder}`,
                color: cfg.badgeColor,
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              {cfg.icon}
              <span>{cfg.badgeText}</span>
            </span>

            {/* Sequence Counter */}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: isDark ? '#64748b' : '#94a3b8',
                fontFamily: 'monospace',
              }}
            >
              #{index + 1}
            </span>
          </div>

          {/* Time Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: isDark ? '#94a3b8' : '#64748b',
              fontWeight: 500,
            }}
            title={formatReviewDate(item.createdAt, isRtl)}
          >
            <Clock size={12} />
            <span>{getRelativeTime(item.createdAt, isRtl) || formatReviewDate(item.createdAt, isRtl)}</span>
          </div>
        </div>

        {/* Card Body */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
          {/* Session ID & Clean Order Name */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8', fontWeight: 600 }}>SESSION:</span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: isDark ? '#38bdf8' : '#0284c7',
                    wordBreak: 'break-all',
                  }}
                >
                  {item.sessionId}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(item.sessionId, `sess-${item.sessionId}`)}
                  title="Copy Session ID"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: copiedId === `sess-${item.sessionId}` ? '#10b981' : (isDark ? '#64748b' : '#94a3b8'),
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {copiedId === `sess-${item.sessionId}` ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>

              {cleanNote && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    marginTop: '4px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: isDark ? '#f1f5f9' : '#1e293b',
                  }}
                >
                  <ShoppingBag size={13} color={isDark ? '#94a3b8' : '#64748b'} />
                  <span>{cleanNote}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sleek Financial Comparison Widget */}
          <div
            style={{
              borderRadius: '12px',
              padding: '12px 14px',
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            {/* Expected Amount */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {isRtl ? 'المطلوب' : 'Expected'}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
                {expected.toFixed(2)}{' '}
                <span style={{ fontSize: '10px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>EGP</span>
              </div>
            </div>

            {/* Transfer Direction Arrow */}
            <div style={{ color: isDark ? '#475569' : '#cbd5e1', display: 'flex', alignItems: 'center' }}>
              <ArrowRight size={16} />
            </div>

            {/* Transferred Amount */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {isRtl ? 'المحول فعلياً' : 'Transferred'}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#10b981', marginTop: '2px', fontFamily: 'monospace' }}>
                {detected.toFixed(2)}{' '}
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#10b981' }}>EGP</span>
              </div>
            </div>

            {/* Variance Pill */}
            <div style={{ marginInlineStart: 'auto' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 9px',
                  borderRadius: '7px',
                  fontSize: '11px',
                  fontWeight: 800,
                  backgroundColor:
                    diff === 0
                      ? isDark
                        ? 'rgba(100, 116, 139, 0.15)'
                        : '#f1f5f9'
                      : diff > 0
                      ? isDark
                        ? 'rgba(16, 185, 129, 0.15)'
                        : '#d1fae5'
                      : isDark
                      ? 'rgba(239, 68, 68, 0.15)'
                      : '#fee2e2',
                  color:
                    diff === 0
                      ? isDark
                        ? '#94a3b8'
                        : '#64748b'
                      : diff > 0
                      ? '#10b981'
                      : '#ef4444',
                  border:
                    diff === 0
                      ? isDark
                        ? '1px solid rgba(100, 116, 139, 0.3)'
                        : '1px solid #cbd5e1'
                      : diff > 0
                      ? isDark
                        ? '1px solid rgba(16, 185, 129, 0.3)'
                        : '1px solid #a7f3d0'
                      : isDark
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : '1px solid #fca5a5',
                }}
              >
                {diff === 0 ? (
                  <span>{isRtl ? 'مطابق تماماً' : 'Exact Match'}</span>
                ) : diff > 0 ? (
                  <span>+{diff.toFixed(2)} EGP {isRtl ? 'فائض' : 'Excess'}</span>
                ) : (
                  <span>-{Math.abs(diff).toFixed(2)} EGP {isRtl ? 'عجز' : 'Short'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Anomaly Context Callout (The "Why is this flagged" widget) */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f1f5f9',
              borderInlineStart: `3px solid ${cfg.badgeColor}`,
              fontSize: '11.5px',
              color: isDark ? '#cbd5e1' : '#334155',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: cfg.badgeColor }}>
              <Info size={13} />
              <span>{isRtl ? cfg.caseTitle : cfg.caseTitle}</span>
            </div>
            <div style={{ lineHeight: 1.4 }}>
              {isRtl ? cfg.explanationAr : cfg.explanationEn}
            </div>

            {/* Context comparison for Handle Mismatch */}
            {expectedHandle && (
              <div
                style={{
                  marginTop: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                  fontSize: '11px',
                }}
              >
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'المطلوب:' : 'Expected:'}</span>
                <strong style={{ fontFamily: 'monospace', color: isDark ? '#cbd5e1' : '#334155' }}>
                  {expectedHandle}
                </strong>
                <ArrowRight size={11} color={isDark ? '#64748b' : '#94a3b8'} />
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{isRtl ? 'المرسل الفعلي:' : 'Actual:'}</span>
                <strong style={{ fontFamily: 'monospace', color: '#0ea5e9' }}>
                  {item.senderHandle}
                </strong>
              </div>
            )}

            {/* Context callout for Duplicate transfer */}
            {dupNote && (
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#f59e0b',
                }}
              >
                ⚠️ {dupNote}
              </div>
            )}
          </div>

          {/* Payer & Reference Details */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              fontSize: '11.5px',
              color: isDark ? '#94a3b8' : '#64748b',
              flexWrap: 'wrap',
              paddingTop: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <User size={12} />
              <span>{isRtl ? 'المرسل:' : 'From:'}</span>
              <strong style={{ fontFamily: 'monospace', color: isDark ? '#f8fafc' : '#0f172a' }}>
                {item.senderHandle || '—'}
              </strong>
              {item.senderHandle && (
                <button
                  type="button"
                  onClick={() => copyText(item.senderHandle, `sender-${item.id}`)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '1px',
                    cursor: 'pointer',
                    color: copiedId === `sender-${item.id}` ? '#10b981' : (isDark ? '#64748b' : '#94a3b8'),
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {copiedId === `sender-${item.id}` ? <Check size={11} /> : <Copy size={11} />}
                </button>
              )}
            </div>

            {item.detectedRef && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8' }}>REF:</span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: '#10b981',
                    fontSize: '11px',
                  }}
                >
                  #{item.detectedRef}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(item.detectedRef, `ref-${item.id}`)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '1px',
                    cursor: 'pointer',
                    color: copiedId === `ref-${item.id}` ? '#10b981' : (isDark ? '#64748b' : '#94a3b8'),
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {copiedId === `ref-${item.id}` ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#fafafa',
            borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.35)' : '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <button
            type="button"
            disabled={isProcessing}
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
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.15s ease',
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            {isProcessing ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              cfg.actionIcon
            )}
            <span>{cfg.actionLabel}</span>
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleRejectSession(item)}
            style={{
              flex: 1,
              minHeight: '40px',
              padding: '8px 14px',
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#ef4444' : '#dc2626',
              border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            <X size={13} />
            <span>{isRtl ? 'رفض' : 'Reject'}</span>
          </button>
        </div>
      </div>
    );
  };

  const textPrimary = isDark ? '#f8fafc' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="merchant-page-container" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ─── Modern Top Header Row ─── */}
      <div
        className="review-header-row"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: totalPending > 0
                ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                : 'linear-gradient(135deg, #10b981, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: totalPending > 0
                ? '0 4px 14px rgba(245, 158, 11, 0.35)'
                : '0 4px 14px rgba(168, 85, 247, 0.35)',
              flexShrink: 0,
            }}
          >
            {totalPending > 0 ? (
              <ShieldAlert size={22} color="white" />
            ) : (
              <ShieldCheck size={22} color="white" />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2
                style={{
                  fontSize: 'clamp(18px, 2.5vw, 22px)',
                  fontWeight: 800,
                  color: textPrimary,
                  margin: 0,
                  letterSpacing: '-0.3px',
                }}
              >
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
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#ea580c',
                        animation: 'pulse 1.8s infinite',
                      }}
                    />
                    <span>{isRtl ? `${totalPending} حالات بحاجة لإجراء` : `${totalPending} Cases Requiring Action`}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={12} />
                    <span>{isRtl ? 'كل المعاملات معتمدة' : 'All Clear • In Sync'}</span>
                  </>
                )}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: textSecondary, margin: '2px 0 0 0' }}>
              {isRtl
                ? 'مراجعة كافة حالات المدفوعات غير القياسية: مبالغ ناقصة، مبالغ زائدة، دفع متأخر، واختلاف اسم المرسل.'
                : 'Review payment discrepancies, late checkouts, sender mismatches, and orphan transfers.'}
            </p>
          </div>
        </div>

        {/* Top Actions: Settings precision link + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('settings', 'Precision')}
              title={isRtl ? 'تعديل قواعد السماحية في الإعدادات' : 'Configure precision tolerances in Settings'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
                border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                color: textPrimary,
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Sliders size={13} color="#10b981" />
              <span>{isRtl ? 'قواعد السماحية' : 'Precision Rules'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchQueue}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: isDark ? '#1e293b' : 'white',
              border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
              color: textPrimary,
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{isRtl ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ─── Compact KPI Stat Strip ─── */}
      <div
        className="review-stats-strip"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Card 1: Total Queue */}
        <div
          onClick={() => handleTabClick('ALL')}
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            backgroundColor: isDark ? '#111827' : '#ffffff',
            border: activeTab === 'ALL'
              ? '1px solid #3b82f6'
              : (isDark ? '1px solid rgba(51, 65, 85, 0.45)' : '1px solid #e2e8f0'),
            boxShadow: activeTab === 'ALL'
              ? '0 0 0 1px #3b82f6, 0 4px 14px rgba(59, 130, 246, 0.15)'
              : '0 2px 8px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary }}>
              {isRtl ? 'إجمالي الحالات المعلقة' : 'Total Pending'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: textPrimary, marginTop: '2px', fontFamily: 'monospace' }}>
              {totalPending}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SlidersHorizontal size={18} />
          </div>
        </div>

        {/* Card 2: Late / Expired Payments */}
        <div
          onClick={() => handleTabClick('LATE_PAYMENT')}
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            backgroundColor: isDark ? '#111827' : '#ffffff',
            border: activeTab === 'LATE_PAYMENT'
              ? '1px solid #a855f7'
              : (isDark ? '1px solid rgba(51, 65, 85, 0.45)' : '1px solid #e2e8f0'),
            boxShadow: activeTab === 'LATE_PAYMENT'
              ? '0 0 0 1px #a855f7, 0 4px 14px rgba(168, 85, 247, 0.15)'
              : '0 2px 8px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary }}>
              {isRtl ? 'دفع متأخر بعد الانتهاء' : 'Late Payments'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#a855f7', marginTop: '2px', fontFamily: 'monospace' }}>
              {latePayments.length}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(168, 85, 247, 0.15)' : '#faf5ff',
              color: '#a855f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={18} />
          </div>
        </div>

        {/* Card 3: Sender Mismatch & Duplicates */}
        <div
          onClick={() => handleTabClick('HANDLE_MISMATCH')}
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            backgroundColor: isDark ? '#111827' : '#ffffff',
            border: activeTab === 'HANDLE_MISMATCH' || activeTab === 'DUPLICATE_SUSPECT'
              ? '1px solid #0ea5e9'
              : (isDark ? '1px solid rgba(51, 65, 85, 0.45)' : '1px solid #e2e8f0'),
            boxShadow: activeTab === 'HANDLE_MISMATCH' || activeTab === 'DUPLICATE_SUSPECT'
              ? '0 0 0 1px #0ea5e9, 0 4px 14px rgba(14, 165, 233, 0.15)'
              : '0 2px 8px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary }}>
              {isRtl ? 'اختلاف المرسل والتكرار' : 'Sender Discrepancy'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0ea5e9', marginTop: '2px', fontFamily: 'monospace' }}>
              {handleMismatch.length + duplicateSuspect.length}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#f0f9ff',
              color: '#0ea5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={18} />
          </div>
        </div>

        {/* Card 4: Unmatched Direct Transfers */}
        <div
          onClick={() => handleTabClick('UNMATCHED')}
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            backgroundColor: isDark ? '#111827' : '#ffffff',
            border: activeTab === 'UNMATCHED'
              ? '1px solid #ef4444'
              : (isDark ? '1px solid rgba(51, 65, 85, 0.45)' : '1px solid #e2e8f0'),
            boxShadow: activeTab === 'UNMATCHED'
              ? '0 0 0 1px #ef4444, 0 4px 14px rgba(239, 68, 68, 0.15)'
              : '0 2px 8px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary }}>
              {isRtl ? 'تحويلات بدون جلسة دفع' : 'Direct Orphan Transfers'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444', marginTop: '2px', fontFamily: 'monospace' }}>
              {mismatched.length}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HelpCircle size={18} />
          </div>
        </div>
      </div>

      {/* ─── Filter Tabs & Search Controls Row ─── */}
      <div
        className="review-controls-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        {/* Category Pills */}
        <div
          className="review-categories-scroll"
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            flex: 1,
            minWidth: '280px',
          }}
        >
          {categories.map((cat) => {
            const isActive = activeTab === cat.type;
            const Icon = cat.icon;
            return (
              <button
                key={cat.type}
                type="button"
                className="review-category-btn"
                onClick={() => handleTabClick(cat.type)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  backgroundColor: isActive
                    ? cat.color
                    : isDark
                    ? '#1e293b'
                    : '#ffffff',
                  color: isActive ? 'white' : textSecondary,
                  border: isActive
                    ? `1px solid ${cat.color}`
                    : isDark
                    ? '1px solid #334155'
                    : '1px solid #e2e8f0',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  boxShadow: isActive ? `0 4px 12px ${cat.color}35` : 'none',
                }}
              >
                <Icon size={13} />
                <span>{isRtl ? cat.labelAr : cat.labelEn}</span>
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '6px',
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

        {/* Quick Search Input */}
        <div
          className="review-search-box"
          style={{
            position: 'relative',
            width: 'clamp(220px, 100%, 280px)',
          }}
        >
          <Search
            size={14}
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              [isRtl ? 'right' : 'left']: '12px',
              color: textSecondary,
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className="review-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRtl ? 'بحث برقم الجلسة أو الحساب أو المرجع...' : 'Search session, handle, ref...'}
            style={{
              width: '100%',
              height: '38px',
              paddingTop: '8px',
              paddingBottom: '8px',
              paddingLeft: isRtl ? '12px' : '36px',
              paddingRight: isRtl ? '36px' : '12px',
              borderRadius: '10px',
              backgroundColor: isDark ? '#111827' : '#ffffff',
              border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
              color: textPrimary,
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                [isRtl ? 'left' : 'right']: '10px',
                background: 'none',
                border: 'none',
                color: textSecondary,
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Content Area: Loading / Empty / Responsive Grid ─── */}
      {loading ? (
        <div
          style={{
            padding: '64px',
            textAlign: 'center',
            color: textSecondary,
            backgroundColor: isDark ? '#111827' : 'white',
            borderRadius: '16px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0',
          }}
        >
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#10b981' }} />
          <div style={{ fontWeight: 600 }}>{isRtl ? 'جاري تحميل قائمة المراجعة...' : 'Loading review queue...'}</div>
        </div>
      ) : totalPending === 0 ? (
        <div
          style={{
            backgroundColor: isDark ? '#111827' : 'white',
            borderRadius: '20px',
            border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0',
            padding: '56px 24px',
            textAlign: 'center',
            boxShadow: isDark ? '0 10px 30px -5px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#10b981',
            }}
          >
            <CheckCircle2 size={36} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: textPrimary, margin: '0 0 6px 0' }}>
            {isRtl ? 'رائع! لا توجد معاملات معلقة للمراجعة' : 'All Clear! Review Queue is Empty'}
          </h3>
          <p style={{ fontSize: '13.5px', color: textSecondary, margin: '0 0 20px 0', maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto' }}>
            {isRtl
              ? 'يقوم الكاشف الآلي برصد ومطابقة التحويلات البنكية الصادرة والواردة لحظياً بدقة 100%.'
              : 'The automated detector companion is actively monitoring and matching incoming transfers in real-time.'}
          </p>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('overview')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              }}
            >
              <span>{isRtl ? 'العودة للوحة التحكم' : 'Return to Overview'}</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      ) : searchQuery && totalFilteredCount === 0 ? (
        <div
          style={{
            backgroundColor: isDark ? '#111827' : 'white',
            borderRadius: '16px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.45)' : '1px solid #e2e8f0',
            padding: '48px 20px',
            textAlign: 'center',
          }}
        >
          <Search size={32} style={{ color: textSecondary, margin: '0 auto 12px' }} />
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: textPrimary, margin: '0 0 6px' }}>
            {isRtl ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching review cases found'}
          </h4>
          <p style={{ fontSize: '13px', color: textSecondary, margin: '0 0 16px' }}>
            {isRtl
              ? `لم يتم العثور على أي نتائج مطابقة لـ "${searchQuery}" في هذا القسم.`
              : `No cases matching "${searchQuery}" were found in this category.`}
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{
              padding: '7px 14px',
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              color: textPrimary,
              border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isRtl ? 'مسح البحث' : 'Clear search'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Section: Late / Expired Payments */}
          {(activeTab === 'ALL' || activeTab === 'LATE_PAYMENT') && filteredLate.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Clock size={16} color="#a855f7" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'مدفوعات متأخرة بعد انتهاء الجلسة' : 'Late / Expired Session Checkouts'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(168, 85, 247, 0.15)' : '#faf5ff',
                    color: '#a855f7',
                    border: isDark ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid #e9d5ff',
                  }}
                >
                  {filteredLate.length}
                </span>
              </div>

              <div className="review-cards-grid">
                {filteredLate.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'LATE PAYMENT',
                    badgeColor: '#a855f7',
                    badgeBg: isDark ? 'rgba(168, 85, 247, 0.15)' : '#faf5ff',
                    badgeBorder: isDark ? 'rgba(168, 85, 247, 0.3)' : '#e9d5ff',
                    actionLabel: isRtl ? 'اعتماد الطلب' : 'Honor & Confirm',
                    actionIcon: <Check size={14} />,
                    caseTitle: isRtl ? 'دفع متأخر بعد انتهاء صلاحية الجلسة' : 'Late Transfer Flagged',
                    icon: <Clock size={12} />,
                    explanationEn: 'The buyer initiated and completed the bank transfer after the checkout timer expired.',
                    explanationAr: 'قام العميل بإتمام التحويل البنكي بعد انتهاء وقت الجلسة المحدد.',
                  })
                )}
              </div>
            </div>
          )}

          {/* Section: Sender Handle Discrepancies */}
          {(activeTab === 'ALL' || activeTab === 'HANDLE_MISMATCH') && filteredHandle.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <User size={16} color="#0ea5e9" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'اختلاف حساب المرسل (طرف ثالث)' : 'Sender Handle Discrepancy (Third-Party Payer)'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#f0f9ff',
                    color: '#0ea5e9',
                    border: isDark ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid #bae6fd',
                  }}
                >
                  {filteredHandle.length}
                </span>
              </div>

              <div className="review-cards-grid">
                {filteredHandle.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'SENDER MISMATCH',
                    badgeColor: '#0ea5e9',
                    badgeBg: isDark ? 'rgba(14, 165, 233, 0.15)' : '#f0f9ff',
                    badgeBorder: isDark ? 'rgba(14, 165, 233, 0.3)' : '#bae6fd',
                    actionLabel: isRtl ? 'اعتماد الحساب وتأكيد' : 'Approve & Confirm',
                    actionIcon: <Check size={14} />,
                    caseTitle: isRtl ? 'حساب مرسل مختلف عن المسجل' : 'Third-Party Payer Detected',
                    icon: <User size={12} />,
                    explanationEn: 'The detected transfer was sent from a different InstaPay wallet than what the customer provided during checkout.',
                    explanationAr: 'تم إرسال التحويل من محفظة انستاباي تختلف عن اسم الحساب المدخل أثناء بدء عملية الدفع.',
                  })
                )}
              </div>
            </div>
          )}

          {/* Section: Duplicate Suspects */}
          {(activeTab === 'ALL' || activeTab === 'DUPLICATE_SUSPECT') && filteredDuplicate.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Repeat size={16} color="#f59e0b" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'اشتباه تحويل مكرر' : 'Suspected Duplicate Transfers'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                    color: '#f59e0b',
                    border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a',
                  }}
                >
                  {filteredDuplicate.length}
                </span>
              </div>

              <div className="review-cards-grid">
                {filteredDuplicate.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'DUPLICATE SUSPECT',
                    badgeColor: '#f59e0b',
                    badgeBg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                    badgeBorder: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
                    actionLabel: isRtl ? 'تأكيد كطلب منفصل' : 'Confirm Separate',
                    actionIcon: <Repeat size={14} />,
                    caseTitle: isRtl ? 'اشتباه في تكرار تحويل سابق' : 'Duplicate Transfer Warning',
                    icon: <Repeat size={12} />,
                    explanationEn: 'Another transaction with an identical amount was recently logged from this sender handle.',
                    explanationAr: 'تم تسجيل تحويل آخر بنفس المبلغ ومن نفس الحساب خلال فترة زمنية متقاربة.',
                  })
                )}
              </div>
            </div>
          )}

          {/* Section: High-Value / Risk Clearances */}
          {(activeTab === 'ALL' || activeTab === 'HIGH_VALUE_REVIEW') && filteredRisk.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <ShieldAlert size={16} color="#ec4899" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'مراجعة أمنية ومبالغ مرتفعة' : 'High-Value & Velocity Clearances'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(236, 72, 153, 0.15)' : '#fdf2f8',
                    color: '#ec4899',
                    border: isDark ? '1px solid rgba(236, 72, 153, 0.3)' : '1px solid #fbcfe8',
                  }}
                >
                  {filteredRisk.length}
                </span>
              </div>

              <div className="review-cards-grid">
                {filteredRisk.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'HIGH VALUE REVIEW',
                    badgeColor: '#ec4899',
                    badgeBg: isDark ? 'rgba(236, 72, 153, 0.15)' : '#fdf2f8',
                    badgeBorder: isDark ? 'rgba(236, 72, 153, 0.3)' : '#fbcfe8',
                    actionLabel: isRtl ? 'الموافقة والإفراج' : 'Approve Payment',
                    actionIcon: <ShieldCheck size={14} />,
                    caseTitle: isRtl ? 'مبلغ يتجاوز حد التأكيد التلقائي' : 'Exceeds Auto-Clearance Limit',
                    icon: <ShieldAlert size={12} />,
                    explanationEn: 'Transaction amount exceeds standard velocity threshold and requires manual clearance.',
                    explanationAr: 'قيمة المعاملة تتجاوز حد الأمان للمطابقة الآلية وتتطلب مراجعة يدوية.',
                  })
                )}
              </div>
            </div>
          )}

          {/* Section: Underpaid Checkouts */}
          {(activeTab === 'ALL' || activeTab === 'UNDERPAID') && filteredUnderpaid.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <AlertCircle size={16} color="#f97316" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'مدفوعات بمبلغ ناقص عن المطلوب' : 'Underpaid Checkouts'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(249, 115, 22, 0.15)' : '#fff7ed',
                    color: '#f97316',
                    border: isDark ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid #fed7aa',
                  }}
                >
                  {filteredUnderpaid.length}
                </span>
              </div>

              <div className="review-cards-grid">
                {filteredUnderpaid.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'UNDERPAID',
                    badgeColor: '#f97316',
                    badgeBg: isDark ? 'rgba(249, 115, 22, 0.15)' : '#fff7ed',
                    badgeBorder: isDark ? 'rgba(249, 115, 22, 0.3)' : '#fed7aa',
                    actionLabel: isRtl ? 'قبول وتأكيد' : 'Accept & Confirm',
                    actionIcon: <Check size={14} />,
                    caseTitle: isRtl ? 'مبلغ التحويل أقل من المطلوب' : 'Short Payment Received',
                    icon: <AlertCircle size={12} />,
                    explanationEn: 'The buyer transferred less than the requested order total.',
                    explanationAr: 'المبلغ المحول أقل من إجمالي قيمة الطلب المطلوب.',
                  })
                )}
              </div>
            </div>
          )}

          {/* Section: Overpaid Checkouts */}
          {(activeTab === 'ALL' || activeTab === 'OVERPAID') && filteredOverpaid.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <TrendingUp size={16} color="#10b981" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'مدفوعات بمبلغ زائد عن المطلوب' : 'Overpaid Checkouts'}
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                    color: '#10b981',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0',
                  }}
                >
                  {filteredOverpaid.length}
                </span>
              </div>

              <div className="review-cards-grid">
                {filteredOverpaid.map((item, index) =>
                  renderTransactionCard(item, index, {
                    badgeText: 'OVERPAID',
                    badgeColor: '#10b981',
                    badgeBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                    badgeBorder: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0',
                    actionLabel: isRtl ? 'قبول وإضافة الفائض' : 'Accept & Credit',
                    actionIcon: <Check size={14} />,
                    caseTitle: isRtl ? 'مبلغ التحويل أعلى من المطلوب' : 'Excess Payment Received',
                    icon: <TrendingUp size={12} />,
                    explanationEn: 'The buyer transferred more than the requested checkout amount.',
                    explanationAr: 'قام المشتري بتحويل مبلغ أكبر من قيمة الطلب.',
                  })
                )}
              </div>
            </div>
          )}

          {/* Section: Unmatched Direct Transfers */}
          {(activeTab === 'ALL' || activeTab === 'UNMATCHED') && filteredMismatched.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <HelpCircle size={16} color="#ef4444" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {isRtl ? 'تحويلات مباشرة بدون جلسة دفع مسبقة' : 'Direct Orphan Transfers'}
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
                  {filteredMismatched.length}
                </span>
              </div>

              <div className="review-cards-grid">
                {filteredMismatched.map((item, index) => (
                  <div
                    key={item.id}
                    className="review-tx-card"
                    style={{
                      backgroundColor: isDark ? '#111827' : '#ffffff',
                      borderRadius: '16px',
                      border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fecaca',
                      boxShadow: isDark
                        ? '0 6px 20px -4px rgba(0,0,0,0.45)'
                        : '0 4px 16px rgba(0,0,0,0.05)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Header */}
                    <div
                      style={{
                        padding: '14px 16px',
                        borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        background: isDark
                          ? 'linear-gradient(180deg, rgba(239,68,68,0.05) 0%, transparent 100%)'
                          : 'linear-gradient(180deg, #fef2f2 0%, #ffffff 100%)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 9px',
                            borderRadius: '8px',
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                            border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fca5a5',
                            color: '#ef4444',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          <HelpCircle size={12} />
                          <span>ORPHAN TRANSFER</span>
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8', fontFamily: 'monospace' }}>
                          #{index + 1}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          color: isDark ? '#94a3b8' : '#64748b',
                        }}
                      >
                        <Clock size={12} />
                        <span>{getRelativeTime(item.createdAt, isRtl) || formatReviewDate(item.createdAt, isRtl)}</span>
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                      <div
                        style={{
                          borderRadius: '12px',
                          padding: '12px 14px',
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                          border: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
                            {isRtl ? 'المبلغ المستلم' : 'Amount Received'}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginTop: '2px', fontFamily: 'monospace' }}>
                            {Number(item.amountEgp).toFixed(2)}{' '}
                            <span style={{ fontSize: '10px', fontWeight: 600 }}>EGP</span>
                          </div>
                        </div>

                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                            color: '#ef4444',
                          }}
                        >
                          {isRtl ? 'غير مقترن بطلب' : 'No Order Match'}
                        </span>
                      </div>

                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f1f5f9',
                          borderInlineStart: '3px solid #ef4444',
                          fontSize: '11.5px',
                          color: isDark ? '#cbd5e1' : '#334155',
                          lineHeight: 1.4,
                        }}
                      >
                        {isRtl
                          ? 'تحويل بنكي وصل إلى حسابك بدون وجود جلسة دفع مفتوحة أو باركود سداد مسجل في النظام.'
                          : 'Direct bank transfer was received on your account without an active checkout session or reference link.'}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          fontSize: '11.5px',
                          color: isDark ? '#94a3b8' : '#64748b',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <User size={12} />
                          <span>{isRtl ? 'من:' : 'From:'}</span>
                          <strong style={{ fontFamily: 'monospace', color: isDark ? '#f8fafc' : '#0f172a' }}>
                            {item.senderHandle || '—'}
                          </strong>
                          {item.senderHandle && (
                            <button
                              type="button"
                              onClick={() => copyText(item.senderHandle, `unmatch-sender-${item.id}`)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '1px',
                                cursor: 'pointer',
                                color: copiedId === `unmatch-sender-${item.id}` ? '#10b981' : (isDark ? '#64748b' : '#94a3b8'),
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              {copiedId === `unmatch-sender-${item.id}` ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          )}
                        </div>

                        {item.reference && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8' }}>REF:</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#10b981', fontSize: '11px' }}>
                              #{item.reference}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText(item.reference, `unmatch-ref-${item.id}`)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '1px',
                                cursor: 'pointer',
                                color: copiedId === `unmatch-ref-${item.id}` ? '#10b981' : (isDark ? '#64748b' : '#94a3b8'),
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              {copiedId === `unmatch-ref-${item.id}` ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div
                      style={{
                        padding: '12px 16px',
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#fafafa',
                        borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.35)' : '1px solid #f1f5f9',
                      }}
                    >
                      <button
                        type="button"
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
                          width: '100%',
                          minHeight: '38px',
                          padding: '8px 14px',
                          backgroundColor: isDark ? '#1e293b' : '#ffffff',
                          color: isDark ? '#cbd5e1' : '#475569',
                          border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <X size={13} />
                        <span>{isRtl ? 'تجاهل السجل وأرشفته' : 'Dismiss & Archive Record'}</span>
                      </button>
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
