# Prompt maestro — Video Comercial Gremio de Movilidad de ViaNovaIA (Taxistas y Conductores Locales)

> **Destino:** HyperFrames de HeyGen (creación de video desde captura real del producto, HTML/CSS/JS y animaciones web).
> **Público:** Taxistas, transportadores, conductores independientes y emprendedores del sector de movilidad en ciudades turísticas de Colombia (Neiva, San Agustín, Leticia, Santa Marta, Cartagena, Salento).
> **Objetivo:** Captación y activación de oferta (Supply-side Growth) — posicionar el Módulo de Taxi de ViaNovaIA como la plataforma de trabajo digital que conecta a los conductores directamente con turistas verificados, elimina los intermediarios abusivos y les devuelve el control de sus ingresos.

---

## Antes de generar

1. **Datos de demostración y localización:**
   - Perfil demo de conductor: `Carlos Andrade` (`@carlos.taxi.neiva`), calificación ⭐ 4.9, Vehículo: Toyota Corolla Blanco, Placa: NEI-247.
   - Ciudad demo: **Neiva, Huila** — Ruta demo: `Aeropuerto Benito Salas → Hotel Plaza Neiva`.
   - Pasajero demo (turista): `Alex Explorer` — solicitud en tiempo real con destino y tarifa visible.
   - Evitar correos privados, nombres de desarrolladores o etiquetas QA de pruebas automatizadas.
2. **Assets visuales clave:**
   - Panel de conductor con toggle `🟢 Activo / 🔴 Inactivo` de disponibilidad.
   - Notificación de nueva carrera entrante con foto del pasajero, origen, destino y tarifa fija.
   - Mapa oscuro de Neiva con ruta trazada, pin de recogida y destino dorados.
   - Panel de ganancias acumuladas del día (COP, con desglose de viajes completados).
   - Módulo de retiro/pago: botón "Solicitar Retiro" activo con historial.
   - Logotipo oficial en alta resolución (`assets/icon.png` / `client/public/logo.jpeg`).
3. **Locución y Audio en ElevenLabs:**
   - Voz masculina en **Español colombiano** (30–40 años): confiada, cálida, directa y cercana. Tono de alguien que habla de igual a igual, no de una multinacional que habla hacia abajo. Sin acento genérico neutro — calidez regional y autenticidad.
   - Opciones recomendadas en ElevenLabs: **Eric** (`cjVigY5qzO86Huf0OWal` — Smooth, Reliable, Trustworthy) o **Brian** (`nPczCjzI2devNBz1zQrb` — Confident, Conversational, Warm).
   - Parámetros recomendados: `stability: 0.60, similarity_boost: 0.82, style: 0.08, use_speaker_boost: true`.
4. **Diseño de Sonido (SFX):**
   - Sonidos auténticos de movilidad urbana: notificación de solicitud de carrera (ping digital satisfactorio), mapa cargando con ruta (whoosh suave), confirmación de pago recibido (pop metálico alegre).
   - Efectos ambientales: motor de auto encendiendo, puerta cerrándose con suavidad, tráfico urbano de fondo muy sutil.
   - Música de fondo: **Latin Urban Beat instrumental** — ritmo constante ~95–100 BPM, base de percusión orgánica, bajo cálido y notas de guitarra o piano eléctrico. Motivador, auténtico, no reggaeton — estilo Lofi latinoamericano con energía. Sube en el gancho, baja suave durante la locución y vuelve para el cierre.

---

## Prompt maestro (copiar y pegar)

