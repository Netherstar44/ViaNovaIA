# Prompt maestro — Video publicitario de ViaNovaIA con HyperFrames

> **Supuesto:** HyperFrames de HeyGen (genera el video desde el sitio real y HTML/CSS/JS).
> Si te refieres a **hyperframe.ai**, el mismo brief sirve, pero allí tendrás que subir capturas y narración: no captura el sitio automáticamente.

## Antes de generar

1. Crea una cuenta demo limpia (`Camila Viajera` / `@camila.viaja`) y captura homepage, explore, chat, taxi, social y dashboard. Así evitas nombres, correos y barras de QA.
2. Adjunta el logo real (`assets/icon.png`) y las capturas en la carpeta del proyecto o en la librería de assets de HyperFrames.
3. Si tienes footage local, añade 2–3 clips de Tatacoa, Cañón del Combeima o Neiva a golden hour. Si no, el video funciona solo con UI y gráficos de marca; **no** uses paisajes de otros países como si fueran Colombia.
4. Verifica que los nombres del catálogo (`Hotel Plaza Neiva`, `Asadero El Huilense`) sean datos demo o que tengas permiso para usarlos. Si no, cámbialos por nombres genéricos.
5. En Studio, activa **Start with a storyboard** para aprobar los stills antes de animar.
6. Pega el prompt completo. La duración es orientativa: deja que el TTS respire y ajusta ±2 s.

---

## Prompt maestro (copiar y pegar)

