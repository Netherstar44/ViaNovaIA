import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";

/**
 * Copy añadido por la película. Siempre en español neutro.
 * Entra con máscara horizontal; sale con un desplazamiento corto.
 */
export const Caption: React.FC<{
  text: string;
  tone?: "dark" | "light";
  x?: number;
  y?: number;
  size?: number;
  start: number;
  end: number;
  maxWidth?: number;
}> = ({ text, tone = "dark", x = 120, y = 900, size = 52, start, end, maxWidth = 980 }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [start, start + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [end - 12, end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const visible = Math.min(enter, exit);
  if (visible <= 0) return null;

  const light = tone === "light";
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        alignItems: "stretch",
        gap: 22,
        maxWidth,
        opacity: exit,
      }}
    >
      <div
        style={{
          width: 4,
          borderRadius: 2,
          background: C.gold,
          transform: `scaleY(${enter})`,
          transformOrigin: "top",
        }}
      />
      <div style={{ overflow: "hidden", paddingBottom: 6 }}>
        <div
          style={{
            fontFamily: F.display,
            fontWeight: 600,
            fontSize: size,
            lineHeight: 1.12,
            letterSpacing: "-0.025em",
            color: light ? C.ink : C.white,
            transform: `translateY(${interpolate(enter, [0, 1], [26, 0])}px)`,
            clipPath: `inset(0 ${interpolate(enter, [0, 1], [100, 0])}% 0 0)`,
            textShadow: light ? "none" : "0 2px 24px rgba(0,0,0,0.35)",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};
