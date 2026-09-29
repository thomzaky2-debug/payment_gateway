import './index.css';
import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MobileNav } from './components/MobileNav';
import { Toast } from './components/Toast';
import { ConfirmDialog } from './components/ConfirmDialog';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReviewPage } from './pages/ReviewPage';
import { DetectorPage } from './pages/DetectorPage';
import { DevelopersPage } from './pages/DevelopersPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SecurityPage } from './pages/SecurityPage';

export type Page = 'overview' | 'transactions' | 'review' | 'detector' | 'developers' | 'settings' | 'audit' | 'security';

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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmAction | null>(null);

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
      onConfirm: () => {
        setIsAuthenticated(false);
        setCurrentPage('overview');
        closeConfirm();
        showToast('info', 'You have been logged out successfully.');
      },
    });
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} showToast={showToast} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage showToast={showToast} />;
      case 'transactions':
        return <TransactionsPage showToast={showToast} />;
      case 'review':
        return <ReviewPage showToast={showToast} showConfirm={showConfirm} />;
      case 'detector':
        return <DetectorPage showToast={showToast} />;
      case 'developers':
        return <DevelopersPage showToast={showToast} showConfirm={showConfirm} />;
      case 'settings':
        return <SettingsPage showToast={showToast} />;
      case 'audit':
        return <AuditLogPage />;
      case 'security':
        return <SecurityPage showToast={showToast} showConfirm={showConfirm} />;
      default:
        return <OverviewPage showToast={showToast} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div
          className="md:hidden"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'white',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{ padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
            aria-label="Open menu"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>InstaPay Gateway</h1>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '600',
              fontSize: '14px',
            }}
          >
            M
          </div>
        </div>

        <Topbar currentPage={currentPage} onLogout={handleLogout} />

        <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>{renderPage()}</div>
        </main>
      </div>

      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentPage={currentPage}
        onNavigate={(page) => {
          setCurrentPage(page);
          setMobileMenuOpen(false);
        }}
      />

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
