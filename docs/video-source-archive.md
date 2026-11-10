# Fuentes de los videos promocionales

Este repositorio conserva el código fuente local de dos proyectos:

- `motion/src`, `motion/scripts` y `motion/package.json`: composición Remotion del showreel.
- `promo-video/index.html`, `promo-video/compositions`, `promo-video/tools`, `promo-video/gen_vo.py` y `promo-video/package.json`: composición HyperFrames y herramientas auxiliares.
- `out/showreel-60/scripts`: scripts locales de generación de audio y comprobación de fotogramas.

Los recursos multimedia, renderizados, descargas de terceros, capturas de navegador,
dependencias, perfiles y datos temporales no forman parte de estas fuentes. Algunas
composiciones hacen referencia a esos recursos locales, por lo que un clon limpio
no puede necesariamente previsualizar o renderizar los videos sin recuperarlos y
revisar sus permisos de uso. No incluyas credenciales ni imágenes privadas al
compartir recursos. Las dependencias de cada proyecto están declaradas en su
propio `package.json`; su instalación y ejecución son independientes de la app.
