# Copilot — ViaNovaIA

Lee **`AGENTS.md`** (reglas canónicas del repositorio) y **`skills/README.md`** (índice de skills).

Antes de cambiar un área, abre `skills/<id>/SKILL.md`:

- `vianova-codebase` — arquitectura, comandos, convenciones y trampas.
- `vianova-theming` — temas, tokens semánticos y contraste.
- `vianova-seo` — landings, JSON-LD, sitemap y `llms.txt`.
- `vianova-security` — endpoints, auth, roles, pagos, uploads y rate limits.
- `vianova-testing` — `node:test` + `tsx`, TDD y regresiones.
- `vianova-media-360` — panoramas 360°, Three.js y modelos 3D.
- `vianova-deploy` — Vercel, Cloudflare Workers, Node y Android.
- `vianova-ai-chat` — `/api/chat`, Groq, catálogo y fallback local.

Verificación obligatoria antes de proponer un cambio terminado:

```bash
npm run check && npm test && npm run build
```

Nunca sugieras secretos, credenciales, datos de producción ni `dangerouslySetInnerHTML` con contenido de usuario.
