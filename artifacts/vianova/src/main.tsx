import { createRoot } from "react-dom/client";
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import App from "./App";
import "./index.css";
import "./i18n";
try {
  GoogleAuth.initialize({
    clientId: '963320565575-69dp01atb3oo5cmrhiq4uf2ca8fc2g79.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    grantOfflineAccess: true,
  });
} catch (_) {
}
// Inject auth token into all /api requests (works in web and Capacitor)
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
  const token = localStorage.getItem('auth_token');
  if (token && typeof url === 'string' && url.includes('/api')) {
    init = init || {};
    init.headers = {
      ...init.headers,
      'Authorization': `Bearer ${token}`,
    };
  }
  return originalFetch(input, init);
};

// Parche para Capacitor/APK: Evitar el error "404 Page Not Found" de wouter
// Capacitor suele cargar la app en http://localhost/index.html en lugar de http://localhost/
if (window.location.pathname === '/index.html') {
  window.history.replaceState(null, '', '/');
}

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registrado:', registration.scope);
    }).catch(error => {
      console.log('ServiceWorker error:', error);
    });
  });
}
