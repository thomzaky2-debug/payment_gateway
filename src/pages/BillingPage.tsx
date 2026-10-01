import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Zap,
  Shield,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Sliders,
  X,
  AlertTriangle,
  Gift,
  HelpCircle,
  Calendar,
  User,
  Globe,
  Edit2,
  ChevronRight,
  Headphones,
  MessageSquare,
  Phone,
  Mail,
} from 'lucide-react';
import { plansApi, subscriptionApi, authApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface BillingPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function BillingPage({ showToast }: BillingPageProps) {
  const { t, isRtl } = useLanguage();
  const { isDark } = useTheme();

  const [client, setClient] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
  const [checkoutModal, setCheckoutModal] = useState<any>(null);
  const [showContactModal, setShowContactModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSubdomainUrl, setCopiedSubdomainUrl] = useState(false);

  // Subscription Checkout Modal State
  const [modalTimeLeft, setModalTimeLeft] = useState<number>(1800);
  const [senderInput, setSenderInput] = useState<string>('');
  const [isEditingSender, setIsEditingSender] = useState<boolean>(false);
  const [isSavingSender, setIsSavingSender] = useState<boolean>(false);
  const [senderSaved, setSenderSaved] = useState<boolean>(false);

  const loadData = async (isManual = false) => {
    setLoading(true);
    try {
      const timestamp = Date.now();
      const [sessionRes, plansRes] = await Promise.all([
        authApi.getSession({ _t: timestamp }),
        plansApi.list({ _t: timestamp }),
      ]);

      if (sessionRes?.ok && sessionRes?.client) {
        setClient(sessionRes.client);
      }
      if (plansRes?.ok && plansRes?.plans) {
        setPlans(plansRes.plans);
      }
      if (isManual && showToast) {
        showToast('success', isRtl ? 'تم تحديث بيانات الاشتراكات والخطط بنجاح' : 'Plans & subscription details refreshed');
      }
    } catch {
      if (showToast) showToast('error', isRtl ? 'فشل تحميل بيانات الاشتراك' : 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Poll subscription status if payment modal is open
  useEffect(() => {
    if (!checkoutModal?.sessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await subscriptionApi.getStatus(checkoutModal.sessionId);
        if (res?.ok && res?.transaction?.status === 'CONFIRMED') {
          clearInterval(interval);
          if (showToast) showToast('success', isRtl ? `تم تفعيل باقة ${res.transaction.planName} بنجاح!` : `Plan ${res.transaction.planName} activated successfully!`);
          setCheckoutModal(null);
          loadData();
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [checkoutModal?.sessionId]);

  // Countdown Timer & Sender Handle sync for Checkout Modal
  useEffect(() => {
    if (!checkoutModal) return;
    setSenderInput(checkoutModal.senderHandle || client?.instapayHandle || '');
    setSenderSaved(false);
    setIsEditingSender(false);

    const calculateTimeLeft = () => {
      if (!checkoutModal.expiresAt) return 1800;
      return Math.max(0, Math.floor((new Date(checkoutModal.expiresAt).getTime() - Date.now()) / 1000));
    };

    setModalTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setModalTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [checkoutModal?.sessionId, checkoutModal?.expiresAt]);

  const handleSaveSender = async () => {
    if (!checkoutModal?.sessionId) return;
    const clean = senderInput.replace(/@instapay/gi, '').replace(/^@/, '').trim();
    if (!clean) {
      if (showToast) showToast('error', isRtl ? 'يرجى إدخال اسم الحساب' : 'Please enter an account username');
      return;
    }
    const fullHandle = `${clean}@instapay`;
    setIsSavingSender(true);
    try {
      const res = await subscriptionApi.updateSender(checkoutModal.sessionId, fullHandle);
      if (res?.ok) {
        setCheckoutModal((prev: any) => ({ ...prev, senderHandle: res.senderHandle || fullHandle }));
        setSenderInput((res.senderHandle || fullHandle).replace(/@instapay$/i, '').replace(/^@/, ''));
        setIsEditingSender(false);
        setSenderSaved(true);
        if (showToast) showToast('success', isRtl ? 'تم تحديث حساب إنستاباي بنجاح' : 'InstaPay account username updated');
      } else {
        if (showToast) showToast('error', res?.error || 'Failed to update sender account');
      }
    } catch (err: any) {
      if (showToast) showToast('error', err.response?.data?.error || 'Error saving sender account');
    } finally {
      setIsSavingSender(false);
    }
  };

  const formatSeconds = (secs: number) => {
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.floor(Math.max(0, secs) % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatSubscriptionDate = (dateVal: string | Date | undefined) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      return d.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return String(dateVal);
    }
  };

  const copySubdomainUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedSubdomainUrl(true);
    setTimeout(() => setCopiedSubdomainUrl(false), 2000);
  };

  const handleSelectPlan = async (planName: string) => {
    if (planName === 'ENTERPRISE') {
      setShowContactModal(true);
      return;
    }
    setSubscribingPlan(planName);
    try {
      if (planName === 'FREE_TRIAL') {
        const res = await subscriptionApi.activateTrial();
        if (res?.ok) {
          if (showToast) showToast('success', res.message || (isRtl ? 'تم تفعيل الفترة التجريبية بنجاح!' : 'Free trial activated successfully!'));
          await loadData();
          return;
        } else {
          if (showToast) showToast('error', res?.error || 'Failed to activate trial');
          return;
        }
      }

      const res = await subscriptionApi.checkout(planName);
      const targetUrl =
        res?.checkoutUrl ||
        res?.checkout?.checkoutUrl ||
        (res?.sessionId ? `http://checkout.localhost:3000/pay/${res.sessionId}` : null) ||
        (res?.checkout?.sessionId ? `http://checkout.localhost:3000/pay/${res.checkout.sessionId}` : null);

      if (targetUrl) {
        window.location.href = targetUrl;
        return;
      }

      if (showToast) showToast('error', res?.error || 'Failed to initiate plan checkout');
    } catch (err: any) {
      if (showToast) showToast('error', err.response?.data?.error || 'Subscription checkout error');
    } finally {
      setSubscribingPlan(null);
    }
  };

  const copyPaymentUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const trialPlan = plans.find((p: any) => p.name === 'FREE_TRIAL');
  const isMerchantOnTrial = Boolean(client?.isFreeTrial || client?.subscriptionPlan === 'FREE_TRIAL');
  const isTrialClaimed = Boolean(client && !client.isFreeTrial && client.subscriptionPlan !== 'FREE_TRIAL');

  const txCount = client?.txCount ?? 0;
  // If merchant is on trial and trialPlan is loaded, dynamically use trialPlan.maxTransactions
  const txLimit = isMerchantOnTrial && trialPlan?.maxTransactions ? trialPlan.maxTransactions : (client?.txLimit ?? 50);
  const usagePercent = Math.min(100, Math.round((txCount / txLimit) * 100));
  const currentPlan = client?.subscriptionPlan || 'FREE_TRIAL';

  // Compute trial expiry details: directly bound to active trialPlan periodDays from admin settings
  const endsAt = (() => {
    if (client?.subscriptionEndsAt) return new Date(client.subscriptionEndsAt);
    if (isMerchantOnTrial && trialPlan?.periodDays) {
      return new Date(Date.now() + trialPlan.periodDays * 24 * 60 * 60 * 1000);
    }
    return null;
  })();
  const isExpired = endsAt ? endsAt.getTime() < Date.now() : false;
  const rawDaysRemaining = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
  // If merchant is on trial, ensure days remaining directly respects trialPlan.periodDays from admin settings
  const daysRemaining =
    isMerchantOnTrial && trialPlan?.periodDays && rawDaysRemaining !== null
      ? Math.min(trialPlan.periodDays, rawDaysRemaining)
      : rawDaysRemaining;
  const activeTrialDaysRemaining = isMerchantOnTrial && daysRemaining && daysRemaining > 0 && !isExpired ? daysRemaining : 0;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
              {isRtl ? 'الاشتراكات وإدارة الباقات' : 'Plans & Subscription Billing'}
            </h2>
            {trialPlan && trialPlan.isActive !== false && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                  color: '#10b981',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0',
                }}
              >
                <Sparkles size={12} /> {isRtl ? 'فترة تجريبية متاحة' : 'Free Trial Available'}
              </span>
            )}
          </div>
          <p style={{ fontSize: '14px', color: isDark ? '#94a3b8' : '#64748b', margin: '4px 0 0 0' }}>
            {isRtl ? 'اختر باقة تناسب حجم أعمالك أو جرب الباقة المجانية مع كاشف إنستاباي الآلي' : 'Choose a plan tailored to your business volume or start with the Free Trial'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>

          <button
            onClick={() => loadData(true)}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: isDark ? '#1e293b' : 'white',
              border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
              color: isDark ? '#f8fafc' : '#334155',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.15s ease',
            }}
            title={isRtl ? 'تحديث بيانات الاشتراك والحدود' : 'Refresh plan details and quotas'}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? (isRtl ? 'جاري التحديث...' : 'Refreshing...') : t('refresh')}</span>
          </button>
        </div>
      </div>

      {/* Current Active Plan Card */}
      <div
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #131b2e 0%, #0b1120 100%)'
            : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '20px',
          padding: '28px',
          color: 'white',
          marginBottom: '32px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
          border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #334155',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  backgroundColor: client?.isFreeTrial
                    ? isExpired
                      ? 'rgba(239, 68, 68, 0.25)'
                      : 'rgba(245, 158, 11, 0.2)'
                    : 'rgba(16, 185, 129, 0.2)',
                  color: client?.isFreeTrial ? (isExpired ? '#f87171' : '#fbbf24') : '#34d399',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: client?.isFreeTrial
                    ? isExpired
                      ? '1px solid rgba(239, 68, 68, 0.4)'
                      : '1px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid rgba(16, 185, 129, 0.4)',
                }}
              >
                {client?.isFreeTrial
                  ? isExpired
                    ? isRtl
                      ? 'انتهت الفترة التجريبية'
                      : 'TRIAL EXPIRED'
                    : isRtl
                    ? 'فترة تجريبية مجانية'
                    : 'FREE TRIAL'
                  : isRtl
                  ? 'باقة نشطة'
                  : 'ACTIVE PLAN'}
              </span>
              <h3 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
                {currentPlan === 'FREE_TRIAL'
                  ? isRtl
                    ? 'الباقة التجريبية المجانية'
                    : 'Free Trial Plan'
                  : currentPlan}
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '6px 0 0 0' }}>
              {isRtl ? 'المتجر:' : 'Merchant:'} <strong>{client?.businessName || 'Business'}</strong> • {isRtl ? 'الحساب المستلم:' : 'Receiving Handle:'}{' '}
              <code style={{ color: '#38bdf8' }}>{client?.instapayHandle}</code>
            </p>
          </div>

          <div style={{ textAlign: isRtl ? 'left' : 'right' }}>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              {client?.isFreeTrial ? (isRtl ? 'صلاحية التجربة المجانية' : 'Trial Expiry Period') : isRtl ? 'تاريخ التجديد' : 'Renewal / Expiry Date'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: isExpired ? '#f87171' : '#f8fafc', marginTop: '2px' }}>
              {endsAt ? (
                <>
                  {endsAt.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {daysRemaining !== null && !isExpired && (
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#38bdf8', marginInlineStart: '6px' }}>
                      ({daysRemaining} {isRtl ? 'يوم متبقي' : 'days left'})
                    </span>
                  )}
                  {isExpired && (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', marginInlineStart: '6px' }}>
                      ({isRtl ? 'منتهية' : 'Expired'})
                    </span>
                  )}
                </>
              ) : (
                isRtl ? 'غير محدد' : 'No Expiry'
              )}
            </div>
          </div>
        </div>

        {/* Usage Progress Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ color: '#cbd5e1' }}>
              {client?.isFreeTrial
                ? isRtl
                  ? 'المعاملات المستهلكة من حد التجربة المجانية'
                  : 'Trial Transactions Quota Used'
                : isRtl
                ? 'المعاملات المستهلكة هذا الشهر'
                : 'Monthly Transaction Quota Used'}
            </span>
            <span style={{ fontWeight: 700, color: usagePercent > 85 ? '#f87171' : '#38bdf8' }}>
              {txCount} / {txLimit} {isRtl ? 'معاملة' : 'txs'} ({usagePercent}%)
            </span>
          </div>
          <div style={{ height: '8px', backgroundColor: '#334155', borderRadius: '9999px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${usagePercent}%`,
                backgroundColor: usagePercent >= 100 ? '#ef4444' : usagePercent > 85 ? '#f59e0b' : '#38bdf8',
                borderRadius: '9999px',
                transition: 'width 0.4s ease-in-out',
              }}
            />
          </div>
          {client?.isFreeTrial && (usagePercent >= 100 || isExpired) && (
            <div
              style={{
                marginTop: '12px',
                padding: '8px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={15} />
              <span>
                {isRtl
                  ? 'وصلت لحد المعاملات أو انتهت فترة التجربة. يرجى الترقية إلى إحدى الباقات المدفوعة أدناه لمواصلة قبول المدفوعات.'
                  : 'Trial limit reached or period expired. Please upgrade to a paid subscription below to continue accepting checkouts.'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Available Plans Section */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
          {isRtl ? 'الباقات المتاحة والتجربة المجانية' : 'Available Subscription Tiers & Free Trial'}
        </h3>
        <p style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', margin: '4px 0 0 0' }}>
          {isRtl
            ? 'تستطيع البدء بالتجربة المجانية لاختبار كافة الميزات، أو الترقية لباقة مخصصة بحجم عملياتك'
            : 'Start with the Free Trial to evaluate live detection, or upgrade to a dedicated volume tier.'}
        </p>
      </div>

      {/* Free Trial Rollover Guarantee Banner */}
      {activeTrialDaysRemaining > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            padding: '14px 20px',
            marginBottom: '24px',
            borderRadius: '16px',
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#f0fdf4',
            border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0',
            color: isDark ? '#f8fafc' : '#166534',
            fontSize: '13.5px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#10b981',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Gift size={20} />
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '14px', color: isDark ? '#34d399' : '#15803d', marginBottom: '2px' }}>
                {isRtl ? 'ضمان ترحيل رصيد التجربة المجانية بالكامل 🎁' : 'Free Trial Rollover Guarantee 🎁'}
              </strong>
              <span style={{ color: isDark ? '#cbd5e1' : '#334155' }}>
                {isRtl
                  ? `لديك ${activeTrialDaysRemaining} يوم متبقية في فترتك التجريبية. عند الترقية إلى أي باقة الآن، ستُضاف كافة الأيام المتبقية تلقائياً فوق مدة باقتك الجديدة!`
                  : `You have ${activeTrialDaysRemaining} days remaining in your Free Trial. Upgrading now adds all remaining trial days on top of your purchased plan!`}
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7',
              border: '1px solid #10b981',
              color: isDark ? '#6ee7b7' : '#166534',
              fontWeight: 800,
              fontSize: '12px',
            }}
          >
            <Sparkles size={14} />
            +{activeTrialDaysRemaining} {isRtl ? 'يوم إضافي محفوظ' : 'Bonus Days Kept'}
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {plans
          .slice()
          .sort((a, b) => {
            const order = ['FREE_TRIAL', 'BASIC', 'PLUS', 'PRO', 'ENTERPRISE'];
            const idxA = order.indexOf(a.name);
            const idxB = order.indexOf(b.name);
            return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
          })
          .map((plan) => {
            const isTrial = plan.name === 'FREE_TRIAL';
            const isEnterprise = plan.name === 'ENTERPRISE';
            const isPlus = plan.name === 'PLUS';
            const isPopular = plan.name === 'PRO';
            const isCurrent = currentPlan === plan.name && (isTrial ? !isExpired : true);

            const cardBorder = isTrial
              ? isTrialClaimed
                ? isDark
                  ? '1px solid #334155'
                  : '1px solid #cbd5e1'
                : isDark
                ? '2px solid rgba(16, 185, 129, 0.5)'
                : '2px solid #10b981'
              : isEnterprise
              ? '2px solid #f59e0b'
              : isPopular
              ? '2px solid #8b5cf6'
              : isPlus
              ? '2px solid #6366f1'
              : isDark
              ? '1px solid rgba(51, 65, 85, 0.6)'
              : '1px solid #e2e8f0';

            const cardBg = isDark ? '#111827' : 'white';

            return (
              <div
                key={plan.id}
                style={{
                  backgroundColor: cardBg,
                  borderRadius: '20px',
                  border: cardBorder,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isTrial
                    ? isTrialClaimed
                      ? 'none'
                      : '0 10px 25px -5px rgba(16, 185, 129, 0.2)'
                    : isEnterprise
                    ? '0 10px 25px -5px rgba(245, 158, 11, 0.25)'
                    : isPopular
                    ? '0 10px 25px -5px rgba(139, 92, 246, 0.2)'
                    : isPlus
                    ? '0 10px 25px -5px rgba(99, 102, 241, 0.2)'
                    : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  position: 'relative',
                  opacity: isTrial && isTrialClaimed ? 0.75 : 1,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Header Badges */}
                {isTrial && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-11px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: isTrialClaimed ? (isDark ? '#475569' : '#64748b') : '#10b981',
                      color: 'white',
                      padding: '2px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: isTrialClaimed ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    {isTrialClaimed ? <Check size={12} /> : <Gift size={12} />}
                    {isTrialClaimed
                      ? isRtl
                        ? 'تم استهلاك التجربة المجانية'
                        : 'TRIAL CLAIMED'
                      : isRtl
                      ? 'تجربة مجانية للمتجر'
                      : 'FREE INTRODUCTORY TRIAL'}
                  </span>
                )}

                {isPlus && !isTrial && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-11px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#6366f1',
                      color: 'white',
                      padding: '2px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ⚡ {isRtl ? 'باقة بلس المتميزة' : 'GROWTH & SCALE'}
                  </span>
                )}

                {isPopular && !isTrial && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-11px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      padding: '2px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ⭐ {isRtl ? 'الأكثر طلباً' : 'MOST POPULAR'}
                  </span>
                )}

                {isEnterprise && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-11px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#d97706',
                      color: 'white',
                      padding: '2px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    💼 {isRtl ? 'حلول الشركات الكبرى' : 'ENTERPRISE VIP'}
                  </span>
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '18px', fontWeight: 800, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
                      {isTrial
                        ? isRtl
                          ? 'الفترة التجريبية المجانية'
                          : 'Free Trial'
                        : plan.name}
                    </h4>

                    {/* Period Badge */}
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: isTrial
                          ? isDark
                            ? 'rgba(16, 185, 129, 0.15)'
                            : '#ecfdf5'
                          : isEnterprise
                          ? isDark
                            ? 'rgba(245, 158, 11, 0.15)'
                            : '#fef3c7'
                          : isPlus
                          ? isDark
                            ? 'rgba(99, 102, 241, 0.15)'
                            : '#eef2ff'
                          : isDark
                          ? 'rgba(56, 189, 248, 0.15)'
                          : '#eff6ff',
                        color: isTrial
                          ? '#10b981'
                          : isEnterprise
                          ? '#f59e0b'
                          : isPlus
                          ? '#6366f1'
                          : '#38bdf8',
                        border: isTrial
                          ? isDark
                            ? '1px solid rgba(16, 185, 129, 0.3)'
                            : '1px solid #a7f3d0'
                          : isEnterprise
                          ? isDark
                            ? '1px solid rgba(245, 158, 11, 0.3)'
                            : '1px solid #fde68a'
                          : isPlus
                          ? isDark
                            ? '1px solid rgba(99, 102, 241, 0.3)'
                            : '1px solid #c7d2fe'
                          : isDark
                          ? '1px solid rgba(56, 189, 248, 0.3)'
                          : '1px solid #bfdbfe',
                      }}
                    >
                      {!isTrial && !isEnterprise && activeTrialDaysRemaining > 0
                        ? `${(plan.periodDays || 30) + activeTrialDaysRemaining} ${isRtl ? 'يوم' : 'Days'}`
                        : `${plan.periodDays || (isTrial ? 14 : 30)} ${isRtl ? 'يوم' : 'Days'}`}
                    </span>
                  </div>

                  {isEnterprise ? (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', lineHeight: 1.2 }}>
                        {isRtl ? 'حجم وتسعير مخصص' : 'Custom Scale'}
                      </div>
                      <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                        {isRtl ? 'تواصل مع خدمة العملاء للتخصيص' : 'Contact Customer Service'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: activeTrialDaysRemaining > 0 && !isTrial ? '8px' : '16px' }}>
                      <span style={{ fontSize: '32px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>
                        {plan.priceEgp}
                      </span>
                      <span style={{ fontSize: '14px', color: isDark ? '#94a3b8' : '#64748b' }}>
                        {isTrial
                          ? isRtl
                            ? 'ج.م (مجاناً تماماً)'
                            : 'EGP (100% Free)'
                          : `EGP / ${plan.periodDays || 30} ${isRtl ? 'يوم' : 'days'}`}
                      </span>
                    </div>
                  )}

                  {/* Free Trial Rollover Pill on Paid Plan Cards */}
                  {!isTrial && !isEnterprise && activeTrialDaysRemaining > 0 && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                        border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0',
                        color: '#10b981',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        marginBottom: '14px',
                      }}
                    >
                      <Gift size={13} />
                      {isRtl
                        ? `+${activeTrialDaysRemaining} يوم ترحيل من التجربة (${(plan.periodDays || 30) + activeTrialDaysRemaining} يوم إجمالي)`
                        : `+${activeTrialDaysRemaining} rollover trial days (${(plan.periodDays || 30) + activeTrialDaysRemaining}d total)`}
                    </div>
                  )}

                  {/* Plan Description */}
                  <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                    {isTrial
                      ? plan.description ||
                        (isRtl
                          ? `تجربة كاملة مجاناً لمدة ${plan.periodDays || 14} يوم وحتى ${plan.maxTransactions || 50} معاملة لاختبار كافة الميزات.`
                          : `${plan.periodDays || 14}-Day evaluation free trial with live InstaPay detection and ${plan.maxTransactions || 50} transactions limit.`)
                      : plan.description ||
                        (isRtl
                          ? `باقة متكاملة للمتاجر توفر حتى ${plan.maxTransactions} معاملة شهرياً.`
                          : `Scalable plan providing up to ${plan.maxTransactions} checkouts.`)}
                  </p>

                  {/* Plan Features Checklist */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#cbd5e1' : '#334155' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>
                        <strong>{plan.maxTransactions?.toLocaleString()}</strong> {isRtl ? 'معاملة مؤكدة' : 'confirmed transactions'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#cbd5e1' : '#334155' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>
                        {!isTrial && !isEnterprise && activeTrialDaysRemaining > 0
                          ? isRtl
                            ? `صلاحية ${(plan.periodDays || 30) + activeTrialDaysRemaining} يوم (${plan.periodDays || 30} باقة + ${activeTrialDaysRemaining} تجربة)`
                            : `${(plan.periodDays || 30) + activeTrialDaysRemaining} days validity (${plan.periodDays || 30} plan + ${activeTrialDaysRemaining} trial)`
                          : isRtl
                          ? `صلاحية ${plan.periodDays || (isTrial ? 14 : 30)} يوم من تاريخ التفعيل`
                          : `${plan.periodDays || (isTrial ? 14 : 30)} days validity period`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#cbd5e1' : '#334155' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>{isRtl ? 'تزامن فوري مع تطبيق الكاشف' : 'Real-time Detector APK Listener'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#cbd5e1' : '#334155' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>{isRtl ? 'ويب هوك مشفر بتوقيع HMAC-SHA256' : 'Signed Webhook Callbacks'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#cbd5e1' : '#334155' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>
                        {isTrial
                          ? isRtl
                            ? 'بدون بطاقة ائتمان وبدون التزام'
                            : 'No credit card or commitment required'
                          : isEnterprise
                          ? isRtl
                            ? 'مدير حساب مخصص ودعم فني على مدار الساعة'
                            : 'Dedicated account manager & 24/7 VIP SLA'
                          : isRtl
                          ? 'أولوية المعالجة ودعم فني مخصص'
                          : 'Priority processing & support'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Plan Action Button */}
                <button
                  onClick={() => {
                    if (isEnterprise) {
                      setShowContactModal(true);
                    } else if (isTrial && isTrialClaimed) {
                      if (showToast) showToast('info', isRtl ? 'تم استهلاك التجربة المجانية سابقاً. يمكنك الترقية إلى إحدى الباقات المدفوعة.' : 'Free trial already claimed. Please select a subscription tier.');
                    } else {
                      handleSelectPlan(plan.name);
                    }
                  }}
                  disabled={isCurrent || subscribingPlan === plan.name || (isTrial && isTrialClaimed)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: isCurrent || (isTrial && isTrialClaimed) ? 'default' : 'pointer',
                    backgroundColor: isCurrent || (isTrial && isTrialClaimed)
                      ? isDark
                        ? '#1e293b'
                        : '#f1f5f9'
                      : isTrial
                      ? '#10b981'
                      : isEnterprise
                      ? '#d97706'
                      : isPopular
                      ? '#8b5cf6'
                      : isPlus
                      ? '#6366f1'
                      : isDark
                      ? '#2563eb'
                      : '#0f172a',
                    color: isCurrent || (isTrial && isTrialClaimed) ? (isDark ? '#64748b' : '#94a3b8') : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: isCurrent || (isTrial && isTrialClaimed)
                      ? 'none'
                      : isTrial
                      ? '0 4px 14px rgba(16, 185, 129, 0.4)'
                      : isEnterprise
                      ? '0 4px 14px rgba(217, 119, 6, 0.4)'
                      : isPopular
                      ? '0 4px 14px rgba(139, 92, 246, 0.4)'
                      : isPlus
                      ? '0 4px 14px rgba(99, 102, 241, 0.4)'
                      : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isCurrent ? (
                    <>
                      <Check size={16} />
                      {isTrial
                        ? isRtl
                          ? 'فترتك التجريبية النشطة'
                          : 'Current Active Trial'
                        : isRtl
                        ? 'الباقة الحالية'
                        : 'Current Plan'}
                    </>
                  ) : isTrial && isTrialClaimed ? (
                    <>
                      <Check size={16} />
                      {isRtl ? 'تم استهلاك التجربة المجانية' : 'Trial Already Claimed'}
                    </>
                  ) : subscribingPlan === plan.name ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : isTrial ? (
                    <>
                      <Gift size={16} /> {isRtl ? 'بدء التجربة المجانية' : 'Start Free Trial'}
                    </>
                  ) : isEnterprise ? (
                    <>
                      <Headphones size={15} /> {isRtl ? 'تواصل مع خدمة العملاء' : 'Contact Customer Service'}
                    </>
                  ) : (
                    <>
                      <Zap size={15} /> {isRtl ? 'ترقية الآن عبر إنستاباي' : 'Upgrade via InstaPay'}
                    </>
                  )}
                </button>
              </div>
            );
          })}
      </div>

      {/* Subscription Payment Modal */}
      {checkoutModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: isDark ? '#111827' : 'white',
              borderRadius: '24px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              textAlign: 'center',
              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              color: isDark ? '#f8fafc' : '#1e293b',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#8b5cf6',
              }}
            >
              <CreditCard size={28} />
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 800, color: isDark ? '#f8fafc' : '#1e293b', margin: '0 0 6px 0' }}>
              {isRtl ? `دفع اشتراك باقة ${checkoutModal.planName}` : `Pay for ${checkoutModal.planName} Plan`}
            </h3>
            <p style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', margin: '0 0 16px 0' }}>
              {isRtl
                ? 'حول المبلغ المطلوب إلى حساب المنصة عبر إنستاباي، وسيتم تفعيل الباقة تلقائياً فور استلام الإشعار'
                : 'Transfer the exact amount to the platform InstaPay account. Your plan will activate automatically upon receipt.'}
            </p>

            {/* ─── Live Countdown Timer ─── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: modalTimeLeft <= 180 ? 'rgba(239, 68, 68, 0.15)' : isDark ? 'rgba(56, 189, 248, 0.1)' : '#eff6ff',
                border: modalTimeLeft <= 180 ? '1px solid rgba(239, 68, 68, 0.3)' : isDark ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid #bfdbfe',
                borderRadius: '12px',
                marginBottom: '16px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: modalTimeLeft <= 180 ? '#f87171' : isDark ? '#38bdf8' : '#0284c7',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} className={modalTimeLeft > 0 ? 'animate-pulse' : ''} />
                {modalTimeLeft <= 0
                  ? isRtl
                    ? '⚠️ انتهت صلاحية الجلسة'
                    : '⚠️ Session Expired'
                  : isRtl
                  ? 'الوقت المتبقي لإتمام التحويل:'
                  : 'Time remaining to pay:'}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 800 }}>
                {formatSeconds(modalTimeLeft)}
              </span>
            </div>

            {/* ─── Subscription Start & End Dates ─── */}
            <div
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '12px 16px',
                marginBottom: '16px',
                textAlign: isRtl ? 'right' : 'left',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isDark ? '#94a3b8' : '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Calendar size={13} color="#8b5cf6" />
                {isRtl ? 'فترة سريان الاشتراك:' : 'Subscription Validity Period:'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b', display: 'block', fontSize: '11px' }}>
                    {isRtl ? 'تاريخ البدء:' : 'Start Date:'}
                  </span>
                  <strong style={{ color: isDark ? '#f8fafc' : '#1e293b' }}>
                    {formatSubscriptionDate(checkoutModal.startDate || new Date())}
                  </strong>
                </div>
                <div>
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b', display: 'block', fontSize: '11px' }}>
                    {isRtl ? 'تاريخ الانتهاء:' : 'End Date:'}
                  </span>
                  <strong style={{ color: '#10b981' }}>
                    {formatSubscriptionDate(
                      checkoutModal.endDate ||
                        new Date(Date.now() + (checkoutModal.periodDays || 30) * 86400000)
                    )}
                  </strong>
                </div>
              </div>
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  color: isDark ? '#94a3b8' : '#64748b',
                  borderTop: isDark ? '1px dashed rgba(255, 255, 255, 0.1)' : '1px dashed #e2e8f0',
                  paddingTop: '6px',
                }}
              >
                {isRtl
                  ? `مدة الصلاحية: ${checkoutModal.periodDays || 30} يوم تبدأ فور استلام وتأكيد التحويل`
                  : `Duration: ${checkoutModal.periodDays || 30} Days activated upon confirmation`}
                {checkoutModal.bonusDays > 0 && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      color: '#10b981',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Gift size={13} />
                    {isRtl
                      ? `تم ترحيل +${checkoutModal.bonusDays} يوم متبقية من التجربة المجانية إلى باقتك الجديدة!`
                      : `+${checkoutModal.bonusDays} remaining trial days stacked onto this plan!`}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Editable Sender Account Username ─── */}
            <div
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '12px 16px',
                marginBottom: '16px',
                textAlign: isRtl ? 'right' : 'left',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isDark ? '#cbd5e1' : '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <User size={13} color="#38bdf8" />
                  {isRtl ? 'الحساب المُرسِل منه (إنستاباي):' : 'InstaPay Sender Username:'}
                </label>
                {!isEditingSender && (
                  <button
                    type="button"
                    onClick={() => setIsEditingSender(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: 0,
                    }}
                  >
                    <Edit2 size={11} /> {isRtl ? 'تغيير الحساب' : 'Change'}
                  </button>
                )}
              </div>

              {isEditingSender ? (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'stretch',
                      borderRadius: '8px',
                      border: '1px solid #38bdf8',
                      backgroundColor: isDark ? '#1e293b' : 'white',
                      overflow: 'hidden',
                    }}
                  >
                    <input
                      type="text"
                      value={senderInput}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/@instapay/gi, '').replace(/^@/, '');
                        setSenderInput(cleaned);
                      }}
                      placeholder="username"
                      dir="ltr"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: isDark ? '#f8fafc' : '#0f172a',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        outline: 'none',
                        minWidth: 0,
                      }}
                    />
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0 10px',
                        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.08)',
                        color: isDark ? '#a5b4fc' : '#4f46e5',
                        borderInlineStart: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
                        fontSize: '12px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        userSelect: 'none',
                      }}
                    >
                      @instapay
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveSender}
                    disabled={isSavingSender}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: isSavingSender ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isSavingSender ? <RefreshCw size={13} className="animate-spin" /> : isRtl ? 'حفظ' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (checkoutModal?.senderHandle) {
                        setSenderInput(checkoutModal.senderHandle.replace(/@instapay$/i, '').replace(/^@/, ''));
                      }
                      setIsEditingSender(false);
                    }}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: isDark ? '#334155' : '#e2e8f0',
                      color: isDark ? '#cbd5e1' : '#475569',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#38bdf8' }}>
                    {checkoutModal.senderHandle || (isRtl ? 'غير محدد بعد' : 'Not set')}
                  </span>
                  {senderSaved && (
                    <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Check size={12} /> {isRtl ? 'تم التحديث بنجاح' : 'Saved'}
                    </span>
                  )}
                </div>
              )}
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                {isRtl
                  ? 'حدد اسم الحساب أو رقم الهاتف الذي ستقوم بالتحويل منه لضمان المطابقة والتفعيل التلقائي الفوري.'
                  : 'Enter the InstaPay handle or phone you will send from to ensure automatic matching.'}
              </p>
            </div>

            {/* ─── Payment Details Box ─── */}
            <div
              style={{
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '16px',
                textAlign: isRtl ? 'right' : 'left',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  {isRtl ? 'المبلغ المطلوب:' : 'Exact Amount:'}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#10b981' }}>
                  {checkoutModal.priceEgp} EGP
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  {isRtl ? 'حساب المنصة المستلم:' : 'Platform Handle:'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#a855f7', fontFamily: 'monospace' }}>
                  {checkoutModal.recipientHandle}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  {isRtl ? 'رقم العملية:' : 'Session ID:'}
                </span>
                <span style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', fontFamily: 'monospace' }}>
                  {checkoutModal.sessionId}
                </span>
              </div>
            </div>

            {/* ─── Forward to Checkout Subdomain ─── */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <a
                  href={
                    checkoutModal.checkoutUrl ||
                    (window.location.hostname === 'localhost'
                      ? `http://checkout.localhost:3000/pay/${checkoutModal.sessionId}`
                      : `${window.location.protocol}//checkout.${window.location.host.replace(/^app\./, '')}/pay/${checkoutModal.sessionId}`)
                  }
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '11px 14px',
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
                    border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #7dd3fc',
                    color: isDark ? '#38bdf8' : '#0369a1',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    boxShadow: '0 2px 8px rgba(56, 189, 248, 0.15)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Globe size={15} />
                  <span>
                    {isRtl
                      ? 'الانتقال لصفحة الدفع في النطاق الفرعي (Checkout Subdomain)'
                      : 'Forward to Checkout Subdomain'}
                  </span>
                  <ExternalLink size={13} />
                </a>
                <button
                  type="button"
                  onClick={() =>
                    copySubdomainUrl(
                      checkoutModal.checkoutUrl ||
                        (window.location.hostname === 'localhost'
                          ? `http://checkout.localhost:3000/pay/${checkoutModal.sessionId}`
                          : `${window.location.protocol}//checkout.${window.location.host.replace(/^app\./, '')}/pay/${checkoutModal.sessionId}`)
                    )
                  }
                  title={isRtl ? 'نسخ رابط الدفع الفرعي' : 'Copy Subdomain Checkout Link'}
                  style={{
                    padding: '11px 14px',
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    color: copiedSubdomainUrl ? '#10b981' : isDark ? '#cbd5e1' : '#475569',
                  }}
                >
                  {copiedSubdomainUrl ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <span
                style={{
                  fontSize: '10.5px',
                  color: '#94a3b8',
                  display: 'block',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                }}
              >
                {checkoutModal.checkoutUrl ||
                  (window.location.hostname === 'localhost'
                    ? `http://checkout.localhost:3000/pay/${checkoutModal.sessionId}`
                    : `${window.location.protocol}//checkout.${window.location.host.replace(/^app\./, '')}/pay/${checkoutModal.sessionId}`)}
              </span>
            </div>

            {/* ─── Direct InstaPay Link & Copy ─── */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              <a
                href={checkoutModal.paymentUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)',
                }}
              >
                <ExternalLink size={16} /> {isRtl ? 'فتح في تطبيق إنستاباي' : 'Open in InstaPay'}
              </a>
              <button
                onClick={() => copyPaymentUrl(checkoutModal.paymentUrl)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  color: copiedLink ? '#10b981' : isDark ? '#cbd5e1' : '#475569',
                }}
              >
                {copiedLink ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>

            {/* ─── Live Waiting Indicator ─── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: isDark ? '#94a3b8' : '#64748b',
                fontSize: '13px',
                marginBottom: '18px',
              }}
            >
              <RefreshCw size={14} className="animate-spin" color="#7c3aed" />
              <span>
                {isRtl
                  ? 'في انتظار وصول التحويل وتأكيد الكاشف...'
                  : 'Listening for incoming InstaPay notification...'}
              </span>
            </div>

            <button
              onClick={() => setCheckoutModal(null)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'transparent',
                border: 'none',
                color: isDark ? '#94a3b8' : '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {isRtl ? 'إغلاق ومتابعة لاحقاً' : 'Close and complete later'}
            </button>
          </div>
        </div>
      )}

      {/* Contact Customer Service Modal for Enterprise Plan */}
      {showContactModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowContactModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: isDark ? '#111827' : 'white',
              borderRadius: '24px',
              padding: '28px',
              border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              textAlign: isRtl ? 'right' : 'left',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b',
                  }}
                >
                  <Headphones size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                    {isRtl ? 'خدمة عملاء باقة المؤسسات' : 'Enterprise Customer Service'}
                  </h3>
                  <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', margin: 0 }}>
                    {isRtl ? 'باقة مخصصة بحجم غير محدود وأولوية قصوى' : 'Custom Volume & Dedicated Account Management'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#94a3b8' : '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: isDark ? '#cbd5e1' : '#334155', lineHeight: 1.5, marginBottom: '20px' }}>
              {isRtl
                ? 'باقة المؤسسات (Enterprise) مصممة للعمليات الضخمة وتحتوي على مدير حساب مباشر واتفاقية مستوى خدمة مخصصة (SLA). تواصل مباشرة مع فريق خدمة العملاء لتفعيل باقتك فوراً:'
                : 'The Enterprise plan is tailored for high transaction volumes with dedicated account management and custom SLAs. Connect directly with our team:'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {/* WhatsApp VIP */}
              <a
                href="https://wa.me/201000000000?text=Hello%20InstaPay%20Team%2C%20I%20would%20like%20to%20inquire%20about%20the%20Enterprise%20Plan."
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0',
                  color: '#10b981',
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <MessageSquare size={18} />
                  <span>{isRtl ? 'محادثة فورية عبر واتساب (VIP)' : 'Instant Chat on WhatsApp (VIP)'}</span>
                </div>
                <ExternalLink size={15} />
              </a>

              {/* Email Support */}
              <a
                href="mailto:support@instapay-gateway.local?subject=Enterprise%20Plan%20Inquiry"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#eff6ff',
                  border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bfdbfe',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Mail size={18} />
                  <span>{isRtl ? 'البريد الإلكتروني لخدمة العملاء' : 'Email Customer Service'}</span>
                </div>
                <ExternalLink size={15} />
              </a>

              {/* Phone Line */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                  color: isDark ? '#f8fafc' : '#1e293b',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Phone size={18} color="#f59e0b" />
                  <span>{isRtl ? 'الخط الساخن المباشر للمبيعات:' : 'Direct Sales Hotline:'}</span>
                </div>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#f59e0b' }}>
                  +20 (0) 100 000 0000
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowContactModal(false);
                if (showToast) {
                  showToast('success', isRtl ? 'تم تسجيل اهتمامك، سيتواصل معك فريق خدمة العملاء قريباً!' : 'Inquiry logged! Our Customer Service team will reach out shortly.');
                }
              }}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#d97706',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {isRtl ? 'تسجيل طلب اتصال من خدمة العملاء' : 'Request Customer Service Callback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BillingPage;
