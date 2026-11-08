# Esfera completa — frente B

## Diagnóstico medido en el código original

| Etapa | Hallazgo |
| --- | --- |
| Captura | `PanoramaCamera` estimaba solo yaw con perfiles de columnas, pedía horizonte centrado y terminaba el barrido horizontal. No capturaba anillos ni polos. |
| Ensamblado | `drawPanoramaFrame` pegaba rectángulos en una banda; `fillPanoramaPoles` estiraba y difuminaba la primera/última fila hacia los polos. Con FOV horizontal 65° a 1920×1080, el vertical calculado es ~39,4°, solo ~33,7% del área esférica aun con giro horizontal completo. El archivo 4096×2048 no acreditaba cobertura. |
| Visor | Ya era `SphereGeometry`; ratón/teclado/inercia se limitaban a ±85° y sensores a ±80°. No era un cilindro. Había caché de texturas sin límite. |

Se conserva **Three.js**, ya instalado y usado por el visor: permite corregir polos, proyección y memoria con pocas piezas. Cambiar a otro visor no resolvería la información ausente de las capturas y añadiría otra dependencia.

## Comportamiento nuevo

- Anillos adaptados al FOV con solapamiento ~35%, más cenit y nadir. Orientación W3C con rotación de pantalla y roll; permiso iOS pedido desde el botón. Android ya declara CAMERA. Cámara solo en HTTPS/localhost, y alternativa manual/importación cuando faltan sensores o permisos. El modo manual declara que no comprueba orientación física.
- Proyección inversa rectilínea sobre esfera, incluyendo roll, en un Worker. Muestreo bilineal y mezcla de solapamientos. Exportación JPEG 4096×2048 por defecto, opción 2048×1024, XMP GPano y cobertura geométrica ponderada por ángulo sólido. Los huecos quedan negros, sin estirar ni inventar cielo/suelo.
- Pitch hasta ±90°, posición de cámara centrada y base estable en polos. Flechas arriba/abajo, Inicio/Fin para cenit/nadir, ratón, tacto, zoom limitado 32–100° y sensores. Límite de textura `min(4096, MAX_TEXTURE_SIZE)`, DPR máximo 1,5, sin mipmaps; se cancelan descargas y se liberan texturas, canvas, geometría, contexto WebGL y Worker.
- Carga progresiva cuando hay `previewUrl` o URL Cloudinary: vista ligera y luego detalle. Los demás servidores descargan una sola imagen con progreso si informan tamaño. Se limita a 25 MB, 30 s sin recibir datos y 120 s totales; sin caché GPU global sin límite. El límite de inactividad permite los panoramas grandes ya guardados sin abortar descargas que siguen avanzando.
- Imágenes antiguas 2:1 mantienen la textura original y declaran cobertura desconocida; el cielo que ya fue estirado no se puede recuperar. Recortes horizontales equirectangulares se asignan solo a su franja vertical según proporción (4096×512 → 45°), sin convertirlos en una esfera completa. Una panorámica cilíndrica sin metadatos necesita conversión externa: no se puede deducir su proyección con certeza.

## Ejecutar y evidencia

`npm run dev:client` y abrir `http://localhost:5000/sphere-lab.html` para el laboratorio con **texturas sintéticas**, sin datos de negocio ni API de producción. Se usa una entrada Vite de desarrollo, fuera de las rutas de la SPA de producción. La app real mantiene el modal de captura e importación existente.

`node scripts/verify-sphere-ui.mjs` inicia Vite :5055 y Chrome headless local (Chrome instalado, cámara simulada; `CHROME_PATH` permite otra ubicación). Escribe resultados en `_capture-verification/sphere/`. `npm run check`, `npm test` y `npm run build` cubren la aplicación.

Evidencia conservada en [sphere-qa/report.json](sphere-qa/report.json): 45 combinaciones (visor, captura e identidad × 5 temas × 360/768/1440), sin desbordamientos ni errores JavaScript. Prueba del Worker con 42 vistas sintéticas a 512×256: cobertura geométrica 100%, cenit rojo `[242,58,50]`, nadir azul `[36,72,238]`. Captura con cámara simulada: 2048×1024, 5,8% parcial declarado, cámara liberada. Los tiempos del informe son de Chrome de escritorio con SwiftShader, **no benchmarks de Android**.

Capturas del visor real: [−90°](sphere-qa/pitch--90.png), [0°](sphere-qa/pitch-0.png), [+90°](sphere-qa/pitch-90.png). [Captura parcial a 360 px](sphere-qa/capture-partial-360.png). Las pruebas unitarias verifican bases ortonormales, orientación, costura 0/360, proyección, cobertura por área, recortes y XMP; una banda ±30° mide exactamente 50% del área, no 33% de los píxeles.

## Límites exactos y comprobación física pendiente

La cobertura **geométrica** mide las direcciones proyectadas a partir de orientación/FOV estimados; no mide fidelidad fotográfica ni prueba que el usuario apuntó correctamente en modo manual. No hay calibración intrínseca de lente, registro por características, ajuste global, cierre de bucle, corrección de exposición ni eliminación de paralaje. No se garantizan costuras invisibles, especialmente con objetos próximos o movimiento. Importar una equirectangular completa de cámara 360 sigue siendo la vía de mayor calidad. Las metadatos GPano pueden perderse si un proveedor externo transforma el JPEG; entonces se declara cobertura desconocida.

Lista física pendiente:

- Android de gama media: permisos, 42–49 tomas según cámara/FOV, fluidez, memoria/temperatura, giro de pantalla y cámara trasera. Si hay presión de memoria, elegir 2048.
- Safari iOS: HTTPS, aceptar/denegar orientación y cámara; reabrir después de negar; bloquear pantalla y volver.
- Capturar cielo y piso reales, cerca de los polos, con poca luz y escenas próximas; confirmar que el teléfono gira alrededor de la lente.
- Importar archivo completo de una cámara 360 y un recorte horizontal conocido; comparar costuras, orientación y detalle con el original.
