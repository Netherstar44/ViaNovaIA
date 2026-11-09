// Local-only volunteer collection. Never uploads data and never starts without explicit operator intent.
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  CALIBRATION_CONSENT_TEXT,
  CALIBRATION_CONSENT_VERSION,
  COLLECTION_CONDITIONS,
  COLLECTION_POSES,
  COLLECTION_SPLITS,
  addFrame,
  addParticipant,
  addSession,
  assertCondition,
  assertParticipantId,
  assertSplit,
  createCollection,
  type Collection,
} from "../server/identity/collection-policy.js";
import { buildManifest, manifestOutputPath, manifestWarnings } from "../server/identity/collection-manifest.js";
import { jpegDimensions } from "../server/identity/jpeg.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const staticDir = path.join(repoRoot, "tools", "face-collection");
const DEFAULT_DATA_DIR = path.join(os.homedir(), "VIANova-face-collection");
const MAX_BODY = 1_600_000;

type Args = Record<string, string | boolean>;
function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) { args[key] = value; i++; } else args[key] = true;
  }
  return args;
}

function outsideRepository(target: string, label: string): string {
  const resolved = path.resolve(target);
  const relative = path.relative(repoRoot, resolved);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error(`${label} debe estar fuera del repositorio para no subir fotos ni metadatos a git.`);
  }
  return resolved;
}

function dataDirectory(args: Args): string {
  const requested = typeof args["data-dir"] === "string" ? args["data-dir"] : DEFAULT_DATA_DIR;
  return outsideRepository(requested, "--data-dir");
}

async function loadCollection(dir: string): Promise<Collection> {
  let parsed: unknown;
  try { parsed = JSON.parse(await readFile(path.join(dir, "collection.json"), "utf8")); }
  catch { throw new Error("No existe collection.json en el directorio de captura."); }
  if (!parsed || typeof parsed !== "object") throw new Error("collection.json no es válido.");
  const collection = parsed as Collection;
  if (collection.version !== 1 || typeof collection.participants !== "object" || typeof collection.sessions !== "object") {
    throw new Error("Versión de colección no compatible.");
  }
  return collection;
}

async function saveCollection(dir: string, collection: Collection): Promise<void> {
  const target = path.join(dir, "collection.json");
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(collection, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
  await chmod(target, 0o600).catch(() => undefined);
}

async function ensureCollection(dir: string, retentionDays = 30): Promise<Collection> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    await readFile(path.join(dir, "collection.json"));
    return await loadCollection(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const collection = createCollection(Date.now(), retentionDays);
    await saveCollection(dir, collection);
    return collection;
  }
}

function tokenMatches(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function originAllowed(req: http.IncomingMessage, port: number): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // Local curl/scripts do not send an Origin.
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

async function readJson(req: http.IncomingMessage): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error("Cuerpo demasiado grande.");
    chunks.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("JSON no válido."); }
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function error(res: http.ServerResponse, status: number, message: string): void {
  json(res, status, { error: message });
}

function summary(collection: Collection) {
  return {
    participants: Object.values(collection.participants).map((participant) => ({
      id: participant.id,
      split: participant.split,
      consentAt: participant.consentAt,
    })),
    sessions: Object.values(collection.sessions).map((session) => ({
      id: session.id,
      participantId: session.participantId,
      split: session.split,
      condition: session.condition,
      frames: Object.keys(session.frames).length,
      expiresAt: session.expiresAt,
    })),
  };
}

