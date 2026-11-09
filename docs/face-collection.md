# Recolección local de muestras faciales

Herramienta para obtener un conjunto **propio y consentido** cuando no existe un
dataset autorizado. No sustituye la revisión legal ni demuestra por sí sola que
el reconocimiento facial esté listo para producción.

## Qué hace

- Interfaz local en `http://127.0.0.1` para que una persona voluntaria capture
  centro, izquierda y derecha en sesiones separadas.
- Guarda las fotos **fuera del repositorio**, con seudónimo en lugar de nombre.
- Exige el consentimiento específico de calibración antes de registrar al
  participante y antes de aceptar cualquier fotograma.
- Permite etiquetar condiciones: `normal`, `poca-luz`, `gafas`, `piel-clara`,
  `piel-media`, `piel-oscura`.
- Separa a los participantes entre `calibration` y `evaluation`; el manifest
  generado no reutiliza imágenes ni sesiones entre esos conjuntos.
- Genera un manifest compatible con `npm run face:calibrate`.
- Tiene un comando de borrado total con confirmación explícita.

No usa CDN, servicios externos, APIs de IA, base de datos ni reconocimiento
durante la captura. La cámara solo entrega JPEG al servidor local.

## Autorización antes de capturar

**No ejecutes la captura con personas reales hasta que el responsable del
proyecto autorice el estudio y el abogado revise el consentimiento.** La
herramienta no puede demostrar por sí sola que el consentimiento sea válido.

El consentimiento está en `server/identity/collection-policy.ts`, versión
`face-calibration-2026-11`. Es un borrador técnico: el operador debe leerlo,
explicarlo y adaptarlo a la revisión legal antes de usarlo. No se marca
`FACE_CONSENT_LEGAL_APPROVED`.

## Comandos

El directorio de datos debe estar **fuera del repositorio**. El valor por
defecto es `~/VIANova-face-collection`; el programa rechaza una ruta dentro del
proyecto.

```bash
# 1. Interfaz local; sin este flag no se guarda ninguna foto.
npm run face:collect -- serve --data-dir "C:/ruta/fuera-del-repo/face-collection"
# La terminal muestra un token de un solo proceso. La captura sigue bloqueada.

# 2. Solo después de explicar y obtener autorización:
npm run face:collect -- serve --data-dir "C:/ruta/fuera-del-repo/face-collection" --authorize-capture

# 3. Generar manifest local y revisar sus avisos.
npm run face:collect -- manifest --data-dir "C:/ruta/fuera-del-repo/face-collection"

# 4. Calibrar; el reporte también debe quedar fuera de git.
npm run face:calibrate -- "C:/ruta/fuera-del-repo/face-collection/manifest.json" "C:/ruta/fuera-del-repo/face-collection/report.json"

# 5. Borrar todo cuando termine el estudio o venza la retención.
npm run face:collect -- purge --data-dir "C:/ruta/fuera-del-repo/face-collection" --confirm
```

No ejecutes `purge` hasta haber exportado el reporte agregado que necesites y
hasta que el responsable autorice el borrado. El borrado del directorio elimina
fotos y metadatos locales; no puede garantizar el borrado de copias de
seguridad externas que alguien haya hecho fuera de la herramienta.

## Protocolo mínimo

1. Asignar un seudónimo y un conjunto (`calibration` o `evaluation`) que no
   cambiará después.
2. Leer el consentimiento y registrarlo.
3. Crear una sesión con la condición real; no reetiquetar una foto para que
   parezca de otro grupo.
4. Capturar centro, izquierda y derecha. Repetir en otra sesión, en otro
   momento y con otra condición cuando corresponda.
5. Para generar comparaciones válidas, cada persona necesita al menos **dos
   fotogramas en sesiones posteriores** a la de enrolamiento: uno se usa como
   genuino y otro como impostor en el manifest.
6. No usar la misma foto, sesión o persona en calibración y evaluación.
7. Generar el manifest y revisar los avisos. Un manifest pequeño sigue siendo
   insuficiente: no valida producción.

La herramienta genera como máximo un enrolamiento por persona y usa cada
fotograma una sola vez. Repetir muchas fotos de la misma persona no crea
evidencia independiente: el calibrador agrupa genuinas por sujeto e impostoras
por par de sujetos y aplica intervalos conservadores a esos grupos.

## Retención

El plazo se fija al crear la colección (`--retention-days`, 1–90; por defecto
30). Cada sesión y fotograma guarda `expiresAt`. El operador debe ejecutar
`purge --confirm` al terminar o al vencer el plazo; no se promete borrado
automático de copias de seguridad. El acceso está limitado a `127.0.0.1`, exige
un token aleatorio por proceso y no publica las imágenes.

## Qué no demuestra

- No es una evaluación de precisión: sin el calibrador y un holdout no hay
  FAR/FRR válidos.
- No es PAD: una foto, pantalla, video o cámara virtual puede engañar al reto.
- No mide Android físico ni latencia en Vercel.
- No sustituye la revisión legal ni la aprobación del responsable.