```text
Usando /hyperframes, crea un video publicitario de ~45 segundos para ViaNovaIA (https://via-nova-ia.vercel.app), la plataforma colombiana que conecta viajeros con hoteles, restaurantes, experiencias, taxis y traductores locales, con un asistente de IA, mapa, comunidad y paneles para negocios. Captura el sitio real y usa sus pantallas, paleta y tipografía; no inventes una interfaz paralela.

CONCEPTO
"El hilo dorado". Una sola línea dorada recorre el video: nace como la carretera del logo, se convierte en el caret del chat, en la ruta del mapa, en la línea del itinerario, en la ruta del taxi, en la línea del gráfico del negocio y termina subrayando la URL. Es el viaje, no un adorno. Úsala como match cut y como único motivo gráfico recurrente.

HISTORIA
Una conversación que se convierte en viaje. No es un tour de features: es la historia de alguien que dice lo que quiere y ve cómo ViaNovaIA lo convierte en un plan real, con lugares, mapa, reserva, taxi y comunidad. El chatbot es el protagonista; la plataforma es lo que ocurre detrás de sus respuestas.

FORMATO
- 16:9, 1920×1080, 30 fps, ~45 s.
- H.264 MP4, sin watermark, audio estéreo, -14 LUFS integrados, -1 dBTP.
- Español de Colombia. VO femenina, 30–35, cálida, segura, conversacional; no acento de España, no tono de locutor de radio.
- Entregar SRT en español, 3 frames de aprobación (00:02, 00:20, 00:43) y portada 1280×720.
- La duración es flexible ±2 s para que el TTS respire; no cortes palabras del guion.

PÚBLICO
Viajeros urbanos de 25–45 años en Colombia (parejas, familias jóvenes, viajeros independientes) que planean por Instagram/WhatsApp y desconfían de las OTAs genéricas. Secundario: proveedores locales (hoteles boutique, restaurantes, operadores, taxistas, traductores) que quieren digitalizar su oferta. El video habla primero al viajero y cierra con un guiño claro al negocio local.

TONO
Cálido, cinematográfico, íntimo y seguro. Tecnología que desaparece; aspira a "concierge humano", no a robot futurista. Optimista y local, sin folclorismo. Nada de corporate frío, nada de "wanderlust" genérico, nada de promesas exageradas.

IDENTIDAD VISUAL
- Amarillo oro #FFBF00; negro #0B0B0C; crema #F5F4F0; blanco #FFFFFF. El dorado es el único acento saturado.
- Poppins ExtraBold para titulares; Inter para UI y subtítulos.
- Logo real en assets/icon.png: triángulo/montaña dorado con carretera. No lo redibujes, deformes ni recolorees. El wordmark existente es "VIANova"; puedes acompañarlo con "IA" en dorado, pero no inventes un logotipo nuevo.
- Liquid glass: blur + saturación, borde translúcido de 1 px, brillo interior, ruido fino. Sombras suaves, nunca neón.
- Luz cálida desde arriba a la izquierda, borde dorado en los cristales, negros profundos con detalle.
- Grano fino de película, viñeta sutil, partículas doradas escasas. Nada de azul/morado tech, circuitos, cerebros de IA, robots ni esferas 3D genéricas.
- Ritmo de color: oscuro cálido (descubrimiento/chat) → claro (negocio) → negro/dorado (cierre). No mezcles temas dentro de una misma escena.

CAPTURA Y ASSETS
- Fuente: https://via-nova-ia.vercel.app. Usa capturas reales de home, explore, chat, taxi, social y dashboard.
- Assets locales: assets/icon.png, viz-home.png, qa-final-home-dark.png, viz-explore.png, qa-chat-dark.png, qa-taxi.png, qa-social.png, qa-dashboard.png.
- Reconstruye el panel de chat en HTML/CSS a partir de qa-chat-dark.png para que el texto sea nítido y animable. Hazlo pixel-fiel: mismos colores, radios, tipografía, iconos, burbujas y avatar dorado; no es una interfaz nueva, es la misma con capas animables. No uses qa-chat-light.png tal cual: contiene un correo. No uses docs/seed-neiva-chat.png: contiene datos personales y otro tema. No muestres nombres, correos, ubicaciones ni datos reales. Usa identidad demo: "Camila Viajera", "@camila.viaja", "camila@demo.co". Recorta o reemplaza la barra de usuario si dice "QA Playwright", "Visual Check", "José David Correa Núñez" o similares.
- Captura a 2× si es posible. No escales UI más de 125%; prefiere acercamientos por crop. Mantén el texto legible: cuerpo ≥ 24 px equivalentes en 1080p.
- Si no tienes footage colombiano, no uses paisajes de otros países como si fueran Colombia. El hero actual es un lago europeo: no lo presentes como destino colombiano ni lo uses como fondo del opening. Si usas la home, recorta el hero y quédate con la barra de búsqueda, las tarjetas y el mapa. Para el opening usa negro/dorado, UI y gráficos; si adjuntas clips, usa Tatacoa, Cañón del Combeima o Neiva a golden hour.
- No inventes pantallas, métricas, reseñas, testimonios, logos de prensa ni funciones. Si un elemento no existe, omítelo.

GUION / STORYBOARD
Ajusta los tiempos ±1 s para que el TTS encaje; mantén el orden y el hilo dorado.

00:00–00:04 | LA PREGUNTA
Visual: negro absoluto. Un caret dorado parpadea como un input de chat en la oscuridad. El caret se estira y se curva en la carretera del logo; un trazo dorado recorre la carretera y revela el PNG real del logo; aparece el wordmark "VIANova" y "IA" en dorado con máscara. Halo dorado muy sutil. Grano.
On-screen: "¿Y si tu próximo viaje" / "empezara con una conversación?" (dos líneas, Poppins ExtraBold, blanco; "conversación" en dorado).
VO: "¿Y si tu próximo viaje empezara con una conversación?"
SFX: sub hit suave, tecla, whoosh de aire.
Transición: la línea dorada sale del logo y se convierte en el borde del panel de chat.

00:04–00:10 | LA CONVERSACIÓN
Visual: durante 1 s, una ráfaga de pestañas/ventanas de navegador abstractas (sin logos) se acumula y colapsa en un solo input. El botón flotante dorado (orbe/planeta) late una vez y abre el panel de cristal líquido con spring. Push-in al 112%; fondo desenfocado. El panel ocupa ~60% del frame, no todo.
Interacción: el cursor entra, hace clic en el input y escribe "Quiero conocer el Huila en 3 días." a ~50 wpm; el caret dorado parpadea. Clic en enviar con ripple. Burbuja dorada del usuario. Tres puntos de escritura 1.2 s. Respuesta en streaming: "Perfecto. Te armo un plan de 3 días con hoteles, sabores y experiencias locales." La burbuja se expande; un mini-mapa del Huila se dibuja; tarjetas de días caen en cascada; la línea dorada se convierte en la ruta.
On-screen: "Solo tienes que decirlo."
VO: "Sin veinte pestañas. Sin adivinar. Con ViaNovaIA, solo tienes que decirlo."
Transición: el mini-mapa se expande a pantalla completa; el panel se desliza fuera.

00:10–00:17 | EL DESCUBRIMIENTO
Visual: mapa de Neiva/Huila en modo oscuro; pins dorados caen con spring; tarjetas entran con parallax: Hotel Plaza Neiva (alojamiento), Asadero El Huilense (gastronomía), experiencia 3D/360 de la Tatacoa, taxi. El hilo dorado une los pins y se convierte en ruta.
Interacción: clic en "Ver Modelo 3D" → el visor rota 15°; clic en "Explorar Tour Virtual" → badge 360° brilla; la tarjeta se expande. No navegues a otra página.
On-screen: "Lugares reales. En un solo mapa."
VO: "La IA te responde con lugares reales: hoteles, restaurantes, experiencias y transporte local."
Transición: la esquina de una tarjeta se convierte en la esquina de la burbuja del chat (match cut).

00:17–00:27 | EL CHAT: RESERVA Y VOZ (ESCENA CENTRAL)
Visual: close-up del chat a 115–125%, fondo desenfocado. El panel oscuro, burbujas doradas, avatar con halo.
Interacción 1: usuario: "¿Y el viernes hay habitación?" IA: "Sí. Te muestro opciones para el viernes 30." Tarjetas de "Solicitudes de Reserva" con fechas y botón "Confirmar y Enviar Reservas". Clic; estado "¡Solicitudes enviadas a todos los proveedores!" con check dorado. No muestres "pago confirmado" ni "reserva instantánea".
Interacción 2: clic en el micrófono; overlay de voz con 12 barras doradas; "Escuchando..."; transcripción: "Agrega una cena típica cerca del hotel."; "ViaNova está hablando..."; la respuesta agrega una tarjeta al itinerario. Vuelve al chat.
On-screen: "Una conversación. Todo tu viaje."
VO: "Ajusta fechas, pregunta por precios o dicta tu plan. El asistente arma tu itinerario y te deja a un paso de reservar."
Transición: las barras de voz colapsan en los guiones de la ruta del taxi.

00:27–00:33 | MOVIMIENTO Y COMUNIDAD
Visual: mapa de Neiva; ruta dorada; taxi se mueve; tarjeta "Viaje solicitado" → "Conductor en camino"; notificación push. Luego wipe a ViaSocial: publicación "Atardecer en la Tatacoa" con foto real; like explota en dorado; contador sube; comentario entra. Sin nombres reales; usa "Camila Viajera" o "ViaNova Travel".
On-screen: "Muévete. Comparte. Vive."
VO: "Muévete con taxis locales y comparte tu ruta con la comunidad."
Transición: el anillo dorado del like se convierte en el punto de datos del gráfico.

00:33–00:39 | EL NEGOCIO
Visual: menú de perfil; cambio de rol activo "Viajero" → "Hotel" (función real); el dashboard de proveedor en tema claro aparece. Chips Hotel / Restaurante / Recreación / Taxi / Traductor. Tarjetas de ingresos, pedidos, stock; gráfico sube; notificación "Nuevo pedido". Cámara lateral suave. Usa datos demo plausibles; rótulo discreto "Vista de demostración".
On-screen: "Tu negocio, en el mapa."
VO: "¿Tienes un negocio? Publica tus servicios, gestiona pedidos y entiende tus números."
Transición: la línea del gráfico se convierte en el subrayado del cierre.

00:39–00:46 | EL CIERRE
Visual: pull-back a una composición hero: laptop + teléfono con UI real, flotando sobre negro, halo dorado y curvas de mapa sutiles. El logo aparece de nuevo con una variación más simple que el opening; la URL aparece con trazo; QR real a https://via-nova-ia.vercel.app se dibuja en una esquina. Hold 2.5 s.
On-screen: "Planifica. Descubre. Vive." / "via-nova-ia.vercel.app" / "Web · PWA · Android".
VO: "ViaNovaIA. Planifica, descubre y vive Colombia con inteligencia artificial. Tu próximo viaje empieza en via-nova-ia.vercel.app."
SFX: whoosh final + sub hit; la música resuelve en un acorde cálido.
Transición: fade a negro con el logo.

INTERACCIÓN Y MOVIMIENTO
- Cada plano debe tener una acción interna: escribir, abrir, dibujar, revelar, avanzar. No es una presentación de capturas con zoom.
- Todo debe parecer tiempo real, no un mockup estático: el cursor llega, duda 200 ms, hace clic; la UI responde en 120–200 ms.
- Un solo cursor, estilo macOS, 20–24 px, blanco con sombra suave; ripple dorado de 180 ms.
- Tipografía: 45–55 wpm, pausas de 120 ms; caret dorado; no escribas toda la frase si el tiempo no alcanza: corta en "Huila" y haz match cut al mensaje enviado.
- Chat: mensajes en streaming de 20–30 ms por token; burbujas con spring 350/25; scroll suave; tarjetas con stagger 90 ms.
- Voz: 12 barras doradas con movimiento orgánico (senos desfasados), no aleatorio; "Escuchando..." → "ViaNova está hablando...".
- Mapa: ruta con stroke-dashoffset; pins con spring; un solo pulso por pin; taxi avanza a velocidad constante.
- Cámara: push-ins 1.0→1.06, máximo 1.12; parallax 8–12 px; sin shake; sin zooms repetidos. Alterna push-in, lateral, top-down y close-up.
- Transiciones: match cuts, barridos de luz, cristal, línea dorada. Nada de crossfades genéricos ni transiciones de PowerPoint. Si un morph no queda limpio, usa corte seco.
- Profundidad: 3 capas (fondo, UI, cursor/texto); blur de fondo 8–16 px en el close-up del chat.
- No animes layout; usa transform/opacity. 60 fps en composición, render 30 fps.
- No pongas texto sobre zonas con detalle; no cortes palabras; no deformes la UI.

AUDIO
- VO: femenina, 30–35, acento colombiano neutro, cálida y segura, sonriendo; ritmo 150–160 wpm; pausas de 0.3–0.5 s. Pronuncia "ViaNova IA" en tres golpes (Via-Nova-I-A), "Huila" [ˈwila], "Neiva" [ˈnejβa], "Tatacoa" [tataˈkoa]. No acento de España, no caricatura paisa/costeño, no voz de robot.
- Música: indie-electrónica cálida a ~100 BPM; arpegio de guitarra acústica colombiana (tiple/requinto) muy sutil, percusión suave, pads analógicos, bajo redondo. Sin voces. Construye en 00:10, sube en 00:17, pico en 00:27, resuelve en 00:39. Duck a -18 dB bajo la VO.
- SFX: ticks de UI, whooshes de aire, tecleo, pop de envío, chime de notificación, sub hit en 00:00 y 00:39. Sutiles; nunca por encima de la voz.
- Mezcla: voz al frente, música -18 dB, SFX -24 a -18 dB; -14 LUFS integrados, -1 dBTP.

COPY EN PANTALLA (exacto, no inventar más)
- "¿Y si tu próximo viaje empezara con una conversación?"
- "Solo tienes que decirlo."
- "Lugares reales. En un solo mapa."
- "Una conversación. Todo tu viaje."
- "Muévete. Comparte. Vive."
- "Tu negocio, en el mapa."
- "Planifica. Descubre. Vive."
- "via-nova-ia.vercel.app"
- "Web · PWA · Android"
Máximo una idea por plano. No satures.

PROHIBIDO
- Inventar funciones, métricas, reseñas, testimonios, premios, logos de prensa, "número 1", "miles de usuarios", "reserva instantánea", "pago seguro", "PSE", "disponible en Play Store/App Store", "cobertura nacional".
- Mostrar datos personales, correos, nombres reales, "QA Playwright" o "Visual Check".
- Usar paisajes de otros países como si fueran Colombia.
- Reemplazar el logo, cambiar la paleta o usar otra tipografía.
- Poner música con voces, saturar de texto, usar emojis ajenos a la UI, o hacer un video de features sin historia.
- Mostrar la app como si estuviera publicada en tiendas.
- Usar footage, música o imágenes de personas sin licencia o sin permiso; no clones la voz de una persona real.
- Prometer disponibilidad inmediata; usa "solicita", "coordina", "descubre", "a un paso de reservar".

CHECKLIST DE ACEPTACIÓN
- El logo se lee en el primer segundo y en el último.
- La IA aparece antes del segundo 10 y el chat tiene al menos 8 s en pantalla.
- Se entiende el flujo: pregunta → respuesta → itinerario → solicitud → voz.
- Cada plano tiene una acción interna; no se siente como una presentación de capturas.
- Se ven las 4 categorías, el mapa, el taxi, el social y el dashboard de negocio.
- El hilo dorado conecta al menos 5 escenas.
- El CTA se lee completo 2 s; el QR es escaneable.
- No hay texto cortado, borroso, deformado ni datos personales.
- El video se entiende sin sonido.
- No hay claims falsos.
- La VO suena humana y local; la música no tapa la voz.

ENTREGABLES
1. Máster 16:9 1920×1080, 30 fps, ~45 s, H.264 MP4.
2. SRT español.
3. Portada 1280×720 con close-up del chat y el titular "Tu próximo viaje empieza con una conversación."
4. Tres stills de aprobación.
5. (Opcional) Versión 9:16 de 20 s para Reels/TikTok/Shorts, con subtítulos quemados y hook en los primeros 2 s.
```

