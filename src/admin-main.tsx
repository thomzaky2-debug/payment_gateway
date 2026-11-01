import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdminPortalPage } from './pages/AdminPortalPage';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ThemeProvider><LanguageProvider><BrowserRouter><AdminPortalPage/></BrowserRouter></LanguageProvider></ThemeProvider></React.StrictMode>
);
