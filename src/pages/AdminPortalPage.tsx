import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Lock,
  LogOut,
  Activity,
  Send,
  Eye,
  EyeOff,
  Filter,
  DollarSign,
  Smartphone,
  Check,
} from 'lucide-react';
import { adminApi } from '../services/api';

interface MerchantClient {
  id: string;
  businessName: string;
  businessType: string;
  email: string;
  instapayHandle: string;
  instapayPaymentUrl?: string | null;
  whatsappNumber?: string | null;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  isActive: boolean;
  apiKey?: string | null;
  detectToken?: string | null;
  webhookSecret?: string | null;
  webhookUrl?: string | null;
  subscriptionPlan: string;
  txLimit: number;
  txCount: number;
  createdAt: string;
  _count?: {
    transactions: number;
  };
  detectorDevices?: any[];
}

interface PlatformStats {
  totalClients: number;
  pendingClients: number;
  approvedClients: number;
  totalTransactions: number;
  confirmedTransactions: number;
  totalVolumeEgp: number;
  totalDetectors: number;
}

export function AdminPortalPage() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Portal State
  const [activeTab, setActiveTab] = useState<'merchants' | 'transactions' | 'audit' | 'webhooks'>('merchants');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [merchants, setMerchants] = useState<MerchantClient[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters & Search
  const [merchantFilter, setMerchantFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [merchantSearch, setMerchantSearch] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantClient | null>(null);

  // Manual Force Confirm dialog
  const [forceSessionId, setForceSessionId] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Check admin session on mount
  useEffect(() => {
    adminApi
      .checkSession()
      .then((res) => {
        if (res?.ok) {
          setIsAdminAuthenticated(true);
        } else {
          setIsAdminAuthenticated(false);
        }
      })
      .catch(() => setIsAdminAuthenticated(false));
  }, []);

  // Fetch admin portal data
  const fetchData = async () => {
    if (!isAdminAuthenticated) return;
    setLoading(true);
    try {
      const [statsRes, clientsRes, txRes, auditRes, webhooksRes] = await Promise.allSettled([
        adminApi.getStats(),
        adminApi.listClients(),
        adminApi.getTransactions(),
        adminApi.getAuditLogs(),
        adminApi.getWebhooks(),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.ok) {
        setStats(statsRes.value.stats);
      }
      if (clientsRes.status === 'fulfilled' && clientsRes.value?.ok) {
        setMerchants(clientsRes.value.clients);
      }
      if (txRes.status === 'fulfilled' && txRes.value?.ok) {
        setTransactions(txRes.value.transactions);
      }
      if (auditRes.status === 'fulfilled' && auditRes.value?.ok) {
        setAuditLogs(auditRes.value.logs);
      }
      if (webhooksRes.status === 'fulfilled' && webhooksRes.value?.ok) {
        setWebhookLogs(webhooksRes.value.logs);
      }
    } catch {
      showToast('Error syncing admin records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchData();
    }
  }, [isAdminAuthenticated]);

  // Handle Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setLoginError('Password is required');
      return;
    }
    setLoginError('');
    setAuthLoading(true);
    try {
      const res = await adminApi.login(adminPassword);
      if (res?.ok) {
        setIsAdminAuthenticated(true);
        setAdminPassword('');
        showToast('Superadmin authenticated successfully');
      } else {
        setLoginError(res?.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setLoginError(err.response?.data?.error || 'Invalid admin credentials');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await adminApi.logout();
    setIsAdminAuthenticated(false);
    showToast('Admin session logged out');
  };

  // Merchant Approval
  const handleApprove = async (id: string, name: string) => {
    try {
      const res = await adminApi.approveClient(id);
      if (res.ok) {
        showToast(`Merchant "${name}" approved & API keys generated`);
        fetchData();
      } else {
        showToast(res.error || 'Failed to approve merchant', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to approve merchant', 'error');
    }
  };

  // Merchant Rejection
  const handleReject = async (id: string, name: string) => {
    try {
      const res = await adminApi.rejectClient(id);
      if (res.ok) {
        showToast(`Merchant "${name}" rejected`, 'error');
        fetchData();
      } else {
        showToast(res.error || 'Failed to reject merchant', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to reject merchant', 'error');
    }
  };

  // Force Confirm Transaction
  const handleForceConfirm = async (sessionId: string) => {
    if (!sessionId.trim()) return;
    setConfirmingId(sessionId);
    try {
      const res = await adminApi.forceConfirm(sessionId);
      if (res.ok) {
        showToast(`Transaction ${sessionId} force-confirmed successfully`);
        setForceSessionId('');
        fetchData();
      } else {
        showToast(res.error || 'Failed to confirm transaction', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to confirm transaction', 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  // Filtered Merchants
  const filteredMerchants = merchants.filter((m) => {
    const matchesFilter = merchantFilter === 'ALL' || m.approvalStatus === merchantFilter;
    const q = merchantSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      m.businessName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.instapayHandle.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  // ─── LOGIN SCREEN ─────────────────────────────────────────────────
  if (!isAdminAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#090d16',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: "'Inter', sans-serif",
          color: '#e2e8f0',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '36px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Accent glow */}
          <div
            style={{
              position: 'absolute',
              top: '-120px',
              right: '-120px',
              width: '240px',
              height: '240px',
              borderRadius: '50%',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              filter: 'blur(50px)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 12px 24px -6px rgba(124, 58, 237, 0.5)',
              }}
            >
              <Shield size={32} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
              Superadmin Portal
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              InstaPay Payment Gateway Master Administration
            </p>
          </div>

          {loginError && (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                color: '#f87171',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} />
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Master Admin Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter administrator password..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 14px',
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
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
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '14px',
                border: 'none',
                cursor: authLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 20px -4px rgba(124, 58, 237, 0.4)',
              }}
            >
              {authLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Verifying Credentials...
                </>
              ) : (
                <>
                  <Lock size={16} /> Enter Superadmin Console
                </>
              )}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <a
              href="/"
              style={{
                fontSize: '13px',
                color: '#818cf8',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ← Back to Merchant Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ─── ADMIN DASHBOARD ──────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#090d16',
        color: '#e2e8f0',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Top Admin Header */}
      <header
        style={{
          backgroundColor: '#0f172a',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '14px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 16px -2px rgba(124, 58, 237, 0.4)',
            }}
          >
            <Shield size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Superadmin Control Center
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
                  color: '#c084fc',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                }}
              >
                LIVE ROOT
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
              InstaPay Payment Gateway & Detector Fleet
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#cbd5e1',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <a
            href="/"
            style={{
              padding: '8px 14px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              color: '#60a5fa',
              fontSize: '13px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Merchant Portal ↗
          </a>

          <button
            onClick={handleAdminLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
        {/* Toast Notification */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 9999,
              padding: '12px 18px',
              backgroundColor: toastMessage.type === 'success' ? '#065f46' : '#991b1b',
              color: '#ffffff',
              borderRadius: '10px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {toastMessage.text}
          </div>
        )}

        {/* Overview Stats Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>Total Merchants</span>
              <Users size={18} color="#818cf8" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff' }}>
              {stats?.totalClients ?? merchants.length}
            </div>
            <div style={{ fontSize: '12px', color: '#a78bfa', marginTop: '4px' }}>
              {stats?.approvedClients ?? 0} approved • {stats?.pendingClients ?? 0} pending
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#0f172a',
              border: stats?.pendingClients ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>Pending Approvals</span>
              <AlertTriangle size={18} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: stats?.pendingClients ? '#f59e0b' : '#ffffff' }}>
              {stats?.pendingClients ?? 0}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Requires superadmin authorization
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>Processed Volume</span>
              <DollarSign size={18} color="#10b981" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#34d399' }}>
              {(stats?.totalVolumeEgp ?? 0).toFixed(2)} EGP
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Across {stats?.confirmedTransactions ?? 0} confirmed payments
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>Active Detectors</span>
              <Smartphone size={18} color="#06b6d4" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8' }}>
              {stats?.totalDetectors ?? 0}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Android companion APK listeners
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '12px',
          }}
        >
          <button
            onClick={() => setActiveTab('merchants')}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: activeTab === 'merchants' ? '#7c3aed' : 'transparent',
              color: activeTab === 'merchants' ? '#ffffff' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Users size={16} /> Merchants ({merchants.length})
            {(stats?.pendingClients ?? 0) > 0 && (
              <span
                style={{
                  padding: '1px 6px',
                  backgroundColor: '#f59e0b',
                  color: '#000000',
                  borderRadius: '9999px',
                  fontSize: '10px',
                  fontWeight: 800,
                }}
              >
                {stats?.pendingClients}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: activeTab === 'transactions' ? '#7c3aed' : 'transparent',
              color: activeTab === 'transactions' ? '#ffffff' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={16} /> Platform Transactions
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: activeTab === 'audit' ? '#7c3aed' : 'transparent',
              color: activeTab === 'audit' ? '#ffffff' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Shield size={16} /> Audit Trail ({auditLogs.length})
          </button>

          <button
            onClick={() => setActiveTab('webhooks')}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: activeTab === 'webhooks' ? '#7c3aed' : 'transparent',
              color: activeTab === 'webhooks' ? '#ffffff' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Send size={16} /> Webhook Logs ({webhookLogs.length})
          </button>
        </div>

        {/* ─── TAB 1: MERCHANTS & APPROVALS ─────────────────────────── */}
        {activeTab === 'merchants' && (
          <div>
            {/* Search & Status Filter */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setMerchantFilter(filter)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor:
                        merchantFilter === filter ? '#334155' : 'rgba(255, 255, 255, 0.05)',
                      color: merchantFilter === filter ? '#38bdf8' : '#94a3b8',
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search by name, email, or handle..."
                  value={merchantSearch}
                  onChange={(e) => setMerchantSearch(e.target.value)}
                  style={{
                    padding: '8px 12px 8px 34px',
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    width: '280px',
                  }}
                />
              </div>
            </div>

            {/* Merchants Table */}
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                overflow: 'hidden',
              }}
            >
              {filteredMerchants.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  No merchants found matching the filter criteria.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: '#111827',
                      }}
                    >
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Merchant</th>
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>InstaPay Payment Details</th>
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Detectors</th>
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Txs / Quota</th>
                      <th style={{ textAlign: 'right', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMerchants.map((m) => {
                      const isPending = m.approvalStatus === 'PENDING';
                      const isApproved = m.approvalStatus === 'APPROVED';
                      const isRejected = m.approvalStatus === 'REJECTED';

                      return (
                        <tr
                          key={m.id}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            backgroundColor: isPending ? 'rgba(245, 158, 11, 0.03)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '14px' }}>
                              {m.businessName}
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                              {m.email} {m.whatsappNumber ? `• 📱 ${m.whatsappNumber}` : ''}
                            </div>
                          </td>

                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#38bdf8' }}>
                              {m.instapayHandle}
                            </div>
                            {m.instapayPaymentUrl && (
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: '#64748b',
                                  maxWidth: '240px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {m.instapayPaymentUrl}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '14px 20px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: isApproved
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : isPending
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                                color: isApproved ? '#34d399' : isPending ? '#fbbf24' : '#f87171',
                              }}
                            >
                              {m.approvalStatus}
                            </span>
                          </td>

                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#cbd5e1' }}>
                            {m.detectorDevices && m.detectorDevices.length > 0 ? (
                              <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={14} /> {m.detectorDevices.length} Connected
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>None</span>
                            )}
                          </td>

                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#cbd5e1' }}>
                            {m.txCount} / {m.txLimit} ({m.subscriptionPlan})
                          </td>

                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              <button
                                onClick={() => setSelectedMerchant(m)}
                                style={{
                                  padding: '6px 10px',
                                  backgroundColor: '#1e293b',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '6px',
                                  color: '#cbd5e1',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                Keys & Details
                              </button>

                              {isPending && (
                                <>
                                  <button
                                    onClick={() => handleApprove(m.id, m.businessName)}
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: '#059669',
                                      border: 'none',
                                      borderRadius: '6px',
                                      color: '#ffffff',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReject(m.id, m.businessName)}
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                      border: '1px solid rgba(239, 68, 68, 0.4)',
                                      borderRadius: '6px',
                                      color: '#f87171',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {isApproved && (
                                <button
                                  onClick={() => handleReject(m.id, m.businessName)}
                                  style={{
                                    padding: '6px 10px',
                                    backgroundColor: 'transparent',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '6px',
                                    color: '#f87171',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Deactivate
                                </button>
                              )}

                              {isRejected && (
                                <button
                                  onClick={() => handleApprove(m.id, m.businessName)}
                                  style={{
                                    padding: '6px 10px',
                                    backgroundColor: '#059669',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Re-Approve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: PLATFORM TRANSACTIONS & FORCE CONFIRM ──────────── */}
        {activeTab === 'transactions' && (
          <div>
            {/* Quick Force Settle Box */}
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
                ⚡ Manual Override / Force Confirm Payment
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>
                Instantly mark any checkout session as CONFIRMED, dispatch live Webhook, and notify customer browser screen.
              </p>

              <div style={{ display: 'flex', gap: '10px', maxWidth: '600px' }}>
                <input
                  type="text"
                  placeholder="Enter Session ID (e.g. cmu...)"
                  value={forceSessionId}
                  onChange={(e) => setForceSessionId(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => handleForceConfirm(forceSessionId)}
                  disabled={!forceSessionId.trim() || confirmingId === forceSessionId}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#7c3aed',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: forceSessionId.trim() ? 'pointer' : 'not-allowed',
                    opacity: forceSessionId.trim() ? 1 : 0.6,
                  }}
                >
                  {confirmingId === forceSessionId ? 'Confirming...' : 'Force Confirm'}
                </button>
              </div>
            </div>

            {/* Transactions Table */}
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                overflow: 'hidden',
              }}
            >
              {transactions.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  No platform transactions recorded yet.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: '#111827',
                      }}
                    >
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Session ID</th>
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Merchant</th>
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Amount</th>
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Sender Handle</th>
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Created</th>
                      <th style={{ textAlign: 'right', padding: '14px 20px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '13px', color: '#38bdf8' }}>
                          {tx.sessionId}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: '#cbd5e1' }}>
                          {tx.client?.businessName || '—'}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                          {tx.amountEgp.toFixed(2)} EGP
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: '#94a3b8' }}>
                          {tx.senderHandle}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor:
                                tx.status === 'CONFIRMED'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : tx.status === 'UNDERPAID'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(255, 255, 255, 0.08)',
                              color:
                                tx.status === 'CONFIRMED'
                                  ? '#34d399'
                                  : tx.status === 'UNDERPAID'
                                  ? '#fbbf24'
                                  : '#cbd5e1',
                            }}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '12px', color: '#94a3b8' }}>
                          {new Date(tx.createdAt).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {tx.status !== 'CONFIRMED' && (
                            <button
                              onClick={() => handleForceConfirm(tx.sessionId)}
                              disabled={confirmingId === tx.sessionId}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                borderRadius: '6px',
                                color: '#34d399',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                            >
                              Force Settle
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: AUDIT TRAIL ───────────────────────────────────── */}
        {activeTab === 'audit' && (
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
              System Event & Audit Logs
            </h3>

            {auditLogs.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>No audit records available.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#111827',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(124, 58, 237, 0.2)',
                          color: '#c084fc',
                          marginRight: '10px',
                        }}
                      >
                        {log.action}
                      </span>
                      <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{log.details}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: WEBHOOK LOGS ─────────────────────────────────── */}
        {activeTab === 'webhooks' && (
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
              Merchant Webhook Delivery Logs
            </h3>

            {webhookLogs.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>No webhook dispatches recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {webhookLogs.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      padding: '14px 18px',
                      backgroundColor: '#111827',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: w.isSuccess
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(239, 68, 68, 0.2)',
                            color: w.isSuccess ? '#34d399' : '#f87171',
                          }}
                        >
                          HTTP {w.statusCode || 'ERR'}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                          {w.client?.businessName || 'Client'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>• Event: {w.event}</span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          fontFamily: 'monospace',
                          marginTop: '4px',
                        }}
                      >
                        Target: {w.url}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Attempt #{w.attempt} • {new Date(w.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── MODAL: MERCHANT KEYS & DETAILS ──────────────────────── */}
        {selectedMerchant && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '560px',
                backgroundColor: '#111827',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '24px',
                color: '#ffffff',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                  {selectedMerchant.businessName} - Integration Keys
                </h3>
                <button
                  onClick={() => setSelectedMerchant(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '18px',
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    API Key (Merchant Backend)
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginTop: '4px',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', flex: 1, wordBreak: 'break-all' }}>
                      {selectedMerchant.apiKey || 'Not generated yet (Approve merchant first)'}
                    </span>
                    {selectedMerchant.apiKey && (
                      <button
                        onClick={() => copyToClipboard(selectedMerchant.apiKey!, 'apiKey')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedKey === 'apiKey' ? '#34d399' : '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedKey === 'apiKey' ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Detector Token (Android Companion App)
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginTop: '4px',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', flex: 1, wordBreak: 'break-all' }}>
                      {selectedMerchant.detectToken || 'Not generated yet'}
                    </span>
                    {selectedMerchant.detectToken && (
                      <button
                        onClick={() => copyToClipboard(selectedMerchant.detectToken!, 'detectToken')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedKey === 'detectToken' ? '#34d399' : '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedKey === 'detectToken' ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Webhook Secret
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginTop: '4px',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', flex: 1, wordBreak: 'break-all' }}>
                      {selectedMerchant.webhookSecret || 'Not configured'}
                    </span>
                    {selectedMerchant.webhookSecret && (
                      <button
                        onClick={() => copyToClipboard(selectedMerchant.webhookSecret!, 'webhookSecret')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedKey === 'webhookSecret' ? '#34d399' : '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedKey === 'webhookSecret' ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Configured Webhook URL
                  </label>
                  <div
                    style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginTop: '4px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                    }}
                  >
                    {selectedMerchant.webhookUrl || 'No webhook URL set'}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginTop: '20px' }}>
                <button
                  onClick={() => setSelectedMerchant(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#334155',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
