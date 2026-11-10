import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { Caption } from "../components/Caption";
import { Logo } from "../components/Logo";
import { C, F } from "../theme";
import { Compass, Globe, MapPin, Search, Star } from "../components/Icons";

const CARDS = [
  {
    name: "Cartagena de Indias",
    place: "Bolívar, Colombia",
    tag: "Alojamiento",
    price: "$420.000",
    unit: "noche",
    rating: "4.9",
    image: "img/cartagena.webp",
  },
  {
    name: "Valle de Cocora",
    place: "Quindío, Colombia",
    tag: "Experiencia",
    price: "$180.000",
    unit: "persona",
    rating: "4.8",
    image: "img/cocora-hero.webp",
  },
  {
    name: "Desierto de la Tatacoa",
    place: "Huila, Colombia",
    tag: "Experiencia",
    price: "$150.000",
    unit: "persona",
    rating: "4.7",
    image: "img/tatacoa.webp",
  },
];

const PILLS = ["Todos los Destinos", "Alojamientos", "Gastronomía", "Experiencias", "Movilidad"];

export const Ch2Market: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();

  const heroIn = interpolate(frame, [8, 34], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const zoom = interpolate(frame, [60, duration], [1, 1.045], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lift = interpolate(frame, [duration - 52, duration - 8], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Stage tone="light">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoom})`,
            transformOrigin: "50% 62%",
          }}
        >
          {/* Barra superior */}
          <div
            style={{
              position: "absolute",
              left: 120,
              right: 120,
              top: 36,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: heroIn,
            }}
          >
            <Logo markHeight={46} wordSize={26} tone="light" />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {[
                { label: "Explorar", icon: <Compass size={16} color={C.muted} /> },
                { label: "ViaSocial", icon: <Globe size={16} color={C.muted} /> },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 15px",
                    borderRadius: 999,
                    fontFamily: F.sans,
                    fontSize: 14,
                    fontWeight: 500,
                    color: C.muted,
                    border: `1px solid ${C.paperBorder}`,
                    background: "rgba(255,255,255,0.55)",
                  }}
                >
                  {item.icon}
                  {item.label}
                </div>
              ))}
              <div
                style={{
                  marginLeft: 6,
                  padding: "10px 20px",
                  borderRadius: 999,
                  fontFamily: F.sans,
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.ink,
                  background: C.gold,
                }}
              >
                Iniciar sesión
              </div>
            </div>
          </div>

          {/* Hero */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 132, textAlign: "center" }}>
            <div style={{ overflow: "hidden", paddingBottom: 4 }}>
              <div
                style={{
                  fontFamily: F.display,
                  fontWeight: 600,
                  fontSize: 52,
                  letterSpacing: "-0.035em",
                  color: C.ink,
                  lineHeight: 1.1,
                  opacity: heroIn,
                  transform: `translateY(${interpolate(heroIn, [0, 1], [22, 0])}px)`,
                }}
              >
                Planifica tu viaje con
              </div>
            </div>
            <div style={{ overflow: "hidden", paddingBottom: 8, marginTop: 2 }}>
              <div
                style={{
                  fontFamily: F.display,
                  fontWeight: 800,
                  fontSize: 82,
                  letterSpacing: "-0.055em",
                  lineHeight: 1,
                  color: C.gold,
                  transform: `translateY(${interpolate(heroIn, [0, 1], [72, 0])}px)`,
                }}
              >
                VIANova
              </div>
            </div>
            <div
              style={{
                margin: "20px auto 0",
                maxWidth: 760,
                fontFamily: F.sans,
                fontSize: 20,
                lineHeight: 1.55,
                color: C.muted,
                opacity: interpolate(frame, [28, 52], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              Explora destinos, sabores y experiencias inolvidables con un itinerario creado por
              inteligencia artificial.
            </div>
          </div>

          {/* Buscador: el pin viene del capítulo anterior */}
          <div
            style={{
              position: "absolute",
              left: 570,
              top: 392,
              width: 780,
              height: 66,
              borderRadius: 18,
              background: C.paperCard,
              border: `1px solid ${C.paperBorder}`,
              boxShadow: "0 18px 50px rgba(48,40,20,0.10)",
              display: "flex",
              alignItems: "center",
              padding: "0 10px 0 22px",
              // A plena opacidad desde el frame 0 para que el pin que llega del
              // capítulo 1 no parpadee al cruzar el corte.
              opacity: 1,
            }}
          >
            <div style={{ position: "relative", width: 26, height: 26, marginRight: 12 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${interpolate(frame, [0, 9], [2, 1])})`,
                  opacity: interpolate(frame, [0, 6, 9, 14], [1, 1, 0, 0]),
                }}
              >
                <Img
                  src={staticFile("brand/brand-mark-principal.png")}
                  style={{ width: 24, height: 22, objectFit: "contain" }}
                />
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: interpolate(frame, [8, 16], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                <MapPin size={22} color={C.goldDeep} />
              </div>
            </div>
            <div style={{ fontFamily: F.sans, fontSize: 18, color: C.muted, flex: 1 }}>
              ¿A dónde quieres ir?
            </div>
            <div
              style={{
                height: 48,
                padding: "0 28px",
                borderRadius: 13,
                background: C.ink,
                color: C.white,
                fontFamily: F.sans,
                fontSize: 15,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Search size={17} color={C.white} />
              Buscar
            </div>
          </div>

          {/* Categorías */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 486,
              display: "flex",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {PILLS.map((pill, index) => {
              const appear = interpolate(frame, [50 + index * 6, 68 + index * 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const active = index === 0;
              return (
                <div
                  key={pill}
                  style={{
                    padding: "11px 20px",
                    borderRadius: 999,
                    fontFamily: F.sans,
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    color: active ? C.ink : C.muted,
                    background: active ? C.gold : "rgba(255,255,255,0.72)",
                    border: `1px solid ${active ? "rgba(201,150,0,0.35)" : C.paperBorder}`,
                    opacity: appear,
                    transform: `translateY(${interpolate(appear, [0, 1], [12, 0])}px)`,
                  }}
                >
                  {pill}
                </div>
              );
            })}
          </div>

          {/* Sección */}
          <div
            style={{
              position: "absolute",
              left: 250,
              right: 250,
              top: 574,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              opacity: interpolate(frame, [66, 86], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: F.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: C.goldDeep,
                }}
              >
                Explora Colombia
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: F.display,
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  color: C.ink,
                }}
              >
                Destinos destacados
              </div>
            </div>
            <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.muted }}>
              Ver todos →
            </div>
          </div>

          {/* Tarjetas */}
          <div
            style={{
              position: "absolute",
              left: 250,
              top: 642,
              display: "flex",
              gap: 22,
            }}
          >
            {CARDS.map((card, index) => {
              const appear = spring({
                frame: frame - (78 + index * 9),
                fps: 60,
                config: { damping: 18, mass: 0.75, stiffness: 110 },
              });
              const isHero = index === 0;
              const cardLift = isHero ? lift : 0;
              return (
                <div
                  key={card.name}
                  style={{
                    width: 460,
                    height: 246,
                    borderRadius: 20,
                    background: C.paperCard,
                    border: `1px solid ${C.paperBorder}`,
                    boxShadow: `0 ${18 + cardLift * 24}px ${44 + cardLift * 30}px rgba(48,40,20,${0.08 + cardLift * 0.06})`,
                    overflow: "hidden",
                    opacity: appear * (1 - cardLift),
                    transform: `translateY(${interpolate(appear, [0, 1], [34, 0]) - cardLift * 42}px) scale(${1 + cardLift * 0.045})`,
                  }}
                >
                  <div style={{ position: "relative", height: 148, overflow: "hidden" }}>
                    <Img
                      src={staticFile(card.image)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: `scale(${1.02 + cardLift * 0.08})`,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: 12,
                        top: 12,
                        padding: "5px 10px",
                        borderRadius: 999,
                        background: "rgba(8,8,10,0.62)",
                        color: C.white,
                        fontFamily: F.sans,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {card.tag}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        right: 12,
                        top: 12,
                        padding: "5px 9px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.92)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontFamily: F.sans,
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.ink,
                      }}
                    >
                      <Star size={11} color={C.goldDeep} />
                      {card.rating}
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px 0" }}>
                    <div
                      style={{
                        fontFamily: F.display,
                        fontSize: 19,
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        color: C.ink,
                      }}
                    >
                      {card.name}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontFamily: F.sans,
                        fontSize: 12,
                        color: C.muted,
                      }}
                    >
                      <MapPin size={12} color={C.muted} />
                      {card.place}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ fontFamily: F.sans, fontSize: 16, fontWeight: 700, color: C.ink }}>
                        {card.price}
                        <span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}> / {card.unit}</span>
                      </div>
                      <div
                        style={{
                          fontFamily: F.sans,
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.goldDeep,
                        }}
                      >
                        Reservar
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hairline editorial */}
          <div
            style={{
              position: "absolute",
              left: 120,
              right: 120,
              top: 918,
              height: 1,
              background: C.paperBorder,
              opacity: 0.8,
            }}
          />
        </div>

        {/* La foto de la tarjeta se desprende y cubre el cuadro */}
        <AbsoluteFill
          style={{
            opacity: lift,
            clipPath: `inset(${interpolate(lift, [0, 1], [59.4, 0])}% ${interpolate(lift, [0, 1], [63, 0])}% ${interpolate(lift, [0, 1], [26.9, 0])}% ${interpolate(lift, [0, 1], [13, 0])}%)`,
            zIndex: 20,
          }}
        >
          <Img src={staticFile("img/cartagena.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(5,6,8,0.55) 0%, rgba(5,6,8,0.06) 34%, rgba(5,6,8,0.10) 58%, rgba(5,6,8,0.78) 100%)",
            }}
          />
        </AbsoluteFill>

        <Caption text="Colombia, en un solo lugar." tone="light" start={26} end={200} y={958} size={44} />
      </AbsoluteFill>
    </Stage>
  );
};
