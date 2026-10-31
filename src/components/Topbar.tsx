import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Page } from '../App';
import {
  LogOut,
  User,
  Shield,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Globe,
  Check,
  Sun,
  Moon,
  Menu,
  X,
  RefreshCw,
  CheckCheck,
  Clock,
  AlertCircle,
  Info,
  ChevronRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { notificationsApi } from '../services/api';

interface TopbarProps {
  currentPage: Page;
  client?: any;
  onLogout: () => void;
  onNavigate?: (page: Page, subPath?: string) => void;
  onOpenMobileMenu?: () => void;
}

const pageTitles: Record<Page, { en: string; ar: string }> = {
  about: { en: 'About NilePay', ar: 'عن نايل باي' },
  support: { en: 'Support', ar: 'الدعم' },
  overview: { en: 'Dashboard Overview', ar: 'لوحة التحكم الرئيسية' },
  transactions: { en: 'Transactions', ar: 'سجل المعاملات' },
  review: { en: 'Manual Review', ar: 'المراجعة اليدوية' },
  billing: { en: 'Plans & Billing', ar: 'الاشتراكات والباقات' },
  detector: { en: 'Detector Health', ar: 'حالة جهاز الكاشف' },
  developers: { en: 'Developer Portal', ar: 'بوابة المطورين وAPI' },
  settings: { en: 'Settings', ar: 'إعدادات المتجر' },
  audit: { en: 'Audit Log', ar: 'سجل العمليات' },
  security: { en: 'Security', ar: 'إعدادات الأمان' },
  privacy: { en: 'Privacy Policy', ar: 'سياسة الخصوصية' },
  docs: { en: 'API Documentation', ar: 'دليل التكامل البرمجي' },
};

export function Topbar({ currentPage, client, onLogout, onNavigate, onOpenMobileMenu }: TopbarProps) {
  const { lang, setLang, isRtl } = useLanguage();
  const { theme, toggleTheme, isDark } = useTheme();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPending = client?.approvalStatus === 'PENDING';

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifs(true);
      const res = await notificationsApi.list();
      if (res?.ok) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Handle click outside and Escape key to close notifications dropdown
  useEffect(() => {
    if (!showNotifMenu) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifMenu]);

  const handleNotificationsToggle = () => {
    const next = !showNotifMenu;
    setShowNotifMenu(next);
    if (next) {
      void fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
    );
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      void fetchNotifications();
    }
  };

  const handleMarkSingleRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.markRead(id);
    } catch {
      void fetchNotifications();
    }
  };

  const resolveTargetPage = (item: any): { page: Page; subPath?: string; label: string } | null => {
    const text = `${item.title || ''} ${item.message || ''}`.toLowerCase();
    if (
      text.includes('review') ||
      text.includes('mismatch') ||
      text.includes('orphan') ||
      text.includes('unmatched') ||
      text.includes('discrepancy')
    ) {
      return { page: 'review', label: isRtl ? 'فتح المراجعة' : 'Review Queue' };
    }
    if (
      text.includes('transaction') ||
      text.includes('checkout') ||
      text.includes('payment') ||
      text.includes('paid') ||
      text.includes('refund') ||
      text.includes('deposit')
    ) {
      return { page: 'transactions', label: isRtl ? 'المعاملات' : 'Transactions' };
    }
    if (
      text.includes('detector') ||
      text.includes('device') ||
      text.includes('heartbeat') ||
      text.includes('listener') ||
      text.includes('phone')
    ) {
      return { page: 'detector', label: isRtl ? 'الكاشف' : 'Detector' };
    }
    if (
      text.includes('api') ||
      text.includes('webhook') ||
      text.includes('secret') ||
      text.includes('key') ||
      text.includes('hmac')
    ) {
      return { page: 'developers', label: isRtl ? 'بوابة المطورين' : 'Developers' };
    }
    if (
      text.includes('plan') ||
      text.includes('bundle') ||
      text.includes('subscription') ||
      text.includes('billing') ||
      text.includes('quota')
    ) {
      return { page: 'billing', label: isRtl ? 'الباقات' : 'Billing' };
    }
    if (text.includes('audit') || text.includes('security') || text.includes('log')) {
      return { page: 'audit', label: isRtl ? 'سجل العمليات' : 'Audit Log' };
    }
    return null;
  };

  const handleNotificationClick = async (n: any) => {
    if (!n.readAt) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await notificationsApi.markRead(n.id);
      } catch {}
    }
    const target = resolveTargetPage(n);
    if (target && onNavigate) {
      setShowNotifMenu(false);
      onNavigate(target.page, target.subPath);
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
      if (diffSeconds < 45) return isRtl ? 'الآن' : 'Just now';
      if (diffSeconds < 3600) {
        const mins = Math.floor(diffSeconds / 60);
        return isRtl ? `منذ ${mins} د` : `${mins}m ago`;
      }
      if (diffSeconds < 86400) {
        const hours = Math.floor(diffSeconds / 3600);
        return isRtl ? `منذ ${hours} س` : `${hours}h ago`;
      }
      const days = Math.floor(diffSeconds / 86400);
      return isRtl ? `منذ ${days} ي` : `${days}d ago`;
    } catch {
      return isoString;
    }
  };

  const getSeverityMeta = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'URGENT':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#fee2e2',
          border: isDark ? 'rgba(239, 68, 68, 0.35)' : '#fca5a5',
          text: isDark ? '#f87171' : '#dc2626',
          accent: '#ef4444',
          icon: <AlertCircle size={12} />,
          label: isRtl ? 'عاجل' : 'Urgent',
        };
      case 'WARNING':
        return {
          bg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#fef3c7',
          border: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
          text: isDark ? '#fbbf24' : '#b45309',
          accent: '#f59e0b',
          icon: <AlertTriangle size={12} />,
          label: isRtl ? 'تنبيه' : 'Warning',
        };
      case 'SUCCESS':
        return {
          bg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ecfdf5',
          border: isDark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0',
          text: isDark ? '#34d399' : '#059669',
          accent: '#10b981',
          icon: <CheckCircle2 size={12} />,
          label: isRtl ? 'ناجح' : 'Success',
        };
      default:
        return {
          bg: isDark ? 'rgba(56, 189, 248, 0.16)' : '#e0f2fe',
          border: isDark ? 'rgba(56, 189, 248, 0.35)' : '#bae6fd',
          text: isDark ? '#38bdf8' : '#0284c7',
          accent: '#0284c7',
          icon: <Info size={12} />,
          label: isRtl ? 'إشعار' : 'Info',
        };
    }
  };

  const unreadItems = notifications.filter((n) => !n.readAt);
  const urgentItems = notifications.filter((n) => n.severity === 'URGENT' || n.severity === 'WARNING');

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'unread') return !n.readAt;
    if (notifFilter === 'urgent') return n.severity === 'URGENT' || n.severity === 'WARNING';
    return true;
  });

  return (
    <header
      className="merchant-topbar flex items-center justify-between"
      style={{
        paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
        paddingBottom: '8px',
        paddingLeft: 'max(10px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(10px, env(safe-area-inset-right, 0px))',
        backgroundColor: isDark ? '#0f172a' : 'white',
        borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
        position: 'relative',
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
        minHeight: '48px',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
        {/* Mobile Hamburger Menu Button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="merchant-mobile-menu-btn"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #cbd5e1',
            color: isDark ? '#f8fafc' : '#1e293b',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="Open Menu / القائمة"
          aria-label="Open Navigation Menu"
        >
          <Menu size={14} />
        </button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <h1 style={{ fontSize: 'clamp(13px, 2.8vw, 15px)', fontWeight: 'bold', color: isDark ? '#f8fafc' : '#1e293b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pageTitles[currentPage]?.[lang] || pageTitles[currentPage]?.en}
            </h1>
            {isPending && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '1px 5px',
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                  color: isDark ? '#fbbf24' : '#b45309',
                  fontSize: '8.5px',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={9} /> {isRtl ? 'قيد المراجعة' : 'Pending'}
              </span>
            )}
          </div>
          <p style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', margin: '1px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {client?.businessName || 'Merchant Portal'}
          </p>
        </div>
      </div>

      <div className="merchant-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Language Switcher */}
        <button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            padding: '6px 10px',
            minHeight: '34px',
            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
            border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            color: isDark ? '#f8fafc' : '#334155',
            transition: 'all 0.2s',
          }}
          title="Toggle Language / تغيير اللغة"
        >
          <Globe size={14} color="#38bdf8" />
          <span className="topbar-btn-label">{lang === 'en' ? 'عربي' : 'English'}</span>
          <span className="topbar-btn-short-label">{lang === 'en' ? 'AR' : 'EN'}</span>
        </button>

        {/* Dark / Light Theme Switcher */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            padding: '6px 10px',
            minHeight: '34px',
            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
            border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            color: isDark ? '#f8fafc' : '#334155',
            transition: 'all 0.2s',
          }}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? <Sun size={14} style={{ color: '#fbbf24' }} /> : <Moon size={14} style={{ color: '#6366f1' }} />}
          <span className="topbar-btn-label">{isDark ? (isRtl ? 'النهاري' : 'Light') : (isRtl ? 'الليلي' : 'Dark')}</span>
        </button>

        {/* Notifications Dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={handleNotificationsToggle}
            style={{
              position: 'relative',
              padding: '8px',
              borderRadius: '8px',
              border: unreadCount > 0
                ? (isDark ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid #93c5fd')
                : (isDark ? '1px solid #334155' : '1px solid #e2e8f0'),
              cursor: 'pointer',
              backgroundColor: unreadCount > 0
                ? (isDark ? 'rgba(56, 189, 248, 0.12)' : '#eff6ff')
                : (isDark ? '#1e293b' : '#f8fafc'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: unreadCount > 0 ? '#38bdf8' : (isDark ? '#cbd5e1' : '#475569'),
              transition: 'all 0.2s',
              boxShadow: unreadCount > 0 ? '0 0 10px rgba(56, 189, 248, 0.25)' : 'none',
            }}
            aria-label="Notifications"
            title={isRtl ? `الإشعارات (${unreadCount} غير مقروء)` : `Notifications (${unreadCount} unread)`}
          >
            <Bell size={16} className={unreadCount > 0 ? 'animate-bell-ring' : ''} color={unreadCount > 0 ? '#38bdf8' : (isDark ? '#cbd5e1' : '#475569')} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '9999px',
                  fontSize: '9.5px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  minWidth: '16px',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  border: isDark ? '2px solid #0f172a' : '2px solid white',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <>
              {/* Tap-to-dismiss backdrop for mobile screens */}
              <div
                className="merchant-notif-backdrop"
                onClick={() => setShowNotifMenu(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.55)',
                  backdropFilter: 'blur(3px)',
                  zIndex: 9998,
                }}
                aria-hidden="true"
              />

              <div
                className="merchant-notif-dropdown"
                style={{
                  position: 'absolute',
                  top: '44px',
                  right: isRtl ? 'auto' : 0,
                  left: isRtl ? 0 : 'auto',
                  width: 'min(410px, calc(100vw - 20px))',
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                  borderRadius: '16px',
                  boxShadow: '0 22px 35px -5px rgba(0, 0, 0, 0.4), 0 10px 15px -5px rgba(0, 0, 0, 0.2)',
                  zIndex: 9999,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #f1f5f9',
                    backgroundColor: isDark ? '#162033' : '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '7px',
                        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                        color: '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Bell size={14} />
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>
                        {isRtl ? 'مركز الإشعارات' : 'Notifications'}
                      </span>
                      {unreadCount > 0 && (
                        <span
                          style={{
                            marginLeft: isRtl ? 0 : '6px',
                            marginRight: isRtl ? '6px' : 0,
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '9999px',
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                            color: '#ef4444',
                            border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca',
                          }}
                        >
                          {unreadCount} {isRtl ? 'جديد' : 'new'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Refresh */}
                    <button
                      type="button"
                      onClick={() => void fetchNotifications()}
                      disabled={loadingNotifs}
                      style={{
                        background: 'none',
                        border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                        padding: '4px 7px',
                        cursor: 'pointer',
                        color: isDark ? '#94a3b8' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        fontSize: '11px',
                        transition: 'all 0.15s',
                      }}
                      title={isRtl ? 'تحديث الإشعارات' : 'Refresh notifications'}
                    >
                      <RefreshCw size={12} style={loadingNotifs ? { animation: 'spin 1s linear infinite' } : {}} />
                    </button>

                    {/* Mark All Read */}
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        style={{
                          background: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
                          border: isDark ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid #bfdbfe',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          color: '#38bdf8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          transition: 'all 0.15s',
                        }}
                        title={isRtl ? 'تحديد الكل كمقروء' : 'Mark all as read'}
                      >
                        <CheckCheck size={12} />
                        <span>{isRtl ? 'تحديد الكل' : 'Mark all read'}</span>
                      </button>
                    )}

                    {/* Close */}
                    <button
                      type="button"
                      onClick={() => setShowNotifMenu(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        color: isDark ? '#94a3b8' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                      }}
                      title={isRtl ? 'إغلاق' : 'Close'}
                      aria-label="Close"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Filter Tabs Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 12px',
                    borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #f1f5f9',
                    backgroundColor: isDark ? '#0b1120' : '#f8fafc',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setNotifFilter('all')}
                    style={{
                      border: 'none',
                      backgroundColor: notifFilter === 'all' ? '#2563eb' : 'transparent',
                      color: notifFilter === 'all' ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: notifFilter === 'all' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span>{isRtl ? 'الكل' : 'All'}</span>
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '0 4px',
                        borderRadius: '4px',
                        backgroundColor: notifFilter === 'all' ? 'rgba(255,255,255,0.25)' : (isDark ? '#1e293b' : '#e2e8f0'),
                      }}
                    >
                      {notifications.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNotifFilter('unread')}
                    style={{
                      border: 'none',
                      backgroundColor: notifFilter === 'unread' ? '#2563eb' : 'transparent',
                      color: notifFilter === 'unread' ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: notifFilter === 'unread' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span>{isRtl ? 'غير مقروء' : 'Unread'}</span>
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '0 4px',
                        borderRadius: '4px',
                        backgroundColor: notifFilter === 'unread' ? 'rgba(255,255,255,0.25)' : (isDark ? '#1e293b' : '#e2e8f0'),
                      }}
                    >
                      {unreadItems.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNotifFilter('urgent')}
                    style={{
                      border: 'none',
                      backgroundColor: notifFilter === 'urgent' ? '#2563eb' : 'transparent',
                      color: notifFilter === 'urgent' ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: notifFilter === 'urgent' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span>{isRtl ? 'تنبيهات هامة' : 'Alerts'}</span>
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '0 4px',
                        borderRadius: '4px',
                        backgroundColor: notifFilter === 'urgent' ? 'rgba(255,255,255,0.25)' : (isDark ? '#1e293b' : '#e2e8f0'),
                      }}
                    >
                      {urgentItems.length}
                    </span>
                  </button>
                </div>

                {/* Notifications List Body */}
                <div
                  className="notif-items-list"
                  style={{
                    maxHeight: '360px',
                    overflowY: 'auto',
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  }}
                >
                  {filteredNotifications.length === 0 ? (
                    <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                      {notifications.length === 0 ? (
                        <>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto 10px auto',
                              color: isDark ? '#64748b' : '#94a3b8',
                            }}
                          >
                            <Bell size={22} />
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isDark ? '#f8fafc' : '#1e293b' }}>
                            {isRtl ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: isDark ? '#64748b' : '#94a3b8' }}>
                            {isRtl ? 'سنخبرك فور وصول أي معاملة أو تنبيه جديد' : "You're all caught up! New events will appear here"}
                          </p>
                        </>
                      ) : notifFilter === 'unread' ? (
                        <>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto 10px auto',
                              color: '#10b981',
                            }}
                          >
                            <CheckCheck size={22} />
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isDark ? '#f8fafc' : '#1e293b' }}>
                            {isRtl ? 'لقد قرأت جميع الإشعارات!' : 'All caught up!'}
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: isDark ? '#64748b' : '#94a3b8' }}>
                            {isRtl ? 'لا توجد أي إشعارات غير مقروءة في صندوق الوارد.' : 'No unread notifications right now.'}
                          </p>
                        </>
                      ) : (
                        <>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto 10px auto',
                              color: '#0284c7',
                            }}
                          >
                            <Sparkles size={22} />
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isDark ? '#f8fafc' : '#1e293b' }}>
                            {isRtl ? 'لا توجد تنبيهات عاجلة' : 'No urgent alerts'}
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: isDark ? '#64748b' : '#94a3b8' }}>
                            {isRtl ? 'جميع المعاملات والأنظمة تعمل بصورة طبيعية.' : 'All systems and transactions are running smoothly.'}
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    filteredNotifications.map((n) => {
                      const meta = getSeverityMeta(n.severity);
                      const target = resolveTargetPage(n);
                      const isUnread = !n.readAt;

                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          style={{
                            padding: '12px 14px',
                            borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.45)' : '1px solid #f1f5f9',
                            backgroundColor: isUnread
                              ? (isDark ? 'rgba(37, 99, 235, 0.12)' : '#f0f9ff')
                              : (isDark ? '#0f172a' : '#ffffff'),
                            borderLeft: isRtl ? 'none' : `3.5px solid ${meta.accent}`,
                            borderRight: isRtl ? `3.5px solid ${meta.accent}` : 'none',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isUnread
                              ? (isDark ? 'rgba(37, 99, 235, 0.12)' : '#f0f9ff')
                              : (isDark ? '#0f172a' : '#ffffff');
                          }}
                        >
                          {/* Top Row: Severity Badge + Unread Pulse + Timestamp + 1-Click Read Button */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                              marginBottom: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1.5px 6px',
                                  borderRadius: '5px',
                                  backgroundColor: meta.bg,
                                  border: `1px solid ${meta.border}`,
                                  color: meta.text,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                {meta.icon}
                                <span>{meta.label}</span>
                              </span>

                              {isUnread && (
                                <span
                                  style={{
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    backgroundColor: '#38bdf8',
                                    display: 'inline-block',
                                    boxShadow: '0 0 6px rgba(56, 189, 248, 0.7)',
                                  }}
                                  title={isRtl ? 'إشعار غير مقروء' : 'Unread'}
                                />
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  color: isDark ? '#94a3b8' : '#64748b',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <Clock size={11} />
                                {formatRelativeTime(n.createdAt)}
                              </span>

                              {isUnread ? (
                                <button
                                  type="button"
                                  onClick={(e) => handleMarkSingleRead(e, n.id)}
                                  style={{
                                    background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                                    border: 'none',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: isDark ? '#cbd5e1' : '#475569',
                                    transition: 'all 0.15s',
                                  }}
                                  title={isRtl ? 'تحديد كمقروء' : 'Mark read'}
                                >
                                  <Check size={11} />
                                </button>
                              ) : (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    color: '#10b981',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                  }}
                                >
                                  <Check size={10} />
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <div
                            style={{
                              fontSize: '12.5px',
                              fontWeight: isUnread ? 700 : 600,
                              color: isDark ? '#f8fafc' : '#0f172a',
                              marginBottom: '3px',
                              lineHeight: 1.35,
                            }}
                          >
                            {n.title}
                          </div>

                          {/* Message Body */}
                          <p
                            style={{
                              fontSize: '11.5px',
                              color: isDark ? '#94a3b8' : '#475569',
                              margin: '0 0 6px 0',
                              lineHeight: 1.45,
                              wordBreak: 'break-word',
                            }}
                          >
                            {n.message}
                          </p>

                          {/* Bottom Action Pill if deep link available */}
                          {target && (
                            <div style={{ display: 'flex', justifyContent: isRtl ? 'flex-start' : 'flex-end', marginTop: '4px' }}>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 600,
                                  color: '#38bdf8',
                                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.1)' : '#eff6ff',
                                  padding: '2px 8px',
                                  borderRadius: '5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <span>{target.label}</span>
                                <ChevronRight size={11} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Bar */}
                {onNavigate && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isDark ? '#162033' : '#f8fafc',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8' }}>
                      {filteredNotifications.length} {isRtl ? 'إشعار معروض' : 'shown'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifMenu(false);
                        onNavigate('settings', 'Notifications');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '11.5px',
                        color: '#38bdf8',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 0,
                      }}
                    >
                      <span>{isRtl ? 'إدارة الإشعارات والإعدادات' : 'Inbox & Notification Settings'}</span>
                      <ChevronRight size={12} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '7px 10px',
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
            color: isDark ? '#f87171' : '#991b1b',
            fontSize: '12px',
            fontWeight: 500,
            borderRadius: '8px',
            border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          aria-label="Logout"
          title={isRtl ? 'تسجيل الخروج' : 'Logout'}
        >
          <LogOut size={13} />
          <span className="topbar-btn-label">{isRtl ? 'خروج' : 'Logout'}</span>
        </button>

        <div
          onClick={() => onNavigate?.('settings')}
          className="topbar-profile-chip"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingLeft: isRtl ? '0' : '10px',
            paddingRight: isRtl ? '10px' : '0',
            borderLeft: isRtl ? 'none' : isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            borderRight: isRtl ? (isDark ? '1px solid #334155' : '1px solid #e2e8f0') : 'none',
            cursor: onNavigate ? 'pointer' : 'default',
          }}
          title={isRtl ? 'إعدادات الحساب' : 'Store Settings'}
        >
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>
            {client?.profileImageData ? (
              <img src={client.profileImageData} alt="Merchant profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : client?.businessName ? client.businessName[0].toUpperCase() : <User size={13} />}
          </div>
          <div className="topbar-desktop-only" style={{ minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: isDark ? '#f8fafc' : '#1e293b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {client?.businessName || 'Merchant'}
            </p>
            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', margin: 0, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {client?.instapayHandle || 'Account'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
