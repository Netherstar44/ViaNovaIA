import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { Caption } from "../components/Caption";
import { Logo } from "../components/Logo";
import { C, F } from "../theme";
import { Calendar, Car, ShoppingBag, Sparkles, Wallet } from "../components/Icons";

const values = [0.18, 0.26, 0.22, 0.38, 0.33, 0.47, 0.42, 0.58, 0.54, 0.68, 0.76, 0.9];
const CHART_W = 930;
const CHART_H = 170;

const points = values.map((value, index) => ({
  x: (index / (values.length - 1)) * CHART_W,
  y: CHART_H - value * CHART_H,
}));

const smoothPath = (pts: { x: number; y: number }[]) => {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
};

const areaPath = `${smoothPath(points)} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`;
const linePath = smoothPath(points);

const cop = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

const KPIS = [
  { label: "Total gastado", hint: "Compras, reservas y viajes", icon: Wallet, target: 2480000, money: true },
  { label: "Compras", hint: "Órdenes pagadas", icon: ShoppingBag, target: 14, money: false },
  { label: "Reservas", hint: "Servicios confirmados", icon: Calendar, target: 9, money: false },
  { label: "Viajes", hint: "Recorridos completados", icon: Car, target: 6, money: false },
];

const DONUT = [
  { label: "Alojamiento", value: 46, color: C.gold },
  { label: "Experiencias", value: 34, color: C.ink },
  { label: "Gastronomía", value: 20, color: "#b8b4a4" },
];

/**
 * Capítulo 7 — Panel del Viajero.
 * KPIs reales, actividad y distribución; el KPI principal gira y se vuelve la tarjeta del cierre.
 */
