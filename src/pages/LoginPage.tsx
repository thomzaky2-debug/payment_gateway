import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  Building,
  AtSign,
  ArrowRight,
  UserPlus,
  LogIn,
  KeyRound,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Globe,
  AlertCircle,
  Activity,
  BadgeCheck,
  Sun,
  Moon,
  Smartphone,
} from 'lucide-react';
import { authApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import './LoginPage.css';

interface LoginPageProps {
  onLogin: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function LoginPage({ onLogin, showToast }: LoginPageProps) {
  const { lang, setLang, t, isRtl } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const [isRegister, setIsRegister] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [instapayHandle, setInstapayHandle] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // ─── Sign In OTP State ─────────────────────────────────────────────
  const [loginOtpStep, setLoginOtpStep] = useState(false);
  const [loginVerificationId, setLoginVerificationId] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginDevOtp, setLoginDevOtp] = useState<string | null>(null);

  // ─── Register OTP State ───────────────────────────────────────────
  const [registerOtpSent, setRegisterOtpSent] = useState(false);
  const [registerVerificationId, setRegisterVerificationId] = useState('');
  const [registerOtp, setRegisterOtp] = useState('');
  const [registerDevOtp, setRegisterDevOtp] = useState<string | null>(null);
  const [sendingRegisterOtp, setSendingRegisterOtp] = useState(false);

  // ─── Resend Timer Cooldown ────────────────────────────────────────
  const [cooldown, setCooldown] = useState(0);

  // ─── Forgot Password State ────────────────────────────────────────
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'done'>('email');
  const [forgotVerificationId, setForgotVerificationId] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotShowPassword, setForgotShowPassword] = useState(false);
  const [forgotDevOtp, setForgotDevOtp] = useState<string | null>(null);
  const [loginOtpError, setLoginOtpError] = useState('');
  const [forgotOtpError, setForgotOtpError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (isRegister) {
      if (!businessName.trim()) {
        newErrors.businessName = 'Business name is required';
      }
      if (!instapayHandle.trim()) {
        newErrors.instapayHandle = lang === 'ar'
          ? 'رابط الدفع مطلوب'
          : 'Payment link is required';
      } else if (!/^https:\/\/ipn\.eg\/S\/[^/?#\s]+\/instapay\/[^/?#\s]+\/?$/i.test(instapayHandle.trim())) {
        newErrors.instapayHandle = lang === 'ar'
          ? 'أدخل رابط دفع صحيحًا بالتنسيق https://ipn.eg/S/platform/instapay/TOKEN'
          : 'Enter a valid payment link in the format https://ipn.eg/S/platform/instapay/TOKEN';
      }
      if (!/^01\d{9}$/.test(phoneNumber)) {
        newErrors.phoneNumber = lang === 'ar'
          ? 'أدخل رقم موبايل مصري من 11 رقمًا يبدأ بـ 01'
          : 'Enter an 11-digit Egyptian mobile number starting with 01';
      }
      if (!registerOtp.trim()) {
        newErrors.registerOtp = 'Please enter the 6-digit verification code sent to your email';
      }
    }

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (isRegister && new TextEncoder().encode(password).length < 12) {
      newErrors.password = 'Password must be at least 12 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Send Register OTP ─────────────────────────────────────────────
  const handleSendRegisterOtp = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors((prev) => ({ ...prev, email: 'Please enter a valid email first' }));
      return;
    }
    setSendingRegisterOtp(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.email;
      delete next.registerOtp;
      return next;
    });

    try {
      const res = await authApi.sendOtp(email.trim(), 'MERCHANT_SIGNUP');
      if (res.ok) {
        setRegisterVerificationId(res.verificationId || '');
        setRegisterOtpSent(true);
        if (res.devOtp) setRegisterDevOtp(res.devOtp);
        setCooldown(60);
        showToast('success', res.message || 'Verification code sent to your email');
      } else {
        showToast('error', res.error || 'Failed to send verification code');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to send OTP';
      showToast('error', msg);
    } finally {
      setSendingRegisterOtp(false);
    }
  };

  // ─── Resend Login OTP ──────────────────────────────────────────────
  const handleResendLoginOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setLoginOtpError('');
    setLoginOtp('');
    try {
      const res = await authApi.sendOtp(email.trim(), 'MERCHANT_LOGIN');
      if (res.ok) {
        setLoginVerificationId(res.verificationId || '');
        if (res.devOtp) setLoginDevOtp(res.devOtp);
        setCooldown(60);
        showToast('success', res.message || 'New verification code sent');
      } else {
        showToast('error', res.error || 'Failed to resend code');
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  // ─── Submit Form (Sign In / Register / Verify Login OTP) ───────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. If currently on Login OTP Step
    if (loginOtpStep) {
      if (!loginOtp.trim() || loginOtp.length < 6) {
        const msg = 'Please enter the 6-digit verification code';
        setLoginOtpError(msg);
        showToast('error', msg);
        return;
      }
      setLoading(true);
      setLoginOtpError('');
      try {
        const res = await authApi.login(
          email.trim(),
          password,
          loginVerificationId,
          loginOtp.trim()
        );
        if (res.ok) {
          showToast('success', 'Logged in successfully!');
          onLogin();
        } else {
          const msg = res.error || 'Verification failed';
          setLoginOtpError(msg);
          showToast('error', msg);
        }
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || 'Incorrect verification code. Please check and try again.';
        setLoginOtpError(msg);
        showToast('error', msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. Initial Validation
    if (!validate()) return;

    setLoading(true);
    try {
      if (isRegister) {
        const paymentUrl = instapayHandle.trim();
        const linkMatch = paymentUrl.match(/^https:\/\/ipn\.eg\/S\/([^/?#\s]+)\/instapay\/[^/?#\s]+\/?$/i);
        const handle = `${linkMatch![1].toLowerCase().replace(/^@/, '')}@instapay`;

        const res = await authApi.register({
          businessName: businessName.trim(),
          instapayHandle: handle,
          instapayPaymentUrl: paymentUrl,
          whatsappNumber: phoneNumber,
          email: email.trim(),
          password,
          verificationId: registerVerificationId,
          otp: registerOtp.trim(),
        });

        if (res.ok) {
          showToast('success', res.message || 'Registration submitted! You can now log in to explore your dashboard.');
          setIsRegister(false);
          setRegisterOtpSent(false);
          setRegisterOtp('');
        } else {
          showToast('error', res.error || 'Registration failed');
        }
      } else {
        // Sign In Request
        const res = await authApi.login(email.trim(), password);
        if (res.ok && res.otpRequired) {
          // Transition to OTP verification step
          setLoginVerificationId(res.verificationId || '');
          if (res.devOtp) setLoginDevOtp(res.devOtp);
          setLoginOtpStep(true);
          setCooldown(60);
          showToast('info', res.message || 'Verification code sent to your email');
        } else if (res.ok) {
          showToast('success', 'Logged in successfully!');
          onLogin();
        } else {
          showToast('error', res.error || 'Login failed');
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Authentication failed';
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Forgot Password: Request OTP ──────────────────────────────────
  const handleForgotRequest = async () => {
    if (!forgotEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      showToast('error', 'Please enter a valid email address');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await authApi.resetPasswordRequest(forgotEmail.trim());
      if (res.ok) {
        setForgotVerificationId(res.verificationId || '');
        if ((res as any).devOtp) setForgotDevOtp((res as any).devOtp);
        setForgotStep('otp');
        setCooldown(60);
        showToast('success', res.message || 'Reset code sent to your email');
      } else {
        showToast('error', res.error || 'Failed to send reset code');
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to send reset code');
    } finally {
      setForgotLoading(false);
    }
  };

  // ─── Forgot Password: Confirm & Reset ──────────────────────────────
  const handleForgotConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp || forgotOtp.length < 6) {
      const msg = 'Please enter the 6-digit verification code';
      setForgotOtpError(msg);
      showToast('error', msg);
      return;
    }
    if (!forgotNewPassword || new TextEncoder().encode(forgotNewPassword).length < 12) {
      showToast('error', 'New password must be at least 12 characters');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      showToast('error', 'Passwords do not match');
      return;
    }
    setForgotLoading(true);
    setForgotOtpError('');
    try {
      const res = await authApi.resetPasswordConfirm({
        email: forgotEmail.trim(),
        verificationId: forgotVerificationId,
        otp: forgotOtp.trim(),
        password: forgotNewPassword,
      });
      if (res.ok) {
        setForgotStep('done');
        showToast('success', t('password_reset_success'));
      } else {
        const msg = res.error || 'Failed to reset password';
        setForgotOtpError(msg);
        showToast('error', msg);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Incorrect or expired reset code';
      setForgotOtpError(msg);
      showToast('error', msg);
    } finally {
      setForgotLoading(false);
    }
  };

  // ─── Exit Forgot Password Mode ─────────────────────────────────────
  const exitForgotMode = () => {
    setForgotMode(false);
    setForgotStep('email');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotVerificationId('');
    setForgotDevOtp(null);
    setForgotOtpError('');
  };

  const iconLeftPos = isRtl ? { right: '14px', left: 'auto' } : { left: '14px', right: 'auto' };
  const eyeTogglePos = isRtl ? { left: '8px', right: 'auto' } : { right: '8px', left: 'auto' };

  return (
    <div
      className="merchant-login-container"
      data-theme={isDark ? 'dark' : 'light'}
      style={{
        direction: isRtl ? 'rtl' : 'ltr',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div className="merchant-login-orb merchant-login-orb-primary" aria-hidden="true" />
      <div className="merchant-login-orb merchant-login-orb-secondary" aria-hidden="true" />

      <main className="merchant-login-shell">
        <section className="merchant-login-showcase" aria-label="NilePay Merchant Gateway">
          <div className="merchant-login-showcase-brand">
            <div className="merchant-login-showcase-logo">
              <img src="/brand/nilepay-mark.png" alt="" />
            </div>
            <div>
              <div className="merchant-login-showcase-name">NilePay</div>
              <div className="merchant-login-showcase-subtitle">Merchant Gateway</div>
            </div>
            <span className="merchant-login-showcase-badge">GATEWAY</span>
          </div>

          <div className="merchant-login-showcase-copy">
            <span className="merchant-login-eyebrow">
              <span className="merchant-login-live-dot" />
              {lang === 'ar' ? 'مدفوعاتك تحت السيطرة' : 'Your payments, in focus'}
            </span>
            <h1>{lang === 'ar' ? 'بوابة مدفوعات واضحة وآمنة لنشاطك.' : 'Your business. Every payment. One place.'}</h1>
            <p>
              {lang === 'ar'
                ? 'تابع المدفوعات الفورية وعمليات التسوية وإعدادات التكامل من مساحة عمل واحدة.'
                : 'Monitor live payments, settlements, and integration settings from one focused workspace.'}
            </p>
          </div>

          <div className="merchant-auth-features">
            {[
              { icon: Activity, title: isRtl ? 'مدفوعاتك في مكان واحد' : 'Your payments, together', detail: isRtl ? 'تابع العمليات وراجع حالات الدفع من لوحة التحكم.' : 'Follow transactions and review payment status from your dashboard.' },
              { icon: Smartphone, title: isRtl ? 'متصل بهاتفك' : 'Connected to your phone', detail: isRtl ? 'اربط NilePay Merchant لرصد إشعارات الدفع المدعومة.' : 'Pair NilePay Merchant to detect supported payment notifications.' },
              { icon: Shield, title: isRtl ? 'وصول تحت سيطرتك' : 'Access you control', detail: isRtl ? 'تحقق برمز البريد وراجع جلساتك وأجهزتك المسجّلة.' : 'Verify by email code and manage your signed-in devices.' },
            ].map(({ icon: Icon, title, detail }) => <div className="merchant-auth-feature" key={title}>
              <span aria-hidden="true"><Icon size={20} /></span>
              <div><strong>{title}</strong><p>{detail}</p></div>
            </div>)}
          </div>

          <div className="merchant-login-showcase-footer">
            <BadgeCheck size={18} />
            <span>{lang === 'ar' ? 'مصمم للتجار الذين يعملون في الوقت الفعلي.' : 'Built for merchants operating in real time.'}</span>
          </div>
        </section>

        <div className="merchant-login-card">
        {/* Top Header with Language Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                background: '#081426',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                boxShadow: '0 8px 18px -4px rgba(0,85,255,0.2)',
                padding: '5px',
              }}
            >
              <img src="/brand/nilepay-mark.png" alt="" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--auth-text)', lineHeight: 1.2 }}>NilePay</div>
              <div style={{ fontSize: '10.5px', color: 'var(--auth-muted)', fontWeight: 500 }}>
                {lang === 'ar' ? 'بوابة التجار' : 'Merchant Gateway'}
              </div>
            </div>
          </div>

          <div className="merchant-auth-utilities">
            <button type="button" onClick={toggleTheme} className="merchant-auth-theme-toggle"
              aria-label={isDark ? (isRtl ? 'التبديل إلى الوضع النهاري' : 'Switch to light mode') : (isRtl ? 'التبديل إلى الوضع الليلي' : 'Switch to dark mode')}
              title={isDark ? 'Light mode' : 'Dark mode'}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            style={{
              padding: '6px 14px',
              minHeight: '36px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '9px',
              color: 'var(--auth-label)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              touchAction: 'manipulation',
            }}
          >
            <Globe size={14} />
            <span>{lang === 'en' ? 'عربي' : 'English'}</span>
          </button>
          </div>
        </div>

        {/* ─── CASE A: TWO-STEP SIGN IN OTP VERIFICATION ─────────────── */}
        {forgotMode ? null : loginOtpStep ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(37, 99, 235, 0.15)',
                  border: '1px solid rgba(37, 99, 235, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--auth-accent)',
                  marginBottom: '12px',
                  boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.3)',
                }}
              >
                <KeyRound size={26} />
              </div>
              <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--auth-text)', margin: '0 0 6px 0' }}>
                {t('verification_code')}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--auth-muted)', margin: 0, wordBreak: 'break-all' }}>
                {t('code_sent_to')} <strong style={{ color: 'var(--auth-accent)' }}>{email}</strong>
              </p>
            </div>

            {/* Dev helper chip for local testing */}
            {loginDevOtp && (
              <div
                onClick={() => setLoginOtp(loginDevOtp)}
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  border: '1px dashed rgba(56, 189, 248, 0.5)',
                  borderRadius: '10px',
                  color: 'var(--auth-accent)',
                  fontSize: '12px',
                  marginBottom: '18px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                ⚡ Dev Mock OTP: <strong>{loginDevOtp}</strong> (Click to autofill)
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={loginOtp}
                  onChange={(e) => {
                    setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (loginOtpError) setLoginOtpError('');
                  }}
                  placeholder="000000"
                  autoFocus
                  className="merchant-otp-input"
                  style={{
                    border: loginOtpError ? '2px solid #ef4444' : '2px solid var(--auth-accent)',
                    boxShadow: loginOtpError
                      ? '0 0 24px rgba(239, 68, 68, 0.4)'
                      : '0 0 20px rgba(37, 99, 235, 0.25)',
                  }}
                />

                {loginOtpError && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px 14px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '10px',
                      color: 'var(--auth-error)',
                      fontSize: '12px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      textAlign: isRtl ? 'right' : 'left',
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
                    <span>{loginOtpError}</span>
                  </div>
                )}

                <p style={{ fontSize: '11.5px', color: 'var(--auth-muted)', textAlign: 'center', marginTop: '10px' }}>
                  {t('otp_help_note')}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || loginOtp.length < 6}
                className="merchant-auth-btn"
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: 'white',
                  opacity: loading || loginOtp.length < 6 ? 0.6 : 1,
                  boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.4)',
                  marginBottom: '16px',
                }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Shield size={16} />}
                <span>{t('verify_and_login')}</span>
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                <button
                  type="button"
                  onClick={() => setLoginOtpStep(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--auth-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 4px',
                    minHeight: '36px',
                  }}
                >
                  <ArrowLeft size={15} style={isRtl ? { transform: 'rotate(180deg)' } : {}} />
                  <span>{t('back_to_login')}</span>
                </button>

                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={handleResendLoginOtp}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: cooldown > 0 ? 'var(--auth-muted)' : 'var(--auth-accent)',
                    cursor: cooldown > 0 ? 'default' : 'pointer',
                    fontWeight: 600,
                    padding: '6px 4px',
                    minHeight: '36px',
                  }}
                >
                  {cooldown > 0 ? `${t('resend_code')} (${cooldown}s)` : t('resend_code')}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ─── CASE B: STANDARD SIGN IN & REGISTRATION FORM ───────── */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--auth-text)', margin: '0 0 6px 0' }}>
                {isRegister ? t('register') : t('sign_in')}
              </h1>
              <p style={{ fontSize: '12.5px', color: 'var(--auth-muted)', margin: 0 }}>
                {isRegister
                  ? (lang === 'ar' ? 'افتح حسابك التجاري في بوابة الدفع' : 'Open your merchant payment gateway account')
                  : (lang === 'ar' ? 'أدخل بيانات الدخول للوصول إلى لوحة التحكم' : 'Enter your credentials to access your dashboard')}
              </p>
            </div>

            {/* Segmented Tab Switcher */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--auth-raised)',
                borderRadius: '12px',
                padding: '4px',
                marginBottom: '20px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setErrors({});
                }}
                style={{
                  flex: 1,
                  minHeight: '40px',
                  padding: '8px 12px',
                  borderRadius: '9px',
                  border: 'none',
                  backgroundColor: !isRegister ? 'var(--auth-surface)' : 'transparent',
                  color: !isRegister ? 'var(--auth-accent)' : 'var(--auth-muted)',
                  boxShadow: !isRegister ? '0 1px 4px rgba(0, 0, 0, 0.12)' : 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  touchAction: 'manipulation',
                }}
              >
                <LogIn size={15} />
                <span>{t('sign_in')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setErrors({});
                }}
                style={{
                  flex: 1,
                  minHeight: '40px',
                  padding: '8px 12px',
                  borderRadius: '9px',
                  border: 'none',
                  backgroundColor: isRegister ? 'var(--auth-surface)' : 'transparent',
                  color: isRegister ? 'var(--auth-accent)' : 'var(--auth-muted)',
                  boxShadow: isRegister ? '0 1px 4px rgba(0, 0, 0, 0.12)' : 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  touchAction: 'manipulation',
                }}
              >
                <UserPlus size={15} />
                <span>{t('register')}</span>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {isRegister && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--auth-label)', marginBottom: '6px' }}>
                      {lang === 'ar' ? 'اسم المتجر / النشاط التجاري' : 'Business Name'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Building size={16} style={{ position: 'absolute', ...iconLeftPos, top: '50%', transform: 'translateY(-50%)', color: 'var(--auth-muted)', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        autoComplete="organization"
                        autoCapitalize="words"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Cairo Tech Hub"
                        className="merchant-auth-input has-icon-left"
                        style={{
                          border: `1px solid ${errors.businessName ? '#ef4444' : 'var(--auth-border)'}`,
                        }}
                      />
                    </div>
                    {errors.businessName && <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.businessName}</p>}
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--auth-label)' }}>
                        {lang === 'ar' ? 'رابط الدفع' : 'Payment Link'}
                      </label>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <AtSign size={16} style={{ position: 'absolute', ...iconLeftPos, top: '50%', transform: 'translateY(-50%)', color: 'var(--auth-muted)', pointerEvents: 'none' }} />
                      <input
                        type="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={instapayHandle}
                        onChange={(e) => setInstapayHandle(e.target.value)}
                        placeholder="https://ipn.eg/S/platform/instapay/TOKEN"
                        className="merchant-auth-input has-icon-left"
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          border: `1px solid ${errors.instapayHandle ? '#ef4444' : 'var(--auth-border)'}`,
                        }}
                      />
                    </div>
                    {errors.instapayHandle ? (
                      <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.instapayHandle}</p>
                    ) : (
                      <p style={{ fontSize: '10.5px', color: 'var(--auth-muted)', margin: '4px 0 0 0' }}>
                        {lang === 'ar'
                          ? 'استخدم رابط الدفع المباشر بالتنسيق: https://ipn.eg/S/platform/instapay/TOKEN'
                          : 'Use your direct payment link: https://ipn.eg/S/platform/instapay/TOKEN'}
                      </p>
                    )}
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--auth-label)', marginBottom: '6px' }}>
                      {lang === 'ar' ? 'رقم الهاتف / واتساب' : 'Phone / WhatsApp Number'}
                    </label>
                    <div style={{ display: 'flex', direction: 'ltr' }}>
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: '48px', padding: '0 12px', borderRadius: '9px 0 0 9px',
                          border: `1px solid ${errors.phoneNumber ? '#ef4444' : 'var(--auth-border)'}`,
                          borderRight: 'none', background: 'var(--auth-raised)', color: 'var(--auth-label)',
                          fontFamily: 'monospace', fontWeight: 700, fontSize: '14px',
                        }}
                      >
                        +2
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        pattern="01[0-9]{9}"
                        maxLength={11}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="01123456789"
                        className="merchant-auth-input"
                        style={{
                          direction: 'ltr', borderRadius: '0 9px 9px 0',
                          border: `1px solid ${errors.phoneNumber ? '#ef4444' : 'var(--auth-border)'}`,
                        }}
                      />
                    </div>
                    {errors.phoneNumber ? (
                      <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.phoneNumber}</p>
                    ) : (
                      <p style={{ fontSize: '10.5px', color: 'var(--auth-muted)', margin: '4px 0 0 0' }}>
                        {lang === 'ar' ? 'أدخل 11 رقمًا محليًا يبدأ بـ 01.' : 'Enter the 11-digit local number beginning with 01.'}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Email Input with Integrated Send Code in Register mode */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--auth-label)', marginBottom: '6px' }}>
                  {t('email')}
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', ...iconLeftPos, top: '50%', transform: 'translateY(-50%)', color: 'var(--auth-muted)', pointerEvents: 'none' }} />
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="merchant@example.com"
                    className="merchant-auth-input has-icon-left"
                    style={{
                      border: `1px solid ${errors.email ? '#ef4444' : 'var(--auth-border)'}`,
                    }}
                  />
                </div>
                {errors.email && <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.email}</p>}

                {isRegister && (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      disabled={sendingRegisterOtp || cooldown > 0}
                      onClick={handleSendRegisterOtp}
                      style={{
                        width: '100%',
                        minHeight: '38px',
                        padding: '8px 14px',
                        backgroundColor: registerOtpSent ? 'rgba(16, 185, 129, 0.15)' : '#2563eb',
                        border: registerOtpSent ? '1px solid #10b981' : 'none',
                        borderRadius: '9px',
                        color: registerOtpSent ? 'var(--auth-success)' : '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: sendingRegisterOtp || cooldown > 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        touchAction: 'manipulation',
                      }}
                    >
                      {sendingRegisterOtp ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Sending code...</span>
                        </>
                      ) : registerOtpSent ? (
                        <>
                          <CheckCircle2 size={14} />
                          <span>{cooldown > 0 ? `${t('resend_code')} (${cooldown}s)` : t('resend_code')}</span>
                        </>
                      ) : (
                        <>
                          <KeyRound size={14} />
                          <span>{t('send_code')}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Register 6-Digit OTP Input Field */}
              {isRegister && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--auth-label)' }}>
                      {t('verification_code')}
                    </label>
                    {registerDevOtp && (
                      <span
                        onClick={() => setRegisterOtp(registerDevOtp)}
                        style={{ fontSize: '11px', color: 'var(--auth-accent)', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Auto-fill: {registerDevOtp}
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={16} style={{ position: 'absolute', ...iconLeftPos, top: '50%', transform: 'translateY(-50%)', color: 'var(--auth-muted)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={registerOtp}
                      onChange={(e) => setRegisterOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="merchant-auth-input has-icon-left"
                      style={{
                        letterSpacing: '3px',
                        fontFamily: 'monospace',
                        border: `1px solid ${errors.registerOtp ? '#ef4444' : 'var(--auth-border)'}`,
                      }}
                    />
                  </div>
                  {errors.registerOtp && <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.registerOtp}</p>}
                </div>
              )}

              {/* Password Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--auth-label)', marginBottom: '6px' }}>
                  {t('password')}
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', ...iconLeftPos, top: '50%', transform: 'translateY(-50%)', color: 'var(--auth-muted)', pointerEvents: 'none' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="merchant-auth-input has-icon-left has-icon-right"
                    style={{
                      border: `1px solid ${errors.password ? '#ef4444' : 'var(--auth-border)'}`,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      ...eyeTogglePos,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--auth-muted)',
                      padding: '8px',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      touchAction: 'manipulation',
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.password}</p>}
                {isRegister && !errors.password && (
                  <p style={{ fontSize: '10.5px', color: 'var(--auth-muted)', margin: '4px 0 0 0' }}>
                    {lang === 'ar' ? 'كلمة المرور يجب أن تكون 12 خانة على الأقل' : 'Must be at least 12 characters'}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="merchant-auth-btn"
                style={{
                  background: isRegister
                    ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                    : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: 'white',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: isRegister
                    ? '0 8px 20px -4px rgba(37, 99, 235, 0.4)'
                    : '0 8px 20px -4px rgba(16, 185, 129, 0.4)',
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : isRegister ? (
                  <>
                    <UserPlus size={16} />
                    <span>{t('verify_and_register')}</span>
                  </>
                ) : (
                  <>
                    <Shield size={16} />
                    <span>{t('sign_in')}</span>
                  </>
                )}
              </button>
            </form>

            {/* Forgot Password Link */}
            {!isRegister && (
              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setForgotEmail(email);
                    setForgotStep('email');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--auth-warning)',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    padding: '6px 8px',
                    minHeight: '36px',
                    touchAction: 'manipulation',
                  }}
                >
                  {t('forgot_password')}
                </button>
              </div>
            )}

            {/* Security note */}
            <div
              style={{
                marginTop: '18px',
                paddingTop: '14px',
                borderTop: '1px solid var(--auth-raised)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '11px',
                color: 'var(--auth-muted)',
                textAlign: 'center',
              }}
            >
              <Shield size={13} style={{ flexShrink: 0 }} />
              <span>{isRtl ? 'تسجيل دخول آمن مع التحقق برمز البريد الإلكتروني' : 'Secure sign-in with email verification'}</span>
            </div>

          </div>
        )}

        {/* ─── CASE C: FORGOT PASSWORD FLOW ──────────────────────────── */}
        {forgotMode && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--auth-warning)',
                  marginBottom: '12px',
                  boxShadow: '0 8px 24px -4px rgba(245, 158, 11, 0.3)',
                }}
              >
                <Lock size={26} />
              </div>
              <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--auth-text)', margin: '0 0 6px 0' }}>
                {t('reset_password')}
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--auth-muted)', margin: 0 }}>
                {t('reset_password_desc')}
              </p>
            </div>

            {/* Step 1: Enter email */}
            {forgotStep === 'email' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--auth-label)', marginBottom: '6px' }}>
                    {t('email')}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', ...iconLeftPos, top: '50%', transform: 'translateY(-50%)', color: 'var(--auth-muted)', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="merchant@example.com"
                      autoFocus
                      className="merchant-auth-input has-icon-left"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleForgotRequest}
                  disabled={forgotLoading}
                  className="merchant-auth-btn"
                  style={{
                    background: 'linear-gradient(135deg, var(--auth-warning), #d97706)',
                    color: '#ffffff',
                    opacity: forgotLoading ? 0.7 : 1,
                    boxShadow: '0 8px 20px -4px rgba(245, 158, 11, 0.3)',
                    marginBottom: '16px',
                  }}
                >
                  {forgotLoading ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />}
                  <span>{t('send_reset_code')}</span>
                </button>

                <button
                  type="button"
                  onClick={exitForgotMode}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: 'var(--auth-muted)',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '8px',
                    minHeight: '36px',
                  }}
                >
                  <ArrowLeft size={15} style={isRtl ? { transform: 'rotate(180deg)' } : {}} />
                  <span>{t('back_to_sign_in')}</span>
                </button>
              </div>
            )}

            {/* Step 2: Enter OTP + New Password */}
            {forgotStep === 'otp' && (
              <form onSubmit={handleForgotConfirm}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--auth-label)', marginBottom: '6px' }}>
                    {t('verification_code')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => {
                      setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                      if (forgotOtpError) setForgotOtpError('');
                    }}
                    placeholder="000000"
                    autoFocus
                    className="merchant-otp-input"
                    style={{
                      border: forgotOtpError ? '2px solid #ef4444' : '2px solid var(--auth-warning)',
                      boxShadow: forgotOtpError
                        ? '0 0 24px rgba(239, 68, 68, 0.4)'
                        : '0 0 20px rgba(245, 158, 11, 0.2)',
                    }}
                  />

                  {forgotOtpError && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px 14px',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '10px',
                        color: 'var(--auth-error)',
                        fontSize: '12px',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textAlign: isRtl ? 'right' : 'left',
                      }}
                    >
                      <AlertCircle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
                      <span>{forgotOtpError}</span>
                    </div>
                  )}
                  <p style={{ fontSize: '11.5px', color: 'var(--auth-muted)', textAlign: 'center', marginTop: '8px' }}>
                    {t('code_sent_to')} <strong style={{ color: 'var(--auth-warning)' }}>{forgotEmail}</strong>
                  </p>

                  {forgotDevOtp && (
                    <div
                      onClick={() => setForgotOtp(forgotDevOtp)}
                      style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px dashed var(--auth-warning)',
                        borderRadius: '8px',
                        color: 'var(--auth-warning)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      ⚡ Dev Mock OTP: <strong>{forgotDevOtp}</strong> (Click to autofill)
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--auth-label)', marginBottom: '6px' }}>
                    {t('new_password')}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', ...iconLeftPos, top: '50%', transform: 'translateY(-50%)', color: 'var(--auth-muted)', pointerEvents: 'none' }} />
                    <input
                      type={forgotShowPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="merchant-auth-input has-icon-left has-icon-right"
                    />
                    <button
                      type="button"
                      onClick={() => setForgotShowPassword(!forgotShowPassword)}
                      aria-label={forgotShowPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        ...eyeTogglePos,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--auth-muted)',
                        padding: '8px',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {forgotShowPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--auth-label)', marginBottom: '6px' }}>
                    {t('confirm_new_password')}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', ...iconLeftPos, top: '50%', transform: 'translateY(-50%)', color: 'var(--auth-muted)', pointerEvents: 'none' }} />
                    <input
                      type={forgotShowPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="merchant-auth-input has-icon-left"
                      style={{
                        border: `1px solid ${forgotConfirmPassword && forgotConfirmPassword !== forgotNewPassword ? '#ef4444' : 'var(--auth-border)'}`,
                      }}
                    />
                  </div>
                  {forgotConfirmPassword && forgotConfirmPassword !== forgotNewPassword && (
                    <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || forgotOtp.length < 6 || !forgotNewPassword || forgotNewPassword !== forgotConfirmPassword}
                  className="merchant-auth-btn"
                  style={{
                    background: 'linear-gradient(135deg, var(--auth-warning), #d97706)',
                    color: '#ffffff',
                    opacity: forgotLoading || forgotOtp.length < 6 ? 0.6 : 1,
                    boxShadow: '0 8px 20px -4px rgba(245, 158, 11, 0.3)',
                    marginBottom: '16px',
                  }}
                >
                  {forgotLoading ? <RefreshCw size={16} className="animate-spin" /> : <Shield size={16} />}
                  <span>{t('reset_and_login')}</span>
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <button
                    type="button"
                    onClick={exitForgotMode}
                    style={{ background: 'none', border: 'none', color: 'var(--auth-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 4px', minHeight: '36px' }}
                  >
                    <ArrowLeft size={15} style={isRtl ? { transform: 'rotate(180deg)' } : {}} />
                    <span>{t('back_to_sign_in')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={cooldown > 0 || forgotLoading}
                    onClick={handleForgotRequest}
                    style={{ background: 'none', border: 'none', color: cooldown > 0 ? 'var(--auth-muted)' : 'var(--auth-warning)', cursor: cooldown > 0 ? 'default' : 'pointer', fontWeight: 600, padding: '6px 4px', minHeight: '36px' }}
                  >
                    {cooldown > 0 ? `${t('resend_code')} (${cooldown}s)` : t('resend_code')}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Success */}
            {forgotStep === 'done' && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '2px solid rgba(16, 185, 129, 0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--auth-success)',
                    marginBottom: '16px',
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <p style={{ fontSize: '14px', color: 'var(--auth-muted)', marginBottom: '20px' }}>
                  {t('password_reset_success')}
                </p>
                <button
                  type="button"
                  onClick={exitForgotMode}
                  className="merchant-auth-btn"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: 'white',
                    boxShadow: '0 8px 20px -4px rgba(16,185,129,0.3)',
                  }}
                >
                  <LogIn size={16} />
                  <span>{t('back_to_sign_in')}</span>
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
