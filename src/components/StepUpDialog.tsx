import React, { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { subscribeStepUp, type StepUpRequest } from '../utils/stepUp';
import { useLanguage } from '../context/LanguageContext';

/**
 * Re-authentication prompt for sensitive actions. Mounted once at the app
 * root; the API client opens it when the server answers 403 STEP_UP_REQUIRED.
 */
export function StepUpDialog() {
  const { lang } = useLanguage();
  const isRtl = lang === 'ar';
  const [request, setRequest] = useState<StepUpRequest | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => subscribeStepUp((next) => { setRequest(next); setValue(''); }), []);

  if (!request) return null;

  const isTotp = request.method === 'totp';
  const valid = isTotp ? /^\d{6}$/.test(value) : value.length > 0;
  const title = isTotp
    ? (isRtl ? 'تأكيد عبر تطبيق المصادقة' : 'Confirm with your authenticator')
    : (isRtl ? 'أكّد كلمة المرور' : 'Confirm your password');
  const message = isTotp
    ? (isRtl ? 'أدخل رمزاً جديداً مكوناً من 6 أرقام لتنفيذ هذا الإجراء.' : 'Enter a fresh 6-digit code to carry out this action.')
    : (isRtl ? 'هذا التغيير يؤثر على المدفوعات أو التكامل. أدخل كلمة المرور للمتابعة.' : 'This change affects payments or your integration. Enter your password to continue.');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (valid) request.resolve(value);
  };
  const cancel = () => request.resolve(null);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-up-title"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={cancel} />
      <form
        onSubmit={submit}
        style={{ position: 'relative', backgroundColor: 'white', color: '#0f172a', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
      >
        <button type="button" onClick={cancel} aria-label="Close dialog" style={{ position: 'absolute', top: 16, [isRtl ? 'left' : 'right']: 16, padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
          <X size={20} />
        </button>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <h2 id="step-up-title" style={{ margin: '4px 0 6px', fontSize: 18, fontWeight: 700 }}>{title}</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: '22px', color: '#475569' }}>{message}</p>
          </div>
        </div>
        <input
          autoFocus
          type={isTotp ? 'text' : 'password'}
          inputMode={isTotp ? 'numeric' : undefined}
          autoComplete={isTotp ? 'one-time-code' : 'current-password'}
          maxLength={isTotp ? 6 : 128}
          value={value}
          onChange={(e) => setValue(isTotp ? e.target.value.replace(/\D/g, '') : e.target.value)}
          placeholder={isTotp ? '123456' : (isRtl ? 'كلمة المرور' : 'Password')}
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 16, borderRadius: 10, border: '1px solid #cbd5e1', letterSpacing: isTotp ? '0.3em' : undefined, textAlign: isTotp ? 'center' : undefined }}
        />
        {request.error && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#dc2626' }}>{request.error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={cancel} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
          <button type="submit" disabled={!valid} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: valid ? '#2563eb' : '#93c5fd', color: 'white', cursor: valid ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
            {isRtl ? 'تأكيد' : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  );
}
