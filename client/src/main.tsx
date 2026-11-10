import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/fonts.css";
import "./index.css";
import "./styles/glass.css";
import "./i18n";
import { apiBase } from "./lib/queryClient";
import { getAuthToken } from "./lib/secureStorage";
import { createNativeApiFetch } from "./lib/native-fetch";

// Keep web/Cloudflare requests same-origin. Native builds use the configurable
// API base (VITE_NATIVE_API_BASE) because relative URLs point at app assets.
const originalFetch = window.fetch.bind(window);
window.fetch = createNativeApiFetch(originalFetch, apiBase, getAuthToken);

// Parche para Capacitor/APK: Evitar el error "404 Page Not Found" de wouter
// Capacitor suele cargar la app en http://localhost/index.html en lugar de http://localhost/
if (window.location.pathname === "/index.html") {
  window.history.replaceState(null, "", "/");
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// The worker only handles push notifications. Registering it in development
// makes Vite's HMR and error overlay harder to reason about, so keep it to
// production builds.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("ServiceWorker registrado:", registration.scope);
      })
      .catch((error) => {
        console.warn("ServiceWorker error:", error);
      });
  });
}
