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
    admin_portal: 'Admin Portal',
    
    // Overview
    todays_confirmed: "Today's Confirmed",
    seven_day_rev: '7-Day Revenue',
    pending_checkouts: 'Pending Checkouts',
    plan_quota: 'Monthly Plan Quota',
    recent_activity: 'Recent Activity',
    onboarding_checklist: 'Merchant Onboarding Checklist',
    
    // Common Actions
    export_csv: 'Export CSV',
    refresh: 'Refresh',
    search: 'Search...',
    accept_confirm: 'Accept & Confirm',
    dismiss: 'Dismiss',
    save_changes: 'Save Changes',
    upgrade_plan: 'Upgrade Plan',
    download_apk: 'Download Companion APK',
    download_admin_apk: 'Download Admin APK',
    
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
    admin_portal: 'بوابة الإدارة',
    
    // Overview
    todays_confirmed: 'المدفوعات المؤكدة اليوم',
    seven_day_rev: 'إيرادات 7 أيام',
    pending_checkouts: 'في انتظار التحويل',
    plan_quota: 'الباقة والحد الشهري',
    recent_activity: 'النشاط الأخير',
    onboarding_checklist: 'قائمة إعداد وتفعيل المتجر',
    
    // Common Actions
    export_csv: 'تصدير CSV',
    refresh: 'تحديث',
    search: 'بحث...',
    accept_confirm: 'قبول وتأكيد الدفع',
    dismiss: 'تجاهل',
    save_changes: 'حفظ التعديلات',
    upgrade_plan: 'ترقية الباقة',
    download_apk: 'تحميل تطبيق الكاشف APK',
    download_admin_apk: 'تحميل تطبيق الإدارة APK',
    
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
