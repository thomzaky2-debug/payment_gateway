import React from 'react';
import type { Page } from '../App';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; emoji: string }[] = [
  { page: 'overview', label: 'Overview', emoji: '📊' },
  { page: 'transactions', label: 'Transactions', emoji: '💳' },
  { page: 'review', label: 'Manual Review', emoji: '🛡️' },
  { page: 'detector', label: 'Detector', emoji: '📱' },
  { page: 'developers', label: 'Developers', emoji: '💻' },
  { page: 'audit', label: 'Audit Log', emoji: '📋' },
  { page: 'security', label: 'Security', emoji: '🔒' },
  { page: 'settings', label: 'Settings', emoji: '⚙️' },
];

export function MobileNav({ isOpen, onClose, currentPage, onNavigate }: MobileNavProps) {
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '288px', backgroundColor: '#0f172a', color: 'white', animation: 'slideIn 0.3s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>⚡</div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>InstaPay</h2>
          </div>
          <button onClick={onClose} style={{ padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'white' }} aria-label="Close menu">✕</button>
        </div>
        <nav style={{ padding: '16px' }}>
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: 500, border: 'none', cursor: 'pointer', marginBottom: '4px', backgroundColor: isActive ? '#2563eb' : 'transparent', color: isActive ? 'white' : '#cbd5e1' }}
              >
                <span style={{ fontSize: '18px' }}>{item.emoji}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
