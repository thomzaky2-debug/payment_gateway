import type { Page } from '../App';
import { useLanguage } from '../context/LanguageContext';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; key: string; label: string; emoji: string; badge?: number }[] = [
  { page: 'overview', key: 'overview', label: 'Overview', emoji: '📊' },
  { page: 'transactions', key: 'transactions', label: 'Transactions', emoji: '💳' },
  { page: 'review', key: 'review', label: 'Manual Review', emoji: '🛡️' },
  { page: 'billing', key: 'billing', label: 'Plans & Billing', emoji: '💎' },
  { page: 'detector', key: 'detector', label: 'Detector', emoji: '📱' },
  { page: 'developers', key: 'developers', label: 'Developers', emoji: '💻' },
  { page: 'audit', key: 'audit', label: 'Audit Log', emoji: '📋' },
  { page: 'security', key: 'security', label: 'Security', emoji: '🔒' },
  { page: 'settings', key: 'settings', label: 'Settings', emoji: '⚙️' },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { t, isRtl } = useLanguage();

  return (
    <aside className="hidden md:flex flex-col" style={{ minWidth: '256px', maxWidth: '256px', backgroundColor: '#0f172a', color: 'white' }}>
      <div style={{ padding: '24px', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px'
          }}>⚡</div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>InstaPay</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Payment Gateway</p>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        {navItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
                border: 'none', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.2s',
                backgroundColor: isActive ? '#2563eb' : 'transparent',
                color: isActive ? 'white' : '#cbd5e1',
                boxShadow: isActive ? '0 10px 15px -3px rgba(37,99,235,0.3)' : 'none',
              }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.color = 'white'; } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; } }}
            >
              <span style={{ fontSize: '18px' }}>{item.emoji}</span>
              <span>{t(item.key) || item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid rgba(51,65,85,0.5)' }}>
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80', animation: 'pulseGreen 2s ease-in-out infinite' }} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#4ade80' }}>System Online</span>
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>All services operational</p>
        </div>
      </div>
    </aside>
  );
}
