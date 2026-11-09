# Claude Code — ViaNovaIA

La fuente canónica de reglas es **`AGENTS.md`**. Léelo completo antes de escribir código.

## Skills del proyecto

Viven en `skills/<id>/SKILL.md`. Son procedimientos verificados por área: ábrelas con la herramienta de lectura **antes** de tocar el área correspondiente.

| Skill | Cuándo usarla |
| --- | --- |
| `vianova-codebase` | Orientarte en el repo, comandos, convenciones y trampas. |
| `vianova-theming` | Temas, tokens, superficies, contraste. |
| `vianova-seo` | Landings, JSON-LD, sitemap, `llms.txt`, prerenderizado. |
| `vianova-security` | Endpoints, auth, roles, pagos, uploads, rate limits, IA. |
| `vianova-testing` | Pruebas, TDD, depuración de fallos. |
| `vianova-media-360` | Panoramas 360°, Three.js, modelos 3D. |
| `vianova-deploy` | Vercel, Workers, Node, Android, variables de entorno. |
| `vianova-ai-chat` | `/api/chat`, Groq, catálogo, planificador, fallback. |

Índice completo y reglas para añadir skills: `skills/README.md`.

## Reglas que no se negocian

- No subas secretos, `.env` ni capturas con credenciales.
- No modifiques datos de producción sin confirmación explícita y por escrito.
- No desactives tests, `tsc`, lint ni comprobaciones de seguridad para “que pase”.
- No inventes datos que parezcan reales (panoramas, reseñas, precios, proveedores).
- Verifica con `npm run check && npm test && npm run build` antes de dar algo por terminado.
