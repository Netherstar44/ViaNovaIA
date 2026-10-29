import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import AppLoader from "@/components/AppLoader";
import SmoothScroll from "@/components/SmoothScroll";
import AiOrb from "@/components/AiOrb";

// Carga diferida por ruta: el catálogo inicial no descarga dashboards, taxi,
// social, administración ni el visor 3D hasta que el usuario los visita.
const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const AccountSettings = lazy(() => import("@/pages/AccountSettings"));
const MyProducts = lazy(() => import("@/pages/MyProducts"));
const RoleSelection = lazy(() => import("@/pages/RoleSelection"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));

// ── TAXI ──────────────────────────────────────────────────────────────────────
const TaxiDashboard = lazy(() => import("@/pages/taxi/TaxiDashboard"));
const RideDetail = lazy(() => import("@/pages/taxi/RideDetail"));
const TaxiEarnings = lazy(() => import("@/pages/taxi/TaxiEarnings"));
const RequestRide = lazy(() => import("@/pages/taxi/RequestRide"));
const RideHistory = lazy(() => import("@/pages/RideHistory"));
const SocialFeed = lazy(() => import("@/pages/SocialFeed"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const Messages = lazy(() => import("@/pages/Messages"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const ProductManager = lazy(() => import("@/pages/ProductManager"));
const ProductStore = lazy(() => import("@/pages/ProductStore"));
const SeoLanding = lazy(() => import("@/pages/SeoLanding"));
const Chatbot = lazy(() => import("@/components/Chatbot"));
const MobileDock = lazy(() => import("@/components/MobileDock"));

function PageLoader() {
  return <AppLoader variant="route" />;
}

const BOOT_MIN_MS = 1400;
const BOOT_MAX_MS = 2400;

/**
 * Shows the brand splash while fonts, the shell chunk and first paint settle.
 * It never blocks for longer than BOOT_MAX_MS, and it skips the theatrics for
 * people who ask for reduced motion.
 */
function BootGate({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  // AnimatePresence keeps the exiting splash mounted until its exit tween ends.
  // Browsers throttle requestAnimationFrame in background windows, so the tween
  // can freeze forever. This layer is torn down unconditionally after the exit
  // window, which guarantees the overlay never blocks the app.
  const [splashLayer, setSplashLayer] = useState(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minimum = reducedMotion ? 450 : BOOT_MIN_MS;
    const maximum = reducedMotion ? 900 : BOOT_MAX_MS;
    const startedAt = performance.now();
    let settled = false;
    let hideTimer = 0;

    const finish = () => {
      if (settled) return;
      settled = true;
      const remaining = Math.max(0, minimum - (performance.now() - startedAt));
      hideTimer = window.setTimeout(() => setBooting(false), remaining);
    };

    const hardStop = window.setTimeout(() => setBooting(false), maximum);
    const onLoad = () => finish();

    if (document.readyState === "complete") finish();
    else window.addEventListener("load", onLoad, { once: true });

    const fonts = document.fonts;
    if (fonts?.ready) void fonts.ready.then(finish).catch(finish);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(hardStop);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  useEffect(() => {
    if (booting) return;
    const teardown = window.setTimeout(() => setSplashLayer(false), 700);
    return () => window.clearTimeout(teardown);
  }, [booting]);

  useEffect(() => {
    if (!splashLayer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [splashLayer]);

  return (
    <>
      {splashLayer ? (
        <AnimatePresence>
          {booting ? <AppLoader key="boot-splash" /> : null}
        </AnimatePresence>
      ) : null}
      {children}
    </>
  );
}

/**
 * Mounts the assistant only after the first open request. Home, the mobile
 * dock and any other caller dispatch `vianova:open-chat`; the flag covers the
 * gap while the lazy chunk is still loading.
 */
function ChatbotHost() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mount = () => {
      window.__vianovaChatRequested = true;
      setMounted(true);
    };
    if (window.__vianovaChatRequested) setMounted(true);
    window.addEventListener("vianova:open-chat", mount);
    return () => window.removeEventListener("vianova:open-chat", mount);
  }, []);

  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <Chatbot />
    </Suspense>
  );
}

function Router() {
  return (
    <>
      <SmoothScroll />
      <Suspense fallback={<PageLoader />}>
        <Switch>
        <Route path="/index.html">
          <Redirect to="/" />
        </Route>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/select-role" component={RoleSelection} />
        <Route path="/settings" component={AccountSettings} />
        <Route path="/my-products" component={MyProducts} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/admin" component={AdminDashboard} />

        {/* ── Taxi ── */}
        <Route path="/taxi-dashboard" component={TaxiDashboard} />
        <Route path="/taxi/ride/:id" component={RideDetail} />
        <Route path="/taxi/earnings" component={TaxiEarnings} />
        <Route path="/request-ride" component={RequestRide} />
        <Route path="/ride-history" component={RideHistory} />
        <Route path="/social" component={SocialFeed} />
        <Route path="/messages" component={Messages} />
        <Route path="/u/:username" component={UserProfile} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/products" component={ProductManager} />
        <Route path="/explore" component={ProductStore} />

        {/* Guías públicas con contenido prerenderizado para buscadores. */}
        {seoPages.map((page) => (
          <Route key={page.slug} path={`/${page.slug}`}>
            <SeoLanding slug={page.slug} />
          </Route>
        ))}

        <Route component={NotFound} />
        </Switch>
      </Suspense>
      <ChatbotHost />
      <AiOrb />
      <Suspense fallback={null}>
        <MobileDock />
      </Suspense>
    </>
  );
}

import { ThemeProvider } from "next-themes";
import ThemeFavicon from "@/components/ThemeFavicon";
import { LiquidGlassDefs } from "@/components/ui/liquid-glass";
import { useSeo } from "@/hooks/useSeo";
import { seoPages } from "@shared/seo-content";

function SeoManager() {
  useSeo();
  return null;
}

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      themes={["light", "dark", "sunset", "ocean", "forest"]}
    >
      <ThemeFavicon />
      <LiquidGlassDefs />
      <SeoManager />
      <BootGate>
        <QueryClientProvider client={queryClient}>
          <Toaster />
          <Router />
        </QueryClientProvider>
      </BootGate>
    </ThemeProvider>
  );
}

export default App;
