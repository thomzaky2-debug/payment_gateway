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
} from 'lucide-react';
import { authApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface LoginPageProps {
  onLogin: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function LoginPage({ onLogin, showToast }: LoginPageProps) {
  const { lang, setLang, t, isRtl } = useLanguage();

  const [isRegister, setIsRegister] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [instapayHandle, setInstapayHandle] = useState('');
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
        newErrors.instapayHandle = 'InstaPay handle is required';
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
        let handle = instapayHandle.trim();
        let paymentUrl: string | undefined = undefined;

        if (handle.startsWith('http://') || handle.startsWith('https://') || handle.includes('ipn.eg')) {
          paymentUrl = handle;
          const match = handle.match(/ipn\.eg\/S\/([^\/\s?#]+)/i) || handle.match(/\/S\/([^\/\?#]+)/i);
          if (match && match[1]) {
            handle = `${match[1].toLowerCase().replace(/^@/, '')}@instapay`;
          }
        }

        const res = await authApi.register({
          businessName: businessName.trim(),
          instapayHandle: handle,
          instapayPaymentUrl: paymentUrl,
          email: email.trim(),
          password,
          verificationId: registerVerificationId,
          otp: registerOtp.trim(),
        });

        if (res.ok) {
          showToast('success', res.message || 'Registration submitted! Please login once approved.');
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

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'linear-gradient(135deg, #070b14 0%, #0f172a 50%, #070b14 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* Background ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '-15%',
          width: '70%',
          height: '160%',
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-30%',
          right: '-15%',
          width: '70%',
          height: '160%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '36px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Top Header with Language Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                boxShadow: '0 6px 16px -2px rgba(16,185,129,0.4)',
              }}
            >
              ⚡
            </div>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>InstaPay</span>
          </div>

          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            style={{
              padding: '6px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#cbd5e1',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Globe size={13} />
            {lang === 'en' ? 'عربي' : 'EN'}
          </button>
        </div>

        {/* ─── CASE A: TWO-STEP SIGN IN OTP VERIFICATION ─────────────── */}
        {forgotMode ? null : loginOtpStep ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(124, 58, 237, 0.15)',
                  border: '1px solid rgba(124, 58, 237, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#c084fc',
                  marginBottom: '12px',
                }}
              >
                <KeyRound size={26} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0' }}>
                {t('verification_code')}
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                {t('code_sent_to')} <strong style={{ color: '#38bdf8' }}>{email}</strong>
              </p>
            </div>

            {/* Dev helper chip for local testing */}
            {loginDevOtp && (
              <div
                onClick={() => setLoginOtp(loginDevOtp)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  border: '1px dashed rgba(56, 189, 248, 0.4)',
                  borderRadius: '10px',
                  color: '#38bdf8',
                  fontSize: '12px',
                  marginBottom: '18px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                ⚡ Dev Mock OTP: <strong>{loginDevOtp}</strong> (Click to autofill)
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  maxLength={6}
                  value={loginOtp}
                  onChange={(e) => {
                    setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (loginOtpError) setLoginOtpError('');
                  }}
                  placeholder="000000"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: '#1e293b',
                    border: loginOtpError ? '2px solid #ef4444' : '2px solid #7c3aed',
                    borderRadius: '12px',
                    fontSize: '28px',
                    fontWeight: 800,
                    letterSpacing: '10px',
                    textAlign: 'center',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxShadow: loginOtpError
                      ? '0 0 24px rgba(239, 68, 68, 0.4)'
                      : '0 0 20px rgba(124, 58, 237, 0.25)',
                    transition: 'all 0.2s',
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
                      color: '#f87171',
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

                <p style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '8px' }}>
                  {t('otp_help_note')}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || loginOtp.length < 6}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: '12px',
                  border: 'none',
                  cursor: loading || loginOtp.length < 6 ? 'not-allowed' : 'pointer',
                  opacity: loading || loginOtp.length < 6 ? 0.6 : 1,
                  boxShadow: '0 8px 20px -4px rgba(124, 58, 237, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Shield size={16} />}
                {t('verify_and_login')}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <button
                  type="button"
                  onClick={() => setLoginOtpStep(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ArrowLeft size={14} />
                  {t('back_to_login')}
                </button>

                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={handleResendLoginOtp}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: cooldown > 0 ? '#64748b' : '#38bdf8',
                    cursor: cooldown > 0 ? 'default' : 'pointer',
                    fontWeight: 600,
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
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f8fafc', margin: '0 0 6px 0' }}>
                {isRegister ? t('register') : t('sign_in')}
              </h1>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                {isRegister
                  ? 'Open your merchant payment gateway account'
                  : 'Enter your credentials to access your dashboard'}
              </p>
            </div>

            {/* Tab Switcher */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#1e293b',
                borderRadius: '12px',
                padding: '4px',
                marginBottom: '20px',
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
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: !isRegister ? '#0f172a' : 'transparent',
                  color: !isRegister ? '#38bdf8' : '#94a3b8',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                <LogIn size={14} />
                {t('sign_in')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setErrors({});
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isRegister ? '#0f172a' : 'transparent',
                  color: isRegister ? '#38bdf8' : '#94a3b8',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                <UserPlus size={14} />
                {t('register')}
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {isRegister && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                      Business Name
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Building size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Cairo Tech Hub"
                        style={{
                          width: '100%',
                          padding: '10px 14px 10px 42px',
                          backgroundColor: '#1e293b',
                          border: `1px solid ${errors.businessName ? '#ef4444' : '#334155'}`,
                          borderRadius: '10px',
                          fontSize: '13px',
                          outline: 'none',
                          color: '#f8fafc',
                        }}
                      />
                    </div>
                    {errors.businessName && <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.businessName}</p>}
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                      InstaPay Address / Payment Link
                    </label>
                    <div style={{ position: 'relative' }}>
                      <AtSign size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                      <input
                        type="text"
                        value={instapayHandle}
                        onChange={(e) => setInstapayHandle(e.target.value)}
                        placeholder="https://ipn.eg/S/platform/instapay/TOKEN"
                        style={{
                          width: '100%',
                          padding: '10px 14px 10px 42px',
                          backgroundColor: '#1e293b',
                          border: `1px solid ${errors.instapayHandle ? '#ef4444' : '#334155'}`,
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          outline: 'none',
                          color: '#f8fafc',
                        }}
                      />
                    </div>
                    {errors.instapayHandle && <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.instapayHandle}</p>}
                  </div>
                </>
              )}

              {/* Email Input with Inline "Send Code" in Register mode */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                  {t('email')}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="merchant@example.com"
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 42px',
                        backgroundColor: '#1e293b',
                        border: `1px solid ${errors.email ? '#ef4444' : '#334155'}`,
                        borderRadius: '10px',
                        fontSize: '13px',
                        outline: 'none',
                        color: '#f8fafc',
                      }}
                    />
                  </div>

                  {isRegister && (
                    <button
                      type="button"
                      disabled={sendingRegisterOtp || cooldown > 0}
                      onClick={handleSendRegisterOtp}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: registerOtpSent ? 'rgba(16, 185, 129, 0.15)' : '#7c3aed',
                        border: registerOtpSent ? '1px solid #10b981' : 'none',
                        borderRadius: '10px',
                        color: registerOtpSent ? '#34d399' : '#ffffff',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: sendingRegisterOtp || cooldown > 0 ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {sendingRegisterOtp ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : registerOtpSent ? (
                        <>
                          <CheckCircle2 size={13} />
                          {cooldown > 0 ? `${cooldown}s` : t('resend_code')}
                        </>
                      ) : (
                        t('send_code')
                      )}
                    </button>
                  )}
                </div>
                {errors.email && <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.email}</p>}
              </div>

              {/* Register 6-Digit OTP Input Field */}
              {isRegister && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#cbd5e1' }}>
                      {t('verification_code')}
                    </label>
                    {registerDevOtp && (
                      <span
                        onClick={() => setRegisterOtp(registerDevOtp)}
                        style={{ fontSize: '11px', color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Auto-fill Dev: {registerDevOtp}
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                      type="text"
                      maxLength={6}
                      value={registerOtp}
                      onChange={(e) => setRegisterOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 42px',
                        backgroundColor: '#1e293b',
                        border: `1px solid ${errors.registerOtp ? '#ef4444' : '#334155'}`,
                        borderRadius: '10px',
                        fontSize: '13px',
                        letterSpacing: '2px',
                        fontFamily: 'monospace',
                        outline: 'none',
                        color: '#f8fafc',
                      }}
                    />
                  </div>
                  {errors.registerOtp && <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.registerOtp}</p>}
                </div>
              )}

              {/* Password Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                  {t('password')}
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 42px',
                      backgroundColor: '#1e293b',
                      border: `1px solid ${errors.password ? '#ef4444' : '#334155'}`,
                      borderRadius: '10px',
                      fontSize: '13px',
                      outline: 'none',
                      color: '#f8fafc',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: '4px',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: isRegister
                    ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                    : 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '10px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 8px 20px -4px rgba(16,185,129,0.3)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
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
                    {t('verify_and_register')}
                  </>
                ) : (
                  <>
                    <Shield size={16} />
                    {t('sign_in')}
                  </>
                )}
              </button>
            </form>

            {/* Forgot Password Link */}
            {!isRegister && (
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
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
                    color: '#f59e0b',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = '#fbbf24')}
                  onMouseOut={(e) => (e.currentTarget.style.color = '#f59e0b')}
                >
                  {t('forgot_password')}
                </button>
              </div>
            )}

            <div
              style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              <Shield size={12} />
              Protected by 256-bit SSL encryption & 2FA OTP
            </div>
          </div>
        )}

        {/* ─── CASE C: FORGOT PASSWORD FLOW ──────────────────────────── */}
        {forgotMode && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
                  color: '#f59e0b',
                  marginBottom: '12px',
                }}
              >
                <Lock size={26} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0' }}>
                {t('reset_password')}
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                {t('reset_password_desc')}
              </p>
            </div>

            {/* Step 1: Enter email */}
            {forgotStep === 'email' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                    {t('email')}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="merchant@example.com"
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 42px',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '10px',
                        fontSize: '13px',
                        outline: 'none',
                        color: '#f8fafc',
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleForgotRequest}
                  disabled={forgotLoading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    border: 'none',
                    cursor: forgotLoading ? 'not-allowed' : 'pointer',
                    opacity: forgotLoading ? 0.7 : 1,
                    boxShadow: '0 8px 20px -4px rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  {forgotLoading ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />}
                  {t('send_reset_code')}
                </button>

                <button
                  type="button"
                  onClick={exitForgotMode}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <ArrowLeft size={14} />
                  {t('back_to_sign_in')}
                </button>
              </div>
            )}

            {/* Step 2: Enter OTP + New Password */}
            {forgotStep === 'otp' && (
              <form onSubmit={handleForgotConfirm}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                    {t('verification_code')}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => {
                      setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                      if (forgotOtpError) setForgotOtpError('');
                    }}
                    placeholder="000000"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '14px',
                      backgroundColor: '#1e293b',
                      border: forgotOtpError ? '2px solid #ef4444' : '2px solid #f59e0b',
                      borderRadius: '12px',
                      fontSize: '28px',
                      fontWeight: 800,
                      letterSpacing: '10px',
                      textAlign: 'center',
                      color: '#ffffff',
                      fontFamily: 'monospace',
                      outline: 'none',
                      boxShadow: forgotOtpError
                        ? '0 0 24px rgba(239, 68, 68, 0.4)'
                        : '0 0 20px rgba(245, 158, 11, 0.2)',
                      transition: 'all 0.2s',
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
                        color: '#f87171',
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
                  <p style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '8px' }}>
                    {t('code_sent_to')} <strong style={{ color: '#f59e0b' }}>{forgotEmail}</strong>
                  </p>

                  {forgotDevOtp && (
                    <div
                      onClick={() => setForgotOtp(forgotDevOtp)}
                      style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px dashed #f59e0b',
                        borderRadius: '8px',
                        color: '#fbbf24',
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                    {t('new_password')}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                      type={forgotShowPassword ? 'text' : 'password'}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{
                        width: '100%',
                        padding: '10px 40px 10px 42px',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '10px',
                        fontSize: '13px',
                        outline: 'none',
                        color: '#f8fafc',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setForgotShowPassword(!forgotShowPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        padding: '4px',
                      }}
                    >
                      {forgotShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                    {t('confirm_new_password')}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                      type={forgotShowPassword ? 'text' : 'password'}
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 42px',
                        backgroundColor: '#1e293b',
                        border: `1px solid ${forgotConfirmPassword && forgotConfirmPassword !== forgotNewPassword ? '#ef4444' : '#334155'}`,
                        borderRadius: '10px',
                        fontSize: '13px',
                        outline: 'none',
                        color: '#f8fafc',
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
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    border: 'none',
                    cursor: forgotLoading ? 'not-allowed' : 'pointer',
                    opacity: forgotLoading || forgotOtp.length < 6 ? 0.6 : 1,
                    boxShadow: '0 8px 20px -4px rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  {forgotLoading ? <RefreshCw size={16} className="animate-spin" /> : <Shield size={16} />}
                  {t('reset_and_login')}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <button
                    type="button"
                    onClick={exitForgotMode}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ArrowLeft size={14} />
                    {t('back_to_sign_in')}
                  </button>
                  <button
                    type="button"
                    disabled={cooldown > 0 || forgotLoading}
                    onClick={handleForgotRequest}
                    style={{ background: 'none', border: 'none', color: cooldown > 0 ? '#64748b' : '#f59e0b', cursor: cooldown > 0 ? 'default' : 'pointer', fontWeight: 600 }}
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
                    color: '#34d399',
                    marginBottom: '16px',
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px' }}>
                  {t('password_reset_success')}
                </p>
                <button
                  type="button"
                  onClick={exitForgotMode}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 8px 20px -4px rgba(16,185,129,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <LogIn size={16} />
                  {t('back_to_sign_in')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