```text
Usando /hyperframes, crea un video publicitario de ~46 segundos para ViaNovaIA (https://via-nova-ia.vercel.app), dirigido a taxistas y conductores locales en ciudades turísticas de Colombia. El video debe mostrar el módulo de conductor: toggle de disponibilidad, solicitudes de carrera en tiempo real desde turistas verificados, tarifa fija transparente, mapa de ruta y panel de ganancias con retiro. Usa capturas reales del sitio, su paleta Navy & Gold (#0B1220 / #FACC15) y sus componentes interactivos; no inventes interfaces falsas.

CONCEPTO
"Tu próxima carrera ya está esperándote." Deja de rodar vacío buscando carreras. ViaNovaIA conecta a los conductores directamente con turistas que aterrizan en su ciudad: tarifa justa pactada de antemano, sin intermediarios abusivos y con el dinero llegando directo a su bolsillo.

HISTORIA
Carlos es taxista en Neiva. Antes perdía horas circulando sin carrera, pagando comisiones desproporcionadas a plataformas externas. Hoy abre ViaNovaIA, activa su disponibilidad con un toque y en segundos recibe una solicitud de Alex, un turista recién llegado al aeropuerto. La tarifa está fijada, la ruta trazada, no hay regateo. Cuando termina el viaje, sus ganancias quedan registradas al instante y las puede retirar cuando quiera.

FORMATO
- 16:9, 1920×1080, 30 fps, ~46 s.
- H.264 MP4, sin watermark, audio estéreo, -14 LUFS integrados, -1 dBTP.
- Idioma de voz: Español colombiano con tono cercano, cálido y directo.
- 3 frames clave de aprobación (00:03, 00:18, 00:35) y portada 1280×720 con el mapa de ruta dorado y el titular "Tu próxima carrera ya está esperándote".

PÚBLICO OBJETIVO
Taxistas independientes y conductores locales de 25–55 años en ciudades turísticas colombianas (Neiva, Cartagena, Santa Marta, Salento, San Agustín, Leticia) que buscan ingresos estables y dignos, hartos de comisiones abusivas y de la incertidumbre de buscar pasajeros sin herramientas digitales.

TONO Y ESTILO
Directo, dignificante, auténtico y motivador. Como si un compañero de trabajo te contara sobre algo que realmente funciona. No corporativo ni sobreproducido — cercano, práctico y honesto. El conductor es el protagonista y el héroe de la historia, no un recurso de la plataforma.

IDENTIDAD VISUAL
- Azul Noche #070B14 / #0B1220; Dorado Acento #FACC15 / #FFBF00; Verde Éxito #22C55E; Blanco #FFFFFF; Pizarra #94A3B8.
- Tipografía: Poppins ExtraBold para titulares y ganchos de impacto; Inter para datos de carrera, mapa y ganancias.
- Tarjetas de cristal líquido (Liquid Glass) con desenfoque de fondo y bordes dorados translúcidos.
- Mapa oscuro estilo Mapbox Dark con ruta trazada en dorado y pins de recogida/destino.
- Paneles de ganancias con números grandes en verde (#22C55E) que suben con micro-animación de conteo.

PANTALLAS Y COMPONENTES A MOSTRAR
- Toggle de disponibilidad del conductor: estado "🟢 Activo" iluminado.
- Notificación de nueva carrera: tarjeta emergente con foto del turista, nombre, origen, destino y tarifa fija en COP.
- Mapa de ruta completa: Aeropuerto Benito Salas → Hotel Plaza Neiva, con conductor en movimiento.
- Panel de ganancias del día: total acumulado en COP con desglose de viajes.
- Módulo de retiro: botón "Solicitar Retiro" con confirmación visual.
- Cierre comercial con logo ViaNovaIA, URL y QR de registro de conductores.

STORYBOARD DETALLADO (00:00 – 00:46)

00:00–00:06 | EL GANCHO (DOLOR Y PROMESA)
Visual: Fondo negro noche (#070B14). Un teléfono en primer plano muestra una app vacía — sin carreras, sin ingresos. Encima, texto entra con corte brusco y energético: "¿Cuántas horas llevas rodando sin una sola carrera?" Un latido de bajo musical. Luego el título de ViaNovaIA aparece con brillo dorado y la frase de promesa: "Tu próxima carrera ya está esperándote."
On-screen: "¿Cuántas horas rodando sin una carrera?" → "Tu próxima carrera ya está esperándote."
VO: "¿Cuántas horas llevas rodando vacío, buscando carreras que nunca llegan? Con ViaNovaIA, eso se acabó."
SFX: Golpe musical de bajo seco al inicio, silencio breve, brillo dorado con acorde resolutivo al aparecer el logo.

00:06–00:15 | ACTÍVATE Y RECIBE CARRERAS (TOGGLE + SOLICITUD)
Visual: Push-in a la pantalla del conductor. El toggle pasa de "🔴 Inactivo" a "🟢 Activo" con un toque. En menos de 3 segundos, una tarjeta de notificación de carrera entra desde abajo con efecto de cristal: foto de Alex Explorer, "Turista verificado · Llegando del aeropuerto", origen: Aeropuerto Benito Salas, destino: Hotel Plaza Neiva, tarifa: $18.500 COP — fija. Botón "Aceptar carrera" dorado pulsando con micro-animación.
On-screen: "🟢 Activo · Conectado a turistas verificados" / "Tarifa fija · Sin regateo"
VO: "Activas tu disponibilidad y al instante recibes solicitudes reales de turistas que ya están en tu ciudad, con tarifa fija y sin intermediarios."
SFX: Click suave de toggle, ping de notificación satisfactorio, pop al expandirse la tarjeta de carrera.

00:15–00:24 | LA RUTA EN TU MANO (MAPA Y NAVEGACIÓN)
Visual: Transición al mapa oscuro de Neiva. La ruta dorada se traza en tiempo real: pin de recogida verde en el aeropuerto, pin de destino dorado en el hotel. El ícono del carro de Carlos se mueve suavemente por la ruta. Contador de distancia y tiempo estimado visible. Barra de estado: "En camino · 4 min de llegada". La pantalla transmite control, claridad y tranquilidad.
On-screen: "Ruta clara · Destino confirmado · Sin sorpresas"
VO: "La ruta está lista, el destino confirmado. Sin vueltas innecesarias, sin confusión — tú mandas."
SFX: Whoosh suave de carga del mapa, sonido de motor de auto suave de fondo, clic de waypoint al completar la ruta.

00:24–00:33 | TUS GANANCIAS, TU CONTROL (PANEL DE INGRESOS + RETIRO)
Visual: Al terminar la carrera, aparece el panel de ganancias. El número sube con micro-animación de conteo verde: $18.500 COP → se suma al total del día: $127.000 COP. Un badge dorado: "✓ 7 viajes completados hoy". Luego el usuario toca "Solicitar Retiro" — una pantalla de confirmación aparece con el monto disponible, el método de pago y el botón de confirmación. Mensaje de éxito: "✓ Retiro en proceso".
On-screen: "Ganancias en tiempo real · Retiro cuando quieras"
VO: "Cada carrera suma directo a tu bolsillo. Sin esperas de semanas ni descuentos arbitrarios. Tú decides cuándo retirar."
SFX: Pop metálico alegre al sumar ganancia, sonido de confirmación suave al solicitar retiro, acorde positivo breve.

00:33–00:40 | TU REPUTACIÓN TRABAJA POR TI (CALIFICACIÓN Y CONFIANZA)
Visual: Perfil de Carlos Andrade con su calificación ⭐ 4.9 destacada en dorado. Aparecen micro-reseñas de turistas: "Puntual, conoce la ciudad y amable" · "Mejor taxi del Huila". Una insignia: "Conductor Verificado ViaNovaIA". El mapa de fondo muestra múltiples pines activos — toda una red de conductores en la ciudad.
On-screen: "Conductor Verificado · Tu reputación vale · ⭐ 4.9"
VO: "Tu buena actitud construye tu reputación digital. Los turistas te buscan a ti — no a la plataforma."
SFX: Chime suave de estrella dorada al aparecer la calificación, pop de aparición de reseñas, sonido de comunidad conectada.

00:40–00:46 | CIERRE Y CALL TO ACTION
Visual: Plano heroico con fondo navy profundo. Logo dorado de ViaNovaIA con brillo suave. Tagline centrado: "Conduce con propósito. Gana con dignidad." URL grande y clara: `via-nova-ia.vercel.app`. QR prominente: "Regístrate como conductor — Gratis". Badge final: "Disponible en tu ciudad · Neiva · Cartagena · Santa Marta y más".
On-screen: "Conduce con propósito. Gana con dignidad." / "via-nova-ia.vercel.app" / "Regístrate — Es gratis"
VO: "Únete al gremio de conductores de ViaNovaIA. Regístrate gratis en via-nova-ia.vercel.app y empieza a ganar desde hoy."
SFX: Acorde resolutivo motivador de bajo y piano eléctrico, whoosh de salida dorado, reverberación limpia de cierre.

DISEÑO DE AUDIO Y MEZCLA
- Locutor: VO en español colombiano (modelo ElevenLabs `eleven_multilingual_v2`, voz Eric `cjVigY5qzO86Huf0OWal` o Brian `nPczCjzI2devNBz1zQrb`), estabilidad 0.60, similaridad 0.82, estilo 0.08, speaker_boost true.
- Ritmo de voz: 130–138 palabras por minuto. Pausas cortas y decisivas de 0.3–0.4 s entre frases — transmite acción, no contemplación.
- Música: Latin Urban Beat Instrumental (~97 BPM, percusión orgánica, bajo cálido, guitarra o piano eléctrico sutil). Volumen a -21 dB bajo la voz, subiendo a -14 dB en el cierre.
- SFX: Mezclados entre -22 dB y -18 dB, precisos y concretos — cada sonido tiene un motivo funcional en la narrativa.

COPY EXACTO EN PANTALLA
1. "¿Cuántas horas rodando sin una carrera?"
2. "Tu próxima carrera ya está esperándote."
3. "🟢 Activo · Conectado a turistas verificados"
4. "Tarifa fija · Sin regateo · Sin intermediarios"
5. "Ruta clara · Destino confirmado · Sin sorpresas"
6. "Ganancias en tiempo real · Retiro cuando quieras"
7. "Conductor Verificado · Tu reputación vale"
8. "Conduce con propósito. Gana con dignidad."
9. "via-nova-ia.vercel.app · Regístrate — Es gratis"

LO QUE ESTÁ PERMITIDO MOSTRAR
- Toggle de disponibilidad del conductor (Activo/Inactivo).
- Notificación de carrera con tarifa estimada fija en COP.
- Mapa de ruta trazada en Neiva (aeropuerto → hotel céntrico).
- Panel de ganancias acumuladas del día con conteo en tiempo real.
- Botón de solicitud de retiro con confirmación visual.
- Calificación del conductor y micro-reseñas de turistas satisfechos.
- Ciudades colombianas reales donde opera la plataforma.

LO QUE ESTÁ PROHIBIDO
- Garantizar ingresos mínimos específicos que la plataforma no asegura formalmente.
- Prometer integración bancaria PSE o Nequi instantánea si no está disponible en el MVP.
- Usar marcas o logos de competidores (Uber, Cabify, Bolt, InDriver).
- Comparaciones directas negativas contra otras plataformas de movilidad.
- Mostrar conducción peligrosa, exceso de velocidad o comportamientos ilegales en el mapa.
- Usar nombres o fotos de conductores reales sin autorización.

CHECKLIST DE ACEPTACIÓN
- [ ] El toggle de disponibilidad se aprecia con claridad y produce una respuesta visual inmediata.
- [ ] La notificación de carrera muestra tarifa fija en COP sin ambigüedad.
- [ ] El mapa de ruta es legible, oscuro y reconociblemente colombiano (Neiva).
- [ ] El panel de ganancias con conteo animado genera impacto emocional positivo.
- [ ] El módulo de retiro se muestra como una acción simple y accesible.
- [ ] La locución suena cercana, digna y motivadora — nunca corporativa ni genérica.
- [ ] El logotipo, la URL y el QR final permanecen legibles al menos 2.5 segundos.
```

