import React from 'react';
import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MobileNav } from './components/MobileNav';
import { OverviewPage } from './pages/OverviewPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReviewPage } from './pages/ReviewPage';
import { DetectorPage } from './pages/DetectorPage';
import { DevelopersPage } from './pages/DevelopersPage';
import { SettingsPage } from './pages/SettingsPage';

export type Page = 'overview' | 'transactions' | 'review' | 'detector' | 'developers' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'overview': return <OverviewPage />;
      case 'transactions': return <TransactionsPage />;
      case 'review': return <ReviewPage />;
      case 'detector': return <DetectorPage />;
      case 'developers': return <DevelopersPage />;
      case 'settings': return <SettingsPage />;
      default: return <OverviewPage />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
      {/* Desktop Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Mobile Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '12px 16px', 
          backgroundColor: 'white', 
          borderBottom: '1px solid #e2e8f0' 
        }} className="md:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{ padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>InstaPay Gateway</h1>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '50%', 
            backgroundColor: '#2563eb', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'white', 
            fontWeight: '600', 
            fontSize: '14px' 
          }}>
            M
          </div>
        </div>

        {/* Desktop Topbar */}
        <Topbar currentPage={currentPage} />

        {/* Page Content */}
        <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentPage={currentPage}
        onNavigate={(page: Page) => {
          setCurrentPage(page);
          setMobileMenuOpen(false);
        }}
      />
    </div>
  );
}

export default App;
