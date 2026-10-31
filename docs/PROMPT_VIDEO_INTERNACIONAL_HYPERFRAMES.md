# Prompt maestro — Video Comercial Internacional de ViaNovaIA (Turistas y Nómadas Digitales)

> **Destino:** HyperFrames de HeyGen (creación de video desde captura real del producto, HTML/CSS/JS y animaciones web).
> **Público:** Viajeros internacionales, nómadas digitales, parejas y turistas independientes de Norteamérica, Europa, Asia y Latinoamérica que visitan Colombia.
> **Objetivo:** Captación y conversión (Top of Funnel / Inbound Tourism) — posicionar a ViaNovaIA como el copiloto de viaje inteligente definitivo para explorar Colombia sin barreras idiomáticas, sin estafas y con experiencias 100% auténticas.

---

## Antes de generar

1. **Datos de demostración y localización:**
   - Utilizar perfil demo internacional verificado: `Alex Explorer` (`@alex.nomad`) o `Chloe Travels`.
   - Activar el selector de idioma en **Inglés (`EN`)** en el Navbar para mostrar las capacidades multilingües de la plataforma (`es`, `en`, `fr`, `pt`, `zh`).
   - Evitar correos privados, nombres de desarrolladores o etiquetas de depuración QA (`QA Playwright`, `Visual Check`).
2. **Assets visuales clave:**
   - Selector de idiomas interactivo en el Navbar.
   - Panel de chat con consulta en inglés y respuesta fluida de la IA con itinerario por el Huila y el Desierto de la Tatacoa.
   - Visor inmersivo 360° / 3D del Desierto de la Tatacoa (`client/src/components/media/Viewer360.tsx`).
   - Módulo de Taxi con tarifa fija estimada y trazado en mapa sin sobrecostos sorpresa.
   - Muro social comunitario **ViaSocial** con fotos reales de la Tatacoa y recomendaciones de locales.
   - Logotipo oficial en alta resolución (`assets/icon.png` / `client/public/logo.jpeg`).
3. **Locución y Audio en ElevenLabs:**
   - Locutor en **Inglés Internacional** (26–36 años): dinámico, amigable, cosmopolita y empático (estilo travel filmmaker o anfitrión de podcasts de viajes). Opciones recomendadas en ElevenLabs: **Charlie** (`IKne3meq5aSn9XLyUdCD` - Deep, Confident, Energetic) o **Sarah** (`EXAVITQu4vr4xnSDxMaL` - Mature, Reassuring, Confident).
   - Pronunciación fluida en inglés con dicción respetuosa y correcta de términos colombianos: *"Huila"* [ˈwila], *"Tatacoa"* [tataˈkoa], *"Neiva"* [ˈnejβa], *"ViaNova IA"* [Vee-ah-Nova I-A].
4. **Diseño de Sonido (SFX):**
   - Sonidos táctiles de interfaz digital (clics suaves, *whooshes* de apertura, teclado ágil).
   - Efectos inmersivos de atmósfera: brisa desértica suave al abrir el visor 360°, motor sutil al asignar el taxi y *pop* de interacciones sociales.
   - Música de fondo: *Latin Organic House / Indie Electronic* (~108–112 BPM, marimba o guitarra acústica sutil mezclada con ritmos electrónicos elegantes estilo Nicola Cruz o Tycho).

---

## Prompt maestro (copiar y pegar)

