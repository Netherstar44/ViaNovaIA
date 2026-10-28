import ExcelJS from "exceljs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  getDashboardAnalytics,
  ROLE_SERVICE_CATEGORY,
  VALID_ROLES,
  type DashboardScope,
} from "./analytics.js";
import { storage } from "./storage.js";
import { BRAND_LOGO_PNG_BASE64 } from "./brand-logo.js";

type Row = Record<string, any>;

type TrendPoint = {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
  orders: number;
};

type AccountRoleReport = {
  role: string;
  label: string;
  sheetName: string;
  businessName: string | null;
  scope: DashboardScope;
  metrics: Record<string, any>;
  trend: TrendPoint[];
  categoryBreakdown: Array<{ name: string; value: number }>;
  topProducts: Row[];
  topServices: Row[];
  lowStock: Row[];
  recentOrders: Row[];
  recentBookings: Row[];
  recentRides: Row[];
};

export type AccountAnalytics = {
  generatedAt: string;
  days: number;
  user: {
    username: string;
    name: string;
    businessNames: string[];
    roles: Array<{ role: string; label: string; businessName: string | null; scope: DashboardScope }>;
  };
  general: {
    metrics: Record<string, any>;
    trend: Array<{
      date: string;
      revenue: number;
      travelerSpend: number;
      expenses: number;
      profit: number;
      businessOrders: number;
      travelerOrders: number;
    }>;
    roleBreakdown: Row[];
    categoryBreakdown: Array<{ name: string; value: number }>;
    topProducts: Row[];
    topServices: Row[];
    lowStock: Row[];
    recentActivity: Row[];
  };
  reports: AccountRoleReport[];
};

const ROLE_META: Record<string, { label: string; sheetName: string; color: string; soft: string }> = {
  traveler: { label: "Viajero", sheetName: "Viajero", color: "FF2563EB", soft: "FFDBEAFE" },
  hotel: { label: "Hotel", sheetName: "Hotel", color: "FF7C3AED", soft: "FFEDE9FE" },
  restaurant: { label: "Restaurante", sheetName: "Restaurante", color: "FFF97316", soft: "FFFFEDD5" },
  recreation: { label: "Sitio turístico / Recreación", sheetName: "Sitio turístico", color: "FF16A34A", soft: "FFDCFCE7" },
  taxi: { label: "Transporte / Taxi", sheetName: "Transporte", color: "FFCA8A04", soft: "FFFEF9C3" },
  translator: { label: "Guía / Traductor", sheetName: "Guía turístico", color: "FF0D9488", soft: "FFCCFBF1" },
  admin: { label: "Administrador", sheetName: "Administrador", color: "FF475569", soft: "FFE2E8F0" },
};

const ROLE_ORDER = ["hotel", "restaurant", "recreation", "taxi", "translator", "traveler", "admin"];

const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hotel",
  hoteles: "Hotel",
  restaurant: "Restaurante",
  comidas: "Restaurante",
  recreation: "Sitio turístico",
  actividades: "Sitio turístico",
  transport: "Transporte",
  transporte: "Transporte",
  taxi: "Transporte / Taxi",
  translator: "Guía / Traductor",
  otros: "Otros",
};

const COLORS = {
  navy: "FF0B1220",
  navySoft: "FF111C33",
  yellow: "FFFACC15",
  yellowSoft: "FFFEF9C3",
  white: "FFFFFFFF",
  slate: "FF64748B",
  slateDark: "FF334155",
  border: "FFE2E8F0",
  panel: "FFF8FAFC",
  green: "FF16A34A",
  greenSoft: "FFDCFCE7",
  red: "FFDC2626",
  redSoft: "FFFEE2E2",
  orange: "FFF97316",
  orangeSoft: "FFFFEDD5",
  blue: "FF2563EB",
  blueSoft: "FFDBEAFE",
  purple: "FF7C3AED",
  purpleSoft: "FFEDE9FE",
};

const NF_MONEY = '"$"#,##0';
const NF_INT = "#,##0";
const NF_PCT = '0.0"%"';
const NF_RATING = "0.0";
const NF_DATE = "dd/mm/yyyy";

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const normalizeCategory = (value: unknown): string => {
  const key = String(value || "").toLowerCase();
  return CATEGORY_LABELS[key] || String(value || "Otros");
};

const roleLabel = (role: string): string => ROLE_META[role]?.label || role;

const roleSheetName = (role: string): string => ROLE_META[role]?.sheetName || role;

const asDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] = text.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateTimeLabel = (value: unknown): string => {
  const date = asDate(value) || new Date();
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const emptyIfNil = (value: unknown): string => (value === null || value === undefined || value === "" ? "—" : String(value));

const statusFill = (status: unknown): { fill?: string; color?: string } => {
  const value = String(status || "").toLowerCase();
  if (["paid", "completed", "confirmed", "delivered"].includes(value)) {
    return { fill: COLORS.greenSoft, color: COLORS.green };
  }
  if (["pending", "reserved_temp", "accepted", "in_progress"].includes(value)) {
    return { fill: COLORS.yellowSoft, color: "FFA16207" };
  }
  if (["cancelled", "refunded", "rejected", "failed"].includes(value)) {
    return { fill: COLORS.redSoft, color: COLORS.red };
  }
  return {};
};

function summarizeReports(reports: AccountRoleReport[]): AccountAnalytics["general"] {
  const businessReports = reports.filter((report) => report.scope === "business");
  const consumerReports = reports.filter((report) => report.scope === "consumer");
  const adminReports = reports.filter((report) => report.scope === "admin");
  const businessSources = businessReports.length ? businessReports : adminReports;
  const hasBusiness = businessSources.length > 0;

  const sumMetric = (source: AccountRoleReport[], key: string) =>
    source.reduce((total, report) => total + num(report.metrics?.[key]), 0);

  const revenue = hasBusiness ? sumMetric(businessSources, "revenue") : 0;
  const expenses = hasBusiness ? sumMetric(businessSources, "expenses") : 0;
  const profit = hasBusiness ? sumMetric(businessSources, "profit") : 0;
  const transactions = hasBusiness ? sumMetric(businessSources, "orders") : 0;
  const paidOrders = hasBusiness ? sumMetric(businessSources, "paidOrders") : 0;
  const bookings = hasBusiness ? sumMetric(businessSources, "bookings") : 0;
  const rides = hasBusiness ? sumMetric(businessSources, "rides") : 0;
  const clients = hasBusiness ? sumMetric(businessSources, "clients") : 0;
  const products = hasBusiness ? sumMetric(businessSources, "products") : 0;
  const totalStock = hasBusiness ? sumMetric(businessSources, "totalStock") : 0;
  const lowStock = hasBusiness ? sumMetric(businessSources, "lowStock") : 0;
  const outOfStock = hasBusiness ? sumMetric(businessSources, "outOfStock") : 0;
  const inventoryValue = hasBusiness ? sumMetric(businessSources, "inventoryValue") : 0;
  const cogs = hasBusiness ? sumMetric(businessSources, "cogs") : 0;
  const platformFee = hasBusiness ? sumMetric(businessSources, "platformFee") : 0;
  const ratings = businessSources.map((report) => num(report.metrics?.rating)).filter((rating) => rating > 0);
  const rating = ratings.length ? round2(ratings.reduce((total, value) => total + value, 0) / ratings.length) : 0;

  const travelerSpend = sumMetric(consumerReports, "totalSpent");
  const travelerOrders = sumMetric(consumerReports, "orders");
  const travelerBookings = sumMetric(consumerReports, "bookings");
  const travelerRides = sumMetric(consumerReports, "rides");
  const travelerPending = sumMetric(consumerReports, "pendingOrders");
  const loyaltyPoints = sumMetric(consumerReports, "loyaltyPoints");
  const travelerLevel = consumerReports.find((report) => report.metrics?.level)?.metrics?.level || "";
  const businessNames = unique(
    businessSources.map((report) => report.businessName).filter((value): value is string => Boolean(value)),
  );
  const businessCount = businessNames.length || businessSources.length;

  const trendMap = new Map<string, AccountAnalytics["general"]["trend"][number]>();
  const addTrend = (day: string, values: { revenue?: number; travelerSpend?: number; expenses?: number; businessOrders?: number; travelerOrders?: number }) => {
    if (!day) return;
    const current = trendMap.get(day) || {
      date: day,
      revenue: 0,
      travelerSpend: 0,
      expenses: 0,
      profit: 0,
      businessOrders: 0,
      travelerOrders: 0,
    };
    current.revenue += num(values.revenue);
    current.travelerSpend += num(values.travelerSpend);
    current.expenses += num(values.expenses);
    current.businessOrders += num(values.businessOrders);
    current.travelerOrders += num(values.travelerOrders);
    trendMap.set(day, current);
  };

  for (const report of businessSources) {
    for (const point of report.trend || []) {
      addTrend(point.date, {
        revenue: point.revenue,
        expenses: point.expenses,
        businessOrders: point.orders,
      });
    }
  }
  for (const report of consumerReports) {
    for (const point of report.trend || []) {
      addTrend(point.date, {
        travelerSpend: point.revenue,
        travelerOrders: point.orders,
      });
    }
  }

  const trend = Array.from(trendMap.values())
    .map((point) => ({ ...point, profit: round2(point.revenue - point.expenses) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const categoryMap = new Map<string, number>();
  const categorySources = businessSources.length ? businessSources : consumerReports;
  for (const report of categorySources) {
    for (const entry of report.categoryBreakdown || []) {
      const label = normalizeCategory(entry.name);
      categoryMap.set(label, (categoryMap.get(label) || 0) + num(entry.value));
    }
  }

  const productMap = new Map<string, Row>();
  const productSources = businessSources.length ? businessSources : consumerReports;
  for (const report of productSources) {
    for (const product of report.topProducts || []) {
      const key = `${report.role}:${product.id || product.name}`;
      if (productMap.has(key)) continue;
      productMap.set(key, {
        ...product,
        role: report.role,
        role_label: report.label,
        business_name: report.businessName || "—",
        revenue: num(product.revenue ?? product.spent),
        margin: num(product.margin),
      });
    }
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => num(b.revenue) - num(a.revenue))
    .slice(0, 12);

  const serviceMap = new Map<string, Row>();
  for (const report of businessSources) {
    for (const service of report.topServices || []) {
      const key = `${report.role}:${service.id || service.name}`;
      if (serviceMap.has(key)) continue;
      serviceMap.set(key, {
        ...service,
        role: report.role,
        role_label: report.label,
        business_name: report.businessName || "—",
      });
    }
  }
  const topServices = Array.from(serviceMap.values())
    .sort((a, b) => num(b.revenue) - num(a.revenue))
    .slice(0, 12);

  const lowStockMap = new Map<string, Row>();
  for (const report of businessSources) {
    for (const product of report.lowStock || []) {
      if (num(product.stock) < 0 || num(product.stock) >= 5) continue;
      const key = `${report.role}:${product.id || product.name}`;
      if (lowStockMap.has(key)) continue;
      lowStockMap.set(key, {
        ...product,
        role: report.role,
        role_label: report.label,
        business_name: report.businessName || "—",
      });
    }
  }
  const lowStockProducts = Array.from(lowStockMap.values()).sort((a, b) => num(a.stock) - num(b.stock)).slice(0, 20);

  const activityMap = new Map<string, Row>();
  const reportOrder = [...reports].sort((a, b) => {
    if (a.scope === "consumer" && b.scope !== "consumer") return 1;
    if (b.scope === "consumer" && a.scope !== "consumer") return -1;
    return 0;
  });
  for (const report of reportOrder) {
    const addActivity = (type: string, row: Row, detail: string, person: string, amountKey: string) => {
      const id = row.id || `${type}:${detail}:${row.created_at}`;
      const key = `${type}:${id}`;
      if (activityMap.has(key)) return;
      activityMap.set(key, {
        id,
        date: row.created_at,
        type,
        role: report.role,
        role_label: report.label,
        business_name: report.businessName || "—",
        detail,
        person,
        amount: num(row[amountKey]),
        status: row.status || "",
      });
    };

    for (const order of report.recentOrders || []) {
      addActivity(
        "Orden",
        order,
        order.product_name || "Producto",
        report.scope === "consumer" ? order.provider_username || order.provider_name : order.buyer_username || order.buyer_name,
        "total",
      );
    }
    for (const booking of report.recentBookings || []) {
      addActivity(
        "Reserva",
        booking,
        booking.service_name || "Servicio",
        report.scope === "consumer" ? booking.provider_username : booking.traveler_username,
        "total_price",
      );
    }
    for (const ride of report.recentRides || []) {
      addActivity(
        "Viaje",
        ride,
        ride.destination_address || "Destino",
        report.scope === "consumer" ? ride.taxi_username : ride.traveler_username,
        "fare",
      );
    }
  }
  const recentActivity = Array.from(activityMap.values())
    .sort((a, b) => (asDate(b.date)?.getTime() || 0) - (asDate(a.date)?.getTime() || 0))
    .slice(0, 25);

  const roleBreakdown = reports.map((report) => {
    const metrics = report.metrics || {};
    const consumer = report.scope === "consumer";
    const activity = [
      num(metrics.orders) ? `${num(metrics.orders)} órdenes` : "",
      num(metrics.bookings) ? `${num(metrics.bookings)} reservas` : "",
      num(metrics.rides) ? `${num(metrics.rides)} viajes` : "",
    ].filter(Boolean).join(" · ") || "Sin actividad";
    return {
      role: report.role,
      role_label: report.label,
      business_name: report.businessName || "—",
      scope: report.scope,
      movement: consumer ? num(metrics.totalSpent) : num(metrics.revenue),
      expenses: consumer ? 0 : num(metrics.expenses),
      profit: consumer ? 0 : num(metrics.profit),
      activity,
      clients: consumer ? 0 : num(metrics.clients),
      margin: consumer ? 0 : num(metrics.margin),
      rating: consumer ? 0 : num(metrics.rating),
      level: consumer ? metrics.level || "" : "",
    };
  });

  return {
    metrics: {
      revenue: round2(revenue),
      expenses: round2(expenses),
      cogs: round2(cogs),
      platformFee: round2(platformFee),
      profit: round2(profit),
      margin: revenue > 0 ? round2((profit / revenue) * 100) : 0,
      transactions: Math.round(transactions),
      paidOrders: Math.round(paidOrders),
      bookings: Math.round(bookings),
      rides: Math.round(rides),
      clients: Math.round(clients),
      products: Math.round(products),
      totalStock: Math.round(totalStock),
      lowStock: Math.round(lowStock),
      outOfStock: Math.round(outOfStock),
      inventoryValue: round2(inventoryValue),
      avgTicket: transactions > 0 ? round2(revenue / transactions) : 0,
      rating,
      travelerSpend: round2(travelerSpend),
      travelerOrders: Math.round(travelerOrders),
      travelerBookings: Math.round(travelerBookings),
      travelerRides: Math.round(travelerRides),
      travelerPending: Math.round(travelerPending),
      loyaltyPoints: Math.round(loyaltyPoints),
      level: travelerLevel,
      roleCount: reports.length,
      businessCount,
    },
    trend,
    roleBreakdown,
    categoryBreakdown: Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value: round2(value) }))
      .sort((a, b) => b.value - a.value),
    topProducts,
    topServices,
    lowStock: lowStockProducts,
    recentActivity,
  };
}

export async function getAccountAnalytics(options: {
  username: string;
  roles?: string[];
  days?: number;
}): Promise<AccountAnalytics> {
  const { username, days = 30 } = options;
  if (!username) {
    throw Object.assign(new Error("username es obligatorio"), { status: 400 });
  }

  const user = await storage.getUserByUsername(username);
  if (!user) {
    throw Object.assign(new Error("Usuario no encontrado"), { status: 404 });
  }

  let roleRecords: any[] = [];
  try {
    roleRecords = await storage.getUserRoles(user.id);
  } catch {
    roleRecords = [];
  }

  const availableRoles = new Map<string, string | null>();
  for (const record of roleRecords) {
    availableRoles.set(String(record.role), record.businessName || null);
  }
  if (user.role) availableRoles.set(String(user.role), availableRoles.get(String(user.role)) || null);
  availableRoles.set("traveler", availableRoles.get("traveler") || null);
  if (user.role === "admin") availableRoles.set("admin", null);

  const requested = unique((options.roles || []).filter((role) => VALID_ROLES.includes(role)));
  const defaultOrder = [
    ...ROLE_ORDER.filter((role) => availableRoles.has(role)),
    ...Array.from(availableRoles.keys()).filter((role) => !ROLE_ORDER.includes(role)),
  ];
  const selectedRoles = requested.length
    ? requested.filter((role) => availableRoles.has(role))
    : defaultOrder;

  if (selectedRoles.length === 0) {
    throw Object.assign(new Error("No tienes acceso a los roles seleccionados"), { status: 403 });
  }

  const periodDays = Math.min(Math.max(Number(days) || 30, 7), 365);
  const reports = await Promise.all(
    selectedRoles.map(async (role): Promise<AccountRoleReport> => {
      const dashboard = await getDashboardAnalytics({ username, role, days: periodDays });
      const businessName = availableRoles.get(role) || null;
      return {
        role,
        label: roleLabel(role),
        sheetName: roleSheetName(role),
        businessName,
        scope: dashboard.scope as DashboardScope,
        metrics: dashboard.metrics || {},
        trend: dashboard.trend || [],
        categoryBreakdown: dashboard.categoryBreakdown || [],
        topProducts: dashboard.topProducts || [],
        topServices: dashboard.topServices || [],
        lowStock: dashboard.lowStock || [],
        recentOrders: dashboard.recentOrders || [],
        recentBookings: dashboard.recentBookings || [],
        recentRides: dashboard.recentRides || [],
      };
    }),
  );

  const businessNames = unique(
    reports
      .map((report) => report.businessName)
      .filter((value): value is string => Boolean(value)),
  );

  return {
    generatedAt: new Date().toISOString(),
    days: periodDays,
    user: {
      username: user.username,
      name: user.name || user.username,
      businessNames,
      roles: reports.map((report) => ({
        role: report.role,
        label: report.label,
        businessName: report.businessName,
        scope: report.scope,
      })),
    },
    general: summarizeReports(reports),
    reports,
  };
}

// ── Excel helpers ─────────────────────────────────────────────────────────────

const DATA_START_COL = 2;
const DATA_END_COL = 9;
const COLUMN_WIDTHS = [3, 28, 18, 18, 18, 18, 18, 18, 18];

function paintRange(ws: ExcelJS.Worksheet, row1: number, col1: number, row2: number, col2: number, argb: string) {
  for (let row = row1; row <= row2; row += 1) {
    for (let col = col1; col <= col2; col += 1) {
      ws.getCell(row, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    }
  }
}

function borderRange(ws: ExcelJS.Worksheet, row1: number, col1: number, row2: number, col2: number, argb = COLORS.border) {
  for (let row = row1; row <= row2; row += 1) {
    for (let col = col1; col <= col2; col += 1) {
      ws.getCell(row, col).border = {
        top: { style: "thin", color: { argb } },
        left: { style: "thin", color: { argb } },
        bottom: { style: "thin", color: { argb } },
        right: { style: "thin", color: { argb } },
      };
    }
  }
}

function styleBaseSheet(ws: ExcelJS.Worksheet, tabColor: string) {
  ws.properties.tabColor = { argb: tabColor };
  ws.properties.defaultRowHeight = 18;
  ws.views = [{ state: "frozen", ySplit: 6, showGridLines: false }];
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.45, bottom: 0.45, header: 0.15, footer: 0.15 },
  };
  ws.headerFooter.oddFooter = "&LVIANova IA&CReporte generado automáticamente&R&P de &N";
  COLUMN_WIDTHS.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });
  ws.getRow(1).height = 8;
}

