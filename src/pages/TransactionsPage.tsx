import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  X,
  Copy,
  Check,
  Printer,
  FileText,
  Download,
} from 'lucide-react';
import { transactionsApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface TransactionsPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  subPath?: string;
  onSubPathChange?: (subPath?: string) => void;
}

interface TransactionItem {
  id: string;
  sessionId: string;
  amountEgp: number;
  currency: string;
  senderHandle: string;
  recipientHandle?: string;
  status: string;
  detectedRef?: string | null;
  detectedAt?: string | null;
  createdAt: string;
  note?: string | null;
  purpose?: string | null;
  subscriptionPlanName?: string | null;
}

function parseFilterFromSubPath(sub?: string): string {
  if (!sub) return 'ALL';
  const clean = sub.toUpperCase();
  if (clean.includes('UNDER')) return 'UNDERPAID';
  if (clean.includes('CONFIRM') || clean === 'PAID') return 'CONFIRMED';
  if (clean.includes('PEND')) return 'PENDING';
  if (clean.includes('EXPIR')) return 'EXPIRED';
  return 'ALL';
}

function subPathFromFilter(filterKey: string): string {
  if (filterKey === 'ALL') return '';
  return filterKey.toLowerCase();
}

function formatTxDate(dateString: string | Date | undefined, isRtl: boolean): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateString);
  }
}

