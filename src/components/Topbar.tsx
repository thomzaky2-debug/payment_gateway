import React from 'react';
import type { Page } from '../App';
import { LogOut, User, Shield, AlertTriangle } from 'lucide-react';

interface TopbarProps {
  currentPage: Page;
  client?: any;
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

export function Topbar({ currentPage, client, onLogout }: TopbarProps) {
  const isPending = client?.approvalStatus === 'PENDING';

  return (
    <header
      className="hidden md:flex items-center justify-between"
      style={{ padding: '14px 24px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{pageTitles[currentPage]}</h1>
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
              <AlertTriangle size={12} /> Pending Admin Approval
            </span>
          )}
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
          InstaPay Merchant Gateway • {client?.businessName || 'Business Account'}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          <Shield size={14} color="#a855f7" /> Admin Portal ↗
        </a>

        <button
          onClick={onLogout}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', backgroundColor: '#fef2f2', color: '#991b1b', fontSize: '12px', fontWeight: 500, borderRadius: '8px', border: '1px solid #fecaca', cursor: 'pointer' }}
          aria-label="Logout"
        >
          <LogOut size={13} />
          Logout
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '12px', borderLeft: '1px solid #e2e8f0' }}>
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
