import React from 'react';
import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Shield, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function LoginPage({ onLogin, showToast }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [attempts, setAttempts] = useState(0);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    // Simulate API authentication call
    setTimeout(() => {
      setLoading(false);
      // Accept any valid credentials (in production, this would verify against backend)
      setAttempts(0);
      onLogin();
    }, 1200);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decoration */}
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          left: '-20%',
          width: '80%',
          height: '200%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              marginBottom: '16px',
              boxShadow: '0 10px 25px -5px rgba(59,130,246,0.4)',
            }}
          >
            ⚡
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 8px 0' }}>
            InstaPay Gateway
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Sign in to your merchant dashboard</p>
        </div>

        {/* Security notice */}
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <Shield size={16} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '12px', color: '#166534', lineHeight: 1.5 }}>
            Your connection is encrypted and secure. All data is protected with 256-bit SSL encryption.
          </div>
        </div>

        {attempts >= 5 && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Lock size={16} style={{ color: '#dc2626' }} />
            <div style={{ fontSize: '13px', color: '#991b1b' }}>
              Account temporarily locked. Try again in 15 minutes.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}
            >
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }}
                placeholder="you@example.com"
                disabled={attempts >= 5}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 44px',
                  backgroundColor: '#f8fafc',
                  border: `1px solid ${errors.email ? '#fca5a5' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#1e293b',
                }}
                aria-label="Email address"
                aria-invalid={!!errors.email}
              />
            </div>
            {errors.email && (
              <p style={{ fontSize: '12px', color: '#dc2626', margin: '6px 0 0 0' }}>{errors.email}</p>
            )}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: undefined });
                }}
                placeholder="Enter your password"
                disabled={attempts >= 5}
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 44px',
                  backgroundColor: '#f8fafc',
                  border: `1px solid ${errors.password ? '#fca5a5' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#1e293b',
                }}
                aria-label="Password"
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p style={{ fontSize: '12px', color: '#dc2626', margin: '6px 0 0 0' }}>{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || attempts >= 5}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: '12px',
              border: 'none',
              cursor: loading || attempts >= 5 ? 'not-allowed' : 'pointer',
              opacity: loading || attempts >= 5 ? 0.7 : 1,
              boxShadow: '0 10px 25px -5px rgba(37,99,235,0.4)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Signing in...
              </>
            ) : (
              <>
                <Shield size={18} />
                Sign In Securely
              </>
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          <Lock size={12} />
          Protected by 256-bit SSL encryption
        </div>
      </div>
    </div>
  );
}
