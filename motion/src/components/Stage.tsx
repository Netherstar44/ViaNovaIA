import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme";

type Tone = "dark" | "light";

export const Stage: React.FC<{
  tone: Tone;
  children: React.ReactNode;
  /** Halo dorado opcional, en coordenadas de pantalla. */
  glow?: { x: number; y: number; size: number; opacity?: number };
  /** Vignette CSS a medida (para continuidad entre capítulos). */
  vignette?: string;
}> = ({ tone, children, glow, vignette }) => {
  const dark = tone === "dark";
  return (
    <AbsoluteFill
      style={{
        backgroundColor: dark ? C.ink : C.paper,
        overflow: "hidden",
        color: dark ? C.white : C.ink,
      }}
    >
      {glow ? (
        <div
          style={{
            position: "absolute",
            left: glow.x - glow.size / 2,
            top: glow.y - glow.size / 2,
            width: glow.size,
            height: glow.size,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(255,191,0,${glow.opacity ?? 0.14}) 0%, rgba(255,191,0,0.04) 45%, transparent 70%)`,
            filter: "blur(2px)",
          }}
        />
      ) : null}
      {children}
      <Vignette dark={dark} background={vignette} />
      <Grain />
    </AbsoluteFill>
  );
};

const Vignette: React.FC<{ dark: boolean; background?: string }> = ({ dark, background }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        background ??
        (dark
          ? "radial-gradient(ellipse at 50% 45%, transparent 42%, rgba(0,0,0,0.55) 100%)"
          : "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(60,52,36,0.10) 100%)"),
    }}
  />
);

/** Grano fílmico estático, muy bajo, para que el render no se sienta vectorial. */
const Grain: React.FC = () => (
  <svg
    width="100%"
    height="100%"
    style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.05, mixBlendMode: "overlay" }}
  >
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>
);
