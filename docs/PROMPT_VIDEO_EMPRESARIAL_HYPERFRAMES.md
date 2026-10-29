# Prompt maestro — Video Comercial B2B de ViaNovaIA (Enfoque Empresarial)

> **Destino:** HyperFrames de HeyGen (creación de video desde captura real del producto, HTML/CSS/JS y animaciones web).
> **Público:** Dueños, gerentes y administradores de negocios turísticos en Colombia (hoteles, hostales, restaurantes, operadores de recreación/tours, taxistas y guías).
> **Objetivo:** Comercial B2B — convencer al sector empresarial de digitalizar su operación, gestionar pedidos y centralizar sus finanzas en ViaNovaIA.

---

## Antes de generar

1. **Datos de demostración limpios:** Utiliza una cuenta de negocio demo verificada (ej. `Hotel Plaza Neiva`, `Asadero El Huilense` o `Aventura Huila`). Evita correos de prueba personales, nombres de desarrolladores o barras de depuración QA (`QA Playwright`, `Visual Check`).
2. **Assets visuales clave:**
   - Capturas del Dashboard en tema oscuro y claro (`client/src/pages/Dashboard.tsx`).
   - Modal de exportación a Excel con selección multihioja.
   - Gráfico de tendencia financiera (`ComposedChart` con curvas de ingresos, gastos y margen neto).
   - Ranking de productos más vendidos (`BarChart`) y tarjetas de alertas de inventario.
   - Logo corporativo en alta resolución (`assets/icon.png` / `client/public/logo.jpeg`).
3. **Audio y Locución:**
   - Locutor masculino ejecutivo (32–40 años) generado con ElevenLabs (`eleven_multilingual_v2`, voz **Eric** `cjVigY5qzO86Huf0OWal` o **Charlie** `IKne3meq5aSn9XLyUdCD`).
   - Tono consultivo, moderno, seguro y empático. No locutor agresivo de ventas; habla de negocios entre profesionales.
4. **Diseño de Sonido (SFX):**
   - El audio debe sentirse táctil y de alta fidelidad: clics mecánicos de interfaz, elevación sónica de gráficas (*data sweep*), *ping* de alerta de inventario y el *whoosh* característico de descarga de hoja de cálculo.

---

## Prompt maestro (copiar y pegar)

