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
  Download,
  CreditCard,
  Bell,
  Edit2,
  Save,
  Gift,
  Sparkles,
  Sliders,
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

export type AdminTab = 'merchants' | 'transactions' | 'audit' | 'webhooks' | 'plans' | 'notifications';

export interface AdminRoute {
  tab: AdminTab;
  subPath?: string;
}

export function parseAdminRouteFromHash(hashString?: string): AdminRoute {
  const raw = (hashString !== undefined ? hashString : (typeof window !== 'undefined' ? window.location.hash : '')) || '';
  const clean = raw.replace(/^#\/?/, '').trim();
  if (!clean) {
    return { tab: 'merchants' };
  }

  const parts = clean.split('/').filter(Boolean);
  const rawFirst = parts[0]?.toLowerCase();
  const rawSecond = parts[1]?.toLowerCase();
  const subPath = parts.slice(1).join('/');

  // Support ChatGPT-style #settings/... as well
  if (rawFirst === 'settings') {
    if (rawSecond?.includes('notif')) return { tab: 'notifications', subPath };
    if (rawSecond?.includes('plan') || rawSecond?.includes('bill') || rawSecond?.includes('trial') || rawSecond?.includes('tier')) {
      return { tab: 'plans', subPath };
    }
    if (rawSecond?.includes('trans') || rawSecond?.includes('tx')) return { tab: 'transactions', subPath };
    if (rawSecond?.includes('audit') || rawSecond?.includes('log')) return { tab: 'audit', subPath };
    if (rawSecond?.includes('hook')) return { tab: 'webhooks', subPath };
    if (rawSecond?.includes('merch') || rawSecond?.includes('client')) return { tab: 'merchants', subPath: parts.slice(2).join('/') || undefined };
    return { tab: 'plans', subPath };
  }

  const validTabs: Record<string, AdminTab> = {
    merchants: 'merchants',
    merchant: 'merchants',
    clients: 'merchants',
    client: 'merchants',
    transactions: 'transactions',
    transaction: 'transactions',
    tx: 'transactions',
    audit: 'audit',
    logs: 'audit',
    webhooks: 'webhooks',
    webhook: 'webhooks',
    plans: 'plans',
    plan: 'plans',
    billing: 'plans',
    pricing: 'plans',
    trial: 'plans',
    notifications: 'notifications',
    notification: 'notifications',
    broadcast: 'notifications',
  };

  const tab = validTabs[rawFirst] || 'merchants';
  return { tab, subPath: subPath || undefined };
}

export function buildAdminHash(tab: AdminTab, subPath?: string): string {
  if (subPath && subPath.trim()) {
    return `#${tab}/${subPath.trim()}`;
  }
  return `#${tab}/`;
}

export function AdminPortalPage() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminTotp, setAdminTotp] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Initial route parsed from URL hash (e.g. #plans/, #notifications/, #merchants/pending)
  const initialRoute = parseAdminRouteFromHash();

  // Portal State
  const [activeTab, setActiveTab] = useState<AdminTab>(() => initialRoute.tab);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [merchants, setMerchants] = useState<MerchantClient[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);

  // Admin Trial Control State
  const [trialPeriodDays, setTrialPeriodDays] = useState<number | string>(14);
  const [trialMaxTransactions, setTrialMaxTransactions] = useState<number | string>(50);
  const [trialIsActive, setTrialIsActive] = useState<boolean>(true);
  const [trialDescription, setTrialDescription] = useState<string>('14-Day introductory free trial with live InstaPay detection and 50 transactions');
  const [trialSaving, setTrialSaving] = useState(false);

  // Notification Broadcast State
  const [notifTarget, setNotifTarget] = useState<'ALL' | string>('ALL');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifSeverity, setNotifSeverity] = useState<'INFO' | 'WARNING' | 'ALERT'>('INFO');
  const [sendingNotif, setSendingNotif] = useState(false);

  const [loading, setLoading] = useState(false);

  // Filters & Search
  const initialMerchantFilter: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' = (() => {
    if (initialRoute.tab === 'merchants' && initialRoute.subPath) {
      const sub = initialRoute.subPath.toLowerCase();
      if (sub === 'pending') return 'PENDING';
      if (sub === 'approved') return 'APPROVED';
      if (sub === 'rejected') return 'REJECTED';
    }
    return 'ALL';
  })();
  const [merchantFilter, setMerchantFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>(initialMerchantFilter);
  const [merchantSearch, setMerchantSearch] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantClient | null>(null);

  // Navigation and Hash Handlers
  const navigateToTab = (tab: AdminTab, subPath?: string) => {
    setActiveTab(tab);
    if (tab === 'merchants') {
      if (subPath) {
        const lower = subPath.toLowerCase();
        if (['all', 'pending', 'approved', 'rejected'].includes(lower)) {
          setMerchantFilter(lower === 'all' ? 'ALL' : (lower.toUpperCase() as any));
          setSelectedMerchant(null);
        }
      } else {
        setSelectedMerchant(null);
      }
    } else {
      setSelectedMerchant(null);
    }
    const targetHash = buildAdminHash(tab, subPath);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  const handleFilterChange = (filter: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED') => {
    setMerchantFilter(filter);
    setSelectedMerchant(null);
    const sub = filter === 'ALL' ? '' : filter.toLowerCase();
    const targetHash = buildAdminHash('merchants', sub);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  const handleSelectMerchant = (m: MerchantClient | null) => {
    setSelectedMerchant(m);
    if (m) {
      const targetHash = buildAdminHash('merchants', m.id);
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    } else {
      const sub = merchantFilter === 'ALL' ? '' : merchantFilter.toLowerCase();
      const targetHash = buildAdminHash('merchants', sub);
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }
  };

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

  // Ensure default hash format is present on mount or auth
  useEffect(() => {
    if (isAdminAuthenticated) {
      if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
        const sub = activeTab === 'merchants' && merchantFilter !== 'ALL' ? merchantFilter.toLowerCase() : undefined;
        const targetHash = buildAdminHash(activeTab, sub);
        window.history.replaceState(null, '', targetHash);
      }
    }
  }, [isAdminAuthenticated]);

  // Listen to browser Back/Forward or manual URL hash modifications
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseAdminRouteFromHash();
      setActiveTab((prev) => (prev !== route.tab ? route.tab : prev));
      if (route.tab === 'merchants') {
        if (route.subPath) {
          const lower = route.subPath.toLowerCase();
          if (['all', 'pending', 'approved', 'rejected'].includes(lower)) {
            setMerchantFilter(lower === 'all' ? 'ALL' : (lower.toUpperCase() as any));
            setSelectedMerchant(null);
          } else {
            const merchantId = route.subPath.replace(/^details\//, '');
            const found = merchants.find((m) => m.id === merchantId);
            if (found) {
              setSelectedMerchant(found);
            }
          }
        } else {
          setSelectedMerchant(null);
        }
      } else {
        setSelectedMerchant(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [merchants]);

  // Deep-link auto-selection of merchant drawer when merchants finish loading
  useEffect(() => {
    if (merchants.length > 0) {
      const route = parseAdminRouteFromHash();
      if (route.tab === 'merchants' && route.subPath) {
        const lower = route.subPath.toLowerCase();
        if (!['all', 'pending', 'approved', 'rejected'].includes(lower)) {
          const merchantId = route.subPath.replace(/^details\//, '');
          const found = merchants.find((m) => m.id === merchantId);
          if (found) {
            setSelectedMerchant(found);
          }
        }
      }
    }
  }, [merchants]);

  // Fetch admin portal data
  const fetchData = async () => {
    if (!isAdminAuthenticated) return;
    setLoading(true);
    try {
      const [statsRes, clientsRes, txRes, auditRes, webhooksRes, plansRes] = await Promise.allSettled([
        adminApi.getStats(),
        adminApi.listClients(),
        adminApi.getTransactions(),
        adminApi.getAuditLogs(),
        adminApi.getWebhooks(),
        adminApi.getPlans(),
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
      if (plansRes.status === 'fulfilled' && plansRes.value?.ok) {
        const fetchedPlans = plansRes.value.plans || [];
        setPlans(fetchedPlans);
        const trial = fetchedPlans.find((p: any) => p.name === 'FREE_TRIAL');
        if (trial) {
          setTrialPeriodDays(trial.periodDays ?? 14);
          setTrialMaxTransactions(trial.maxTransactions ?? 50);
          setTrialIsActive(trial.isActive ?? true);
          setTrialDescription(trial.description ?? '14-Day introductory free trial with live InstaPay detection and 50 transactions');
        }
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
      const res = await adminApi.login(adminPassword, adminEmail.trim() || undefined, adminTotp.trim() || undefined);
      if (res?.ok) {
        setIsAdminAuthenticated(true);
        setAdminPassword('');
        setAdminTotp('');
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
    try {
      await adminApi.logout();
      setIsAdminAuthenticated(false);
      window.location.hash = '';
      showToast('Admin session logged out');
    } catch {
      showToast('Logout could not be confirmed. Please try again.', 'error');
    }
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

  // Plan Management
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    try {
      const res = await adminApi.updatePlan({
        name: editingPlan.name,
        priceEgp: Number(editingPlan.priceEgp),
        maxTransactions: Number(editingPlan.maxTransactions),
        periodDays: Number(editingPlan.periodDays) || 30,
        description: editingPlan.description,
        isActive: editingPlan.isActive !== false,
      });
      if (res.ok) {
        showToast(`Plan ${editingPlan.name} updated successfully!`);
        setEditingPlan(null);
        fetchData();
      } else {
        showToast(res.error || 'Failed to update plan', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update plan', 'error');
    }
  };

  const handleTrialDaysChange = (val: number | string) => {
    setTrialPeriodDays(val);
    const d = Number(val) || 14;
    const tx = Number(trialMaxTransactions) || 50;
    setTrialDescription(`${d}-Day introductory free trial with live InstaPay detection and ${tx} transactions`);
  };

  const handleTrialMaxTxChange = (val: number | string) => {
    setTrialMaxTransactions(val);
    const d = Number(trialPeriodDays) || 14;
    const tx = Number(val) || 50;
    setTrialDescription(`${d}-Day introductory free trial with live InstaPay detection and ${tx} transactions`);
  };

  const handleSaveTrialPlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTrialSaving(true);
    try {
      const res = await adminApi.updateTrialPlan({
        periodDays: Number(trialPeriodDays) || 14,
        maxTransactions: Number(trialMaxTransactions) || 50,
        isActive: trialIsActive,
        description: trialDescription,
      });
      if (res?.ok) {
        showToast(`Trial Plan configured: ${trialPeriodDays} days period, ${trialMaxTransactions} transactions limit!`);
        fetchData();
      } else {
        showToast(res?.error || 'Failed to update trial plan', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update trial plan', 'error');
    } finally {
      setTrialSaving(false);
    }
  };

  // Broadcast Notification
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) {
      showToast('Title and message are required', 'error');
      return;
    }
    setSendingNotif(true);
    try {
      const res = await adminApi.sendNotification({
        target: notifTarget === 'ALL' ? 'ALL' : undefined,
        clientId: notifTarget !== 'ALL' ? notifTarget : undefined,
        title: notifTitle,
        message: notifMessage,
        severity: notifSeverity,
      });
      if (res.ok) {
        showToast(`Notification broadcasted to ${res.sentCount || 1} merchant(s)`);
        setNotifTitle('');
        setNotifMessage('');
      } else {
        showToast(res.error || 'Failed to dispatch notification', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to dispatch notification', 'error');
    } finally {
      setSendingNotif(false);
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
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Admin Email
              </label>
              <input
                type="email"
                autoComplete="username"
                placeholder="admin@example.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Master Admin Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
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

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Authenticator Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={adminTotp}
                maxLength={6}
                onChange={(e) => setAdminTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '14px',
                  letterSpacing: '0.25em',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
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
            href="/api/apks/admin"
            download="InstaPay-Admin.apk"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'rgba(124, 58, 237, 0.2)',
              border: '1px solid rgba(124, 58, 237, 0.4)',
              borderRadius: '8px',
              color: '#c084fc',
              fontSize: '13px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <Download size={14} />
            Admin APK
          </a>

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

        {/* Overview Stats Cards (Clickable Navigation Shortcuts) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            onClick={() => navigateToTab('merchants', 'all')}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '18px 20px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
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
            onClick={() => navigateToTab('merchants', 'pending')}
            style={{
              backgroundColor: '#0f172a',
              border: stats?.pendingClients ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '18px 20px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
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
            onClick={() => navigateToTab('transactions')}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '18px 20px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
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
            onClick={() => navigateToTab('merchants')}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '18px 20px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
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
            onClick={() => navigateToTab('merchants')}
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
            onClick={() => navigateToTab('transactions')}
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
            onClick={() => navigateToTab('audit')}
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
            onClick={() => navigateToTab('webhooks')}
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

          <button
            onClick={() => navigateToTab('plans')}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: activeTab === 'plans' ? '#7c3aed' : 'transparent',
              color: activeTab === 'plans' ? '#ffffff' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CreditCard size={16} /> Plans & Pricing ({plans.length})
          </button>

          <button
            onClick={() => navigateToTab('notifications')}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: activeTab === 'notifications' ? '#7c3aed' : 'transparent',
              color: activeTab === 'notifications' ? '#ffffff' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Bell size={16} /> Broadcast Notifications
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
                    onClick={() => handleFilterChange(filter)}
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
                                onClick={() => handleSelectMerchant(m)}
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

        {/* ─── TAB 5: PLANS & BILLING MANAGEMENT ───────────────────── */}
        {activeTab === 'plans' && (
          <div>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
                  Subscription Tiers & Trial Plan Management
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                  Configure trial periods, transaction limits, and subscription tiers offered across the platform.
                </p>
              </div>
            </div>

            {/* ─── Dedicated Admin Trial Plan Controls ────────────────── */}
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '20px',
                padding: '24px',
                marginBottom: '32px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.09) 0%, rgba(15, 23, 42, 0.95) 100%)',
                boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#34d399',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      Admin Trial Control
                    </span>
                    <span style={{ fontSize: '12px', color: trialIsActive ? '#10b981' : '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: trialIsActive ? '#10b981' : '#ef4444' }} />
                      {trialIsActive ? 'Active & Live for Merchants' : 'Disabled'}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '4px 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Gift size={20} color="#10b981" /> Free Trial Configuration (Period & Transaction Times)
                  </h4>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '640px' }}>
                    Admins control the trial validity duration (in days) and maximum transaction checkouts permitted for testing merchants before requiring a paid subscription.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveTrialPlan}
                  disabled={trialSaving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 22px',
                    backgroundColor: '#10b981',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {trialSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                  Save Trial Configuration
                </button>
              </div>

              {/* Trial Form Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
                {/* Period in Days */}
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                    Trial Duration Period (Days)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={trialPeriodDays}
                      onChange={(e) => handleTrialDaysChange(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '15px',
                        fontWeight: 700,
                      }}
                    />
                    <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: '#94a3b8' }}>days</span>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {[7, 14, 21, 30, 60].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleTrialDaysChange(d)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: Number(trialPeriodDays) === d ? '#10b981' : '#334155',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Transactions Limit */}
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                    Transaction Times (Max Limit)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={trialMaxTransactions}
                      onChange={(e) => handleTrialMaxTxChange(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '15px',
                        fontWeight: 700,
                      }}
                    />
                    <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: '#94a3b8' }}>txs</span>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {[20, 50, 100, 200].map((tx) => (
                      <button
                        key={tx}
                        type="button"
                        onClick={() => handleTrialMaxTxChange(tx)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: Number(trialMaxTransactions) === tx ? '#10b981' : '#334155',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {tx} tx
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Toggle & Active Merchants */}
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                      Trial Visibility to Merchants
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#ffffff' }}>
                      <input
                        type="checkbox"
                        checked={trialIsActive}
                        onChange={(e) => setTrialIsActive(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                      />
                      Offer Free Trial in Merchant Billing
                    </label>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
                    Merchants currently on Trial:{' '}
                    <strong style={{ color: '#34d399' }}>
                      {merchants.filter((m) => m.subscriptionPlan === 'FREE_TRIAL').length}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Trial Description */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  Merchant-Facing Trial Description
                </label>
                <input
                  type="text"
                  value={trialDescription}
                  onChange={(e) => setTrialDescription(e.target.value)}
                  placeholder="e.g. 14-Day introductory free trial with live InstaPay detection and 50 transactions"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>

            {/* Plans Section Header */}
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
              All Platform Plans & Tiers
            </h4>

            {/* Plans Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              {plans
                .slice()
                .sort((a, b) => {
                  const order = ['FREE_TRIAL', 'BASIC', 'PLUS', 'PRO', 'ENTERPRISE'];
                  const idxA = order.indexOf(a.name);
                  const idxB = order.indexOf(b.name);
                  return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
                })
                .map((p) => {
                  const isTrial = p.name === 'FREE_TRIAL';
                  const isEnterprise = p.name === 'ENTERPRISE';
                  const isPlus = p.name === 'PLUS';
                  return (
                    <div
                      key={p.name}
                      style={{
                        backgroundColor: '#0f172a',
                        border: isTrial
                          ? '1px solid rgba(16, 185, 129, 0.4)'
                          : isEnterprise
                          ? '1px solid rgba(245, 158, 11, 0.4)'
                          : isPlus
                          ? '1px solid rgba(99, 102, 241, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        padding: '24px',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              color: isTrial
                                ? '#34d399'
                                : isEnterprise
                                ? '#fbbf24'
                                : isPlus
                                ? '#818cf8'
                                : '#c084fc',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            TIER {p.name}
                          </span>
                          <h4 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '4px 0 0 0' }}>
                            {p.name}
                          </h4>
                          {isEnterprise && (
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                              }}
                            >
                              Customer Service Managed
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingPlan({ ...p })}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: isTrial
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isEnterprise
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(124, 58, 237, 0.15)',
                            border: isTrial
                              ? '1px solid rgba(16, 185, 129, 0.3)'
                              : isEnterprise
                              ? '1px solid rgba(245, 158, 11, 0.3)'
                              : '1px solid rgba(124, 58, 237, 0.3)',
                            borderRadius: '8px',
                            color: isTrial ? '#34d399' : isEnterprise ? '#fbbf24' : '#c084fc',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <span
                          style={{
                            fontSize: isEnterprise ? '24px' : '32px',
                            fontWeight: 900,
                            color: isTrial ? '#10b981' : isEnterprise ? '#f59e0b' : '#38bdf8',
                          }}
                        >
                          {isEnterprise ? 'Contact Sales' : p.priceEgp}
                        </span>
                        <span style={{ fontSize: '14px', color: '#94a3b8', marginLeft: '4px' }}>
                          {isTrial
                            ? 'EGP (Free Trial)'
                            : isEnterprise
                            ? '(Customer Service / Custom)'
                            : `EGP / ${p.periodDays || 30} days`}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#94a3b8' }}>Transaction Limit:</span>
                          <span style={{ fontWeight: 600, color: '#ffffff' }}>{p.maxTransactions?.toLocaleString()} txs</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#94a3b8' }}>Period Duration:</span>
                          <span style={{ fontWeight: 600, color: '#38bdf8' }}>{p.periodDays || (isTrial ? 14 : 30)} days</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#94a3b8' }}>Active Subscribers:</span>
                          <span style={{ fontWeight: 600, color: '#34d399' }}>
                            {merchants.filter((m) => m.subscriptionPlan === p.name).length} merchants
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Edit Plan Modal */}
            {editingPlan && (
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
                <form
                  onSubmit={handleSavePlan}
                  style={{
                    width: '100%',
                    maxWidth: '480px',
                    backgroundColor: '#111827',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    padding: '24px',
                    color: '#ffffff',
                  }}
                >
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>
                    Edit {editingPlan.name} Plan
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                        Price (EGP)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingPlan.priceEgp}
                        onChange={(e) => setEditingPlan({ ...editingPlan, priceEgp: Number(e.target.value) })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                        Transaction Limit / Quota
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editingPlan.maxTransactions}
                        onChange={(e) => setEditingPlan({ ...editingPlan, maxTransactions: Number(e.target.value) })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                        Validity Period (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={editingPlan.periodDays ?? 30}
                        onChange={(e) => setEditingPlan({ ...editingPlan, periodDays: Number(e.target.value) })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                        Description
                      </label>
                      <input
                        type="text"
                        value={editingPlan.description ?? ''}
                        onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#ffffff',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setEditingPlan(null)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#334155',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '8px 18px',
                        backgroundColor: '#7c3aed',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Merchant Plan Assignment Table */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
                Merchant Plan Allocations & Usage
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                      <th style={{ padding: '10px 14px' }}>Business</th>
                      <th style={{ padding: '10px 14px' }}>Current Plan</th>
                      <th style={{ padding: '10px 14px' }}>Monthly Usage</th>
                      <th style={{ padding: '10px 14px' }}>Quota Limit</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merchants.map((m) => {
                      const usagePct = Math.min(100, Math.round(((m.txCount || 0) / (m.txLimit || 1)) * 100));
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#ffffff' }}>{m.businessName}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{m.email}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor:
                                  m.subscriptionPlan === 'ENTERPRISE'
                                    ? 'rgba(245, 158, 11, 0.2)'
                                    : m.subscriptionPlan === 'PRO'
                                    ? 'rgba(168, 85, 247, 0.2)'
                                    : m.subscriptionPlan === 'PLUS'
                                    ? 'rgba(99, 102, 241, 0.2)'
                                    : m.subscriptionPlan === 'BASIC'
                                    ? 'rgba(59, 130, 246, 0.2)'
                                    : 'rgba(16, 185, 129, 0.2)',
                                color:
                                  m.subscriptionPlan === 'ENTERPRISE'
                                    ? '#fbbf24'
                                    : m.subscriptionPlan === 'PRO'
                                    ? '#c084fc'
                                    : m.subscriptionPlan === 'PLUS'
                                    ? '#818cf8'
                                    : m.subscriptionPlan === 'BASIC'
                                    ? '#60a5fa'
                                    : '#34d399',
                              }}
                            >
                              {m.subscriptionPlan || 'FREE_TRIAL'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{m.txCount || 0}</span>
                              <div style={{ width: '60px', height: '6px', backgroundColor: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${usagePct}%`,
                                    height: '100%',
                                    backgroundColor: usagePct > 90 ? '#ef4444' : usagePct > 70 ? '#f59e0b' : '#10b981',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>{usagePct}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#94a3b8' }}>
                            {m.txLimit?.toLocaleString() || '100'} tx
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <select
                              value={m.subscriptionPlan || 'FREE_TRIAL'}
                              onChange={async (e) => {
                                const newPlan = e.target.value;
                                try {
                                  const res = await adminApi.assignClientPlan(m.id, { planName: newPlan });
                                  if (res.ok) {
                                    showToast(`Plan for ${m.businessName} updated to ${newPlan}`);
                                    fetchData();
                                  } else {
                                    showToast(res.error || 'Failed to assign plan', 'error');
                                  }
                                } catch (err: any) {
                                  showToast(err.response?.data?.error || 'Failed to assign plan', 'error');
                                }
                              }}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#1e293b',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                            >
                              {plans.length > 0 ? (
                                plans
                                  .slice()
                                  .sort((a, b) => {
                                    const order = ['FREE_TRIAL', 'BASIC', 'PLUS', 'PRO', 'ENTERPRISE'];
                                    const idxA = order.indexOf(a.name);
                                    const idxB = order.indexOf(b.name);
                                    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
                                  })
                                  .map((p) => (
                                    <option key={p.name} value={p.name}>
                                      {p.name}
                                    </option>
                                  ))
                              ) : (
                                <>
                                  <option value="FREE_TRIAL">FREE_TRIAL</option>
                                  <option value="BASIC">BASIC</option>
                                  <option value="PLUS">PLUS</option>
                                  <option value="PRO">PRO</option>
                                  <option value="ENTERPRISE">ENTERPRISE</option>
                                </>
                              )}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 6: BROADCAST NOTIFICATIONS ──────────────────────── */}
        {activeTab === 'notifications' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '28px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(124, 58, 237, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bell size={22} color="#c084fc" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                    Dispatch Merchant Notification
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                    Send high-priority alerts, maintenance notices, or system updates directly to merchant topbars & APKs.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Target Audience
                  </label>
                  <select
                    value={notifTarget}
                    onChange={(e) => setNotifTarget(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '13px',
                    }}
                  >
                    <option value="ALL">📢 All Approved Merchants (Global Broadcast)</option>
                    {merchants.map((m) => (
                      <option key={m.id} value={m.id}>
                        🏢 {m.businessName} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Severity / Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {(['INFO', 'WARNING', 'ALERT'] as const).map((sev) => (
                      <button
                        type="button"
                        key={sev}
                        onClick={() => setNotifSeverity(sev)}
                        style={{
                          padding: '10px',
                          borderRadius: '10px',
                          border: notifSeverity === sev ? '2px solid #7c3aed' : '1px solid rgba(255, 255, 255, 0.1)',
                          backgroundColor:
                            notifSeverity === sev
                              ? 'rgba(124, 58, 237, 0.2)'
                              : '#1e293b',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        {sev === 'ALERT' ? '🚨 Urgent Alert' : sev === 'WARNING' ? '⚠️ Warning' : 'ℹ️ System Info'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Notification Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Scheduled InstaPay Maintenance Tonight at 02:00 UTC"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Notification Message
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Enter full notification details for merchants..."
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '13px',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingNotif}
                  style={{
                    marginTop: '8px',
                    padding: '14px 20px',
                    backgroundColor: '#7c3aed',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 8px 20px rgba(124, 58, 237, 0.35)',
                  }}
                >
                  <Send size={16} />
                  {sendingNotif ? 'Dispatching...' : 'Broadcast Notification Now'}
                </button>
              </form>
            </div>
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
                  onClick={() => handleSelectMerchant(null)}
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
                  onClick={() => handleSelectMerchant(null)}
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
