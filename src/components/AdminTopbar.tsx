import { Download, ExternalLink, LogOut, Menu, Moon, RefreshCw, Shield, Sun } from 'lucide-react';
import type { AdminTab } from '../pages/AdminPortalPage';
import { useTheme } from '../context/ThemeContext';

interface AdminTopbarProps {
  activeTab: AdminTab;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onOpenMobileMenu?: () => void;
}

const titles: Record<AdminTab, { title: string; subtitle: string }> = {
  overview: { title: 'Platform Overview', subtitle: 'Operational health, activity, and actions requiring attention' },
  merchants: { title: 'Merchant Management', subtitle: 'Review accounts, approvals, detector health, and integration access' },
  transactions: { title: 'Platform Transactions', subtitle: 'Monitor and resolve payment activity across every merchant' },
  audit: { title: 'Administrative Audit Trail', subtitle: 'Review privileged actions and platform security events' },
  webhooks: { title: 'Webhook Delivery Logs', subtitle: 'Inspect merchant callback delivery and retry activity' },
  plans: { title: 'Plans & Pricing', subtitle: 'Manage subscriptions, trials, quotas, and merchant allocations' },
  notifications: { title: 'Broadcast Notifications', subtitle: 'Send operational messages to individual merchants or the network' },
};

export function AdminTopbar({ activeTab, loading, onRefresh, onLogout, onOpenMobileMenu }: AdminTopbarProps) {
  const { isDark, toggleTheme } = useTheme();
  const page = titles[activeTab];
  const text = isDark ? '#f8fafc' : '#1e293b';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const buttonBackground = isDark ? '#1e293b' : '#f8fafc';
  const border = isDark ? '#334155' : '#cbd5e1';

  return (
    <header
      className="admin-topbar"
      style={{
        minHeight: '58px',
        paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
        paddingBottom: '10px',
        paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderBottom: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.6)' : '#e2e8f0'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        flexWrap: 'nowrap',
        flexShrink: 0,
        position: 'relative',
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
        {/* Mobile Hamburger Menu Button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="admin-mobile-menu-btn"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #cbd5e1',
            color: isDark ? '#f8fafc' : '#1e293b',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu size={18} />
        </button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <h1 style={{ margin: 0, color: text, fontSize: 'clamp(15px, 4vw, 19px)', fontWeight: 800, letterSpacing: '-0.25px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {page.title}
            </h1>
            <span
              className="admin-superadmin-badge"
              style={{
                padding: '2px 6px',
                borderRadius: '5px',
                backgroundColor: isDark ? 'rgba(124, 58, 237, 0.18)' : '#f3e8ff',
                border: isDark ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid #e9d5ff',
                color: isDark ? '#c084fc' : '#7e22ce',
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                flexShrink: 0,
              }}
            >
              SUPERADMIN
            </span>
          </div>
          <p className="admin-topbar-subtitle" style={{ margin: '2px 0 0', color: muted, fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {page.subtitle}
          </p>
        </div>
      </div>

      <div className="admin-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'nowrap' }}>
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            border: `1px solid ${border}`,
            backgroundColor: buttonBackground,
            color: text,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? <Sun size={14} color="#fbbf24" /> : <Moon size={14} color="#6366f1" />}
          <span className="admin-btn-label">{isDark ? 'Light' : 'Dark'}</span>
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            border: `1px solid ${border}`,
            backgroundColor: buttonBackground,
            color: text,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
          title="Refresh Data"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="admin-btn-label">Refresh</span>
        </button>

        <a
          className="admin-topbar-secondary-link topbar-desktop-only"
          href="/api/apks/admin"
          download="InstaPay-Admin.apk"
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            border: isDark ? '1px solid rgba(124, 58, 237, 0.4)' : '1px solid #ddd6fe',
            backgroundColor: isDark ? 'rgba(124, 58, 237, 0.16)' : '#f5f3ff',
            color: isDark ? '#c084fc' : '#6d28d9',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <Download size={14} /> Admin APK
        </a>

        <a
          className="admin-topbar-secondary-link topbar-desktop-only"
          href="/"
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd',
            backgroundColor: isDark ? 'rgba(56, 189, 248, 0.1)' : '#f0f9ff',
            color: isDark ? '#38bdf8' : '#0369a1',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Merchant Portal <ExternalLink size={13} />
        </a>

        <button
          type="button"
          onClick={onLogout}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca',
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
            color: isDark ? '#f87171' : '#991b1b',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Logout"
          aria-label="Logout"
        >
          <LogOut size={14} />
          <span className="admin-btn-label">Logout</span>
        </button>

        <div
          className="admin-profile-chip"
          style={{
            paddingLeft: '8px',
            borderLeft: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              flexShrink: 0,
            }}
          >
            <Shield size={16} />
          </div>
          <div className="topbar-desktop-only">
            <p style={{ margin: 0, color: text, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>Platform Owner</p>
            <p style={{ margin: 0, color: muted, fontSize: '10px', whiteSpace: 'nowrap' }}>Full access</p>
          </div>
        </div>
      </div>
    </header>
  );
}
