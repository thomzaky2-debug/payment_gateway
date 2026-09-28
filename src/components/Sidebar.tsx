import React from 'react';
import type { Page } from '../App';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; emoji: string }[] = [
  { page: 'overview', label: 'Overview', emoji: '📊' },
  { page: 'transactions', label: 'Transactions', emoji: '💳' },
  { page: 'review', label: 'Manual Review', emoji: '🛡️' },
  { page: 'detector', label: 'Detector', emoji: '📱' },
  { page: 'developers', label: 'Developers', emoji: '💻' },
  { page: 'settings', label: 'Settings', emoji: '⚙️' },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white" style={{ minWidth: '256px', maxWidth: '256px' }}>
      {/* Logo */}
      <div style={{ padding: '24px', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px'
          }}>
            ⚡
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>InstaPay</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Payment Gateway</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        {navItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                marginBottom: '4px',
                transition: 'all 0.2s',
                backgroundColor: isActive ? '#2563eb' : 'transparent',
                color: isActive ? 'white' : '#cbd5e1',
                boxShadow: isActive ? '0 10px 15px -3px rgba(37,99,235,0.3)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#1e293b';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#cbd5e1';
                }
              }}
            >
              <span style={{ fontSize: '18px' }}>{item.emoji}</span>
              <span>{item.label}</span>
              {item.page === 'review' && (
                <span style={{
                  marginLeft: 'auto',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                }}>
                  3
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(51,65,85,0.5)' }}>
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ 
              width: '8px', height: '8px', borderRadius: '50%', 
              backgroundColor: '#4ade80',
              animation: 'pulseGreen 2s ease-in-out infinite'
            }} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#4ade80' }}>System Online</span>
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>All services operational</p>
        </div>
      </div>
    </aside>
  );
}
