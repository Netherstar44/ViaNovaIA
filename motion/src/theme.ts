/**
 * Tokens reales de VIANova IA.
 * Fuente: client/src/index.css (tema claro + oscuro) y Navbar.
 */

export const C = {
  gold: "#ffbf00",
  goldSoft: "#ffd45c",
  goldDeep: "#c99600",

  ink: "#08080a",
  inkCard: "#16161a",
  inkSecondary: "#1c1c21",
  inkBorder: "#2a2a31",
  inkMuted: "#8b8b95",

  paper: "#f5f4f0",
  paperCard: "#ffffff",
  paperBorder: "#e6e4dd",
  muted: "#67675f",

  white: "#f7f6f2",
  green: "#16a34a",
  greenDark: "#4ade80",
  blue: "#3b82f6",
  purple: "#a855f7",
  red: "#ef4444",
  teal: "#14b8a6",
} as const;

export const F = {
  sans: "Inter, system-ui, sans-serif",
  display: "Poppins, Inter, system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

/** 120 BPM: 1 beat = 30 frames a 60 fps. */
export const BEAT = 30;
export const BAR = 60;