---

## Versión corta (para el campo inicial de Studio)

```text
Video publicitario de ~45 s para ViaNovaIA (https://via-nova-ia.vercel.app): una conversación con el chatbot de IA se convierte en un viaje real por Colombia. 16:9, español colombiano, cálido y cinematográfico. Muestra el chat en close-up, el mapa, el marketplace, el taxi, la comunidad y el panel de proveedor. CTA: via-nova-ia.vercel.app. Sin claims falsos.
```

## Guion VO limpio (para TTS)

```text
¿Y si tu próximo viaje empezara con una conversación?
Sin veinte pestañas. Sin adivinar.
Con ViaNovaIA, solo tienes que decirlo.
La IA te responde con lugares reales: hoteles, restaurantes, experiencias y transporte local.
Ajusta fechas, pregunta por precios o dicta tu plan. El asistente arma tu itinerario y te deja a un paso de reservar.
Muévete con taxis locales y comparte tu ruta con la comunidad.
¿Tienes un negocio? Publica tus servicios, gestiona pedidos y entiende tus números.
ViaNovaIA. Planifica, descubre y vive Colombia con inteligencia artificial.
Tu próximo viaje empieza en via-nova-ia.vercel.app.
```

> 93 palabras. A 150–160 wpm son ~35–37 s de voz; con pausas y música entra en ~45 s. Si el TTS se pasa, recorta pausas, no palabras.

