---
name: ViaNova Theming
description: Usar cuando se añada o modifique un tema, color, token semántico, superficie glass, contraste o estilo visual en ViaNovaIA; también para revisar modo claro, dark, sunset, ocean y forest.
---

# ViaNova Theming

## Dónde vive el sistema

| Pieza | Archivo |
| --- | --- |
| Tokens y temas | `client/src/index.css` (`@theme inline` + `@layer base`) |
| Superficies sólidas, dock, orbe | `client/src/styles/glass.css` |
| Selector de tema y logo por tema | `client/src/components/Navbar.tsx` |
| Proveedor de tema | `next-themes` en el árbol de la app |

Temas disponibles: **light** (`:root`), **dark** (`.dark`), **sunset** (`.sunset`), **ocean** (`.ocean`) y **forest** (`.forest`).

## Cómo funciona

1. `@theme inline` mapea variables CSS a utilidades Tailwind:
   `--color-background: var(--bg)`, `--color-primary: var(--primary)`, etc.
2. Cada tema redefine las variables dentro de `@layer base`.
3. Los componentes usan clases semánticas: `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `bg-primary`, `text-primary-foreground`, `text-primary-ink`, `border-border`, `ring-ring`, `text-muted-foreground`.
4. `glass.css` deriva superficies sólidas de `--card`, `--border` y `--fg` con `color-mix`. No hay `backdrop-filter`.

## Reglas

- **Nunca hardcodees hex** en un componente. Si falta un token, añádelo al tema y mapéalo en `@theme inline`.
- Para texto dorado sobre fondo claro usa `text-primary-ink` (o `--primary-ink`), no `text-primary`: el amarillo `#ffbf00` no tiene contraste suficiente para texto pequeño.
- `--primary` es color de marca/superficie; `--primary-fg` es el texto que va encima.
- No uses `backdrop-filter`, SVG de refracción ni canvases por superficie. El coste de composición causaba stutter en móviles.
- Respeta `prefers-reduced-motion`: `glass.css` ya tiene un bloque para reducir movimiento.
- No cambies solo el modo claro: cualquier token nuevo debe existir en los cinco temas.

## Añadir un tema

Copia el bloque completo de un tema existente y redefine **todas** estas familias:

- Base: `--bg`, `--fg`, `--primary`, `--primary-fg`, `--primary-border`, `--primary-ink`, `--secondary`, `--secondary-fg`, `--secondary-border`.
- Superficies: `--card`, `--card-fg`, `--popover`, `--popover-fg`, `--accent`, `--accent-fg`.
- Estados: `--destructive`, `--destructive-fg`, `--destructive-border`, `--success`, `--success-fg`, `--warning`, `--warning-fg`, `--info`, `--info-fg`.
- Bordes y foco: `--border`, `--input`, `--ring`, `--muted`, `--muted-fg`.
- Sidebar: `--sidebar*`.
- Charts: `--chart-1` … `--chart-5`.
- Glass: `--glass-bg`, `--glass-bg-strong`, `--glass-border`, `--glass-border-soft`, `--glass-highlight`, `--glass-shadow`, `--glass-inset`, `--glass-tint`, `--glass-shine`.
- Ambiente: `--ambient-a`, `--ambient-b`, `--ambient-c`.

Después:

1. Añade el tema al menú de `Navbar.tsx` (`themeOptions`).
2. Si el logo cambia por tema, añade el asset `brand-mark-<tema>.webp` y su `case` en `themeKey`.
3. Añade el selector del tema en `glass.css` si necesita ajustes de superficie.
4. Prueba claro + los cuatro oscuros.

## Contraste y verificación

- Mide contraste con la pestaña **enfocada**. En una pestaña en segundo plano las transiciones CSS se congelan y `getComputedStyle` devuelve el color anterior.
- Objetivo WCAG AA: 4.5:1 para texto normal, 3:1 para texto grande y componentes.
- Revisa los tres breakpoints: 360 px, 768 px y 1440 px.
- Comprueba foco visible (`ring-ring`) y estados hover/disabled en cada tema.
- No confíes solo en el color para comunicar estado; añade texto o icono.

## Errores frecuentes

| Síntoma | Causa probable |
| --- | --- |
| Texto ilegible en modo claro | Se usó `text-primary` en vez de `text-primary-ink`. |
| Superficie “sucia” o translúcida | Se reintrodujo `backdrop-filter` o un canvas de refracción. |
| Tema nuevo a medias | Faltan tokens de sidebar, charts o glass; los componentes heredan valores del tema anterior. |
| Logo incorrecto | `themeKey` no contempla el tema o falta el asset recortado. |
| Contraste medido mal | La pestaña estaba en segundo plano. |
