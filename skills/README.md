# Skills de ViaNovaIA

Procedimientos verificados de este repositorio, en Markdown plano. **No dependen de OpenCode**: cualquier agente que pueda leer un archivo puede usarlas.

## Ubicación canónica

```
skills/
├── README.md            ← este índice
├── vianova-codebase/
│   └── SKILL.md
├── vianova-theming/
│   └── SKILL.md
└── …
```

Cada skill es una carpeta con un `SKILL.md`. El **ID** es el nombre de la carpeta. El `name` del frontmatter es solo el título legible.

## Compatibilidad por agente

Ningún agente necesita una copia: se apunta al mismo sitio.

| Agente | Cómo las descubre | Archivo que lo declara |
| --- | --- | --- |
| **OpenCode** | Descubrimiento nativo (config `skills`) | `opencode.json` → `"skills": ["./skills"]` |
| **Claude Code** | Lee `CLAUDE.md` al iniciar; también acepta skills nativas en `.claude/skills/` | `CLAUDE.md` (puntero) |
| **Codex** | Lee `AGENTS.md` de la raíz | `AGENTS.md` (sección *Skills del proyecto*) |
| **Cursor** | Lee `AGENTS.md` de la raíz | `AGENTS.md` |
| **Gemini CLI** | Lee `AGENTS.md` si no hay `GEMINI.md` | `AGENTS.md` |
| **GitHub Copilot** | Lee `.github/copilot-instructions.md` y `AGENTS.md` | `.github/copilot-instructions.md` |
| **Windsurf, Amp, Jules, Zed, Aider** | Convención `AGENTS.md` | `AGENTS.md` |

> Codex, Copilot CLI y Gemini CLI también reconocen `~/.agents/skills/` como alias **de usuario** (fuera de este repo). No lo usamos para no duplicar contenido ni depender de la máquina de cada quien.

### Por qué punteros y no copias

Duplicar las skills en `.claude/skills/`, `.agents/skills/`, etc. garantiza que en dos semanas existan cinco versiones distintas. La fuente es una; los agentes reciben la ruta.

Si algún día necesitas descubrimiento nativo en otra ruta, genera las copias con un script y **no las edites a mano**; añade ese script al repo y documenta aquí el comando.

## Índice

| Skill | Úsala cuando… |
| --- | --- |
| `vianova-codebase` | Necesites orientarte en el repo, saber dónde vive una funcionalidad, qué comando ejecutar o cuál es la definición de “terminado”. |
| `vianova-theming` | Añadas o cambies temas, colores, superficies glass, contraste o estilos visuales. |
| `vianova-seo` | Crees o edites landings SEO, JSON-LD, sitemap, `llms.txt` o el prerenderizado. |
| `vianova-security` | Toques endpoints, autenticación, roles, pagos, uploads, rate limits o cualquier dato sensible. |
| `vianova-testing` | Escribas pruebas, depures un fallo o necesites el flujo TDD del proyecto. |
| `vianova-media-360` | Trabajes con panoramas 360°, Three.js, modelos 3D, captura o stitch de imágenes. |
| `vianova-deploy` | Prepare despliegues en Vercel, Cloudflare Workers, Node o Android. |
| `vianova-ai-chat` | Modifiques el asistente IA, el planificador de viajes o el contexto del catálogo. |

## Cómo usar una skill

1. Identifica el área del cambio.
2. Abre `skills/<id>/SKILL.md` con la herramienta de lectura de archivos.
3. Sigue sus pasos y verifica con los comandos que indica.
4. Si la skill contradice a `AGENTS.md`, **gana `AGENTS.md`** y actualiza la skill en el mismo commit.

## Añadir una skill

1. Crea `skills/mi-skill/SKILL.md`.
2. Añade frontmatter con `name` y `description`. La descripción empieza por “Usar cuando…” e incluye síntomas o palabras clave para que el agente sepa cuándo cargarla.
3. Escribe el cuerpo con pasos accionables, rutas reales y comandos verificados. Nada de narrativa histórica.
4. Si necesita scripts, referencias o plantillas, guárdalos dentro de su carpeta y enlázalos desde `SKILL.md` con rutas relativas.
5. Añádela a la tabla de este README y a la sección *Skills del proyecto* de `AGENTS.md`.
6. Verifica rutas y comandos antes del commit.

```markdown
---
name: Mi Skill
description: Usar cuando se necesite hacer X en ViaNovaIA.
---

## Cuándo usarla

...

## Pasos

1. ...
```

## Validación

Antes de hacer commit:

```bash
# 1. Cada carpeta tiene SKILL.md con frontmatter
Get-ChildItem skills -Directory | ForEach-Object {
  $f = Join-Path $_.FullName 'SKILL.md'
  if (-not (Test-Path $f)) { throw "Falta $f" }
  $head = Get-Content $f -TotalCount 1
  if ($head -ne '---') { throw "$f sin frontmatter" }
}

# 2. Los comandos citados existen en package.json
npm run check
```

Y en CI o antes del push: `npm run check && npm test`.

## Reglas

- Una skill **no sustituye** a `AGENTS.md`; lo complementa y lo enlaza.
- No dupliques reglas de seguridad: enlaza a `vianova-security`.
- No inventes comandos, rutas ni variables de entorno.
- No incluyas secretos, tokens, rutas de máquina ni datos personales.
- Si cambias el comportamiento del proyecto, actualiza la skill afectada en el mismo commit.
