import React, { useState } from 'react';
import type { Page } from '../App';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Globe,
  X,
} from 'lucide-react';

export interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const navItems: { page: Page; key: string; label: string; emoji: string }[] = [
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

export function Sidebar({
  currentPage,
  onNavigate,
  isCollapsed: controlledCollapsed,
  onToggleCollapse: controlledToggle,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const { lang, setLang, t, isRtl } = useLanguage();
  const { toggleTheme, isDark } = useTheme();

  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    try {
      return localStorage.getItem('instapay_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    if (controlledToggle) {
      controlledToggle();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('instapay_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="merchant-mobile-backdrop"
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
        className={`merchant-sidebar ${mobileOpen ? 'merchant-sidebar-mobile-drawer' : 'merchant-sidebar-desktop'} flex flex-col`}
        style={{
          position: mobileOpen ? 'fixed' : 'relative',
          top: mobileOpen ? 0 : undefined,
          bottom: mobileOpen ? 0 : undefined,
          [isRtl ? 'right' : 'left']: mobileOpen ? 0 : undefined,
          width: mobileOpen ? 'min(200px, 70vw)' : isCollapsed ? '56px' : '198px',
          minWidth: mobileOpen ? 'min(200px, 70vw)' : isCollapsed ? '56px' : '198px',
          maxWidth: mobileOpen ? 'min(200px, 70vw)' : isCollapsed ? '56px' : '198px',
          height: mobileOpen ? '100dvh' : '100%',
          maxHeight: mobileOpen ? '100dvh' : '100%',
          backgroundColor: isDark ? '#0b101e' : '#ffffff',
          color: isDark ? '#f8fafc' : '#1e293b',
          borderInlineEnd: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s ease, background-color 0.25s ease',
          flexShrink: 0,
          zIndex: mobileOpen ? 9999 : 20,
          boxShadow: mobileOpen ? '0 10px 40px rgba(0,0,0,0.6)' : undefined,
          overflowY: 'auto',
          paddingBottom: mobileOpen ? 'max(14px, env(safe-area-inset-bottom, 0px))' : undefined,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Sidebar Header with Brand & Collapse Toggle */}
        <div
          style={{
            height: mobileOpen ? 'calc(48px + env(safe-area-inset-top, 0px))' : '48px',
            paddingTop: mobileOpen ? 'max(10px, env(safe-area-inset-top, 0px))' : (isCollapsed && !mobileOpen ? '6px' : '8px'),
            paddingBottom: '8px',
            paddingLeft: isCollapsed && !mobileOpen ? '6px' : '10px',
            paddingRight: isCollapsed && !mobileOpen ? '6px' : '10px',
            borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed && !mobileOpen ? 'center' : 'space-between',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          {(!isCollapsed || mobileOpen) ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, flex: 1, overflow: 'visible' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '7px',
                    backgroundColor: '#512772',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(81, 39, 114, 0.4)',
                    padding: '2px',
                  }}
                >
                  <img
                    src="/Logo.png"
                    alt="InstaPay"
                    style={{
                      width: '20px',
                      height: 'auto',
                      maxWidth: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </div>
                <div style={{ whiteSpace: 'nowrap', overflow: 'visible' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <h2 style={{ fontSize: '13px', fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                      InstaPay
                    </h2>
                    <span
                      style={{
                        fontSize: '7.5px',
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: '3px',
                        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                        color: isDark ? '#38bdf8' : '#0284c7',
                        border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd',
                        letterSpacing: '0.04em',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    >
                      GATEWAY
                    </span>
                  </div>
                  <p style={{ fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b', margin: 0 }}>
                    Merchant Portal
                  </p>
                </div>
              </div>

              {/* Mobile Close Button OR Desktop Collapse Button */}
              {mobileOpen ? (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
                    cursor: 'pointer',
                    backgroundColor: isDark ? '#111827' : '#f8fafc',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  title={t('close') || 'Close'}
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              ) : (
                <button
                  onClick={handleToggleCollapse}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
                    cursor: 'pointer',
                    backgroundColor: isDark ? '#111827' : '#f8fafc',
                    color: isDark ? '#94a3b8' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s',
                  }}
                  title={t('collapse_sidebar')}
                  aria-label={t('collapse_sidebar')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : '#e2e8f0';
                    e.currentTarget.style.color = isDark ? '#f8fafc' : '#0f172a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? '#111827' : '#f8fafc';
                    e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b';
                  }}
                >
                  <ChevronLeft size={15} className="rtl:rotate-180" />
                </button>
              )}
            </>
          ) : (
          /* Collapsed Header: Centered Logo + Quick Expand Button */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: '40px',
                height: '34px',
                padding: '3px 4px',
                borderRadius: '8px',
                backgroundColor: '#512772',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(81, 39, 114, 0.4)',
                cursor: 'pointer',
              }}
              onClick={handleToggleCollapse}
              title={t('expand_sidebar')}
            >
              <img
                src="/Logo.png"
                alt="InstaPay"
                style={{
                  height: '14px',
                  width: 'auto',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation Items Area */}
      <nav
        style={{
          flex: 1,
          padding: isCollapsed ? '10px 5px' : '10px 8px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {navItems.map((item) => {
          const isActive = currentPage === item.page;
          const itemLabel = t(item.key) || item.label;

          if (isCollapsed) {
            // Collapsed mode: Centered icon with tooltip
            return (
              <button
                key={item.page}
                onClick={() => {
                  onNavigate(item.page);
                  onCloseMobile?.();
                }}
                title={itemLabel}
                aria-label={itemLabel}
                style={{
                  width: '42px',
                  height: '40px',
                  margin: '0 auto',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '17px',
                  backgroundColor: isActive ? '#2563eb' : 'transparent',
                  color: isActive ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
                  boxShadow: isActive ? '0 3px 10px rgba(37,99,235,0.4)' : 'none',
                  transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : '#f1f5f9';
                    e.currentTarget.style.color = isDark ? '#f8fafc' : '#0f172a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b';
                  }
                }}
              >
                <span>{item.emoji}</span>
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      [isRtl ? 'right' : 'left']: '2px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '3px',
                      height: '16px',
                      backgroundColor: '#60a5fa',
                      borderRadius: '2px',
                    }}
                  />
                )}
              </button>
            );
          }

          // Expanded mode: Full item with icon and label
          return (
            <button
              key={item.page}
              onClick={() => {
                onNavigate(item.page);
                onCloseMobile?.();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '7px',
                fontSize: '11.5px',
                fontWeight: isActive ? 600 : 500,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isActive ? '#2563eb' : 'transparent',
                color: isActive ? '#ffffff' : isDark ? '#cbd5e1' : '#475569',
                boxShadow: isActive ? '0 3px 10px rgba(37,99,235,0.35)' : 'none',
                textAlign: isRtl ? 'right' : 'left',
                transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : '#f1f5f9';
                  e.currentTarget.style.color = isDark ? '#f8fafc' : '#0f172a';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = isDark ? '#cbd5e1' : '#475569';
                }
              }}
            >
              <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.emoji}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {itemLabel}
              </span>
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    [isRtl ? 'right' : 'left']: '0',
                    top: '6px',
                    bottom: '6px',
                    width: '3.5px',
                    backgroundColor: '#60a5fa',
                    borderRadius: isRtl ? '3px 0 0 3px' : '0 3px 3px 0',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Area: System Status & Theme/Language Controls */}
      <div
        style={{
          padding: isCollapsed ? '10px 5px' : '10px 10px',
          borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        {!isCollapsed ? (
          <>
            {/* System Online Badge */}
            <div
              style={{
                backgroundColor: isDark ? '#111827' : '#f8fafc',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '7px 9px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                    boxShadow: '0 0 6px #22c55e',
                    animation: 'pulseGreen 2s ease-in-out infinite',
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: 600, color: isDark ? '#4ade80' : '#16a34a' }}>
                  {t('system_online')}
                </span>
              </div>
              <p style={{ fontSize: '9.5px', color: isDark ? '#94a3b8' : '#64748b', margin: 0 }}>
                {t('services_operational')}
              </p>
            </div>

            {/* Theme & Language Switcher Bar */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={toggleTheme}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  padding: '6px 8px',
                  backgroundColor: isDark ? '#111827' : '#f8fafc',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #cbd5e1',
                  borderRadius: '7px',
                  color: isDark ? '#f8fafc' : '#334155',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                title="Toggle Dark / Light Mode"
              >
                {isDark ? <Sun size={13} style={{ color: '#fbbf24' }} /> : <Moon size={13} style={{ color: '#6366f1' }} />}
                <span>{isDark ? (isRtl ? 'النهاري' : 'Light') : (isRtl ? 'الليلي' : 'Dark')}</span>
              </button>

              <button
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  padding: '6px 8px',
                  backgroundColor: isDark ? '#111827' : '#f8fafc',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #cbd5e1',
                  borderRadius: '7px',
                  color: isDark ? '#f8fafc' : '#334155',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                title="Switch Language"
              >
                <Globe size={13} style={{ color: '#0ea5e9' }} />
                <span>{lang === 'en' ? 'عربي' : 'English'}</span>
              </button>
            </div>
          </>
        ) : (
          // Collapsed Compact Footer
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {/* Compact Pulsing Status Indicator */}
            <div
              title={`${t('system_online')} - ${t('services_operational')}`}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#dcfce7',
                border: isDark ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid #86efac',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'help',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 6px #22c55e',
                  animation: 'pulseGreen 2s ease-in-out infinite',
                }}
              />
            </div>

            {/* Compact Theme Toggle */}
            <button
              onClick={toggleTheme}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: isDark ? '#111827' : '#f8fafc',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #cbd5e1',
                color: isDark ? '#f8fafc' : '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title={isDark ? 'Switch to Light' : 'Switch to Dark'}
            >
              {isDark ? <Sun size={14} style={{ color: '#fbbf24' }} /> : <Moon size={14} style={{ color: '#6366f1' }} />}
            </button>

            {/* Compact Language Toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: isDark ? '#111827' : '#f8fafc',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #cbd5e1',
                color: isDark ? '#f8fafc' : '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                transition: 'all 0.2s',
              }}
              title={lang === 'en' ? 'عربي' : 'English'}
            >
              {lang === 'en' ? 'ع' : 'EN'}
            </button>

            {/* Expand Toggle Button */}
            <button
              onClick={handleToggleCollapse}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                border: 'none',
                color: isDark ? '#f8fafc' : '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: '4px',
              }}
              title={t('expand_sidebar')}
            >
              <ChevronRight size={16} className="rtl:rotate-180" />
            </button>
          </div>
        )}
      </div>
    </aside>
  </>
  );
}
