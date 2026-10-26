import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

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

function PageLoader() {
  return (
    <div
      className="min-h-[60vh] w-full flex items-center justify-center"
      role="status"
      aria-label="Cargando página"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function Router() {
  return (
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

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

import { ThemeProvider } from "next-themes";
import ThemeFavicon from "@/components/ThemeFavicon";

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
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <Router />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
