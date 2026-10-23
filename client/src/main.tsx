import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import "./styles/glass.css";
import "./i18n";
import { apiBase } from "./lib/queryClient";
import { getAuthToken } from "./lib/secureStorage";

// Keep web/Cloudflare requests same-origin. Native builds use the configurable
// API base (VITE_NATIVE_API_BASE) because relative URLs point at app assets.
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  let request: RequestInfo | URL = input;
  let url =
    typeof input === "string"
      ? input
      : input instanceof Request
        ? input.url
        : String(input);

  if (apiBase && url.startsWith("/api")) {
    url = `${apiBase}${url}`;
    request = url;
  }

  // El APK no comparte cookies de forma fiable: usa Authorization + almacenamiento
  // seguro del sistema. El navegador sigue usando solo la cookie HttpOnly.
  if (apiBase && url.includes("/api")) {
    const token = await getAuthToken();
    const headers = request instanceof Request
      ? new Headers(request.headers)
      : new Headers(init?.headers);
    headers.set("X-Client-Platform", "capacitor");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (request instanceof Request) {
      request = new Request(request, { headers });
    } else {
      init = { ...(init || {}), headers };
    }
  }

  return originalFetch(request, init);
};

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
