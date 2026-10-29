import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

import { AuthProvider } from './context/AuthContext';
import { MaintenanceModeProvider } from './context/MaintenanceModeContext';

// Intercept harmless AbortError caused by media elements (<video>/<audio>) being unmounted while play() is pending
if (typeof window !== 'undefined' && window.HTMLMediaElement) {
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const playPromise = originalPlay.apply(this, arguments);
    if (playPromise && typeof playPromise.catch === 'function') {
      return playPromise.catch((error) => {
        if (
          error?.name === 'AbortError' ||
          (typeof error?.message === 'string' &&
            error.message.includes('interrupted because the media was removed'))
        ) {
          // Play was interrupted by DOM removal (component unmount or StrictMode remount); safely ignore
          return;
        }
        throw error;
      });
    }
    return playPromise;
  };

  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (
      error?.name === 'AbortError' ||
      (typeof error?.message === 'string' &&
        error.message.includes('interrupted because the media was removed'))
    ) {
      event.preventDefault();
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <MaintenanceModeProvider>
        <App />
      </MaintenanceModeProvider>
    </AuthProvider>
  </React.StrictMode>
);