async function serve(args: Args): Promise<void> {
  const dir = dataDirectory(args);
  const port = Number(args.port ?? 4180);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Puerto local no válido.");
  const retentionDays = Number(args["retention-days"] ?? 30);
  const collection = await ensureCollection(dir, retentionDays);
  const captureEnabled = args["authorize-capture"] === true;
  const token = randomBytes(32).toString("hex");

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        const html = await readFile(path.join(staticDir, "index.html"), "utf8");
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end(html);
        return;
      }
      if (req.method === "GET" && (url.pathname === "/app.js" || url.pathname === "/styles.css")) {
        const type = url.pathname.endsWith(".js") ? "text/javascript" : "text/css";
        const file = await readFile(path.join(staticDir, url.pathname.slice(1)), "utf8");
        res.writeHead(200, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" });
        res.end(file);
        return;
      }
      if (req.method === "GET" && url.pathname === "/health") {
        json(res, 200, { ok: true, captureEnabled });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/meta") {
        json(res, 200, {
          consentText: CALIBRATION_CONSENT_TEXT,
          consentVersion: CALIBRATION_CONSENT_VERSION,
          conditions: COLLECTION_CONDITIONS,
          poses: COLLECTION_POSES,
          splits: COLLECTION_SPLITS,
          captureEnabled,
        });
        return;
      }
      if (!req.url?.startsWith("/api/") || req.method !== "POST" && !(req.method === "GET" && url.pathname === "/api/state")) {
        error(res, 404, "Ruta no encontrada.");
        return;
      }
      if (!originAllowed(req, port)) { error(res, 403, "Origen no permitido."); return; }
      if (!tokenMatches(req.headers["x-collection-token"] as string | undefined, token)) {
        error(res, 401, "Token local no válido.");
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/state") {
        json(res, 200, summary(collection));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/participant") {
        const body = await readJson(req);
        const participant = addParticipant(collection, {
          id: body.id,
          split: body.split,
          accepted: body.accepted,
          version: body.version,
        });
        await saveCollection(dir, collection);
        json(res, 201, { id: participant.id, split: participant.split, consentAt: participant.consentAt });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/session") {
        const body = await readJson(req);
        const session = addSession(collection, { participantId: body.participantId, condition: body.condition });
        await saveCollection(dir, collection);
        json(res, 201, { id: session.id, participantId: session.participantId, condition: session.condition, split: session.split });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/frame") {
        if (!captureEnabled) { error(res, 503, "La captura está deshabilitada. Reinicia con --authorize-capture solo después de explicar y autorizar el estudio."); return; }
        const body = await readJson(req);
        if (typeof body.image !== "string") throw new Error("Falta la imagen JPEG.");
        const encoded = body.image.replace(/^data:image\/jpeg;base64,/i, "");
        if (encoded.length > 400_000) throw new Error("Fotograma demasiado grande.");
        const bytes = Buffer.from(encoded, "base64");
        try {
          if (bytes.length > 240_000 || bytes.length < 10 || bytes.readUInt16BE(0) !== 0xffd8) throw new Error("La imagen debe ser JPEG de hasta 240 KB.");
          const dimensions = jpegDimensions(bytes);
          if (!dimensions || dimensions.width < 160 || dimensions.height < 160 || dimensions.width > 960 || dimensions.height > 960) {
            throw new Error("La imagen debe medir entre 160 y 960 píxeles por lado.");
          }
          const frame = addFrame(collection, {
            participantId: body.participantId,
            sessionId: body.sessionId,
            pose: body.pose,
            bytes: bytes.length,
            width: dimensions.width,
            height: dimensions.height,
            sha256: createHash("sha256").update(bytes).digest("hex"),
          });
          const absolute = path.join(dir, ...frame.file.split("/"));
          try {
            await mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
            await writeFile(absolute, bytes, { mode: 0o600 });
            await chmod(absolute, 0o600).catch(() => undefined);
            await saveCollection(dir, collection);
          } catch (cause) {
            const session = collection.sessions[String(body.sessionId)];
            if (session) delete session.frames[frame.id];
            await rm(absolute, { force: true }).catch(() => undefined);
            throw cause;
          }
          json(res, 201, { id: frame.id, pose: frame.pose, bytes: frame.bytes, width: frame.width, height: frame.height });
        } finally {
          bytes.fill(0);
        }
        return;
      }
      error(res, 404, "Ruta no encontrada.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Error local.";
      error(res, 400, message);
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.info(`Colección local: ${dir}`);
    console.info(`Interfaz: http://127.0.0.1:${port}/`);
    console.info(`Token de esta sesión (no lo compartas): ${token}`);
    console.info(captureEnabled
      ? "Captura habilitada. No continues sin consentimiento registrado de cada persona."
      : "Captura deshabilitada. Reinicia con --authorize-capture solo tras explicar y obtener autorización.");
    console.info(`Retención: ${collection.retentionDays} días. Borra todo con: npm run face:collect -- purge --data-dir "${dir}" --confirm`);
  });
  process.once("SIGINT", () => server.close(() => process.exit(0)));
  process.once("SIGTERM", () => server.close(() => process.exit(0)));
}

async function createManifest(args: Args): Promise<void> {
  const dir = dataDirectory(args);
  const collection = await loadCollection(dir);
  const output = outsideRepository(manifestOutputPath(dir, typeof args.output === "string" ? args.output : undefined), "--output");
  const relative = path.relative(path.dirname(output), dir).split(path.sep).join("/");
  const prefix = relative ? `${relative}/` : "";
  const manifest = buildManifest(collection, { imagePrefix: prefix });
  await writeFile(output, JSON.stringify(manifest, null, 2), { encoding: "utf8", mode: 0o600 });
  await chmod(output, 0o600).catch(() => undefined);
  console.info(`Manifest local: ${output}`);
  for (const warning of manifestWarnings(manifest)) console.warn(`Aviso: ${warning}`);
  console.info("Ejecuta npm run face:calibrate -- <manifest> <reporte>; no actives nada solo con este manifest.");
}

async function purge(args: Args): Promise<void> {
  const dir = dataDirectory(args);
  if (args.confirm !== true) throw new Error("Para borrar todas las capturas y metadatos añade --confirm.");
  await rm(dir, { recursive: true, force: true });
  console.info(`Datos eliminados: ${dir}`);
}

function usage(): void {
  console.info(`Uso:
  npm run face:collect -- serve --data-dir <fuera-del-repo> [--authorize-capture] [--port 4180] [--retention-days 30]
  npm run face:collect -- manifest --data-dir <fuera-del-repo> [--output <fuera-del-repo>/manifest.json]
  npm run face:collect -- purge --data-dir <fuera-del-repo> --confirm`);
}

const argv = process.argv.slice(2);
const command = argv[0] ?? "help";
const args = parseArgs(argv.slice(1));
if (command === "serve") await serve(args);
else if (command === "manifest") await createManifest(args);
else if (command === "purge") await purge(args);
else usage();
