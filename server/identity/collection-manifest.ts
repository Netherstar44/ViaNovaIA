import path from "node:path";
import {
  CALIBRATION_CONSENT_HASH,
  CALIBRATION_CONSENT_VERSION,
  COLLECTION_CONDITIONS,
  type Collection,
  type CollectionFrame,
  type CollectionSplit,
  isExpired,
} from "./collection-policy.js";

export type ManifestProbe = {
  claimedId: string;
  subjectId: string;
  image: string;
  session: string;
  genuine: boolean;
  group: string;
};

export type ManifestSplit = {
  enrollments: Record<string, { image: string; session: string }>;
  probes: ManifestProbe[];
};

export type CollectionManifest = {
  consentConfirmed: true;
  dataset: {
    name: string;
    source: string;
    license: string;
    consent: true;
    restrictions: string;
  };
  calibration: ManifestSplit;
  evaluation: ManifestSplit;
};

function imagePath(frame: CollectionFrame, prefix: string): string {
  return `${prefix}${frame.file}`;
}

function sortedFrames(session: { frames: Record<string, CollectionFrame> }): CollectionFrame[] {
  return Object.values(session.frames).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

/**
 * Build a manifest from the local collection. Every image is used at most once.
 * A participant's first later-session probe is genuine and the rest are
 * impostor probes; the manifest therefore never pretends that repeated photos
 * of one person are independent evidence.
 */
export function buildManifest(
  collection: Collection,
  options: { imagePrefix?: string; now?: number } = {},
): CollectionManifest {
  const prefix = options.imagePrefix ?? "";
  const now = options.now ?? Date.now();
  const buildSplit = (split: CollectionSplit): ManifestSplit => {
    const participants = Object.values(collection.participants)
      .filter((participant) => participant.split === split
        && participant.consentAt
        && participant.consentVersion === CALIBRATION_CONSENT_VERSION
        && participant.consentHash === CALIBRATION_CONSENT_HASH)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (participants.length < 2) {
      throw new Error(`${split}: se necesitan al menos dos personas con consentimiento para generar comparaciones impostoras.`);
    }

    const enrollments: ManifestSplit["enrollments"] = {};
    const probes: ManifestProbe[] = [];
    for (const participant of participants) {
      const sessions = Object.values(collection.sessions)
        .filter((session) => session.participantId === participant.id && session.split === split)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const enrollmentSession = sessions.find((session) =>
        sortedFrames(session).some((frame) => frame.pose === "center" && !isExpired(frame.expiresAt, now)),
      );
      if (!enrollmentSession) throw new Error(`${split}: ${participant.id} no tiene una captura central vigente para enrolamiento.`);
      const enrollmentFrame = sortedFrames(enrollmentSession).find((frame) => frame.pose === "center" && !isExpired(frame.expiresAt, now));
      if (!enrollmentFrame) throw new Error(`${split}: falta el fotograma central de ${participant.id}.`);
      enrollments[participant.id] = { image: imagePath(enrollmentFrame, prefix), session: enrollmentSession.id };

      const candidates = sessions
        .filter((session) => session.id !== enrollmentSession.id)
        .flatMap((session) => sortedFrames(session)
          .filter((frame) => !isExpired(frame.expiresAt, now))
          .map((frame) => ({ session, frame })));
      if (candidates.length < 2) {
        throw new Error(`${split}: ${participant.id} necesita al menos dos fotogramas en sesiones posteriores (una genuina y una impostora).`);
      }
      const others = participants.filter((candidate) => candidate.id !== participant.id);
      if (others.length === 0) throw new Error(`${split}: falta otra persona para comparaciones impostoras.`);
      candidates.forEach(({ session, frame }, index) => {
        const genuine = index === 0;
        const claimedId = genuine ? participant.id : others[index % others.length].id;
        probes.push({
          claimedId,
          subjectId: participant.id,
          image: imagePath(frame, prefix),
          session: session.id,
          genuine,
          group: session.condition,
        });
      });
    }

    if (!probes.some((probe) => probe.genuine) || !probes.some((probe) => !probe.genuine)) {
      throw new Error(`${split}: el manifest debe incluir comparaciones genuinas e impostoras.`);
    }
    const seen = new Set<string>();
    for (const probe of probes) {
      if (seen.has(probe.image)) throw new Error(`${split}: imagen reutilizada en el manifest.`);
      seen.add(probe.image);
    }
    return { enrollments, probes };
  };

  return {
    consentConfirmed: true,
    dataset: {
      name: "VIANova volunteer calibration collection",
      source: "local volunteer collection; no external service",
      license: "specific calibration consent; no redistribution",
      consent: true,
      restrictions: `Solo evaluación local; borrar al vencer la retención de ${collection.retentionDays} días o al terminar el estudio. No usar para entrenar ni publicar imágenes.`,
    },
    calibration: buildSplit("calibration"),
    evaluation: buildSplit("evaluation"),
  };
}

export function manifestWarnings(manifest: CollectionManifest): string[] {
  const counts = (split: ManifestSplit) => ({
    genuine: split.probes.filter((probe) => probe.genuine).length,
    impostors: split.probes.filter((probe) => !probe.genuine).length,
    groups: new Set(split.probes.map((probe) => probe.group)),
  });
  const calibration = counts(manifest.calibration);
  const evaluation = counts(manifest.evaluation);
  const warnings: string[] = [];
  if (calibration.genuine < 300 || calibration.impostors < 3000 || evaluation.genuine < 300 || evaluation.impostors < 3000) {
    warnings.push("Las comparaciones todavía no alcanzan los mínimos de 300 genuinas y 3.000 impostoras independientes; no se puede validar producción con esta cantidad.");
  }
  const missing = COLLECTION_CONDITIONS.filter((condition) => !evaluation.groups.has(condition));
  if (missing.length) warnings.push(`Faltan condiciones en evaluación: ${missing.join(", ")}.`);
  warnings.push("Los conteos anteriores son comparaciones, no clusters independientes; el calibrador calculará los clusters y podrá rechazar el informe.");
  return warnings;
}

export function manifestOutputPath(dataDirectory: string, output?: string): string {
  return output ? path.resolve(output) : path.join(dataDirectory, "manifest.json");
}
