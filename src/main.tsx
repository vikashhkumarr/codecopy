import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fix for "Cannot set property fetch of #<Window> which has only a getter"
// This occurs when libraries try to polyfill fetch in environments where it's a read-only getter.
if (typeof window !== 'undefined') {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
    if (descriptor && !descriptor.writable && descriptor.configurable) {
      const originalFetch = window.fetch;
      Object.defineProperty(window, 'fetch', {
        writable: true,
        configurable: true,
        value: originalFetch
      });
    }
  } catch (e) {
    console.warn('Could not make window.fetch writable', e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
