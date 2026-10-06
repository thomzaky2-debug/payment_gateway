import React, { useState, useEffect } from 'react';
import type { Page } from '../App';
import { LogOut, User, Shield, AlertTriangle, Bell, CheckCircle2, Globe, Check, Sun, Moon, Menu } from 'lucide-react';
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
  overview: { en: 'Dashboard Overview', ar: 'لوحة التحكم الرئيسية' },
  transactions: { en: 'Transactions', ar: 'سجل المعاملات' },
  review: { en: 'Manual Review', ar: 'المراجعة اليدوية' },
  billing: { en: 'Plans & Billing', ar: 'الاشتراكات والباقات' },
  detector: { en: 'Detector Health', ar: 'حالة جهاز الكاشف' },
  developers: { en: 'Developer Portal', ar: 'بوابة المطورين وAPI' },
  settings: { en: 'Settings', ar: 'إعدادات المتجر' },
  audit: { en: 'Audit Log', ar: 'سجل العمليات' },
  security: { en: 'Security', ar: 'إعدادات الأمان' },
};

export function Topbar({ currentPage, client, onLogout, onNavigate, onOpenMobileMenu }: TopbarProps) {
  const { lang, setLang, isRtl } = useLanguage();
  const { theme, toggleTheme, isDark } = useTheme();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const isPending = client?.approvalStatus === 'PENDING';

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.list();
      if (res?.ok) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setUnreadCount(0);
      fetchNotifications();
    } catch {}
  };

  return (
    <header
      className="flex items-center justify-between"
      style={{
        padding: '12px 16px',
        backgroundColor: isDark ? '#0f172a' : 'white',
        borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
        position: 'relative',
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
        minHeight: '64px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        {/* Mobile Hamburger Menu Button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="merchant-mobile-menu-btn"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '9px',
            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #cbd5e1',
            color: isDark ? '#f8fafc' : '#1e293b',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="Open Menu / القائمة"
          aria-label="Open Navigation Menu"
        >
          <Menu size={20} />
        </button>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: isDark ? '#f8fafc' : '#1e293b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pageTitles[currentPage]?.[lang] || pageTitles[currentPage]?.en}
            </h1>
            {isPending && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                  color: isDark ? '#fbbf24' : '#b45309',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '5px',
                  border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a',
                  whiteSpace: 'nowrap',
                }}
              >
                <AlertTriangle size={11} /> {isRtl ? 'في انتظار الاعتماد' : 'Pending Approval'}
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {client?.businessName || 'Merchant Portal'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Language Switcher */}
        <button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
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
          <span>{lang === 'en' ? 'عربي' : 'English'}</span>
        </button>

        {/* Dark / Light Theme Switcher */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
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
          <span>{isDark ? (isRtl ? 'النهاري' : 'Light') : (isRtl ? 'الليلي' : 'Dark')}</span>
        </button>

        {/* Notifications Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            style={{
              position: 'relative',
              padding: '8px',
              borderRadius: '8px',
              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              cursor: 'pointer',
              backgroundColor: isDark ? '#1e293b' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#cbd5e1' : '#475569',
              transition: 'all 0.2s',
            }}
            aria-label="Notifications"
          >
            <Bell size={16} color={isDark ? '#cbd5e1' : '#475569'} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '9999px',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 5px',
                  border: isDark ? '2px solid #0f172a' : '2px solid white',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div
              style={{
                position: 'absolute',
                top: '42px',
                right: isRtl ? 'auto' : 0,
                left: isRtl ? 0 : 'auto',
                width: '320px',
                backgroundColor: isDark ? '#1e293b' : 'white',
                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                borderRadius: '16px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                zIndex: 1000,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: isDark ? '1px solid #334155' : '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: isDark ? '#f8fafc' : '#1e293b' }}>
                  {isRtl ? 'إشعارات المتجر' : 'Notifications'}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '11px',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {isRtl ? 'تحديد الكل كمقروء' : 'Mark all read'}
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    {isRtl ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f8fafc',
                        backgroundColor: n.readAt
                          ? (isDark ? '#1e293b' : 'white')
                          : (isDark ? 'rgba(56, 189, 248, 0.1)' : '#f0fdf4'),
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: n.severity === 'URGENT'
                              ? (isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2')
                              : (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe'),
                            color: n.severity === 'URGENT' ? '#f87171' : '#38bdf8',
                          }}
                        >
                          {n.severity}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: isDark ? '#f8fafc' : '#1e293b' }}>
                          {n.title}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', margin: 0, lineHeight: 1.4 }}>
                        {n.message}
                      </p>
                      <span style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8', marginTop: '4px', display: 'block' }}>
                        {new Date(n.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {onNavigate && (
                <div
                  style={{
                    padding: '10px 16px',
                    borderTop: isDark ? '1px solid #334155' : '1px solid #f1f5f9',
                    textAlign: 'center',
                    backgroundColor: isDark ? '#162033' : '#f8fafc',
                  }}
                >
                  <button
                    onClick={() => {
                      setShowNotifMenu(false);
                      onNavigate('settings', 'Notifications');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '12px',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {isRtl ? 'عرض كافة الإشعارات والإعدادات' : 'View all notifications & settings'} →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
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
        >
          <LogOut size={13} />
          {isRtl ? 'خروج' : 'Logout'}
        </button>

        <div
          onClick={() => onNavigate?.('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            paddingLeft: isRtl ? '0' : '12px',
            paddingRight: isRtl ? '12px' : '0',
            borderLeft: isRtl ? 'none' : isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            borderRight: isRtl ? (isDark ? '1px solid #334155' : '1px solid #e2e8f0') : 'none',
            cursor: onNavigate ? 'pointer' : 'default',
          }}
          title={isRtl ? 'إعدادات الحساب' : 'Store Settings'}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '13px' }}>
            {client?.businessName ? client.businessName[0].toUpperCase() : <User size={16} />}
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: isDark ? '#f8fafc' : '#1e293b', margin: 0 }}>
              {client?.businessName || 'Merchant'}
            </p>
            <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', margin: 0, fontFamily: 'monospace' }}>
              {client?.instapayHandle || 'Account'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

