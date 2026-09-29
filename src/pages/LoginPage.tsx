import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Shield, Building, AtSign, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { authApi } from '../services/api';

interface LoginPageProps {
  onLogin: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function LoginPage({ onLogin, showToast }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [instapayHandle, setInstapayHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (isRegister) {
      if (!businessName.trim()) {
        newErrors.businessName = 'Business name is required';
      }
      if (!instapayHandle.trim()) {
        newErrors.instapayHandle = 'InstaPay handle is required';
      }
    }

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (isRegister) {
        let handle = instapayHandle.trim();
        let paymentUrl: string | undefined = undefined;

        if (handle.startsWith('http://') || handle.startsWith('https://') || handle.includes('ipn.eg')) {
          paymentUrl = handle;
          const match = handle.match(/ipn\.eg\/S\/([^\/\s?#]+)/i);
          if (match && match[1]) {
            handle = `${match[1].toLowerCase()}@instapay`;
          }
        }

        const res = await authApi.register({
          businessName: businessName.trim(),
          instapayHandle: handle,
          instapayPaymentUrl: paymentUrl,
          email: email.trim(),
          password,
        });

        showToast('success', res.message || 'Registration submitted! Please login once approved.');
        setIsRegister(false);
      } else {
        const res = await authApi.login(email.trim(), password);
        if (res.ok) {
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
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          left: '-20%',
          width: '80%',
          height: '200%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '24px',
          padding: '36px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '12px',
              boxShadow: '0 10px 25px -5px rgba(16,185,129,0.4)',
            }}
          >
            ⚡
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#f8fafc', margin: '0 0 6px 0' }}>
            InstaPay Gateway
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
            {isRegister ? 'Register your merchant account' : 'Sign in to your merchant dashboard'}
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
            Sign In
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
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                  Business Name
                </label>
                <div style={{ position: 'relative' }}>
                  <Building size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Cairo Tech Store"
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                  InstaPay Payment Link / Address
                </label>
                <div style={{ position: 'relative' }}>
                  <AtSign size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    value={instapayHandle}
                    onChange={(e) => setInstapayHandle(e.target.value)}
                    placeholder="https://ipn.eg/S/platform/instapay/TOKEN or merchant@instapay"
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
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Paste your full InstaPay payment link (e.g. <code>https://ipn.eg/S/username/instapay/TOKEN</code>) or your <code>@instapay</code> handle.
                </p>
                {errors.instapayHandle && <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.instapayHandle}</p>}
              </div>
            </>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
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
            {errors.email && <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0 0' }}>{errors.email}</p>}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
              Password
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
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '10px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 8px 20px -4px rgba(16,185,129,0.4)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <span>Connecting to gateway...</span>
            ) : isRegister ? (
              <>
                <UserPlus size={16} />
                Create Merchant Account
              </>
            ) : (
              <>
                <Shield size={16} />
                Sign In to Dashboard
              </>
            )}
          </button>
        </form>

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
          Protected by 256-bit SSL encryption
        </div>
      </div>
    </div>
  );
}
