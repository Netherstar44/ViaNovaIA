import { useEffect } from "react";
import { useTheme } from "next-themes";

import faviconDefault from "@/assets/favicons/favicon-default.png";
import faviconOcean from "@/assets/favicons/favicon-ocean.png";
import faviconForest from "@/assets/favicons/favicon-forest.png";
import faviconSunset from "@/assets/favicons/favicon-sunset.png";

const FAVICONS: Record<string, string> = {
  light: faviconDefault,
  dark: faviconDefault,
  ocean: faviconOcean,
  forest: faviconForest,
  sunset: faviconSunset,
};

const THEME_COLORS: Record<string, string> = {
  light: "#f5f4f0",
  dark: "#08080a",
  ocean: "#03111b",
  forest: "#05110a",
  sunset: "#140b08",
};

/**
 * Keeps the browser tab icon (and the mobile browser chrome color) in sync with
 * the active palette. Mounted once at the app root so it also works on public
 * screens that do not render the Navbar, such as Login or Role Selection.
 */
export default function ThemeFavicon() {
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const activeTheme = (theme === "system" ? resolvedTheme : theme) || "light";
    const href = FAVICONS[activeTheme] || faviconDefault;

    const link = document.getElementById("theme-favicon") as HTMLLinkElement | null;
    if (link && link.getAttribute("href") !== href) {
      link.type = "image/png";
      link.href = href;
    }

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.content = THEME_COLORS[activeTheme] || THEME_COLORS.light;
    }
  }, [theme, resolvedTheme]);

  return null;
}