---

## Guion VO limpio para ElevenLabs (Texto a Voz en Español)

```text
¿Cuántas horas llevas rodando vacío, buscando carreras que nunca llegan? Con ViaNovaIA, eso se acabó.

Activas tu disponibilidad y al instante recibes solicitudes reales de turistas que ya están en tu ciudad, con tarifa fija y sin intermediarios.

La ruta está lista, el destino confirmado. Sin vueltas innecesarias, sin confusión — tú mandas.

Cada carrera suma directo a tu bolsillo. Sin esperas de semanas ni descuentos arbitrarios. Tú decides cuándo retirar.

Tu buena actitud construye tu reputación digital. Los turistas te buscan a ti — no a la plataforma.

Únete al gremio de conductores de ViaNovaIA. Regístrate gratis en via-nova-ia.vercel.app y empieza a ganar desde hoy.
```

* **Conteo de palabras:** 103 palabras.
* **Duración estimada de voz:** ~40–42 segundos a ritmo cálido y directo + 4–6 segundos de pausas y SFX = **~45–46 segundos totales**.

---

## Variante 9:16 (20 s) — Para Instagram Reels, TikTok y YouTube Shorts

```text
Usando /hyperframes, genera una versión vertical rápida de 20 segundos (1080×1920, 30 fps) para captación en redes sociales dirigida a taxistas y conductores locales en Colombia.

00:00–00:04 | Hook: Fondo negro, texto impactante en amarillo dorado: "¿Rodando vacío otra vez?" VO: "¿Rodando vacío otra vez? Con ViaNovaIA, eso se acabó."
00:04–00:09 | Toggle + Carrera: Toggle pasa a Activo. Notificación de carrera entra desde abajo. VO: "Actívate y recibe carreras reales de turistas — tarifa fija, sin regateo."
00:09–00:15 | Mapa + Ganancias: Ruta dorada en mapa oscuro y panel con número en verde subiendo. VO: "Tu ruta lista, tus ganancias en tiempo real — retira cuando quieras."
00:15–00:20 | Cierre: Logo dorado, URL y QR. VO: "Regístrate gratis. via-nova-ia.vercel.app"

Subtítulos dinámicos en blanco con contorno negro en el tercio inferior. Voz masculina cálida en español colombiano. Ritmo urbano latino de fondo.
```