---

## Variante 9:16 (20 s) — para Reels, TikTok y Shorts

```text
Usando /hyperframes, crea un corte vertical de 20 s (1080×1920, 30 fps) del video de ViaNovaIA, usando el mismo material y el mismo hilo dorado. No rehagas la historia: condénsala.

0–2 s: hook visual y textual "¿Y si tu próximo viaje empezara con una conversación?" sobre negro/dorado; el logo aparece en 0.5 s.
2–6 s: el chat abierto; se escribe "Quiero conocer el Huila en 3 días."; respuesta en streaming; el itinerario se dibuja. VO: "Sin veinte pestañas. Solo tienes que decirlo."
6–13 s: close-up del chat; tarjetas de hotel y restaurante; clic en "Confirmar y Enviar Reservas"; overlay de voz con barras doradas. VO: "La IA te responde con lugares reales y te deja a un paso de reservar."
13–17 s: mapa de Neiva + taxi + like en ViaSocial, en ráfaga. VO: "Muévete y comparte tu ruta."
17–20 s: logo, "Planifica. Descubre. Vive.", URL y QR. VO: "ViaNovaIA. Tu próximo viaje empieza en via-nova-ia.vercel.app."

Subtítulos quemados en español, tipografía Inter, fondo negro translúcido, una línea por vez, máximo 42 caracteres. Safe margins 8%. Música y VO iguales al máster. Sin datos personales. Sin claims nuevos.
```

