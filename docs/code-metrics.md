# Medición del código

Ejecutar `npm run metrics:code` desde la raíz. Para procesamiento automático:
`npm run metrics:code -- --json`.

La medición usa los archivos rastreados por git y su contenido actual en disco.
Incluye código de aplicación, migraciones, herramientas y pruebas, separado por
carpeta. Cuenta líneas físicas y no vacías; los comentarios están incluidos.
No equivale a líneas ejecutables ni mide el grado de terminación del producto.

También se cuenta el código nativo de Android escrito para la app: archivos
`.java` y `.kt` rastreados dentro de `android/app/src/main/java` y
`android/app/src/main/kotlin`. Se agrupan bajo el área `android`.

Se excluyen documentación, imágenes, videos, dependencias, archivos de bloqueo,
declaraciones `.d.ts` y directorios de salida conocidos. En Android quedan fuera
los assets, los directorios de build, el código generado (incluido el de las
plantillas de Capacitor bajo `com/getcapacitor/`), los archivos `Example*Test` y
cualquier XML, APK, bundle o script `.kts`. Un archivo nuevo debe estar agregado a
git para aparecer. Si falta algún archivo fuente rastreado, el comando informa que
el total es incompleto y termina con código de salida 1.

La meta de volumen debe acompañarse de funcionalidades verificables. No sumar
archivos generados, copias de bibliotecas ni duplicaciones para alcanzar una cifra.
