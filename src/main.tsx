import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyDemoBootParams } from './lib/demoMode'
import { syncPushSubscription } from './lib/pushClient'

// Apply ?demo=1 / ?demo=0 before anything reads the active user mode.
applyDemoBootParams()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => {
      // Refresh this device's push registration (timezone, rotated endpoints)
      void syncPushSubscription();
    }).catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
