# Revisión de datasets faciales — 9 de noviembre de 2026

Objetivo: encontrar datos que permitan calibrar y evaluar el motor
`@vladmandic/face-api` 1.7.15 **sin** usar scraping, filtraciones ni datos sin
autorización. Este documento no es asesoría legal. No se descargó ningún
dataset y no se enviaron imágenes ni plantillas a APIs de IA.

## Decisión

**No hay un dataset autorizado para este uso.** La activación facial permanece
bloqueada (`FACE_CALIBRATION_APPROVED` sin definir) y el umbral sigue en `null`.
Los datasets revisados son útiles para investigación, pero sus licencias no
autorizan por sí solas el uso comercial de VIANova ni sustituyen una revisión
legal y un acuerdo de tratamiento de datos.

## Candidatos revisados

| Dataset | Fuente oficial | Licencia / acceso | Consentimiento y restricciones | Condiciones representadas | Veredicto |
| --- | --- | --- | --- | --- | --- |
| **MOBIO** | [Idiap](https://www.idiap.ch/en/dataset/mobio) · [Zenodo](https://zenodo.org/records/4269551) | End-User License Agreement; solicitud institucional; **solo investigación no comercial** | El consentimiento grabado indica que los datos biométricos podrían hacerse públicos **para investigación**. No autoriza por sí mismo un producto comercial. Archivos restringidos; no redistribuir. | 150 personas, 12 sesiones, teléfono móvil Nokia N93i y portátil, seis sitios/cinco países, hablantes nativos y no nativos. Útil para luz, pose y cámara móvil; desbalance de género (99 hombres/51 mujeres) y sin cobertura etiquetada de todos los grupos que usa el proyecto. | **No usar sin acuerdo y revisión legal.** Sería el candidato técnico más cercano a móvil, pero no está autorizado para producción. |
| **FRGC v2.0** | [NIST](https://www.nist.gov/programs-projects/face-recognition-grand-challenge-frgc) · [CVRL/UND](https://cvrl.nd.edu/projects/data/) | Licencia firmada por autoridad legal de la institución; acceso controlado | Uso interno de investigación; sin redistribución ni uso comercial sin permiso escrito de UND; publicaciones y citas obligatorias. | 50.000 registros, imágenes de alta resolución, 3D y multisesión; condiciones más controladas que una cámara móvil real. | **No usar.** Licencia y costo de acceso incompatibles con una activación comercial y con el conjunto que necesitamos. |
| **PaSC** | [NIST](https://www.nist.gov/programs-projects/point-and-shoot-face-recognition-challenge-pasc) · [CVRL/UND](https://cvrl.nd.edu/projects/data/) | Licencia UND firmada por la institución; acceso caso por caso; sin redistribución | Solo investigación interna; no modificar ni usar comercialmente sin permiso escrito; restricciones de publicación de imágenes. | 9.376 imágenes y 2.802 videos de 293 personas; distancia, sensores, frontal/no frontal y localizaciones. Buenas condiciones de cámara, pero no es un conjunto de consentimiento para un producto. | **No usar** sin licencia y aprobación; además el dominio no coincide con la cámara selfie del flujo. |
| **DigiFace-1M** | [Microsoft](https://github.com/microsoft/DigiFace1M) · [Licencia R-UDA](https://github.com/microsoft/DigiFace1M/blob/main/LICENSE) | Research Use of Data Agreement v1.0; **solo investigación no comercial** | Datos sintéticos, sin consentimiento de personas reales. No se pueden usar para mejorar un producto o servicio comercial. Puede redistribuirse solo con atribución y las mismas condiciones. | 1 millón de imágenes sintéticas con identidades y variaciones de pose, expresión, luz, accesorios y cámara; brecha sintético→real y texturas limitadas. | **Solo para pruebas de tubería**, nunca como evidencia de precisión real ni para habilitar producción. |
| **LFW** | [UMass](http://vis-www.cs.umass.edu/lfw/) | Sin licencia clara; imágenes de noticias; uso académico de facto | Imágenes recolectadas de la web sin consentimiento; no es una base apta para biometría de producción. | 13.233 imágenes, 1.680 personas con varias fotos; condiciones no controladas. | **Excluido.** Sin consentimiento ni licencia suficiente. |
| **VGGFace2 / VGGFace** | [Oxford VGG](https://www.robots.ox.ac.uk/~vgg/data/vgg_face2/) · [Licencia VGG Face](https://www.robots.ox.ac.uk/~vgg/data/vgg_face/licence.txt) | CC BY-NC 4.0 para VGG Face; VGGFace2 con condiciones de investigación; imágenes de terceros | Imágenes de celebridades recolectadas de la web; copyright de terceros y sin consentimiento de los sujetos. Restricción no comercial. | Millones de imágenes, pose y edad; sesgo de celebridades y condiciones de estudio. | **Excluido.** No cumple consentimiento ni licencia para este producto. |

## Consecuencia para la calibración

- No se copió ningún dataset al repositorio ni fuera de él.
- El calibrador exige que el operador aporte un manifest local con metadatos de
  licencia/consentimiento, dos conjuntos disjuntos y sesiones distintas.
- Aunque se obtuviera una licencia de investigación, haría falta un acuerdo
  específico para el uso comercial y una revisión legal antes de usar sus
  resultados para activar producción.
- Para una validación real se necesitan imágenes consentidas del contexto
  colombiano/móvil y, como mínimo, **3.000 pares impostores independientes**
  para sostener un límite superior del 0,1 % de FAR con cero falsos positivos.

## Objetivo de riesgo propuesto

Objetivo **exploratorio**, no aprobado:

- FAR objetivo: **0,1 %** (0,001), con límite superior unilateral del 95 %.
- FRR objetivo: **5 %**.
- Evaluación independiente mínima: **3.000 pares impostores** y **300 sujetos
  genuinos**; cada grupo declarado necesita al menos **100 pares impostores y
  30 sujetos genuinos** en evaluación. Varias fotos de una misma persona o par
  no cuentan como evidencia independiente.
- Cualquier resultado que no cumpla esos mínimos se marca como
  `insufficient-evidence` y no habilita la función.
- Este objetivo debe revisarse con el responsable del producto y el abogado;
  no es una garantía de seguridad ni una recomendación universal.

## Pendientes concretos

1. Obtener autorización escrita para un dataset (o recolectar imágenes propias
   con consentimiento) y revisar la licencia con el abogado.
2. Ejecutar el calibrador con conjuntos separados y revisar el informe agregado.
3. Validar el umbral en un holdout que no se haya usado para seleccionarlo.
4. Medir latencia/FPS y calidad en un Android físico, no solo en escritorio.
5. Evaluar PAD/deepfakes y videos; el reto de giro actual no es PAD certificado.
6. No definir `FACE_CALIBRATION_APPROVED=true` hasta completar 1–5.
