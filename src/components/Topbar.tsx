import React from 'react';
import type { Page } from '../App';
import { LogOut, User } from 'lucide-react';

interface TopbarProps {
  currentPage: Page;
  onLogout: () => void;
}

const pageTitles: Record<Page, string> = {
  overview: 'Dashboard Overview',
  transactions: 'Transactions',
  review: 'Manual Review',
  detector: 'Detector Health',
  developers: 'Developer Portal',
  settings: 'Settings',
  audit: 'Audit Log',
  security: 'Security',
};

export function Topbar({ currentPage, onLogout }: TopbarProps) {
  return (
    <header
      className="hidden md:flex items-center justify-between"
      style={{ padding: '16px 24px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' }}
    >
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{pageTitles[currentPage]}</h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Payment Gateway Dashboard</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
          <input
            type="text"
            placeholder="Search..."
            style={{ paddingLeft: '40px', paddingRight: '16px', width: '256px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '14px', outline: 'none', padding: '8px 16px' }}
          />
        </div>

        <button style={{ position: 'relative', padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }} aria-label="Notifications">
          <span style={{ fontSize: '20px' }}>🔔</span>
          <span style={{ position: 'absolute', top: '4px', right: '4px', width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '50%', border: '2px solid white' }} />
        </button>

        <button
          onClick={onLogout}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: '#fef2f2', color: '#991b1b', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: '1px solid #fecaca', cursor: 'pointer' }}
          aria-label="Logout"
        >
          <LogOut size={14} />
          Logout
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '16px', borderLeft: '1px solid #e2e8f0' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <User size={18} />
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 500, color: '#334155', margin: 0 }}>Account</p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Manage Profile</p>
          </div>
        </div>
      </div>
    </header>
  );
}
