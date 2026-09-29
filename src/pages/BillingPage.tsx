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
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';
import { plansApi, subscriptionApi, authApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface BillingPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function BillingPage({ showToast }: BillingPageProps) {
  const { t, isRtl } = useLanguage();
  const [client, setClient] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
  const [checkoutModal, setCheckoutModal] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionRes, plansRes] = await Promise.all([
        authApi.getSession(),
        plansApi.list(),
      ]);

      if (sessionRes?.ok && sessionRes?.client) {
        setClient(sessionRes.client);
      }
      if (plansRes?.ok && plansRes?.plans) {
        setPlans(plansRes.plans);
      }
    } catch {
      if (showToast) showToast('error', 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Poll subscription status if modal is open
  useEffect(() => {
    if (!checkoutModal?.sessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await subscriptionApi.getStatus(checkoutModal.sessionId);
        if (res?.ok && res?.transaction?.status === 'CONFIRMED') {
          clearInterval(interval);
          if (showToast) showToast('success', `Plan ${res.transaction.planName} activated successfully!`);
          setCheckoutModal(null);
          loadData();
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [checkoutModal?.sessionId]);

  const handleSelectPlan = async (planName: string) => {
    setSubscribingPlan(planName);
    try {
      const res = await subscriptionApi.checkout(planName);
      if (res?.ok && res?.checkout) {
        setCheckoutModal(res.checkout);
      } else {
        if (showToast) showToast('error', res?.error || 'Failed to initiate plan checkout');
      }
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

  const txCount = client?.txCount ?? 0;
  const txLimit = client?.txLimit ?? 20;
  const usagePercent = Math.min(100, Math.round((txCount / txLimit) * 100));
  const currentPlan = client?.subscriptionPlan || 'FREE_TRIAL';

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
            {isRtl ? 'الاشتراكات وإدارة الباقات' : 'Plans & Subscription Billing'}
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
            {isRtl ? 'اختر باقة تناسب حجم أعمالك وقم بالدفع المباشر عبر تطبيق إنستاباي' : 'Choose a plan tailored to your business volume and pay directly via InstaPay'}
          </p>
        </div>
        <button
          onClick={loadData}
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
          {t('refresh')}
        </button>
      </div>

      {/* Current Active Plan Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '20px',
          padding: '28px',
          color: 'white',
          marginBottom: '32px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
          border: '1px solid #334155',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  backgroundColor: client?.isFreeTrial ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: client?.isFreeTrial ? '#fbbf24' : '#34d399',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: client?.isFreeTrial ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                }}
              >
                {client?.isFreeTrial ? (isRtl ? 'فترة تجريبية مجانية' : 'FREE TRIAL') : (isRtl ? 'باقة نشطة' : 'ACTIVE PLAN')}
              </span>
              <h3 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
                {currentPlan}
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '6px 0 0 0' }}>
              {isRtl ? 'المتجر:' : 'Merchant:'} <strong>{client?.businessName || 'Business'}</strong> • {isRtl ? 'الحساب المستلم:' : 'Receiving Handle:'} <code style={{ color: '#38bdf8' }}>{client?.instapayHandle}</code>
            </p>
          </div>

          <div style={{ textAlign: isRtl ? 'left' : 'right' }}>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>{isRtl ? 'تاريخ الانتهاء' : 'Renewal / Expiry Date'}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
              {client?.subscriptionEndsAt ? new Date(client.subscriptionEndsAt).toLocaleDateString() : (isRtl ? 'غير محدد' : 'No Expiry')}
            </div>
          </div>
        </div>

        {/* Usage Progress Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ color: '#cbd5e1' }}>{isRtl ? 'المعاملات المستهلكة هذا الشهر' : 'Monthly Transaction Quota Used'}</span>
            <span style={{ fontWeight: 700, color: usagePercent > 85 ? '#f87171' : '#38bdf8' }}>
              {txCount} / {txLimit} ({usagePercent}%)
            </span>
          </div>
          <div style={{ height: '8px', backgroundColor: '#334155', borderRadius: '9999px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${usagePercent}%`,
                backgroundColor: usagePercent > 85 ? '#ef4444' : '#38bdf8',
                borderRadius: '9999px',
                transition: 'width 0.4s ease-in-out',
              }}
            />
          </div>
        </div>
      </div>

      {/* Available Plans Grid */}
      <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '16px' }}>
        {isRtl ? 'اختر باقة الترقية' : 'Available Subscription Tiers'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {plans
          .filter((p) => p.name !== 'FREE_TRIAL')
          .map((plan) => {
            const isCurrent = currentPlan === plan.name;
            const isPopular = plan.name === 'PRO';

            return (
              <div
                key={plan.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '20px',
                  border: isPopular ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isPopular ? '0 10px 25px -5px rgba(139, 92, 246, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  position: 'relative',
                }}
              >
                {isPopular && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      padding: '2px 12px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    ⭐ {isRtl ? 'الأكثر طلباً' : 'MOST POPULAR'}
                  </span>
                )}

                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', margin: '0 0 8px 0' }}>
                    {plan.name}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a' }}>
                      {plan.priceEgp}
                    </span>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>EGP / {isRtl ? 'شهرياً' : 'month'}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span><strong>{plan.maxTransactions}</strong> {isRtl ? 'معاملة مؤكدة شهرياً' : 'confirmed checkouts/month'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>{isRtl ? 'تزامن فوري عبر تطبيق الكاشف' : 'Real-time Detector APK Listener'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>{isRtl ? 'ويب هوك مشفر بتوقيع HMAC-SHA256' : 'Signed Webhook Callbacks'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>{isRtl ? 'دعم فني سريع وأولوية المعالجة' : 'Priority Gateway Infrastructure'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectPlan(plan.name)}
                  disabled={isCurrent || subscribingPlan === plan.name}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: isCurrent ? 'default' : 'pointer',
                    backgroundColor: isCurrent ? '#f1f5f9' : isPopular ? '#8b5cf6' : '#0f172a',
                    color: isCurrent ? '#94a3b8' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {isCurrent ? (
                    isRtl ? 'الباقة الحالية' : 'Current Plan'
                  ) : subscribingPlan === plan.name ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Zap size={15} /> {isRtl ? 'ترقية الآن' : 'Upgrade via InstaPay'}
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
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'white',
              borderRadius: '24px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              textAlign: 'center',
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

            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', margin: '0 0 6px 0' }}>
              {isRtl ? `دفع اشتراك باقة ${checkoutModal.planName}` : `Pay for ${checkoutModal.planName} Plan`}
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
              {isRtl
                ? 'حول المبلغ المطلوب إلى حساب المنصة عبر إنستاباي، وسيتم تفعيل الباقة تلقائياً فور استلام الإشعار'
                : 'Transfer the exact amount to the platform InstaPay account. Your plan will activate automatically upon receipt.'}
            </p>

            {/* Payment Details Box */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', marginBottom: '20px', textAlign: isRtl ? 'right' : 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{isRtl ? 'المبلغ المطلوب:' : 'Exact Amount:'}</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{checkoutModal.priceEgp} EGP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{isRtl ? 'حساب المنصة المستلم:' : 'Platform Handle:'}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#7c3aed', fontFamily: 'monospace' }}>{checkoutModal.recipientHandle}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{isRtl ? 'رقم العملية:' : 'Session ID:'}</span>
                <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>{checkoutModal.sessionId}</span>
              </div>
            </div>

            {/* Direct Pay Link */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
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
                }}
              >
                <ExternalLink size={16} /> {isRtl ? 'فتح في تطبيق إنستاباي' : 'Open in InstaPay'}
              </a>
              <button
                onClick={() => copyPaymentUrl(checkoutModal.paymentUrl)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  color: copiedLink ? '#10b981' : '#475569',
                }}
              >
                {copiedLink ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>

            {/* Live Waiting Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              <RefreshCw size={14} className="animate-spin" color="#7c3aed" />
              <span>{isRtl ? 'في انتظار وصول التحويل وتأكيد الكاشف...' : 'Listening for incoming InstaPay notification...'}</span>
            </div>

            <button
              onClick={() => setCheckoutModal(null)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {isRtl ? 'إغلاق ومتابعة لاحقاً' : 'Close and complete later'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
