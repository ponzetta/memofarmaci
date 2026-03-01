import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { AuthProvider } from './contexts/AuthContext.tsx';
import AppRouter from './components/AppRouter.tsx';
import './index.css';

// Quando Chrome (browser esterno) carica la SPA su /auth/callback dopo OAuth,
// redirect all'app tramite intent URL — Chrome su Android lo gestisce nativamente.
const _oauthCode = new URLSearchParams(window.location.search).get('code');
const _isCallback = window.location.pathname === '/auth/callback';

if (_isCallback && _oauthCode && !Capacitor.isNativePlatform()) {
  window.location.replace(
    `intent://login?code=${encodeURIComponent(_oauthCode)}` +
    `#Intent;scheme=it.memofarmaci.app;package=it.memofarmaci.app;end`
  );
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </StrictMode>,
  );

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      }).catch(error => {
        console.error('Service Worker registration failed:', error);
      });
    });
  }
}
