import React from 'react';
import { AlertTriangle, ShieldAlert, Info, X } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const variantConfig = {
  danger: {
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    buttonBg: '#dc2626',
    buttonHover: '#b91c1c',
    Icon: ShieldAlert,
  },
  warning: {
    iconBg: '#fef3c7',
    iconColor: '#d97706',
    buttonBg: '#d97706',
    buttonHover: '#b45309',
    Icon: AlertTriangle,
  },
  info: {
    iconBg: '#dbeafe',
    iconColor: '#2563eb',
    buttonBg: '#2563eb',
    buttonHover: '#1d4ed8',
    Icon: Info,
  },
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.Icon;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={onCancel}
      />
      <div
        style={{
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          animation: 'scaleIn 0.2s ease-out',
        }}
      >
        <button
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#94a3b8',
          }}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: config.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={24} style={{ color: config.iconColor }} />
          </div>
          <div>
            <h3 id="confirm-title" style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 8px 0' }}>
              {title}
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>{message}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              backgroundColor: config.buttonBg,
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: `0 10px 15px -3px ${config.buttonBg}33`,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