function addBrandHeader(
  ws: ExcelJS.Worksheet,
  options: { title: string; businessName: string; detail: string },
  logoId?: number,
) {
  paintRange(ws, 2, 1, 5, DATA_END_COL, COLORS.navy);
  ws.mergeCells(2, 2, 5, 3);
  ws.mergeCells(2, 4, 2, DATA_END_COL);
  ws.mergeCells(3, 4, 3, DATA_END_COL);
  ws.mergeCells(4, 4, 4, DATA_END_COL);
  ws.mergeCells(5, 4, 5, DATA_END_COL);

  const title = ws.getCell(2, 4);
  title.value = "VIANova IA";
  title.font = { name: "Calibri", size: 24, bold: true, color: { argb: COLORS.white } };
  title.alignment = { vertical: "middle", horizontal: "left" };

  const reportTitle = ws.getCell(3, 4);
  reportTitle.value = options.title.toUpperCase();
  reportTitle.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.yellow } };
  reportTitle.alignment = { vertical: "middle", horizontal: "left" };

  const business = ws.getCell(4, 4);
  business.value = options.businessName;
  business.font = { name: "Calibri", size: 14, bold: true, color: { argb: COLORS.white } };
  business.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

  const detail = ws.getCell(5, 4);
  detail.value = options.detail;
  detail.font = { name: "Calibri", size: 9, color: { argb: "FFCBD5E1" } };
  detail.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

  ws.getRow(2).height = 30;
  ws.getRow(3).height = 22;
  ws.getRow(4).height = 28;
  ws.getRow(5).height = 20;

  if (logoId !== undefined) {
    ws.addImage(logoId, {
      tl: { col: 1.28, row: 1.25 },
      ext: { width: 64, height: 64 },
      editAs: "oneCell",
    });
  }

  paintRange(ws, 6, 1, 6, DATA_END_COL, COLORS.yellow);
  ws.mergeCells(6, 1, 6, DATA_END_COL);
  ws.getRow(6).height = 5;
}

function addSection(ws: ExcelJS.Worksheet, row: number, title: string) {
  paintRange(ws, row, 1, row, DATA_END_COL, COLORS.yellow);
  ws.getCell(row, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.yellow } };
  paintRange(ws, row, 2, row, DATA_END_COL, COLORS.panel);
  ws.mergeCells(row, 2, row, DATA_END_COL);
  const cell = ws.getCell(row, 2);
  cell.value = title.toUpperCase();
  cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.navy } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  borderRange(ws, row, 1, row, DATA_END_COL);
  ws.getRow(row).height = 25;
}

function addInfoCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  endCol: number,
  label: string,
  value: string,
  options: { label?: boolean } = {},
) {
  ws.mergeCells(row, col, row, endCol);
  const cell = ws.getCell(row, col);
  cell.value = options.label ? label : value;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.label ? COLORS.panel : COLORS.white } };
  cell.font = options.label
    ? { name: "Calibri", size: 8, bold: true, color: { argb: COLORS.slate } }
    : { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.slateDark } };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
  borderRange(ws, row, col, row, endCol);
}

function addInfoGrid(
  ws: ExcelJS.Worksheet,
  startRow: number,
  items: Array<{ label: string; value: string; labelCol: number; valueCol: number; endCol: number }>,
) {
  for (const item of items) {
    addInfoCell(ws, startRow, item.labelCol, item.labelCol, item.label, "", { label: true });
    addInfoCell(ws, startRow, item.valueCol, item.endCol, "", item.value);
  }
  ws.getRow(startRow).height = 24;
}

type KpiSpec = {
  label: string;
  value: string | number;
  hint: string;
  format?: string;
  accent: string;
};

function addKpiCard(ws: ExcelJS.Worksheet, row: number, col: number, kpi: KpiSpec) {
  const endCol = col + 1;
  ws.mergeCells(row, col, row, endCol);
  ws.mergeCells(row + 1, col, row + 2, endCol);
  ws.mergeCells(row + 3, col, row + 3, endCol);

  for (let r = row; r <= row + 3; r += 1) {
    for (let c = col; c <= endCol; c += 1) {
      const cell = ws.getCell(r, c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: r === row ? COLORS.panel : COLORS.white },
      };
      cell.border = {
        top: { style: "thin", color: { argb: COLORS.border } },
        left: c === col ? { style: "thick", color: { argb: kpi.accent } } : { style: "thin", color: { argb: COLORS.border } },
        bottom: { style: "thin", color: { argb: COLORS.border } },
        right: { style: "thin", color: { argb: COLORS.border } },
      };
    }
  }

  const label = ws.getCell(row, col);
  label.value = kpi.label.toUpperCase();
  label.font = { name: "Calibri", size: 8, bold: true, color: { argb: COLORS.slate } };
  label.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };

  const value = ws.getCell(row + 1, col);
  value.value = kpi.value;
  value.font = {
    name: "Calibri",
    size: typeof kpi.value === "number" ? 19 : 14,
    bold: true,
    color: { argb: kpi.accent },
  };
  value.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  if (kpi.format) value.numFmt = kpi.format;

  const hint = ws.getCell(row + 3, col);
  hint.value = kpi.hint;
  hint.font = { name: "Calibri", size: 8, color: { argb: COLORS.slate } };
  hint.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
}

function addKpiGrid(ws: ExcelJS.Worksheet, startRow: number, kpis: KpiSpec[]): number {
  let row = startRow;
  for (let index = 0; index < kpis.length; index += 4) {
    const group = kpis.slice(index, index + 4);
    group.forEach((kpi, groupIndex) => addKpiCard(ws, row, DATA_START_COL + groupIndex * 2, kpi));
    ws.getRow(row).height = 18;
    ws.getRow(row + 1).height = 22;
    ws.getRow(row + 2).height = 22;
    ws.getRow(row + 3).height = 16;
    ws.getRow(row + 4).height = 6;
    row += 5;
  }
  return row;
}

type TableCell = {
  value: string | number | Date | null;
  format?: string;
  align?: "left" | "right" | "center";
  fill?: string;
  color?: string;
  bold?: boolean;
  wrap?: boolean;
};

type TableColumn = {
  header: string;
  align?: "left" | "right" | "center";
};

function addTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  columns: TableColumn[],
  rows: TableCell[][],
  options: { emptyText?: string; totalRow?: TableCell[]; rowHeight?: number } = {},
): number {
  const startCol = DATA_START_COL;
  const endCol = startCol + columns.length - 1;

  for (let index = 0; index < columns.length; index += 1) {
    const cell = ws.getCell(startRow, startCol + index);
    cell.value = columns[index].header.toUpperCase();
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navySoft } };
    cell.font = { name: "Calibri", size: 8, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { vertical: "middle", horizontal: columns[index].align || "left", wrapText: true, indent: 1 };
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.navySoft } },
      left: { style: "thin", color: { argb: COLORS.navySoft } },
      bottom: { style: "thick", color: { argb: COLORS.yellow } },
      right: { style: "thin", color: { argb: COLORS.navySoft } },
    };
  }
  ws.getRow(startRow).height = 26;

  if (rows.length === 0) {
    ws.mergeCells(startRow + 1, startCol, startRow + 1, endCol);
    const cell = ws.getCell(startRow + 1, startCol);
    cell.value = options.emptyText || "Sin datos en este periodo.";
    cell.font = { name: "Calibri", size: 10, italic: true, color: { argb: COLORS.slate } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    paintRange(ws, startRow + 1, startCol, startRow + 1, endCol, COLORS.panel);
    borderRange(ws, startRow + 1, startCol, startRow + 1, endCol);
    ws.getRow(startRow + 1).height = 30;
    return startRow + 3;
  }

  rows.forEach((row, rowIndex) => {
    const excelRow = startRow + 1 + rowIndex;
    row.forEach((cellSpec, colIndex) => {
      const cell = ws.getCell(excelRow, startCol + colIndex);
      cell.value = cellSpec.value === null || cellSpec.value === undefined ? "" : cellSpec.value;
      cell.font = {
        name: "Calibri",
        size: 9,
        bold: Boolean(cellSpec.bold),
        color: { argb: cellSpec.color || COLORS.slateDark },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: cellSpec.align || columns[colIndex]?.align || "left",
        wrapText: cellSpec.wrap !== false,
        indent: 1,
      };
      if (cellSpec.format) cell.numFmt = cellSpec.format;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: cellSpec.fill || (rowIndex % 2 === 1 ? COLORS.panel : COLORS.white) },
      };
      cell.border = {
        top: { style: "thin", color: { argb: COLORS.border } },
        left: { style: "thin", color: { argb: COLORS.border } },
        bottom: { style: "thin", color: { argb: COLORS.border } },
        right: { style: "thin", color: { argb: COLORS.border } },
      };
    });
    let maxLines = 1;
    row.forEach((cellSpec, colIndex) => {
      const text = String(cellSpec.value ?? "");
      const width = COLUMN_WIDTHS[startCol + colIndex] || 18;
      const lines = Math.max(1, Math.ceil(text.length / Math.max(6, width - 3)));
      maxLines = Math.max(maxLines, lines);
    });
    ws.getRow(excelRow).height = Math.min(60, Math.max(options.rowHeight || 21, maxLines * 12 + 6));
  });

  let lastRow = startRow + rows.length;
  if (options.totalRow) {
    lastRow += 1;
    options.totalRow.forEach((cellSpec, colIndex) => {
      const cell = ws.getCell(lastRow, startCol + colIndex);
      cell.value = cellSpec.value === null || cellSpec.value === undefined ? "" : cellSpec.value;
      cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: cellSpec.color || COLORS.navy } };
      cell.alignment = {
        vertical: "middle",
        horizontal: cellSpec.align || columns[colIndex]?.align || "left",
        wrapText: true,
        indent: 1,
      };
      if (cellSpec.format) cell.numFmt = cellSpec.format;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.yellowSoft } };
      cell.border = {
        top: { style: "thick", color: { argb: COLORS.yellow } },
        left: { style: "thin", color: { argb: COLORS.border } },
        bottom: { style: "thin", color: { argb: COLORS.border } },
        right: { style: "thin", color: { argb: COLORS.border } },
      };
    });
    ws.getRow(lastRow).height = 24;
  }

  return lastRow + 2;
}

function addMetricTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  rows: Array<{ label: string; value: string | number; format?: string; description: string }>,
): number {
  const startCol = DATA_START_COL;
  ws.mergeCells(startRow, startCol, startRow, startCol + 1);
  ws.getCell(startRow, startCol).value = "MÉTRICA";
  ws.mergeCells(startRow, startCol + 2, startRow, DATA_END_COL);
  ws.getCell(startRow, startCol + 2).value = "DETALLE";

  for (let col = startCol; col <= DATA_END_COL; col += 1) {
    const cell = ws.getCell(startRow, col);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navySoft } };
    cell.font = { name: "Calibri", size: 8, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { vertical: "middle", horizontal: col === startCol + 1 ? "right" : "left", indent: 1 };
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.navySoft } },
      left: { style: "thin", color: { argb: COLORS.navySoft } },
      bottom: { style: "thick", color: { argb: COLORS.yellow } },
      right: { style: "thin", color: { argb: COLORS.navySoft } },
    };
  }
  ws.getRow(startRow).height = 25;

  rows.forEach((metric, index) => {
    const excelRow = startRow + 1 + index;
    const fill = index % 2 === 1 ? COLORS.panel : COLORS.white;

    const label = ws.getCell(excelRow, startCol);
    label.value = metric.label;
    label.font = { name: "Calibri", size: 9, bold: true, color: { argb: COLORS.slateDark } };
    label.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    label.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };

    const value = ws.getCell(excelRow, startCol + 1);
    value.value = metric.value;
    value.font = { name: "Calibri", size: 9, bold: true, color: { argb: COLORS.navy } };
    value.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    if (metric.format) value.numFmt = metric.format;
    value.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };

    ws.mergeCells(excelRow, startCol + 2, excelRow, DATA_END_COL);
    const description = ws.getCell(excelRow, startCol + 2);
    description.value = metric.description;
    description.font = { name: "Calibri", size: 9, color: { argb: COLORS.slate } };
    description.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
    description.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };

    borderRange(ws, excelRow, startCol, excelRow, DATA_END_COL);
    ws.getRow(excelRow).height = 21;
  });

  return startRow + rows.length + 2;
}

