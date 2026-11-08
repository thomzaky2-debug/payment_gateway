import React, { useState, useEffect, useCallback } from 'react';
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
  ShieldAlert,
} from 'lucide-react';
import { customerSubscriptionsApi, subscriptionApi, authApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface SubscriptionsPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  subPath?: string;
}

export function SubscriptionsPage({ showToast }: SubscriptionsPageProps) {
  const { t, isRtl } = useLanguage();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices' | 'plans' | 'platform'>('subscriptions');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Lists
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [platformClient, setPlatformClient] = useState<any>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showNewSubModal, setShowNewSubModal] = useState(false);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    if (showToast) showToast('success', isRtl ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard');
  };

  const loadAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsRes, subsRes, invsRes, plansRes, sessionRes] = await Promise.allSettled([
        customerSubscriptionsApi.getStats(),
        customerSubscriptionsApi.listSubscriptions({ status: statusFilter, search: searchQuery }),
        customerSubscriptionsApi.listInvoices({ status: statusFilter, search: searchQuery }),
        customerSubscriptionsApi.getPlans(),
        authApi.getSession(),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.ok) {
        setStats(statsRes.value.stats);
      }
      if (subsRes.status === 'fulfilled' && subsRes.value?.ok) {
        setSubscriptions(subsRes.value.subscriptions || []);
      }
      if (invsRes.status === 'fulfilled' && invsRes.value?.ok) {
        setInvoices(invsRes.value.invoices || []);
      }
      if (plansRes.status === 'fulfilled' && plansRes.value?.ok) {
        setPlans(plansRes.value.plans || []);
      }
      if (sessionRes.status === 'fulfilled' && sessionRes.value?.client) {
        setPlatformClient(sessionRes.value.client);
      }
    } catch (err: any) {
      if (showToast) showToast('error', isRtl ? 'فشل تحميل بيانات الاشتراكات' : 'Failed to load subscription data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isRtl, showToast, statusFilter, searchQuery]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRunScheduler = async () => {
    setActionLoading(true);
    try {
      const res = await customerSubscriptionsApi.runSchedulerCycle();
      if (res.ok) {
        if (showToast) {
          showToast(
            'success',
            isRtl
              ? `تم تشغيل دورة المجدول: تم إنشاء ${res.result?.invoicesGenerated ?? 0} فواتير`
              : `Scheduler cycle completed: ${res.result?.invoicesGenerated ?? 0} invoice(s) generated`
          );
        }
        await loadAllData(true);
      }
    } catch (err: any) {
      if (showToast) showToast('error', err.response?.data?.error || 'Failed to trigger scheduler');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName || !planAmount) return;

    setActionLoading(true);
    try {
      const res = await customerSubscriptionsApi.createPlan({
        name: planName,
        description: planDesc || undefined,
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
        await loadAllData(true);
      }
    } catch (err: any) {
      if (showToast) showToast('error', err.response?.data?.error || 'Failed to create plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCustomerName || !subCustomerEmail) return;

    setActionLoading(true);
    try {
      const res = await customerSubscriptionsApi.createSubscription({
        customerName: subCustomerName,
        customerEmail: subCustomerEmail,
        customerPhone: subCustomerPhone || undefined,
        senderHandle: subSenderHandle || undefined,
        planId: subPlanId || undefined,
        amountEgp: subCustomAmount ? parseFloat(subCustomAmount) : undefined,
        billingInterval: subInterval,
        intervalDays: parseInt(subIntervalDays, 10) || 30,
        description: subDesc || undefined,
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
        await loadAllData(true);
      }
    } catch (err: any) {
      if (showToast) showToast('error', err.response?.data?.error || 'Failed to create subscription');
    } finally {
      setActionLoading(false);
    }
  };

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
      await loadAllData(true);
    } catch (err: any) {
      if (showToast) showToast('error', 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSub = async (id: string) => {
    if (!window.confirm(isRtl ? 'هل أنت متأكد من إلغاء هذا الاشتراك؟' : 'Are you sure you want to cancel this subscription?')) {
      return;
    }
    setActionLoading(true);
    try {
      await customerSubscriptionsApi.cancelSubscription(id);
      if (showToast) showToast('info', isRtl ? 'تم إلغاء الاشتراك' : 'Subscription cancelled');
      await loadAllData(true);
    } catch (err: any) {
      if (showToast) showToast('error', 'Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendInvoice = async (invoiceId: string) => {
    try {
      const res = await customerSubscriptionsApi.resendInvoice(invoiceId);
      if (res.ok && showToast) {
        showToast('success', isRtl ? 'تم إرسال تذكير الفاتورة بالبريد الإلكتروني' : 'Invoice reminder sent by email');
      }
    } catch (err: any) {
      if (showToast) showToast('error', 'Failed to resend reminder');
    }
  };

  const formatEgp = (amount: number) => {
    return `${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
  };

  const formatDate = (dateStr: string | null) => {
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case 'OVERDUE':
      case 'PAST_DUE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400">
            <Pause className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case 'CANCELLED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
            <X className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  // Check if platform subscription is expiring soon
  const isPlatformExpiringSoon = (() => {
    if (!platformClient?.subscriptionEndsAt) return false;
    const diffDays = (new Date(platformClient.subscriptionEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    return diffDays <= 5;
  })();

  return (
    <div className={`p-4 md:p-8 space-y-6 max-w-7xl mx-auto ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* Platform Renewal Banner if Expiring Soon */}
      {isPlatformExpiringSoon && (
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {isRtl ? 'اشتراك منصة نايل باي الخاص بك على وشك الانتهاء' : 'Your NilePay Platform Subscription is Expiring Soon'}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {isRtl
                  ? `ينتهي في ${formatDate(platformClient?.subscriptionEndsAt)}. جدد الآن لتجنب انقطاع معالجة المدفوعات.`
                  : `Expires on ${formatDate(platformClient?.subscriptionEndsAt)}. Renew now to ensure continuous gateway operation.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('platform')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm shrink-0"
          >
            {isRtl ? 'تجديد الاشتراك الآن' : 'Renew Subscription'}
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            {isRtl ? 'الاشتراكات المتكررة والمجدول' : 'Recurring Subscriptions & Invoices'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isRtl
              ? 'إنشاء وجدولة الفواتير والاشتراكات الدورية التلقائية عبر إنستاباي لعملائك ولمنصتك'
              : 'Automated InstaPay recurring billing schedules, checkout links, and payment reminders'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadAllData(true)}
            disabled={refreshing}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleRunScheduler}
            disabled={actionLoading}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Play className="w-4 h-4" />
            {isRtl ? 'تشغيل المجدول' : 'Run Scheduler'}
          </button>

          <button
            onClick={() => setShowNewPlanModal(true)}
            className="px-3.5 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Sliders className="w-4 h-4" />
            {isRtl ? 'خطة جديدة' : 'New Plan'}
          </button>

          <button
            onClick={() => setShowNewSubModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {isRtl ? 'مشترك جديد' : 'New Subscription'}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {isRtl ? 'المشتركون النشطون' : 'Active Subscribers'}
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3">
            {stats?.activeSubscribers ?? 0}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {isRtl ? `${stats?.plansCount ?? 0} خطط مفعلة` : `${stats?.plansCount ?? 0} active plans`}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {isRtl ? 'الإيراد الشهري المتكرر (MRR)' : 'Monthly Recurring (MRR)'}
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-3">
            {formatEgp(stats?.monthlyRecurringRevenueEgp || 0)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {isRtl ? 'تقدير الإيراد الدوري' : 'Estimated recurring run-rate'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {isRtl ? 'الفواتير المعلقة' : 'Pending Invoices'}
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3">
            {stats?.pendingInvoicesCount ?? 0}
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            {formatEgp(stats?.pendingInvoicesTotalEgp || 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {isRtl ? 'الفواتير المتأخرة' : 'Overdue Invoices'}
            </span>
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-3">
            {stats?.overdueInvoicesCount ?? 0}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {isRtl ? 'تتطلب تذكير أو متابعة' : 'Requires follow-up reminder'}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-800 flex gap-4">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'subscriptions'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {isRtl ? 'المشتركون' : 'Subscribers'} ({subscriptions.length})
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {isRtl ? 'الفواتير الدورية' : 'Invoices'} ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'plans'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {isRtl ? 'خطط الاشتراك' : 'Subscription Plans'} ({plans.length})
        </button>

        <button
          onClick={() => setActiveTab('platform')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'platform'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {isRtl ? 'تجديد المنصة' : 'Platform Subscription'}
          {isPlatformExpiringSoon && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
        </button>
      </div>

      {/* TAB 1: Subscriptions Table */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute top-3 left-3 text-gray-400" />
              <input
                type="text"
                placeholder={isRtl ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">{isRtl ? 'كل الحالات' : 'All Statuses'}</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAUSED">PAUSED</option>
                <option value="PAST_DUE">PAST_DUE</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">{isRtl ? 'المشترك' : 'Subscriber'}</th>
                  <th className="py-3.5 px-4 font-semibold">{isRtl ? 'الخطة والمبلغ' : 'Plan & Amount'}</th>
                  <th className="py-3.5 px-4 font-semibold">{isRtl ? 'الفترة' : 'Interval'}</th>
                  <th className="py-3.5 px-4 font-semibold">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="py-3.5 px-4 font-semibold">{isRtl ? 'الفوترة القادمة' : 'Next Billing'}</th>
                  <th className="py-3.5 px-4 font-semibold text-right">{isRtl ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      {loading ? (isRtl ? 'جاري التحميل...' : 'Loading...') : (isRtl ? 'لا يوجد مشتركون حالياً' : 'No subscriptions found')}
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 dark:text-white">{sub.customerName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{sub.customerEmail}</div>
                        {sub.senderHandle && (
                          <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400">{sub.senderHandle}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 dark:text-white">{formatEgp(sub.amountEgp)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{sub.plan?.name || sub.description || 'Custom'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium">
                        {sub.billingInterval === 'CUSTOM_DAYS' ? `${sub.intervalDays} days` : sub.billingInterval}
                      </td>
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(sub.status)}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-gray-900 dark:text-gray-200">{formatDate(sub.nextBillingAt)}</div>
                        <div className="text-gray-400">{sub._count?.invoices || 0} invoices total</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {sub.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleTogglePause(sub)}
                              disabled={actionLoading}
                              className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                              title={sub.status === 'PAUSED' ? 'Resume' : 'Pause'}
                            >
                              {sub.status === 'PAUSED' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                            </button>
                          )}
                          {sub.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleCancelSub(sub.id)}
                              disabled={actionLoading}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                              title="Cancel Subscription"
                            >
                              <X className="w-4 h-4" />
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
        </div>
      )}

      {/* TAB 2: Invoices Table */}
      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">{isRtl ? 'رقم الفاتورة' : 'Invoice #'}</th>
                  <th className="py-3.5 px-4 font-semibold">{isRtl ? 'العميل' : 'Customer'}</th>
                  <th className="py-3.5 px-4 font-semibold">{isRtl ? 'المبلغ' : 'Amount'}</th>
                  <th className="py-3.5 px-4 font-semibold">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="py-3.5 px-4 font-semibold">{isRtl ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                  <th className="py-3.5 px-4 font-semibold text-right">{isRtl ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      {isRtl ? 'لا توجد فواتير دورية مسجلة' : 'No invoices generated yet'}
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-gray-900 dark:text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 dark:text-white">{inv.customerName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{inv.customerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                        {formatEgp(inv.amountEgp)}
                      </td>
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(inv.status)}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-gray-900 dark:text-gray-200">{formatDate(inv.dueDate)}</div>
                        {inv.paidAt && <div className="text-emerald-600 font-semibold">Paid: {formatDate(inv.paidAt)}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.checkoutUrl && (
                            <button
                              onClick={() => copyToClipboard(inv.checkoutUrl, inv.id)}
                              className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                              title="Copy Checkout URL"
                            >
                              {copiedId === inv.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                            </button>
                          )}
                          {inv.status === 'PENDING' && (
                            <button
                              onClick={() => handleResendInvoice(inv.id)}
                              className="p-1.5 text-gray-600 hover:text-amber-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                              title="Resend Reminder Email"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {inv.checkoutUrl && (
                            <a
                              href={inv.checkoutUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                              title="Open Checkout"
                            >
                              <ExternalLink className="w-4 h-4" />
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
        </div>
      )}

      {/* TAB 3: Plans Cards */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white dark:bg-gray-900 border ${
                plan.isActive ? 'border-gray-200 dark:border-gray-800' : 'border-gray-200 dark:border-gray-800 opacity-60'
              } rounded-xl p-6 shadow-sm flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">{plan.name}</h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                    {plan.billingInterval}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 min-h-[40px]">
                  {plan.description || (isRtl ? 'لا يوجد وصف' : 'No description provided')}
                </p>
                <div className="text-2xl font-black text-gray-900 dark:text-white mt-4">
                  {formatEgp(plan.amountEgp)}
                  <span className="text-xs font-normal text-gray-400">/{plan.billingInterval.toLowerCase()}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
                <span>{plan._count?.subscriptions || 0} {isRtl ? 'مشترك نشط' : 'subscribers'}</span>
                <span className={plan.isActive ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}

          <div
            onClick={() => setShowNewPlanModal(true)}
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all min-h-[220px]"
          >
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-full mb-3">
              <Plus className="w-6 h-6" />
            </div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {isRtl ? 'إضافة خطة اشتراك جديدة' : 'Add New Subscription Plan'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isRtl ? 'حدد المبلغ والمدة الدورية' : 'Set recurring price, intervals and duration'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: Platform Subscription Status */}
      {activeTab === 'platform' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 md:p-8 max-w-2xl mx-auto shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-5">
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {isRtl ? 'اشتراكك في بوابة نايل باي' : 'Your NilePay Platform Subscription'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isRtl ? 'إدارة التجديد التلقائي لخدمة البوابة' : 'Manage your gateway plan renewal and billing status'}
              </p>
            </div>
          </div>

          <div className="py-6 space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg text-sm">
              <span className="text-gray-500">{isRtl ? 'الخطة الحالية:' : 'Current Plan:'}</span>
              <span className="font-bold text-gray-900 dark:text-white">{platformClient?.subscriptionPlan || 'FREE_TRIAL'}</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg text-sm">
              <span className="text-gray-500">{isRtl ? 'تاريخ انتهاء الاشتراك:' : 'Subscription Expiry:'}</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatDate(platformClient?.subscriptionEndsAt)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg text-sm">
              <span className="text-gray-500">{isRtl ? 'حد المعاملات المتبقي:' : 'Transaction Limit:'}</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {platformClient?.txCount || 0} / {platformClient?.txLimit || 0}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
            <a
              href="#billing/"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              {isRtl ? 'ترقية أو تجديد الخطة' : 'Upgrade or Renew Plan'}
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* MODAL: New Subscription */}
      {showNewSubModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                {isRtl ? 'إنشاء اشتراك دوري جديد' : 'New Recurring Subscription'}
              </h3>
              <button
                onClick={() => setShowNewSubModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {isRtl ? 'اسم العميل' : 'Customer Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmed Ali"
                    value={subCustomerName}
                    onChange={(e) => setSubCustomerName(e.target.value)}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {isRtl ? 'البريد الإلكتروني' : 'Customer Email'} *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="customer@example.com"
                    value={subCustomerEmail}
                    onChange={(e) => setSubCustomerEmail(e.target.value)}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {isRtl ? 'رقم الهاتف (واتساب)' : 'Phone (WhatsApp)'}
                  </label>
                  <input
                    type="text"
                    placeholder="010XXXXXXXX"
                    value={subCustomerPhone}
                    onChange={(e) => setSubCustomerPhone(e.target.value)}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {isRtl ? 'عنوان إنستاباي للعميل' : 'Customer InstaPay Handle'}
                  </label>
                  <input
                    type="text"
                    placeholder="customer@instapay"
                    value={subSenderHandle}
                    onChange={(e) => setSubSenderHandle(e.target.value)}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {isRtl ? 'الخطة المختارة' : 'Select Subscription Plan'}
                </label>
                <select
                  value={subPlanId}
                  onChange={(e) => setSubPlanId(e.target.value)}
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{isRtl ? 'مبلغ وفترة مخصصة' : 'Custom Amount & Interval'}</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.amountEgp} EGP ({p.billingInterval})
                    </option>
                  ))}
                </select>
              </div>

              {!subPlanId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {isRtl ? 'المبلغ (جنيه مصري)' : 'Amount (EGP)'} *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required={!subPlanId}
                      placeholder="e.g. 250"
                      value={subCustomAmount}
                      onChange={(e) => setSubCustomAmount(e.target.value)}
                      className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {isRtl ? 'الفترة' : 'Billing Interval'}
                    </label>
                    <select
                      value={subInterval}
                      onChange={(e) => setSubInterval(e.target.value)}
                      className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
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

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="genFirst"
                  checked={subGenerateFirstNow}
                  onChange={(e) => setSubGenerateFirstNow(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="genFirst" className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                  {isRtl
                    ? 'إصدار الفاتورة الأولى ورابط الدفع فوراً وإرسالها بالبريد'
                    : 'Generate first invoice & checkout link immediately and email customer'}
                </label>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSubModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {actionLoading ? (isRtl ? 'جاري الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء الاشتراك' : 'Create Subscription')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Plan */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                {isRtl ? 'خطة اشتراك جديدة' : 'Create Subscription Plan'}
              </h3>
              <button
                onClick={() => setShowNewPlanModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {isRtl ? 'اسم الخطة' : 'Plan Name'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gold Tier, Gym VIP"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {isRtl ? 'الوصف' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Unlimited access and weekly coaching"
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {isRtl ? 'السعر (EGP)' : 'Price (EGP)'} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="350"
                    value={planAmount}
                    onChange={(e) => setPlanAmount(e.target.value)}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {isRtl ? 'التكرار' : 'Interval'}
                  </label>
                  <select
                    value={planInterval}
                    onChange={(e) => setPlanInterval(e.target.value)}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="DAILY">Daily</option>
                    <option value="CUSTOM_DAYS">Custom Days</option>
                  </select>
                </div>
              </div>

              {planInterval === 'CUSTOM_DAYS' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {isRtl ? 'عدد الأيام' : 'Days Count'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={planIntervalDays}
                    onChange={(e) => setPlanIntervalDays(e.target.value)}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPlanModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {actionLoading ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

