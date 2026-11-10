# API en la web y en Android

La web usa peticiones del mismo origen, también cuando se abre dentro de una
aplicación de Android. Solo `Capacitor.isNativePlatform()` permite seleccionar
el backend absoluto configurado con `VITE_NATIVE_API_BASE` para el APK.

El marcador `wv` del user-agent no identifica un APK de ViaNova: también aparece
en navegadores integrados de otras aplicaciones. Usarlo desviaba peticiones de
sesión hacia otro dominio y perdía la cookie del sitio abierto.

Comprobación manual: abrir una URL de preview desde un navegador integrado de
Android y comprobar que `/api/auth/me` conserva el mismo origen. En el APK,
comprobar que las peticiones usan el backend de `VITE_NATIVE_API_BASE`.

Hallazgo identificado mediante revisión de OpenCode con DeepSeek V4.1 Flash.
No se verificó con un dispositivo Android físico durante esta corrección.
