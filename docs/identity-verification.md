# Identidad — frente A

React 19/Vite 7/Capacitor puede abrir cámara en HTTPS o localhost. El backend es Express 4/PostgreSQL Neon; existe Workers y Vercel. La máquina tenía Node 26.8.1: se instaló Node **22.23.4** solo como dependencia de desarrollo con autorización del usuario. `npm run` usa su ejecutable local. Workers no ejecuta el motor; falla cerrado. No se cambió hosting. La migración aditiva en la base configurada se ejecutó con autorización escrita, como se detalla abajo.

La entrada persistente `server/index.ts` y la función `api/index.ts` de Vercel inyectan el motor con Node 22. Workers mantiene la alternativa manual y no importa el decodificador nativo. `package.json` fija `22.x` y `vercel.json` incluye expresamente el bundle y los pesos de face-api: faltaba esa inicialización en la entrega inicial, causando fallos al intentar verificar en Vercel. Estos cambios son de código/configuración del repositorio; no se modifica la cuenta ni el dominio.

## Probar

Acceso visible: menú de cuenta → **Verificación facial** → `/settings`. La sección aparece al principio de Configuración, con el botón **Añadir mi rostro**. El registro se habilita después de consultar el estado y guardar el consentimiento; si la API no está disponible se informa explícitamente, y la vista previa local sigue siendo independiente.

**Actualización autorizada del 8 de noviembre de 2026:** se crearon `identity_verifications`, `identity_audit` y `identity_audit_subject_time` en la base configurada, tras confirmación escrita del usuario. No se borraron ni modificaron registros existentes. También se generó, con autorización separada, una clave biométrica en `.env`, ignorado por git; su valor no aparece en informes ni en el chat.

La vista previa puede abrirse mediante **Abrir cámara de vista previa**, aunque el registro no esté habilitado. Solo muestra el video local: no extrae ni envía fotogramas, no ejecuta reconocimiento y no guarda plantilla. **Añadir mi rostro** requiere consentimiento guardado y `faceReady: true` del servidor. Un error de estado no deja continuar un reto activo; la vista previa independiente puede permanecer abierta y cerrarse explícitamente.

## Variables del despliegue

El administrador con acceso a las variables de **ese proyecto de Vercel** debe copiar `BIOMETRIC_ENCRYPTION_KEY` desde el archivo local autorizado al entorno desplegado; editar `.env` local no configura automáticamente el servidor remoto. No compartirla por chat ni añadirla al repo. No hace falta cambiar el dominio. Si hay plantillas existentes, no rotar la clave sin un procedimiento de migración: dejarían de poder descifrarse.

`FACE_DISTANCE_THRESHOLD` y `FACE_CALIBRATION_ID` deben proceder del informe de calibración, no de los valores sintéticos de tests. Además, `FACE_CALIBRATION_APPROVED=true` solo se configura después de revisar una evaluación independiente que cumpla el objetivo de riesgo; sin esa aprobación explícita, el servidor rechaza iniciar retos faciales aunque existan umbral e ID. `FACE_CONSENT_LEGAL_APPROVED=true` solo tras completar/revisar el consentimiento. No se habilitaron estos valores arbitrariamente. Reiniciar/publicar el entorno después de configurar variables. `/api/identity/me` comunica por separado `manualReady` y `faceReady` sin exponer secretos; una migración por sí sola no activa el reconocimiento.