function addFooter(ws: ExcelJS.Worksheet, row: number) {
  ws.mergeCells(row, 1, row, DATA_END_COL);
  paintRange(ws, row, 1, row, DATA_END_COL, COLORS.navy);
  const cell = ws.getCell(row, 1);
  cell.value = "VIANova IA  ·  Reporte generado automáticamente  ·  Datos del periodo seleccionado  ·  vianova.app";
  cell.font = { name: "Calibri", size: 8, color: { argb: "FFCBD5E1" } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(row).height = 24;
  ws.pageSetup.printArea = `A1:I${row}`;
  ws.pageSetup.printTitlesRow = "1:6";
}

function metricRows(report: AccountRoleReport) {
  const m = report.metrics || {};
  if (report.scope === "consumer") {
    return [
      { label: "Gasto total", value: num(m.totalSpent), format: NF_MONEY, description: "Compras, reservas y viajes pagados en el periodo." },
      { label: "Compras", value: num(m.orders), format: NF_INT, description: "Órdenes de marketplace pagadas o completadas." },
      { label: "Reservas", value: num(m.bookings), format: NF_INT, description: "Reservas de servicios confirmadas o completadas." },
      { label: "Viajes", value: num(m.rides), format: NF_INT, description: "Viajes en taxi completados." },
      { label: "Pendientes", value: num(m.pendingOrders), format: NF_INT, description: "Órdenes y reservas pendientes de confirmación." },
      { label: "Viajes activos", value: num(m.activeRides), format: NF_INT, description: "Viajes aceptados o en curso." },
      { label: "Ticket promedio", value: num(m.avgTicket), format: NF_MONEY, description: "Gasto medio por transacción." },
      { label: "Puntos VIANova", value: num(m.loyaltyPoints), format: NF_INT, description: "Puntos acumulados por actividad." },
      { label: "Nivel", value: String(m.level || "Explorador"), description: "Nivel de fidelidad del viajero." },
      { label: "Reseñas escritas", value: num(m.reviews), format: NF_INT, description: "Reseñas publicadas por la cuenta." },
      { label: "Publicaciones", value: num(m.posts), format: NF_INT, description: "Publicaciones realizadas en la comunidad." },
    ];
  }

  if (report.scope === "admin") {
    return [
      { label: "Ingresos globales", value: num(m.revenue), format: NF_MONEY, description: "Ventas pagadas de toda la plataforma." },
      { label: "Gastos", value: num(m.expenses), format: NF_MONEY, description: "COGS y comisión de plataforma." },
      { label: "Ganancia neta", value: num(m.profit), format: NF_MONEY, description: "Ingresos menos gastos." },
      { label: "Margen", value: num(m.margin), format: NF_PCT, description: "Ganancia neta sobre ingresos." },
      { label: "Transacciones", value: num(m.orders), format: NF_INT, description: "Órdenes, reservas y viajes completados." },
      { label: "Usuarios", value: num(m.users), format: NF_INT, description: "Cuentas registradas en la plataforma." },
      { label: "Nuevos usuarios", value: num(m.newUsers), format: NF_INT, description: "Registros creados en el periodo." },
      { label: "Proveedores", value: num(m.providers), format: NF_INT, description: "Cuentas con rol de negocio." },
      { label: "Stock total", value: num(m.totalStock), format: NF_INT, description: "Unidades disponibles en inventario." },
      { label: "Stock bajo", value: num(m.lowStock), format: NF_INT, description: "Productos con menos de 5 unidades." },
      { label: "Agotados", value: num(m.outOfStock), format: NF_INT, description: "Productos sin unidades disponibles." },
      { label: "Ticket promedio", value: num(m.avgTicket), format: NF_MONEY, description: "Ingreso medio por transacción." },
    ];
  }

  return [
    { label: "Ingresos", value: num(m.revenue), format: NF_MONEY, description: "Ventas y reservas pagadas del periodo." },
    { label: "Gastos", value: num(m.expenses), format: NF_MONEY, description: "COGS más comisión de plataforma." },
    { label: "Costo de producto", value: num(m.cogs), format: NF_MONEY, description: "Costo directo de los productos vendidos." },
    { label: "Comisión plataforma", value: num(m.platformFee), format: NF_MONEY, description: "Comisión calculada sobre ingresos." },
    { label: "Ganancia neta", value: num(m.profit), format: NF_MONEY, description: "Ingresos menos gastos." },
    { label: "Margen", value: num(m.margin), format: NF_PCT, description: "Ganancia neta sobre ingresos." },
    { label: "Transacciones", value: num(m.orders), format: NF_INT, description: "Órdenes, reservas y viajes completados." },
    { label: "Órdenes pagadas", value: num(m.paidOrders), format: NF_INT, description: "Ventas de productos pagadas o completadas." },
    { label: "Órdenes pendientes", value: num(m.pendingOrders), format: NF_INT, description: "Órdenes y reservas pendientes." },
    { label: "Reservas", value: num(m.bookings), format: NF_INT, description: "Reservas confirmadas o completadas." },
    { label: "Viajes", value: num(m.rides), format: NF_INT, description: "Viajes o servicios de transporte completados." },
    { label: "Clientes", value: num(m.clients), format: NF_INT, description: "Compradores únicos del periodo." },
    { label: "Productos publicados", value: num(m.products), format: NF_INT, description: "Productos del rol activo." },
    { label: "Stock total", value: num(m.totalStock), format: NF_INT, description: "Unidades disponibles en inventario." },
    { label: "Stock bajo", value: num(m.lowStock), format: NF_INT, description: "Productos con menos de 5 unidades." },
    { label: "Agotados", value: num(m.outOfStock), format: NF_INT, description: "Productos sin unidades disponibles." },
    { label: "Valor inventario", value: num(m.inventoryValue), format: NF_MONEY, description: "Stock valorizado a precio de venta." },
    { label: "Ticket promedio", value: num(m.avgTicket), format: NF_MONEY, description: "Ingreso medio por transacción." },
    { label: "Calificación", value: num(m.rating), format: NF_RATING, description: "Promedio de reseñas recibidas." },
  ];
}

function businessKpis(report: AccountRoleReport, general = false): KpiSpec[] {
  const m = report.metrics || {};
  if (general) {
    return [];
  }
  return [
    { label: "Ingresos", value: num(m.revenue), format: NF_MONEY, hint: `${num(m.orders).toLocaleString("es-CO")} transacciones`, accent: COLORS.yellow },
    { label: "Ganancia neta", value: num(m.profit), format: NF_MONEY, hint: `Margen ${num(m.margin).toFixed(1)}%`, accent: COLORS.green },
    { label: "Gastos", value: num(m.expenses), format: NF_MONEY, hint: "COGS + comisión", accent: COLORS.orange },
    { label: "Ticket promedio", value: num(m.avgTicket), format: NF_MONEY, hint: `${num(m.clients).toLocaleString("es-CO")} clientes`, accent: COLORS.blue },
    { label: "Clientes", value: num(m.clients), format: NF_INT, hint: "Compradores únicos", accent: COLORS.purple },
    { label: "Stock total", value: num(m.totalStock), format: NF_INT, hint: `${num(m.products).toLocaleString("es-CO")} productos`, accent: COLORS.blue },
    { label: "Alertas de stock", value: num(m.lowStock) + num(m.outOfStock), format: NF_INT, hint: `${num(m.lowStock)} bajos · ${num(m.outOfStock)} agotados`, accent: COLORS.red },
    { label: "Calificación", value: num(m.rating), format: NF_RATING, hint: "Promedio de reseñas", accent: COLORS.yellow },
  ];
}

function consumerKpis(report: AccountRoleReport): KpiSpec[] {
  const m = report.metrics || {};
  return [
    { label: "Gasto total", value: num(m.totalSpent), format: NF_MONEY, hint: "Compras, reservas y viajes", accent: COLORS.yellow },
    { label: "Compras", value: num(m.orders), format: NF_INT, hint: `${num(m.pendingOrders)} pendientes`, accent: COLORS.blue },
    { label: "Reservas", value: num(m.bookings), format: NF_INT, hint: "Servicios confirmados", accent: COLORS.green },
    { label: "Viajes", value: num(m.rides), format: NF_INT, hint: `${num(m.activeRides)} en curso`, accent: COLORS.orange },
    { label: "Puntos VIANova", value: num(m.loyaltyPoints), format: NF_INT, hint: `Nivel ${m.level || "Explorador"}`, accent: COLORS.purple },
    { label: "Ticket promedio", value: num(m.avgTicket), format: NF_MONEY, hint: "Por transacción", accent: COLORS.blue },
    { label: "Reseñas", value: num(m.reviews), format: NF_INT, hint: "Escritas por la cuenta", accent: COLORS.green },
    { label: "Publicaciones", value: num(m.posts), format: NF_INT, hint: "En la comunidad", accent: COLORS.yellow },
  ];
}

function roleKpis(report: AccountRoleReport): KpiSpec[] {
  if (report.scope === "consumer") return consumerKpis(report);
  if (report.scope === "admin") {
    const m = report.metrics || {};
    return [
      { label: "Ingresos globales", value: num(m.revenue), format: NF_MONEY, hint: `${num(m.orders).toLocaleString("es-CO")} transacciones`, accent: COLORS.yellow },
      { label: "Ganancia neta", value: num(m.profit), format: NF_MONEY, hint: `Margen ${num(m.margin).toFixed(1)}%`, accent: COLORS.green },
      { label: "Gastos", value: num(m.expenses), format: NF_MONEY, hint: "COGS + comisión", accent: COLORS.orange },
      { label: "Usuarios", value: num(m.users), format: NF_INT, hint: `${num(m.newUsers).toLocaleString("es-CO")} nuevos`, accent: COLORS.blue },
      { label: "Proveedores", value: num(m.providers), format: NF_INT, hint: "Cuentas de negocio", accent: COLORS.purple },
      { label: "Stock total", value: num(m.totalStock), format: NF_INT, hint: "Unidades disponibles", accent: COLORS.blue },
      { label: "Alertas de stock", value: num(m.lowStock) + num(m.outOfStock), format: NF_INT, hint: `${num(m.lowStock)} bajos · ${num(m.outOfStock)} agotados`, accent: COLORS.red },
      { label: "Ticket promedio", value: num(m.avgTicket), format: NF_MONEY, hint: "Ingreso medio", accent: COLORS.green },
    ];
  }
  return businessKpis(report);
}

function generalKpis(reports: AccountRoleReport[], general: AccountAnalytics["general"]): KpiSpec[] {
  const m = general.metrics;
  const hasBusiness = reports.some((report) => report.scope === "business");
  const hasTraveler = reports.some((report) => report.scope === "consumer");
  const hasAdmin = reports.some((report) => report.scope === "admin");

  if (!hasBusiness && !hasAdmin && hasTraveler) {
    return [
      { label: "Gasto total", value: num(m.travelerSpend), format: NF_MONEY, hint: "Compras, reservas y viajes", accent: COLORS.yellow },
      { label: "Compras", value: num(m.travelerOrders), format: NF_INT, hint: "Órdenes pagadas", accent: COLORS.blue },
      { label: "Reservas", value: num(m.travelerBookings), format: NF_INT, hint: "Servicios confirmados", accent: COLORS.green },
      { label: "Viajes", value: num(m.travelerRides), format: NF_INT, hint: "Recorridos completados", accent: COLORS.orange },
      { label: "Puntos VIANova", value: num(m.loyaltyPoints), format: NF_INT, hint: `Nivel ${m.level || "Explorador"}`, accent: COLORS.purple },
      { label: "Pendientes", value: num(m.travelerPending), format: NF_INT, hint: "Por confirmar", accent: COLORS.red },
      { label: "Roles incluidos", value: num(m.roleCount), format: NF_INT, hint: "General + hojas por rol", accent: COLORS.blue },
      { label: "Negocios", value: num(m.businessCount), format: NF_INT, hint: "En la cuenta", accent: COLORS.yellow },
    ];
  }

  return [
    { label: "Ingresos de negocio", value: num(m.revenue), format: NF_MONEY, hint: `${num(m.transactions).toLocaleString("es-CO")} transacciones`, accent: COLORS.yellow },
    { label: "Ganancia neta", value: num(m.profit), format: NF_MONEY, hint: `Margen ${num(m.margin).toFixed(1)}%`, accent: COLORS.green },
    { label: "Gastos", value: num(m.expenses), format: NF_MONEY, hint: "COGS + comisión", accent: COLORS.orange },
    { label: "Clientes", value: num(m.clients), format: NF_INT, hint: `${num(m.businessCount)} negocios`, accent: COLORS.blue },
    { label: "Gasto del viajero", value: num(m.travelerSpend), format: NF_MONEY, hint: `${num(m.travelerOrders)} compras`, accent: COLORS.purple },
    { label: "Reservas", value: num(m.bookings), format: NF_INT, hint: `${num(m.rides)} viajes`, accent: COLORS.green },
    { label: "Stock total", value: num(m.totalStock), format: NF_INT, hint: `${num(m.lowStock)} bajos · ${num(m.outOfStock)} agotados`, accent: COLORS.blue },
    { label: "Roles incluidos", value: num(m.roleCount), format: NF_INT, hint: "General + hojas por rol", accent: COLORS.yellow },
  ];
}

function generalRows(general: AccountAnalytics["general"]): TableCell[][] {
  return general.roleBreakdown.map((row) => {
    const consumer = row.scope === "consumer";
    return [
      { value: row.role_label, bold: true, color: ROLE_META[row.role]?.color || COLORS.navy },
      { value: row.business_name },
      { value: num(row.movement), format: NF_MONEY, align: "right" },
      { value: consumer ? "—" : num(row.expenses), format: consumer ? undefined : NF_MONEY, align: "right" },
      { value: consumer ? "—" : num(row.profit), format: consumer ? undefined : NF_MONEY, align: "right" },
      { value: row.activity },
      { value: consumer ? "—" : num(row.clients), format: consumer ? undefined : NF_INT, align: "right" },
      { value: consumer ? row.level || "—" : `${num(row.margin).toFixed(1)}%`, align: "right" },
    ];
  });
}

function generalTotals(reports: AccountRoleReport[], general: AccountAnalytics["general"]): TableCell[] {
  const m = general.metrics;
  const hasBusiness = reports.some((report) => report.scope === "business") || reports.some((report) => report.scope === "admin");
  return [
    { value: "TOTAL", bold: true },
    { value: `${reports.length} roles`, bold: true },
    { value: num(m.revenue) + num(m.travelerSpend), format: NF_MONEY, align: "right", bold: true },
    { value: num(m.expenses), format: NF_MONEY, align: "right", bold: true },
    { value: num(m.profit), format: NF_MONEY, align: "right", bold: true },
    { value: `${num(m.transactions)} transacciones`, bold: true },
    { value: num(m.clients), format: NF_INT, align: "right", bold: true },
    { value: hasBusiness ? `${num(m.margin).toFixed(1)}%` : m.level || "—", align: "right", bold: true },
  ];
}

function addGeneralSheet(workbook: ExcelJS.Workbook, data: AccountAnalytics, logoId?: number) {
  const ws = workbook.addWorksheet("General", { properties: { tabColor: { argb: COLORS.yellow } } });
  styleBaseSheet(ws, COLORS.yellow);

  const businessLabel = data.user.businessNames.length
    ? data.user.businessNames.join(" · ")
    : data.user.name;
  addBrandHeader(
    ws,
    {
      title: "Reporte general de la cuenta",
      businessName: businessLabel,
      detail: `Periodo: últimos ${data.days} días  ·  Generado: ${dateTimeLabel(data.generatedAt)}  ·  Moneda: COP  ·  ${data.reports.length} roles incluidos`,
    },
    logoId,
  );

  let row = 8;
  addSection(ws, row, "Resumen de la cuenta");
  row += 1;
  addInfoGrid(ws, row, [
    { label: "CUENTA", value: data.user.name, labelCol: 2, valueCol: 3, endCol: 4 },
    { label: "PERIODO", value: `Últimos ${data.days} días`, labelCol: 5, valueCol: 6, endCol: 7 },
    { label: "MONEDA", value: "COP · Peso colombiano", labelCol: 8, valueCol: 9, endCol: 9 },
  ]);
  row += 1;
  addInfoGrid(ws, row, [
    { label: "NEGOCIOS", value: data.user.businessNames.join(" · ") || data.user.name, labelCol: 2, valueCol: 3, endCol: 6 },
    { label: "ROLES", value: data.reports.map((report) => report.label).join(" · "), labelCol: 7, valueCol: 8, endCol: 9 },
  ]);
  row += 1;
  addInfoGrid(ws, row, [
    { label: "GENERADO", value: dateTimeLabel(data.generatedAt), labelCol: 2, valueCol: 3, endCol: 6 },
    { label: "REPORTE", value: "General + hojas por rol", labelCol: 7, valueCol: 8, endCol: 9 },
  ]);
  row += 2;

  addSection(ws, row, "Indicadores generales");
  row += 1;
  row = addKpiGrid(ws, row, generalKpis(data.reports, data.general));

  addSection(ws, row, "Comparativo por rol");
  row += 1;
  row = addTable(
    ws,
    row,
    [
      { header: "Rol" },
      { header: "Negocio" },
      { header: "Ingresos / Gasto", align: "right" },
      { header: "Gastos", align: "right" },
      { header: "Ganancia", align: "right" },
      { header: "Actividad" },
      { header: "Clientes", align: "right" },
      { header: "Margen / Nivel", align: "right" },
    ],
    generalRows(data.general),
    { totalRow: generalTotals(data.reports, data.general), rowHeight: 24 },
  );

  addSection(ws, row, "Tendencia combinada");
  row += 1;
  const trendRows: TableCell[][] = data.general.trend.map((point) => {
    const margin = point.revenue > 0 ? (point.profit / point.revenue) * 100 : 0;
    return [
      { value: asDate(point.date) || point.date, format: NF_DATE },
      { value: point.revenue, format: NF_MONEY, align: "right" },
      { value: point.travelerSpend, format: NF_MONEY, align: "right" },
      { value: point.expenses, format: NF_MONEY, align: "right" },
      { value: point.profit, format: NF_MONEY, align: "right" },
      { value: point.businessOrders, format: NF_INT, align: "right" },
      { value: point.travelerOrders, format: NF_INT, align: "right" },
      { value: margin, format: NF_PCT, align: "right" },
    ];
  });
  const trendTotal = data.general.trend.reduce(
    (total, point) => ({
      revenue: total.revenue + point.revenue,
      travelerSpend: total.travelerSpend + point.travelerSpend,
      expenses: total.expenses + point.expenses,
      profit: total.profit + point.profit,
      businessOrders: total.businessOrders + point.businessOrders,
      travelerOrders: total.travelerOrders + point.travelerOrders,
    }),
    { revenue: 0, travelerSpend: 0, expenses: 0, profit: 0, businessOrders: 0, travelerOrders: 0 },
  );
  row = addTable(
    ws,
    row,
    [
      { header: "Fecha" },
      { header: "Ingresos negocio", align: "right" },
      { header: "Gasto viajero", align: "right" },
      { header: "Gastos", align: "right" },
      { header: "Ganancia", align: "right" },
      { header: "Transacciones negocio", align: "right" },
      { header: "Transacciones viajero", align: "right" },
      { header: "Margen", align: "right" },
    ],
    trendRows,
    {
      emptyText: "Sin movimientos en el periodo.",
      totalRow: [
        { value: "TOTAL", bold: true },
        { value: trendTotal.revenue, format: NF_MONEY, align: "right", bold: true },
        { value: trendTotal.travelerSpend, format: NF_MONEY, align: "right", bold: true },
        { value: trendTotal.expenses, format: NF_MONEY, align: "right", bold: true },
        { value: trendTotal.profit, format: NF_MONEY, align: "right", bold: true },
        { value: trendTotal.businessOrders, format: NF_INT, align: "right", bold: true },
        { value: trendTotal.travelerOrders, format: NF_INT, align: "right", bold: true },
        { value: trendTotal.revenue > 0 ? (trendTotal.profit / trendTotal.revenue) * 100 : 0, format: NF_PCT, align: "right", bold: true },
      ],
    },
  );

  addSection(ws, row, "Productos destacados");
  row += 1;
  const productRows: TableCell[][] = data.general.topProducts.map((product) => [
    { value: product.role_label, bold: true },
    { value: product.business_name },
    { value: product.name || "Producto" },
    { value: normalizeCategory(product.role_category) },
    { value: num(product.units), format: NF_INT, align: "right" },
    { value: num(product.revenue), format: NF_MONEY, align: "right" },
    { value: num(product.margin), format: NF_MONEY, align: "right" },
    { value: num(product.stock) === -1 ? "∞" : num(product.stock), format: num(product.stock) === -1 ? undefined : NF_INT, align: "right" },
  ]);
  const productTotal = data.general.topProducts.reduce(
    (total, product) => ({
      units: total.units + num(product.units),
      revenue: total.revenue + num(product.revenue),
      margin: total.margin + num(product.margin),
    }),
    { units: 0, revenue: 0, margin: 0 },
  );
  row = addTable(
    ws,
    row,
    [
      { header: "Rol" },
      { header: "Negocio" },
      { header: "Producto" },
      { header: "Categoría" },
      { header: "Unidades", align: "right" },
      { header: "Ingresos", align: "right" },
      { header: "Margen", align: "right" },
      { header: "Stock", align: "right" },
    ],
    productRows,
    {
      emptyText: "Sin ventas de productos en el periodo.",
      totalRow: [
        { value: "TOTAL", bold: true },
        { value: "", bold: true },
        { value: `${data.general.topProducts.length} productos`, bold: true },
        { value: "", bold: true },
        { value: productTotal.units, format: NF_INT, align: "right", bold: true },
        { value: productTotal.revenue, format: NF_MONEY, align: "right", bold: true },
        { value: productTotal.margin, format: NF_MONEY, align: "right", bold: true },
        { value: "", bold: true },
      ],
    },
  );

  addSection(ws, row, "Servicios más reservados");
  row += 1;
  const serviceRows: TableCell[][] = data.general.topServices.map((service) => [
    { value: service.role_label, bold: true },
    { value: service.business_name },
    { value: service.name || "Servicio" },
    { value: normalizeCategory(service.category) },
    { value: num(service.bookings), format: NF_INT, align: "right" },
    { value: num(service.revenue), format: NF_MONEY, align: "right" },
    { value: num(service.bookings) > 0 ? num(service.revenue) / num(service.bookings) : 0, format: NF_MONEY, align: "right" },
    { value: "", format: undefined },
  ]);
  const serviceTotal = data.general.topServices.reduce(
    (total, service) => ({
      bookings: total.bookings + num(service.bookings),
      revenue: total.revenue + num(service.revenue),
    }),
    { bookings: 0, revenue: 0 },
  );
  row = addTable(
    ws,
    row,
    [
      { header: "Rol" },
      { header: "Negocio" },
      { header: "Servicio" },
      { header: "Categoría" },
      { header: "Reservas", align: "right" },
      { header: "Ingresos", align: "right" },
      { header: "Ticket promedio", align: "right" },
      { header: "" },
    ],
    serviceRows,
    {
      emptyText: "Sin reservas de servicios en el periodo.",
      totalRow: [
        { value: "TOTAL", bold: true },
        { value: "", bold: true },
        { value: `${data.general.topServices.length} servicios`, bold: true },
        { value: "", bold: true },
        { value: serviceTotal.bookings, format: NF_INT, align: "right", bold: true },
        { value: serviceTotal.revenue, format: NF_MONEY, align: "right", bold: true },
        { value: serviceTotal.bookings > 0 ? serviceTotal.revenue / serviceTotal.bookings : 0, format: NF_MONEY, align: "right", bold: true },
        { value: "", bold: true },
      ],
    },
  );

  addSection(ws, row, "Alertas de inventario");
  row += 1;
  const stockRows: TableCell[][] = data.general.lowStock.map((product) => [
    { value: product.role_label, bold: true },
    { value: product.business_name },
    { value: product.name || "Producto" },
    { value: normalizeCategory(product.role_category) },
    { value: num(product.stock), format: NF_INT, align: "right", color: num(product.stock) === 0 ? COLORS.red : "FFA16207", fill: num(product.stock) === 0 ? COLORS.redSoft : COLORS.yellowSoft },
    { value: num(product.price), format: NF_MONEY, align: "right" },
    { value: num(product.stock) * num(product.price), format: NF_MONEY, align: "right" },
    { value: num(product.stock) === 0 ? "AGOTADO" : "BAJO", color: num(product.stock) === 0 ? COLORS.red : "FFA16207" },
  ]);
  row = addTable(
    ws,
    row,
    [
      { header: "Rol" },
      { header: "Negocio" },
      { header: "Producto" },
      { header: "Categoría" },
      { header: "Stock", align: "right" },
      { header: "Precio", align: "right" },
      { header: "Valor inventario", align: "right" },
      { header: "Alerta" },
    ],
    stockRows,
    { emptyText: "Inventario saludable: no hay productos con stock bajo." },
  );

  addSection(ws, row, "Actividad reciente");
  row += 1;
  const activityRows: TableCell[][] = data.general.recentActivity.map((activity) => {
    const status = statusFill(activity.status);
    return [
      { value: asDate(activity.date) || activity.date || "—", format: asDate(activity.date) ? NF_DATE : undefined },
      { value: activity.type, bold: true },
      { value: activity.role_label },
      { value: activity.business_name },
      { value: activity.detail || "—" },
      { value: emptyIfNil(activity.person) },
      { value: num(activity.amount), format: NF_MONEY, align: "right" },
      { value: String(activity.status || "—").toUpperCase(), fill: status.fill, color: status.color },
    ];
  });
  row = addTable(
    ws,
    row,
    [
      { header: "Fecha" },
      { header: "Tipo" },
      { header: "Rol" },
      { header: "Negocio" },
      { header: "Detalle" },
      { header: "Persona" },
      { header: "Total", align: "right" },
      { header: "Estado" },
    ],
    activityRows,
    { emptyText: "Sin actividad reciente en el periodo." },
  );

  addFooter(ws, row);
  return ws;
}

function addRoleSheet(workbook: ExcelJS.Workbook, data: AccountAnalytics, report: AccountRoleReport, logoId?: number) {
  const ws = workbook.addWorksheet(report.sheetName, { properties: { tabColor: { argb: ROLE_META[report.role]?.color || COLORS.yellow } } });
  styleBaseSheet(ws, ROLE_META[report.role]?.color || COLORS.yellow);

  addBrandHeader(
    ws,
    {
      title: `Reporte de ${report.label}`,
      businessName: report.businessName || data.user.name,
      detail: `Periodo: últimos ${data.days} días  ·  Generado: ${dateTimeLabel(data.generatedAt)}  ·  Moneda: COP  ·  Cuenta: @${data.user.username}`,
    },
    logoId,
  );

  let row = 8;
  addSection(ws, row, "Indicadores del rol");
  row += 1;
  row = addKpiGrid(ws, row, roleKpis(report));

  addSection(ws, row, "Detalle de métricas");
  row += 1;
  row = addMetricTable(ws, row, metricRows(report));

  addSection(ws, row, "Tendencia del periodo");
  row += 1;
  const consumer = report.scope === "consumer";
  const trendRows: TableCell[][] = (report.trend || []).map((point) => {
    if (consumer) {
      return [
        { value: asDate(point.date) || point.date, format: NF_DATE },
        { value: point.revenue, format: NF_MONEY, align: "right" },
        { value: point.orders, format: NF_INT, align: "right" },
        { value: point.orders > 0 ? point.revenue / point.orders : 0, format: NF_MONEY, align: "right" },
      ];
    }
    const margin = point.revenue > 0 ? (point.profit / point.revenue) * 100 : 0;
    return [
      { value: asDate(point.date) || point.date, format: NF_DATE },
      { value: point.revenue, format: NF_MONEY, align: "right" },
      { value: point.expenses, format: NF_MONEY, align: "right" },
      { value: point.profit, format: NF_MONEY, align: "right" },
      { value: point.orders, format: NF_INT, align: "right" },
      { value: margin, format: NF_PCT, align: "right" },
    ];
  });
  const trendTotal = (report.trend || []).reduce(
    (total, point) => ({
      revenue: total.revenue + point.revenue,
      expenses: total.expenses + point.expenses,
      profit: total.profit + point.profit,
      orders: total.orders + point.orders,
    }),
    { revenue: 0, expenses: 0, profit: 0, orders: 0 },
  );
  row = addTable(
    ws,
    row,
    consumer
      ? [
          { header: "Fecha" },
          { header: "Gasto", align: "right" },
          { header: "Transacciones", align: "right" },
          { header: "Ticket promedio", align: "right" },
        ]
      : [
          { header: "Fecha" },
          { header: "Ingresos", align: "right" },
          { header: "Gastos", align: "right" },
          { header: "Ganancia", align: "right" },
          { header: "Transacciones", align: "right" },
          { header: "Margen", align: "right" },
        ],
    trendRows,
    {
      totalRow: consumer
        ? [
            { value: "TOTAL", bold: true },
            { value: trendTotal.revenue, format: NF_MONEY, align: "right", bold: true },
            { value: trendTotal.orders, format: NF_INT, align: "right", bold: true },
            { value: trendTotal.orders > 0 ? trendTotal.revenue / trendTotal.orders : 0, format: NF_MONEY, align: "right", bold: true },
          ]
        : [
            { value: "TOTAL", bold: true },
            { value: trendTotal.revenue, format: NF_MONEY, align: "right", bold: true },
            { value: trendTotal.expenses, format: NF_MONEY, align: "right", bold: true },
            { value: trendTotal.profit, format: NF_MONEY, align: "right", bold: true },
            { value: trendTotal.orders, format: NF_INT, align: "right", bold: true },
            { value: trendTotal.revenue > 0 ? (trendTotal.profit / trendTotal.revenue) * 100 : 0, format: NF_PCT, align: "right", bold: true },
          ],
    },
  );

  addSection(ws, row, "Distribución por categoría");
  row += 1;
  const categoryRows: TableCell[][] = (report.categoryBreakdown || []).map((entry) => [
    { value: normalizeCategory(entry.name) },
    { value: num(entry.value), format: NF_MONEY, align: "right" },
    { value: num(entry.value) / Math.max(1, report.categoryBreakdown.reduce((sum, item) => sum + num(item.value), 0)), format: "0.0%", align: "right" },
  ]);
  row = addTable(
    ws,
    row,
    [{ header: "Categoría" }, { header: "Monto", align: "right" }, { header: "Participación", align: "right" }],
    categoryRows,
    {
      emptyText: "Sin distribución de ingresos en el periodo.",
      totalRow: [
        { value: "TOTAL", bold: true },
        { value: report.categoryBreakdown.reduce((sum, item) => sum + num(item.value), 0), format: NF_MONEY, align: "right", bold: true },
        { value: 1, format: "0.0%", align: "right", bold: true },
      ],
    },
  );

  addSection(ws, row, "Productos destacados");
  row += 1;
  const productRows: TableCell[][] = (report.topProducts || []).map((product) => [
    { value: product.name || "Producto" },
    { value: normalizeCategory(product.role_category) },
    { value: num(product.stock) === -1 ? "∞" : num(product.stock), format: num(product.stock) === -1 ? undefined : NF_INT, align: "right" },
    { value: num(product.units), format: NF_INT, align: "right" },
    { value: num(product.revenue ?? product.spent), format: NF_MONEY, align: "right" },
    { value: consumer ? "—" : num(product.margin), format: consumer ? undefined : NF_MONEY, align: "right" },
  ]);
  const productTotal = (report.topProducts || []).reduce(
    (total, product) => ({
      units: total.units + num(product.units),
      revenue: total.revenue + num(product.revenue ?? product.spent),
      margin: total.margin + num(product.margin),
    }),
    { units: 0, revenue: 0, margin: 0 },
  );
  row = addTable(
    ws,
    row,
    [
      { header: "Producto" },
      { header: "Categoría" },
      { header: "Stock", align: "right" },
      { header: "Unidades", align: "right" },
      { header: consumer ? "Gasto" : "Ingresos", align: "right" },
      { header: consumer ? "" : "Margen", align: "right" },
    ],
    productRows,
    {
      emptyText: "Sin ventas de productos en el periodo.",
      totalRow: [
        { value: "TOTAL", bold: true },
        { value: "", bold: true },
        { value: "", bold: true },
        { value: productTotal.units, format: NF_INT, align: "right", bold: true },
        { value: productTotal.revenue, format: NF_MONEY, align: "right", bold: true },
        { value: consumer ? "" : productTotal.margin, format: consumer ? undefined : NF_MONEY, align: "right", bold: true },
      ],
    },
  );

  if (report.scope !== "consumer") {
    addSection(ws, row, "Servicios más reservados");
    row += 1;
    const serviceRows: TableCell[][] = (report.topServices || []).map((service) => [
      { value: service.name || "Servicio" },
      { value: normalizeCategory(service.category) },
      { value: num(service.bookings), format: NF_INT, align: "right" },
      { value: num(service.revenue), format: NF_MONEY, align: "right" },
      { value: num(service.bookings) > 0 ? num(service.revenue) / num(service.bookings) : 0, format: NF_MONEY, align: "right" },
    ]);
    const serviceTotal = (report.topServices || []).reduce(
      (total, service) => ({
        bookings: total.bookings + num(service.bookings),
        revenue: total.revenue + num(service.revenue),
      }),
      { bookings: 0, revenue: 0 },
    );
    row = addTable(
      ws,
      row,
      [
        { header: "Servicio" },
        { header: "Categoría" },
        { header: "Reservas", align: "right" },
        { header: "Ingresos", align: "right" },
        { header: "Ticket promedio", align: "right" },
      ],
      serviceRows,
      {
        emptyText: "Sin reservas de servicios en el periodo.",
        totalRow: [
          { value: "TOTAL", bold: true },
          { value: "", bold: true },
          { value: serviceTotal.bookings, format: NF_INT, align: "right", bold: true },
          { value: serviceTotal.revenue, format: NF_MONEY, align: "right", bold: true },
          { value: serviceTotal.bookings > 0 ? serviceTotal.revenue / serviceTotal.bookings : 0, format: NF_MONEY, align: "right", bold: true },
        ],
      },
    );
  }

  if (report.scope !== "consumer") {
    addSection(ws, row, "Alertas de inventario");
    row += 1;
    const stockRows: TableCell[][] = (report.lowStock || [])
      .filter((product) => num(product.stock) >= 0 && num(product.stock) < 5)
      .map((product) => [
        { value: product.name || "Producto" },
        { value: normalizeCategory(product.role_category) },
        { value: num(product.stock), format: NF_INT, align: "right", color: num(product.stock) === 0 ? COLORS.red : "FFA16207", fill: num(product.stock) === 0 ? COLORS.redSoft : COLORS.yellowSoft },
        { value: num(product.price), format: NF_MONEY, align: "right" },
        { value: num(product.stock) * num(product.price), format: NF_MONEY, align: "right" },
        { value: num(product.stock) === 0 ? "Agotado" : "Bajo", color: num(product.stock) === 0 ? COLORS.red : "FFA16207" },
      ]);
    row = addTable(
      ws,
      row,
      [
        { header: "Producto" },
        { header: "Categoría" },
        { header: "Stock", align: "right" },
        { header: "Precio", align: "right" },
        { header: "Valor inventario", align: "right" },
        { header: "Estado" },
      ],
      stockRows,
      { emptyText: "Inventario saludable: no hay productos con stock bajo." },
    );
  }

  addSection(ws, row, "Órdenes recientes");
  row += 1;
  const orderRows: TableCell[][] = (report.recentOrders || []).map((order) => [
    { value: asDate(order.created_at) || order.created_at || "—", format: asDate(order.created_at) ? NF_DATE : undefined },
    { value: order.product_name || "Producto" },
    { value: report.scope === "consumer" ? order.provider_username || order.provider_name : order.buyer_username || order.buyer_name || "—" },
    { value: num(order.quantity), format: NF_INT, align: "right" },
    { value: num(order.total), format: NF_MONEY, align: "right" },
    { value: String(order.status || "—").toUpperCase(), fill: statusFill(order.status).fill, color: statusFill(order.status).color },
  ]);
  row = addTable(
    ws,
    row,
    [
      { header: "Fecha" },
      { header: "Producto" },
      { header: consumer ? "Proveedor" : "Comprador" },
      { header: "Cant.", align: "right" },
      { header: "Total", align: "right" },
      { header: "Estado" },
    ],
    orderRows,
    { emptyText: "Sin órdenes recientes." },
  );

  addSection(ws, row, "Reservas recientes");
  row += 1;
  const bookingRows: TableCell[][] = (report.recentBookings || []).map((booking) => [
    { value: asDate(booking.created_at) || booking.created_at || "—", format: asDate(booking.created_at) ? NF_DATE : undefined },
    { value: booking.service_name || "Servicio" },
    { value: report.scope === "consumer" ? booking.provider_username : booking.traveler_username || "—" },
    { value: num(booking.units), format: NF_INT, align: "right" },
    { value: num(booking.total_price), format: NF_MONEY, align: "right" },
    { value: String(booking.status || "—").toUpperCase(), fill: statusFill(booking.status).fill, color: statusFill(booking.status).color },
  ]);
  row = addTable(
    ws,
    row,
    [
      { header: "Fecha" },
      { header: "Servicio" },
      { header: consumer ? "Proveedor" : "Viajero" },
      { header: "Cupos", align: "right" },
      { header: "Total", align: "right" },
      { header: "Estado" },
    ],
    bookingRows,
    { emptyText: "Sin reservas recientes." },
  );

  addSection(ws, row, "Viajes recientes");
  row += 1;
  const rideRows: TableCell[][] = (report.recentRides || []).map((ride) => [
    { value: asDate(ride.created_at) || ride.created_at || "—", format: asDate(ride.created_at) ? NF_DATE : undefined },
    { value: ride.destination_address || "Destino" },
    { value: report.scope === "consumer" ? ride.taxi_username || "—" : ride.traveler_username || "—" },
    { value: ride.distance_km ? `${num(ride.distance_km).toFixed(1)} km` : "—" },
    { value: num(ride.fare), format: NF_MONEY, align: "right" },
    { value: String(ride.status || "—").toUpperCase(), fill: statusFill(ride.status).fill, color: statusFill(ride.status).color },
  ]);
  row = addTable(
    ws,
    row,
    [
      { header: "Fecha" },
      { header: "Destino" },
      { header: consumer ? "Conductor" : "Viajero" },
      { header: "Distancia" },
      { header: "Tarifa", align: "right" },
      { header: "Estado" },
    ],
    rideRows,
    { emptyText: "Sin viajes recientes." },
  );

  addFooter(ws, row);
  return ws;
}

let logoPromise: Promise<{ buffer: Buffer; extension: "png" } | null> | null = null;

async function loadLogo() {
  if (!logoPromise) {
    logoPromise = (async () => {
      const candidates = [
        path.resolve(process.cwd(), "client/public/brand-icon-192.png"),
        path.resolve(process.cwd(), "dist/public/brand-icon-192.png"),
        path.resolve(process.cwd(), "public/brand-icon-192.png"),
        path.resolve(process.cwd(), "client/public/brand-icon-maskable-512.png"),
      ];
      for (const candidate of candidates) {
        try {
          return { buffer: await fs.readFile(candidate), extension: "png" as const };
        } catch {
          // Try the next location. In dev the source public folder exists; in
          // production Vite copies it to dist/public.
        }
      }
      // Serverless deploys may not ship the public folder; the embedded copy
      // keeps the VIANova brand in every generated workbook.
      if (BRAND_LOGO_PNG_BASE64) {
        return { buffer: Buffer.from(BRAND_LOGO_PNG_BASE64, "base64"), extension: "png" as const };
      }
      return null;
    })();
  }
  return logoPromise;
}

export async function buildAnalyticsWorkbook(data: AccountAnalytics): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "VIANova IA";
  workbook.lastModifiedBy = "VIANova IA";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = "Reporte general VIANova IA";
  workbook.subject = "Métricas por rol";
  workbook.company = "VIANova IA";
  workbook.description = `Reporte generado para ${data.user.name}`;

  const logo = await loadLogo();
  const logoId = logo
    ? workbook.addImage({ buffer: logo.buffer, extension: logo.extension })
    : undefined;

  addGeneralSheet(workbook, data, logoId);
  const usedNames = new Set<string>(["General"]);
  for (const report of data.reports) {
    let sheetName = report.sheetName.replace(/[\\/*?:[\]]/g, "").slice(0, 31) || report.label.slice(0, 31);
    let suffix = 2;
    while (usedNames.has(sheetName)) {
      const base = sheetName.replace(/\s+\d+$/, "").slice(0, 28);
      sheetName = `${base} ${suffix}`;
      suffix += 1;
    }
    usedNames.add(sheetName);
    addRoleSheet(workbook, data, { ...report, sheetName }, logoId);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as unknown as ArrayBuffer);
}
