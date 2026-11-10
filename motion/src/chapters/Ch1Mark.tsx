import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { C, F } from "../theme";

/**
 * Capítulo 1 — Identidad.
 * La marca se construye como un camino. El triángulo se desprende y aterriza
 * como pin del buscador del capítulo 2 (match cut sobre el objeto).
 */
export const Ch1Mark: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();

  const lineW = interpolate(frame, [0, 42], [0, 640], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineOpacity = interpolate(frame, [0, 10, 180, 210, 236], [0, 1, 1, 0.35, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const markIn = spring({ frame: frame - 16, fps: 60, config: { damping: 16, mass: 0.7, stiffness: 90 } });
  const wordIn = interpolate(frame, [70, 100], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const carry = interpolate(frame, [186, 226], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breathe = 1 + Math.sin((frame / 60) * Math.PI * 0.9) * 0.006;

  const markX = interpolate(carry, [0, 1], [960, 605]);
  const markY = interpolate(carry, [0, 1], [492, 425]);
  const markScale = interpolate(carry, [0, 1], [1, 0.4]) * breathe;
  const wordOpacity = interpolate(frame, [186, 208], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // El mundo se ilumina mientras el triángulo viaja al buscador: el corte a
  // claro del capítulo 2 ya no es un flash, es el mismo plano amaneciendo.
  const lighten = interpolate(frame, [198, 236], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const vignette = `radial-gradient(ellipse at 50% 45%, transparent ${42 + 13 * lighten}%, rgba(${Math.round(
    60 * lighten,
  )},${Math.round(52 * lighten)},${Math.round(36 * lighten)},${(0.55 - 0.45 * lighten).toFixed(3)}) 100%)`;

  return (
    <Stage tone="dark" glow={{ x: 960, y: 480, size: 980, opacity: 0.16 }} vignette={vignette}>
      <AbsoluteFill>
        <AbsoluteFill style={{ backgroundColor: C.paper, opacity: lighten }} />
        {/* Carretera que se dibuja */}
        <div
          style={{
            position: "absolute",
            left: 960 - lineW / 2,
            top: 588,
            width: lineW,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${C.gold} 18%, ${C.gold} 82%, transparent)`,
            opacity: lineOpacity,
            boxShadow: "0 0 24px rgba(255,191,0,0.35)",
          }}
        />

        {/* Lockup */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1920,
            height: 1080,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: markX - 60,
              top: markY - 55,
              width: 120,
              height: 110,
              transform: `scale(${markScale}) rotate(${interpolate(carry, [0, 1], [-4, 0])}deg)`,
              opacity: markIn,
              transformOrigin: "center",
              filter: `drop-shadow(0 10px 40px rgba(255,191,0,${(0.18 * (1 - lighten)).toFixed(3)}))`,
            }}
          >
            <Img
              src={staticFile("brand/brand-mark-principal.png")}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>

          <div
            style={{
              position: "absolute",
              left: 1044,
              top: 462,
              overflow: "hidden",
              opacity: markIn * wordOpacity,
              paddingBottom: 8,
            }}
          >
            <div
              style={{
                fontFamily: F.sans,
                fontWeight: 600,
                fontSize: 76,
                letterSpacing: "-0.05em",
                lineHeight: 1,
                color: C.white,
                transform: `translateY(${interpolate(wordIn, [0, 1], [28, 0])}px)`,
                clipPath: `inset(0 ${interpolate(wordIn, [0, 1], [100, 0])}% 0 0)`,
              }}
            >
              <span style={{ color: C.gold }}>VIA</span>Nova
            </div>
          </div>
        </div>

        {/* Micro etiqueta inferior */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 664,
            textAlign: "center",
            fontFamily: F.sans,
            fontWeight: 500,
            fontSize: 15,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(247,246,242,0.38)",
            opacity: wordIn * interpolate(frame, [150, 190], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          Turismo local · Colombia
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
