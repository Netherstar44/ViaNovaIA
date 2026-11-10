import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { Caption } from "../components/Caption";
import { C, F } from "../theme";
import { ChevronRight, Maximize, Move, Rotate, Star } from "../components/Icons";

const SLIDES = [
  {
    image: "img/cartagena.webp",
    title: "Cartagena de Indias",
    place: "Bolívar · Colombia",
    rating: "4.9",
    note: "Ciudad amurallada, islas y gastronomía",
  },
  {
    image: "img/tayrona.webp",
    title: "Parque Nacional Tayrona",
    place: "Magdalena · Colombia",
    rating: "4.8",
    note: "Selva, playas y senderos ancestrales",
  },
];

const THUMBS = ["img/cartagena.webp", "img/tayrona.webp", "img/guatape.webp", "img/salento.webp"];

/**
 * Capítulo 4 — Descubrimiento visual.
 * Galería real a sangre, chrome real (360°, CTA, miniaturas) y cámara 2.5D.
 * No se simula un panorama: se muestra la affordance y fotografía real.
 */
export const Ch4Discovery: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();

  const push = interpolate(frame, [0, duration], [1.015, 1.095], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panX = interpolate(frame, [300, duration], [0, -70], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chromeIn = interpolate(frame, [8, 34], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const second = interpolate(frame, [302, 340], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const active = frame >= 320 ? 1 : 0;
  const badgePulse = 1 + Math.sin((frame / 30) * Math.PI) * 0.035;

  const iris = interpolate(frame, [422, 470], [0, 1], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /**
   * Costura diagonal: continúa exactamente la línea de ruta que salió del
   * capítulo 3 (pasa por 460,1080 con pendiente −1.615 x/y) y barre el cuadro
   * hacia abajo-izquierda, descubriendo la galería desde la esquina inferior derecha.
   */
  const seam = interpolate(frame, [0, 34], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const seamX = interpolate(seam, [0, 1], [460, -2100]);
  const seamTopY = 1080 - (1920 - seamX) / 1.615;
  const seamOpacity = interpolate(frame, [0, 26], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Stage tone="light">
      <AbsoluteFill>
        <AbsoluteFill style={{ backgroundColor: "#08080a" }} />

        {/* Fotografía a sangre con cámara 2.5D, descubierta por la costura */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: `polygon(${seamX}px 1080px, 1920px ${seamTopY}px, 1920px 1080px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: -40,
              transform: `scale(${push}) translateX(${panX}px)`,
              transformOrigin: "54% 46%",
            }}
          >
            <Img
              src={staticFile(SLIDES[0].image)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <Img
              src={staticFile(SLIDES[1].image)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: second,
                transform: `scale(${interpolate(second, [0, 1], [1.06, 1])})`,
              }}
            />
          </div>
        </div>

        {/* La ruta continúa como costura dorada */}
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", inset: 0, opacity: seamOpacity, pointerEvents: "none" }}
        >
          <line x1={seamX} y1={1080} x2={1920} y2={seamTopY} stroke="rgba(255,191,0,0.16)" strokeWidth={16} />
          <line
            x1={seamX}
            y1={1080}
            x2={1920}
            y2={seamTopY}
            stroke={C.gold}
            strokeWidth={3}
            style={{ filter: "drop-shadow(0 0 12px rgba(255,191,0,0.65))" }}
          />
        </svg>

        {/* Gradientes de chrome */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(5,6,8,0.62) 0%, rgba(5,6,8,0.10) 26%, rgba(5,6,8,0.02) 55%, rgba(5,6,8,0.72) 100%)",
          }}
        />

        {/* Barra superior */}
        <div
          style={{
            position: "absolute",
            left: 110,
            right: 110,
            top: 52,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            opacity: chromeIn,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.30)",
                background: "rgba(8,8,10,0.30)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={22} color={C.white} style={{ transform: "rotate(180deg)" }} />
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: F.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.66)",
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.gold }} />
                Galería · {SLIDES[active].place}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: F.display,
                  fontSize: 46,
                  fontWeight: 600,
                  letterSpacing: "-0.035em",
                  lineHeight: 1.04,
                  color: C.white,
                  textShadow: "0 2px 30px rgba(0,0,0,0.35)",
                }}
              >
                {SLIDES[active].title}
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: F.sans,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.78)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Star size={14} color={C.gold} />
                  <strong style={{ fontWeight: 700, color: C.white }}>{SLIDES[active].rating}</strong>
                </span>
                <span style={{ width: 1, height: 13, background: "rgba(255,255,255,0.28)" }} />
                <span>{SLIDES[active].note}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.24)",
                background: "rgba(8,8,10,0.28)",
                fontFamily: F.sans,
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.86)",
              }}
            >
              Compartir
            </div>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                border: `1.5px solid ${C.gold}`,
                background: "rgba(8,8,10,0.42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: F.sans,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: C.gold,
                transform: `scale(${badgePulse})`,
                boxShadow: "0 0 0 8px rgba(255,191,0,0.10)",
              }}
            >
              360°
            </div>
          </div>
        </div>

        {/* Badge inmersivo flotante: objeto que hará el iris */}
        <div
          style={{
            position: "absolute",
            left: 1210,
            top: 330,
            width: 300,
            opacity: interpolate(frame, [62, 92], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(frame, [62, 92], [18, 0], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          <div
            style={{
              width: 148,
              height: 148,
              margin: "0 auto",
              borderRadius: "50%",
              border: "1.5px solid rgba(255,255,255,0.55)",
              background: "rgba(8,8,10,0.34)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              boxShadow: "0 0 0 14px rgba(255,255,255,0.08), 0 24px 60px rgba(0,0,0,0.35)",
              transform: `scale(${badgePulse})`,
            }}
          >
            <Rotate size={28} color={C.gold} />
            <div style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 700, color: C.white, letterSpacing: "0.06em" }}>
              360°
            </div>
          </div>
          <div
            style={{
              margin: "18px auto 0",
              width: "fit-content",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(8,8,10,0.58)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.32)",
              fontFamily: F.sans,
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.92)",
              whiteSpace: "nowrap",
            }}
          >
            <Move size={14} color="rgba(255,255,255,0.92)" />
            Arrastra para mirar · pellizca para acercar
          </div>
        </div>

        {/* Copy de la película */}
        <Caption text="Míralo antes de ir." tone="dark" start={34} end={286} x={110} y={720} size={56} maxWidth={720} />

        {/* Miniaturas */}
        <div
          style={{
            position: "absolute",
            left: 110,
            bottom: 96,
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: chromeIn,
          }}
        >
          {THUMBS.map((thumb, index) => {
            const isActive = index === active;
            const scale = isActive ? 1 : 0.94;
            return (
              <div
                key={thumb}
                style={{
                  width: 108,
                  height: 70,
                  borderRadius: 10,
                  overflow: "hidden",
                  outline: isActive ? `2px solid ${C.gold}` : "1px solid rgba(255,255,255,0.35)",
                  outlineOffset: isActive ? 3 : 0,
                  transform: `scale(${scale})`,
                  opacity: isActive ? 1 : 0.72,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
                }}
              >
                <Img src={staticFile(thumb)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            );
          })}
          <div
            style={{
              marginLeft: 8,
              fontFamily: F.sans,
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(255,255,255,0.68)",
            }}
          >
            {active + 1} / 4
          </div>
        </div>

        {/* CTA real */}
        <div
          style={{
            position: "absolute",
            right: 110,
            bottom: 96,
            height: 62,
            padding: "0 28px",
            borderRadius: 999,
            background: C.gold,
            color: C.ink,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: F.sans,
            fontSize: 15,
            fontWeight: 700,
            boxShadow: "0 18px 48px rgba(0,0,0,0.30)",
            opacity: chromeIn,
          }}
        >
          <Maximize size={18} color={C.ink} />
          Ver Interior 360°
        </div>

        {/* Iris: el badge 360° se abre y cubre el cuadro */}
        {iris > 0 ? (() => {
          const size = interpolate(iris, [0, 1], [148, 3600]);
          return (
            <div
              style={{
                position: "absolute",
                left: 1360 - size / 2,
                top: 404 - size / 2,
                width: size,
                height: size,
                borderRadius: "50%",
                background: "#08080a",
                border: `2px solid ${C.gold}`,
                boxShadow: `0 0 0 ${iris * 10}px rgba(255,191,0,${0.12 * (1 - iris)})`,
              }}
            />
          );
        })() : null}
      </AbsoluteFill>
    </Stage>
  );
};
