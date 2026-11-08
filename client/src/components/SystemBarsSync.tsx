import { useEffect } from "react";
import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { useTheme } from "next-themes";

interface ThemeBarsPlugin {
  setBackground(options: { color: string }): Promise<void>;
}

const ThemeBars = registerPlugin<ThemeBarsPlugin>("ThemeBars");

const DARK_THEMES = new Set(["dark", "sunset", "ocean", "forest"]);
const FALLBACK_BG = { light: "#f5f4f0", dark: "#08080a" };

/**
 * Mantiene las barras de sistema de Android del mismo color que el fondo del
 * tema activo. SystemBars (Capacitor 8) pone los insets y el color de los
 * iconos; ThemeBars pinta el fondo con el --bg real de la app.
 */
export default function SystemBarsSync() {
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    const activeTheme = resolvedTheme ?? theme;
    if (!activeTheme) return;

    const isDark = DARK_THEMES.has(activeTheme);
    let cancelled = false;
    let timer: number | undefined;

    const apply = async () => {
      if (cancelled) return;

      const bg =
        getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() ||
        FALLBACK_BG[isDark ? "dark" : "light"];

      try {
        await SystemBars.setStyle({
          style: isDark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
        });
      } catch {
        // Sin el bridge nativo el resto de la app sigue funcionando.
      }

      if (cancelled) return;

      try {
        await ThemeBars.setBackground({ color: bg });
      } catch {
        // Plugin no disponible (por ejemplo, en una build antigua).
      }
    };

    // next-themes aplica la clase en su propio efecto; esperamos un frame para
    // leer el --bg ya actualizado.
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, 60);
    };

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    document.addEventListener("visibilitychange", schedule);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [theme, resolvedTheme]);

  return null;
}