```text
Usando /hyperframes, crea un video publicitario de ~47 segundos para ViaNovaIA (https://via-nova-ia.vercel.app), dirigido a turistas internacionales y nómadas digitales que viajan a Colombia. El video debe destacar el asistente de IA multilingüe, los tours virtuales inmersivos en 360°, la movilidad transparente en taxi sin tarifas abusivas y la comunidad de exploradores locales. Usa capturas reales del sitio, su paleta Navy & Gold (#0B1220 / #FACC15) y sus componentes interactivos; no inventes interfaces falsas.

CONCEPTO
"Colombia, Decoded". Viajar por Colombia no tiene que implicar barreras de idioma, incertidumbre ni sobrecostos turísticos. ViaNovaIA es el compañero de viaje inteligente que traduce la cultura local, diseña itinerarios a medida en tu idioma y te conecta directamente con proveedores locales verificados.

HISTORIA
Un viajero internacional planea su llegada a Colombia. En lugar de lidiar con foros desactualizados o negociar tarifas a ciegas, abre ViaNovaIA en su idioma nativo: le pide a la IA su itinerario soñado, explora los paisajes del Desierto de la Tatacoa en 360° antes de llegar, pide un taxi local con precio transparente garantizado y se conecta con las rutas secretas de la comunidad.

FORMATO
- 16:9, 1920×1080, 30 fps, ~47 s.
- H.264 MP4, sin watermark, audio estéreo, -14 LUFS integrados, -1 dBTP.
- Idioma de voz: Inglés Internacional con tono cálido, cosmopolita y amigable.
- Subtítulos bilingües quemados o archivo SRT incluido: subtítulo principal en inglés con traducción al español en línea secundaria tenue.
- 3 frames clave de aprobación (00:03, 00:19, 00:36) y portada 1280×720 con el visor 360° y el titular "Explore Colombia Like a Local".

PÚBLICO OBJETIVO
Turistas internacionales de 24–45 años (Estados Unidos, Canadá, Europa, Asia y Latinoamérica), nómadas digitales y parejas aventureras que buscan experiencias culturales auténticas pero valoran la seguridad, la conveniencia digital y la transparencia en los precios.

TONO Y ESTILO
Inspirador, vibrante, contemporáneo y confiable. Una combinación de espíritu aventurero con sofisticación tecnológica. Lejos de clichés turísticos de agencia tradicional; se siente como un secreto compartido por un amigo local de confianza.

IDENTIDAD VISUAL
- Azul Noche #070B14 / #0B1220; Dorado Acento #FACC15 / #FFBF00; Verde Esmeralda #22C55E; Blanco #FFFFFF; Pizarra #94A3B8.
- Tipografía: Poppins ExtraBold para titulares y ganchos de impacto; Inter para textos de chat, mapas y datos de la app.
- Tarjetas de cristal líquido (*Liquid Glass*) con desenfoque de fondo y bordes dorados translúcidos.
- Visualización de mapa oscuro con pins y rutas doradas conectadas.
- Visor 360° real con giro panorámico fluido y badge interactivo de realidad virtual.

PANTALLAS Y COMPONENTES A MOSTRAR
- Barra de navegación con selector de idiomas activo (`EN` / `ES` / `FR` / `ZH`).
- Panel de chat de IA en modo oscuro con avatar dorado y mensajes en inglés en tiempo real.
- Tarjeta de destino con visor 360° interactivo (Desierto de la Tatacoa).
- Módulo de transporte en taxi con tarifa fija estimada (en COP y conversión referencial).
- Feed social **ViaSocial** con fotos colombianas reales, rutas y reseñas de la comunidad.
- Cierre comercial con composición laptop + móvil, logotipo, URL y código QR de descarga.

STORYBOARD DETALLADO (00:00 – 00:47)

00:00–00:06 | THE HOOK (EL GANCHO INTERNACIONAL)
Visual: Fondo oscuro azul noche (#070B14) con sutiles partículas doradas flotando. Coordenadas de Colombia parpadean. Un titular nítido entra con elegancia cinemática: "Want to explore Colombia beyond the tourist traps?"
On-screen: "Explore Colombia beyond the tourist traps."
VO: "Want to explore Colombia beyond the tourist traps... with zero language barriers?"
SFX: Sub-hit cinematográfico, quién de brisa cálida, entrada de percusión orgánica latina suave a 110 BPM.

00:06–00:15 | LA IA EN TU IDIOMA (MULTILINGUAL CONCIERGE)
Visual: Push-in al Navbar de ViaNovaIA: el cursor cambia el idioma de `ES` a `EN`. El panel de chat se abre con efecto de cristal líquido. El usuario escribe en inglés: "Plan 3 days in Huila: desert stars, boutique cabins and local coffee." La IA responde en streaming instantáneo: "Here is your 3-day authentic plan with local stays, stargazing guides and transport ready."
On-screen: "Your 24/7 AI concierge · Speaks your language"
VO: "Meet ViaNovaIA: your smart travel companion that speaks your language and crafts real local itineraries in seconds."
SFX: Clics rápidos de teclado, pop de envío de mensaje, suave acorde armónico al desplegarse el itinerario.

00:15–00:24 | EXPERIENCIA INMERSIVA 360° (VER ANTES DE RESERVAR)
Visual: Transición al mapa interactivo. Una tarjeta dorada de la Tatacoa se expande. El usuario pulsa "Explore 360° Virtual Tour". El visor panorámico cobra vida, rotando suavemente para mostrar el cielo estrellado y el cañón rojizo con iluminación nocturna.
On-screen: "360° Virtual Tours · Preview before you book"
VO: "Preview boutique stays, taste authentic gastronomy, and explore breathtaking landscapes in 360 before you even pack your bags."
SFX: Brisa suave de desierto, chime brillante de activación 360°, música que toma cuerpo con bajo y marimba.

00:24–00:33 | TRANSPORTE SIN SORPRESAS (FAIR LOCAL MOBILITY)
Visual: Transición a la pantalla de Taxi en Neiva. Origen: "Aeropuerto Benito Salas" → Destino: "Hotel Plaza Neiva". La pantalla muestra tarifa fija estimada clara en COP. Clic en "Solicitar Taxi". El taxi dorado se mueve por la ruta trazada en el mapa; aparece el estado: "Driver confirmed · Arriving in 4 mins".
On-screen: "Upfront pricing · No haggling, no surprises"
VO: "Book local taxis with transparent, upfront pricing. No haggling, no surprises, just safe local rides."
SFX: Clic táctil de solicitud, suave sonido de motor en marcha, ping de confirmación de conductor.

00:33–00:40 | COMUNIDAD Y RUTAS SECRETAS (VIASOCIAL)
Visual: Desplazamiento fluido al feed de ViaSocial. Se aprecian publicaciones con fotos reales de viajeros en el Huila, recomendaciones de platos típicos (Asado Huilense) y consejos de viaje. El contador de "Me gusta" dorado sube con una micro-animación.
On-screen: "Connect with locals & fellow travelers"
VO: "Join a vibrant community sharing secret spots and verified travel tips across Colombia."
SFX: Pops táctiles de interacción, sonido de notificación de like.

00:40–00:47 | CIERRE COMERCIAL & CALL TO ACTION (CTA)
Visual: Plano general heroico: laptop y smartphone flotando en ángulo estético mostrando la aplicación web y móvil. Logotipo dorado de ViaNovaIA con brillo sutil. Tagline en inglés, URL destacada y código QR nítido para acceso inmediato.
On-screen: "Travel smarter · Live Colombia" / "via-nova-ia.vercel.app" / "Free Web & Mobile App"
VO: "Travel smarter. Experience the real Colombia with ViaNovaIA. Start free today at via-nova-ia.vercel.app."
SFX: Acorde resolutivo cálido de guitarra y sintetizador, whoosh final y reverberación limpia.

DISEÑO DE AUDIO Y MEZCLA
- Locutor: VO en inglés internacional (modelo ElevenLabs `eleven_multilingual_v2`, voz Charlie `IKne3meq5aSn9XLyUdCD` o Sarah `EXAVITQu4vr4xnSDxMaL`), estabilidad 0.55, claridad 0.85.
- Ritmo de voz: 140–145 palabras por minuto, pausas de 0.4 s para permitir que las imágenes de los destinos respiren.
- Música: Pista Latin Organic House / Electronic Lounge (~110 BPM, percusiones cálidas, sintetizadores análogos, bajo melódico). Volumen a -20 dB bajo la voz, subiendo a -14 dB en el outro.
- SFX: Mezclados entre -22 dB y -18 dB, precisos y cinemáticos.

COPY EXACTO EN PANTALLA
1. "Explore Colombia beyond the tourist traps."
2. "Your 24/7 AI concierge · Speaks your language"
3. "360° Virtual Tours · Preview before you book"
4. "Upfront pricing · No haggling, no surprises"
5. "Connect with locals & fellow travelers"
6. "Travel smarter · via-nova-ia.vercel.app"

LO QUE ESTÁ PERMITIDO MOSTRAR
- Cambio de idiomas real en el Navbar (`EN`, `ES`, `FR`, `ZH`).
- Chatbot respondiendo con itinerarios reales en inglés.
- Visor 360° y modelos 3D de destinos del Huila (Tatacoa).
- Tarifa estimada y trazado de taxi en mapa.
- Feed de ViaSocial con contenido auténtico de Colombia.
- Acceso libre a la plataforma web (PWA y Android).

LO QUE ESTÁ PROHIBIDO
- Usar paisajes de otros continentes haciéndolos pasar por Colombia.
- Prometer pasarelas de pago instantáneas que no existen en el MVP.
- Usar claims falsos como "Official Government Partner" o "1 million tourists".
- Mostrar interfaces genéricas de mapas que no correspondan a la estética de ViaNovaIA.
- Usar música cliché de fiesta o locuciones hiperactivas de cortejo turístico barato.

CHECKLIST DE ACEPTACIÓN
- [ ] El cambio de idioma se aprecia con claridad en los primeros 10 segundos.
- [ ] El visor 360° se muestra de forma inmersiva y fluida.
- [ ] La transparencia en la tarifa del taxi resuelve la objeción del sobrecosto turístico.
- [ ] La locución en inglés suena natural, cálida y cosmopolita.
- [ ] Los subtítulos son legibles en pantallas móviles.
- [ ] El logotipo, la URL y el QR final permanecen legibles al menos 2.5 segundos.
```

