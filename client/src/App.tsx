import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import AccountSettings from "@/pages/AccountSettings";
import MyProducts from "@/pages/MyProducts";
import RoleSelection from "@/pages/RoleSelection";

// ── TAXI ──────────────────────────────────────────────────────────────────────
import TaxiDashboard from "@/pages/taxi/TaxiDashboard";
import RideDetail from "@/pages/taxi/RideDetail";
import TaxiEarnings from "@/pages/taxi/TaxiEarnings";
import RequestRide from "@/pages/taxi/RequestRide";
import RideHistory from "@/pages/RideHistory";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/select-role" component={RoleSelection} />
      <Route path="/settings" component={AccountSettings} />
      <Route path="/my-products" component={MyProducts} />

      {/* ── Taxi ── */}
      <Route path="/taxi-dashboard" component={TaxiDashboard} />
      <Route path="/taxi/ride/:id" component={RideDetail} />
      <Route path="/taxi/earnings" component={TaxiEarnings} />
      <Route path="/request-ride" component={RequestRide} />
      <Route path="/ride-history" component={RideHistory} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;
