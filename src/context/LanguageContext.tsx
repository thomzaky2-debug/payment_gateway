import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'ar';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  isRtl: boolean;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav
    overview: 'Dashboard Overview',
    transactions: 'Transactions',
    review: 'Manual Review',
    billing: 'Plans & Billing',
    detector: 'Detector Health',
    developers: 'Developer Portal',
    settings: 'Settings',
    audit: 'Audit Log',
    security: 'Security',
    logout: 'Logout',
    collapse_sidebar: 'Collapse sidebar',
    expand_sidebar: 'Expand sidebar',
    system_online: 'System Online',
    services_operational: 'All services operational',
    
    // Overview
    todays_confirmed: "Today's Confirmed",
    seven_day_rev: '7-Day Revenue',
    pending_checkouts: 'Pending Checkouts',
    plan_quota: 'Monthly Plan Quota',
    recent_activity: 'Recent Activity',
    onboarding_checklist: 'Merchant Onboarding Checklist',
    purchase_type: 'Purchase Type',
    purchased_item: 'Item Purchased',
    timestamp: 'Timestamp',
    
    // Common Actions
    export_csv: 'Export CSV',
    refresh: 'Refresh',
    search: 'Search...',
    accept_confirm: 'Accept & Confirm',
    dismiss: 'Dismiss',
    save_changes: 'Save Changes',
    upgrade_plan: 'Upgrade Plan',
    download_apk: 'Download Companion APK',
    
    // Statuses
    confirmed: 'CONFIRMED',
    pending: 'PENDING',
    underpaid: 'UNDERPAID',
    expired: 'EXPIRED',
    approved: 'APPROVED',
    rejected: 'REJECTED',
    
    // Notifications
    notifications: 'Notifications',
    no_notifications: 'No new notifications',
    mark_all_read: 'Mark all as read',

    // Auth & OTP
    sign_in: 'Sign In',
    register: 'Register',
    email: 'Email Address',
    password: 'Password',
    verification_code: 'Verification Code (OTP)',
    send_code: 'Send Code',
    verify_and_login: 'Verify & Sign In',
    verify_and_register: 'Verify & Complete Registration',
    code_sent_to: 'We sent a 6-digit verification code to',
    resend_code: 'Resend Code',
    back_to_login: 'Back to Sign In',
    otp_help_note: 'Check your email inbox or spam folder for your 6-digit code.',
    forgot_password: 'Forgot Password?',
    reset_password: 'Reset Password',
    reset_password_desc: 'Enter your email and we\'ll send a code to reset your password',
    new_password: 'New Password',
    confirm_new_password: 'Confirm New Password',
    send_reset_code: 'Send Reset Code',
    reset_and_login: 'Reset Password & Sign In',
    password_reset_success: 'Password updated! You can now sign in.',
    back_to_sign_in: 'Back to Sign In',
  },
  ar: {
    // Nav
    overview: 'لوحة التحكم',
    transactions: 'المعاملات',
    review: 'المراجعة اليدوية',
    billing: 'الاشتراكات والباقات',
    detector: 'أجهزة الكاشف',
    developers: 'بوابة المطورين',
    settings: 'الإعدادات',
    audit: 'سجل العمليات',
    security: 'الأمان',
    logout: 'تسجيل الخروج',
    collapse_sidebar: 'طي القائمة الجانبية',
    expand_sidebar: 'توسيع القائمة الجانبية',
    system_online: 'النظام متصل',
    services_operational: 'جميع الخدمات تعمل بنجاح',
    
    // Overview
    todays_confirmed: 'المدفوعات المؤكدة اليوم',
    seven_day_rev: 'إيرادات 7 أيام',
    pending_checkouts: 'في انتظار التحويل',
    plan_quota: 'الباقة والحد الشهري',
    recent_activity: 'النشاط الأخير',
    onboarding_checklist: 'قائمة إعداد وتفعيل المتجر',
    purchase_type: 'نوع المشتريات',
    purchased_item: 'المنتج / نوع العملية',
    timestamp: 'التوقيت والتاريخ',
    
    // Common Actions
    export_csv: 'تصدير CSV',
    refresh: 'تحديث',
    search: 'بحث...',
    accept_confirm: 'قبول وتأكيد الدفع',
    dismiss: 'تجاهل',
    save_changes: 'حفظ التعديلات',
    upgrade_plan: 'ترقية الباقة',
    download_apk: 'تحميل تطبيق الكاشف APK',
    
    // Statuses
    confirmed: 'مؤكد',
    pending: 'معلق',
    underpaid: 'مدفوع جزئياً',
    expired: 'منتهي الصلاحية',
    approved: 'معتمد',
    rejected: 'مرفوض',
    
    // Notifications
    notifications: 'الإشعارات',
    no_notifications: 'لا توجد إشعارات جديدة',
    mark_all_read: 'تحديد الكل كمقروء',

    // Auth & OTP
    sign_in: 'تسجيل الدخول',
    register: 'إنشاء حساب جديد',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    verification_code: 'رمز التحقق (OTP)',
    send_code: 'إرسال الرمز',
    verify_and_login: 'تحقق وتأكيد الدخول',
    verify_and_register: 'تحقق واستكمال التسجيل',
    code_sent_to: 'أرسلنا رمز تحقق مكون من 6 أرقام إلى',
    resend_code: 'إعادة إرسال الرمز',
    back_to_login: 'العودة لتسجيل الدخول',
    otp_help_note: 'تحقق من صندوق الوارد أو الرسائل غير المرغوب فيها للرمز المكون من 6 أرقام.',
    forgot_password: 'نسيت كلمة المرور؟',
    reset_password: 'إعادة تعيين كلمة المرور',
    reset_password_desc: 'أدخل بريدك الإلكتروني وسنرسل لك رمزاً لإعادة تعيين كلمة المرور',
    new_password: 'كلمة المرور الجديدة',
    confirm_new_password: 'تأكيد كلمة المرور الجديدة',
    send_reset_code: 'إرسال رمز الاستعادة',
    reset_and_login: 'تغيير كلمة المرور والدخول',
    password_reset_success: 'تم تحديث كلمة المرور! يمكنك تسجيل الدخول الآن.',
    back_to_sign_in: 'العودة لتسجيل الدخول',
  },
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: (k: string) => k,
  isRtl: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('instapay_lang') as Language;
      return saved === 'ar' || saved === 'en' ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem('instapay_lang', newLang);
      document.cookie = `instapay_lang=${newLang}; path=/; max-age=31536000`;
    } catch {}
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const t = (key: string): string => {
    return translations[lang]?.[key] || translations.en[key] || key;
  };

  const isRtl = lang === 'ar';

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
