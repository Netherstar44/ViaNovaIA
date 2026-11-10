import React from "react";
import { C } from "../theme";

/**
 * Mapa estilizado y determinista, construido con los colores de la app.
 * No es un proveedor de mapas: es una retícula editorial para explicar la ruta.
 */
export const MapGrid: React.FC<{ glow?: boolean }> = ({ glow = false }) => {
  const verticals = Array.from({ length: 18 }, (_, i) => 40 + i * 112);
  const horizontals = Array.from({ length: 14 }, (_, i) => 24 + i * 78);
  const diagonals = [
    "M-40 210 L 1960 700",
    "M120 1080 L 720 -40",
    "M520 1080 L 1160 -40",
    "M980 1080 L 1780 120",
  ];

  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id="mapFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.ink} stopOpacity="0" />
          <stop offset="100%" stopColor={C.ink} stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="mapGlow" cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor={C.gold} stopOpacity="0.07" />
          <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={1920} height={1080} fill="#0a0a0e" />
      {glow ? <rect width={1920} height={1080} fill="url(#mapGlow)" /> : null}

      {/* Manzanas tenues para dar cuerpo al mapa */}
      {horizontals.map((y, row) =>
        verticals.slice(0, -1).map((x, col) => {
          const width = 58 + ((row * 7 + col * 11) % 26);
          const height = 34 + ((row * 5 + col * 3) % 18);
          return (
            <rect
              key={`${row}-${col}`}
              x={x + 18}
              y={y + 16}
              width={width}
              height={height}
              rx={5}
              fill="#111116"
              opacity={0.9}
            />
          );
        }),
      )}

      {/* Calles menores */}
      <g stroke="#23232b" strokeWidth={1.4}>
        {verticals.map((x) => (
          <line key={`v-${x}`} x1={x} y1={0} x2={x + 26} y2={1080} />
        ))}
        {horizontals.map((y) => (
          <line key={`h-${y}`} x1={0} y1={y} x2={1920} y2={y + 12} />
        ))}
      </g>

      {/* Avenidas principales */}
      <g stroke="#30303a" strokeWidth={3} strokeLinecap="round">
        <path d="M340 -20 L 560 1100" />
        <path d="M-20 486 L 1940 560" />
        <path d="M1040 -20 L 1240 1100" />
      </g>

      {/* Diagonales */}
      <g stroke="#262630" strokeWidth={2}>
        {diagonals.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {/* Bahía / agua */}
      <path
        d="M0 880 C 250 820, 430 960, 660 1040 L 0 1080 Z"
        fill="#0b1215"
        stroke="#1c2c31"
        strokeWidth={2}
      />
      <path
        d="M1560 1080 C 1580 920, 1760 800, 1920 760 L 1920 1080 Z"
        fill="#0b1215"
        stroke="#1c2c31"
        strokeWidth={2}
      />

      <rect width={1920} height={1080} fill="url(#mapFade)" opacity={0.9} />
    </svg>
  );
};
