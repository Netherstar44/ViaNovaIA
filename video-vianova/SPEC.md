# SPEC — ViaNovaIA · El hilo dorado

GOAL: que un viajero colombiano entienda que ViaNovaIA convierte una conversación en un viaje real por el Huila, y que escanee o visite `via-nova-ia.vercel.app`.

OUTPUT: HyperFrames · 1920×1080 · 30 fps · 46 s (1380 frames) · H.264 master, audio estéreo.

TIME: 100 BPM · 18 frames por pulso · corte cada 2–4 s · VO 150–160 wpm · pausas 0.3–0.5 s.

LOOK:
- Ground `#0B0B0C` en apertura, chat, mapa, movimiento y cierre; `#F5F4F0` solo en la escena de negocio. Ink `#FFFFFF` / `#0B0B0C`. Único acento saturado `#FFBF00`; aparece en el hilo, el caret, los pins, el botón de enviar, el like y el subrayado de la URL.
- Display: Poppins ExtraBold, 62–104 px, tracking −3.5% a −4.5%. Body/UI: Inter 400–700, 10–38 px según distancia de cámara. Texto legible ≥ 24 px equivalentes en 1080p para la UI en primer plano.
- Medio: UI de producto real reconstruida en HTML, vidrio líquido (`blur(12–18px) saturate(1.3)`, borde 1 px `rgba(255,255,255,.14)`, brillo interior), sombras suaves `0 50px 120px rgba(0,0,0,.55)`. Sin neón.
- Luz cálida desde arriba-izquierda; halo dorado radial al 16–20% de opacidad. Grano 4.5–5.5%; viñeta 40–55%.
- El logo es el PNG real; no se redibuja, deforma ni recolorea.

OBJECTS:
- Logo ViaNova (PNG real, triángulo dorado con carretera) + wordmark “VIANova” con “IA” en dorado.
- Panel de chat de cristal oscuro: avatar/orbe dorado, burbujas, caret, micrófono, tarjetas de itinerario.
- Mapa oscuro de Neiva/Huila: pins dorados, ruta, tarjetas de Hotel Plaza Neiva, Asadero El Huilense, Tour Tatacoa 360°, taxi.
- Overlay de voz: 12 barras doradas, transcripción.
- Teléfono y laptop con UI real; QR real a `https://via-nova-ia.vercel.app`.

MOTION:
- Entradas: `cubic-bezier(0.16, 1, 0.3, 1)`, 24–30 frames, desplazamiento 12–28 px.
- Cámara: push-in 1.0 → 1.06, máximo 1.12; parallax 8–12 px; sin shake.
- Muelles: damping 0.75 para posición y escala; nunca en opacidad ni color.
- Stagger de tarjetas: 3 frames. Salidas: 12–16 frames. Un solo cursor macOS de 22 px.
- Nada de animar layout: solo transform y opacity.

