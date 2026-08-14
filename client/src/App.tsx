import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import AccountSettings from "@/pages/AccountSettings";
import MyProducts from "@/pages/MyProducts";
import RoleSelection from "@/pages/RoleSelection";
import Notifications from "@/pages/Notifications";
import AdminDashboard from "@/pages/AdminDashboard";

// ── TAXI ──────────────────────────────────────────────────────────────────────
import TaxiDashboard from "@/pages/taxi/TaxiDashboard";
import RideDetail from "@/pages/taxi/RideDetail";
import TaxiEarnings from "@/pages/taxi/TaxiEarnings";
import RequestRide from "@/pages/taxi/RequestRide";
import RideHistory from "@/pages/RideHistory";
import SocialFeed from "@/pages/SocialFeed";
import ProductManager from "@/pages/ProductManager";
import ProductStore from "@/pages/ProductStore";
import NukePage from "@/pages/Nuke";

function Router() {
  return (
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
      <Route path="/admin" component={AdminDashboard} />

      {/* ── Taxi ── */}
      <Route path="/taxi-dashboard" component={TaxiDashboard} />
      <Route path="/taxi/ride/:id" component={RideDetail} />
      <Route path="/taxi/earnings" component={TaxiEarnings} />
      <Route path="/request-ride" component={RequestRide} />
      <Route path="/ride-history" component={RideHistory} />
      <Route path="/social" component={SocialFeed} />
      <Route path="/products" component={ProductManager} />
      <Route path="/explore" component={ProductStore} />
      <Route path="/nuke" component={NukePage} />

      <Route component={NotFound} />
    </Switch>
  );
}

import { ThemeProvider } from "next-themes";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem themes={["light", "dark", "sunset", "ocean", "forest"]}>
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <Router />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