```text
Usando /hyperframes, crea un video publicitario comercial de ~48 segundos para ViaNovaIA (https://via-nova-ia.vercel.app), dirigido específicamente a empresarios y prestadores de servicios turísticos (hoteles, restaurantes, agencias de tours, transporte y guías). El video debe centrarse en la rentabilidad, el control financiero en tiempo real, las estadísticas interactivas y la exportación profesional de balances a Excel. Usa las pantallas reales del Dashboard del sistema, su paleta Navy & Gold y sus componentes Recharts; no inventes interfaces falsas.

CONCEPTO
"Del dato a la rentabilidad". El turismo no solo se vive: se gestiona. El video muestra cómo ViaNovaIA transforma la complejidad de operar un negocio turístico en claridad financiera absoluta: desde el registro de una reserva hasta la gráfica de margen neto y el reporte contable descargado en Excel.

HISTORIA
Un empresario turístico revisa su operación. En lugar de cuadernos dispersos o múltiples plataformas desconectadas, tiene en su pantalla un centro de mando unificado: ve entrar pedidos y reservas, monitorea sus ingresos frente a sus costos en una gráfica interactiva, previene quiebres de inventario con alertas automáticas y, con un solo clic, descarga un reporte contable consolidado en Excel listo para su equipo.

FORMATO
- 16:9, 1920×1080, 30 fps, ~48 s.
- H.264 MP4, sin watermark, audio estéreo, -14 LUFS integrados, -1 dBTP.
- Español neutro/latinoamericano con acento colombiano ejecutivo. VO masculina, 32–40 años, segura, pausada, profesional y cercana; estilo consultor de negocios y partner estratégico.
- Subtítulos SRT en español incluidos, 3 frames clave de aprobación (00:03, 00:22, 00:36) y portada 1280×720 con el Dashboard y el titular "Controla y haz crecer tu negocio turístico".

PÚBLICO OBJETIVO
Dueños de hoteles boutique y hostales, propietarios de restaurantes y experiencias gastronómicas, operadores de turismo de aventura, empresas de transporte turístico y guías independientes. Buscan aumentar su visibilidad comercial, profesionalizar su administración y tener control de sus números sin complicaciones técnicas.

TONO Y ESTILO
Corporativo moderno, dinámico, sólido y confiable. Estética "Fintech & Hospitality" de alto nivel (estilo Stripe, Shopify o Brex adaptado al turismo). Nada de folclorismo desmedido, nada de promesas infladas o irreales, nada de jerga técnica incomprensible.

IDENTIDAD VISUAL
- Azul Marino Ejecutivo #0B1220; Negro Suave #0B0B0C; Dorado Brillante #FACC15 / #FFBF00; Verde Rentabilidad #22C55E; Pizarra #64748B; Blanco #FFFFFF.
- Tipografía: Poppins ExtraBold para números y métricas de impacto; Inter para datos de tabla, leyendas de gráficas y subtítulos.
- Acabado Liquid Glass: tarjetas translúcidas con desenfoque de fondo (*backdrop-filter: blur(12px)*), bordes de 1 px con brillo dorado sutil y sombras suaves sin estridencias.
- Gráficas Recharts reales: área de ingresos en degradado dorado, línea verde de ganancia neta, barras amarillas de volumen de ventas.
- Sin artificios futuristas genéricos: no circuitos de IA, no esferas 3D flotantes sin sentido.

ASSETS Y PANTALLAS
- Fuente base: https://via-nova-ia.vercel.app/dashboard
- Componentes reales:
  * Navbar con selector de rol activo (Hotel, Restaurante, Recreación, Transporte, Administrador).
  * Panel de KPIs: Ingresos totales, Ganancia neta (Margen %), Costos operativos (COGS), Ticket promedio, Stock total y Alertas de inventario.
  * Gráfico de Movimiento Consolidado (`ComposedChart` de Recharts) con selector de rango (7, 30, 90 días).
  * Gráfico de Rendimiento por Producto (`BarChart`).
  * Modal interactivo de "Exportar reporte Excel" con casillas de verificación por hoja (Hoja General + Hoja Hotel + Hoja Restaurante).
  * Vista previa del archivo `.xlsx` generado (estilo corporativo con cabeceras azul marino, acentos dorados y formato contable `$#,##0`).

STORYBOARD DETALLADO (00:00 – 00:48)