SHOTS:
1. `00:00–00:04` — Apertura: el caret dorado se estira y se convierte en la carretera del logo; el logo real se revela; el titular entra en dos líneas. Lee: logo (0.6–1.8 s), pregunta completa (1.8–3.9 s). SFX: sub hit, tecla, aire. Handoff: la línea sale del logo hacia el borde del chat.
2. `00:04–00:10` — Conversación: pestañas abstractas colapsan en un input; el panel de cristal abre con spring; se escribe “Quiero conocer el Huila en 3 días.”; respuesta en streaming; caen tres tarjetas de día y se dibuja el mini-mapa. Lee: mensaje del usuario (4.8–6.6 s), respuesta + plan (7.0–9.8 s). SFX: pops de UI, tecleo, chime. Handoff: el mini-mapa se expande.
3. `00:10–00:17` — Descubrimiento: mapa oscuro a pantalla completa; pins con spring; tarjetas con parallax; el hilo une pins y se vuelve ruta; hover/click en “Ver Modelo 3D” y “Explorar Tour Virtual”. Lee: titular (10.6–12.4 s), Hotel Plaza Neiva (12.4–14.2 s), Tatacoa 360° (14.2–16.8 s). SFX: pins, whoosh suave. Handoff: esquina de tarjeta → esquina de burbuja.
4. `00:17–00:22.5` — Reserva: close-up del chat al 118%; respuesta de disponibilidad para el viernes 30; tarjetas de solicitud; clic en “Confirmar y Enviar Reservas”; check dorado y estado enviado. Lee: disponibilidad (17.6–19.2 s), botón (19.2–20.6 s), confirmación (20.6–22.3 s). SFX: click, pop, chime. Handoff: el check se convierte en el micrófono.
5. `00:22.5–00:27` — Voz: overlay de 12 barras; “Escuchando…”; transcripción “Agrega una cena típica cerca del hotel.”; “ViaNova está hablando…”; la tarjeta de cena entra al itinerario. Lee: transcripción (24.3–26.8 s). SFX: aire, barras. Handoff: las barras colapsan en la ruta del taxi.
6. `00:27–00:33` — Movimiento y comunidad: mapa de Neiva; taxi avanza; “Viaje solicitado” → “Conductor en camino”; wipe a ViaSocial; publicación “Atardecer en la Tatacoa” con foto real; like dorado; contador sube. Lee: titular (27.4–29.2 s), estado del taxi (29.2–31.2 s), publicación (31.2–32.8 s). SFX: motor suave, pop de like, notificación. Handoff: el anillo del like → punto del gráfico.
7. `00:33–00:39` — Negocio: cambio de rol Viajero → Hotel; dashboard claro; chips de categorías; KPIs, gráfico que sube, toast “Nuevo pedido”; rótulo “Vista de demostración”. Lee: titular (33.6–35.4 s), KPIs/gráfico (35.4–37.2 s), toast (37.2–38.8 s). SFX: switch, ticks, chime. Handoff: la línea del gráfico → subrayado de la URL.
8. `00:39–00:46` — Cierre: pull-back a laptop + teléfono con UI real sobre negro; logo, “Planifica. Descubre. Vive.”, URL con trazo, QR real, “Web · PWA · Android”; hold 2.5 s; fade a negro con logo. Lee: logo + tagline (39.6–42.0 s), URL (42.0–44.0 s), QR + plataformas (44.0–45.8 s). SFX: whoosh final, sub hit, acorde cálido.

BANNED:
- El lago europeo del hero como Colombia; cualquier paisaje no colombiano presentado como destino.
- Nombres, correos o barras de QA: “QA Playwright”, “Visual Check”, “José David Correa Núñez”.
- Claims inventados: reserva instantánea, pago PSE real, pagos seguros, disponibilidad garantizada, cobertura nacional, “número 1”, miles de usuarios, reseñas verificadas, app en Play Store/App Store, proveedores verificados.
- Métricas, reseñas, testimonios, logos de prensa o funciones que no existan.
- Azul/morado tech, circuitos, cerebros de IA, robots, esferas 3D, emojis ajenos a la UI, badges de tiendas.
- Texto adicional al copy exacto del brief; más de una idea por plano.
- Crossfades genéricos, transiciones de PowerPoint, zooms repetidos, shake.

QA:
- `00:02` — logo legible + titular completo; negro/dorado; sin lago.
- `00:07` — panel de chat abierto, mensaje del usuario legible, respuesta/plan en curso.
- `00:14` — mapa oscuro, pins y tarjetas de Hotel Plaza Neiva / Asadero El Huilense / Tatacoa; titular correcto.
- `00:20` — close-up del chat, disponibilidad y botón de reserva legibles; sin “pago confirmado”.
- `00:25` — overlay de voz con 12 barras y transcripción; sin nombre real.
- `00:30` — taxi en ruta o tarjeta de estado; transición a social.
- `00:36` — dashboard claro, chips, KPIs, gráfico y toast; “Vista de demostración”.
- `00:43` — logo, tagline, URL, QR y “Web · PWA · Android”; QR escaneable.
