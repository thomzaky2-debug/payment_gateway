import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import type { AdminTab } from '../pages/AdminPortalPage';
import { useTheme } from '../context/ThemeContext';

interface AdminSidebarProps {
  activeTab: AdminTab;
  pendingCount: number;
  onNavigate: (tab: AdminTab) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const navigation: Array<{
  tab: AdminTab;
  label: string;
  emoji: string;
}> = [
  { tab: 'overview', label: 'Overview', emoji: '📊' },
  { tab: 'merchants', label: 'Merchants', emoji: '🏪' },
  { tab: 'transactions', label: 'Transactions', emoji: '💳' },
  { tab: 'audit', label: 'Audit Trail', emoji: '📋' },
  { tab: 'webhooks', label: 'Webhook Logs', emoji: '🔗' },
  { tab: 'plans', label: 'Plans & Pricing', emoji: '💎' },
  { tab: 'notifications', label: 'Notifications', emoji: '🔔' },
];

export function AdminSidebar({
  activeTab,
  pendingCount,
  onNavigate,
  mobileOpen = false,
  onCloseMobile,
}: AdminSidebarProps) {
  const { isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('instapay_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem('instapay_admin_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const background = isDark ? '#0b101e' : '#ffffff';
  const border = isDark ? 'rgba(51, 65, 85, 0.6)' : '#e2e8f0';
  const text = isDark ? '#f8fafc' : '#1e293b';
  const muted = isDark ? '#94a3b8' : '#64748b';

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="admin-mobile-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 9998,
            animation: 'fadeIn 0.2s ease-out',
          }}
          aria-hidden="true"
        />
      )}

      <aside
        className={`admin-sidebar ${mobileOpen ? 'admin-sidebar-mobile-drawer' : 'admin-sidebar-desktop'}`}
        style={{
          position: mobileOpen ? 'fixed' : 'relative',
          top: mobileOpen ? 0 : undefined,
          bottom: mobileOpen ? 0 : undefined,
          left: mobileOpen ? 0 : undefined,
          width: mobileOpen ? 'min(240px, 80vw)' : collapsed ? '62px' : '208px',
          minWidth: mobileOpen ? 'min(240px, 80vw)' : collapsed ? '62px' : '208px',
          maxWidth: mobileOpen ? 'min(240px, 80vw)' : collapsed ? '62px' : '208px',
          height: mobileOpen ? '100dvh' : '100%',
          maxHeight: mobileOpen ? '100dvh' : '100%',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          backgroundColor: background,
          color: text,
          borderRight: `1px solid ${border}`,
          transition: 'width 0.25s ease, min-width 0.25s ease, max-width 0.25s ease, background-color 0.25s ease',
          zIndex: mobileOpen ? 9999 : 20,
          boxShadow: mobileOpen ? '0 10px 40px rgba(0, 0, 0, 0.6)' : undefined,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          className="admin-sidebar-brand"
          style={{
            height: '54px',
            padding: collapsed && !mobileOpen ? '8px' : '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed && !mobileOpen ? 'center' : 'space-between',
            gap: '8px',
            borderBottom: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9'}`,
            flexShrink: 0,
          }}
        >
          {mobileOpen ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    padding: '3px',
                    borderRadius: '8px',
                    backgroundColor: '#512772',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 3px 10px rgba(81, 39, 114, 0.4)',
                    flexShrink: 0,
                  }}
                >
                  <img src="/Logo.png" alt="InstaPay" style={{ width: '24px', height: 'auto', objectFit: 'contain' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <strong style={{ fontSize: '14px', color: text }}>InstaPay</strong>
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                        border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd',
                        color: isDark ? '#38bdf8' : '#0284c7',
                        fontSize: '8.5px',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                      }}
                    >
                      ADMIN
                    </span>
                  </div>
                  <p style={{ margin: 0, color: muted, fontSize: '10px' }}>Control Center</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close admin navigation menu"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  border: `1px solid ${border}`,
                  backgroundColor: isDark ? '#111827' : '#f8fafc',
                  color: muted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={15} />
              </button>
            </>
          ) : !collapsed ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    padding: '3px',
                    borderRadius: '8px',
                    backgroundColor: '#512772',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 3px 10px rgba(81, 39, 114, 0.4)',
                    flexShrink: 0,
                  }}
                >
                  <img src="/Logo.png" alt="InstaPay" style={{ width: '24px', height: 'auto', objectFit: 'contain' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <strong style={{ fontSize: '14px', color: text }}>InstaPay</strong>
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                        border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd',
                        color: isDark ? '#38bdf8' : '#0284c7',
                        fontSize: '8.5px',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                      }}
                    >
                      ADMIN
                    </span>
                  </div>
                  <p style={{ margin: 0, color: muted, fontSize: '10px' }}>Control Center</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Collapse admin navigation"
                title="Collapse navigation"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  border: `1px solid ${border}`,
                  backgroundColor: isDark ? '#111827' : '#f8fafc',
                  color: muted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={15} />
              </button>
            </>
          ) : (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand admin navigation"
            title="Expand navigation"
            style={{
              width: '40px',
              height: '34px',
              padding: '3px 4px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: '#512772',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 10px rgba(81, 39, 114, 0.4)',
              cursor: 'pointer',
            }}
          >
            <img src="/Logo.png" alt="InstaPay" style={{ width: '24px', height: 'auto', objectFit: 'contain' }} />
          </button>
        )}
      </div>

      <nav
        className="admin-sidebar-nav"
        aria-label="Admin navigation"
        style={{
          flex: 1,
          padding: collapsed ? '10px 5px' : '10px 8px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {navigation.map(({ tab, label, emoji }) => {
          const active = tab === activeTab;
          return (
            <button
              type="button"
              key={tab}
              onClick={() => {
                onNavigate(tab);
                onCloseMobile?.();
              }}
              title={collapsed && !mobileOpen ? label : undefined}
              aria-current={active ? 'page' : undefined}
              style={{
                width: collapsed && !mobileOpen ? '42px' : '100%',
                height: collapsed && !mobileOpen ? '40px' : 'auto',
                margin: collapsed && !mobileOpen ? '0 auto' : 0,
                padding: collapsed && !mobileOpen ? 0 : '7px 10px',
                border: 'none',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed && !mobileOpen ? 'center' : 'flex-start',
                gap: '9px',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: active ? '#2563eb' : 'transparent',
                color: active ? '#ffffff' : isDark ? '#cbd5e1' : '#475569',
                boxShadow: active ? '0 3px 10px rgba(37, 99, 235, 0.35)' : 'none',
                fontSize: '12.5px',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <span aria-hidden="true" style={{ flexShrink: 0, fontSize: '15px', lineHeight: 1 }}>{emoji}</span>
              {(!collapsed || mobileOpen) && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
              {(!collapsed || mobileOpen) && tab === 'merchants' && pendingCount > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    backgroundColor: '#f59e0b',
                    color: '#111827',
                    fontSize: '9.5px',
                    fontWeight: 800,
                  }}
                >
                  {pendingCount}
                </span>
              )}
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '6px',
                    bottom: '6px',
                    width: '3.5px',
                    borderRadius: '0 3px 3px 0',
                    backgroundColor: '#60a5fa',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      <div
        className="admin-sidebar-footer"
        style={{
          padding: collapsed && !mobileOpen ? '10px 5px' : '10px 10px',
          borderTop: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        {!collapsed || mobileOpen ? (
          <>
            <div
              style={{
                padding: '7px 9px',
                borderRadius: '8px',
                backgroundColor: isDark ? '#111827' : '#f8fafc',
                border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                    boxShadow: '0 0 6px #22c55e',
                    animation: 'pulseGreen 2s ease-in-out infinite',
                  }}
                />
                <span style={{ color: isDark ? '#4ade80' : '#16a34a', fontSize: '11px', fontWeight: 700 }}>
                  Platform online
                </span>
              </div>
              <p style={{ margin: '1px 0 0 13px', color: muted, fontSize: '9.5px' }}>Admin services operational</p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <a
                href="/api/apks/admin"
                download="InstaPay-Admin.apk"
                style={{
                  flex: 1,
                  padding: '5px 6px',
                  borderRadius: '7px',
                  border: isDark ? '1px solid rgba(124, 58, 237, 0.4)' : '1px solid #ddd6fe',
                  backgroundColor: isDark ? 'rgba(124, 58, 237, 0.16)' : '#f5f3ff',
                  color: isDark ? '#c084fc' : '#6d28d9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <Download size={11} /> Admin APK
              </a>
              <a
                href="/"
                style={{
                  flex: 1,
                  padding: '5px 6px',
                  borderRadius: '7px',
                  border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd',
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.1)' : '#f0f9ff',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Merchant <ExternalLink size={10} />
              </a>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              style={{
                padding: '6px 8px',
                borderRadius: '7px',
                border: `1px solid ${border}`,
                backgroundColor: isDark ? '#111827' : '#f8fafc',
                color: text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isDark ? <Sun size={13} color="#fbbf24" /> : <Moon size={13} color="#6366f1" />}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={isDark ? 'Light theme' : 'Dark theme'}
              style={{
                width: '32px',
                height: '32px',
                margin: '0 auto',
                borderRadius: '8px',
                border: `1px solid ${border}`,
                backgroundColor: isDark ? '#111827' : '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {isDark ? <Sun size={14} color="#fbbf24" /> : <Moon size={14} color="#6366f1" />}
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand admin navigation"
              style={{
                width: '32px',
                height: '32px',
                margin: '0 auto',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                color: text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>
    </aside>
  </>
  );
}