export const Ch7Panel: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();

  const header = spring({ frame: frame - 2, fps: 60, config: { damping: 18, mass: 0.7 } });
  const chartDraw = interpolate(frame, [54, 150], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const donutDraw = interpolate(frame, [66, 156], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pointsIn = spring({ frame: frame - 168, fps: 60, config: { damping: 16, mass: 0.6 } });

  const flipFront = interpolate(frame, [300, 322], [0, 1], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const flipBack = interpolate(frame, [322, 344], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardScale = interpolate(frame, [344, 360], [1, 1.72], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  /*
   * La tarjeta está escalada 1.72× desde su centro. Para que su caja visual
   * termine exactamente en (704,428) —el punto donde arranca el capítulo 8—
   * se compensa el desplazamiento que introduce el escalado.
   */
  const cardLeft = interpolate(frame, [344, 360], [110, 848.72], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardTop = interpolate(frame, [344, 360], [230, 479.12], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /** El gráfico del capítulo 6 se endereza y se vuelve la línea base del panel. */
  const introDim = interpolate(frame, [0, 18], [1, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const introLineY = interpolate(frame, [0, 18], [806, 677], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const introLineOpacity = interpolate(frame, [0, 34, 54], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Stage tone="light">
      <AbsoluteFill>
        {/* Barra superior */}
        <div
          style={{
            position: "absolute",
            left: 110,
            right: 110,
            top: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: header,
            transform: `translateY(${interpolate(header, [0, 1], [-18, 0])}px)`,
          }}
        >
          <Logo markHeight={38} wordSize={23} tone="light" />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.ink }}>Hola, viajero</div>
              <div style={{ fontFamily: F.sans, fontSize: 10.5, color: C.muted }}>Nivel Explorador</div>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: C.ink,
                color: C.gold,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: F.sans,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              JR
            </div>
          </div>
        </div>

        {/* Título */}
        <div style={{ position: "absolute", left: 110, top: 128, opacity: header }}>
          <div style={{ fontFamily: F.display, fontSize: 40, fontWeight: 600, letterSpacing: "-0.035em", color: C.ink }}>
            Panel del Viajero
          </div>
          <div style={{ marginTop: 7, fontFamily: F.sans, fontSize: 13.5, color: C.muted }}>
            Resumen de tu actividad · 12 — 14 dic
          </div>
        </div>

        {/* KPIs */}
        {KPIS.map((kpi, index) => {
          const enter = spring({ frame: frame - (12 + index * 13), fps: 60, config: { damping: 18, mass: 0.7 } });
          const count = Math.round(
            interpolate(frame, [30 + index * 10, 94 + index * 10], [0, kpi.target], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          );
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              style={{
                position: "absolute",
                left: 110 + index * 426,
                top: 230,
                width: 402,
                height: 142,
                borderRadius: 18,
                background: index === 0 ? "#fff8e2" : C.paperCard,
                border: `1px solid ${index === 0 ? "rgba(201,150,0,0.28)" : C.paperBorder}`,
                boxShadow: "0 12px 34px rgba(48,40,20,0.05)",
                padding: "20px 22px",
                opacity: index === 0 && frame >= 300 ? 0 : enter,
                transform: `translateY(${interpolate(enter, [0, 1], [26, 0])}px)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, letterSpacing: "0.13em", textTransform: "uppercase", color: index === 0 ? C.goldDeep : C.muted }}>
                  {kpi.label}
                </div>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: index === 0 ? "rgba(255,191,0,0.20)" : "#f2f0e9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={16} color={index === 0 ? C.goldDeep : C.muted} />
                </div>
              </div>
              <div style={{ marginTop: 12, fontFamily: F.display, fontSize: 29, fontWeight: 700, letterSpacing: "-0.035em", color: C.ink }}>
                {kpi.money ? cop(count) : count}
              </div>
              <div style={{ marginTop: 5, fontFamily: F.sans, fontSize: 10.5, color: C.muted }}>{kpi.hint}</div>
            </div>
          );
        })}

        {/* Actividad */}
        <div
          style={{
            position: "absolute",
            left: 110,
            top: 404,
            width: 1030,
            height: 356,
            borderRadius: 20,
            background: C.paperCard,
            border: `1px solid ${C.paperBorder}`,
            boxShadow: "0 16px 44px rgba(48,40,20,0.05)",
            padding: "22px 26px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", color: C.ink }}>
                Actividad reciente
              </div>
              <div style={{ marginTop: 4, fontFamily: F.sans, fontSize: 11.5, color: C.muted }}>Gasto por mes</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: F.sans, fontSize: 11, color: C.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: C.gold }} />
              COP
            </div>
          </div>

          <div style={{ marginTop: 14, position: "relative", height: 236 }}>
            {/* Rejilla */}
            <svg width={CHART_W} height={CHART_H} style={{ position: "absolute", left: 20, top: 26 }}>
              {[0, 0.25, 0.5, 0.75, 1].map((line) => (
                <line key={line} x1={0} y1={line * CHART_H} x2={CHART_W} y2={line * CHART_H} stroke="#efede6" strokeWidth={1} />
              ))}
            </svg>

            <div
              style={{
                position: "absolute",
                left: 20,
                top: 26,
                width: CHART_W,
                height: CHART_H,
                clipPath: `inset(0 ${100 - chartDraw * 100}% 0 0)`,
              }}
            >
              <svg width={CHART_W} height={CHART_H} style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.gold} stopOpacity="0.34" />
                    <stop offset="100%" stopColor={C.gold} stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#areaFill)" />
                <path d={linePath} fill="none" stroke={C.goldDeep} strokeWidth={3} strokeLinecap="round" />
                {points.map((point, index) => (
                  <circle key={index} cx={point.x} cy={point.y} r={index === points.length - 1 ? 6 : 3.5} fill={index === points.length - 1 ? C.ink : C.goldDeep} stroke="#ffffff" strokeWidth={index === points.length - 1 ? 3 : 0} />
                ))}
              </svg>
            </div>

            <div style={{ position: "absolute", left: 20, top: CHART_H + 36, width: CHART_W, display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 9.5, color: C.muted }}>
              {["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"].map((month) => (
                <span key={month}>{month}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Distribución */}
        <div
          style={{
            position: "absolute",
            left: 1160,
            top: 404,
            width: 650,
            height: 356,
            borderRadius: 20,
            background: C.paperCard,
            border: `1px solid ${C.paperBorder}`,
            boxShadow: "0 16px 44px rgba(48,40,20,0.05)",
            padding: "22px 26px",
          }}
        >
          <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", color: C.ink }}>
            Distribución
          </div>
          <div style={{ marginTop: 4, fontFamily: F.sans, fontSize: 11.5, color: C.muted }}>Tus categorías</div>

          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 28 }}>
            <svg width={176} height={176} viewBox="0 0 176 176">
              <circle cx={88} cy={88} r={68} fill="none" stroke="#f0eee7" strokeWidth={22} />
              {(() => {
                let cursor = 0;
                const circumference = 2 * Math.PI * 68;
                return DONUT.map((segment) => {
                  const offset = cursor;
                  cursor += segment.value;
                  const length = (segment.value / 100) * circumference * donutDraw;
                  return (
                    <circle
                      key={segment.label}
                      cx={88}
                      cy={88}
                      r={68}
                      fill="none"
                      stroke={segment.color}
                      strokeWidth={22}
                      strokeLinecap="butt"
                      strokeDasharray={`${Math.max(0, length - 3)} ${circumference}`}
                      strokeDashoffset={-(offset / 100) * circumference}
                      transform="rotate(-90 88 88)"
                    />
                  );
                });
              })()}
              <text x={88} y={82} textAnchor="middle" fontFamily={F.display} fontSize={28} fontWeight={700} fill={C.ink}>
                14
              </text>
              <text x={88} y={102} textAnchor="middle" fontFamily={F.sans} fontSize={9.5} fill={C.muted} letterSpacing="0.12em">
                MOVIMIENTOS
              </text>
            </svg>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              {DONUT.map((segment, index) => {
                const appear = interpolate(frame, [86 + index * 14, 112 + index * 14], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                return (
                  <div key={segment.label} style={{ display: "flex", alignItems: "center", gap: 9, opacity: appear }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: segment.color }} />
                    <div style={{ flex: 1, fontFamily: F.sans, fontSize: 12, color: C.ink }}>{segment.label}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>{segment.value}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              paddingTop: 13,
              borderTop: `1px solid ${C.paperBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: pointsIn,
              transform: `translateY(${interpolate(pointsIn, [0, 1], [10, 0])}px)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={15} color={C.goldDeep} />
              <span style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.ink }}>Puntos VIANova</span>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: C.goldDeep }}>1.250</div>
          </div>
        </div>

        <Caption text="Todo, bajo control." tone="light" start={26} end={252} y={912} size={48} maxWidth={900} />

        {/* La línea del capítulo 6 se endereza sobre la línea base del gráfico */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: C.ink,
            opacity: introDim,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: introLineY - 1.5,
            width: 1920,
            height: 3,
            background: `linear-gradient(90deg, rgba(255,191,0,0), ${C.gold} 18%, ${C.gold} 82%, rgba(255,191,0,0))`,
            boxShadow: "0 0 30px rgba(255,191,0,0.55)",
            opacity: introLineOpacity,
          }}
        />

        {/* Fundido de cierre: oscurece el panel, nunca la tarjeta que viaja */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: C.ink,
            opacity: interpolate(frame, [duration - 30, duration], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />

        {/* Transición: el KPI principal gira y se vuelve la tarjeta negra */}
        {frame >= 300 ? (
          <div
            style={{
              position: "absolute",
              left: cardLeft,
              top: cardTop,
              width: 402,
              height: 142,
              perspective: 1200,
              transform: `scale(${cardScale})`,
              transformOrigin: "center",
              zIndex: 20,
            }}
          >
            {flipFront < 1 ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 18,
                  background: "#fff8e2",
                  border: "1px solid rgba(201,150,0,0.28)",
                  transform: `rotateY(${flipFront * 90}deg)`,
                  backfaceVisibility: "hidden",
                  boxShadow: "0 24px 60px rgba(48,40,20,0.16)",
                  padding: "20px 22px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div
                    style={{
                      fontFamily: F.sans,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.13em",
                      textTransform: "uppercase",
                      color: C.goldDeep,
                    }}
                  >
                    Total gastado
                  </div>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "rgba(255,191,0,0.20)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Wallet size={16} color={C.goldDeep} />
                  </div>
                </div>
                <div style={{ fontFamily: F.display, fontSize: 29, fontWeight: 700, letterSpacing: "-0.035em", color: C.ink }}>
                  {cop(2480000)}
                </div>
                <div style={{ fontFamily: F.sans, fontSize: 10.5, color: C.muted }}>Compras, reservas y viajes</div>
              </div>
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 18,
                  background: "#0b0b0e",
                  border: "1px solid rgba(255,191,0,0.20)",
                  transform: `rotateY(${-90 + flipBack * 90}deg)`,
                  boxShadow: "0 40px 120px rgba(0,0,0,0.50)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: flipBack,
                }}
              >
                <Logo markHeight={34} wordSize={13} gap={6} tone="dark" />
              </div>
            )}
          </div>
        ) : null}
      </AbsoluteFill>
    </Stage>
  );
};
