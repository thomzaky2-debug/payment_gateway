import React, { useState, useEffect } from 'react';
import type { Page } from '../App';
import { LogOut, User, Shield, AlertTriangle, Bell, CheckCircle2, Globe, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { notificationsApi } from '../services/api';

interface TopbarProps {
  currentPage: Page;
  client?: any;
  onLogout: () => void;
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

export function Topbar({ currentPage, client, onLogout }: TopbarProps) {
  const { lang, setLang, isRtl } = useLanguage();
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
      className="hidden md:flex items-center justify-between"
      style={{ padding: '14px 24px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', position: 'relative' }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
            {pageTitles[currentPage]?.[lang] || pageTitles[currentPage]?.en}
          </h1>
          {isPending && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                backgroundColor: '#fef3c7',
                color: '#b45309',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1px solid #fde68a',
              }}
            >
              <AlertTriangle size={12} /> {isRtl ? 'في انتظار اعتماد الإدارة' : 'Pending Admin Approval'}
            </span>
          )}
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
          InstaPay Merchant Gateway • {client?.businessName || 'Business Account'}
        </p>
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
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            color: '#334155',
          }}
          title="Toggle Language / تغيير اللغة"
        >
          <Globe size={14} color="#2563eb" />
          <span>{lang === 'en' ? 'عربي' : 'English'}</span>
        </button>

        {/* Notifications Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            style={{
              position: 'relative',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Notifications"
          >
            <Bell size={16} color="#475569" />
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
                  border: '2px solid white',
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
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                  {isRtl ? 'إشعارات المتجر' : 'Notifications'}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '11px',
                      color: '#2563eb',
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
                        borderBottom: '1px solid #f8fafc',
                        backgroundColor: n.readAt ? 'white' : '#f0fdf4',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: n.severity === 'URGENT' ? '#fee2e2' : '#e0f2fe',
                            color: n.severity === 'URGENT' ? '#b91c1c' : '#0369a1',
                          }}
                        >
                          {n.severity}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{n.title}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>{n.message}</p>
                      <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                        {new Date(n.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick link to Superadmin Portal */}
        <a
          href="/admin"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            backgroundColor: '#0f172a',
            color: '#38bdf8',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '8px',
            textDecoration: 'none',
            border: '1px solid #334155',
          }}
        >
          <Shield size={14} color="#a855f7" /> {isRtl ? 'بوابة الإدارة ↗' : 'Admin Portal ↗'}
        </a>

        <button
          onClick={onLogout}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', backgroundColor: '#fef2f2', color: '#991b1b', fontSize: '12px', fontWeight: 500, borderRadius: '8px', border: '1px solid #fecaca', cursor: 'pointer' }}
          aria-label="Logout"
        >
          <LogOut size={13} />
          {isRtl ? 'خروج' : 'Logout'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: isRtl ? '0' : '12px', paddingRight: isRtl ? '12px' : '0', borderLeft: isRtl ? 'none' : '1px solid #e2e8f0', borderRight: isRtl ? '1px solid #e2e8f0' : 'none' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '13px' }}>
            {client?.businessName ? client.businessName[0].toUpperCase() : <User size={16} />}
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0 }}>
              {client?.businessName || 'Merchant'}
            </p>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontFamily: 'monospace' }}>
              {client?.instapayHandle || 'Account'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