---

## Guion VO limpio para ElevenLabs (Texto a Voz en Inglés)

```text
Want to explore Colombia beyond the tourist traps... with zero language barriers?

Meet ViaNovaIA: your smart travel companion that speaks your language and crafts real local itineraries in seconds.

Preview boutique stays, taste authentic gastronomy, and explore breathtaking landscapes in 360 before you even pack your bags.

Book local taxis with transparent, upfront pricing. No haggling, no surprises, just safe local rides.

Join a vibrant community sharing secret spots and verified travel tips across Colombia.

Travel smarter. Experience the real Colombia with ViaNovaIA. Start free today at via-nova-ia.vercel.app.
```

* **Conteo de palabras:** 96 palabras.
* **Duración estimada de voz:** ~38–40 segundos a ritmo fluido + 6–7 segundos de pausas y música = **~46–47 segundos totales**.

---

## Variante 9:16 (20 s) — Para Instagram Reels, TikTok y YouTube Shorts

```text
Usando /hyperframes, genera una versión vertical rápida de 20 segundos (1080×1920, 30 fps) para captación en redes sociales dirigida a turistas en Colombia.

00:00–00:03 | Hook: Primer plano del cielo estrellado de la Tatacoa. Texto en pantalla: "Planning a trip to Colombia?" VO: "Planning a trip to Colombia?"
00:03–00:09 | AI Chat: El usuario escribe en inglés y recibe el itinerario al instante. VO: "Skip the tourist traps. ViaNovaIA plans your entire journey in seconds."
00:09–00:15 | 360° + Taxi: Rápido giro 360° de la Tatacoa y confirmación de taxi con tarifa fija. VO: "Explore in 360 and book local rides with fair, transparent pricing."
00:15–00:20 | Cierre: Mockup del smartphone, logo dorado y botón "Plan Free Now". VO: "Travel like a local. Visit via-nova-ia.vercel.app."

Subtítulos dinámicos de alto contraste en el tercio inferior. Misma voz en inglés y música electrónica orgánica.
```

