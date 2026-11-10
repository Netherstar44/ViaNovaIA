import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { Logo } from "../components/Logo";
import { C, F } from "../theme";

/**
 * Capítulo 8 — Payoff de marca.
 * La tarjeta negra del panel se asienta, se abre y deja la marca y la llamada final.
 */
export const Ch8Close: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();

  const expand = interpolate(frame, [18, 54], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineIn = interpolate(frame, [52, 82], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rule = interpolate(frame, [92, 148], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoIn = spring({ frame: frame - 120, fps: 60, config: { damping: 18, mass: 0.75, stiffness: 80 } });
  const wordClip = interpolate(frame, [134, 190], [100, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headline = interpolate(frame, [246, 286], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const urlIn = interpolate(frame, [312, 348], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = interpolate(frame, [duration - 38, duration], [1, 0], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Stage tone="dark" glow={{ x: 960, y: 500, size: 1400, opacity: 0.11 }}>
      <AbsoluteFill style={{ opacity: fade }}>
        {/* La tarjeta se abre hasta llenar el cuadro */}
        <div
          style={{
            position: "absolute",
            left: interpolate(expand, [0, 1], [704, 0]),
            top: interpolate(expand, [0, 1], [428, 0]),
            width: interpolate(expand, [0, 1], [691, 1920]),
            height: interpolate(expand, [0, 1], [244, 1080]),
            borderRadius: interpolate(expand, [0, 1], [31, 0]),
            background: "#0b0b0e",
            border: `1px solid rgba(255,191,0,${0.20 * (1 - expand)})`,
            boxShadow: `0 40px 120px rgba(0,0,0,${0.5 * (1 - expand)})`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 1 - interpolate(frame, [22, 46], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {/* Coincide con la tarjeta del capítulo 7 ya escalada 1.72× */}
            <Logo markHeight={58} wordSize={22} gap={10} tone="dark" />
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 304,
            textAlign: "center",
            fontFamily: F.sans,
            fontSize: 40,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "rgba(247,246,242,0.62)",
            opacity: taglineIn,
            transform: `translateY(${interpolate(taglineIn, [0, 1], [22, 0])}px)`,
          }}
        >
          Tu viaje, sin fricción.
        </div>

        {/* Regla dorada */}
        <div
          style={{
            position: "absolute",
            left: 960 - (160 * rule) / 2,
            top: 380,
            width: 160 * rule,
            height: 2,
            background: `linear-gradient(90deg, rgba(255,191,0,0), ${C.gold}, rgba(255,191,0,0))`,
            boxShadow: "0 0 20px rgba(255,191,0,0.35)",
          }}
        />

        {/* Lockup real */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 414,
            display: "flex",
            justifyContent: "center",
            opacity: logoIn,
            transform: `translateY(${interpolate(logoIn, [0, 1], [56, 0])}px)`,
          }}
        >
          <div style={{ clipPath: `inset(0 ${wordClip}% 0 0)` }}>
            <Logo markHeight={78} wordSize={52} tone="dark" gap={16} />
          </div>
        </div>

        {/* Llamada final */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 552,
            textAlign: "center",
            opacity: headline,
          }}
        >
          <div style={{ overflow: "hidden", paddingBottom: 2 }}>
            <div
              style={{
                fontFamily: F.display,
                fontSize: 40,
                fontWeight: 500,
                letterSpacing: "-0.03em",
                color: "rgba(247,246,242,0.88)",
                transform: `translateY(${interpolate(headline, [0, 1], [42, 0])}px)`,
              }}
            >
              Planifica tu viaje con
            </div>
          </div>
          <div style={{ overflow: "hidden", paddingBottom: 14, marginTop: 6 }}>
            <div
              style={{
                fontFamily: F.display,
                fontSize: 104,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.055em",
                color: C.gold,
                transform: `translateY(${interpolate(headline, [0, 1], [104, 0])}px)`,
              }}
            >
              VIANova.
            </div>
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 828,
            textAlign: "center",
            fontFamily: F.mono,
            fontSize: 20,
            letterSpacing: "0.08em",
            color: "rgba(247,246,242,0.40)",
            opacity: urlIn,
          }}
        >
          via-nova-ia.vercel.app
        </div>

        {/* Etiqueta de contexto */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 54,
            textAlign: "center",
            fontFamily: F.sans,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color: "rgba(247,246,242,0.24)",
            opacity: urlIn,
          }}
        >
          Turismo local · Colombia
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
