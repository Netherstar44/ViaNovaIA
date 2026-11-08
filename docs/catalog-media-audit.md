# Catálogo y archivos guardados — auditoría del 8 de noviembre de 2026

## Qué se encontró

La portada añadía ocho sitios definidos en `client/src/data/mockData.ts` a los servicios de la API. Al mapear servicios imponía `hasVR: false` y descartaba los archivos. El visor 3D de portada dibujaba un cubo ilustrativo. El historial insertaba dos reservas ficticias y el panel de proveedor precargaba nombre, teléfono, coordenadas de Madrid, cinco estrellas y métricas inventadas.

Se retiraron esos registros y valores de la interfaz, sin borrar datos de la base. La portada presenta solo servicios recibidos por API. Cuando falta fotografía hay un estado explícito; una API vacía o caída no activa datos de ejemplo. Las fotografías y artículos editoriales de la portada siguen siendo contenido de presentación, separado del catálogo de proveedores.

## Comprobación de base y archivos

Todas las consultas de esta tarea usaron transacciones PostgreSQL `READ ONLY`; no se inició el servidor contra esa base ni se aplicaron migraciones automáticas.

| Dato | Resultado |
| --- | ---: |
| Servicios | 36 |
| Productos activos | 21 |
| Archivos asociados | 112 |
| Modelos 3D: servicios / productos | 34 / 21 |
| Panoramas: servicios / productos | 28 / 8 |
| Fotografías de productos | 21 |
| Archivos sin entidad o con propietario incoherente | 0 |
| URLs distintas de 3D/360 comprobadas | 76 |

Las 76 URLs respondieron HTTP 200 y permitieron CORS. Comprobando solo cabeceras/rangos de archivos: 50 GLB distintos tenían firma y versión glTF 2 válidas; 26 JPEG distintos medían 8192×4096 (2:1). Los 36 panoramas referencian esos 26 archivos; los 55 modelos referencian 50 GLB distintos.

Las referencias 3D/360 apuntan a `static.poly.pizza` y `dl.polyhaven.org`. Son archivos existentes en la base; cargar su URL no demuestra que reproduzcan el establecimiento anunciado. No se sustituyeron referencias ni se eliminaron posibles datos sembrados en la base. Hace falta revisión del propietario para comprobar la correspondencia con cada negocio.

## Correcciones

`attachCatalogMedia` consulta `media_assets` en lote por tipo e ID de entidad y comprueba el propietario. La API de servicios y el listado público de productos incluyen los archivos. El normalizador convierte `MODEL_3D`/`model_3d` a `3d_model` e `IMAGE_360`/`image_360` a `360_image`, y evita exponer campos privados.

La portada abre el GLB almacenado con `Viewer3D`; el 360 se abre independientemente de que exista modelo. El modal de producto usa los archivos incluidos en el listado y dispone del endpoint público de compatibilidad `/api/products/:id/media`, limitado a productos activos. Una portada que ya es panorama conserva su tipo. Los errores de carga son visibles y no se reemplazan por modelos inventados.

Los panoramas comprobados pesan entre 2,1 y 18,6 MB. El visor conserva el límite de 25 MB y la textura de hasta 4096 px, permite 120 s totales y corta a los 30 s **sin datos**, en lugar de cortar una descarga que avanza. Evita una copia completa adicional del JPEG en memoria. El encabezado del visor tiene su propio espacio para que sus controles no tapen «Cerrar visor».

## Reproducir

Con las variables habituales en un entorno autorizado:

```sh
npm exec -- tsx scripts/inspect-catalog.ts
npm exec -- tsx scripts/inspect-catalog.ts --ui-fixture
node scripts/verify-catalog-ui.mjs
npm run check
npm test
npm run build
```

El inspector no cambia datos ni imprime credenciales. Las respuestas públicas para pruebas se guardan únicamente al solicitar `--ui-fixture`, dentro de `_capture-catalog/`, ignorado por git. El script de Chrome usa un perfil temporal, intercepta las APIs locales y bloquea mutaciones; los archivos 3D/360 se descargan desde sus URLs originales. No llama a APIs de producción. Requiere Chrome instalado; cambiar la ruta del ejecutable si es distinta.

La prueba visual cubre portada y marketplace en cinco temas a 360, 768 y 1440 px: 30 combinaciones sin desbordamientos. Comprueba carga real de un GLB y un panorama, igualdad de su origen con la base, catálogo vacío, error de API y que el botón de cierre esté accesible. Los resultados y capturas quedan en `_capture-catalog/ui/`; no se publica el volcado del catálogo.

## Estado facial observado

Hay pantallas en `/settings`, `/admin` y `/taxi-dashboard`, pero esta base no tiene `identity_verifications` ni `identity_audit`; tampoco están configuradas la clave biométrica, el umbral o la referencia de calibración en el entorno consultado. **No está funcionando de extremo a extremo en producción.** No se habilitó por inferencia ni se creó una clave automáticamente.

La activación requiere un entorno compatible Node 22, autorización explícita para aplicar la migración correspondiente, configuración de claves y calibración con datos consentidos, además de revisar el borrador legal. Workers/Vercel no cargan actualmente el motor nativo. Véase [identity-verification.md](identity-verification.md).