Referencias de plataforma: [Node fijado mediante engines](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [incluir los pesos en una función](https://vercel.com/docs/project-configuration/vercel-json).

1. `npm ci --include=dev` y `npm run face:assets`. El build prepara también los modelos públicos versionados y el bundle de cámara desde el paquete fijado, sin CDN.
2. Para desarrollo aislado, crear una **base PostgreSQL local vacía**, ejecutar primero las migraciones existentes y aplicar `migrations/identity-verification.sql` con una URL local comprobada. En la base configurada ya se aplicó esta migración con autorización escrita del usuario; no repetir migraciones heredadas sobre producción. La migración nueva es aditiva y no modifica registros existentes.
3. Configurar JWT/SESSION y la URL **local** habituales; una `BIOMETRIC_ENCRYPTION_KEY` independiente de 32 bytes en hex; `FACE_DISTANCE_THRESHOLD` y `FACE_CALIBRATION_ID` obtenidos de la calibración; y `FACE_CALIBRATION_APPROVED=true` solo tras revisar el informe independiente. No hay umbral predeterminado ni aprobación de calibración por defecto. `FACE_VALIDITY_MINUTES=30` limita vigencia; reverificación facial aleatoria entre el 50% y el 100% de esa vigencia. Sin esos valores, usar la alternativa manual.
4. `npm run dev`. En `/settings` o `/taxi-dashboard`: autorización separada → enrolar cinco posiciones → administrador coteja presencialmente documento y persona, y aprueba nombre/referencia en `/admin` → verificar con cámara → activar disponibilidad → pedir taxi con otra sesión en `/request-ride` o el panel del mapa. La insignia y hora proceden del servidor; foto/placa existente solo cuando corresponde al viaje asignado.
5. Alternativa: solicitar revisión manual; administrador coteja documento y aprueba vía manual. Permite el mismo trabajo sin biometría y vence con la misma vigencia máxima. Renovarla requiere otra revisión. La cuenta de turista se verifica igual; el conductor solo recibe el nombre de pila aprobado y el estado.
6. `npm run check`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`.

El repo representa negocios como servicios con `providerUsername`, sin flujo independiente de reclamación legal del negocio. La insignia dice **identidad del responsable**; no certifica titularidad, licencia ni calidad del establecimiento. No se inventó un proceso de reclamación. El registro no queda bloqueado por no consentir; solo la insignia necesita revisión.

## Exactitud y calibración

`docs/face-calibration-report.json` declara 0 comparaciones y FAR/FRR/umbral **no disponibles**. El usuario confirmó que no dispone de un conjunto de prueba autorizado: la verificación automática permanece pendiente; la vista previa y la revisión manual no requieren inventar un umbral. Las pruebas unitarias usan descriptores sintéticos y no acreditan exactitud. El smoke real solo demuestra carga del motor/decodificador/modelos y rechazo de un JPEG sin rostro. La revisión de datasets y las licencias descartadas están en `docs/face-dataset-review.md`.

Preparar **fuera de git** un `manifest.json` con consentimiento, metadatos del dataset y **dos conjuntos separados** (calibración y evaluación). Cada enrolamiento y prueba requiere una `session`; las sesiones, las identidades y las imágenes no pueden reutilizarse entre conjuntos, y una comparación genuina debe usar una sesión distinta a la de su enrolamiento. Formato mínimo:

```json
{
  "consentConfirmed": true,
  "dataset": { "name": "...", "source": "https://...", "license": "...", "consent": true, "restrictions": "..." },
  "calibration": {
    "enrollments": { "sujeto-a": { "image": "cal/a-enroll.jpg", "session": "cal-a-1" } },
    "probes": [{ "claimedId": "sujeto-a", "image": "cal/a-probe.jpg", "session": "cal-a-2", "genuine": true, "group": "poca-luz" }]
  },
  "evaluation": {
    "enrollments": { "sujeto-b": { "image": "eval/b-enroll.jpg", "session": "eval-b-1" } },
    "probes": [{ "claimedId": "sujeto-b", "image": "eval/b-probe.jpg", "session": "eval-b-2", "genuine": false, "group": "normal" }]
  }
}
```

Grupos: `normal`, `poca-luz`, `gafas`, `piel-clara`, `piel-media`, `piel-oscura`, etiquetados con autorización específica. JPEG de 160–960 px, hasta 240 KB. El manifest es una declaración del operador: el script no puede verificar por sí solo la autenticidad del consentimiento ni de la licencia.

Ejecutar `npm run face:calibrate -- ruta/manifest.json ruta/reporte.json`. Selecciona el umbral solo con calibración, lo congela y evalúa en el conjunto independiente; no vuelve a elegir el umbral con evaluación. Exporta agregados por grupo, rechazos por calidad, barrido 0.15–0.75, FAR/FRR, límites superiores Wilson y un estado `validated`/`insufficient-evidence`. Objetivo propuesto: FAR 0,1% con límite superior unilateral 95%, FRR 5%, al menos **3.000 comparaciones impostoras** y **300 genuinas** independientes; con cero falsos positivos se necesitan aproximadamente **3.000 impostores** para un límite superior cercano a 0,1%. Cada grupo declarado también necesita al menos **100 impostores y 30 genuinos** en evaluación; un grupo con una o dos muestras no cuenta como evidencia. Si falta evidencia, el informe no habilita nada. Aportar muestras diversas y consentidas, objetivo FAR/FRR y latencia/FPS de un Android real antes de habilitar.

## Privacidad, operación y límites

AES-256-GCM con AAD por usuario cifra estado, plantilla versionada, referencia documental y baseline transitorio; no guarda fotos. Nonces de un solo uso, 90 s, 5 intentos, bloqueo 15 min y límites por cuenta/IP; una inferencia simultánea por proceso. CAS impide que una inferencia concurrente restaure un consentimiento revocado. Las plantillas duran 30 días; revocación elimina plantilla y reto e invalida el turno en la misma escritura. Las respuestas autenticadas son `no-store`. Auditoría restringida: actor, sujeto, fecha, acción, resultado y distancia escalar; no vectores ni imágenes en logs.

Ejecutar `npm run identity:purge` cada cinco minutos sobre el servidor compatible para supresión física de plantillas caducadas; el acceso también las elimina y siempre rechaza su uso vencido. El servidor Node persistente inicia la purga cada cinco minutos cuando hay clave biométrica; en serverless hace falta programarla externamente. Supervisar si hay más de 500 vencidas por lote. Los baselines de retos abandonados también caducan a los 90 segundos y se eliminan en lectura o purga. Las copias de seguridad/WAL no pueden prometer borrado inmediato: definir caducidad limitada de backups, acceso restringido y reejecutar purga/revocaciones antes de cualquier restauración. Purgar auditoría según el plazo legal aprobado; no exponerla en UI pública. El rate limit HTTP es por proceso, con bloqueo de retos persistente por cuenta; para varias instancias se requiere el almacén distribuido existente antes de habilitar.

Los giros son un reto activo básico, con calidad de luz/nitidez/tamaño/pose. **No es PAD certificado**: fotos movidas/deformadas, pantallas, video repetido adaptado al reto, cámara virtual, máscaras y deepfakes pueden superarlo. Un video pregrabado que reproduzca el giro solicitado, una pantalla o una cámara virtual no se distinguen de una persona real con este motor. No certifica identidad documental automáticamente. No hay prueba física en Android ni evaluación demográfica con personas reales.

## Compatibilidad de despliegue

- `npm run build` se ejecutó con Node 22 y generó `dist/index.cjs`, los modelos en `dist/public/face-models/` y `dist/public/llms-full.txt`. El bundle deja `@napi-rs/canvas` como dependencia externa; Vercel debe instalar el binario nativo de Linux y su traza debe incluirlo. No se desplegó ni se probó la función remota, así que **no se afirma compatibilidad verificada en Vercel**.
- `vercel.json` incluye el paquete y los pesos de face-api; la prueba de configuración confirma que Node está fijado en 22 y que esos archivos entran en la función. Esto valida la configuración del repositorio, no el runtime de la cuenta.
- La cámara de Android/Capacitor requiere HTTPS o localhost. No hay dispositivo físico conectado: faltan permisos reales, carga del modelo, memoria, temperatura, latencia/FPS y comportamiento de WebView. Esas pruebas siguen pendientes y no deben sustituirse por el smoke de escritorio.
- El reto no es una defensa PAD/deepfake. La evaluación de suplantación con video, pantalla, cámara virtual o máscara requiere un conjunto y un procedimiento aparte, con revisión de seguridad.

El consentimiento es **BORRADOR — REVISAR CON ABOGADO**, separado de términos; producción bloquea la autorización hasta revisión expresa/configuración. Completar responsable, canales de consulta/corrección/supresión, política, encargados, menores y plazos; no afirmar cumplimiento legal solo por implementar software. Referencias oficiales: [Ley 1581, arts. 5–6, 8–9](https://www.cancilleria.gov.co/normograma/compilacion/docs/ley_1581_2012.htm), [Decreto 1074, protección de datos](https://cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1074_2015_pr025.htm), [SIC: datos sensibles y autorización](https://sedeelectronica.sic.gov.co/politica-de-tratamiento-de-datos-personales).

## Motor y migración (cinco líneas)

1. Se conserva `@vladmandic/face-api` **1.7.15** detrás de `FaceEngine`; TFJS/WASM **4.22.0**, canvas **1.1.0**, sin inferencia remota.
2. [Repositorio archivado el 5 de febrero de 2025](https://github.com/vladmandic/face-api): el mantenimiento y la compatibilidad futura son riesgos abiertos.
3. Evaluar Human en una rama aparte con la misma interfaz y datos consentidos; no se sustituyó por cuenta propia.
4. Comparar latencia, FAR/FRR por grupo y mecanismos anti-suplantación con un conjunto independiente.
5. Descriptores/modelos no se presumen compatibles: versionar y re-enrolar con autorización si cambia el motor; migrar solo con evidencia y aprobación.

## Hallazgo de seguridad corregido

En `server/routes/taxi.routes.ts`, `registerTaxiRoutes` ejecutaba `ensureTaxiSchemaMiddleware` antes de autenticar `/api/taxi` y `/api/rides`. Una petición anónima podía alcanzar DDL y la deduplicación de earnings existentes. No se probó contra datos reales. Se movió `requireAuth` delante y se añadió regresión en `tests/security.test.ts`: ambas rutas anónimas devuelven 401 antes de acceder a la base. La migración heredada sigue existiendo para usuarios autenticados; no se ejecutó en esta tarea.
