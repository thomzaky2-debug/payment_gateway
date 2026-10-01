import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  Shield,
  Globe,
  Clock,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Sliders,
  Check,
  Bell,
  Link,
  Store,
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';
import { settingsApi, notificationsApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export type SettingsTab = 'general' | 'precision' | 'webhooks' | 'notifications';

interface SettingsPageProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  subPath?: string;
  onSubPathChange?: (subPath: string) => void;
}

function parseTabFromSubPath(sub?: string): SettingsTab {
  if (!sub) return 'general';
  const clean = sub.toLowerCase();
  if (clean.includes('notification')) return 'notifications';
  if (clean.includes('precision') || clean.includes('tolerance')) return 'precision';
  if (clean.includes('webhook')) return 'webhooks';
  return 'general';
}

export function SettingsPage({ showToast, subPath, onSubPathChange }: SettingsPageProps) {
  const { isRtl } = useLanguage();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => parseTabFromSubPath(subPath));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // General Gateway settings
  const [businessName, setBusinessName] = useState('');
  const [instapayHandle, setInstapayHandle] = useState('');
  const [instapayPaymentUrl, setInstapayPaymentUrl] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [checkoutTtlMin, setCheckoutTtlMin] = useState(10);
  const [webhookSecret, setWebhookSecret] = useState('');

  // Payment Precision & Review Policies
  const [autoAcceptOverpaid, setAutoAcceptOverpaid] = useState(true);
  const [overpaidMaxExcessEgp, setOverpaidMaxExcessEgp] = useState<number | string>(100);
  const [underpaidToleranceEnabled, setUnderpaidToleranceEnabled] = useState(false);
  const [underpaidToleranceEgp, setUnderpaidToleranceEgp] = useState<number | string>(5.0);

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifyOnUnderpaid, setNotifyOnUnderpaid] = useState(true);
  const [notifyOnOverpaid, setNotifyOnOverpaid] = useState(true);
  const [notifyOnUnmatched, setNotifyOnUnmatched] = useState(true);
  const [notifyOnDetectorOffline, setNotifyOnDetectorOffline] = useState(true);

  // Sync tab when subPath changes (e.g. back/forward button or external navigation)
  useEffect(() => {
    if (subPath !== undefined) {
      setActiveTab(parseTabFromSubPath(subPath));
    }
  }, [subPath]);

  const switchTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    let target = '';
    if (tab === 'notifications') target = 'Notifications';
    else if (tab === 'precision') target = 'Precision';
    else if (tab === 'webhooks') target = 'Webhooks';
    onSubPathChange?.(target);
  };

  const fetchSettings = () => {
    setLoading(true);
    settingsApi
      .get()
      .then((res) => {
        if (res.ok && res.settings) {
          const s = res.settings;
          setBusinessName(s.businessName || '');
          setInstapayHandle(s.instapayHandle || '');
          setInstapayPaymentUrl(s.instapayPaymentUrl || '');
          setWebhookUrl(s.webhookUrl || '');
          setCheckoutTtlMin(s.checkoutTtlMin || 10);
          setWebhookSecret(s.webhookSecret || '');

          setAutoAcceptOverpaid(s.autoAcceptOverpaid ?? true);
          setOverpaidMaxExcessEgp(s.overpaidMaxExcessEgp ?? 100);
          setUnderpaidToleranceEnabled(s.underpaidToleranceEnabled ?? false);
          setUnderpaidToleranceEgp(s.underpaidToleranceEgp ?? 5.0);
        }
      })
      .catch(() => {
        if (showToast) {
          showToast('error', isRtl ? 'فشل تحميل إعدادات التاجر' : 'Failed to load merchant settings');
        }
      })
      .finally(() => setLoading(false));
  };

  const fetchNotificationsList = async () => {
    setLoadingNotifs(true);
    try {
      const res = await notificationsApi.list();
      if (res?.ok) {
        setNotifications(res.notifications || []);
      }
    } catch {
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchNotificationsList();
    }
  }, [activeTab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.update({
        businessName,
        instapayPaymentUrl,
        webhookUrl,
        checkoutTtlMin: Number(checkoutTtlMin),
        autoAcceptOverpaid,
        overpaidMaxExcessEgp:
          overpaidMaxExcessEgp !== '' && overpaidMaxExcessEgp != null
            ? Number(overpaidMaxExcessEgp)
            : null,
        underpaidToleranceEnabled,
        underpaidToleranceEgp: Number(underpaidToleranceEgp) || 0,
      });

      if (res.ok) {
        setSaved(true);
        if (showToast) {
          showToast('success', isRtl ? 'تم حفظ الإعدادات بنجاح!' : 'Settings updated successfully!');
        }
        setTimeout(() => setSaved(false), 2500);
      } else {
        if (showToast) showToast('error', res.error || (isRtl ? 'فشل الحفظ' : 'Failed to save settings'));
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || (isRtl ? 'فشل الحفظ' : 'Failed to save settings');
      if (showToast) showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      if (showToast) showToast('success', isRtl ? 'تم تحديد الكل كمقروء' : 'All notifications marked as read');
      fetchNotificationsList();
    } catch {}
  };

  const cardBg = isDark ? '#111827' : 'white';
  const cardBorder = isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0';
  const labelColor = isDark ? '#f8fafc' : '#334155';
  const subtextColor = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#1e293b' : 'white';
  const inputBorder = isDark ? '1px solid #334155' : '1px solid #cbd5e1';
  const inputColor = isDark ? '#f8fafc' : '#1e293b';

  const tabItems: { key: SettingsTab; labelEn: string; labelAr: string; icon: React.ReactNode }[] = [
    { key: 'general', labelEn: 'Store & Credentials', labelAr: 'بيانات المتجر والحساب', icon: <Store size={15} /> },
    { key: 'precision', labelEn: 'Precision & Review Rules', labelAr: 'قواعد السماحية والمراجعة', icon: <Sliders size={15} /> },
    { key: 'webhooks', labelEn: 'Webhooks & API', labelAr: 'الويب هوك وبوابة المطور', icon: <Link size={15} /> },
    { key: 'notifications', labelEn: 'Notifications', labelAr: 'التنبيهات والإشعارات', icon: <Bell size={15} /> },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* Page Header */}
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
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
            {isRtl ? 'إعدادات المتجر وقواعد البوابة' : 'Settings & Precision Controls'}
          </h2>
          <p style={{ fontSize: '14px', color: subtextColor, margin: '4px 0 0 0' }}>
            {isRtl
              ? 'تخصيص روابط الدفع، وسماحية المبالغ الزائدة والناقصة، والويبهوك والتنبيهات'
              : 'Configure payment links, overpaid & underpaid precision tolerances, webhooks and notifications'}
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            backgroundColor: '#10b981',
            color: 'white',
            fontSize: '14px',
            fontWeight: 700,
            borderRadius: '10px',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 15px -3px rgba(16,185,129,0.35)',
            transition: 'all 0.15s',
          }}
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saving
            ? isRtl
              ? 'جاري الحفظ...'
              : 'Saving...'
            : saved
            ? isRtl
              ? 'تم الحفظ!'
              : 'Saved!'
            : isRtl
            ? 'حفظ التعديلات'
            : 'Save Changes'}
        </button>
      </div>

      {/* Settings Sub-Navigation Tabs (ChatGPT-Style Hash Routing) */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '24px',
          whiteSpace: 'nowrap',
          borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0',
        }}
      >
        {tabItems.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                backgroundColor: isActive
                  ? '#2563eb'
                  : isDark
                  ? '#1e293b'
                  : 'white',
                color: isActive ? 'white' : isDark ? '#cbd5e1' : '#475569',
                border: isActive
                  ? '1px solid #2563eb'
                  : isDark
                  ? '1px solid #334155'
                  : '1px solid #e2e8f0',
                transition: 'all 0.15s',
                boxShadow: isActive ? '0 4px 10px rgba(37, 99, 235, 0.3)' : 'none',
              }}
            >
              {tab.icon}
              <span>{isRtl ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div
          style={{
            backgroundColor: cardBg,
            borderRadius: '16px',
            border: cardBorder,
            padding: '48px',
            textAlign: 'center',
            color: subtextColor,
          }}
        >
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#10b981' }} />
          <div>{isRtl ? 'جاري تحميل الإعدادات...' : 'Loading settings...'}</div>
        </div>
      ) : (
        <div>
          {/* TAB 1: General Store Credentials */}
          {activeTab === 'general' && (
            <div
              style={{
                backgroundColor: cardBg,
                borderRadius: '16px',
                border: cardBorder,
                padding: '24px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              }}
            >
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: labelColor, margin: '0 0 16px 0' }}>
                {isRtl ? 'معلومات المتجر وبيانات الحساب' : 'Store & Payment Credentials'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: labelColor, marginBottom: '6px' }}>
                      {isRtl ? 'الاسم التجاري للمتجر' : 'Business Display Name'}
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: inputBorder,
                        backgroundColor: inputBg,
                        color: inputColor,
                        fontSize: '14px',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: labelColor, marginBottom: '6px' }}>
                      {isRtl ? 'عنوان إنستاباي المستلم (مقفل)' : 'Receiving InstaPay Handle (Locked)'}
                    </label>
                    <input
                      type="text"
                      disabled
                      value={instapayHandle}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: inputBorder,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                        color: subtextColor,
                        fontSize: '14px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: labelColor, marginBottom: '6px' }}>
                    {isRtl ? 'رابط الدفع المباشر الثابت لإنستاباي (Static InstaPay URL)' : 'Static InstaPay Payment / Share URL'}
                  </label>
                  <p style={{ fontSize: '12px', color: subtextColor, margin: '0 0 8px 0' }}>
                    {isRtl
                      ? 'انسخ رابط المشاركة الثابت من تطبيق إنستاباي الرسمي (مثال: https://ipn.eg/S/username/instapay/TOKEN)'
                      : 'Copy your exact share payment URL from the official InstaPay app (e.g. https://ipn.eg/S/username/instapay/TOKEN).'}
                  </p>
                  <input
                    type="url"
                    value={instapayPaymentUrl}
                    onChange={(e) => setInstapayPaymentUrl(e.target.value)}
                    placeholder="https://ipn.eg/S/..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: inputBorder,
                      backgroundColor: inputBg,
                      color: inputColor,
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: labelColor, marginBottom: '6px' }}>
                    {isRtl ? 'مدة صلاحية جلسة الدفع بالدقائق (TTL)' : 'Checkout Session Lifetime (Minutes)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={checkoutTtlMin}
                    onChange={(e) => setCheckoutTtlMin(Number(e.target.value))}
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: inputBorder,
                      backgroundColor: inputBg,
                      color: inputColor,
                      fontSize: '14px',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: subtextColor, marginTop: '4px', display: 'block' }}>
                    {isRtl
                      ? 'المدة التي تظل فيها جلسة العميل نشطة لانتظار التحويل (الافتراضي 10 دقائق).'
                      : 'Duration a checkout session remains active awaiting customer payment (default: 10 mins).'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Payment Precision & Review Rules */}
          {activeTab === 'precision' && (
            <div
              style={{
                backgroundColor: cardBg,
                borderRadius: '16px',
                border: cardBorder,
                padding: '24px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                  }}
                >
                  <Sliders size={20} />
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: labelColor, margin: 0 }}>
                  {isRtl ? 'قواعد سماحية الدفع والمراجعة اليدوية' : 'Payment Precision & Review Rules'}
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: subtextColor, margin: '0 0 20px 0' }}>
                {isRtl
                  ? 'تحكم في كيفية تعامل النظام التلقائي مع المدفوعات الزائدة أو الناقصة بهامش دقة محدد دون تعطيل العميل.'
                  : 'Control how the payment engine handles overpaid and underpaid transfers within your agreed precision tolerance.'}
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '20px',
                }}
              >
                {/* Overpaid Rule Card */}
                <div
                  style={{
                    backgroundColor: isDark ? '#162033' : '#f8fafc',
                    borderRadius: '14px',
                    padding: '20px',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={18} color="#10b981" />
                      <span style={{ fontSize: '15px', fontWeight: 700, color: labelColor }}>
                        {isRtl ? 'قبول المبالغ الزائدة (Overpaid Acceptance)' : 'Auto-Accept Overpaid Transfers'}
                      </span>
                    </div>

                    {/* Switch Toggle */}
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={autoAcceptOverpaid}
                        onChange={(e) => setAutoAcceptOverpaid(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: autoAcceptOverpaid ? '#10b981' : isDark ? '#334155' : '#cbd5e1',
                          borderRadius: '24px',
                          transition: '0.2s',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            height: '18px',
                            width: '18px',
                            left: autoAcceptOverpaid ? (isRtl ? '4px' : '22px') : (isRtl ? '22px' : '4px'),
                            bottom: '3px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            transition: '0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          }}
                        />
                      </span>
                    </label>
                  </div>

                  <p style={{ fontSize: '12px', color: subtextColor, margin: '0 0 16px 0', lineHeight: 1.5 }}>
                    {isRtl
                      ? 'عند التفعيل، يتم قبول المعاملات التي يدفع فيها العميل مبلغاً أعلى من المطلوب تلقائياً وتأكيد الطلب مع تسجيل المبلغ الزائد كفائض لصالح المتجر.'
                      : 'Automatically accept transactions when the customer transfers more than requested, marking the session CONFIRMED and crediting the excess.'}
                  </p>

                  {autoAcceptOverpaid && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: labelColor, marginBottom: '6px' }}>
                        {isRtl ? 'الحد الأقصى للمبلغ الزائد المسموح به (EGP)' : 'Max Auto-Accepted Excess (EGP)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={overpaidMaxExcessEgp}
                        onChange={(e) => setOverpaidMaxExcessEgp(e.target.value)}
                        placeholder="100.00"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: inputBorder,
                          backgroundColor: inputBg,
                          color: inputColor,
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      />
                      <span style={{ fontSize: '11px', color: subtextColor, marginTop: '4px', display: 'block' }}>
                        {isRtl
                          ? 'إذا تجاوزت الزيادة هذا الحد، ستُرسل إلى قائمة المراجعة اليدوية.'
                          : 'Overpayments exceeding this buffer will be held for manual merchant review.'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Underpaid Tolerance Rule Card */}
                <div
                  style={{
                    backgroundColor: isDark ? '#162033' : '#f8fafc',
                    borderRadius: '14px',
                    padding: '20px',
                    border: isDark ? '1px solid rgba(234, 88, 12, 0.25)' : '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={18} color="#ea580c" />
                      <span style={{ fontSize: '15px', fontWeight: 700, color: labelColor }}>
                        {isRtl ? 'سماحية العجز في الدفع (Underpaid Tolerance)' : 'Underpaid Precision Tolerance'}
                      </span>
                    </div>

                    {/* Switch Toggle */}
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={underpaidToleranceEnabled}
                        onChange={(e) => setUnderpaidToleranceEnabled(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: underpaidToleranceEnabled ? '#ea580c' : isDark ? '#334155' : '#cbd5e1',
                          borderRadius: '24px',
                          transition: '0.2s',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            height: '18px',
                            width: '18px',
                            left: underpaidToleranceEnabled ? (isRtl ? '4px' : '22px') : (isRtl ? '22px' : '4px'),
                            bottom: '3px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            transition: '0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          }}
                        />
                      </span>
                    </label>
                  </div>

                  <p style={{ fontSize: '12px', color: subtextColor, margin: '0 0 16px 0', lineHeight: 1.5 }}>
                    {isRtl
                      ? 'في حال موافقة التاجر على هامش دقة معين (مثلاً خصم رسوم بنكية أو تقريب)، يتم قبول المعاملة وتأكيدها فوراً إذا كان العجز ضمن هذا الحد.'
                      : 'If customer transfers an amount short by up to this agreed precision limit (e.g. transfer fee deductions), automatically accept and mark CONFIRMED.'}
                  </p>

                  {underpaidToleranceEnabled && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: labelColor, marginBottom: '6px' }}>
                        {isRtl ? 'حد دقة السماحية المقبول (EGP)' : 'Agreed Precision Tolerance Limit (EGP)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={underpaidToleranceEgp}
                        onChange={(e) => setUnderpaidToleranceEgp(e.target.value)}
                        placeholder="5.00"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: inputBorder,
                          backgroundColor: inputBg,
                          color: inputColor,
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      />
                      <span style={{ fontSize: '11px', color: subtextColor, marginTop: '4px', display: 'block' }}>
                        {isRtl
                          ? `أي عجز أكبر من ${underpaidToleranceEgp || 0} EGP سيتم تحويله إلى قائمة المراجعة اليدوية.`
                          : `Any shortage greater than ${underpaidToleranceEgp || 0} EGP will be flagged in Manual Review.`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Webhooks & API Integration */}
          {activeTab === 'webhooks' && (
            <div
              style={{
                backgroundColor: cardBg,
                borderRadius: '16px',
                border: cardBorder,
                padding: '24px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              }}
            >
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: labelColor, margin: '0 0 16px 0' }}>
                {isRtl ? 'إعدادات الويب هوك وتكامل الخادم' : 'Webhooks & Server Integration'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: labelColor, marginBottom: '6px' }}>
                    {isRtl ? 'رابط الويب هوك (Merchant Webhook URL)' : 'Merchant Webhook URL'}
                  </label>
                  <p style={{ fontSize: '12px', color: subtextColor, margin: '0 0 8px 0' }}>
                    {isRtl
                      ? 'الرابط الذي ستصل إليه إشعارات تأكيد الدفع المشفرة بتوقيع HMAC-SHA256 فور تطابق التحويل.'
                      : 'The endpoint where HMAC-SHA256 signed payment events (payment.confirmed, payment.underpaid) are posted.'}
                  </p>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://api.yourdomain.com/webhooks/instapay"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: inputBorder,
                      backgroundColor: inputBg,
                      color: inputColor,
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: labelColor, marginBottom: '6px' }}>
                    {isRtl ? 'مفتاح توقيع الويب هوك (Webhook Secret)' : 'Webhook Signing Secret'}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={webhookSecret || (isRtl ? 'يتم توليده تلقائياً عند الاعتماد' : 'Auto-generated upon approval')}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: inputBorder,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                      color: subtextColor,
                      fontSize: '13px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: subtextColor, marginTop: '4px', display: 'block' }}>
                    {isRtl
                      ? 'استخدم هذا المفتاح للتحقق من هيدر x-instapay-signature في خادمك.'
                      : 'Use this secret to verify the x-instapay-signature header on incoming callbacks.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Notifications & Alerts (ChatGPT #settings/Notifications Style) */}
          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Notification Preferences Card */}
              <div
                style={{
                  backgroundColor: cardBg,
                  borderRadius: '16px',
                  border: cardBorder,
                  padding: '24px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                }}
              >
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: labelColor, margin: '0 0 16px 0' }}>
                  {isRtl ? 'تفضيلات الإشعارات والتنبيهات' : 'Notification Preferences'}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      border: cardBorder,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: labelColor }}>
                        {isRtl ? 'تنبيهات المدفوعات الناقصة' : 'Underpaid Payment Alerts'}
                      </div>
                      <div style={{ fontSize: '11px', color: subtextColor }}>
                        {isRtl ? 'إشعار فوري عند وجود عجز في الدفع' : 'Instant alert when customer underpays'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyOnUnderpaid}
                      onChange={(e) => setNotifyOnUnderpaid(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      border: cardBorder,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: labelColor }}>
                        {isRtl ? 'تنبيهات المبالغ الزائدة' : 'Overpaid Payment Alerts'}
                      </div>
                      <div style={{ fontSize: '11px', color: subtextColor }}>
                        {isRtl ? 'إشعار عند استلام مبالغ إضافية' : 'Instant alert when customer overpays'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyOnOverpaid}
                      onChange={(e) => setNotifyOnOverpaid(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      border: cardBorder,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: labelColor }}>
                        {isRtl ? 'تنبيهات التحويلات اليتيمة' : 'Unmatched Direct Transfers'}
                      </div>
                      <div style={{ fontSize: '11px', color: subtextColor }}>
                        {isRtl ? 'إشعار بالتحويلات المباشرة بدون جلسة' : 'Alert when direct transfer has no session'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyOnUnmatched}
                      onChange={(e) => setNotifyOnUnmatched(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                      border: cardBorder,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: labelColor }}>
                        {isRtl ? 'حالة جهاز الكاشف' : 'Detector Health Warnings'}
                      </div>
                      <div style={{ fontSize: '11px', color: subtextColor }}>
                        {isRtl ? 'تنبيه عند انقطاع هاتف الكاشف' : 'Alert if Android detector goes offline'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyOnDetectorOffline}
                      onChange={(e) => setNotifyOnDetectorOffline(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

              {/* Live Notifications History / Inbox */}
              <div
                style={{
                  backgroundColor: cardBg,
                  borderRadius: '16px',
                  border: cardBorder,
                  padding: '24px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bell size={18} color="#2563eb" />
                    <h3 style={{ fontSize: '17px', fontWeight: 800, color: labelColor, margin: 0 }}>
                      {isRtl ? 'سجل الإشعارات الواردة' : 'Recent Notifications'}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={fetchNotificationsList}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                        color: isDark ? '#cbd5e1' : '#475569',
                        border: inputBorder,
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <RefreshCw size={12} className={loadingNotifs ? 'animate-spin' : ''} />
                      <span>{isRtl ? 'تحديث' : 'Refresh'}</span>
                    </button>

                    {notifications.length > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCheck size={14} />
                        <span>{isRtl ? 'تحديد الكل كمقروء' : 'Mark all read'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {loadingNotifs ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: subtextColor }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#2563eb' }} />
                    {isRtl ? 'جاري تحميل الإشعارات...' : 'Loading notifications...'}
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: subtextColor }}>
                    <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 8px auto' }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      {isRtl ? 'لا توجد إشعارات جديدة حالياً.' : 'No notifications in your inbox.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          backgroundColor: n.readAt
                            ? (isDark ? '#162033' : '#f8fafc')
                            : (isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff'),
                          border: n.readAt
                            ? cardBorder
                            : (isDark ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid #bfdbfe'),
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '12px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: n.severity === 'URGENT'
                                  ? (isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2')
                                  : (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe'),
                                color: n.severity === 'URGENT' ? '#f87171' : '#0284c7',
                              }}
                            >
                              {n.severity}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: labelColor }}>
                              {n.title}
                            </span>
                          </div>
                          <p style={{ fontSize: '12px', color: subtextColor, margin: 0, lineHeight: 1.4 }}>
                            {n.message}
                          </p>
                        </div>
                        <span style={{ fontSize: '11px', color: subtextColor, whiteSpace: 'nowrap' }}>
                          {new Date(n.createdAt).toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
