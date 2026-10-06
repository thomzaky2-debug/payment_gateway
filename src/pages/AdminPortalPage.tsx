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
  Send,
  Eye,
  EyeOff,
  Filter,
  DollarSign,
  Smartphone,
  Check,
  Bell,
  Edit2,
  Save,
  Gift,
  Sparkles,
  Sliders,
  Activity,
  Power,
  RotateCcw,
  Wifi,
} from 'lucide-react';
import { adminApi } from '../services/api';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminTopbar } from '../components/AdminTopbar';
import { useTheme } from '../context/ThemeContext';

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
  subscriptionEndsAt?: string | null;
  createdAt: string;
  _count?: {
    transactions: number;
  };
  detectorDevices?: any[];
}

interface MerchantOverview {
  activeSessions: number;
  detectorOnlineCount: number;
  detectorDevices: Array<{
    id: string;
    deviceId: string;
    appVersion?: string | null;
    androidVersion?: string | null;
    lastSeenAt: string;
    lastIp?: string | null;
  }>;
  totalTransactions: number;
  transactionsByStatus: Record<string, number>;
  confirmedVolumeEgp: number;
  unmatchedPayments: number;
  webhookTotal: number;
  webhookSuccess: number;
  webhookSuccessRate: number | null;
  latestWebhook?: { createdAt: string; isSuccess: boolean; statusCode?: number | null; event: string } | null;
  latestTransaction?: { sessionId: string; status: string; amountEgp: number; createdAt: string } | null;
  apiKeyLastUsedAt?: string | null;
  detectTokenLastUsedAt?: string | null;
  subscriptionEndsAt?: string | null;
  checkoutTtlMin: number;
}

interface PlatformStats {
  totalClients: number;
  pendingClients: number;
  approvedClients: number;
  activeClients: number;
  suspendedClients: number;
  totalTransactions: number;
  confirmedTransactions: number;
  totalVolumeEgp: number;
  totalDetectors: number;
  onlineDetectors: number;
  failedWebhooks: number;
  unmatchedPayments: number;
}

export type AdminTab = 'overview' | 'merchants' | 'transactions' | 'audit' | 'webhooks' | 'plans' | 'notifications';

export interface AdminRoute {
  tab: AdminTab;
  subPath?: string;
}

