# Releases de VIANova IA

Este documento describe cómo se versiona y publica la app Android. El código se sirve desde `main`; el APK no se versiona en Git: se adjunta como asset de GitHub Releases.

## Versión vigente

| Campo | Valor |
| --- | --- |
| Versión | `1.0.0` (tag `v1.0.0`) |
| Fecha | 2026-11-07 |
| Asset | `ViaNovaIA.apk` |
| Tamaño | 25.707.514 bytes |
| MD5 | `e6d21c0f1d3b213f92de0dc5499a5cd2` |
| Firma | Debug SHA-1 `D1:73:52:F1:1F:52:86:7B:55:A1:1C:FA:39:F4:28:FC:B5:0F:49:EE` |

Notas de la versión: [`docs/releases/v1.0.0.md`](releases/v1.0.0.md).

> El APK está firmado con la clave debug del proyecto. Sirve para instalar y probar; **no** es una firma de producción ni un artefacto para Play Store.

## Versionado

- Se usa SemVer: `MAJOR.MINOR.PATCH`.
- `MAJOR`: cambios incompatibles de API, datos o flujo de instalación.
- `MINOR`: funcionalidad nueva compatible.
- `PATCH`: correcciones y mejoras de rendimiento compatibles.
- El tag debe crearse sobre el commit que se publica, con formato `v1.0.0`.
- Cada release debe incluir notas en `docs/releases/` y el APK adjunto.
- No se reescriben tags publicados; una corrección se publica como versión nueva.

## Build del APK

Requisitos: Node.js 22+, JDK 21 y Android SDK configurados.

```bash
# Desde la raíz del repositorio
export JAVA_HOME="C:/Users/juan8/Desktop/ViaNovaIA/.tools/jdk21/jdk-21.0.13+9"

npm run check
npm test
npm run build

npx cap sync android
cd android
./gradlew assembleDebug --console=plain
cd ..

cp android/app/build/outputs/apk/debug/app-debug.apk ViaNovaIA.apk
```

El APK de salida es `android/app/build/outputs/apk/debug/app-debug.apk`. El archivo local `ViaNovaIA.apk` está ignorado por Git (`*.apk`).

## Verificación antes de publicar

```bash
md5sum ViaNovaIA.apk
APKSIGNER=$(ls "$LOCALAPPDATA/Android/Sdk/build-tools/"*/apksigner.bat | tail -1)
"$APKSIGNER" verify --print-certs ViaNovaIA.apk

# Confirmar que el HTML empaquetado coincide con el build
unzip -p ViaNovaIA.apk assets/public/index.html | md5sum
md5sum dist/public/index.html
```

Comprobar también:

- `npm run check` → 0 errores.
- `npm test` → 54/54.
- `npm run build` → `BUILD_STATUS=0`.
- `ProductStore` y `ProductModal` aparecen como chunks separados dentro de `assets/public/assets/`.
- El APK conserva la firma debug esperada para poder instalar encima de la versión anterior.
- No se incluyen secretos, `.env`, `android/local.properties` ni keystores.

## Publicación en GitHub

```bash
git push origin main
gh release create v1.0.0 ViaNovaIA.apk \
  --title "VIANova IA 1.0.0 — Android" \
  --notes-file docs/releases/v1.0.0.md
```

El asset debe subirse desde el APK local, no desde el índice de Git. Si se corrige un APK ya publicado, se crea una versión nueva con su propio tag y notas; no se reemplaza el asset de una versión existente.

## Limitaciones conocidas

- No hay firma de producción ni publicación en Play Store.
- La validación visual del arranque en frío en hardware físico queda pendiente cuando no hay dispositivo o emulador conectado.
- El APK incluye la API de producción configurada en el build; no apunta a `localhost`.
- Los artefactos de video (`motion/`, `out/`) no forman parte del release de la app.
