import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Building2, CalendarDays, Car, CheckCircle2,
  Coins, Download, FileSpreadsheet, Globe2, Languages, LayoutDashboard, Loader2, Package, PieChart as PieIcon, ReceiptText,
  RefreshCw, ShoppingBag, Sparkles, Star, Store, TentTree, TrendingDown, TrendingUp, User,
  Users, Utensils, Wallet,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiBase } from "@/lib/queryClient";
import { useAuth, type UserRole } from "@/lib/auth";

type Range = 7 | 30 | 90;

const ROLE_LABELS: Record<string, string> = {
  traveler: "Viajero",
  hotel: "Hotel",
  restaurant: "Restaurante",
  recreation: "Recreación",
  taxi: "Taxi",
  transport: "Transporte",
  translator: "Traductor",
  admin: "Administrador",
};

const ROLE_ICONS: Record<string, any> = {
  traveler: User,
  hotel: Building2,
  restaurant: Utensils,
  recreation: TentTree,
  taxi: Car,
  translator: Languages,
  admin: Globe2,
};

const CHART_COLORS = ["#facc15", "#22c55e", "#3b82f6", "#a855f7", "#f97316", "#14b8a6", "#ec4899"];

const currency = (value: unknown) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value) || 0);

const number = (value: unknown) => new Intl.NumberFormat("es-CO").format(Number(value) || 0);

const compactDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
};

