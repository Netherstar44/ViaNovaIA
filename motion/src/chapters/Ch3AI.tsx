import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { Caption } from "../components/Caption";
import { C, F } from "../theme";
import { Check, MapPin, Send, Sparkles, ZoomIn } from "../components/Icons";

const STOPS = [
  { day: "01", title: "Centro histórico", detail: "Ciudad amurallada · 2 proveedores", price: "$420.000" },
  { day: "02", title: "Islas del Rosario", detail: "Tour en lancha · 1 proveedor", price: "$520.000" },
  { day: "03", title: "Getsemaní", detail: "Gastronomía local · 2 proveedores", price: "$300.000" },
];

const cop = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

export const Ch3AI: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();

  const panelIn = spring({ frame: frame - 4, fps: 60, config: { damping: 20, mass: 0.8, stiffness: 90 } });
  const camera = interpolate(frame, [0, duration], [1, 1.025], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const typeCount = Math.floor(
    interpolate(frame, [58, 100], [0, 20], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const prompt = "3 días en Cartagena";
  const sent = frame >= 104;
  const replyIn = spring({ frame: frame - 118, fps: 60, config: { damping: 18, mass: 0.6 } });
  const itineraryIn = spring({ frame: frame - 132, fps: 60, config: { damping: 19, mass: 0.7 } });
  const totalValue = Math.round(
    interpolate(frame, [170, 214], [0, 1240000], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const lineDraw = interpolate(frame, [168, 200], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitLine = interpolate(frame, [duration - 40, duration], [0, 1], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  /** Recibe la foto a sangre que dejó el capítulo 2 y la disuelve en negro. */
  const photoFade = interpolate(frame, [0, 38], [1, 0], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  /** La UI se apaga antes del corte; la línea de salida sigue viva hasta el final. */
  const uiFade = interpolate(frame, [duration - 26, duration], [1, 0], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  /** Vignette que empalma con la del capítulo 2 y vuelve a la oscura al disolverse la foto. */
  const vignette = `radial-gradient(ellipse at 50% 45%, transparent ${42 + 13 * photoFade}%, rgba(${Math.round(
    60 * photoFade,
  )},${Math.round(52 * photoFade)},${Math.round(36 * photoFade)},${(0.1 + 0.45 * (1 - photoFade)).toFixed(3)}) 100%)`;

  return (
    <Stage
      tone="dark"
      glow={{ x: 1280, y: 430, size: 1000, opacity: 0.12 * uiFade }}
      vignette={vignette}
    >
      <AbsoluteFill style={{ opacity: photoFade }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${interpolate(frame, [0, 38], [1, 1.025])})`,
            transformOrigin: "50% 62%",
          }}
        >
          <Img
            src={staticFile("img/cartagena.webp")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(5,6,8,0.55) 0%, rgba(5,6,8,0.06) 34%, rgba(5,6,8,0.10) 58%, rgba(5,6,8,0.78) 100%)",
            }}
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ transform: `scale(${camera})`, transformOrigin: "62% 50%" }}>
        {/* Columna editorial */}
        <div style={{ position: "absolute", left: 120, top: 300, width: 620, opacity: uiFade }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: F.sans,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: C.gold,
              opacity: interpolate(frame, [26, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            <Sparkles size={16} color={C.gold} />
            Asistente de viaje
          </div>
          <Caption text="La IA lo planifica." x={0} y={56} size={72} start={22} end={460} maxWidth={620} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 172,
              maxWidth: 440,
              fontFamily: F.sans,
              fontSize: 19,
              lineHeight: 1.6,
              color: "rgba(247,246,242,0.52)",
              opacity: interpolate(frame, [60, 92], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            Un itinerario real, con paradas, proveedores y precios. Sin buscar en diez pestañas.
          </div>
        </div>

        {/* Panel de chat */}
        <div
          style={{
            position: "absolute",
            left: 880,
            top: 54,
            width: 830,
            height: 972,
            borderRadius: 40,
            background: "#121216",
            border: `1px solid ${C.inkBorder}`,
            boxShadow: "0 50px 140px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,191,0,0.04)",
            overflow: "hidden",
            opacity: panelIn * uiFade,
            transform: `translateY(${interpolate(panelIn, [0, 1], [34, 0])}px) scale(${interpolate(panelIn, [0, 1], [0.97, 1])})`,
            transformOrigin: "70% 50%",
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 104,
              padding: "0 26px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              borderBottom: `1px solid ${C.inkBorder}`,
              background: "linear-gradient(90deg, rgba(255,191,0,0.06), rgba(255,191,0,0.01))",
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                padding: 2,
                background: `conic-gradient(from 210deg, ${C.gold}, #ff8a00, ${C.gold})`,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: "#0c0c0f",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={24} color={C.gold} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.sans, fontSize: 17, fontWeight: 600, color: C.white }}>
                Asistente de viaje
              </div>
              <div
                style={{
                  marginTop: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: F.sans,
                  fontSize: 12,
                  color: "rgba(247,246,242,0.45)",
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.greenDark }} />
                En línea · responde en segundos
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            </div>
          </div>

          {/* Mensajes */}
          <div style={{ padding: "26px 26px 0", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(255,191,0,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Sparkles size={17} color={C.gold} />
              </div>
              <div
                style={{
                  maxWidth: 560,
                  padding: "15px 18px",
                  borderRadius: "18px 18px 18px 5px",
                  background: "#1c1c21",
                  border: "1px solid rgba(255,255,255,0.04)",
                  fontFamily: F.sans,
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: "rgba(247,246,242,0.86)",
                  opacity: interpolate(frame, [26, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                }}
              >
                ¡Hola! Soy tu asistente IA de ViaNova. ¿A dónde quieres ir hoy?
              </div>
            </div>

            {/* Prompt */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  maxWidth: 520,
                  padding: "14px 20px",
                  borderRadius: "18px 18px 5px 18px",
                  background: sent ? C.gold : "rgba(255,191,0,0.14)",
                  color: sent ? C.ink : C.white,
                  border: sent ? "1px solid transparent" : "1px solid rgba(255,191,0,0.28)",
                  fontFamily: F.sans,
                  fontSize: 16,
                  fontWeight: 500,
                  minHeight: 52,
                  display: "flex",
                  alignItems: "center",
                  opacity: frame >= 46 ? 1 : 0,
                }}
              >
                {prompt.slice(0, typeCount)}
                {frame >= 46 && !sent ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: 1.5,
                      height: 18,
                      marginLeft: 2,
                      background: C.gold,
                      opacity: Math.floor(frame / 15) % 2 === 0 ? 1 : 0,
                    }}
                  />
                ) : null}
              </div>
            </div>

            {/* Respuesta */}
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                opacity: replyIn,
                transform: `translateY(${interpolate(replyIn, [0, 1], [16, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(255,191,0,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Sparkles size={17} color={C.gold} />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    padding: "15px 18px",
                    borderRadius: "18px 18px 18px 5px",
                    background: "#1c1c21",
                    border: "1px solid rgba(255,255,255,0.04)",
                    fontFamily: F.sans,
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: "rgba(247,246,242,0.86)",
                  }}
                >
                  Listo. Te armé un plan de 3 días con proveedores locales y todo incluido.
                </div>

                {/* Itinerario */}
                <div
                  style={{
                    marginTop: 14,
                    borderRadius: 20,
                    border: `1px solid ${C.inkBorder}`,
                    background: "#16161a",
                    overflow: "hidden",
                    opacity: itineraryIn,
                    transform: `translateY(${interpolate(itineraryIn, [0, 1], [18, 0])}px)`,
                  }}
                >
                  <div
                    style={{
                      padding: "16px 18px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: F.sans,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: C.gold,
                      }}
                    >
                      Itinerario · Cartagena
                    </div>
                    <div
                      style={{
                        fontFamily: F.mono,
                        fontSize: 10,
                        color: "rgba(247,246,242,0.4)",
                      }}
                    >
                      3 DÍAS · 2 VIAJEROS
                    </div>
                  </div>

                  <div style={{ position: "relative", padding: "0 18px" }}>
                    <svg
                      width="100%"
                      height={STOPS.length * 84}
                      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
                    >
                      <line
                        x1={44}
                        y1={42}
                        x2={44}
                        y2={42 + 84 * (STOPS.length - 1)}
                        stroke={C.gold}
                        strokeWidth={2}
                        strokeDasharray="260"
                        strokeDashoffset={260 - lineDraw * 260}
                        opacity={0.6}
                      />
                    </svg>
                    {STOPS.map((stop, index) => {
                      const rowIn = spring({
                        frame: frame - (138 + index * 10),
                        fps: 60,
                        config: { damping: 18, mass: 0.6 },
                      });
                      return (
                        <div
                          key={stop.day}
                          style={{
                            height: 84,
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            position: "relative",
                            zIndex: 2,
                            opacity: rowIn,
                            transform: `translateX(${interpolate(rowIn, [0, 1], [14, 0])}px)`,
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: "#0f0f12",
                              border: `1.5px solid ${C.gold}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: F.mono,
                              fontSize: 11,
                              fontWeight: 700,
                              color: C.gold,
                            }}
                          >
                            {stop.day}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.white }}>
                              {stop.title}
                            </div>
                            <div
                              style={{
                                marginTop: 3,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontFamily: F.sans,
                                fontSize: 11,
                                color: "rgba(247,246,242,0.42)",
                              }}
                            >
                              <MapPin size={11} color="rgba(247,246,242,0.42)" />
                              {stop.detail}
                            </div>
                          </div>
                          <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.gold }}>
                            {stop.price}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      margin: "4px 18px 0",
                      padding: "14px 0 12px",
                      borderTop: `1px solid ${C.inkBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ fontFamily: F.sans, fontSize: 12, color: "rgba(247,246,242,0.45)" }}>
                      Total estimado
                    </div>
                    <div style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 800, color: C.gold }}>
                      {cop(totalValue)}
                    </div>
                  </div>

                  <div
                    style={{
                      margin: "0 18px 16px",
                      height: 42,
                      borderRadius: 12,
                      background: C.gold,
                      color: C.ink,
                      fontFamily: F.sans,
                      fontSize: 12,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Check size={14} color={C.ink} />
                    Establecer ruta y notificar paradas
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Barra de entrada */}
          <div
            style={{
              position: "absolute",
              left: 26,
              right: 26,
              bottom: 22,
              height: 56,
              borderRadius: 999,
              border: `1px solid ${C.inkBorder}`,
              background: "#1a1a1f",
              display: "flex",
              alignItems: "center",
              padding: "0 8px 0 20px",
              fontFamily: F.sans,
              fontSize: 14,
              color: "rgba(247,246,242,0.32)",
            }}
          >
            Escribe tu mensaje...
            <div
              style={{
                marginLeft: "auto",
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: C.gold,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send size={16} color={C.ink} />
            </div>
          </div>
        </div>
        {/* Salida: la ruta se extiende fuera del panel */}
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <line
            x1={880}
            y1={820}
            x2={880 - exitLine * 420}
            y2={820 + exitLine * 260}
            stroke={C.gold}
            strokeWidth={3}
            opacity={exitLine}
          />
        </svg>
      </AbsoluteFill>
    </Stage>
  );
};
