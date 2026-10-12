import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { CheckoutPayPage } from "./pages/CheckoutPayPage.tsx";
import { AdminPortalPage } from "./pages/AdminPortalPage.tsx";
import { ApiDocsPage } from "./pages/ApiDocsPage.tsx";
import { LanguageProvider } from "./context/LanguageContext.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";

const configuredAdminOrigin = (import.meta.env.VITE_ADMIN_URL || '').trim().replace(/\/+$/, '');
const isDedicatedAdminHost = (() => {
  if (!configuredAdminOrigin || typeof window === 'undefined') return false;
  try {
    return new URL(configuredAdminOrigin).origin === window.location.origin;
  } catch {
    return false;
  }
})();

function AdminPortalEntry() {
  if (configuredAdminOrigin && !isDedicatedAdminHost) {
    window.location.replace(`${configuredAdminOrigin}/`);
    return null;
  }
  return <AdminPortalPage />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            {isDedicatedAdminHost ? (
              <Route path="*" element={<AdminPortalPage />} />
            ) : (
              <>
                <Route path="/pay" element={<CheckoutPayPage />} />
                <Route path="/pay/:sessionId" element={<CheckoutPayPage />} />
                <Route path="/admin" element={<AdminPortalEntry />} />
                <Route path="/portal/admin" element={<AdminPortalEntry />} />
                <Route path="/docs" element={<ApiDocsPage />} />
                <Route path="/docs/*" element={<ApiDocsPage />} />
                <Route path="/api-docs" element={<ApiDocsPage />} />
                <Route path="/documentation" element={<ApiDocsPage />} />
                <Route path="*" element={<App />} />
              </>
            )}
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
