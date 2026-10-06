import { Download, ExternalLink, LogOut, Moon, RefreshCw, Shield, Sun } from 'lucide-react';
import type { AdminTab } from '../pages/AdminPortalPage';
import { useTheme } from '../context/ThemeContext';

interface AdminTopbarProps {
  activeTab: AdminTab;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
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

export function AdminTopbar({ activeTab, loading, onRefresh, onLogout }: AdminTopbarProps) {
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
        minHeight: '68px',
        padding: '12px 24px',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderBottom: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.6)' : '#e2e8f0'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        flexShrink: 0,
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
        zIndex: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <h1 style={{ margin: 0, color: text, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.25px' }}>
            {page.title}
          </h1>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: isDark ? 'rgba(124, 58, 237, 0.18)' : '#f3e8ff',
              border: isDark ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid #e9d5ff',
              color: isDark ? '#c084fc' : '#7e22ce',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}
          >
            SUPERADMIN
          </span>
        </div>
        <p style={{ margin: '2px 0 0', color: muted, fontSize: '12px' }}>{page.subtitle}</p>
      </div>

      <div className="admin-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: `1px solid ${border}`,
            backgroundColor: buttonBackground,
            color: text,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? <Sun size={14} color="#fbbf24" /> : <Moon size={14} color="#6366f1" />}
          {isDark ? 'Light' : 'Dark'}
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: `1px solid ${border}`,
            backgroundColor: buttonBackground,
            color: text,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>

        <a
          className="admin-topbar-secondary-link"
          href="/api/apks/admin"
          download="InstaPay-Admin.apk"
          style={{
            padding: '8px 12px',
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
          className="admin-topbar-secondary-link"
          href="/"
          style={{
            padding: '8px 12px',
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
            padding: '8px 12px',
            borderRadius: '8px',
            border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca',
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
            color: isDark ? '#f87171' : '#991b1b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <LogOut size={14} /> Logout
        </button>

        <div
          className="admin-profile-chip"
          style={{
            paddingLeft: '12px',
            borderLeft: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            }}
          >
            <Shield size={17} />
          </div>
          <div>
            <p style={{ margin: 0, color: text, fontSize: '12px', fontWeight: 700 }}>Platform Owner</p>
            <p style={{ margin: 0, color: muted, fontSize: '10px' }}>Full administrative access</p>
          </div>
        </div>
      </div>
    </header>
  );
}
