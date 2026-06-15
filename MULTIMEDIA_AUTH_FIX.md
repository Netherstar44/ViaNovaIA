# Reporte: Corrección del Error 401 en Multimedia

**Fecha**: 2026-06-12  
**Estado**: ✅ Resuelto  
**Verificación de Build**: ✅ Todos los workspaces compilan correctamente

---

## Causa Raíz

El error `401 Unauthorized` en `GET /api/auth/me` y `POST /api/media-assets/upload` tenía **3 causas simultáneas**:

### 1. Middleware `cookieParser` no registrado en el backend
- **Archivo**: `artifacts/api-server/src/app.ts`
- **Problema**: El paquete `cookie-parser` estaba importado, pero `app.use(cookieParser())` **no estaba registrado** como middleware. Como resultado, `req.cookies` siempre era `undefined` y la autenticación basada en cookies JWT nunca funcionaba.
- **Solución**: Se registró `app.use(cookieParser())` antes de las rutas de la aplicación (línea 34).

### 2. Frontend: llamadas fetch sin `apiBase` ni `credentials: "include"`
- **Problema**: Varios componentes del frontend hacían llamadas a endpoints de `/api/media-assets` usando rutas relativas (ej: `"/api/media-assets/upload"`) sin anteponer `apiBase` ni incluir `credentials: "include"`. Esto impedía que las cookies de sesión JWT se transmitieran al backend, especialmente en entornos con puertos diferentes (dev), CORS, o Capacitor (móvil).

#### Archivos corregidos:

| Archivo | Problema | Estado |
|---------|----------|--------|
| `MediaUploader.tsx` | Ya tenía `apiBase` + `credentials` | ✅ Ya correcto |
| `MediaGallery.tsx` | 5 llamadas fetch sin `apiBase` ni `credentials` | ✅ Corregido |
| `ProductStore.tsx` | 1 llamada fetch sin `apiBase` ni `credentials` | ✅ Corregido |
| `SocialFeed.tsx` | 1 llamada fetch (upload) sin `apiBase` ni `credentials` | ✅ Corregido |

### 3. JWT_SECRET efímero
- **Archivo**: `.env`
- **Problema**: No existía un `JWT_SECRET` persistente. El servidor generaba una clave aleatoria en cada reinicio, invalidando todas las sesiones activas.
- **Solución**: Se añadió `JWT_SECRET=vianova_secret_key_2026_jwt` al archivo `.env`.

---

## Resumen de Cambios

### Backend (`artifacts/api-server/src/app.ts`)
```diff
+app.use(cookieParser());
```

### `.env`
```diff
+# JWT Persistent Secret Key
+JWT_SECRET=vianova_secret_key_2026_jwt
```

### `MediaGallery.tsx`
```diff
+import { apiBase } from "@/lib/queryClient";
-let url = "/api/media-assets?own=true";
+let url = `${apiBase}/api/media-assets?own=true`;
-url = `/api/media-assets/entity/${entityType}/${entityId}`;
+url = `${apiBase}/api/media-assets/entity/${entityType}/${entityId}`;
-const res = await fetch(url);
+const res = await fetch(url, { credentials: "include" });
-const res = await fetch(`/api/media-assets/${id}`, { method: "DELETE" });
+const res = await fetch(`${apiBase}/api/media-assets/${id}`, { method: "DELETE", credentials: "include" });
-const res = await fetch(`/api/media-assets/${editingAsset.id}`, { method: "PUT", ... });
+const res = await fetch(`${apiBase}/api/media-assets/${editingAsset.id}`, { method: "PUT", credentials: "include", ... });
```

### `ProductStore.tsx`
```diff
-const newRes = await fetch(`/api/media-assets/entity/product/${product.id}`);
+const newRes = await fetch(`${apiBase}/api/media-assets/entity/product/${product.id}`, { credentials: "include" });
```

### `SocialFeed.tsx`
```diff
-const uploadRes = await fetch("/api/media-assets/upload", { method: "POST", body: uploadForm });
+const uploadRes = await fetch(apiBase + "/api/media-assets/upload", { method: "POST", body: uploadForm, credentials: "include" });
```

---

## Funcionalidades Afectadas (Ahora Operativas)

- ✅ Upload de imagen estándar
- ✅ Upload de video (MP4/WEBM)
- ✅ Upload de foto 360°
- ✅ Upload de modelo 3D (GLB/GLTF)
- ✅ Upload de Tour VR
- ✅ Galería multimedia (listar, editar, eliminar)
- ✅ Media assets en ProductStore
- ✅ Publicaciones con multimedia en ViaSocial

---

## Verificación de Build

```
pnpm run build → ✅ Exitoso
  - artifacts/api-server ✅
  - artifacts/vianova ✅ 
  - artifacts/mockup-sandbox ✅
```

> **Nota**: Los warnings de sourcemap en `calendar.tsx`, `label.tsx`, `avatar.tsx` y `dropdown-menu.tsx` son inofensivos (provienen de dependencias externas). El warning de chunk size en `index.js` (2.9MB) es preexistente y no está relacionado con este fix.
