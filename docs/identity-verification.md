# Identidad — frente A (desarrollo, no habilitado para producción)

React 19/Vite 7/Capacitor puede abrir cámara en HTTPS o localhost. El backend es Express 4/PostgreSQL Neon; existe Workers y Vercel. La máquina tenía Node 26.8.1: se instaló Node **22.23.4** solo como dependencia de desarrollo con autorización del usuario. `npm run` usa su ejecutable local. Workers no ejecuta el motor; falla cerrado. No se cambió hosting ni se llamó a producción.

La entrada persistente `server/index.ts` inyecta el motor Node; los adaptadores que usan solo `createExpressServer` (Workers/Vercel) conservan revisión manual y no importan el decodificador nativo. Se verificó la compilación de Workers con `wrangler deploy --dry-run`, sin desplegar. Su futura habilitación facial necesita una decisión explícita de arquitectura/hosting.

## Probar

1. `npm ci --include=dev` y `npm run face:assets`. El build prepara también los modelos públicos versionados y el bundle de cámara desde el paquete fijado, sin CDN.
2. Crear una **base PostgreSQL local vacía** y ejecutar primero las migraciones existentes para su esquema. Aplicar `migrations/identity-verification.sql` únicamente a esa base, con una herramienta PostgreSQL y una URL local comprobada. Esta tarea no ejecutó migraciones contra la base configurada: puede ser producción. La migración nueva es aditiva y no modifica registros existentes.
3. Configurar JWT/SESSION y la URL **local** habituales; una `BIOMETRIC_ENCRYPTION_KEY` independiente de 32 bytes en hex; `FACE_DISTANCE_THRESHOLD` y `FACE_CALIBRATION_ID` obtenidos de la calibración. No hay umbral predeterminado. `FACE_VALIDITY_MINUTES=30` limita vigencia; reverificación facial aleatoria entre el 50% y el 100% de esa vigencia. Sin esos valores, usar la alternativa manual.
4. `npm run dev`. En `/account-settings` o `/taxi-dashboard`: autorización separada → enrolar cinco posiciones → administrador coteja presencialmente documento y persona, y aprueba nombre/referencia en `/admin` → verificar con cámara → activar disponibilidad → pedir taxi con otra sesión en `/request-ride` o el panel del mapa. La insignia y hora proceden del servidor; foto/placa existente solo cuando corresponde al viaje asignado.
5. Alternativa: solicitar revisión manual; administrador coteja documento y aprueba vía manual. Permite el mismo trabajo sin biometría y vence con la misma vigencia máxima. Renovarla requiere otra revisión. La cuenta de turista se verifica igual; el conductor solo recibe el nombre de pila aprobado y el estado.
6. `npm run check`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`.

El repo representa negocios como servicios con `providerUsername`, sin flujo independiente de reclamación legal del negocio. La insignia dice **identidad del responsable**; no certifica titularidad, licencia ni calidad del establecimiento. No se inventó un proceso de reclamación. El registro no queda bloqueado por no consentir; solo la insignia necesita revisión.

## Exactitud y calibración

`docs/face-calibration-report.json` declara 0 comparaciones y FAR/FRR/umbral **no disponibles**. Las pruebas unitarias usan descriptores sintéticos y no acreditan exactitud. El smoke real solo demuestra carga del motor/decodificador/modelos y rechazo de un JPEG sin rostro.

Preparar fuera de git un `manifest.json` con `consentConfirmed: true`, `enrollments: {"sujeto-anonimo": "enrolamiento.jpg"}` y `probes: [{"claimedId":"sujeto-anonimo","image":"probe.jpg","genuine":true,"group":"poca-luz"}]`. Incluir comparaciones genuinas de sesiones diferentes e impostoras (`genuine:false`); grupos `normal`, `poca-luz`, `gafas`, `piel-clara`, `piel-media`, `piel-oscura`, etiquetados con autorización específica. JPEG de 160–960 px, hasta 240 KB. Separar calibración y evaluación independiente; no reutilizar fotos de enrolamiento como pruebas.

Ejecutar `npm run face:calibrate -- ruta/manifest.json ruta/reporte.json`. Exporta solo agregados por grupo y barrido 0.15–0.75, incluyendo rechazos por calidad. El candidato limita FAR observado a 0.1%; debe validarse con holdout e intervalos: con cero falsos positivos se necesitan aproximadamente **3000 comparaciones impostoras independientes** para un límite superior 95% cercano a 0.1%. No es garantía de seguridad ni recomendación universal. Aportar muestras diversas y consentidas, objetivo FAR/FRR y latencia/FPS de un Android real antes de habilitar.

## Privacidad, operación y límites

AES-256-GCM con AAD por usuario cifra estado, plantilla versionada, referencia documental y baseline transitorio; no guarda fotos. Nonces de un solo uso, 90 s, 5 intentos, bloqueo 15 min y límites por cuenta/IP; una inferencia simultánea por proceso. CAS impide que una inferencia concurrente restaure un consentimiento revocado. Las plantillas duran 30 días; revocación elimina plantilla y reto e invalida el turno en la misma escritura. Las respuestas autenticadas son `no-store`. Auditoría restringida: actor, sujeto, fecha, acción, resultado y distancia escalar; no vectores ni imágenes en logs.

Ejecutar `npm run identity:purge` cada cinco minutos sobre el servidor compatible para supresión física de plantillas caducadas; el acceso también las elimina y siempre rechaza su uso vencido. El servidor Node persistente inicia la purga cada cinco minutos cuando hay clave biométrica; en serverless hace falta programarla externamente. Supervisar si hay más de 500 vencidas por lote. Los baselines de retos abandonados también caducan a los 90 segundos y se eliminan en lectura o purga. Las copias de seguridad/WAL no pueden prometer borrado inmediato: definir caducidad limitada de backups, acceso restringido y reejecutar purga/revocaciones antes de cualquier restauración. Purgar auditoría según el plazo legal aprobado; no exponerla en UI pública. El rate limit HTTP es por proceso, con bloqueo de retos persistente por cuenta; para varias instancias se requiere el almacén distribuido existente antes de habilitar.

Los giros son un reto activo básico, con calidad de luz/nitidez/tamaño/pose. **No es PAD certificado**: fotos movidas/deformadas, pantallas, video repetido adaptado al reto, cámara virtual, máscaras y deepfakes pueden superarlo. No certifica identidad documental automáticamente. No hay prueba física en Android ni evaluación demográfica con personas reales.

El consentimiento es **BORRADOR — REVISAR CON ABOGADO**, separado de términos; producción bloquea la autorización hasta revisión expresa/configuración. Completar responsable, canales de consulta/corrección/supresión, política, encargados, menores y plazos; no afirmar cumplimiento legal solo por implementar software. Referencias oficiales: [Ley 1581, arts. 5–6, 8–9](https://www.cancilleria.gov.co/normograma/compilacion/docs/ley_1581_2012.htm), [Decreto 1074, protección de datos](https://cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1074_2015_pr025.htm), [SIC: datos sensibles y autorización](https://sedeelectronica.sic.gov.co/politica-de-tratamiento-de-datos-personales).

## Motor y migración (cinco líneas)

1. Se conserva `@vladmandic/face-api` **1.7.15** detrás de `FaceEngine`; TFJS/WASM **4.22.0**, canvas **1.1.0**, sin inferencia remota.
2. [Repositorio archivado el 5 de febrero de 2025](https://github.com/vladmandic/face-api): el mantenimiento y la compatibilidad futura son riesgos abiertos.
3. Evaluar Human en una rama aparte con la misma interfaz y datos consentidos; no se sustituyó por cuenta propia.
4. Comparar latencia, FAR/FRR por grupo y mecanismos anti-suplantación con un conjunto independiente.
5. Descriptores/modelos no se presumen compatibles: versionar y re-enrolar con autorización si cambia el motor; migrar solo con evidencia y aprobación.

## Hallazgo de seguridad corregido

En `server/routes/taxi.routes.ts`, `registerTaxiRoutes` ejecutaba `ensureTaxiSchemaMiddleware` antes de autenticar `/api/taxi` y `/api/rides`. Una petición anónima podía alcanzar DDL y la deduplicación de earnings existentes. No se probó contra datos reales. Se movió `requireAuth` delante y se añadió regresión en `tests/security.test.ts`: ambas rutas anónimas devuelven 401 antes de acceder a la base. La migración heredada sigue existiendo para usuarios autenticados; no se ejecutó en esta tarea.
