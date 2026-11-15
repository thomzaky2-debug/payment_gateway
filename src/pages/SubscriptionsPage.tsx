import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Plus,
  Play,
  Pause,
  X,
  Copy,
  Check,
  Calendar,
  Mail,
  User,
  CreditCard,
  AlertCircle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Send,
  Sliders,
  DollarSign,
  TrendingUp,
  Search,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  Edit2,
  Trash2,
  Eye,
  Phone,
  Receipt,
  Zap,
  Tag,
  ArrowRight,
  ArrowLeft,
  FileText,
  UserCheck,
} from 'lucide-react';
import { customerSubscriptionsApi, authApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface SubscriptionsPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  subPath?: string;
}

export function SubscriptionsPage({ showToast, subPath }: SubscriptionsPageProps) {
  const { isRtl } = useLanguage();
  const { isDark } = useTheme();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices' | 'plans' | 'platform'>('subscriptions');

  // Sync subPath
  useEffect(() => {
    if (subPath) {
      const clean = subPath.replace(/^\//, '').toLowerCase();
      if (clean === 'invoices') setActiveTab('invoices');
      else if (clean === 'plans') setActiveTab('plans');
      else if (clean === 'platform') setActiveTab('platform');
      else if (clean === 'subscriptions' || clean === 'subscribers') setActiveTab('subscriptions');
    }
  }, [subPath]);

  // Overall States
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Lists & Pagination
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [subPage, setSubPage] = useState(1);
  const subLimit = 15;

  const [invoices, setInvoices] = useState<any[]>([]);
  const [invTotal, setInvTotal] = useState(0);
  const [invPage, setInvPage] = useState(1);
  const invLimit = 15;

  const [plans, setPlans] = useState<any[]>([]);
  const [platformClient, setPlatformClient] = useState<any>(null);

  // Search & Filters
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('ALL');

  const [invSearch, setInvSearch] = useState('');
  const [invStatusFilter, setInvStatusFilter] = useState('ALL');

  // Modals
  const [showNewSubModal, setShowNewSubModal] = useState(false);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedSubscriber, setSelectedSubscriber] = useState<any>(null);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  // Form states for New Subscription
  const [subCustomerName, setSubCustomerName] = useState('');
  const [subCustomerEmail, setSubCustomerEmail] = useState('');
  const [subCustomerPhone, setSubCustomerPhone] = useState('');
  const [subSenderHandle, setSubSenderHandle] = useState('');
  const [subPlanId, setSubPlanId] = useState('');
  const [subCustomAmount, setSubCustomAmount] = useState('');
  const [subInterval, setSubInterval] = useState('MONTHLY');
  const [subIntervalDays, setSubIntervalDays] = useState('30');
  const [subDesc, setSubDesc] = useState('');
  const [subGenerateFirstNow, setSubGenerateFirstNow] = useState(true);

  // Form states for New Plan
  const [planName, setPlanName] = useState('');
  const [planDesc, setPlanDesc] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planInterval, setPlanInterval] = useState('MONTHLY');
  const [planIntervalDays, setPlanIntervalDays] = useState('30');

  // Form states for Edit Plan
  const [editPlanName, setEditPlanName] = useState('');
  const [editPlanDesc, setEditPlanDesc] = useState('');
  const [editPlanIsActive, setEditPlanIsActive] = useState(true);

  // Copied indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    if (showToast) showToast('success', isRtl ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard');
  };

  // Theme tokens
  const bgCard = isDark ? '#111827' : '#ffffff';
  const bgSubCard = isDark ? '#0b101e' : '#f8fafc';
  const borderCard = isDark ? 'rgba(51, 65, 85, 0.6)' : '#e2e8f0';
  const borderSubtle = isDark ? 'rgba(51, 65, 85, 0.35)' : '#f1f5f9';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  // Load stats, plans, platform info
  const loadBaseData = useCallback(async () => {
    try {
      const [statsRes, plansRes, sessionRes] = await Promise.allSettled([
        customerSubscriptionsApi.getStats(),
        customerSubscriptionsApi.getPlans(),
        authApi.getSession(),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.ok) {
        setStats(statsRes.value.stats);
      }
      if (plansRes.status === 'fulfilled' && plansRes.value?.ok) {
        setPlans(plansRes.value.plans || []);
      }
      if (sessionRes.status === 'fulfilled' && sessionRes.value?.client) {
        setPlatformClient(sessionRes.value.client);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load subscriptions list
  const loadSubscriptions = useCallback(async () => {
    try {
      const res = await customerSubscriptionsApi.listSubscriptions({
        status: subStatusFilter,
        search: subSearch.trim() || undefined,
        page: subPage,
        limit: subLimit,
      });
      if (res?.ok) {
        setSubscriptions(res.subscriptions || []);
        setSubTotal(res.pagination?.total || 0);
      }
    } catch {
      // ignore
    }
  }, [subStatusFilter, subSearch, subPage]);

  // Load invoices list
  const loadInvoices = useCallback(async () => {
    try {
      const res = await customerSubscriptionsApi.listInvoices({
        status: invStatusFilter,
        search: invSearch.trim() || undefined,
        page: invPage,
        limit: invLimit,
      });
      if (res?.ok) {
        setInvoices(res.invoices || []);
        setInvTotal(res.pagination?.total || 0);
      }
    } catch {
      // ignore
    }
  }, [invStatusFilter, invSearch, invPage]);

  // Unified Refresh
  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([loadBaseData(), loadSubscriptions(), loadInvoices()]);
    setRefreshing(false);
    if (showToast) showToast('info', isRtl ? 'تم تحديث البيانات' : 'Subscriptions data refreshed');
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadBaseData(), loadSubscriptions(), loadInvoices()]).finally(() => {
      setLoading(false);
    });
  }, [loadBaseData, loadSubscriptions, loadInvoices]);

  // Manual Scheduler
  const handleRunScheduler = async () => {
    setActionLoading(true);
    try {
      const res = await customerSubscriptionsApi.runSchedulerCycle();
      if (res.ok) {
        if (showToast) {
          showToast(
            'success',
            isRtl
              ? `تم تشغيل المجدول بنجاح: تم إنشاء ${res.result?.invoicesGenerated ?? 0} فاتورة`
              : `Scheduler cycle completed: ${res.result?.invoicesGenerated ?? 0} invoice(s) generated`
          );
        }
        await Promise.all([loadBaseData(), loadSubscriptions(), loadInvoices()]);
      }
    } catch (err: any) {
      if (showToast) showToast('error', err.response?.data?.error || 'Failed to trigger scheduler');
    } finally {
      setActionLoading(false);
    }
  };

  // Create Plan
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName || !planAmount) return;

    setActionLoading(true);
    try {
      const res = await customerSubscriptionsApi.createPlan({
        name: planName.trim(),
        description: planDesc.trim() || undefined,
        amountEgp: parseFloat(planAmount),
        billingInterval: planInterval,
        intervalDays: parseInt(planIntervalDays, 10) || 30,
      });
      if (res.ok) {
        if (showToast) showToast('success', isRtl ? 'تم إنشاء الخطة بنجاح' : 'Plan created successfully');
        setShowNewPlanModal(false);
        setPlanName('');
        setPlanDesc('');
        setPlanAmount('');
        await loadBaseData();
      }
    } catch (err: any) {
      if (showToast) showToast('error', err.response?.data?.error || 'Failed to create plan');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Plan
  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan || !editPlanName.trim()) return;

    setActionLoading(true);
    try {
      const res = await customerSubscriptionsApi.updatePlan(editingPlan.id, {
        name: editPlanName.trim(),
        description: editPlanDesc.trim() || undefined,
        isActive: editPlanIsActive,
      });
      if (res.ok) {
        if (showToast) showToast('success', isRtl ? 'تم تعديل الخطة بنجاح' : 'Plan updated successfully');
        setEditingPlan(null);
        await loadBaseData();
      }
    } catch (err: any) {
      if (showToast) showToast('error', err.response?.data?.error || 'Failed to update plan');
    } finally {
      setActionLoading(false);
    }
  };

  // Deactivate Plan
  const handleDeactivatePlan = async (planId: string) => {
    if (!window.confirm(isRtl ? 'هل تريد تعطيل هذه الخطة؟ لن يتمكن مشتركون جدد من الانضمام إليها.' : 'Deactivate this plan? New subscribers will not be able to choose it.')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await customerSubscriptionsApi.deletePlan(planId);
      if (res.ok) {
        if (showToast) showToast('info', isRtl ? 'تم تعطيل الخطة' : 'Plan deactivated');
        setEditingPlan(null);
        await loadBaseData();
      }
    } catch (err: any) {
      if (showToast) showToast('error', 'Failed to deactivate plan');
    } finally {
      setActionLoading(false);
    }
  };

  // Create Subscription
  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCustomerName || !subCustomerEmail) return;

    setActionLoading(true);
    try {
      const res = await customerSubscriptionsApi.createSubscription({
        customerName: subCustomerName.trim(),
        customerEmail: subCustomerEmail.trim(),
        customerPhone: subCustomerPhone.trim() || undefined,
        senderHandle: subSenderHandle.trim() || undefined,
        planId: subPlanId || undefined,
        amountEgp: subCustomAmount ? parseFloat(subCustomAmount) : undefined,
        billingInterval: subInterval,
        intervalDays: parseInt(subIntervalDays, 10) || 30,
        description: subDesc.trim() || undefined,
        generateFirstInvoiceNow: subGenerateFirstNow,
      });

      if (res.ok) {
        if (showToast) {
          showToast(
            'success',
            isRtl
              ? 'تم إنشاء الاشتراك وجدولة الفاتورة بنجاح'
              : 'Subscription created and invoice scheduled successfully'
          );
        }
        setShowNewSubModal(false);
        setSubCustomerName('');
        setSubCustomerEmail('');
        setSubCustomerPhone('');
        setSubSenderHandle('');
        setSubPlanId('');
        setSubCustomAmount('');
        setSubDesc('');
        await Promise.all([loadBaseData(), loadSubscriptions(), loadInvoices()]);
      }
    } catch (err: any) {
      if (showToast) showToast('error', err.response?.data?.error || 'Failed to create subscription');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Pause/Resume Subscription
  const handleTogglePause = async (sub: any) => {
    setActionLoading(true);
    try {
      if (sub.status === 'PAUSED') {
        await customerSubscriptionsApi.resumeSubscription(sub.id);
        if (showToast) showToast('success', isRtl ? 'تم استئناف الاشتراك' : 'Subscription resumed');
      } else {
        await customerSubscriptionsApi.pauseSubscription(sub.id);
        if (showToast) showToast('info', isRtl ? 'تم إيقاف الاشتراك مؤقتاً' : 'Subscription paused');
      }
      await loadSubscriptions();
      if (selectedSubscriber && selectedSubscriber.id === sub.id) {
        setSelectedSubscriber((prev: any) => ({ ...prev, status: prev.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' }));
      }
    } catch {
      if (showToast) showToast('error', 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Subscription
  const handleCancelSub = async (id: string) => {
    if (!window.confirm(isRtl ? 'هل أنت متأكد من إلغاء هذا الاشتراك؟' : 'Are you sure you want to cancel this subscription?')) {
      return;
    }
    setActionLoading(true);
    try {
      await customerSubscriptionsApi.cancelSubscription(id);
      if (showToast) showToast('info', isRtl ? 'تم إلغاء الاشتراك' : 'Subscription cancelled');
      await loadSubscriptions();
      if (selectedSubscriber && selectedSubscriber.id === id) {
        setSelectedSubscriber((prev: any) => ({ ...prev, status: 'CANCELLED' }));
      }
    } catch {
      if (showToast) showToast('error', 'Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  // Resend Invoice
  const handleResendInvoice = async (invoiceId: string) => {
    try {
      const res = await customerSubscriptionsApi.resendInvoice(invoiceId);
      if (res.ok && showToast) {
        showToast('success', isRtl ? 'تم إرسال تذكير الفاتورة بالبريد الإلكتروني' : 'Invoice reminder sent by email');
      }
    } catch {
      if (showToast) showToast('error', 'Failed to resend reminder');
    }
  };

  const formatEgp = (amount: number) => {
    return `${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'PAID':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5', color: '#10b981', border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0' }}>
            <CheckCircle2 size={12} />
            {status}
          </span>
        );
      case 'PENDING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fffbeb', color: isDark ? '#fbbf24' : '#d97706', border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a' }}>
            <Clock size={12} />
            {status}
          </span>
        );
      case 'OVERDUE':
      case 'PAST_DUE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2', color: '#ef4444', border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca' }}>
            <AlertCircle size={12} />
            {status}
          </span>
        );
      case 'PAUSED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#f0f9ff', color: isDark ? '#38bdf8' : '#0284c7', border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd' }}>
            <Pause size={12} />
            {status}
          </span>
        );
      case 'CANCELLED':
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: textSecondary, border: `1px solid ${borderSubtle}` }}>
            <X size={12} />
            {status}
          </span>
        );
    }
  };

  // Platform expiry check
  const isPlatformExpiringSoon = useMemo(() => {
    if (!platformClient?.subscriptionEndsAt) return false;
    const diffDays = (new Date(platformClient.subscriptionEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    return diffDays <= 5;
  }, [platformClient]);

  const subTotalPages = Math.ceil(subTotal / subLimit) || 1;
  const invTotalPages = Math.ceil(invTotal / invLimit) || 1;

  return (
    <div className={`merchant-page-container ${isRtl ? 'rtl' : 'ltr'}`} style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ─── Platform Renewal Warning Banner ─── */}
      {isPlatformExpiringSoon && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '16px',
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
            border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: textPrimary }}>
                {isRtl ? 'اشتراك منصة نايل باي الخاص بك على وشك الانتهاء' : 'Your NilePay Platform Subscription is Expiring Soon'}
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: textSecondary }}>
                {isRtl
                  ? `ينتهي في ${formatDate(platformClient?.subscriptionEndsAt)}. جدد الآن لتجنب انقطاع معالجة المدفوعات.`
                  : `Expires on ${formatDate(platformClient?.subscriptionEndsAt)}. Renew now to ensure continuous gateway operation.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('platform')}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              backgroundColor: '#f59e0b',
              color: '#000000',
              fontWeight: 700,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isRtl ? 'تجديد الاشتراك الآن' : 'Renew Subscription'}
          </button>
        </div>
      )}

      {/* ─── Page Header & Global Actions ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: textPrimary }}>
              {isRtl ? 'الاشتراكات المتكررة والفواتير' : 'Recurring Subscriptions & Invoices'}
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff', color: isDark ? '#a5b4fc' : '#4f46e5', border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #c7d2fe' }}>
              InstaPay Automated Schedules
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: textSecondary }}>
            {isRtl
              ? 'إدارة جداول الاشتراكات الدورية، إصدار الفواتير الآلية، إرسال تذكيرات الدفع، والتحصيل عبر إنستاباي'
              : 'Automated recurring billing schedules, smart invoice links, WhatsApp/email reminders, and customer subscriptions'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: bgCard,
              border: `1px solid ${borderCard}`,
              color: textPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: refreshing ? 'wait' : 'pointer',
              transition: 'all 0.2s',
            }}
            title={isRtl ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleRunScheduler}
            disabled={actionLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
              border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #c7d2fe',
              color: isDark ? '#a5b4fc' : '#4f46e5',
              fontSize: '13px',
              fontWeight: 700,
              cursor: actionLoading ? 'wait' : 'pointer',
            }}
          >
            <Play size={14} />
            <span>{isRtl ? 'تشغيل المجدول الآن' : 'Run Scheduler Cycle'}</span>
          </button>

          <button
            onClick={() => setShowNewPlanModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '10px',
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              border: `1px solid ${borderCard}`,
              color: textPrimary,
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Sliders size={14} />
            <span>{isRtl ? 'خطة جديدة' : 'New Plan'}</span>
          </button>

          <button
            onClick={() => setShowNewSubModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
            }}
          >
            <Plus size={16} />
            <span>{isRtl ? 'إضافة مشترك جديد' : 'New Subscriber'}</span>
          </button>
        </div>
      </div>

      {/* ─── 4 Metrics Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '16px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: isDark ? '0 4px 15px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: textSecondary }}>
              {isRtl ? 'المشتركون النشطون' : 'Active Subscribers'}
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: textPrimary, fontFamily: 'monospace' }}>
            {stats?.activeSubscribers ?? 0}
          </div>
          <div style={{ fontSize: '11.5px', color: textSecondary }}>
            {isRtl ? `${stats?.plansCount ?? 0} خطط مفعلة` : `${stats?.plansCount ?? 0} active plans`}
          </div>
        </div>

        <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '16px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: isDark ? '0 4px 15px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: textSecondary }}>
              {isRtl ? 'الإيراد الشهري المتكرر (MRR)' : 'Monthly Recurring (MRR)'}
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: isDark ? '#a5b4fc' : '#4f46e5', fontFamily: 'monospace' }}>
            {formatEgp(stats?.monthlyRecurringRevenueEgp || 0)}
          </div>
          <div style={{ fontSize: '11.5px', color: textSecondary }}>
            {isRtl ? 'تقدير الإيراد الدوري التلقائي' : 'Estimated recurring revenue run-rate'}
          </div>
        </div>

        <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '16px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: isDark ? '0 4px 15px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: textSecondary }}>
              {isRtl ? 'الفواتير المعلقة' : 'Pending Invoices'}
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: textPrimary, fontFamily: 'monospace' }}>
            {stats?.pendingInvoicesCount ?? 0}
          </div>
          <div style={{ fontSize: '11.5px', color: isDark ? '#fbbf24' : '#d97706', fontWeight: 600 }}>
            {formatEgp(stats?.pendingInvoicesTotalEgp || 0)} {isRtl ? 'قيد التحصيل' : 'in collection'}
          </div>
        </div>

        <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '16px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: isDark ? '0 4px 15px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: textSecondary }}>
              {isRtl ? 'الفواتير المتأخرة' : 'Overdue Invoices'}
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#ef4444', fontFamily: 'monospace' }}>
            {stats?.overdueInvoicesCount ?? 0}
          </div>
          <div style={{ fontSize: '11.5px', color: '#ef4444', fontWeight: 600 }}>
            {isRtl ? 'تتطلب تذكير ومتابعة فورية' : 'Requires reminder follow-up'}
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div style={{ borderBottom: `1px solid ${borderCard}`, display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
        <button
          onClick={() => setActiveTab('subscriptions')}
          style={{
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: activeTab === 'subscriptions' ? 800 : 600,
            borderBottom: activeTab === 'subscriptions' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'subscriptions' ? (isDark ? '#60a5fa' : '#2563eb') : textSecondary,
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <User size={15} />
          <span>{isRtl ? 'المشتركون' : 'Subscribers'}</span>
          <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>{subTotal}</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          style={{
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: activeTab === 'invoices' ? 800 : 600,
            borderBottom: activeTab === 'invoices' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'invoices' ? (isDark ? '#60a5fa' : '#2563eb') : textSecondary,
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <Receipt size={15} />
          <span>{isRtl ? 'الفواتير الدورية' : 'Recurring Invoices'}</span>
          <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>{invTotal}</span>
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          style={{
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: activeTab === 'plans' ? 800 : 600,
            borderBottom: activeTab === 'plans' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'plans' ? (isDark ? '#60a5fa' : '#2563eb') : textSecondary,
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <Sliders size={15} />
          <span>{isRtl ? 'خطط الاشتراك' : 'Subscription Plans'}</span>
          <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>{plans.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('platform')}
          style={{
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: activeTab === 'platform' ? 800 : 600,
            borderBottom: activeTab === 'platform' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'platform' ? (isDark ? '#60a5fa' : '#2563eb') : textSecondary,
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <CreditCard size={15} />
          <span>{isRtl ? 'اشتراك المنصة' : 'Platform Subscription'}</span>
          {isPlatformExpiringSoon && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} className="animate-pulse" />}
        </button>
      </div>

      {/* ─── TAB 1: Subscriptions Table ─── */}
      {activeTab === 'subscriptions' && (
        <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Controls Bar */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '240px', flex: 1 }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                <Search size={15} style={{ position: 'absolute', top: '10px', [isRtl ? 'right' : 'left']: '10px', color: textSecondary }} />
                <input
                  type="text"
                  placeholder={isRtl ? 'بحث بالاسم، البريد أو المعرف...' : 'Search subscriber name, email, or handle...'}
                  value={subSearch}
                  onChange={(e) => {
                    setSubSearch(e.target.value);
                    setSubPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    paddingInlineStart: '32px',
                    borderRadius: '8px',
                    border: `1px solid ${borderCard}`,
                    backgroundColor: bgSubCard,
                    color: textPrimary,
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
              </div>

              <select
                value={subStatusFilter}
                onChange={(e) => {
                  setSubStatusFilter(e.target.value);
                  setSubPage(1);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${borderCard}`,
                  backgroundColor: bgSubCard,
                  color: textPrimary,
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              >
                <option value="ALL">{isRtl ? 'كل الحالات' : 'All Statuses'}</option>
                <option value="ACTIVE">ACTIVE (نشط)</option>
                <option value="PAUSED">PAUSED (موقف مؤقتاً)</option>
                <option value="PAST_DUE">PAST_DUE (متأخر)</option>
                <option value="CANCELLED">CANCELLED (ملغي)</option>
              </select>
            </div>

            <button
              onClick={() => setShowNewSubModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: '#10b981',
                border: 'none',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              <span>{isRtl ? 'مشترك جديد' : 'New Subscriber'}</span>
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isRtl ? 'right' : 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: bgSubCard, borderBottom: `1px solid ${borderCard}`, color: textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>{isRtl ? 'المشترك' : 'Subscriber'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>{isRtl ? 'الخطة والمبلغ' : 'Plan & Amount'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>{isRtl ? 'الفترة' : 'Interval'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>{isRtl ? 'الحالة' : 'Status'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>{isRtl ? 'تاريخ الفوترة القادم' : 'Next Billing'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: isRtl ? 'left' : 'right' }}>{isRtl ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textSecondary }}>
                          <User size={24} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: textPrimary }}>
                          {isRtl ? 'لا يوجد مشتركون مطابقون' : 'No subscriptions found'}
                        </h4>
                        <p style={{ margin: 0, fontSize: '12px', color: textSecondary }}>
                          {isRtl ? 'أنشئ أول اشتراك لجدولة الفواتير والتحصيل عبر إنستاباي.' : 'Add your first recurring customer to schedule automated invoices.'}
                        </p>
                        <button
                          onClick={() => setShowNewSubModal(true)}
                          style={{
                            marginTop: '8px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            backgroundColor: '#2563eb',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + {isRtl ? 'إضافة مشترك جديد' : 'Add New Subscriber'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((sub) => (
                    <tr
                      key={sub.id}
                      style={{ borderBottom: `1px solid ${borderSubtle}`, transition: 'background-color 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px', flexShrink: 0 }}>
                            {(sub.customerName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: textPrimary, cursor: 'pointer' }} onClick={() => setSelectedSubscriber(sub)}>
                              {sub.customerName}
                            </div>
                            <div style={{ fontSize: '11px', color: textSecondary }}>{sub.customerEmail}</div>
                            {sub.senderHandle && (
                              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: isDark ? '#38bdf8' : '#0284c7', marginTop: '1px' }}>
                                {sub.senderHandle}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 800, color: textPrimary, fontFamily: 'monospace' }}>
                          {formatEgp(sub.amountEgp)}
                        </div>
                        <div style={{ fontSize: '11px', color: textSecondary }}>
                          {sub.plan?.name || sub.description || (isRtl ? 'خطة مخصصة' : 'Custom')}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600 }}>
                        {sub.billingInterval === 'CUSTOM_DAYS' ? `${sub.intervalDays} ${isRtl ? 'أيام' : 'days'}` : sub.billingInterval}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {renderStatusBadge(sub.status)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                        <div style={{ fontWeight: 700, color: textPrimary, fontFamily: 'monospace' }}>
                          {formatDate(sub.nextBillingAt)}
                        </div>
                        <div style={{ fontSize: '11px', color: textSecondary }}>
                          {sub._count?.invoices || 0} {isRtl ? 'فواتير تم إصدارها' : 'invoices generated'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: isRtl ? 'left' : 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isRtl ? 'flex-start' : 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => setSelectedSubscriber(sub)}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: textPrimary, fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title={isRtl ? 'عرض التفاصيل وسجل الفواتير' : 'View Details & Invoices'}
                          >
                            <Eye size={13} />
                            <span>{isRtl ? 'التفاصيل' : 'Details'}</span>
                          </button>
                          {sub.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleTogglePause(sub)}
                              disabled={actionLoading}
                              style={{ padding: '6px 8px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: sub.status === 'PAUSED' ? '#10b981' : '#f59e0b', cursor: 'pointer' }}
                              title={sub.status === 'PAUSED' ? (isRtl ? 'استئناف الاشتراك' : 'Resume') : (isRtl ? 'إيقاف مؤقت' : 'Pause')}
                            >
                              {sub.status === 'PAUSED' ? <Play size={13} /> : <Pause size={13} />}
                            </button>
                          )}
                          {sub.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleCancelSub(sub.id)}
                              disabled={actionLoading}
                              style={{ padding: '6px 8px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                              title={isRtl ? 'إلغاء الاشتراك' : 'Cancel Subscription'}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {subTotalPages > 1 && (
            <div style={{ padding: '12px 18px', borderTop: `1px solid ${borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: textSecondary }}>
              <span>{isRtl ? `صفحة ${subPage} من ${subTotalPages} (${subTotal} مشترك)` : `Page ${subPage} of ${subTotalPages} (${subTotal} subscribers)`}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={subPage <= 1}
                  onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                  style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: textPrimary, cursor: subPage <= 1 ? 'not-allowed' : 'pointer', opacity: subPage <= 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={subPage >= subTotalPages}
                  onClick={() => setSubPage((p) => Math.min(subTotalPages, p + 1))}
                  style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: textPrimary, cursor: subPage >= subTotalPages ? 'not-allowed' : 'pointer', opacity: subPage >= subTotalPages ? 0.4 : 1 }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: Invoices Table ─── */}
      {activeTab === 'invoices' && (
        <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Controls Bar */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '240px', flex: 1 }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                <Search size={15} style={{ position: 'absolute', top: '10px', [isRtl ? 'right' : 'left']: '10px', color: textSecondary }} />
                <input
                  type="text"
                  placeholder={isRtl ? 'بحث برقم الفاتورة، العميل أو البريد...' : 'Search invoice #, customer name, email...'}
                  value={invSearch}
                  onChange={(e) => {
                    setInvSearch(e.target.value);
                    setInvPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    paddingInlineStart: '32px',
                    borderRadius: '8px',
                    border: `1px solid ${borderCard}`,
                    backgroundColor: bgSubCard,
                    color: textPrimary,
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
              </div>

              <select
                value={invStatusFilter}
                onChange={(e) => {
                  setInvStatusFilter(e.target.value);
                  setInvPage(1);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${borderCard}`,
                  backgroundColor: bgSubCard,
                  color: textPrimary,
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              >
                <option value="ALL">{isRtl ? 'كل الحالات' : 'All Statuses'}</option>
                <option value="PENDING">PENDING (قيد الانتظار)</option>
                <option value="PAID">PAID (تم الدفع)</option>
                <option value="OVERDUE">OVERDUE (متأخرة)</option>
                <option value="CANCELLED">CANCELLED (ملغية)</option>
              </select>
            </div>

            <button
              onClick={handleRunScheduler}
              disabled={actionLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
                border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #c7d2fe',
                color: isDark ? '#a5b4fc' : '#4f46e5',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Zap size={14} />
              <span>{isRtl ? 'توليد الفواتير المستحقة' : 'Generate Due Invoices'}</span>
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isRtl ? 'right' : 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: bgSubCard, borderBottom: `1px solid ${borderCard}`, color: textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>{isRtl ? 'رقم الفاتورة' : 'Invoice #'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>{isRtl ? 'العميل' : 'Customer'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>{isRtl ? 'المبلغ' : 'Amount'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>{isRtl ? 'الحالة' : 'Status'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>{isRtl ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: isRtl ? 'left' : 'right' }}>{isRtl ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textSecondary }}>
                          <Receipt size={24} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: textPrimary }}>
                          {isRtl ? 'لا توجد فواتير دورية مسجلة' : 'No invoices generated yet'}
                        </h4>
                        <p style={{ margin: 0, fontSize: '12px', color: textSecondary }}>
                          {isRtl ? 'يتم إصدار الفواتير تلقائياً حسب دورة الفوترة لكل مشترك.' : 'Recurring invoices will automatically be created when due dates arrive.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      style={{ borderBottom: `1px solid ${borderSubtle}`, transition: 'background-color 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', color: isDark ? '#38bdf8' : '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <FileText size={13} />
                          <span>{inv.invoiceNumber}</span>
                        </button>
                        <div style={{ fontSize: '11px', color: textSecondary, marginTop: '2px' }}>
                          {formatDate(inv.createdAt)}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: textPrimary }}>{inv.customerName}</div>
                        <div style={{ fontSize: '11px', color: textSecondary }}>{inv.customerEmail}</div>
                        {inv.senderHandle && (
                          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: isDark ? '#38bdf8' : '#0284c7' }}>
                            {inv.senderHandle}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: textPrimary, fontFamily: 'monospace' }}>
                        {formatEgp(inv.amountEgp)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {renderStatusBadge(inv.status)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                        <div style={{ fontWeight: 700, color: textPrimary, fontFamily: 'monospace' }}>
                          {formatDate(inv.dueDate)}
                        </div>
                        {inv.paidAt && (
                          <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                            {isRtl ? 'تم الدفع في: ' : 'Paid: '}{formatDate(inv.paidAt)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: isRtl ? 'left' : 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isRtl ? 'flex-start' : 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: textPrimary, fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title={isRtl ? 'عرض الفاتورة وإيصال الدفع' : 'View Full Invoice'}
                          >
                            <Eye size={13} />
                            <span>{isRtl ? 'عرض' : 'View'}</span>
                          </button>
                          {inv.checkoutUrl && (
                            <button
                              onClick={() => copyToClipboard(inv.checkoutUrl, inv.id)}
                              style={{ padding: '6px 8px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: copiedId === inv.id ? '#10b981' : textPrimary, cursor: 'pointer' }}
                              title={isRtl ? 'نسخ رابط الدفع المباشر' : 'Copy Direct Checkout URL'}
                            >
                              {copiedId === inv.id ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          )}
                          {inv.status === 'PENDING' && (
                            <button
                              onClick={() => handleResendInvoice(inv.id)}
                              style={{ padding: '6px 8px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: '#f59e0b', cursor: 'pointer' }}
                              title={isRtl ? 'إعادة إرسال تذكير الدفع بالبريد' : 'Resend Email Reminder'}
                            >
                              <Send size={13} />
                            </button>
                          )}
                          {inv.checkoutUrl && (
                            <a
                              href={inv.checkoutUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ padding: '6px 8px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: isDark ? '#38bdf8' : '#0284c7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title={isRtl ? 'فتح صفحة الدفع' : 'Open Checkout Page'}
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {invTotalPages > 1 && (
            <div style={{ padding: '12px 18px', borderTop: `1px solid ${borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: textSecondary }}>
              <span>{isRtl ? `صفحة ${invPage} من ${invTotalPages} (${invTotal} فاتورة)` : `Page ${invPage} of ${invTotalPages} (${invTotal} invoices)`}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={invPage <= 1}
                  onClick={() => setInvPage((p) => Math.max(1, p - 1))}
                  style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: textPrimary, cursor: invPage <= 1 ? 'not-allowed' : 'pointer', opacity: invPage <= 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={invPage >= invTotalPages}
                  onClick={() => setInvPage((p) => Math.min(invTotalPages, p + 1))}
                  style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: textPrimary, cursor: invPage >= invTotalPages ? 'not-allowed' : 'pointer', opacity: invPage >= invTotalPages ? 0.4 : 1 }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: Plans Grid ─── */}
      {activeTab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                backgroundColor: bgCard,
                border: plan.isActive ? `1px solid ${borderCard}` : `1px dashed ${borderCard}`,
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                opacity: plan.isActive ? 1 : 0.65,
                boxShadow: isDark ? '0 4px 15px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: textPrimary }}>{plan.name}</h3>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff', color: isDark ? '#a5b4fc' : '#4f46e5' }}>
                    {plan.billingInterval}
                  </span>
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: textSecondary, minHeight: '36px', lineHeight: 1.4 }}>
                  {plan.description || (isRtl ? 'لا يوجد وصف للخطة' : 'No description provided')}
                </p>
                <div style={{ fontSize: '26px', fontWeight: 900, color: textPrimary, fontFamily: 'monospace', margin: '12px 0' }}>
                  {formatEgp(plan.amountEgp)}
                  <span style={{ fontSize: '12px', fontWeight: 500, color: textSecondary, marginInlineStart: '4px' }}>
                    /{plan.billingInterval.toLowerCase()}
                  </span>
                </div>
              </div>

              <div style={{ paddingTop: '16px', borderTop: `1px solid ${borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: textSecondary }}>
                  {plan._count?.subscriptions || 0} {isRtl ? 'مشترك نشط' : 'subscribers'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => {
                      setEditingPlan(plan);
                      setEditPlanName(plan.name);
                      setEditPlanDesc(plan.description || '');
                      setEditPlanIsActive(plan.isActive);
                    }}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: textPrimary, fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit2 size={12} />
                    <span>{isRtl ? 'تعديل' : 'Edit'}</span>
                  </button>
                  {plan.isActive && (
                    <button
                      onClick={() => handleDeactivatePlan(plan.id)}
                      style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: '#ef4444', fontSize: '11.5px', cursor: 'pointer' }}
                      title={isRtl ? 'تعطيل الخطة' : 'Deactivate Plan'}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* New Plan Dashed Card */}
          <div
            onClick={() => setShowNewPlanModal(true)}
            style={{
              border: `2px dashed ${borderCard}`,
              borderRadius: '16px',
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              minHeight: '220px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderCard; }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <Plus size={24} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: textPrimary }}>
              {isRtl ? 'إنشاء خطة اشتراك جديدة' : 'Add New Subscription Plan'}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: textSecondary }}>
              {isRtl ? 'حدد السعر، التكرار، والمدة الزمنية' : 'Define recurring rate, billing cycles, and duration'}
            </p>
          </div>
        </div>
      )}

      {/* ─── TAB 4: Platform Subscription Status ─── */}
      {activeTab === 'platform' && (
        <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '20px', padding: '28px', maxWidth: '640px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.4)' : '0 4px 15px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', borderBottom: `1px solid ${borderCard}`, paddingBottom: '16px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CreditCard size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: textPrimary }}>
                {isRtl ? 'اشتراك منصتك في نايل باي' : 'Your NilePay Platform Subscription'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textSecondary }}>
                {isRtl ? 'إدارة خطة ترقية البوابة، حد المعاملات، وتاريخ التجديد' : 'Manage your merchant portal engine plan, quota, and auto-renewal'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', backgroundColor: bgSubCard, border: `1px solid ${borderSubtle}` }}>
              <span style={{ fontSize: '13px', color: textSecondary }}>{isRtl ? 'الخطة الحالية:' : 'Current Plan:'}</span>
              <span style={{ fontWeight: 800, fontSize: '14px', color: isDark ? '#38bdf8' : '#0284c7' }}>
                {platformClient?.subscriptionPlan || 'FREE_TRIAL'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', backgroundColor: bgSubCard, border: `1px solid ${borderSubtle}` }}>
              <span style={{ fontSize: '13px', color: textSecondary }}>{isRtl ? 'تاريخ انتهاء الصلاحية:' : 'Expiry Date:'}</span>
              <span style={{ fontWeight: 800, fontSize: '14px', fontFamily: 'monospace', color: textPrimary }}>
                {formatDate(platformClient?.subscriptionEndsAt)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', backgroundColor: bgSubCard, border: `1px solid ${borderSubtle}` }}>
              <span style={{ fontSize: '13px', color: textSecondary }}>{isRtl ? 'استهلاك المعاملات:' : 'Transactions Used:'}</span>
              <span style={{ fontWeight: 800, fontSize: '14px', fontFamily: 'monospace', color: textPrimary }}>
                {platformClient?.txCount || 0} / {platformClient?.txLimit || '∞'}
              </span>
            </div>
          </div>

          <div style={{ paddingTop: '12px', borderTop: `1px solid ${borderCard}`, display: 'flex', justifyContent: 'center' }}>
            <a
              href="#billing/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 800,
                fontSize: '13.5px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
              }}
            >
              <span>{isRtl ? 'ترقية أو تجديد الباقة في صفحة الفواتير' : 'Upgrade or Renew Plan'}</span>
              <ChevronRight size={15} className="rtl:rotate-180" />
            </a>
          </div>
        </div>
      )}

      {/* ─── MODAL 1: Invoice Details & Receipt ─── */}
      {selectedInvoice && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '20px', width: '100%', maxWidth: '580px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: textPrimary, fontFamily: 'monospace' }}>
                    {selectedInvoice.invoiceNumber}
                  </h3>
                  <span style={{ fontSize: '11.5px', color: textSecondary }}>
                    {isRtl ? 'تفاصيل الفاتورة الدورية' : 'Recurring Invoice Breakdown'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                style={{ background: 'none', border: 'none', color: textSecondary, cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Amount & Status Top Banner */}
              <div style={{ padding: '16px 20px', borderRadius: '14px', backgroundColor: bgSubCard, border: `1px solid ${borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: textSecondary }}>
                    {isRtl ? 'المبلغ المطلوب' : 'AMOUNT DUE'}
                  </span>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>
                    {formatEgp(selectedInvoice.amountEgp)}
                  </div>
                </div>
                <div>{renderStatusBadge(selectedInvoice.status)}</div>
              </div>

              {/* Customer Info Card */}
              <div style={{ padding: '16px', borderRadius: '14px', border: `1px solid ${borderCard}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: textSecondary }}>
                  {isRtl ? 'بيانات العميل المشترك' : 'CUSTOMER DETAILS'}
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: textSecondary, fontSize: '11px', display: 'block' }}>{isRtl ? 'الاسم:' : 'Name:'}</span>
                    <strong style={{ color: textPrimary }}>{selectedInvoice.customerName}</strong>
                  </div>
                  <div>
                    <span style={{ color: textSecondary, fontSize: '11px', display: 'block' }}>{isRtl ? 'البريد الإلكتروني:' : 'Email:'}</span>
                    <strong style={{ color: textPrimary }}>{selectedInvoice.customerEmail}</strong>
                  </div>
                  {selectedInvoice.customerPhone && (
                    <div>
                      <span style={{ color: textSecondary, fontSize: '11px', display: 'block' }}>{isRtl ? 'الهاتف (واتساب):' : 'Phone:'}</span>
                      <strong style={{ color: textPrimary }}>{selectedInvoice.customerPhone}</strong>
                    </div>
                  )}
                  {selectedInvoice.senderHandle && (
                    <div>
                      <span style={{ color: textSecondary, fontSize: '11px', display: 'block' }}>{isRtl ? 'حساب إنستاباي للمطابقة:' : 'InstaPay Sender:'}</span>
                      <strong style={{ color: isDark ? '#38bdf8' : '#0284c7', fontFamily: 'monospace' }}>{selectedInvoice.senderHandle}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Dates & Period Card */}
              <div style={{ padding: '16px', borderRadius: '14px', border: `1px solid ${borderCard}`, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '12.5px' }}>
                <div>
                  <span style={{ color: textSecondary, fontSize: '11px', display: 'block' }}>{isRtl ? 'فترة الفوترة:' : 'Billing Period:'}</span>
                  <strong style={{ color: textPrimary, fontFamily: 'monospace' }}>
                    {formatDate(selectedInvoice.billingPeriodStart)} → {formatDate(selectedInvoice.billingPeriodEnd)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: textSecondary, fontSize: '11px', display: 'block' }}>{isRtl ? 'تاريخ الاستحقاق:' : 'Due Date:'}</span>
                  <strong style={{ color: textPrimary, fontFamily: 'monospace' }}>{formatDate(selectedInvoice.dueDate)}</strong>
                </div>
                {selectedInvoice.paidAt && (
                  <div>
                    <span style={{ color: '#10b981', fontSize: '11px', display: 'block' }}>{isRtl ? 'تم الدفع في:' : 'Paid At:'}</span>
                    <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{formatDate(selectedInvoice.paidAt)}</strong>
                  </div>
                )}
              </div>

              {/* Checkout Link Box */}
              {selectedInvoice.checkoutUrl && (
                <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: bgSubCard, border: `1px solid ${borderCard}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: textSecondary }}>
                    {isRtl ? 'رابط الدفع المباشر للعميل' : 'DIRECT CHECKOUT LINK'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      readOnly
                      value={selectedInvoice.checkoutUrl}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: isDark ? '#111827' : '#ffffff', color: textPrimary, fontSize: '12px', fontFamily: 'monospace', outline: 'none' }}
                    />
                    <button
                      onClick={() => copyToClipboard(selectedInvoice.checkoutUrl, 'modal-checkout')}
                      style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#2563eb', border: 'none', color: '#ffffff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {copiedId === 'modal-checkout' ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedId === 'modal-checkout' ? (isRtl ? 'تم!' : 'Copied!') : (isRtl ? 'نسخ' : 'Copy')}</span>
                    </button>
                    <a
                      href={selectedInvoice.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, color: textPrimary, textDecoration: 'none', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ExternalLink size={13} />
                      <span>{isRtl ? 'فتح' : 'Open'}</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {selectedInvoice.status === 'PENDING' ? (
                <button
                  onClick={() => handleResendInvoice(selectedInvoice.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a', color: isDark ? '#fbbf24' : '#d97706', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <Send size={14} />
                  <span>{isRtl ? 'إعادة إرسال تذكير الدفع بالبريد' : 'Resend Email Reminder'}</span>
                </button>
              ) : <div />}

              <button
                onClick={() => setSelectedInvoice(null)}
                style={{ padding: '9px 18px', borderRadius: '10px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', border: `1px solid ${borderCard}`, color: textPrimary, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Subscriber Details & History ─── */}
      {selectedSubscriber && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '20px', width: '100%', maxWidth: '640px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: textPrimary }}>
                    {selectedSubscriber.customerName}
                  </h3>
                  <span style={{ fontSize: '12px', color: textSecondary }}>{selectedSubscriber.customerEmail}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedSubscriber(null)}
                style={{ background: 'none', border: 'none', color: textSecondary, cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', padding: '16px', borderRadius: '14px', backgroundColor: bgSubCard, border: `1px solid ${borderSubtle}`, fontSize: '13px' }}>
                <div>
                  <span style={{ color: textSecondary, fontSize: '11px', display: 'block' }}>{isRtl ? 'الحالة:' : 'Status:'}</span>
                  {renderStatusBadge(selectedSubscriber.status)}
                </div>
                <div>
                  <span style={{ color: textSecondary, fontSize: '11px', display: 'block' }}>{isRtl ? 'المبلغ والدورة:' : 'Rate & Interval:'}</span>
                  <strong style={{ color: textPrimary, fontFamily: 'monospace' }}>
                    {formatEgp(selectedSubscriber.amountEgp)} / {selectedSubscriber.billingInterval}
                  </strong>
                </div>
                <div>
                  <span style={{ color: textSecondary, fontSize: '11px', display: 'block' }}>{isRtl ? 'معرف إنستاباي:' : 'InstaPay Handle:'}</span>
                  <strong style={{ color: isDark ? '#38bdf8' : '#0284c7', fontFamily: 'monospace' }}>
                    {selectedSubscriber.senderHandle || '—'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: textSecondary, fontSize: '11px', display: 'block' }}>{isRtl ? 'الفوترة القادمة:' : 'Next Billing:'}</span>
                  <strong style={{ color: textPrimary, fontFamily: 'monospace' }}>
                    {formatDate(selectedSubscriber.nextBillingAt)}
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selectedSubscriber.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleTogglePause(selectedSubscriber)}
                    disabled={actionLoading}
                    style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    {selectedSubscriber.status === 'PAUSED' ? <Play size={14} /> : <Pause size={14} />}
                    <span>{selectedSubscriber.status === 'PAUSED' ? (isRtl ? 'استئناف الاشتراك' : 'Resume Subscription') : (isRtl ? 'إيقاف مؤقت' : 'Pause Subscription')}</span>
                  </button>
                )}
                {selectedSubscriber.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleCancelSub(selectedSubscriber.id)}
                    disabled={actionLoading}
                    style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2', color: '#ef4444', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {isRtl ? 'إلغاء الاشتراك' : 'Cancel Subscription'}
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${borderCard}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedSubscriber(null)}
                style={{ padding: '9px 18px', borderRadius: '10px', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', border: `1px solid ${borderCard}`, color: textPrimary, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: New Subscription Form ─── */}
      {showNewSubModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '20px', width: '100%', maxWidth: '540px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} style={{ color: '#10b981' }} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: textPrimary }}>
                  {isRtl ? 'إنشاء اشتراك دوري جديد' : 'New Recurring Subscription'}
                </h3>
              </div>
              <button onClick={() => setShowNewSubModal(false)} style={{ background: 'none', border: 'none', color: textSecondary, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                    {isRtl ? 'اسم المشترك *' : 'Customer Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmed Ali"
                    value={subCustomerName}
                    onChange={(e) => setSubCustomerName(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                    {isRtl ? 'البريد الإلكتروني *' : 'Customer Email *'}
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="customer@example.com"
                    value={subCustomerEmail}
                    onChange={(e) => setSubCustomerEmail(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                    {isRtl ? 'الهاتف (واتساب)' : 'Phone (WhatsApp)'}
                  </label>
                  <input
                    type="text"
                    placeholder="010XXXXXXXX"
                    value={subCustomerPhone}
                    onChange={(e) => setSubCustomerPhone(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                    {isRtl ? 'عنوان إنستاباي للعميل للمطابقة' : 'Customer InstaPay Handle'}
                  </label>
                  <input
                    type="text"
                    placeholder="customer@instapay"
                    value={subSenderHandle}
                    onChange={(e) => setSubSenderHandle(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '13px', outline: 'none', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                  {isRtl ? 'اختر خطة الاشتراك' : 'Select Subscription Plan'}
                </label>
                <select
                  value={subPlanId}
                  onChange={(e) => setSubPlanId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '13px', outline: 'none' }}
                >
                  <option value="">{isRtl ? 'خطة مخصصة (حدد المبلغ والفترة يدوياً)' : 'Custom Amount & Interval'}</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.amountEgp} EGP ({p.billingInterval})
                    </option>
                  ))}
                </select>
              </div>

              {!subPlanId && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', padding: '14px', borderRadius: '12px', backgroundColor: bgSubCard, border: `1px solid ${borderSubtle}` }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                      {isRtl ? 'المبلغ بالجنيه المصري *' : 'Amount (EGP) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required={!subPlanId}
                      placeholder="e.g. 250"
                      value={subCustomAmount}
                      onChange={(e) => setSubCustomAmount(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgCard, color: textPrimary, fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                      {isRtl ? 'فترة التكرار' : 'Billing Interval'}
                    </label>
                    <select
                      value={subInterval}
                      onChange={(e) => setSubInterval(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgCard, color: textPrimary, fontSize: '13px', outline: 'none' }}
                    >
                      <option value="MONTHLY">Monthly (شهرياً)</option>
                      <option value="WEEKLY">Weekly (أسبوعياً)</option>
                      <option value="YEARLY">Yearly (سنوياً)</option>
                      <option value="DAILY">Daily (يومياً)</option>
                      <option value="CUSTOM_DAYS">Custom Days (أيام محددة)</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
                <input
                  type="checkbox"
                  id="genFirstModal"
                  checked={subGenerateFirstNow}
                  onChange={(e) => setSubGenerateFirstNow(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="genFirstModal" style={{ fontSize: '12.5px', color: textPrimary, cursor: 'pointer', fontWeight: 600 }}>
                  {isRtl ? 'إصدار الفاتورة الأولى ورابط الدفع فوراً وإرساله بالبريد' : 'Generate first invoice and checkout link immediately'}
                </label>
              </div>

              <div style={{ paddingTop: '16px', borderTop: `1px solid ${borderCard}`, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewSubModal(false)}
                  style={{ padding: '9px 16px', borderRadius: '10px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: textSecondary, fontSize: '13px', cursor: 'pointer' }}
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{ padding: '9px 20px', borderRadius: '10px', backgroundColor: '#10b981', border: 'none', color: '#ffffff', fontSize: '13px', fontWeight: 800, cursor: actionLoading ? 'wait' : 'pointer' }}
                >
                  {actionLoading ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'إنشاء الاشتراك' : 'Create Subscription')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: New Plan Form ─── */}
      {showNewPlanModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '20px', width: '100%', maxWidth: '460px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} style={{ color: '#2563eb' }} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: textPrimary }}>
                  {isRtl ? 'إنشاء خطة اشتراك جديدة' : 'Create Subscription Plan'}
                </h3>
              </div>
              <button onClick={() => setShowNewPlanModal(false)} style={{ background: 'none', border: 'none', color: textSecondary, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                  {isRtl ? 'اسم الخطة *' : 'Plan Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Club, Monthly Mentorship"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                  {isRtl ? 'الوصف' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Full access to premium services and monthly perks"
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '13px', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                    {isRtl ? 'السعر (EGP) *' : 'Price (EGP) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="350"
                    value={planAmount}
                    onChange={(e) => setPlanAmount(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                    {isRtl ? 'التكرار' : 'Interval'}
                  </label>
                  <select
                    value={planInterval}
                    onChange={(e) => setPlanInterval(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '13px', outline: 'none' }}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="DAILY">Daily</option>
                    <option value="CUSTOM_DAYS">Custom Days</option>
                  </select>
                </div>
              </div>

              <div style={{ paddingTop: '16px', borderTop: `1px solid ${borderCard}`, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewPlanModal(false)}
                  style={{ padding: '9px 16px', borderRadius: '10px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: textSecondary, fontSize: '13px', cursor: 'pointer' }}
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{ padding: '9px 20px', borderRadius: '10px', backgroundColor: '#2563eb', border: 'none', color: '#ffffff', fontSize: '13px', fontWeight: 800, cursor: actionLoading ? 'wait' : 'pointer' }}
                >
                  {actionLoading ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ الخطة' : 'Save Plan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: Edit Plan Form ─── */}
      {editingPlan && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: bgCard, border: `1px solid ${borderCard}`, borderRadius: '20px', width: '100%', maxWidth: '460px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} style={{ color: '#2563eb' }} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: textPrimary }}>
                  {isRtl ? 'تعديل خطة الاشتراك' : 'Edit Subscription Plan'}
                </h3>
              </div>
              <button onClick={() => setEditingPlan(null)} style={{ background: 'none', border: 'none', color: textSecondary, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdatePlan} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                  {isRtl ? 'اسم الخطة *' : 'Plan Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={editPlanName}
                  onChange={(e) => setEditPlanName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: textSecondary, marginBottom: '6px' }}>
                  {isRtl ? 'الوصف' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  value={editPlanDesc}
                  onChange={(e) => setEditPlanDesc(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${borderCard}`, backgroundColor: bgSubCard, color: textPrimary, fontSize: '13px', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
                <input
                  type="checkbox"
                  id="planActiveCheck"
                  checked={editPlanIsActive}
                  onChange={(e) => setEditPlanIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="planActiveCheck" style={{ fontSize: '12.5px', color: textPrimary, cursor: 'pointer', fontWeight: 600 }}>
                  {isRtl ? 'الخطة نشطة ومتاحة للاشتراك' : 'Plan is Active & available for new subscribers'}
                </label>
              </div>

              <div style={{ paddingTop: '16px', borderTop: `1px solid ${borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => handleDeactivatePlan(editingPlan.id)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2', color: '#ef4444', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {isRtl ? 'تعطيل الخطة' : 'Deactivate Plan'}
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    style={{ padding: '9px 16px', borderRadius: '10px', border: `1px solid ${borderCard}`, backgroundColor: 'transparent', color: textSecondary, fontSize: '13px', cursor: 'pointer' }}
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    style={{ padding: '9px 20px', borderRadius: '10px', backgroundColor: '#2563eb', border: 'none', color: '#ffffff', fontSize: '13px', fontWeight: 800, cursor: actionLoading ? 'wait' : 'pointer' }}
                  >
                    {actionLoading ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ التعديلات' : 'Save Changes')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
