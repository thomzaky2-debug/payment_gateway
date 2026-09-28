import React from 'react';
import type { ToastMessage } from '../App';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46', icon: '#059669' },
  error: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', icon: '#d97706' },
  info: { bg: '#eff6ff', border: '#93c5fd', text: '#1e3a8a', icon: '#2563eb' },
};

export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '400px',
      }}
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        const colors = colorMap[toast.type];
        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
              animation: 'slideInRight 0.3s ease-out',
            }}
            role="alert"
          >
            <Icon size={20} style={{ color: colors.icon, flexShrink: 0, marginTop: '2px' }} />
            <p style={{ flex: 1, fontSize: '14px', color: colors.text, margin: 0, lineHeight: 1.5 }}>
              {toast.message}
            </p>
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: colors.text,
                opacity: 0.6,
                flexShrink: 0,
              }}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