---

## Notas de dirección

- **El chatbot es el héroe, no un feature más.** La historia empieza y termina en la conversación; el marketplace, el mapa, el taxi y el social son consecuencias visuales de lo que la IA responde.
- **El hilo dorado es el pegamento.** Si una transición no puede hacerse con la línea, usa un corte limpio; no añadas otro motivo gráfico.
- **La honestidad vende.** El producto es un MVP avanzado: solicita reservas, no cobra PSE real, no está en tiendas y no garantiza cobertura nacional. El video debe verse ambicioso sin afirmar lo que aún no existe.
- **La UI debe leerse.** Un plano bonito con texto borroso arruina la credibilidad. Mejor un crop limpio que un zoom agresivo.
- **El cierre debe ser uno solo.** Logo, tagline, URL y QR. Sin “síguenos”, sin sellos, sin badges de tiendas.

## Assets recomendados

| Uso | Archivo | Nota |
|---|---|---|
| Logo | `assets/icon.png` | No redibujar. |
| Home oscura | `qa-final-home-dark.png` | Recortar barra QA. |
| Home clara | `viz-home.png` | Solo si se necesita contraste; recortar barra QA. |
| Explore | `viz-explore.png` | Marketplace y categorías. |
| Chat | `qa-chat-dark.png` | Referencia visual; reconstruir en HTML. |
| Taxi | `qa-taxi.png` | Recortar barra QA. |
| Social | `qa-social.png` | Reemplazar “Visual Check” por identidad demo. |
| Dashboard | `qa-dashboard.png` | Reemplazar “QA Playwright”; datos demo. |
| 3D | `docs/seed-neiva-3d.png` | Solo referencia; contiene nombre real, no usar tal cual. |

## Claims permitidos / prohibidos

**Permitidos:** asistente de IA contextual, itinerarios, catálogo real, mapa, tours 360 y modelos 3D, solicitud de reserva, taxi local, comunidad, panel de proveedor, multi-rol, PWA/Android.

**Prohibidos:** reserva instantánea, pago PSE real, pagos seguros, disponibilidad garantizada, cobertura nacional, número 1, miles de usuarios, reseñas verificadas, app en Play Store/App Store, proveedores verificados.
