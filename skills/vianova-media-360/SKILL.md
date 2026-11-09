---
name: ViaNova Media 360
description: Usar cuando se trabaje con panoramas 360°, visores inmersivos, Three.js, react-three-fiber, modelos 3D, captura de panoramas o stitch de imágenes en ViaNovaIA.
---

# ViaNova Media 360

## Componentes

| Pieza | Archivo |
| --- | --- |
| Visor 360 | `client/src/components/media/Viewer360.tsx` |
| Captura de panoramas | `client/src/components/media/PanoramaCamera.tsx` |
| Carga de textura esférica | `client/src/lib/useSphereTexture.ts` |
| Modelos 3D | `@google/model-viewer` + three.js / R3F |

## Regla de oro: panorama real o se dice

- Un panorama 360° real es **equirectangular 2:1** (ancho = 2 × alto).
- Si la imagen no es 2:1, `Viewer360` calcula el FOV vertical con `partialVerticalFov` y muestra la cobertura estimada. Las zonas sin captura se ven negras; es correcto.
- **Nunca** dibujes una esfera de relleno para simular un 360° que no existe. Si no hay panorama, la UI lo dice.
- La cobertura mostrada debe ser honesta: “360° × 180°” solo si la cobertura supera 99.5%; si no, “parcial”.

## Rendimiento de texturas

`Viewer360` ya aplica estas reglas; mantenlas si tocas el visor:

- `MAX_TEXTURE_WIDTH` limita el tamaño; además se recorta al `renderer.capabilities.maxTextureSize`.
- `generateMipmaps = false`, `minFilter = LinearFilter`, `colorSpace = SRGBColorSpace`.
- El canvas se dimensiona con `ResizeObserver`, no con el tamaño del contenedor R3F.
- Libera geometrías, materiales y texturas al desmontar (`dispose()`).
- No crees objetos nuevos dentro del loop de render.

## 3D y carga

- Usa imports dinámicos para three/model-viewer; son pesados y no deben precargarse en la portada.
- **No reintroduzcas `manualChunks`** para three/model-viewer/recharts: provocó un ciclo de inicialización (TDZ: “Cannot access 'Dt' before initialization”).
- Los modelos deben tener un fallback textual y un estado de carga/error.
- No uses `backdrop-filter` alrededor del visor; el coste de composición ya se eliminó del proyecto.

## Captura y stitch

- `PanoramaCamera.tsx` captura frames; el stitch se prueba en `tests/panorama-stitcher.test.ts`.
- La geometría y cobertura se prueban en `tests/sphere.test.ts`.
- Si cambias el algoritmo de stitch, actualiza ambas pruebas y verifica con un panorama real.
- Guarda los assets pesados fuera de git (`_capture*/`, `*.mp4`, `promo-video/`).

## Accesibilidad

- El visor debe tener instrucciones textuales y controles con `aria-label`.
- Respeta `prefers-reduced-motion`; desactiva auto-rotación si el usuario lo pide.
- Ofrece una imagen estática o descripción cuando WebGL no esté disponible.
- No dependas solo del arrastre: permite teclado y botones.

## Verificación

```bash
npm test                 # incluye sphere y panorama-stitcher
npm run check
npm run build
```

Además, revisa en el navegador:

- Consola sin errores de WebGL ni texturas 404.
- Un panorama 2:1 se ve completo; uno parcial muestra sus zonas negras y su cobertura.
- 360 px, 768 px y 1440 px sin recortes ni scroll horizontal.
- En móvil, el giro funciona y no hay stutter al mover la cámara.

## Errores frecuentes

| Síntoma | Causa |
| --- | --- |
| “Esfera negra” o panorama invertido | Textura no equirectangular o UV/geometría mal configuradas. |
| Textura borrosa | Se superó el límite de textura o se activaron mipmaps. |
| Crash al montar | Chunk manual de three/model-viewer o import no dinámico. |
| Cobertura falsa | Se asumió 360° sin comprobar el ratio 2:1. |
| GPU móvil lenta | Textura demasiado grande o falta de `dispose()`. |
