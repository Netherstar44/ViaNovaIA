import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { Caption } from "../components/Caption";
import { MapGrid } from "../components/MapGrid";
import { C, F } from "../theme";
import { Car, MapPin, Star, TrendingUp } from "../components/Icons";

const P0 = { x: 640, y: 820 };
const P1 = { x: 810, y: 872 };
const P2 = { x: 1080, y: 566 };
const P3 = { x: 1390, y: 372 };

const bezier = (t: number) => {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * P0.x + 3 * mt * mt * t * P1.x + 3 * mt * t * t * P2.x + t * t * t * P3.x,
    y: mt * mt * mt * P0.y + 3 * mt * mt * t * P1.y + 3 * mt * t * t * P2.y + t * t * t * P3.y,
  };
};

const bezierAngle = (t: number) => {
  const a = bezier(Math.max(0, t - 0.004));
  const b = bezier(Math.min(1, t + 0.004));
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
};

/**
 * Capítulo 6 — Movilidad local.
 * Panel del Taxista real: disponibilidad, viaje activo, métricas y auto en ruta.
 */
export const Ch6Taxi: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();

  const routeDraw = interpolate(frame, [20, 96], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const carT = interpolate(frame, [76, 392], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const car = bezier(carT);
  const angle = bezierAngle(carT);
  const arrived = frame >= 392;
  const arrivalPulse = interpolate(frame, [388, 430], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const header = spring({ frame: frame - 4, fps: 60, config: { damping: 18, mass: 0.7 } });
  const ride = spring({ frame: frame - 108, fps: 60, config: { damping: 19, mass: 0.8 } });
  const metrics = spring({ frame: frame - 186, fps: 60, config: { damping: 18, mass: 0.75 } });
  const toggle = spring({ frame: frame - 54, fps: 60, config: { damping: 16, mass: 0.6 } });

  const outro = interpolate(frame, [422, 472], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /** El recibo del capítulo 5 sigue de largo y descubre el mapa del taxi. */
  const receiptIntro = interpolate(frame, [0, 26], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Stage tone="dark" glow={{ x: 900, y: 640, size: 1200, opacity: 0.09 }}>
      <AbsoluteFill>
        <MapGrid />

        {/* Ruta */}
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <path
            d={`M${P0.x} ${P0.y} C ${P1.x} ${P1.y}, ${P2.x} ${P2.y}, ${P3.x} ${P3.y}`}
            fill="none"
            stroke="rgba(255,191,0,0.13)"
            strokeWidth={18}
            strokeLinecap="round"
          />
          <path
            d={`M${P0.x} ${P0.y} C ${P1.x} ${P1.y}, ${P2.x} ${P2.y}, ${P3.x} ${P3.y}`}
            fill="none"
            stroke={C.gold}
            strokeWidth={4}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - routeDraw}
            style={{ filter: "drop-shadow(0 0 9px rgba(255,191,0,0.55))" }}
          />
        </svg>

        {/* Destino */}
        <div
          style={{
            position: "absolute",
            left: P3.x - 26,
            top: P3.y - 26,
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: `1.5px solid ${arrived ? C.greenDark : C.gold}`,
            background: "#111116",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 0 ${8 + arrivalPulse * 22}px rgba(255,191,0,${0.10 - arrivalPulse * 0.06})`,
          }}
        >
          <MapPin size={22} color={arrived ? C.greenDark : C.gold} />
        </div>

        {/* Auto */}
        <div
          style={{
            position: "absolute",
            left: car.x - 27,
            top: car.y - 27,
            width: 54,
            height: 54,
            borderRadius: "50%",
            background: C.gold,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 11px rgba(255,191,0,0.10), 0 14px 34px rgba(0,0,0,0.45)",
            transform: `rotate(${angle + 90}deg)`,
          }}
        >
          <Car size={26} color={C.ink} />
        </div>

        {/* Header */}
        <div
          style={{
            position: "absolute",
            left: 110,
            top: 58,
            width: 470,
            padding: "18px 22px",
            borderRadius: 20,
            background: "rgba(18,18,22,0.92)",
            border: `1px solid ${C.inkBorder}`,
            boxShadow: "0 24px 60px rgba(0,0,0,0.40)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            opacity: header,
            transform: `translateY(${interpolate(header, [0, 1], [-24, 0])}px)`,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "rgba(255,191,0,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Car size={24} color={C.gold} />
          </div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em", color: C.white }}>
              Panel del Taxista
            </div>
            <div style={{ marginTop: 4, fontFamily: F.sans, fontSize: 11.5, color: "rgba(247,246,242,0.44)" }}>
              Conduces con VIANova · Cartagena
            </div>
          </div>
        </div>

        {/* Toggle disponibilidad */}
        <div
          style={{
            position: "absolute",
            right: 110,
            top: 58,
            padding: "14px 18px",
            borderRadius: 999,
            background: "rgba(18,18,22,0.92)",
            border: `1px solid ${C.inkBorder}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: toggle,
            transform: `translateY(${interpolate(toggle, [0, 1], [-24, 0])}px)`,
          }}
        >
          <span style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.greenDark }}>Disponible</span>
          <div
            style={{
              width: 52,
              height: 28,
              borderRadius: 999,
              background: C.green,
              padding: 3,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#ffffff" }} />
          </div>
        </div>

        {/* Copy */}
        <Caption text="Muévete con locales." tone="dark" start={30} end={404} y={206} size={50} maxWidth={760} />

        {/* Viaje activo */}
        <div
          style={{
            position: "absolute",
            left: 110,
            top: 560,
            width: 486,
            padding: "22px 24px",
            borderRadius: 24,
            background: "rgba(18,18,22,0.94)",
            border: `1px solid ${C.inkBorder}`,
            boxShadow: "0 32px 80px rgba(0,0,0,0.45)",
            opacity: ride,
            transform: `translateY(${interpolate(ride, [0, 1], [48, 0])}px)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                background: "rgba(255,191,0,0.14)",
                fontFamily: F.sans,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: C.gold,
              }}
            >
              Viaje activo
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: F.mono, fontSize: 11, color: arrived ? C.greenDark : "rgba(247,246,242,0.50)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: arrived ? C.greenDark : C.gold }} />
              {arrived ? "En destino" : "6 min"}
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "linear-gradient(140deg, #ffd45c, #c99600)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: F.sans,
                fontSize: 14,
                fontWeight: 700,
                color: C.ink,
              }}
            >
              CR
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.white }}>Camila R.</div>
              <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 4, fontFamily: F.sans, fontSize: 11, color: "rgba(247,246,242,0.44)" }}>
                <Star size={10} color={C.gold} />
                4.9 · pasajera verificada
              </div>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: C.gold }}>$24.000</div>
          </div>

          <div style={{ marginTop: 18, position: "relative", paddingLeft: 26 }}>
            <div style={{ position: "absolute", left: 7, top: 8, bottom: 20, width: 1.5, background: "rgba(255,191,0,0.35)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "absolute", left: 0, width: 15, height: 15, borderRadius: "50%", border: `1.5px solid ${C.gold}`, background: "#121216" }} />
              <div>
                <div style={{ fontFamily: F.sans, fontSize: 10, color: "rgba(247,246,242,0.38)" }}>Origen</div>
                <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.white }}>Centro histórico</div>
              </div>
            </div>
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "absolute", left: 0, width: 15, height: 15, borderRadius: "50%", background: arrived ? C.green : C.gold }} />
              <div>
                <div style={{ fontFamily: F.sans, fontSize: 10, color: "rgba(247,246,242,0.38)" }}>Destino</div>
                <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.white }}>Bocagrande</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.inkBorder}`, display: "flex", justifyContent: "space-between", fontFamily: F.sans, fontSize: 11, color: "rgba(247,246,242,0.44)" }}>
            <span>Recogida confirmada</span>
            <span style={{ color: arrived ? C.greenDark : "rgba(247,246,242,0.62)", fontWeight: 600 }}>{arrived ? "Viaje completado" : "En camino"}</span>
          </div>
        </div>

        {/* Métricas */}
        <div
          style={{
            position: "absolute",
            right: 110,
            bottom: 74,
            display: "flex",
            gap: 14,
            opacity: metrics,
            transform: `translateY(${interpolate(metrics, [0, 1], [28, 0])}px)`,
          }}
        >
          {[
            { label: "Viajes hoy", value: "12" },
            { label: "Ganancia", value: "$186.000" },
            { label: "Calificación", value: "4.9" },
          ].map((item, index) => (
            <div
              key={item.label}
              style={{
                width: 196,
                padding: "16px 18px",
                borderRadius: 18,
                background: "rgba(18,18,22,0.92)",
                border: `1px solid ${C.inkBorder}`,
                boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: F.sans, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(247,246,242,0.40)" }}>
                  {item.label}
                </div>
                {index === 1 ? <TrendingUp size={13} color={C.greenDark} /> : null}
              </div>
              <div style={{ marginTop: 8, fontFamily: F.display, fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: index === 1 ? C.greenDark : C.white }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Salida: la ruta se endereza y se vuelve el gráfico del panel */}
        {outro > 0 ? (
          <>
            <div style={{ position: "absolute", inset: 0, background: "#08080a", opacity: outro * 0.72 }} />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 806,
                width: 1920 * outro,
                height: 3,
                background: `linear-gradient(90deg, rgba(255,191,0,0), ${C.gold} 18%, ${C.gold} 82%, rgba(255,191,0,0))`,
                boxShadow: "0 0 30px rgba(255,191,0,0.55)",
              }}
            />
          </>
        ) : null}

        {/* El recibo sale de cuadro hacia la izquierda */}
        {receiptIntro < 1 ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1920,
              height: 1080,
              background: "#0d0d12",
              borderRight: "2px dashed rgba(255,191,0,0.42)",
              boxShadow: "30px 0 80px rgba(0,0,0,0.55)",
              transform: `translateX(${-1920 * receiptIntro}px)`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "90px 54px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                fontFamily: F.mono,
                fontSize: 16,
                letterSpacing: "0.18em",
                color: "rgba(255,191,0,0.30)",
                whiteSpace: "nowrap",
              }}
            >
              {["VIANOVA · PAGO APROBADO", "TOTAL $1.240.000 COP", "REF WV-8F3K-2210", "3 PARADAS · 2 VIAJEROS", "GRACIAS POR VIAJAR"].map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        ) : null}
      </AbsoluteFill>
    </Stage>
  );
};