export function parseAdminRouteFromHash(hashString?: string): AdminRoute {
  const raw = (hashString !== undefined ? hashString : (typeof window !== 'undefined' ? window.location.hash : '')) || '';
  const clean = raw.replace(/^#\/?/, '').trim();
  if (!clean) {
    return { tab: 'overview' };
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
    overview: 'overview',
    dashboard: 'overview',
    home: 'overview',
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

  const tab = validTabs[rawFirst] || 'overview';
  return { tab, subPath: subPath || undefined };
}

export function buildAdminHash(tab: AdminTab, subPath?: string): string {
  if (subPath && subPath.trim()) {
    return `#${tab}/${subPath.trim()}`;
  }
  return `#${tab}/`;
}

export function AdminPortalPage() {
  const { isDark } = useTheme();
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
  const [bundles, setBundles] = useState<any[]>([]);
  const [editingBundle, setEditingBundle] = useState<any | null>(null);
  const [bundleSaving, setBundleSaving] = useState(false);
  const [specialOffers, setSpecialOffers] = useState<any[]>([]);
  const [editingOffer, setEditingOffer] = useState<any | null>(null);
  const [offerSaving, setOfferSaving] = useState(false);

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
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

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
  const [merchantOverview, setMerchantOverview] = useState<MerchantOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [merchantAction, setMerchantAction] = useState<string | null>(null);
  const [merchantPlan, setMerchantPlan] = useState('FREE_TRIAL');
  const [merchantTxLimit, setMerchantTxLimit] = useState<number | string>(50);
  const [merchantExtendDays, setMerchantExtendDays] = useState<number | string>(30);

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

  useEffect(() => {
    if (!selectedMerchant) {
      setMerchantOverview(null);
      return;
    }

    let cancelled = false;
    setMerchantPlan(selectedMerchant.subscriptionPlan || 'FREE_TRIAL');
    setMerchantTxLimit(selectedMerchant.txLimit || 1);
    setMerchantExtendDays(30);
    setMerchantOverview(null);
    setOverviewLoading(true);
    adminApi.getClientOverview(selectedMerchant.id)
      .then((res) => {
        if (!cancelled && res?.ok) setMerchantOverview(res.overview);
      })
      .catch((err: any) => {
        if (!cancelled) showToast(err.response?.data?.error || 'Failed to load merchant health', 'error');
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedMerchant?.id]);

  // Fetch admin portal data
  const fetchData = async () => {
    if (!isAdminAuthenticated) return;
    setLoading(true);
    try {
      const [statsRes, clientsRes, txRes, auditRes, webhooksRes, plansRes, bundlesRes, offersRes] = await Promise.allSettled([
        adminApi.getStats(),
        adminApi.listClients(),
        adminApi.getTransactions(),
        adminApi.getAuditLogs(),
        adminApi.getWebhooks(),
        adminApi.getPlans(),
        adminApi.getBundles(),
        adminApi.getSpecialOffers(),
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
      if (bundlesRes.status === 'fulfilled' && bundlesRes.value?.ok) {
        setBundles(bundlesRes.value.bundles || []);
      }
      if (offersRes.status === 'fulfilled' && offersRes.value?.ok) {
        setSpecialOffers(offersRes.value.offers || []);
      }
      setLastSyncedAt(new Date());
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

  const refreshMerchantOverview = async (id: string) => {
    const res = await adminApi.getClientOverview(id);
    if (res?.ok) setMerchantOverview(res.overview);
  };

  const handleMerchantAccess = async () => {
    if (!selectedMerchant) return;
    const activating = !selectedMerchant.isActive;
    if (!activating && !window.confirm(`Suspend ${selectedMerchant.businessName}? Active merchant sessions will be revoked.`)) return;
    setMerchantAction('access');
    try {
      const res = await adminApi.setClientAccess(selectedMerchant.id, activating);
      if (!res?.ok) throw new Error(res?.error || 'Failed to update merchant access');
      setSelectedMerchant((current) => current ? { ...current, isActive: activating } : current);
      showToast(`${selectedMerchant.businessName} ${activating ? 'reactivated' : 'suspended'}`);
      await Promise.all([fetchData(), refreshMerchantOverview(selectedMerchant.id)]);
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to update merchant access', 'error');
    } finally {
      setMerchantAction(null);
    }
  };

  const handleRevokeSessions = async () => {
    if (!selectedMerchant || !window.confirm(`Sign ${selectedMerchant.businessName} out of every device?`)) return;
    setMerchantAction('sessions');
    try {
      const res = await adminApi.revokeClientSessions(selectedMerchant.id);
      if (!res?.ok) throw new Error(res?.error || 'Failed to revoke sessions');
      showToast(`${res.revokedSessions} merchant session(s) revoked`);
      await refreshMerchantOverview(selectedMerchant.id);
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to revoke sessions', 'error');
    } finally {
      setMerchantAction(null);
    }
  };

  const handleRotateMerchantKeys = async () => {
    if (!selectedMerchant || !window.confirm('Rotate all integration credentials? Existing API and detector integrations will stop until they use the new keys.')) return;
    setMerchantAction('keys');
    try {
      const res = await adminApi.rotateClientKeys(selectedMerchant.id);
      if (!res?.ok) throw new Error(res?.error || 'Failed to rotate credentials');
      setSelectedMerchant((current) => current ? { ...current, ...res.client } : current);
      showToast('Integration credentials rotated');
      await Promise.all([fetchData(), refreshMerchantOverview(selectedMerchant.id)]);
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to rotate credentials', 'error');
    } finally {
      setMerchantAction(null);
    }
  };

  const handleAssignMerchantPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant) return;
    setMerchantAction('plan');
    try {
      const res = await adminApi.assignClientPlan(selectedMerchant.id, {
        planName: merchantPlan,
        customTxLimit: Number(merchantTxLimit),
        extendDays: Number(merchantExtendDays),
      });
      if (!res?.ok) throw new Error(res?.error || 'Failed to update merchant plan');
      setSelectedMerchant((current) => current ? { ...current, ...res.client } : current);
      showToast(`${selectedMerchant.businessName} plan and quota updated`);
      await Promise.all([fetchData(), refreshMerchantOverview(selectedMerchant.id)]);
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to update merchant plan', 'error');
    } finally {
      setMerchantAction(null);
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
  const openEditPlan = (plan: any) => {
    const offerIsActive = plan.offerPriceEgp !== null && plan.offerEndsAt && new Date(plan.offerEndsAt).getTime() > Date.now();
    const remainingDays = offerIsActive
      ? Math.max(1, Math.ceil((new Date(plan.offerEndsAt).getTime() - Date.now()) / 86400000))
      : 7;
    setEditingPlan({
      ...plan,
      offerPriceEgp: offerIsActive ? plan.offerPriceEgp : '',
      offerLabel: offerIsActive ? (plan.offerLabel || 'Limited-time offer') : 'Limited-time offer',
      offerValidDays: remainingDays,
    });
  };

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
        offerPriceEgp: editingPlan.offerPriceEgp === '' || editingPlan.offerPriceEgp === null
          ? null
          : Number(editingPlan.offerPriceEgp),
        offerLabel: String(editingPlan.offerLabel || '').trim(),
        offerValidDays: Number(editingPlan.offerValidDays) || 7,
        clearOffer: editingPlan.offerPriceEgp === '' || editingPlan.offerPriceEgp === null,
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

  const openNewBundle = () => {
    setEditingBundle({
      name: '',
      displayName: '',
      priceEgp: 49,
      extraTx: 50,
      description: '',
      sortOrder: bundles.length + 1,
      isActive: true,
    });
  };

  const handleSaveBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBundle) return;
    if (!editingBundle.displayName?.trim() || !editingBundle.name?.trim()) {
      showToast('Bundle key and display name are required', 'error');
      return;
    }
    setBundleSaving(true);
    try {
      const payload = {
        name: String(editingBundle.name).trim().toUpperCase(),
        displayName: String(editingBundle.displayName).trim(),
        priceEgp: Number(editingBundle.priceEgp),
        extraTx: Number(editingBundle.extraTx),
        description: String(editingBundle.description || '').trim(),
        sortOrder: Number(editingBundle.sortOrder) || 0,
        isActive: editingBundle.isActive !== false,
      };
      const res = editingBundle.id
        ? await adminApi.updateBundle(editingBundle.id, payload)
        : await adminApi.createBundle(payload);
      if (!res?.ok) throw new Error(res?.error || 'Failed to save bundle');
      showToast(`${payload.displayName} ${editingBundle.id ? 'updated' : 'created'} successfully`);
      setEditingBundle(null);
      await fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to save bundle', 'error');
    } finally {
      setBundleSaving(false);
    }
  };

  const handleToggleBundle = async (bundle: any) => {
    setBundleSaving(true);
    try {
      const res = await adminApi.updateBundle(bundle.id, { isActive: !bundle.isActive });
      if (!res?.ok) throw new Error(res?.error || 'Failed to update bundle availability');
      showToast(`${bundle.displayName} is now ${bundle.isActive ? 'hidden from' : 'available in'} merchant billing`);
      await fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to update bundle', 'error');
    } finally {
      setBundleSaving(false);
    }
  };

  const openNewSpecialOffer = () => {
    setEditingOffer({ clientId: '', title: 'Enterprise Growth Offer', description: '', priceEgp: 999, maxTransactions: 5000, periodDays: 90, validDays: 14 });
  };

  const handleSaveSpecialOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOffer) return;
    setOfferSaving(true);
    try {
      const payload = {
        clientId: editingOffer.clientId,
        title: String(editingOffer.title || '').trim(),
        description: String(editingOffer.description || '').trim(),
        priceEgp: Number(editingOffer.priceEgp),
        maxTransactions: Number(editingOffer.maxTransactions),
        periodDays: Number(editingOffer.periodDays),
        validDays: Number(editingOffer.validDays) || 14,
      };
      const res = editingOffer.id
        ? await adminApi.updateSpecialOffer(editingOffer.id, payload)
        : await adminApi.createSpecialOffer(payload);
      if (!res?.ok) throw new Error(res?.error || 'Failed to save special offer');
      showToast(`Special offer ${editingOffer.id ? 'updated' : 'sent to merchant'}`);
      setEditingOffer(null);
      await fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to save special offer', 'error');
    } finally {
      setOfferSaving(false);
    }
  };

  const handleOfferStatus = async (offer: any, status: 'ACTIVE' | 'REVOKED') => {
    setOfferSaving(true);
    try {
      const res = await adminApi.updateSpecialOffer(offer.id, { status });
      if (!res?.ok) throw new Error(res?.error || 'Failed to update special offer');
      showToast(`Offer ${status === 'ACTIVE' ? 'restored' : 'revoked'}`);
      await fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to update special offer', 'error');
    } finally {
      setOfferSaving(false);
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
          width: '100vw',
          background: 'linear-gradient(135deg, #070b14 0%, #0f172a 50%, #070b14 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Inter', sans-serif",
          color: '#e2e8f0',
        }}
      >
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
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
            position: 'relative',
            overflow: 'hidden',
            zIndex: 1,
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
  const surface = isDark ? '#111827' : '#ffffff';
  const surfaceBorder = isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0';
  const textPrimary = isDark ? '#f8fafc' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const cardShadow = isDark
    ? '0 10px 25px -5px rgba(0,0,0,0.45), 0 8px 10px -6px rgba(0,0,0,0.3)'
    : '0 4px 16px rgba(0,0,0,0.06)';
  const tabHeading: Record<AdminTab, { title: string; description: string }> = {
    overview: { title: 'Platform Overview', description: 'Live operational health and activity across the entire payment network' },
    merchants: { title: 'Merchant Management', description: 'Monitor merchant health, access, subscriptions, and integration readiness' },
    transactions: { title: 'Platform Transactions', description: 'Track and resolve payment activity across all merchant accounts' },
    audit: { title: 'Administrative Audit Trail', description: 'Review privileged actions and important platform security events' },
    webhooks: { title: 'Webhook Delivery Logs', description: 'Monitor callback delivery health and merchant endpoint responses' },
    plans: { title: 'Plans & Pricing', description: 'Configure subscriptions, free trials, quotas, and merchant allocations' },
    notifications: { title: 'Merchant Notifications', description: 'Send operational updates to one merchant or the complete network' },
  };
  const currentHeading = tabHeading[activeTab];
  const recentWebhookSuccessRate = webhookLogs.length
    ? Math.round((webhookLogs.filter((log) => log.isSuccess).length / webhookLogs.length) * 100)
    : null;
  const detectorAvailability = stats?.totalDetectors
    ? Math.round(((stats.onlineDetectors || 0) / stats.totalDetectors) * 100)
    : 0;
  const merchantAvailability = stats?.approvedClients
    ? Math.round(((stats.activeClients || 0) / stats.approvedClients) * 100)
    : 0;

  return (
    <div
      className="admin-portal-shell app-main-layout"
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',
        backgroundColor: isDark ? '#090d16' : '#f1f5f9',
        color: isDark ? '#e2e8f0' : '#1e293b',
        fontFamily: "'Inter', sans-serif",
        transition: 'background-color 0.25s ease, color 0.25s ease',
      }}
    >
      <AdminSidebar
        activeTab={activeTab}
        pendingCount={stats?.pendingClients ?? 0}
        onNavigate={(tab) => navigateToTab(tab)}
      />

      <div className="admin-portal-workspace" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AdminTopbar
        activeTab={activeTab}
        loading={loading}
        onRefresh={fetchData}
        onLogout={handleAdminLogout}
      />

      {/* Main Content Area */}
      <main
        className="admin-portal-content"
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          padding: '24px',
          backgroundColor: isDark ? '#090d16' : '#f1f5f9',
          transition: 'background-color 0.25s ease',
        }}
      >
        <div className="admin-portal-content-inner" style={{ maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.4s ease-out' }}>
        {/* Toast Notification */}
        {toastMessage && (
          <div
            className="admin-toast"
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

        <div
          className="admin-page-heading"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '26px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)',
                flexShrink: 0,
              }}
            >
              <Shield size={22} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ margin: 0, color: textPrimary, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                {currentHeading.title}
              </h2>
              <p style={{ margin: '2px 0 0', color: textSecondary, fontSize: '13px' }}>{currentHeading.description}</p>
            </div>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 14px',
              borderRadius: '999px',
              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
              border: isDark ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid #bae6fd',
              color: isDark ? '#38bdf8' : '#0284c7',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Activity size={13} />
            {loading
              ? 'Syncing platform data...'
              : `Last synced ${lastSyncedAt ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}`}
          </div>
        </div>

        {activeTab === 'overview' && (
        <>
        {/* Overview Stats Cards (Clickable Navigation Shortcuts) */}
        <div
          className="admin-stats-grid"
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
              backgroundColor: surface,
              border: surfaceBorder,
              borderRadius: '20px',
              padding: '20px',
              boxShadow: cardShadow,
              cursor: 'pointer',
              transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: textSecondary }}>Total Merchants</span>
              <Users size={18} color="#818cf8" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: textPrimary }}>
              {stats?.totalClients ?? merchants.length}
            </div>
            <div style={{ fontSize: '12px', color: '#a78bfa', marginTop: '4px' }}>
              {stats?.approvedClients ?? 0} approved • {stats?.pendingClients ?? 0} pending
            </div>
          </div>

          <div
            onClick={() => navigateToTab('merchants', 'pending')}
            style={{
              backgroundColor: surface,
              border: stats?.pendingClients ? '1px solid rgba(245, 158, 11, 0.4)' : surfaceBorder,
              borderRadius: '20px',
              padding: '20px',
              boxShadow: cardShadow,
              cursor: 'pointer',
              transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: textSecondary }}>Pending Approvals</span>
              <AlertTriangle size={18} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: stats?.pendingClients ? '#f59e0b' : textPrimary }}>
              {stats?.pendingClients ?? 0}
            </div>
            <div style={{ fontSize: '12px', color: textSecondary, marginTop: '4px' }}>
              Requires superadmin authorization
            </div>
          </div>

          <div
            onClick={() => navigateToTab('transactions')}
            style={{
              backgroundColor: surface,
              border: surfaceBorder,
              borderRadius: '20px',
              padding: '20px',
              boxShadow: cardShadow,
              cursor: 'pointer',
              transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: textSecondary }}>Processed Volume</span>
              <DollarSign size={18} color="#10b981" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#34d399' }}>
              {(stats?.totalVolumeEgp ?? 0).toFixed(2)} EGP
            </div>
            <div style={{ fontSize: '12px', color: textSecondary, marginTop: '4px' }}>
              Across {stats?.confirmedTransactions ?? 0} confirmed payments
            </div>
          </div>

          <div
            onClick={() => navigateToTab('merchants')}
            style={{
              backgroundColor: surface,
              border: surfaceBorder,
              borderRadius: '20px',
              padding: '20px',
              boxShadow: cardShadow,
              cursor: 'pointer',
              transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: textSecondary }}>Active Detectors</span>
              <Smartphone size={18} color="#06b6d4" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8' }}>
              {stats?.onlineDetectors ?? 0}
            </div>
            <div style={{ fontSize: '12px', color: textSecondary, marginTop: '4px' }}>
              {stats?.totalDetectors ?? 0} registered Android listeners
            </div>
          </div>
        </div>

        <div className="admin-overview-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, .65fr)', gap: '18px', marginBottom: '18px' }}>
          <section style={{ backgroundColor: surface, border: surfaceBorder, borderRadius: '20px', padding: '20px', boxShadow: cardShadow }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, color: textPrimary, fontSize: '16px', fontWeight: 800 }}>Operational health</h3>
                <p style={{ margin: '4px 0 0', color: textSecondary, fontSize: '12px' }}>Live availability across critical gateway services</p>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', backgroundColor: 'rgba(16,185,129,.12)', color: '#34d399', fontSize: '11px', fontWeight: 700 }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} /> Live
              </span>
            </div>
            {[
              { label: 'Approved merchant access', value: merchantAvailability, detail: `${stats?.activeClients ?? 0} of ${stats?.approvedClients ?? 0} active`, color: '#6366f1' },
              { label: 'Detector availability', value: detectorAvailability, detail: `${stats?.onlineDetectors ?? 0} of ${stats?.totalDetectors ?? 0} online`, color: '#0ea5e9' },
              { label: 'Recent webhook success', value: recentWebhookSuccessRate ?? 100, detail: recentWebhookSuccessRate === null ? 'No recent deliveries' : `${recentWebhookSuccessRate}% successful`, color: '#10b981' },
            ].map((health) => (
              <div key={health.label} style={{ marginBottom: '17px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '7px', fontSize: '12px' }}>
                  <span style={{ color: textPrimary, fontWeight: 650 }}>{health.label}</span>
                  <span style={{ color: textSecondary }}>{health.detail}</span>
                </div>
                <div style={{ height: '8px', borderRadius: '999px', overflow: 'hidden', backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                  <div style={{ width: `${Math.max(2, health.value)}%`, maxWidth: '100%', height: '100%', borderRadius: '999px', background: health.color, transition: 'width .35s ease' }} />
                </div>
              </div>
            ))}
            <button onClick={() => navigateToTab('webhooks')} style={{ padding: 0, marginTop: '2px', border: 0, background: 'transparent', color: '#38bdf8', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              Open delivery monitoring →
            </button>
          </section>

          <section style={{ backgroundColor: surface, border: surfaceBorder, borderRadius: '20px', padding: '20px', boxShadow: cardShadow }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: textPrimary, fontSize: '16px', fontWeight: 800 }}>Action center</h3>
              <p style={{ margin: '4px 0 0', color: textSecondary, fontSize: '12px' }}>Items that may need administrator attention</p>
            </div>
            {[
              { label: 'Merchant applications', count: stats?.pendingClients ?? 0, tone: '#f59e0b', action: () => navigateToTab('merchants', 'pending') },
              { label: 'Failed webhook deliveries', count: stats?.failedWebhooks ?? 0, tone: '#ef4444', action: () => navigateToTab('webhooks') },
              { label: 'Unmatched payments', count: stats?.unmatchedPayments ?? 0, tone: '#f97316', action: () => navigateToTab('transactions') },
              { label: 'Suspended merchants', count: stats?.suspendedClients ?? 0, tone: '#8b5cf6', action: () => navigateToTab('merchants', 'approved') },
            ].map((item) => (
              <button key={item.label} onClick={item.action} style={{ width: '100%', padding: '11px 0', border: 0, borderBottom: `1px solid ${isDark ? 'rgba(51,65,85,.45)' : '#eef2f7'}`, background: 'transparent', color: textPrimary, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12px', fontWeight: 600 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.tone }} /> {item.label}
                </span>
                <span style={{ minWidth: '28px', padding: '3px 8px', borderRadius: '999px', backgroundColor: `${item.tone}22`, color: item.tone, fontSize: '11px', fontWeight: 800 }}>{item.count}</span>
              </button>
            ))}
          </section>
        </div>

        <section style={{ backgroundColor: surface, border: surfaceBorder, borderRadius: '20px', boxShadow: cardShadow, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: `1px solid ${isDark ? 'rgba(51,65,85,.5)' : '#e2e8f0'}` }}>
            <div>
              <h3 style={{ margin: 0, color: textPrimary, fontSize: '16px', fontWeight: 800 }}>Recent payment activity</h3>
              <p style={{ margin: '4px 0 0', color: textSecondary, fontSize: '12px' }}>Latest transactions processed across all merchants</p>
            </div>
            <button onClick={() => navigateToTab('transactions')} style={{ border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: textPrimary, borderRadius: '9px', padding: '8px 11px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>View all transactions</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: isDark ? '#162033' : '#f8fafc' }}>
                {['Merchant', 'Session', 'Amount', 'Status', 'Created'].map((label) => <th key={label} style={{ padding: '11px 20px', color: textSecondary, fontSize: '10px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</th>)}
              </tr></thead>
              <tbody>
                {transactions.slice(0, 6).map((tx) => (
                  <tr key={tx.id} style={{ borderTop: `1px solid ${isDark ? 'rgba(51,65,85,.35)' : '#eef2f7'}` }}>
                    <td style={{ padding: '13px 20px', color: textPrimary, fontSize: '12px', fontWeight: 650 }}>{tx.client?.businessName || 'Unknown merchant'}</td>
                    <td style={{ padding: '13px 20px', color: '#38bdf8', fontSize: '11px', fontFamily: 'monospace' }}>{tx.sessionId}</td>
                    <td style={{ padding: '13px 20px', color: textPrimary, fontSize: '12px', fontWeight: 750 }}>{Number(tx.amountEgp).toFixed(2)} EGP</td>
                    <td style={{ padding: '13px 20px' }}><span style={{ padding: '3px 8px', borderRadius: '999px', backgroundColor: tx.status === 'CONFIRMED' ? 'rgba(16,185,129,.13)' : 'rgba(245,158,11,.13)', color: tx.status === 'CONFIRMED' ? '#34d399' : '#fbbf24', fontSize: '10px', fontWeight: 800 }}>{tx.status}</span></td>
                    <td style={{ padding: '13px 20px', color: textSecondary, fontSize: '11px' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {transactions.length === 0 && <tr><td colSpan={5} style={{ padding: '32px', color: textSecondary, textAlign: 'center', fontSize: '12px' }}>No payment activity recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── TAB 1: MERCHANTS & APPROVALS ─────────────────────────── */}
        </>
        )}

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
                            {isApproved && !m.isActive && (
                              <div style={{ marginTop: '5px', fontSize: '10px', fontWeight: 800, color: '#f87171' }}>
                                SUSPENDED
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#cbd5e1' }}>
                            {m.detectorDevices?.[0] && Date.now() - new Date(m.detectorDevices[0].lastSeenAt).getTime() <= 5 * 60 * 1000 ? (
                              <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={14} /> Online
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>
                                {m.detectorDevices?.length ? 'Offline' : 'Not paired'}
                              </span>
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
                                  onClick={() => handleSelectMerchant(m)}
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
                                  Manage
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
                  const offerActive = !isTrial && !isEnterprise && p.offerPriceEgp !== null && p.offerEndsAt && new Date(p.offerEndsAt).getTime() > Date.now() && p.offerPriceEgp < p.priceEgp;
                  const offerPercent = offerActive ? Math.round(((p.priceEgp - p.offerPriceEgp) / p.priceEgp) * 100) : 0;
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
                          onClick={() => openEditPlan(p)}
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
                        {offerActive && <div style={{ display: 'inline-flex', marginBottom: '7px', padding: '3px 8px', borderRadius: '999px', background: 'rgba(236,72,153,.14)', color: '#f472b6', fontSize: '10px', fontWeight: 850 }}>{p.offerLabel || 'Limited-time offer'} • {offerPercent}% OFF</div>}
                        {offerActive && <div style={{ color: '#64748b', fontSize: '12px', textDecoration: 'line-through' }}>{p.priceEgp} EGP</div>}
                        <span
                          style={{
                            fontSize: isEnterprise ? '24px' : '32px',
                            fontWeight: 900,
                            color: isTrial ? '#10b981' : isEnterprise ? '#f59e0b' : '#38bdf8',
                          }}
                        >
                          {isEnterprise ? 'Contact Sales' : offerActive ? p.offerPriceEgp : p.priceEgp}
                        </span>
                        <span style={{ fontSize: '14px', color: '#94a3b8', marginLeft: '4px' }}>
                          {isTrial
                            ? 'EGP (Free Trial)'
                            : isEnterprise
                            ? '(Customer Service / Custom)'
                            : `EGP / ${p.periodDays || 30} days`}
                        </span>
                        {offerActive && <div style={{ marginTop: '5px', color: '#94a3b8', fontSize: '10px' }}>Offer ends {new Date(p.offerEndsAt).toLocaleString()}</div>}
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

            <section style={{ marginTop: '10px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={18} color="#a855f7" /><h4 style={{ fontSize: '18px', fontWeight: 800, color: textPrimary, margin: 0 }}>Private enterprise offers</h4></div>
                  <p style={{ fontSize: '12px', color: textSecondary, margin: '5px 0 0' }}>Prepare company-specific pricing, capacity, and contract periods for high-volume merchants.</p>
                </div>
                <button type="button" onClick={openNewSpecialOffer} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 15px', border: 0, borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed, #ec4899)', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}><Sparkles size={14} /> Create special offer</button>
              </div>
              {specialOffers.length === 0 ? (
                <div style={{ padding: '30px', borderRadius: '18px', border: surfaceBorder, backgroundColor: surface, color: textSecondary, textAlign: 'center', boxShadow: cardShadow }}>No private offers yet. Create one for an approved large-company merchant.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px' }}>
                  {specialOffers.map((offer) => {
                    const expired = new Date(offer.validUntil).getTime() <= Date.now();
                    const effectiveStatus = expired && offer.status === 'ACTIVE' ? 'EXPIRED' : offer.status;
                    const statusColor = effectiveStatus === 'ACTIVE' ? '#34d399' : effectiveStatus === 'ACCEPTED' ? '#38bdf8' : '#94a3b8';
                    return (
                      <article key={offer.id} style={{ padding: '20px', borderRadius: '18px', border: isDark ? '1px solid rgba(168,85,247,.35)' : '1px solid #e9d5ff', background: isDark ? 'linear-gradient(135deg, rgba(124,58,237,.1), #111827)' : 'linear-gradient(135deg, #faf5ff, #fff)', boxShadow: cardShadow }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}><div><div style={{ color: '#a855f7', fontSize: '10px', fontWeight: 900 }}>{offer.client?.businessName}</div><h5 style={{ color: textPrimary, fontSize: '16px', margin: '5px 0' }}>{offer.title}</h5><div style={{ color: textSecondary, fontSize: '11px' }}>{offer.client?.email}</div></div><span style={{ height: 'fit-content', padding: '4px 8px', borderRadius: '999px', backgroundColor: `${statusColor}22`, color: statusColor, fontSize: '9px', fontWeight: 900 }}>{effectiveStatus}</span></div>
                        <p style={{ color: textSecondary, fontSize: '11px', minHeight: '34px', lineHeight: 1.5 }}>{offer.description || 'Custom enterprise commercial proposal.'}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px', margin: '14px 0' }}>
                          <div style={{ padding: '9px', borderRadius: '9px', backgroundColor: isDark ? '#162033' : '#fff' }}><small style={{ color: textSecondary }}>PRICE</small><strong style={{ display: 'block', color: '#a855f7', fontSize: '12px' }}>{offer.priceEgp} EGP</strong></div>
                          <div style={{ padding: '9px', borderRadius: '9px', backgroundColor: isDark ? '#162033' : '#fff' }}><small style={{ color: textSecondary }}>TX LIMIT</small><strong style={{ display: 'block', color: textPrimary, fontSize: '12px' }}>{Number(offer.maxTransactions).toLocaleString()}</strong></div>
                          <div style={{ padding: '9px', borderRadius: '9px', backgroundColor: isDark ? '#162033' : '#fff' }}><small style={{ color: textSecondary }}>PERIOD</small><strong style={{ display: 'block', color: textPrimary, fontSize: '12px' }}>{offer.periodDays} days</strong></div>
                        </div>
                        <div style={{ color: textSecondary, fontSize: '10px', marginBottom: '12px' }}>Valid until {new Date(offer.validUntil).toLocaleDateString()}</div>
                        {offer.status !== 'ACCEPTED' && <div style={{ display: 'flex', gap: '8px' }}><button type="button" onClick={() => setEditingOffer({ ...offer, validDays: 14 })} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary, cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>Edit</button><button type="button" disabled={offerSaving} onClick={() => handleOfferStatus(offer, offer.status === 'ACTIVE' ? 'REVOKED' : 'ACTIVE')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 0, backgroundColor: offer.status === 'ACTIVE' ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)', color: offer.status === 'ACTIVE' ? '#f87171' : '#34d399', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>{offer.status === 'ACTIVE' ? 'Revoke' : 'Restore'}</button></div>}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {editingOffer && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 10000, padding: '20px', backgroundColor: 'rgba(2,6,23,.78)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <form onSubmit={handleSaveSpecialOffer} style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '20px', backgroundColor: surface, border: surfaceBorder, boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}><div><h3 style={{ margin: 0, color: textPrimary, fontSize: '18px' }}>{editingOffer.id ? 'Edit enterprise offer' : 'Create enterprise offer'}</h3><p style={{ margin: '4px 0 0', color: textSecondary, fontSize: '12px' }}>This proposal will only be visible to the selected merchant.</p></div><button type="button" onClick={() => setEditingOffer(null)} style={{ border: 0, background: 'transparent', color: textSecondary, fontSize: '20px', cursor: 'pointer' }}>×</button></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
                    <label style={{ color: textSecondary, fontSize: '11px' }}>Company<select required disabled={Boolean(editingOffer.id)} value={editingOffer.clientId} onChange={(e) => setEditingOffer({ ...editingOffer, clientId: e.target.value })} style={{ width: '100%', marginTop: '5px', padding: '10px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }}><option value="">Select approved merchant</option>{merchants.filter((m) => m.approvalStatus === 'APPROVED').map((m) => <option key={m.id} value={m.id}>{m.businessName} — {m.email}</option>)}</select></label>
                    <label style={{ color: textSecondary, fontSize: '11px' }}>Offer title<input required maxLength={120} value={editingOffer.title} onChange={(e) => setEditingOffer({ ...editingOffer, title: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }} /></label>
                    <label style={{ color: textSecondary, fontSize: '11px' }}>Custom price (EGP)<input required type="number" min={1} value={editingOffer.priceEgp} onChange={(e) => setEditingOffer({ ...editingOffer, priceEgp: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }} /></label>
                    <label style={{ color: textSecondary, fontSize: '11px' }}>Transaction allowance<input required type="number" min={1} value={editingOffer.maxTransactions} onChange={(e) => setEditingOffer({ ...editingOffer, maxTransactions: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }} /></label>
                    <label style={{ color: textSecondary, fontSize: '11px' }}>Subscription duration (days)<input required type="number" min={1} max={3650} value={editingOffer.periodDays} onChange={(e) => setEditingOffer({ ...editingOffer, periodDays: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }} /></label>
                    <label style={{ color: textSecondary, fontSize: '11px' }}>Offer valid for (days)<input required type="number" min={1} max={365} value={editingOffer.validDays} onChange={(e) => setEditingOffer({ ...editingOffer, validDays: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }} /></label>
                  </div>
                  <label style={{ display: 'block', marginTop: '14px', color: textSecondary, fontSize: '11px' }}>Proposal details<textarea rows={4} maxLength={1000} value={editingOffer.description || ''} onChange={(e) => setEditingOffer({ ...editingOffer, description: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary, resize: 'vertical' }} /></label>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '9px', marginTop: '20px' }}><button type="button" onClick={() => setEditingOffer(null)} style={{ padding: '9px 14px', borderRadius: '9px', border: surfaceBorder, background: 'transparent', color: textSecondary, cursor: 'pointer' }}>Cancel</button><button type="submit" disabled={offerSaving} style={{ padding: '9px 16px', borderRadius: '9px', border: 0, background: 'linear-gradient(135deg, #7c3aed, #ec4899)', color: '#fff', fontWeight: 750, cursor: 'pointer' }}>{offerSaving ? 'Saving...' : editingOffer.id ? 'Save offer' : 'Send private offer'}</button></div>
                </form>
              </div>
            )}

            <section style={{ marginTop: '10px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Gift size={18} color="#38bdf8" />
                    <h4 style={{ fontSize: '18px', fontWeight: 800, color: textPrimary, margin: 0 }}>Extra transaction bundles</h4>
                  </div>
                  <p style={{ fontSize: '12px', color: textSecondary, margin: '5px 0 0' }}>
                    Control the top-up packs shown in merchant billing, including capacity, price, order, and availability.
                  </p>
                </div>
                <button type="button" onClick={openNewBundle} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 15px', border: 0, borderRadius: '10px', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 5px 14px rgba(14,165,233,.28)' }}>
                  <Gift size={14} /> Create bundle
                </button>
              </div>

              {bundles.length === 0 ? (
                <div style={{ padding: '36px', border: surfaceBorder, borderRadius: '18px', backgroundColor: surface, color: textSecondary, textAlign: 'center', boxShadow: cardShadow }}>
                  No extra bundles configured. Create the first bundle to make it available in merchant billing.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {bundles.map((bundle) => (
                    <article key={bundle.id} style={{ padding: '20px', borderRadius: '18px', border: bundle.isActive ? surfaceBorder : '1px dashed rgba(148,163,184,.45)', backgroundColor: surface, boxShadow: cardShadow, opacity: bundle.isActive ? 1 : .72 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div>
                          <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 800, letterSpacing: '.06em' }}>{bundle.name}</span>
                          <h5 style={{ margin: '4px 0 0', color: textPrimary, fontSize: '17px', fontWeight: 800 }}>{bundle.displayName}</h5>
                        </div>
                        <span style={{ padding: '4px 8px', borderRadius: '999px', backgroundColor: bundle.isActive ? 'rgba(16,185,129,.13)' : 'rgba(148,163,184,.13)', color: bundle.isActive ? '#34d399' : textSecondary, fontSize: '10px', fontWeight: 800 }}>
                          {bundle.isActive ? 'LIVE' : 'HIDDEN'}
                        </span>
                      </div>
                      <div style={{ margin: '18px 0 5px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ color: '#38bdf8', fontSize: '28px', fontWeight: 900 }}>{bundle.priceEgp}</span>
                        <span style={{ color: textSecondary, fontSize: '12px' }}>EGP</span>
                      </div>
                      <div style={{ color: textPrimary, fontSize: '14px', fontWeight: 750 }}>+{Number(bundle.extraTx).toLocaleString()} transactions</div>
                      <p style={{ minHeight: '34px', color: textSecondary, fontSize: '11px', lineHeight: 1.5, margin: '8px 0 16px' }}>{bundle.description || 'No merchant-facing description.'}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', padding: '10px', borderRadius: '10px', backgroundColor: isDark ? '#162033' : '#f8fafc', marginBottom: '14px' }}>
                        <div><div style={{ color: textSecondary, fontSize: '9px' }}>PURCHASES</div><strong style={{ color: textPrimary, fontSize: '12px' }}>{bundle.confirmedPurchaseCount || 0}</strong></div>
                        <div><div style={{ color: textSecondary, fontSize: '9px' }}>REVENUE</div><strong style={{ color: textPrimary, fontSize: '12px' }}>{Number(bundle.confirmedRevenueEgp || 0).toFixed(0)} EGP</strong></div>
                        <div><div style={{ color: textSecondary, fontSize: '9px' }}>GRANTED</div><strong style={{ color: textPrimary, fontSize: '12px' }}>{Number(bundle.grantedTransactions || 0).toLocaleString()}</strong></div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={() => setEditingBundle({ ...bundle })} style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: textPrimary, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}><Edit2 size={12} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Edit</button>
                        <button type="button" disabled={bundleSaving} onClick={() => handleToggleBundle(bundle)} style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: bundle.isActive ? '1px solid rgba(239,68,68,.35)' : '1px solid rgba(16,185,129,.35)', backgroundColor: bundle.isActive ? 'rgba(239,68,68,.08)' : 'rgba(16,185,129,.08)', color: bundle.isActive ? '#f87171' : '#34d399', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>{bundle.isActive ? 'Hide' : 'Publish'}</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {editingBundle && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 10000, padding: '20px', backgroundColor: 'rgba(2,6,23,.78)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <form onSubmit={handleSaveBundle} style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '20px', backgroundColor: surface, border: surfaceBorder, boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
                    <div><h3 style={{ margin: 0, color: textPrimary, fontSize: '18px' }}>{editingBundle.id ? 'Edit extra bundle' : 'Create extra bundle'}</h3><p style={{ margin: '4px 0 0', color: textSecondary, fontSize: '12px' }}>Changes affect the bundle catalog shown on merchant billing pages.</p></div>
                    <button type="button" onClick={() => setEditingBundle(null)} style={{ border: 0, background: 'transparent', color: textSecondary, cursor: 'pointer', fontSize: '20px' }}>×</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
                    <label style={{ color: textSecondary, fontSize: '11px' }}>Bundle key<input required disabled={Boolean(editingBundle.id)} value={editingBundle.name} onChange={(e) => setEditingBundle({ ...editingBundle, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} placeholder="GROWTH_PACK" style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px 12px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }} /></label>
                    <label style={{ color: textSecondary, fontSize: '11px' }}>Display name<input required maxLength={80} value={editingBundle.displayName} onChange={(e) => setEditingBundle({ ...editingBundle, displayName: e.target.value })} placeholder="Growth Pack" style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px 12px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }} /></label>
                    <label style={{ color: textSecondary, fontSize: '11px' }}>Price (EGP)<input required type="number" min={0.01} step={0.01} value={editingBundle.priceEgp} onChange={(e) => setEditingBundle({ ...editingBundle, priceEgp: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px 12px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }} /></label>
                    <label style={{ color: textSecondary, fontSize: '11px' }}>Extra transactions<input required type="number" min={1} value={editingBundle.extraTx} onChange={(e) => setEditingBundle({ ...editingBundle, extraTx: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px 12px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }} /></label>
                    <label style={{ color: textSecondary, fontSize: '11px' }}>Display order<input required type="number" min={0} value={editingBundle.sortOrder} onChange={(e) => setEditingBundle({ ...editingBundle, sortOrder: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px 12px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }} /></label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '9px', alignSelf: 'end', minHeight: '39px', color: textPrimary, fontSize: '12px', cursor: 'pointer' }}><input type="checkbox" checked={editingBundle.isActive !== false} onChange={(e) => setEditingBundle({ ...editingBundle, isActive: e.target.checked })} style={{ width: '17px', height: '17px', accentColor: '#2563eb' }} />Visible in merchant billing</label>
                  </div>
                  <label style={{ display: 'block', marginTop: '14px', color: textSecondary, fontSize: '11px' }}>Merchant-facing description<textarea maxLength={500} rows={3} value={editingBundle.description || ''} onChange={(e) => setEditingBundle({ ...editingBundle, description: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', marginTop: '5px', padding: '10px 12px', borderRadius: '9px', border: surfaceBorder, backgroundColor: isDark ? '#1e293b' : '#fff', color: textPrimary }} /></label>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '9px', marginTop: '20px' }}>
                    <button type="button" onClick={() => setEditingBundle(null)} style={{ padding: '9px 14px', borderRadius: '9px', border: surfaceBorder, backgroundColor: 'transparent', color: textSecondary, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={bundleSaving} style={{ padding: '9px 16px', borderRadius: '9px', border: 0, backgroundColor: '#2563eb', color: '#fff', fontWeight: 750, cursor: 'pointer' }}>{bundleSaving ? 'Saving...' : editingBundle.id ? 'Save bundle' : 'Create bundle'}</button>
                  </div>
                </form>
              </div>
            )}

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
                    maxHeight: '90vh',
                    overflowY: 'auto',
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
                    {editingPlan.name !== 'FREE_TRIAL' && editingPlan.name !== 'ENTERPRISE' && (
                      <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid rgba(236,72,153,.3)', background: 'rgba(236,72,153,.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                          <div><div style={{ fontSize: '13px', fontWeight: 800, color: '#f472b6' }}>Plan promotion</div><div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Leave the offer price empty to use the regular price.</div></div>
                          {editingPlan.offerPriceEgp !== '' && editingPlan.offerPriceEgp !== null && <button type="button" onClick={() => setEditingPlan({ ...editingPlan, offerPriceEgp: '' })} style={{ border: '1px solid rgba(248,113,113,.35)', borderRadius: '7px', padding: '5px 8px', background: 'rgba(239,68,68,.1)', color: '#f87171', cursor: 'pointer', fontSize: '10px', fontWeight: 700 }}>Remove offer</button>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <label style={{ fontSize: '11px', color: '#94a3b8' }}>Offer price (EGP)<input type="number" min="0.01" step="0.01" max={Math.max(0.01, Number(editingPlan.priceEgp) - 0.01)} value={editingPlan.offerPriceEgp ?? ''} onChange={(e) => setEditingPlan({ ...editingPlan, offerPriceEgp: e.target.value })} placeholder="No offer" style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '9px', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,.1)', borderRadius: '8px', color: '#fff' }} /></label>
                          <label style={{ fontSize: '11px', color: '#94a3b8' }}>Valid for days<input type="number" min="1" max="365" value={editingPlan.offerValidDays ?? 7} onChange={(e) => setEditingPlan({ ...editingPlan, offerValidDays: e.target.value })} disabled={editingPlan.offerPriceEgp === '' || editingPlan.offerPriceEgp === null} style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '9px', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,.1)', borderRadius: '8px', color: '#fff', opacity: editingPlan.offerPriceEgp === '' || editingPlan.offerPriceEgp === null ? .5 : 1 }} /></label>
                        </div>
                        <label style={{ display: 'block', marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>Offer label<input type="text" maxLength={80} value={editingPlan.offerLabel ?? ''} onChange={(e) => setEditingPlan({ ...editingPlan, offerLabel: e.target.value })} disabled={editingPlan.offerPriceEgp === '' || editingPlan.offerPriceEgp === null} placeholder="e.g. Summer sale" style={{ width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '9px', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,.1)', borderRadius: '8px', color: '#fff', opacity: editingPlan.offerPriceEgp === '' || editingPlan.offerPriceEgp === null ? .5 : 1 }} /></label>
                      </div>
                    )}
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
                maxWidth: '920px',
                maxHeight: '90vh',
                overflowY: 'auto',
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
                  {selectedMerchant.businessName} - Control Center
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

              {overviewLoading ? (
                <div style={{ padding: '18px', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={16} className="animate-spin" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  Loading live merchant health...
                </div>
              ) : merchantOverview && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                    {[
                      { label: 'Account access', value: selectedMerchant.isActive ? 'Active' : 'Suspended', color: selectedMerchant.isActive ? '#34d399' : '#f87171' },
                      { label: 'Detector health', value: `${merchantOverview.detectorOnlineCount} / ${merchantOverview.detectorDevices.length} online`, color: merchantOverview.detectorOnlineCount ? '#38bdf8' : '#fbbf24' },
                      { label: 'Active sessions', value: String(merchantOverview.activeSessions), color: '#c084fc' },
                      { label: 'Confirmed volume', value: `${merchantOverview.confirmedVolumeEgp.toFixed(2)} EGP`, color: '#34d399' },
                      { label: 'Webhook success', value: merchantOverview.webhookSuccessRate === null ? 'No deliveries' : `${merchantOverview.webhookSuccessRate}%`, color: merchantOverview.webhookSuccessRate !== null && merchantOverview.webhookSuccessRate >= 90 ? '#34d399' : '#fbbf24' },
                    ].map((metric) => (
                      <div key={metric.label} style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,.07)' }}>
                        <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>{metric.label}</div>
                        <div style={{ color: metric.color, fontSize: '14px', fontWeight: 800, marginTop: '5px' }}>{metric.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#0f172a', fontSize: '12px', color: '#cbd5e1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 700, marginBottom: '7px' }}><Activity size={14} /> Payment monitoring</div>
                      <div>{merchantOverview.totalTransactions} total • {merchantOverview.transactionsByStatus.CONFIRMED || 0} confirmed • {merchantOverview.unmatchedPayments} unmatched</div>
                      <div style={{ color: '#64748b', marginTop: '5px' }}>Latest: {merchantOverview.latestTransaction ? `${merchantOverview.latestTransaction.status} • ${merchantOverview.latestTransaction.amountEgp.toFixed(2)} EGP • ${new Date(merchantOverview.latestTransaction.createdAt).toLocaleString()}` : 'No transactions'}</div>
                    </div>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#0f172a', fontSize: '12px', color: '#cbd5e1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 700, marginBottom: '7px' }}><Wifi size={14} /> Integration activity</div>
                      <div>API last used: {merchantOverview.apiKeyLastUsedAt ? new Date(merchantOverview.apiKeyLastUsedAt).toLocaleString() : 'Never'}</div>
                      <div style={{ marginTop: '4px' }}>Detector last used: {merchantOverview.detectTokenLastUsedAt ? new Date(merchantOverview.detectTokenLastUsedAt).toLocaleString() : 'Never'}</div>
                      <div style={{ color: '#64748b', marginTop: '5px' }}>{merchantOverview.webhookSuccess} / {merchantOverview.webhookTotal} webhook deliveries succeeded</div>
                    </div>
                  </div>
                </>
              )}

              <h4 style={{ margin: '0 0 10px', fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '.06em' }}>Integration credentials</h4>

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

              <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '.06em' }}>Merchant controls</h4>
                <form onSubmit={handleAssignMerchantPlan} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '8px', alignItems: 'end' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Plan
                    <select value={merchantPlan} onChange={(e) => setMerchantPlan(e.target.value)} style={{ width: '100%', display: 'block', marginTop: '5px', padding: '9px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}>
                      {plans.map((plan) => <option key={plan.name} value={plan.name}>{plan.name}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Transaction limit
                    <input type="number" min={1} max={10000000} required value={merchantTxLimit} onChange={(e) => setMerchantTxLimit(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', display: 'block', marginTop: '5px', padding: '9px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }} />
                  </label>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Valid for days
                    <input type="number" min={1} max={3650} required value={merchantExtendDays} onChange={(e) => setMerchantExtendDays(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', display: 'block', marginTop: '5px', padding: '9px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }} />
                  </label>
                  <button type="submit" disabled={merchantAction !== null} style={{ padding: '10px 14px', border: 0, borderRadius: '8px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                    {merchantAction === 'plan' ? 'Saving...' : 'Apply plan'}
                  </button>
                </form>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                  {selectedMerchant.approvalStatus === 'APPROVED' && (
                    <button onClick={handleMerchantAccess} disabled={merchantAction !== null} style={{ padding: '9px 12px', borderRadius: '8px', border: `1px solid ${selectedMerchant.isActive ? 'rgba(239,68,68,.45)' : 'rgba(16,185,129,.45)'}`, background: selectedMerchant.isActive ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)', color: selectedMerchant.isActive ? '#f87171' : '#34d399', cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      <Power size={14} /> {merchantAction === 'access' ? 'Updating...' : selectedMerchant.isActive ? 'Suspend access' : 'Reactivate access'}
                    </button>
                  )}
                  <button onClick={handleRevokeSessions} disabled={merchantAction !== null} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: '#cbd5e1', cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                    <Lock size={14} /> {merchantAction === 'sessions' ? 'Revoking...' : 'Sign out all sessions'}
                  </button>
                  <button onClick={handleRotateMerchantKeys} disabled={merchantAction !== null || selectedMerchant.approvalStatus !== 'APPROVED'} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(245,158,11,.4)', background: 'rgba(245,158,11,.1)', color: '#fbbf24', cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center', opacity: selectedMerchant.approvalStatus === 'APPROVED' ? 1 : .5 }}>
                    <RotateCcw size={14} /> {merchantAction === 'keys' ? 'Rotating...' : 'Rotate all credentials'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '9px' }}>
                  Subscription ends: {merchantOverview?.subscriptionEndsAt ? new Date(merchantOverview.subscriptionEndsAt).toLocaleString() : 'Not set'} • Checkout timeout: {merchantOverview?.checkoutTtlMin ?? '—'} minutes
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
        </div>
      </main>
      </div>
    </div>
  );
}