function KpiCard({ icon: Icon, label, value, hint, accent = "text-primary", danger = false }: {
  icon: any; label: string; value: string; hint?: string; accent?: string; danger?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-5 ${danger ? "border border-red-500/30 bg-red-500/5" : "glass-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={`mt-2 text-2xl font-extrabold tracking-tight ${danger ? "text-red-400" : "text-foreground"}`}>{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={`rounded-xl bg-secondary/40 p-2.5 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, action }: { icon: any; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-green-500/10 text-green-400 border-green-500/20",
    completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
    refunded: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    confirmed: "bg-green-500/10 text-green-400 border-green-500/20",
    reserved_temp: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${map[status] || "border-border/50 bg-secondary/30 text-muted-foreground"}`}>
      {status}
    </span>
  );
}

const ROLE_ORDER: UserRole[] = ["hotel", "restaurant", "recreation", "translator", "taxi", "traveler", "admin"];

const authHeader = () => {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

type DashboardView = "general" | "role";

export default function Dashboard() {
  const { user, switchActiveRole } = useAuth();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<Range>(30);
  const [switching, setSwitching] = useState<UserRole | null>(null);
  const [view, setView] = useState<DashboardView>("general");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportRoles, setExportRoles] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const role = (user?.role || "traveler") as UserRole;
  const RoleIcon = ROLE_ICONS[role] || User;
  const roleLabel = ROLE_LABELS[role] || role;
  const userRoles = useMemo(() => (user?.roles?.length ? user.roles : [role]), [user?.roles, role]);
  const availableRoles = useMemo(() => {
    const present = new Set<string>([...(user?.roles || []), role, "traveler"]);
    if (role === "admin") present.add("admin");
    const ordered = ROLE_ORDER.filter((option) => present.has(option));
    const extras = Array.from(present).filter((option) => !ROLE_ORDER.includes(option as UserRole));
    return [...ordered, ...extras];
  }, [user?.roles, role]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<any>({
    queryKey: ["analytics", user?.username, role, days],
    enabled: !!user?.username,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await fetch(
        `${apiBase}/api/analytics/dashboard?username=${encodeURIComponent(user!.username)}&role=${encodeURIComponent(role)}&days=${days}`,
        {
          credentials: "include",
          headers: authHeader(),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "No se pudieron cargar las analíticas");
      }
      return res.json();
    },
  });

  const overviewQuery = useQuery<any>({
    queryKey: ["analytics-overview", user?.username, days],
    enabled: !!user?.username,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await fetch(
        `${apiBase}/api/analytics/overview?username=${encodeURIComponent(user!.username)}&days=${days}`,
        { credentials: "include", headers: authHeader() },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "No se pudo cargar el resumen general");
      }
      return res.json();
    },
  });

  useEffect(() => {
    if (!user) setLocation("/login");
  }, [user, setLocation]);

  if (!user) return null;

  const metrics = data?.metrics || {};
  const scope = data?.scope || (role === "traveler" ? "consumer" : role === "admin" ? "admin" : "business");
  const trend = data?.trend || [];
  const categories = (data?.categoryBreakdown || []).filter((c: any) => Number(c.value) > 0);
  const topProducts = data?.topProducts || [];
  const topServices = data?.topServices || [];
  const lowStock = (data?.lowStock || []).filter((p: any) => Number(p.stock) < 5);
  const recommendations = data?.recommendations || [];
  const topProviders = data?.topProviders || [];
  const revenueByRole = data?.revenueByRole || [];
  const recentOrders = data?.recentOrders || [];
  const recentBookings = data?.recentBookings || [];
  const recentRides = data?.recentRides || [];
  const recentUsers = data?.recentUsers || [];

  const overview = overviewQuery.data;
  const general = overview?.general;
  const overviewReports: any[] = overview?.reports || [];
  const hasBusinessScope = overviewReports.some((report) => report.scope === "business" || report.scope === "admin");
  const businessNameByRole = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const entry of overview?.user?.roles || []) map[entry.role] = entry.businessName || null;
    return map;
  }, [overview]);

  const exportRoleOptions = useMemo(() => {
    const present = new Set<string>([
      ...availableRoles,
      ...((overview?.user?.roles || []) as any[]).map((entry) => String(entry.role)),
      "traveler",
    ]);
    if (role === "admin") present.add("admin");
    const ordered = ROLE_ORDER.filter((option) => present.has(option));
    const extras = Array.from(present).filter((option) => !ROLE_ORDER.includes(option as UserRole));
    return [...ordered, ...extras];
  }, [availableRoles, overview, role]);

  const title = view === "general"
    ? "Dashboard general"
    : scope === "consumer" ? "Panel del Viajero" : scope === "admin" ? "Panel SaaS Global" : `Panel de Negocio · ${roleLabel}`;
  const subtitle = view === "general"
    ? "Métricas consolidadas de todos los roles de tu cuenta: ingresos, gastos, viajeros, inventario y actividad."
    : scope === "consumer"
      ? "Tus compras, reservas, viajes, nivel de fidelidad y recomendaciones personalizadas."
      : scope === "admin"
        ? "Ventas, gastos, ganancias, stock y salud de toda la plataforma en un solo lugar."
        : "Ventas, gastos, ganancias, márgenes, stock y clientes de tu operación.";

  const handleRoleSwitch = async (nextRole: UserRole) => {
    if (nextRole === role) return;
    setSwitching(nextRole);
    const result = await switchActiveRole(nextRole);
    setSwitching(null);
    if (result.ok) {
      await queryClient.invalidateQueries();
      toast({ title: "Rol cambiado", description: `Ahora ves el panel de ${ROLE_LABELS[nextRole] || nextRole}.` });
    } else {
      toast({ title: "No se pudo cambiar el rol", description: result.message, variant: "destructive" });
    }
  };

  const openRoleDashboard = async (nextRole: UserRole) => {
    setView("role");
    await handleRoleSwitch(nextRole);
  };

  const openExportDialog = () => {
    setExportRoles(exportRoleOptions);
    setExportOpen(true);
  };

  const toggleExportRole = (roleOption: string) => {
    setExportRoles((current) => current.includes(roleOption)
      ? current.filter((option) => option !== roleOption)
      : [...current, roleOption]);
  };

  const handleExcelExport = async () => {
    if (!exportRoles.length) {
      toast({ title: "Selecciona al menos un rol", description: "El reporte necesita una hoja General y al menos un rol.", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      params.set("roles", exportRoles.join(","));
      const res = await fetch(`${apiBase}/api/analytics/export?${params.toString()}`, {
        credentials: "include",
        headers: authHeader(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "No se pudo generar el Excel");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
      const filename = utf8Name ? decodeURIComponent(utf8Name) : plainName || `VIANova-reporte-${days}d.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setExportOpen(false);
      toast({
        title: "Excel listo",
        description: `Se descargaron ${exportRoles.length + 1} hojas: General + ${exportRoles.length} ${exportRoles.length === 1 ? "rol" : "roles"}.`,
      });
    } catch (err: any) {
      toast({ title: "No se pudo exportar", description: err?.message || "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const lines: string[][] = [
      ["VIANova Dashboard", roleLabel, `${days} días`, new Date().toISOString()],
      [],
      ["Métrica", "Valor"],
      ...Object.entries(metrics).map(([key, value]) => [key, String(value)]),
      [],
      ["Fecha", "Ingresos/Gasto", "Gastos", "Ganancia", "Órdenes"],
      ...trend.map((point: any) => [point.date, point.revenue, point.expenses, point.profit, point.orders]),
      [],
      ["Top productos", "Unidades", "Ingresos"],
      ...topProducts.map((p: any) => [p.name, p.units ?? "", p.revenue ?? ""]),
    ];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vianova-${role}-${days}d.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const kpis = scope === "consumer"
    ? [
        { icon: Wallet, label: "Total gastado", value: currency(metrics.totalSpent), hint: "Compras, reservas y viajes" },
        { icon: ShoppingBag, label: "Compras", value: number(metrics.orders), hint: `${number(metrics.pendingOrders)} pendientes` },
        { icon: CalendarDays, label: "Reservas", value: number(metrics.bookings), hint: "Servicios confirmados" },
        { icon: Car, label: "Viajes", value: number(metrics.rides), hint: `${number(metrics.activeRides)} en curso` },
        { icon: Coins, label: "Puntos VIANova", value: number(metrics.loyaltyPoints), hint: `Nivel ${metrics.level || "Explorador"}` },
        { icon: ReceiptText, label: "Ticket promedio", value: currency(metrics.avgTicket), hint: "Por transacción" },
      ]
    : scope === "admin"
      ? [
          { icon: TrendingUp, label: "Ingresos globales", value: currency(metrics.revenue), hint: `${number(metrics.orders)} órdenes` },
          { icon: Coins, label: "Ganancia neta", value: currency(metrics.profit), hint: `Margen ${metrics.margin || 0}%` },
          { icon: TrendingDown, label: "Gastos", value: currency(metrics.expenses), hint: "COGS + comisión 3%" },
          { icon: Users, label: "Usuarios", value: number(metrics.users), hint: `${number(metrics.newUsers)} nuevos` },
          { icon: Store, label: "Proveedores", value: number(metrics.providers), hint: "Cuentas de negocio" },
          { icon: Package, label: "Stock total", value: number(metrics.totalStock), hint: `${number(metrics.lowStock)} bajo · ${number(metrics.outOfStock)} agotados`, danger: Number(metrics.outOfStock) > 0 },
        ]
      : [
          { icon: TrendingUp, label: "Ingresos", value: currency(metrics.revenue), hint: `${number(metrics.orders)} órdenes` },
          { icon: Coins, label: "Ganancia neta", value: currency(metrics.profit), hint: `Margen ${metrics.margin || 0}%` },
          { icon: TrendingDown, label: "Gastos", value: currency(metrics.expenses), hint: `COGS ${currency(metrics.cogs)} + comisión` },
          { icon: ReceiptText, label: "Ticket promedio", value: currency(metrics.avgTicket), hint: `${number(metrics.clients)} clientes` },
          { icon: Package, label: "Stock total", value: number(metrics.totalStock), hint: `${currency(metrics.inventoryValue)} inventario` },
          { icon: AlertTriangle, label: "Alertas de stock", value: `${number(metrics.lowStock)} / ${number(metrics.outOfStock)}`, hint: "Bajos / agotados", danger: Number(metrics.outOfStock) > 0 || Number(metrics.lowStock) > 0 },
        ];

  const generalKpis = general
    ? hasBusinessScope
      ? [
          { icon: TrendingUp, label: "Ingresos de negocio", value: currency(general.metrics.revenue), hint: `${number(general.metrics.transactions)} transacciones` },
          { icon: Coins, label: "Ganancia neta", value: currency(general.metrics.profit), hint: `Margen ${Number(general.metrics.margin || 0).toFixed(1)}%` },
          { icon: TrendingDown, label: "Gastos", value: currency(general.metrics.expenses), hint: "COGS + comisión" },
          { icon: Wallet, label: "Gasto del viajero", value: currency(general.metrics.travelerSpend), hint: `${number(general.metrics.travelerOrders)} compras` },
          { icon: Users, label: "Clientes", value: number(general.metrics.clients), hint: `${number(general.metrics.businessCount)} negocios` },
          { icon: CalendarDays, label: "Reservas y viajes", value: `${number(general.metrics.bookings)} / ${number(general.metrics.rides)}`, hint: "Reservas / viajes" },
          { icon: Package, label: "Stock total", value: number(general.metrics.totalStock), hint: `${number(general.metrics.lowStock)} bajos · ${number(general.metrics.outOfStock)} agotados`, danger: Number(general.metrics.outOfStock) > 0 },
          { icon: LayoutDashboard, label: "Roles incluidos", value: number(general.metrics.roleCount), hint: "General + hojas por rol" },
        ]
      : [
          { icon: Wallet, label: "Gasto total", value: currency(general.metrics.travelerSpend), hint: "Compras, reservas y viajes" },
          { icon: ShoppingBag, label: "Compras", value: number(general.metrics.travelerOrders), hint: "Órdenes pagadas" },
          { icon: CalendarDays, label: "Reservas", value: number(general.metrics.travelerBookings), hint: "Servicios confirmados" },
          { icon: Car, label: "Viajes", value: number(general.metrics.travelerRides), hint: "Recorridos completados" },
          { icon: Coins, label: "Puntos VIANova", value: number(general.metrics.loyaltyPoints), hint: `Nivel ${general.metrics.level || "Explorador"}` },
          { icon: ReceiptText, label: "Pendientes", value: number(general.metrics.travelerPending), hint: "Por confirmar" },
          { icon: LayoutDashboard, label: "Roles incluidos", value: number(general.metrics.roleCount), hint: "General + hojas por rol" },
          { icon: Store, label: "Negocios", value: number(general.metrics.businessCount), hint: "En la cuenta" },
        ]
    : [];

  const activeIsFetching = view === "general" ? overviewQuery.isFetching : isFetching;
  const refreshCurrent = () => {
    if (view === "general") void overviewQuery.refetch();
    else void refetch();
  };

  const trendLabel = scope === "consumer" ? "Gasto" : "Ingresos";
  const quickAction = scope === "consumer"
    ? { label: "Ir al marketplace", path: "/explore", icon: ShoppingBag }
    : scope === "admin"
      ? { label: "Panel de administración", path: "/admin", icon: Activity }
      : { label: "Gestionar productos", path: "/products", icon: Package };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="border-b border-border/40 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container max-w-7xl px-4 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {view === "general" ? (
                  <>
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      <LayoutDashboard className="h-3.5 w-3.5" /> Cuenta completa
                    </span>
                    <span className="rounded-full border border-border/50 bg-secondary/30 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      Vista general
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      <RoleIcon className="h-3.5 w-3.5" /> {roleLabel}
                    </span>
                    <span className="rounded-full border border-border/50 bg-secondary/30 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      {scope === "consumer" ? "Vista consumidor" : scope === "admin" ? "Vista SaaS" : "Vista empresario"}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={refreshCurrent} disabled={activeIsFetching} className="gap-2 rounded-xl">
                {activeIsFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Actualizar
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data} className="gap-2 rounded-xl">
                <Download className="h-4 w-4" /> CSV simple
              </Button>
              <Button size="sm" onClick={openExportDialog} className="gap-2 rounded-xl bg-primary font-bold text-black">
                <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/payments")} className="gap-2 rounded-xl">
                <Wallet className="h-4 w-4" /> Pagos
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation(quickAction.path)} className="gap-2 rounded-xl">
                <quickAction.icon className="h-4 w-4" /> {quickAction.label}
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-secondary/20 p-1">
                <button
                  onClick={() => setView("general")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${view === "general" ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" /> General
                </button>
                <button
                  onClick={() => setView("role")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${view === "role" ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <RoleIcon className="h-3.5 w-3.5" /> {roleLabel}
                </button>
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-secondary/20 p-1">
                {([7, 30, 90] as Range[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => setDays(option)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${days === option ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {option} días
                  </button>
                ))}
              </div>
            </div>

            {userRoles.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Cambiar rol:</span>
                {userRoles.map((roleOption) => {
                  const Icon = ROLE_ICONS[roleOption] || User;
                  const active = roleOption === role;
                  return (
                    <button
                      key={roleOption}
                      onClick={() => {
                        setView("role");
                        void handleRoleSwitch(roleOption);
                      }}
                      disabled={active || !!switching}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        active
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border/50 bg-secondary/20 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      } disabled:cursor-default`}
                    >
                      {switching === roleOption ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                      {ROLE_LABELS[roleOption] || roleOption}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container max-w-7xl space-y-8 px-4 py-8">
        {view === "general" ? (
          overviewQuery.isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-9 w-9 animate-spin text-primary" />
            </div>
          ) : overviewQuery.isError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" />
              <p className="font-semibold text-red-400">No se pudo cargar el resumen general</p>
              <p className="mt-1 text-sm text-muted-foreground">{(overviewQuery.error as Error)?.message}</p>
              <Button onClick={() => overviewQuery.refetch()} className="mt-4 rounded-xl bg-primary font-bold text-black">Reintentar</Button>
            </div>
          ) : !general ? (
            <EmptyState text="Todavía no hay métricas para esta cuenta." />
          ) : (
            <>
              <div className="rounded-2xl border border-border/50 bg-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary"><LayoutDashboard className="h-6 w-6" /></div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Resumen de la cuenta</p>
                      <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                        {overview?.user?.businessNames?.length ? overview.user.businessNames.join(" · ") : overview?.user?.name || user.name || user.username}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        @{user.username} · {number(general.metrics.roleCount)} roles · últimos {days} días
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {overviewReports.map((report: any) => {
                      const Icon = ROLE_ICONS[report.role] || User;
                      return (
                        <span key={report.role} className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/20 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" /> {report.label}
                          {report.businessName && <span className="text-muted-foreground/60">· {report.businessName}</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {generalKpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-border/50 bg-card p-5 xl:col-span-2">
                  <SectionHeader
                    icon={BarChart3}
                    title="Movimiento consolidado"
                    subtitle={`Últimos ${days} días · todos los roles seleccionados`}
                    action={<span className="text-xs font-semibold text-muted-foreground">Ingresos: {currency(general.metrics.revenue)}</span>}
                  />
                  {(general.trend || []).length === 0 ? <EmptyState text="Aún no hay movimientos en este periodo." /> : (
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={general.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="generalRevenueFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#facc15" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="generalTravelerFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.35} />
                          <XAxis dataKey="date" tickFormatter={compactDate} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
                          <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={48} />
                          <Tooltip
                            formatter={(value: any, name: any) => [currency(value), name === "revenue" ? "Ingresos negocio" : name === "travelerSpend" ? "Gasto viajero" : name === "expenses" ? "Gastos" : "Ganancia"]}
                            labelFormatter={compactDate}
                            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                          />
                          <Legend formatter={(value) => value === "revenue" ? "Ingresos negocio" : value === "travelerSpend" ? "Gasto viajero" : value === "expenses" ? "Gastos" : "Ganancia"} />
                          <Area type="monotone" dataKey="revenue" stroke="#facc15" strokeWidth={2.5} fill="url(#generalRevenueFill)" />
                          <Area type="monotone" dataKey="travelerSpend" stroke="#a855f7" strokeWidth={2} fill="url(#generalTravelerFill)" />
                          {hasBusinessScope && <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={1.8} dot={false} />}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <SectionHeader icon={PieIcon} title="Distribución" subtitle="Actividad por categoría" />
                  {(general.categoryBreakdown || []).filter((entry: any) => Number(entry.value) > 0).length === 0 ? <EmptyState text="Sin datos para graficar." /> : (
                    <>
                      <div className="h-[230px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={(general.categoryBreakdown || []).filter((entry: any) => Number(entry.value) > 0)} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                              {(general.categoryBreakdown || []).filter((entry: any) => Number(entry.value) > 0).map((entry: any, index: number) => (
                                <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: any) => currency(value)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-2 space-y-2">
                        {(general.categoryBreakdown || []).filter((entry: any) => Number(entry.value) > 0).slice(0, 5).map((entry: any, index: number) => (
                          <div key={entry.name} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 capitalize text-muted-foreground">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                              {ROLE_LABELS[entry.name] || entry.name}
                            </span>
                            <span className="font-semibold">{currency(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <SectionHeader
                  icon={Users}
                  title="Rendimiento por rol"
                  subtitle="Compara la operación de cada negocio y del viajero"
                  action={<Button variant="outline" size="sm" onClick={openExportDialog} className="gap-2 rounded-xl"><FileSpreadsheet className="h-4 w-4" /> Exportar este resumen</Button>}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {overviewReports.map((report: any) => {
                    const Icon = ROLE_ICONS[report.role] || User;
                    const consumer = report.scope === "consumer";
                    const amount = Number(consumer ? report.metrics?.totalSpent : report.metrics?.revenue) || 0;
                    const activity = [
                      Number(report.metrics?.orders) ? `${number(report.metrics.orders)} órdenes` : "",
                      Number(report.metrics?.bookings) ? `${number(report.metrics.bookings)} reservas` : "",
                      Number(report.metrics?.rides) ? `${number(report.metrics.rides)} viajes` : "",
                    ].filter(Boolean).join(" · ") || "Sin actividad";
                    return (
                      <button
                        key={report.role}
                        onClick={() => void openRoleDashboard(report.role as UserRole)}
                        className="group rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:border-primary/40 hover:bg-secondary/10"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div>
                            <div>
                              <p className="text-sm font-bold">{report.label}</p>
                              <p className="text-[11px] text-muted-foreground">{report.businessName || (consumer ? "Tu actividad" : "Negocio")}</p>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>
                        <p className="mt-4 text-2xl font-extrabold tracking-tight">{currency(amount)}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{consumer ? "gastado" : "ingresos"}</p>
                        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
                          <span className="truncate text-[11px] text-muted-foreground">{activity}</span>
                          <span className="shrink-0 text-[11px] font-bold text-green-400">
                            {consumer ? report.metrics?.level || "Explorador" : `${Number(report.metrics?.margin || 0).toFixed(1)}%`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <SectionHeader icon={ShoppingBag} title="Productos y servicios destacados" subtitle="Los que más ingresos generan entre todos los roles" />
                  {(general.topProducts || []).length === 0 ? <EmptyState text="Sin ventas de productos en el periodo." /> : (
                    <div className="space-y-2">
                      {(general.topProducts || []).slice(0, 8).map((product: any, index: number) => (
                        <div key={`${product.role}-${product.id || product.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-secondary/10 p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{product.name || "Producto"}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{product.role_label} · {product.business_name} · {number(product.units)} vendidos</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-bold">{currency(product.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <SectionHeader icon={Activity} title="Actividad reciente" subtitle="Últimas operaciones de toda la cuenta" />
                  {(general.recentActivity || []).length === 0 ? <EmptyState text="Sin actividad reciente en el periodo." /> : (
                    <div className="space-y-2">
                      {(general.recentActivity || []).slice(0, 8).map((activity: any, index: number) => (
                        <div key={`${activity.type}-${activity.id}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-secondary/5 p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="rounded-lg bg-secondary/40 p-2 text-muted-foreground">
                              {activity.type === "Orden" ? <ShoppingBag className="h-4 w-4" /> : activity.type === "Reserva" ? <CalendarDays className="h-4 w-4" /> : <Car className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{activity.detail}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{activity.role_label} · @{activity.person || "—"} · {activity.date ? compactDate(String(activity.date).slice(0, 10)) : "—"}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-sm font-bold">{currency(activity.amount)}</span>
                            <StatusBadge status={String(activity.status || "").toLowerCase()} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )
        ) : isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-9 w-9 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" />
            <p className="font-semibold text-red-400">No se pudo cargar el dashboard</p>
            <p className="mt-1 text-sm text-muted-foreground">{(error as Error)?.message}</p>
            <Button onClick={() => refetch()} className="mt-4 rounded-xl bg-primary font-bold text-black">Reintentar</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
              {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-border/50 bg-card p-5 xl:col-span-2">
                <SectionHeader
                  icon={BarChart3}
                  title={scope === "consumer" ? "Gasto en el tiempo" : "Ingresos, gastos y ganancia"}
                  subtitle={`Últimos ${days} días`}
                  action={<span className="text-xs font-semibold text-muted-foreground">{trendLabel} total: {currency(metrics.revenue ?? metrics.totalSpent)}</span>}
                />
                {trend.length === 0 ? <EmptyState text="Aún no hay movimientos en este periodo." /> : (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#facc15" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.35} />
                        <XAxis dataKey="date" tickFormatter={compactDate} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
                        <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={48} />
                        <Tooltip
                          formatter={(value: any, name: any) => [currency(value), name === "revenue" ? trendLabel : name === "expenses" ? "Gastos" : "Ganancia"]}
                          labelFormatter={compactDate}
                          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                        />
                        <Legend formatter={(value) => value === "revenue" ? trendLabel : value === "expenses" ? "Gastos" : "Ganancia"} />
                        <Area type="monotone" dataKey="revenue" stroke="#facc15" strokeWidth={2.5} fill="url(#revenueFill)" />
                        {scope !== "consumer" && <Area type="monotone" dataKey="expenses" stroke="#f97316" strokeWidth={1.8} fillOpacity={0} />}
                        {scope !== "consumer" && <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={1.8} dot={false} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border/50 bg-card p-5">
                <SectionHeader icon={PieIcon} title="Distribución" subtitle={scope === "consumer" ? "Tus categorías" : "Ingresos por categoría"} />
                {categories.length === 0 ? <EmptyState text="Sin datos para graficar." /> : (
                  <>
                    <div className="h-[230px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categories} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                            {categories.map((entry: any, index: number) => (
                              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => currency(value)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 space-y-2">
                      {categories.slice(0, 5).map((entry: any, index: number) => (
                        <div key={entry.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 capitalize text-muted-foreground">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                            {ROLE_LABELS[entry.name] || entry.name}
                          </span>
                          <span className="font-semibold">{currency(entry.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {scope === "consumer" ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <SectionHeader icon={ShoppingBag} title="Compras recientes" subtitle="Tus últimas transacciones" action={<Button variant="ghost" size="sm" onClick={() => setLocation("/explore")} className="gap-1 text-xs">Ver marketplace <ArrowRight className="h-3.5 w-3.5" /></Button>} />
                  {recentOrders.length === 0 ? <EmptyState text="Todavía no has comprado nada." /> : (
                    <div className="space-y-3">
                      {recentOrders.slice(0, 6).map((order: any) => (
                        <div key={order.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-secondary/10 p-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary/40">
                            {order.cover_image ? <img src={order.cover_image} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-5 w-5 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{order.product_name}</p>
                            <p className="truncate text-xs text-muted-foreground">{order.provider_name || `@${order.provider_username}`} · {order.quantity}x</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{currency(order.total)}</p>
                            <StatusBadge status={order.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <SectionHeader icon={Sparkles} title="Recomendado para ti" subtitle="Basado en tu actividad y nivel" />
                  {recommendations.length === 0 ? <EmptyState text="No hay recomendaciones nuevas." /> : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {recommendations.slice(0, 4).map((product: any) => (
                        <button key={product.id} onClick={() => setLocation("/explore")} className="group flex items-center gap-3 rounded-xl border border-border/40 bg-secondary/10 p-3 text-left transition-colors hover:border-primary/30">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary/40">
                            {product.cover_image ? <img src={product.cover_image} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" /> : <Sparkles className="h-5 w-5 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{product.provider_name || product.provider_username}</p>
                            <p className="mt-0.5 text-sm font-bold text-primary">{currency(product.price)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <SectionHeader icon={CalendarDays} title="Reservas recientes" subtitle="Servicios agendados" />
                  {recentBookings.length === 0 ? <EmptyState text="Sin reservas por ahora." /> : (
                    <div className="space-y-3">
                      {recentBookings.slice(0, 5).map((booking: any) => (
                        <div key={booking.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-secondary/10 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{booking.service_name || "Servicio"}</p>
                            <p className="text-xs text-muted-foreground">@{booking.provider_username} · {booking.units} cupo(s)</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{currency(booking.total_price)}</p>
                            <StatusBadge status={booking.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <SectionHeader icon={Car} title="Viajes recientes" subtitle="Tus recorridos en taxi" />
                  {recentRides.length === 0 ? <EmptyState text="Sin viajes registrados." /> : (
                    <div className="space-y-3">
                      {recentRides.slice(0, 5).map((ride: any) => (
                        <div key={ride.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-secondary/10 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{ride.destination_address || "Destino"}</p>
                            <p className="text-xs text-muted-foreground">{ride.taxi_username ? `@${ride.taxi_username}` : "Buscando conductor"} · {ride.distance_km ? `${ride.distance_km} km` : "—"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{currency(ride.fare)}</p>
                            <StatusBadge status={ride.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                  <div className="rounded-2xl border border-border/50 bg-card p-5 xl:col-span-2">
                    <SectionHeader icon={BarChart3} title="Productos con mejor rendimiento" subtitle="Unidades e ingresos del periodo" />
                    {topProducts.length === 0 ? <EmptyState text="Sin ventas de productos en este periodo." /> : (
                      <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topProducts.slice(0, 6)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.35} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval={0} tickFormatter={(value) => String(value).length > 14 ? `${String(value).slice(0, 14)}…` : value} />
                            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={48} />
                            <Tooltip formatter={(value: any) => currency(value)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                            <Bar dataKey="revenue" fill="#facc15" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-card p-5">
                    <SectionHeader icon={AlertTriangle} title="Alertas de inventario" subtitle="Repone antes de perder ventas" />
                    {lowStock.length === 0 ? (
                      <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 text-center">
                        <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-green-400" />
                        <p className="text-sm font-semibold text-green-400">Inventario saludable</p>
                        <p className="mt-1 text-xs text-muted-foreground">No hay productos con stock bajo.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {lowStock.slice(0, 6).map((product: any) => (
                          <div key={product.id} className="flex items-center justify-between gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{product.name}</p>
                              <p className="text-[11px] text-muted-foreground">{product.provider_username ? `@${product.provider_username}` : product.role_category}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${Number(product.stock) === 0 ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                              {Number(product.stock) === 0 ? "AGOTADO" : `${product.stock} uds`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-border/50 bg-card p-5">
                    <SectionHeader icon={ReceiptText} title="Órdenes recientes" subtitle="Actividad del marketplace" action={<Button variant="ghost" size="sm" onClick={() => setLocation(scope === "admin" ? "/admin" : "/products")} className="gap-1 text-xs">Ver todo <ArrowRight className="h-3.5 w-3.5" /></Button>} />
                    {recentOrders.length === 0 ? <EmptyState text="Sin órdenes en este periodo." /> : (
                      <div className="space-y-2">
                        {recentOrders.slice(0, 7).map((order: any) => (
                          <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-secondary/10 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{order.product_name}</p>
                              <p className="truncate text-xs text-muted-foreground">{order.buyer_username ? `@${order.buyer_username}` : ""}{order.provider_username ? ` · @${order.provider_username}` : ""} · {order.quantity}x</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-sm font-bold">{currency(order.total)}</span>
                              <StatusBadge status={order.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-card p-5">
                    <SectionHeader icon={CalendarDays} title="Reservas y servicios" subtitle={scope === "admin" ? "Toda la plataforma" : "Tus servicios más reservados"} />
                    {topServices.length > 0 ? (
                      <div className="mb-4 space-y-2">
                        {topServices.slice(0, 4).map((service: any) => (
                          <div key={service.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-secondary/10 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{service.name}</p>
                              <p className="text-xs capitalize text-muted-foreground">{service.category} · {number(service.bookings)} reservas</p>
                            </div>
                            <span className="text-sm font-bold">{currency(service.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    ) : recentBookings.length === 0 ? <EmptyState text="Sin reservas en este periodo." /> : null}
                    <div className="space-y-2">
                      {recentBookings.slice(0, 4).map((booking: any) => (
                        <div key={booking.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-secondary/5 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{booking.service_name || "Servicio"}</p>
                            <p className="truncate text-xs text-muted-foreground">@{booking.traveler_username} · @{booking.provider_username}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-sm font-bold">{currency(booking.total_price)}</span>
                            <StatusBadge status={booking.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {scope === "admin" && (
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <div className="rounded-2xl border border-border/50 bg-card p-5 xl:col-span-2">
                      <SectionHeader icon={Store} title="Mejores proveedores" subtitle="Ranking por ingresos del periodo" />
                      {topProviders.length === 0 ? <EmptyState text="Sin ventas registradas." /> : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-border/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                                <th className="pb-2">#</th>
                                <th className="pb-2">Proveedor</th>
                                <th className="pb-2">Rol</th>
                                <th className="pb-2 text-right">Órdenes</th>
                                <th className="pb-2 text-right">Ingresos</th>
                              </tr>
                            </thead>
                            <tbody>
                              {topProviders.map((provider: any, index: number) => (
                                <tr key={`${provider.username}-${index}`} className="border-b border-border/20 last:border-0">
                                  <td className="py-2.5 text-muted-foreground">{index + 1}</td>
                                  <td className="py-2.5 font-medium">@{provider.username}</td>
                                  <td className="py-2.5 capitalize text-muted-foreground">{ROLE_LABELS[provider.role] || provider.role}</td>
                                  <td className="py-2.5 text-right">{number(provider.orders)}</td>
                                  <td className="py-2.5 text-right font-bold text-primary">{currency(provider.revenue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-card p-5">
                      <SectionHeader icon={Globe2} title="Ingresos por rol" subtitle="Contribución al GMV" />
                      {revenueByRole.length === 0 ? <EmptyState text="Sin ingresos por rol." /> : (
                        <div className="space-y-3">
                          {revenueByRole.map((entry: any) => {
                            const total = Number(metrics.revenue) || 1;
                            const percentage = Math.min(100, Math.round((Number(entry.revenue) / total) * 100));
                            return (
                              <div key={entry.role}>
                                <div className="mb-1 flex items-center justify-between text-xs">
                                  <span className="font-medium capitalize">{ROLE_LABELS[entry.role] || entry.role}</span>
                                  <span className="text-muted-foreground">{currency(entry.revenue)}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-secondary/40">
                                  <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-card p-5 xl:col-span-3">
                      <SectionHeader icon={Users} title="Usuarios recientes" subtitle="Últimos registros de la plataforma" />
                      {recentUsers.length === 0 ? <EmptyState text="Sin usuarios recientes." /> : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                          {recentUsers.slice(0, 5).map((account: any) => {
                            const Icon = ROLE_ICONS[account.role] || User;
                            return (
                              <div key={account.username} className="flex items-center gap-3 rounded-xl border border-border/40 bg-secondary/10 p-3">
                                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">{account.name || account.username}</p>
                                  <p className="truncate text-xs text-muted-foreground">@{account.username} · {ROLE_LABELS[account.role] || account.role}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {topProducts.length > 0 && (
                  <div className="rounded-2xl border border-border/50 bg-card p-5">
                    <SectionHeader icon={Package} title="Detalle de productos" subtitle="Stock, unidades vendidas y margen" />
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                            <th className="pb-2">Producto</th>
                            <th className="pb-2">Categoría</th>
                            <th className="pb-2 text-right">Stock</th>
                            <th className="pb-2 text-right">Vendidos</th>
                            <th className="pb-2 text-right">Ingresos</th>
                            <th className="pb-2 text-right">Margen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topProducts.map((product: any) => (
                            <tr key={product.id} className="border-b border-border/20 last:border-0">
                              <td className="py-2.5 font-medium">{product.name}</td>
                              <td className="py-2.5 capitalize text-muted-foreground">{ROLE_LABELS[product.role_category] || product.role_category}</td>
                              <td className="py-2.5 text-right">
                                <span className={Number(product.stock) === 0 ? "font-bold text-red-400" : Number(product.stock) < 5 ? "font-bold text-yellow-400" : ""}>
                                  {Number(product.stock) === -1 ? "∞" : product.stock}
                                </span>
                              </td>
                              <td className="py-2.5 text-right">{number(product.units)}</td>
                              <td className="py-2.5 text-right font-bold">{currency(product.revenue)}</td>
                              <td className="py-2.5 text-right text-green-400">{currency(product.margin)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <p className="flex items-center justify-center gap-1.5 pb-4 text-center text-[11px] text-muted-foreground/60">
          <Star className="h-3 w-3" /> Datos calculados en tiempo real · VIANova {new Date().getFullYear()}
        </p>
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="rounded-xl bg-primary/10 p-2 text-primary"><FileSpreadsheet className="h-5 w-5" /></span>
              Exportar reporte Excel
            </DialogTitle>
            <DialogDescription>
              Elige los roles que quieres incluir. Se descargará un archivo .xlsx con la hoja General y una hoja por cada rol seleccionado, con logo, nombre del negocio y formato profesional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/15 p-2 text-primary"><LayoutDashboard className="h-4 w-4" /></div>
                <div>
                  <p className="text-sm font-bold">Hoja General</p>
                  <p className="text-[11px] text-muted-foreground">Resumen consolidado de todos los roles seleccionados</p>
                </div>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Incluida</span>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Hojas por rol</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {exportRoleOptions.map((roleOption) => {
                  const Icon = ROLE_ICONS[roleOption] || User;
                  const checked = exportRoles.includes(roleOption);
                  return (
                    <label
                      key={roleOption}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${checked ? "border-primary/40 bg-primary/5" : "border-border/50 bg-secondary/10 hover:border-border"}`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleExportRole(roleOption)} aria-label={`Incluir ${ROLE_LABELS[roleOption] || roleOption}`} />
                      <div className="rounded-lg bg-secondary/40 p-1.5 text-muted-foreground"><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{ROLE_LABELS[roleOption] || roleOption}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{businessNameByRole[roleOption] || (roleOption === "traveler" ? "Actividad como viajero" : "Hoja de métricas del rol")}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-secondary/10 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">{1 + exportRoles.length} {exportRoles.length === 1 ? "hoja" : "hojas"} en el archivo</p>
              <p className="mt-1">Periodo: últimos {days} días · General{exportRoles.length ? ` + ${exportRoles.map((option) => ROLE_LABELS[option] || option).join(", ")}` : ""}</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={exportCsv} disabled={!data} className="gap-2 rounded-xl">
              <Download className="h-4 w-4" /> CSV del rol actual
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button size="sm" onClick={handleExcelExport} disabled={exporting || exportRoles.length === 0} className="gap-2 rounded-xl bg-primary font-bold text-black">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {exporting ? "Generando..." : "Descargar Excel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
