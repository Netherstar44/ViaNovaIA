import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { Caption } from "../components/Caption";
import { MapGrid } from "../components/MapGrid";
import { C, F } from "../theme";
import { Calendar, Check, CreditCard, MapPin, Users, Wallet } from "../components/Icons";

const STOPS = [
  { name: "Centro histórico", price: "$420.000", x: 330, y: 330, labelX: 300, labelY: 394 },
  { name: "Getsemaní", price: "$300.000", x: 600, y: 600, labelX: 556, labelY: 664 },
  { name: "Bocagrande", price: "$520.000", x: 930, y: 420, labelX: 888, labelY: 300 },
];

const cop = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

/**
 * Capítulo 5 — Ruta y pago.
 * Mapa editorial + hoja real de pago (RoutePaymentPanel) con estados de aprobación.
 */
export const Ch5RoutePay: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();

  const draw = interpolate(frame, [18, 104], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sheet = spring({ frame: frame - 112, fps: 60, config: { damping: 20, mass: 0.85, stiffness: 80 } });
  const press = interpolate(frame, [244, 262], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clickRing = interpolate(frame, [258, 286], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const spinner = frame >= 262 && frame < 300;
  const approved = frame >= 300;
  const stamp = spring({ frame: frame - 354, fps: 60, config: { damping: 12, mass: 0.6, stiffness: 140 } });
  const total = Math.round(
    interpolate(frame, [120, 168], [0, 1240000], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const cursorX = interpolate(frame, [214, 252], [1030, 1476], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorY = interpolate(frame, [214, 252], [724, 786], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorScale = 1 - press * 0.14;
  const cursorIn = interpolate(frame, [206, 214], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sweep = interpolate(frame, [432, 478], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /** Continúa el iris que abrió el badge 360° desde (1360,404). */
  const iris = interpolate(frame, [0, 22], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const irisRadius = interpolate(iris, [0, 1], [0, 2200]);

  return (
    <Stage tone="dark">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: `circle(${irisRadius}px at 1360px 404px)`,
          }}
        >
        <MapGrid glow />

        {/* Ruta */}
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <path
            d="M330 330 C 356 506, 468 638, 600 600 C 738 560, 838 486, 930 420"
            fill="none"
            stroke="rgba(255,191,0,0.16)"
            strokeWidth={16}
            strokeLinecap="round"
          />
          <path
            d="M330 330 C 356 506, 468 638, 600 600 C 738 560, 838 486, 930 420"
            fill="none"
            stroke={C.gold}
            strokeWidth={4}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
            style={{ filter: "drop-shadow(0 0 10px rgba(255,191,0,0.55))" }}
          />
        </svg>

        {/* Pines y etiquetas */}
        {STOPS.map((stop, index) => {
          const appear = spring({ frame: frame - (32 + index * 22), fps: 60, config: { damping: 16, mass: 0.6 } });
          return (
            <React.Fragment key={stop.name}>
              <div
                style={{
                  position: "absolute",
                  left: stop.x - 25,
                  top: stop.y - 25,
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  border: `1.5px solid ${C.gold}`,
                  background: "#121216",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 0 9px rgba(255,191,0,0.08)",
                  opacity: appear,
                  transform: `scale(${interpolate(appear, [0, 1], [0.6, 1])})`,
                }}
              >
                <MapPin size={21} color={C.gold} />
              </div>
              <div
                style={{
                  position: "absolute",
                  left: stop.labelX,
                  top: stop.labelY,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "rgba(18,18,22,0.92)",
                  border: `1px solid ${C.inkBorder}`,
                  boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                  opacity: appear,
                  transform: `translateY(${interpolate(appear, [0, 1], [10, 0])}px)`,
                }}
              >
                <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.white, whiteSpace: "nowrap" }}>
                  {stop.name}
                </div>
                <div style={{ marginTop: 3, fontFamily: F.mono, fontSize: 10, color: "rgba(247,246,242,0.46)" }}>
                  {index + 1} / 3 · {stop.price}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Hoja de pago */}
        <div
          style={{
            position: "absolute",
            left: 1130,
            top: 220,
            width: 670,
            height: 640,
            borderRadius: 30,
            background: "#121216",
            border: `1px solid ${C.inkBorder}`,
            boxShadow: "0 50px 140px rgba(0,0,0,0.70)",
            padding: "18px 30px 26px",
            display: "flex",
            flexDirection: "column",
            opacity: sheet,
            transform: `translateY(${interpolate(sheet, [0, 1], [720, 0])}px)`,
          }}
        >
          <div style={{ width: 52, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.16)", margin: "0 auto 14px" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "rgba(255,191,0,0.13)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Wallet size={20} color={C.gold} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: C.white }}>
                Revisa y paga tu ruta
              </div>
              <div style={{ marginTop: 3, fontFamily: F.sans, fontSize: 11.5, color: "rgba(247,246,242,0.42)" }}>
                Pago protegido · sandbox de demostración
              </div>
            </div>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.05)",
                position: "relative",
              }}
            >
              <div style={{ position: "absolute", left: 12, top: 16, width: 10, height: 1.5, background: "rgba(255,255,255,0.45)", transform: "rotate(45deg)" }} />
              <div style={{ position: "absolute", left: 12, top: 16, width: 10, height: 1.5, background: "rgba(255,255,255,0.45)", transform: "rotate(-45deg)" }} />
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontFamily: F.sans, fontSize: 12, color: "rgba(247,246,242,0.44)" }}>Total a pagar</div>
            <div
              style={{
                marginTop: 4,
                fontFamily: F.display,
                fontSize: 40,
                fontWeight: 700,
                letterSpacing: "-0.035em",
                color: C.gold,
              }}
            >
              {cop(total)}
            </div>
          </div>

          <div style={{ marginTop: 16, height: 1, background: C.inkBorder }} />

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: F.sans, fontSize: 12, color: "rgba(247,246,242,0.48)" }}>
              <MapPin size={14} color="rgba(247,246,242,0.48)" />
              Paradas / proveedores
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: C.white }}>3 / 3</div>
          </div>
          <div style={{ marginTop: 9, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: F.sans, fontSize: 12, color: "rgba(247,246,242,0.48)" }}>
              <Users size={14} color="rgba(247,246,242,0.48)" />
              Viajeros
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: C.white }}>2</div>
          </div>
          <div style={{ marginTop: 9, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: F.sans, fontSize: 12, color: "rgba(247,246,242,0.48)" }}>
              <Calendar size={14} color="rgba(247,246,242,0.48)" />
              Fechas
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: C.white }}>12 — 14 dic</div>
          </div>

          <div style={{ marginTop: 14, height: 1, background: C.inkBorder }} />

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
            {STOPS.map((stop, index) => (
              <div key={stop.name} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `1px solid rgba(255,191,0,0.55)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: F.mono,
                    fontSize: 8,
                    color: C.gold,
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ flex: 1, fontFamily: F.sans, fontSize: 12, color: "rgba(247,246,242,0.78)" }}>{stop.name}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10.5, color: "rgba(247,246,242,0.44)" }}>{stop.price}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${approved ? "rgba(74,222,128,0.30)" : "rgba(255,191,0,0.30)"}`,
              background: approved ? "rgba(74,222,128,0.07)" : "rgba(255,191,0,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: `2px solid ${approved ? C.greenDark : C.gold}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: approved ? C.greenDark : C.gold }} />
            </div>
            <div style={{ flex: 1, fontFamily: F.sans, fontSize: 11.5, color: "rgba(247,246,242,0.78)" }}>
              Wompi · tarjeta, PSE, Nequi o QR
            </div>
            <CreditCard size={16} color="rgba(247,246,242,0.44)" />
          </div>

          <div style={{ marginTop: 26 }}>
            <div
              style={{
                height: 58,
                borderRadius: 14,
                background: approved ? C.green : C.gold,
                color: approved ? "#06140b" : C.ink,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                fontFamily: F.sans,
                fontSize: 14,
                fontWeight: 700,
                transform: `scale(${1 - press * 0.012})`,
                boxShadow: approved ? "0 10px 34px rgba(22,163,74,0.28)" : "0 10px 34px rgba(255,191,0,0.18)",
              }}
            >
              {spinner ? (
                <Spinner color={C.ink} />
              ) : approved ? (
                <>
                  <Check size={17} color="#06140b" />
                  Pago aprobado
                </>
              ) : (
                <>
                  Revisar y pagar
                  <span style={{ fontFamily: F.mono, fontSize: 12, opacity: 0.7 }}>→</span>
                </>
              )}
            </div>
            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: F.mono,
                fontSize: 10,
                color: approved ? "rgba(74,222,128,0.80)" : "rgba(247,246,242,0.36)",
              }}
            >
              <span>{approved ? "Ref. WV-8F3K-2210" : "Cifrado de extremo a extremo"}</span>
              <span>{approved ? "TRANSACCIÓN COMPLETA" : "Wompi"}</span>
            </div>
          </div>

          {/* Sello pagado */}
          {stamp > 0 ? (
            <div
              style={{
                position: "absolute",
                right: 34,
                top: 224,
                padding: "10px 18px",
                border: `3px solid ${C.greenDark}`,
                borderRadius: 8,
                color: C.greenDark,
                fontFamily: F.sans,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "0.16em",
                transform: `rotate(-7deg) scale(${interpolate(stamp, [0, 1], [1.35, 1])})`,
                opacity: interpolate(stamp, [0, 1], [0, 1]),
              }}
            >
              PAGADO
            </div>
          ) : null}
        </div>

        {/* Cursor */}
        <svg
          width={38}
          height={46}
          viewBox="0 0 38 46"
          style={{
            position: "absolute",
            left: cursorX,
            top: cursorY,
            transform: `scale(${cursorScale})`,
            transformOrigin: "4px 4px",
            opacity: cursorIn,
            filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.45))",
          }}
        >
          <path d="M5 3 L5 35 L13 28 L19 42 L26 39 L20 25 L31 25 Z" fill={C.white} stroke={C.ink} strokeWidth={2} />
        </svg>
        <div
          style={{
            position: "absolute",
            left: 1466,
            top: 763,
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: `2px solid ${C.gold}`,
            opacity: (1 - clickRing) * (clickRing > 0 ? 1 : 0),
            transform: `scale(${0.4 + clickRing * 1.8})`,
          }}
        />

        <Caption text="Reserva y paga en un paso." tone="dark" start={26} end={424} y={930} size={50} maxWidth={980} />

        {/* Transición: borde de recibo */}
        {sweep > 0 ? (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              height: 1080,
              width: 670 + sweep * 1300,
              background: "#0d0d12",
              borderLeft: `2px dashed rgba(255,191,0,0.42)`,
              boxShadow: "-30px 0 80px rgba(0,0,0,0.55)",
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
        </div>

        {/* Filo dorado del iris, sin escalar el grosor */}
        {iris > 0.02 && iris < 0.99 ? (
          <div
            style={{
              position: "absolute",
              left: 1360 - irisRadius,
              top: 404 - irisRadius,
              width: irisRadius * 2,
              height: irisRadius * 2,
              borderRadius: "50%",
              border: "2px solid rgba(255,191,0,0.42)",
              opacity: 1 - iris,
              boxShadow: "0 0 50px rgba(255,191,0,0.18)",
            }}
          />
        ) : null}
      </AbsoluteFill>
    </Stage>
  );
};

const Spinner: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" style={{ transform: `rotate(${frame * 18}deg)` }}>
      <circle cx="10" cy="10" r="7.5" stroke="rgba(0,0,0,0.18)" strokeWidth="2.5" fill="none" />
      <path d="M10 2.5 A 7.5 7.5 0 0 1 17.5 10" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
};
