import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

/** Specific consent for the local calibration study, not the normal product consent. */
export const CALIBRATION_CONSENT_VERSION = "face-calibration-2026-11";
export const CALIBRATION_CONSENT_TEXT = `Autorización para calibración facial local de VIANova

Estoy participando voluntariamente en una evaluación técnica del reconocimiento facial. Entiendo que:
- Se tomarán fotografías de mi rostro en varias sesiones y condiciones (luz normal, poca luz o gafas, cuando corresponda).
- Las fotos se guardarán solo en este equipo, fuera del repositorio y sin enviarse a servicios externos ni a APIs de inteligencia artificial.
- Mi identificador será un seudónimo; no se guardarán mi nombre, documento, teléfono ni correo junto a las fotos.
- Las imágenes se usarán únicamente para medir calibración y evaluación del motor, no para publicidad ni para entrenar un modelo.
- Puedo retirar mi autorización y pedir la eliminación de mis imágenes antes de la fecha de borrado indicada por el operador.
- Las imágenes se eliminarán al terminar la evaluación o al vencer el plazo de retención, salvo que exista una obligación legal distinta.
- Este consentimiento es un borrador para revisión legal; no afirma cumplimiento normativo por sí solo.

Autorizo el tratamiento de mis datos biométricos para esta evaluación local.`;

export const CALIBRATION_CONSENT_HASH = createHash("sha256").update(CALIBRATION_CONSENT_TEXT).digest("hex");
export const COLLECTION_CONDITIONS = ["normal", "poca-luz", "gafas", "piel-clara", "piel-media", "piel-oscura"] as const;
export const COLLECTION_POSES = ["center", "left", "right"] as const;
export const COLLECTION_SPLITS = ["calibration", "evaluation"] as const;

export type CollectionCondition = (typeof COLLECTION_CONDITIONS)[number];
export type CollectionPose = (typeof COLLECTION_POSES)[number];
export type CollectionSplit = (typeof COLLECTION_SPLITS)[number];

export type CollectionParticipant = {
  id: string;
  split: CollectionSplit;
  consentAt: string;
  consentVersion: string;
  consentHash: string;
  createdAt: string;
};

export type CollectionFrame = {
  id: string;
  file: string;
  pose: CollectionPose;
  bytes: number;
  width: number;
  height: number;
  sha256: string;
  capturedAt: string;
  expiresAt: string;
};

export type CollectionSession = {
  id: string;
  participantId: string;
  split: CollectionSplit;
  condition: CollectionCondition;
  createdAt: string;
  expiresAt: string;
  frames: Record<string, CollectionFrame>;
};

export type Collection = {
  version: 1;
  createdAt: string;
  retentionDays: number;
  participants: Record<string, CollectionParticipant>;
  sessions: Record<string, CollectionSession>;
};

const ID = /^[a-z][a-z0-9_-]{2,31}$/;

export function assertParticipantId(value: unknown): string {
  if (typeof value !== "string" || !ID.test(value)) {
    throw new Error("Usa un seudónimo de 3–32 caracteres: minúsculas, números, guion o guion bajo.");
  }
  return value;
}

export function assertSplit(value: unknown): CollectionSplit {
  if (value !== "calibration" && value !== "evaluation") throw new Error("El conjunto debe ser calibration o evaluation.");
  return value;
}

export function assertCondition(value: unknown): CollectionCondition {
  if (!COLLECTION_CONDITIONS.includes(value as CollectionCondition)) throw new Error("Condición de captura no válida.");
  return value as CollectionCondition;
}

export function assertPose(value: unknown): CollectionPose {
  if (!COLLECTION_POSES.includes(value as CollectionPose)) throw new Error("Posición de captura no válida.");
  return value as CollectionPose;
}

export function assertConsent(accepted: unknown, version: unknown): void {
  if (accepted !== true || version !== CALIBRATION_CONSENT_VERSION) {
    throw new Error("La persona debe aceptar el consentimiento específico de calibración.");
  }
}

export function createCollection(now = Date.now(), retentionDays = 30): Collection {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 90) {
    throw new Error("La retención debe estar entre 1 y 90 días.");
  }
  return {
    version: 1,
    createdAt: new Date(now).toISOString(),
    retentionDays,
    participants: {},
    sessions: {},
  };
}

export function addParticipant(
  collection: Collection,
  input: { id: unknown; split: unknown; accepted: unknown; version: unknown },
  now = Date.now(),
): CollectionParticipant {
  assertConsent(input.accepted, input.version);
  const id = assertParticipantId(input.id);
  if (collection.participants[id]) throw new Error("Ese seudónimo ya existe; usa otro.");
  const participant: CollectionParticipant = {
    id,
    split: assertSplit(input.split),
    consentAt: new Date(now).toISOString(),
    consentVersion: CALIBRATION_CONSENT_VERSION,
    consentHash: CALIBRATION_CONSENT_HASH,
    createdAt: new Date(now).toISOString(),
  };
  collection.participants[id] = participant;
  return participant;
}

export function addSession(
  collection: Collection,
  input: { participantId: unknown; condition: unknown },
  now = Date.now(),
): CollectionSession {
  const participantId = assertParticipantId(input.participantId);
  const participant = collection.participants[participantId];
  if (!participant) throw new Error("Primero registra el consentimiento del participante.");
  const condition = assertCondition(input.condition);
  const count = Object.values(collection.sessions).filter((item) => item.participantId === participantId).length;
  if (count >= 20) throw new Error("Máximo de 20 sesiones por participante.");
  const id = `${participantId}-s${String(count + 1).padStart(2, "0")}`;
  if (collection.sessions[id]) throw new Error("La sesión ya existe.");
  const session: CollectionSession = {
    id,
    participantId,
    split: participant.split,
    condition,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + collection.retentionDays * 86_400_000).toISOString(),
    frames: {},
  };
  collection.sessions[id] = session;
  return session;
}

export function addFrame(
  collection: Collection,
  input: {
    participantId: unknown;
    sessionId: unknown;
    pose: unknown;
    bytes: number;
    width: number;
    height: number;
    sha256: string;
  },
  now = Date.now(),
): CollectionFrame {
  const participantId = assertParticipantId(input.participantId);
  const participant = collection.participants[participantId];
  if (!participant) throw new Error("Participante sin consentimiento registrado.");
  if (typeof input.sessionId !== "string" || !collection.sessions[input.sessionId]) {
    throw new Error("Sesión no válida.");
  }
  const session = collection.sessions[input.sessionId];
  if (session.participantId !== participantId) throw new Error("La sesión no pertenece al participante.");
  const pose = assertPose(input.pose);
  if (!Number.isInteger(input.bytes) || input.bytes < 10) throw new Error("Fotograma vacío.");
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height)) throw new Error("Dimensiones no válidas.");
  const id = randomUUID();
  const file = path.posix.join("frames", session.split, participantId, `${session.id}-${pose}-${id.slice(0, 8)}.jpg`);
  const frame: CollectionFrame = {
    id,
    file,
    pose,
    bytes: input.bytes,
    width: input.width,
    height: input.height,
    sha256: input.sha256,
    capturedAt: new Date(now).toISOString(),
    expiresAt: session.expiresAt,
  };
  session.frames[id] = frame;
  return frame;
}

export function isExpired(value: string, now = Date.now()): boolean {
  return !Number.isFinite(Date.parse(value)) || Date.parse(value) <= now;
}