00:00–00:06 | EL DESAFÍO DEL EMPRESARIO (HOOK)
Visual: Fondo oscuro azul marino (#0B1220) con una iluminación cálida superior. Un titular contundente emerge con suavidad mientras números contables y recibos abstractos se disuelven en una tarjeta limpia de cristal líquido.
On-screen: "¿Sabes exactamente cuánto le deja el turismo a tu negocio hoy?"
VO: "¿Sabes exactamente cuánto le está dejando el turismo a tu negocio hoy?"
SFX: Sub-hit de bajo envolvente al inicio, sutil tick de reloj digital, whoosh de transición hacia la interfaz.

00:06–00:15 | EL CENTRO DE MANDO EN TIEMPO REAL (DASHBOARD)
Visual: El Dashboard de ViaNovaIA se despliega con animación fluida. La cámara hace un push-in suave (1.05x). Los contadores de KPIs suben rápidamente: "Ingresos: $8,450,000", "Ganancia neta: $3,210,000", "Margen: 38.0%". El badge "Vista de Negocio" brilla con un sutil reflejo dorado.
On-screen: "Métricas claras. Decisiones en tiempo real."
VO: "Con ViaNovaIA, tienes el control financiero de tu operación en tiempo real. Ingresos brutos, gastos y ganancia neta en un solo lugar."
SFX: Ticks suaves ascendentes al subir las cifras numéricas, micro-pop táctil al iluminarse los KPIs, música de fondo corporativa elegante a 105 BPM (piano moderno, beats limpios).

00:15–00:23 | GRÁFICA DE TENDENCIA FINANCIERA (RENTABILIDAD)
Visual: Plano medio de la gráfica interactiva (`ComposedChart`). La curva dorada de ingresos se traza de izquierda a derecha con efecto *stroke-dashoffset*; por debajo se dibuja la curva de gastos y resalta la línea verde esmeralda de beneficio neto. Un cursor blanco se desliza sobre la gráfica activando un tooltip que detalla: "Fecha: 15 Oct | Ingresos: $420,000 | Margen: 41%".
On-screen: "Conoce tu margen real día a día."
VO: "Monitorea tus tendencias día a día y conoce el margen real de cada servicio que ofreces."
SFX: Sweep sónico armónico mientras se dibuja la curva dorada, sutil beep de hover al activarse el tooltip interactivo.

00:23–00:31 | PRODUCTOS ESTRELLA Y GESTIÓN DE STOCK
Visual: La vista se desplaza hacia el gráfico de barras (`BarChart`) mostrando los servicios y productos con mayores ventas ("Habitación Suite Vista", "Tour Tatacoa Noche", "Menú Típico Huilense"). Al lado, la tarjeta de "Alertas de Inventario" muestra un producto en advertencia amarilla ("5 unidades") y otro en verde ("Saludable").
On-screen: "Optimiza tu catálogo. Cero quiebres de inventario."
VO: "Identifica tus productos estrella y recibe alertas de stock antes de perder una sola venta."
SFX: Pop seco al renderizarse cada barra del gráfico, sutil timbre de alerta elegante (soft chime) en la tarjeta de stock.

00:31–00:41 | LA HERRAMIENTA CLAVE: EXPORTACIÓN PROFESIONAL A EXCEL
Visual: El cursor se desplaza al botón dorado "Exportar Excel" y hace clic. Se abre el modal interactivo con fondo desenfocado; se muestran seleccionadas las casillas "Hoja General", "Hotel" y "Restaurante". Clic en "Descargar Excel". Barra de progreso rápida (100 ms) y aparece la animación de descarga. Transición fluida a una vista previa en pantalla de un libro de Excel impecable: diseño corporativo, cabeceras azul marino, columnas de ingresos, COGS, comisiones y balances contables listos.
On-screen: "Reportes en Excel en un clic. Listos para tu balance."
VO: "Y con un solo clic, exporta reportes contables profesionales en Excel, listos para tu balance, tu equipo o tu contador."
SFX: Clic de UI firme, pop táctil de selección de checkboxes, swoosh rápido de descarga de archivo y sonido suave de página abriéndose (*sheet opening*).

00:41–00:48 | ECOSISTEMA MULTI-ROL Y CIERRE COMERCIAL (CTA)
Visual: Transición elegante al selector de rol: el menú cambia de "Hotel" a "Restaurante" y luego a "Transporte", demostrando versatilidad. Pull-back a una composición heroica con una laptop y un smartphone mostrando el panel. Aparece el logotipo de ViaNovaIA, el sello "Plataforma Oficial de Turismo y Comercio", la URL grande y un código QR nítido para registro de proveedores.
On-screen: "Haz crecer tu negocio turístico" / "via-nova-ia.vercel.app" / "Registra tu comercio hoy".
VO: "Hoteles, restaurantes, experiencias y transporte. Haz crecer tu negocio con ViaNovaIA. Empieza hoy en via-nova-ia.vercel.app."
SFX: Acorde final resolutivo y cálido, whoosh final de salida, sub-hit de cierre suave.

DISEÑO DE AUDIO Y MEZCLA
- Locutor: VO masculina, modelo ElevenLabs `eleven_multilingual_v2` (voz **Eric** `cjVigY5qzO86Huf0OWal` o **Charlie** `IKne3meq5aSn9XLyUdCD`), estabilidad 0.55, similitud 0.80.
- Ritmo de voz: 145–150 palabras por minuto, pausas de respiración de 0.4 s a 0.6 s entre frases para que el espectador absorba las métricas.
- Música: Pista corporativa moderna, estilo tech-minimalist / neo-lounge (piano acústico rítmico, pulsos analógicos sutiles, bajo redondo a ~105 BPM). La música baja automáticamente a -20 dB durante la locución y sube a -14 dB en los 2 segundos finales.
- SFX: Mezclados entre -24 dB y -18 dB para acompañar la acción visual sin competir con la voz.

COPY EXACTO EN PANTALLA
1. "¿Sabes cuánto le deja el turismo a tu negocio hoy?"
2. "Métricas claras. Decisiones en tiempo real."
3. "Conoce tu margen real día a día."
4. "Optimiza tu catálogo. Cero quiebres de inventario."
5. "Reportes en Excel en un clic. Listos para tu balance."
6. "Haz crecer tu negocio turístico · via-nova-ia.vercel.app"

LO QUE ESTÁ PERMITIDO MOSTRAR
- Panel de analíticas en tiempo real (ingresos, gastos, ganancias, margen de rentabilidad).
- Gráficas de Recharts reales (área de tendencia y barras de rendimiento).
- Alertas de inventario y semáforo de reposición de stock.
- Exportación multi-hoja a Excel (.xlsx) con hojas por unidad de negocio.
- Cambio de roles (Hotel, Restaurante, Recreación, Transporte, Guía).
- Datos demostrativos coherentes y plausibles de proveedores turísticos en Colombia.

LO QUE ESTÁ PROHIBIDO
- Afirmar que "ViaNova cobra por adelantado con PSE garantizado" o inventar pasarelas inexistentes.
- Usar datos personales reales, correos privados o nombres de desarrolladores.
- Prometer cifras millonarias o garantías de venta irreales a los empresarios.
- Mostrar la app con estilos o logotipos ajenos al diseño de ViaNovaIA.
- Usar música estridente o locuciones sobreactuadas que resten seriedad al producto.

CHECKLIST DE ACEPTACIÓN
- [ ] El logo y la URL se leen claramente en el cierre.
- [ ] La gráfica de tendencia y las métricas de margen se muestran al menos durante 6 segundos.
- [ ] La acción de exportación a Excel (.xlsx) es visible, fluida y comprensible.
- [ ] Se aprecian las alertas de stock y la versatilidad de roles.
- [ ] Los efectos de sonido refuerzan cada interacción sin tapar la narración.
- [ ] La voz suena humana, fluida, profesional y con dicción perfecta en español.
- [ ] El QR final es escaneable y conduce a la plataforma.
```

---

## Guion VO limpio para ElevenLabs (Texto a Voz)

```text
¿Sabes exactamente cuánto le está dejando el turismo a tu negocio hoy?

Con ViaNovaIA, tienes el control financiero de tu operación en tiempo real. Ingresos brutos, gastos y ganancia neta en un solo lugar.

Monitorea tus tendencias día a día y conoce el margen real de cada servicio que ofreces.

Identifica tus productos estrella y recibe alertas de stock antes de perder una sola venta.

Y con un solo clic, exporta reportes contables profesionales en Excel, listos para tu balance, tu equipo o tu contador.

Hoteles, restaurantes, experiencias y transporte. Haz crecer tu negocio con ViaNovaIA. Empieza hoy en via-nova-ia.vercel.app.
```

* **Conteo de palabras:** 102 palabras.
* **Duración estimada:** ~42–44 segundos hablados a ritmo ejecutivo + 4 segundos de respiración y música = **~48 segundos totales**.

---

## Corte Vertical 9:16 (20 s) — Para LinkedIn, Instagram Reels y TikTok B2B

```text
Usando /hyperframes, genera una versión vertical optimizada de 20 segundos (1080×1920, 30 fps) enfocada en el gancho de gestión financiera y exportación a Excel.

00:00–00:03 | Hook: Primer plano del Dashboard en modo oscuro. Texto grande: "¿Conoces el margen real de tu negocio turístico?" VO: "¿Conoces el margen real de tu negocio turístico?"
00:03–00:09 | Métricas: Crecimiento de la gráfica de ingresos y ganancia neta (+38% margen). VO: "ViaNovaIA centraliza tus ventas, gastos y alertas de inventario en tiempo real."
00:09–00:15 | Excel: Clic en "Exportar Excel" y revelación del balance multihioja en la hoja de cálculo. VO: "Y con un solo clic, descarga reportes profesionales en Excel para tu contabilidad."
00:15–00:20 | Cierre: Logo de ViaNovaIA, "Digitaliza tu negocio hoy", URL y botón de registro. VO: "Únete a la nueva era del turismo. Regístrate en via-nova-ia.vercel.app."

Subtítulos quemados en la parte inferior media con fondo oscuro translúcido. Misma voz ejecutiva y ritmo dinámico.
```

