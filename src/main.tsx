import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { CheckoutPayPage } from "./pages/CheckoutPayPage.tsx";
import { AdminPortalPage } from "./pages/AdminPortalPage.tsx";
import { LanguageProvider } from "./context/LanguageContext.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/pay" element={<CheckoutPayPage />} />
            <Route path="/pay/:sessionId" element={<CheckoutPayPage />} />
            <Route path="/admin" element={<AdminPortalPage />} />
            <Route path="/portal/admin" element={<AdminPortalPage />} />
            <Route path="*" element={<App />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