function formatTableDate(dateString: string | Date | undefined, isRtl: boolean): string {
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

function getPurchaseTypeInfo(tx: any, isRtl: boolean): { label: string; category: string; icon: string } {
  if (tx.purpose === 'SUBSCRIPTION') {
    const plan = tx.subscriptionPlanName ? tx.subscriptionPlanName.toUpperCase() : 'PRO';
    return {
      label: tx.note || (isRtl ? `اشتراك باقة ${plan}` : `${plan} Plan Subscription`),
      category: isRtl ? 'ترقية باقة' : 'Plan Upgrade',
      icon: '💎',
    };
  }

  if (tx.note && typeof tx.note === 'string' && tx.note.trim()) {
    return {
      label: tx.note.trim(),
      category: isRtl ? 'شراء طلب' : 'Product Order',
      icon: '🛍️',
    };
  }

  return {
    label: isRtl ? 'طلب متجر إلكتروني' : 'Store Product Checkout',
    category: isRtl ? 'عملية شراء' : 'Standard Checkout',
    icon: '🛒',
  };
}

export function TransactionsPage({ showToast, subPath, onSubPathChange }: TransactionsPageProps) {
  const { t, isRtl } = useLanguage();
  const { isDark } = useTheme();

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [, setTick] = useState(0);
  const [filter, setFilter] = useState(() => parseFilterFromSubPath(subPath));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState(false);

  // Auto tick every 10s for real-time relative timestamps
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const formatRelativeTime = (date: Date) => {
    try {
      const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
      if (diffSeconds < 5) return isRtl ? 'الآن' : 'Just now';
      if (diffSeconds < 60) return isRtl ? `منذ ${diffSeconds} ث` : `${diffSeconds}s ago`;
      if (diffSeconds < 3600) return isRtl ? `منذ ${Math.floor(diffSeconds / 60)} د` : `${Math.floor(diffSeconds / 60)}m ago`;
      return isRtl ? `منذ ${Math.floor(diffSeconds / 3600)} س` : `${Math.floor(diffSeconds / 3600)}h ago`;
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (subPath !== undefined) {
      setFilter(parseFilterFromSubPath(subPath));
    }
  }, [subPath]);

  const handleFilterClick = (filterKey: string) => {
    setFilter(filterKey);
    onSubPathChange?.(subPathFromFilter(filterKey));
  };

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
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      if (showToast) {
        showToast('error', isRtl ? 'تعذر تحميل المعاملات من الخادم' : 'Failed to fetch transactions from server');
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

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'PAID':
        return {
          bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
          text: '#10b981',
          border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0',
        };
      case 'PENDING':
        return {
          bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
          text: '#f59e0b',
          border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a',
        };
      case 'UNDERPAID':
        return {
          bg: isDark ? 'rgba(234, 88, 12, 0.15)' : '#fed7aa',
          text: '#ea580c',
          border: isDark ? '1px solid rgba(234, 88, 12, 0.3)' : '1px solid #fdba74',
        };
      case 'EXPIRED':
      default:
        return {
          bg: isDark ? 'rgba(148, 163, 184, 0.12)' : '#f1f5f9',
          text: isDark ? '#94a3b8' : '#475569',
          border: isDark ? '1px solid rgba(148, 163, 184, 0.25)' : '1px solid #cbd5e1',
        };
    }
  };

  const filterOptions = [
    { key: 'ALL', label: isRtl ? 'الكل' : 'All' },
    { key: 'CONFIRMED', label: isRtl ? 'مؤكدة' : 'Confirmed' },
    { key: 'PENDING', label: isRtl ? 'قيد الانتظار' : 'Pending' },
    { key: 'UNDERPAID', label: isRtl ? 'مبلغ ناقص' : 'Underpaid' },
    { key: 'EXPIRED', label: isRtl ? 'منتهية' : 'Expired' },
  ];

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

  const totalCount = transactions.length;
  const confirmedCount = transactions.filter((t) => t.status === 'CONFIRMED' || t.status === 'PAID').length;
  const confirmedVolume = transactions
    .filter((t) => t.status === 'CONFIRMED' || t.status === 'PAID')
    .reduce((acc, t) => acc + (t.amountEgp || 0), 0);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ─── Page Header (Detector Companion Style) ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '26px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              }}
            >
              <CreditCard size={22} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
                {isRtl ? 'سجل كافة المعاملات' : 'All Transactions'}
              </h2>
              <p style={{ fontSize: '13px', color: textSecondary, margin: '2px 0 0 0' }}>
                {isRtl ? 'متابعة وإدارة كافة عمليات الدفع وجلسات العملاء اللحظية' : 'Manage and monitor all payment checkouts in real time'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Live Sync Status Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
              color: '#0284c7',
              border: isDark ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid #bae6fd',
            }}
          >
            <Clock size={13} />
            <span>
              {isRtl ? 'آخر مزامنة:' : 'Last Synced:'}{' '}
              {lastRefreshedAt.toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
            <span
              style={{
                fontSize: '11px',
                opacity: 0.85,
                fontWeight: 500,
              }}
            >
              ({formatRelativeTime(lastRefreshedAt)})
            </span>
          </div>

          <button
            onClick={fetchTransactions}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              backgroundColor: isDark ? '#1e293b' : 'white',
              border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
              color: textPrimary,
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.06)',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? (isRtl ? 'جارِ التحديث...' : 'Refreshing...') : (isRtl ? 'تحديث البيانات' : 'Refresh')}</span>
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
              fontSize: '13.5px',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            <Download size={15} />
            {isRtl ? 'تصدير CSV' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* ─── Hero Live Transactions Banner (Detector Companion Style) ─── */}
      <div
        style={{
          ...card(),
          background: isDark
            ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(99, 102, 241, 0.12))'
            : 'linear-gradient(135deg, #0284c7, #6366f1)',
          border: isDark ? '1px solid rgba(56, 189, 248, 0.35)' : 'none',
          padding: '26px 30px',
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: '-30px',
            right: isRtl ? 'auto' : '-30px',
            left: isRtl ? '-30px' : 'auto',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-50px',
            right: isRtl ? 'auto' : '60px',
            left: 'auto',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div
            style={{
              width: '62px',
              height: '62px',
              borderRadius: '18px',
              background: isDark ? 'rgba(2, 132, 199, 0.25)' : 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              flexShrink: 0,
            }}
          >
            <CreditCard size={30} color={isDark ? '#38bdf8' : 'white'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  margin: 0,
                  color: isDark ? '#38bdf8' : 'white',
                }}
              >
                {isRtl ? 'سجل العمليات المباشر' : 'Live Gateway Stream'}
              </h3>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isDark ? '#38bdf8' : 'white',
                  animation: 'pulseGreen 2s ease-in-out infinite',
                  boxShadow: isDark
                    ? '0 0 10px rgba(56,189,248,0.6)'
                    : '0 0 10px rgba(255,255,255,0.6)',
                }}
              />
            </div>
            <p
              style={{
                fontSize: '13.5px',
                margin: '4px 0 0 0',
                color: isDark ? '#94a3b8' : 'rgba(255, 255, 255, 0.9)',
                fontWeight: 500,
              }}
            >
              {isRtl
                ? 'مراقبة فورية لكافة جلسات الدفع وإشعارات إنستاباي الواردة من تطبيق الرفيق'
                : 'Instant real-time tracking for InstaPay receipts matched via companion service'}
            </p>
          </div>
        </div>

        {/* Frosted Metric Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <div
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.3)',
              textAlign: isRtl ? 'right' : 'left',
            }}
          >
            <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              {isRtl ? 'إجمالي المقبوضات' : 'Verified Volume'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#34d399' : 'white', fontFamily: 'monospace' }}>
              {confirmedVolume.toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 600 }}>EGP</span>
            </div>
          </div>

          <div
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.3)',
              textAlign: isRtl ? 'right' : 'left',
            }}
          >
            <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              {isRtl ? 'المعاملات المؤكدة' : 'Confirmed Orders'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : 'white', fontFamily: 'monospace' }}>
              {confirmedCount} / {totalCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar (Detector Subcard Style) */}
      <div
        style={{
          ...subcard({ padding: '16px 20px', marginBottom: '22px' }),
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {filterOptions.map((f) => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => handleFilterClick(f.key)}
                style={{
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: isActive
                    ? (isDark ? '1px solid #38bdf8' : '1px solid #0284c7')
                    : (isDark ? '1px solid #334155' : '1px solid #e2e8f0'),
                  cursor: 'pointer',
                  backgroundColor: isActive
                    ? (isDark ? 'rgba(56, 189, 248, 0.18)' : '#0284c7')
                    : (isDark ? '#1e293b' : '#ffffff'),
                  color: isActive
                    ? (isDark ? '#38bdf8' : '#ffffff')
                    : (isDark ? '#94a3b8' : '#475569'),
                  boxShadow: isActive ? (isDark ? '0 0 12px rgba(56, 189, 248, 0.25)' : '0 4px 10px rgba(2, 132, 199, 0.3)') : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: isRtl ? 'auto' : '12px',
                right: isRtl ? '12px' : 'auto',
                top: '50%',
                transform: 'translateY(-50%)',
                color: isDark ? '#64748b' : '#94a3b8',
              }}
            />
            <input
              type="text"
              placeholder={isRtl ? 'ابحث بالجلسة أو الحساب...' : 'Search session or handle...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: isRtl ? '8px 36px 8px 14px' : '8px 14px 8px 36px',
                fontSize: '13px',
                borderRadius: '10px',
                border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                backgroundColor: isDark ? '#111827' : '#ffffff',
                color: isDark ? '#f8fafc' : '#0f172a',
                outline: 'none',
                width: '240px',
                transition: 'border-color 0.2s',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '8px 18px',
              backgroundColor: isDark ? '#0284c7' : '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: isDark ? '0 2px 8px rgba(2, 132, 199, 0.3)' : '0 2px 6px rgba(0,0,0,0.1)',
            }}
          >
            {isRtl ? 'بحث' : 'Search'}
          </button>
        </form>
      </div>

      {/* Table Container (Detector Companion Style) */}
      <div
        style={{
          ...card({ padding: 0, overflow: 'hidden', borderRadius: '20px' }),
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 220px)',
          minHeight: '400px',
        }}
      >
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#0284c7' }} />
            <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{isRtl ? 'جاري تحميل المعاملات من البوابة...' : 'Loading transactions from gateway...'}</div>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>
            <CreditCard size={48} style={{ margin: '0 auto 16px auto', color: isDark ? '#334155' : '#cbd5e1' }} />
            <div style={{ fontSize: '15px', fontWeight: 700, color: textPrimary, marginBottom: '6px' }}>
              {isRtl ? 'لا توجد معاملات مطابقة' : 'No transactions found'}
            </div>
            <div style={{ fontSize: '13px' }}>
              {isRtl ? 'لا توجد معاملات مطابقة لمعايير البحث الحالية.' : 'No transactions found matching your current filter criteria.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowY: 'auto', overflowX: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: isRtl ? 'right' : 'left' }}>
              <thead
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                }}
              >
                <tr
                  style={{
                    backgroundColor: isDark ? '#162033' : '#f8fafc',
                  }}
                >
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      boxShadow: isDark
                        ? 'inset 0 -1px 0 #1e293b, 0 1px 3px rgba(0,0,0,0.3)'
                        : 'inset 0 -1px 0 #e2e8f0, 0 1px 3px rgba(0,0,0,0.04)',
                      padding: '12px 6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isDark ? '#94a3b8' : '#64748b',
                      textTransform: 'uppercase',
                      width: '34px',
                      textAlign: 'center',
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      boxShadow: isDark
                        ? 'inset 0 -1px 0 #1e293b, 0 1px 3px rgba(0,0,0,0.3)'
                        : 'inset 0 -1px 0 #e2e8f0, 0 1px 3px rgba(0,0,0,0.04)',
                      padding: '12px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isDark ? '#94a3b8' : '#64748b',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isRtl ? 'الجلسة والمشتريات' : 'Session & Order'}
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      boxShadow: isDark
                        ? 'inset 0 -1px 0 #1e293b, 0 1px 3px rgba(0,0,0,0.3)'
                        : 'inset 0 -1px 0 #e2e8f0, 0 1px 2px rgba(0,0,0,0.04)',
                      padding: '12px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isDark ? '#94a3b8' : '#64748b',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isRtl ? 'المبلغ' : 'Amount'}
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      boxShadow: isDark
                        ? 'inset 0 -1px 0 #1e293b, 0 1px 3px rgba(0,0,0,0.3)'
                        : 'inset 0 -1px 0 #e2e8f0, 0 1px 2px rgba(0,0,0,0.04)',
                      padding: '12px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isDark ? '#94a3b8' : '#64748b',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isRtl ? 'المرسل' : 'Sender'}
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      boxShadow: isDark
                        ? 'inset 0 -1px 0 #1e293b, 0 1px 3px rgba(0,0,0,0.3)'
                        : 'inset 0 -1px 0 #e2e8f0, 0 1px 2px rgba(0,0,0,0.04)',
                      padding: '12px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isDark ? '#94a3b8' : '#64748b',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isRtl ? 'الحالة' : 'Status'}
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      boxShadow: isDark
                        ? 'inset 0 -1px 0 #1e293b, 0 1px 3px rgba(0,0,0,0.3)'
                        : 'inset 0 -1px 0 #e2e8f0, 0 1px 2px rgba(0,0,0,0.04)',
                      padding: '12px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isDark ? '#94a3b8' : '#64748b',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isRtl ? 'الرقم المرجعي' : 'Reference'}
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      boxShadow: isDark
                        ? 'inset 0 -1px 0 #1e293b, 0 1px 3px rgba(0,0,0,0.3)'
                        : 'inset 0 -1px 0 #e2e8f0, 0 1px 2px rgba(0,0,0,0.04)',
                      padding: '12px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isDark ? '#94a3b8' : '#64748b',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isRtl ? 'التاريخ' : 'Date'}
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      boxShadow: isDark
                        ? 'inset 0 -1px 0 #1e293b, 0 1px 3px rgba(0,0,0,0.3)'
                        : 'inset 0 -1px 0 #e2e8f0, 0 1px 2px rgba(0,0,0,0.04)',
                      padding: '12px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isDark ? '#94a3b8' : '#64748b',
                      textTransform: 'uppercase',
                      textAlign: isRtl ? 'left' : 'right',
                    }}
                  >
                    {isRtl ? 'الإيصال' : 'Receipt'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((tx, index) => {
                    const badge = getStatusBadgeStyle(tx.status);
                    const purchaseInfo = getPurchaseTypeInfo(tx, isRtl);

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        style={{
                          borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.3)' : '1px solid #f8fafc',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isDark ? '#1a2436' : '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {/* Counter # */}
                        <td
                          style={{
                            padding: '10px 6px',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: isDark ? '#64748b' : '#94a3b8',
                            width: '34px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          #{index + 1}
                        </td>

                        {/* Session ID & Purchase Type */}
                        <td style={{ padding: '10px 10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                fontWeight: 700,
                                color: isDark ? '#38bdf8' : '#0f172a',
                                maxWidth: '140px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                              }}
                              title={tx.sessionId}
                            >
                              {tx.sessionId}
                            </span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '1.5px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600,
                                width: 'fit-content',
                                backgroundColor: tx.purpose === 'SUBSCRIPTION'
                                  ? (isDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff')
                                  : (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff'),
                                color: tx.purpose === 'SUBSCRIPTION'
                                  ? (isDark ? '#c084fc' : '#7e22ce')
                                  : (isDark ? '#60a5fa' : '#1d4ed8'),
                              }}
                            >
                              <span>{purchaseInfo.icon}</span>
                              <span>{purchaseInfo.category}</span>
                            </span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td style={{ padding: '10px 10px', fontSize: '13px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', whiteSpace: 'nowrap' }}>
                          {tx.amountEgp.toFixed(2)} EGP
                        </td>

                        {/* Sender */}
                        <td
                          style={{
                            padding: '10px 10px',
                            fontSize: '12px',
                            color: isDark ? '#cbd5e1' : '#475569',
                            fontFamily: 'monospace',
                            maxWidth: '135px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={tx.senderHandle || ''}
                        >
                          {tx.senderHandle || '—'}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              backgroundColor: badge.bg,
                              color: badge.text,
                              border: badge.border,
                              padding: '3px 7px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              letterSpacing: '0.02em',
                            }}
                          >
                            {tx.status}
                          </span>
                        </td>

                        {/* Ref */}
                        <td
                          style={{
                            padding: '10px 10px',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            color: isDark ? '#10b981' : '#059669',
                            fontWeight: 600,
                            maxWidth: '115px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={tx.detectedRef || ''}
                        >
                          {tx.detectedRef || '—'}
                        </td>

                        {/* Date */}
                        <td
                          style={{ padding: '10px 10px', fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap' }}
                          title={formatTxDate(tx.createdAt, isRtl)}
                        >
                          {formatTableDate(tx.createdAt, isRtl)}
                        </td>

                        {/* Action Button: Receipt */}
                        <td style={{ padding: '10px 10px', textAlign: isRtl ? 'left' : 'right', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTx(tx);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#f0f9ff',
                              border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd',
                              color: isDark ? '#38bdf8' : '#0284c7',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                            title={isRtl ? 'عرض إيصال وتفاصيل المعاملة' : 'View Transaction Receipt & Details'}
                          >
                            <Eye size={12} />
                            <span>{isRtl ? 'الإيصال' : 'Receipt'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Transaction Receipt & Details Modal (Detector Companion Style) ─── */}
      {selectedTx && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setSelectedTx(null)}
        >
          <div
            style={{
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderRadius: '24px',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '26px',
              color: isDark ? '#f8fafc' : '#0f172a',
              position: 'relative',
              textAlign: isRtl ? 'right' : 'left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID'
                      ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5')
                      : (isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7'),
                    color: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID' ? '#10b981' : '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID'
                      ? (isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #a7f3d0')
                      : (isDark ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid #fde68a'),
                  }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: textPrimary, letterSpacing: '-0.2px' }}>
                    {isRtl ? 'إيصال وتفاصيل المعاملة' : 'Transaction Receipt & Details'}
                  </h3>
                  <p style={{ fontSize: '11.5px', color: textSecondary, margin: '2px 0 0 0' }}>
                    {isRtl ? 'بيانات العملية المسجلة في بوابة الدفع' : 'Gateway recorded transaction details'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTx(null)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  color: textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Hero Amount & Status Box (Detector Subcard Style) */}
            <div
              style={{
                ...subcard({ padding: '18px', textAlign: 'center', marginBottom: '20px', borderRadius: '16px' }),
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  marginBottom: '10px',
                  backgroundColor: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID'
                    ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5')
                    : (isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7'),
                  color: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID' ? '#10b981' : '#f59e0b',
                  border: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID'
                    ? (isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #a7f3d0')
                    : (isDark ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid #fde68a'),
                }}
              >
                {(selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID') && <CheckCircle2 size={13} />}
                {selectedTx.status}
              </span>

              <div
                style={{
                  fontSize: '30px',
                  fontWeight: 900,
                  color: selectedTx.status === 'CONFIRMED' || selectedTx.status === 'PAID' ? '#10b981' : textPrimary,
                  fontFamily: 'monospace',
                  letterSpacing: '-0.5px',
                }}
              >
                {selectedTx.amountEgp.toFixed(2)} <span style={{ fontSize: '17px', fontWeight: 700 }}>EGP</span>
              </div>

              <p style={{ fontSize: '13px', color: textSecondary, margin: '6px 0 0 0', fontWeight: 500 }}>
                {getPurchaseTypeInfo(selectedTx, isRtl).label}
              </p>
            </div>

            {/* Detailed Key-Value Rows */}
            <div
              style={{
                ...subcard({ padding: '16px 18px', marginBottom: '20px', borderRadius: '16px' }),
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0' }}>
                <span style={{ color: textSecondary }}>{isRtl ? 'معرف الجلسة:' : 'Session ID:'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <code style={{ fontFamily: 'monospace', fontSize: '12px', color: '#38bdf8', fontWeight: 700 }}>
                    {selectedTx.sessionId}
                  </code>
                  <button
                    onClick={() => {
                      if (navigator?.clipboard?.writeText) {
                        navigator.clipboard.writeText(selectedTx.sessionId);
                      }
                      setCopiedSessionId(true);
                      setTimeout(() => setCopiedSessionId(false), 2000);
                    }}
                    title="Copy Session ID"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: textSecondary, display: 'inline-flex', alignItems: 'center' }}
                  >
                    {copiedSessionId ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {selectedTx.detectedRef && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0' }}>
                  <span style={{ color: textSecondary }}>{isRtl ? 'رقم الإشعار المرجعي:' : 'InstaPay Ref ID:'}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#10b981' }}>
                    {selectedTx.detectedRef}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0' }}>
                <span style={{ color: textSecondary }}>{isRtl ? 'حساب العميل الراسل:' : 'Sender InstaPay Handle:'}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: textPrimary }}>
                  {selectedTx.senderHandle || '—'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0' }}>
                <span style={{ color: textSecondary }}>{isRtl ? 'حساب المتجر المستلم:' : 'Merchant Recipient IPA:'}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: textPrimary }}>
                  {selectedTx.recipientHandle || 'platform@instapay'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0' }}>
                <span style={{ color: textSecondary }}>{isRtl ? 'تصنيف المعاملة:' : 'Purchase Category:'}</span>
                <span style={{ fontWeight: 700, color: textPrimary }}>
                  {getPurchaseTypeInfo(selectedTx, isRtl).category}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0' }}>
                <span style={{ color: textSecondary }}>{isRtl ? 'توقيت الإنشاء:' : 'Created Time:'}</span>
                <span style={{ color: textPrimary, fontWeight: 500 }}>{formatTxDate(selectedTx.createdAt, isRtl)}</span>
              </div>

              {selectedTx.detectedAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0' }}>
                  <span style={{ color: textSecondary }}>{isRtl ? 'توقيت التأكيد:' : 'Verified Time:'}</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{formatTxDate(selectedTx.detectedAt || undefined, isRtl)}</span>
                </div>
              )}

              {selectedTx.note && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: textSecondary }}>{isRtl ? 'ملاحظة الطلب:' : 'Order Note:'}</span>
                  <span style={{ color: textPrimary, fontWeight: 500 }}>{selectedTx.note}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '11px',
                  borderRadius: '12px',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                  color: textPrimary,
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Printer size={16} />
                <span>{isRtl ? 'طباعة الإيصال' : 'Print Receipt'}</span>
              </button>

              <button
                onClick={() => setSelectedTx(null)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  backgroundColor: '#0284c7',
                  border: 'none',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
