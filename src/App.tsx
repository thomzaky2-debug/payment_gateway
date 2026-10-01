import { useState, useEffect } from 'react';
import { authApi } from './services/api';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Toast } from './components/Toast';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useTheme } from './context/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReviewPage } from './pages/ReviewPage';
import { DetectorPage } from './pages/DetectorPage';
import { DevelopersPage } from './pages/DevelopersPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SecurityPage } from './pages/SecurityPage';
import { BillingPage } from './pages/BillingPage';

export type Page = 'overview' | 'transactions' | 'review' | 'billing' | 'detector' | 'developers' | 'settings' | 'audit' | 'security';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface ConfirmAction {
  id: string;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
}

export function parseRouteFromHash(hashString?: string): { page: Page; subPath?: string } {
  const raw = (hashString !== undefined ? hashString : (typeof window !== 'undefined' ? window.location.hash : '')) || '';
  const clean = raw.replace(/^#\/?/, '').trim();
  if (!clean) {
    return { page: 'overview' };
  }

  const parts = clean.split('/').filter(Boolean);
  const rawPage = parts[0]?.toLowerCase();
  const subPath = parts.slice(1).join('/');

  const validPages: Record<string, Page> = {
    overview: 'overview',
    transactions: 'transactions',
    tx: 'transactions',
    review: 'review',
    queue: 'review',
    billing: 'billing',
    detector: 'detector',
    developers: 'developers',
    developer: 'developers',
    settings: 'settings',
    audit: 'audit',
    security: 'security',
  };

  const page = validPages[rawPage] || 'overview';
  return { page, subPath: subPath || undefined };
}

export function buildHash(page: Page, subPath?: string): string {
  if (subPath && subPath.trim()) {
    return `#${page}/${subPath.trim()}`;
  }
  return `#${page}/`;
}

function App() {
  const initialRoute = parseRouteFromHash();
  const [currentPage, setCurrentPage] = useState<Page>(() => initialRoute.page);
  const [currentSubPath, setCurrentSubPath] = useState<string | undefined>(() => initialRoute.subPath);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(() => {
    try {
      return Boolean(localStorage.getItem('instapay_merchant_token'));
    } catch {
      return false;
    }
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmAction | null>(null);
  const [currentClient, setCurrentClient] = useState<any>(null);

  useEffect(() => {
    authApi
      .getSession()
      .then((res) => {
        if (res?.authenticated && res?.client) {
          setIsAuthenticated(true);
          setCurrentClient(res.client);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => {
        setIsCheckingAuth(false);
      });
  }, []);

  // Ensure valid URL hash on mount if none is set
  useEffect(() => {
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      const targetHash = buildHash(currentPage, currentSubPath);
      window.history.replaceState(null, '', targetHash);
    }
  }, []);

  // Listen to browser Back/Forward or manual URL hash modifications
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseRouteFromHash();
      setCurrentPage((prev) => (prev !== route.page ? route.page : prev));
      setCurrentSubPath((prev) => (prev !== route.subPath ? route.subPath : prev));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (page: Page, subPath?: string) => {
    const targetHash = buildHash(page, subPath);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
    setCurrentPage(page);
    setCurrentSubPath(subPath);
  };

  const handleSubPathChange = (subPath?: string) => {
    const targetHash = buildHash(currentPage, subPath);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
    setCurrentSubPath(subPath);
  };

  const showToast = (type: ToastMessage['type'], message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const showConfirm = (action: Omit<ConfirmAction, 'id'>) => {
    const id = Date.now().toString();
    setConfirmDialog({ ...action, id });
  };

  const closeConfirm = () => setConfirmDialog(null);

  const handleLogin = () => {
    authApi
      .getSession()
      .then((res) => {
        if (res?.client) setCurrentClient(res.client);
      })
      .catch(() => {});
    setIsAuthenticated(true);
    showToast('success', 'Welcome back! You are now logged in.');
  };

  const handleLogout = () => {
    showConfirm({
      title: 'Logout Confirmation',
      message: 'Are you sure you want to logout? You will need to sign in again to access your dashboard.',
      confirmLabel: 'Logout',
      cancelLabel: 'Cancel',
      variant: 'warning',
      onConfirm: async () => {
        await authApi.logout().catch(() => {});
        setIsAuthenticated(false);
        setCurrentClient(null);
        navigateTo('overview');
        closeConfirm();
        showToast('info', 'You have been logged out successfully.');
      },
    });
  };

  if (isCheckingAuth) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#090d16',
          color: '#38bdf8',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            border: '3px solid rgba(56, 189, 248, 0.2)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLogin={handleLogin} showToast={showToast} />
        <Toast toasts={toasts} onDismiss={(id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      </>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage showToast={showToast} onNavigate={navigateTo} />;
      case 'transactions':
        return (
          <TransactionsPage
            showToast={showToast}
            subPath={currentSubPath}
            onSubPathChange={handleSubPathChange}
          />
        );
      case 'review':
        return (
          <ReviewPage
            showToast={showToast}
            showConfirm={showConfirm}
            onNavigate={navigateTo}
            subPath={currentSubPath}
            onSubPathChange={handleSubPathChange}
          />
        );
      case 'billing':
        return <BillingPage showToast={showToast} />;
      case 'detector':
        return <DetectorPage showToast={showToast} />;
      case 'developers':
        return <DevelopersPage showToast={showToast} showConfirm={showConfirm} />;
      case 'settings':
        return (
          <SettingsPage
            showToast={showToast}
            subPath={currentSubPath}
            onSubPathChange={handleSubPathChange}
          />
        );
      case 'audit':
        return <AuditLogPage showToast={showToast} />;
      case 'security':
        return <SecurityPage showToast={showToast} showConfirm={showConfirm} />;
      default:
        return <OverviewPage showToast={showToast} onNavigate={navigateTo} />;
    }
  };

  const { isDark } = useTheme();

  return (
    <div
      className="app-main-layout"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        backgroundColor: isDark ? '#090d16' : '#f1f5f9',
        color: isDark ? '#f8fafc' : '#1e293b',
        overflow: 'hidden',
        transition: 'background-color 0.25s ease, color 0.25s ease',
      }}
    >
      <Sidebar currentPage={currentPage} onNavigate={navigateTo} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Topbar client={currentClient} currentPage={currentPage} onLogout={handleLogout} onNavigate={navigateTo} />

        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
            backgroundColor: isDark ? '#090d16' : '#f1f5f9',
            transition: 'background-color 0.25s ease',
          }}
        >
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>{renderPage()}</div>
        </main>
      </div>

      <Toast toasts={toasts} onDismiss={(id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={closeConfirm}
        />
      )}
    </div>
  );
}

export default App;

