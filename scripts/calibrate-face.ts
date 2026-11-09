// Local evaluation only. No network, photographs, embeddings or subject IDs in the report.
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { FaceInputError, VladFaceEngine } from "../server/identity/face-engine.js";
import { distance, quality } from "../server/identity/policy.js";
import {
  FACE_CALIBRATION_CONFIDENCE,
  FACE_CALIBRATION_MIN_EVALUATION_GENUINE,
  FACE_CALIBRATION_MIN_EVALUATION_IMPOSTORS,
  FACE_CALIBRATION_MIN_GROUP_GENUINE,
  FACE_CALIBRATION_MIN_GROUP_IMPOSTORS,
  FACE_CALIBRATION_TARGET_FAR,
  FACE_CALIBRATION_TARGET_FRR,
} from "../server/identity/calibration.js";

const GROUPS = ["normal", "poca-luz", "gafas", "piel-clara", "piel-media", "piel-oscura"] as const;
const groupSchema = z.enum(GROUPS);
const subjectId = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
const imageName = z.string().min(1).max(500);
const sessionId = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.:-]+$/);
const enrollmentSchema = z.object({ image: imageName, session: sessionId }).strict();
const probeSchema = z.object({
  claimedId: subjectId,
  image: imageName,
  session: sessionId,
  genuine: z.boolean(),
  group: groupSchema,
}).strict();
const splitSchema = z.object({
  enrollments: z.record(subjectId, enrollmentSchema).refine(
    (entries) => Object.keys(entries).length > 0,
    "Cada conjunto necesita al menos un enrolamiento.",
  ),
  probes: z.array(probeSchema).min(1),
}).strict();
const datasetSchema = z.object({
  name: z.string().min(1).max(200),
  source: z.string().min(1).max(500),
  license: z.string().min(1).max(500),
  consent: z.literal(true),
  restrictions: z.string().min(1).max(1000),
}).strict();
const manifestSchema = z.object({
  consentConfirmed: z.literal(true),
  dataset: datasetSchema,
  calibration: splitSchema,
  evaluation: splitSchema,
}).strict();

type Group = (typeof GROUPS)[number];
type Split = z.infer<typeof splitSchema>;
type Probe = Split["probes"][number];
type Score = { genuine: boolean; group: Group; score: number };
type SplitResult = {
  scores: Score[];
  rejected: number;
  rejectedByGroup: Record<Group, number>;
};

if (!process.argv[2]) {
  throw new Error("Uso: npm run face:calibrate -- ruta-local/manifest.json [reporte.json]");
}

const manifestPath = path.resolve(process.argv[2]);
let parsed: unknown;
try { parsed = JSON.parse(await readFile(manifestPath, "utf8")); }
catch { throw new Error("No se pudo leer el manifest JSON local."); }
const manifest = manifestSchema.safeParse(parsed);
if (!manifest.success) {
  throw new Error("Manifest inválido: exige consentimiento, dos conjuntos separados y metadatos del dataset.");
}

const engine = new VladFaceEngine();
const baseDirectory = path.dirname(manifestPath);

/** Resolve only local files. URL/path injection is rejected before reading. */
async function localPath(fileName: string): Promise<string> {
  if (/^[a-z]+:\/\//i.test(fileName)) throw new Error("Solo se permiten archivos locales.");
  return realpath(path.resolve(baseDirectory, fileName));
}

function splitSessions(split: Split): Set<string> {
  return new Set([
    ...Object.values(split.enrollments).map((entry) => entry.session),
    ...split.probes.map((probe) => probe.session),
  ]);
}

function hasBothClasses(split: Split): boolean {
  return split.probes.some((probe) => probe.genuine) && split.probes.some((probe) => !probe.genuine);
}

async function validateManifest() {
  const data = manifest.data;
  for (const [name, split] of [["calibration", data.calibration], ["evaluation", data.evaluation]] as const) {
    if (!hasBothClasses(split)) throw new Error(`${name}: incluye comparaciones genuinas e impostoras.`);
    for (const probe of split.probes) {
      const enrollment = split.enrollments[probe.claimedId];
      if (!enrollment) throw new Error(`${name}: una prueba no tiene enrolamiento para su claimedId.`);
      if (probe.genuine && probe.session === enrollment.session) {
        throw new Error(`${name}: una comparación genuina reutiliza la misma sesión que el enrolamiento.`);
      }
    }
  }

  const calibrationSubjects = new Set(Object.keys(data.calibration.enrollments));
  const evaluationSubjects = new Set(Object.keys(data.evaluation.enrollments));
  const sharedSubjects = [...calibrationSubjects].filter((subject) => evaluationSubjects.has(subject));
  if (sharedSubjects.length) throw new Error("Las identidades de calibración y evaluación deben ser disjuntas.");

  const calibrationSessions = splitSessions(data.calibration);
  const evaluationSessions = splitSessions(data.evaluation);
  const sharedSessions = [...calibrationSessions].filter((session) => evaluationSessions.has(session));
  if (sharedSessions.length) throw new Error("Las sesiones de calibración y evaluación deben ser disjuntas.");

  const seen = new Map<string, string>();
  for (const [name, split] of [["calibration", data.calibration], ["evaluation", data.evaluation]] as const) {
    for (const entry of Object.values(split.enrollments)) {
      const resolved = await localPath(entry.image);
      if (seen.has(resolved)) throw new Error(`Imagen reutilizada entre ${seen.get(resolved)} y ${name}.`);
      seen.set(resolved, name);
    }
    for (const probe of split.probes) {
      const resolved = await localPath(probe.image);
      if (seen.has(resolved)) throw new Error(`Imagen reutilizada entre ${seen.get(resolved)} y ${name}.`);
      seen.set(resolved, name);
    }
  }
}

async function evaluateSplit(split: Split): Promise<SplitResult> {
  const templates = new Map<string, number[]>();
  const rejectedByGroup = Object.fromEntries(GROUPS.map((group) => [group, 0])) as Record<Group, number>;

  for (const [subject, entry] of Object.entries(split.enrollments)) {
    const bytes = await readFile(await localPath(entry.image));
    try {
      let sample;
      try { sample = await engine.analyze(bytes, true); }
      catch (error) {
        if (error instanceof FaceInputError) throw new Error(`Un enrolamiento no supera la validación de imagen (${subject}).`);
        throw error;
      }
      if (quality(sample, "center")) throw new Error(`Un enrolamiento no supera calidad mínima (${subject}).`);
      templates.set(subject, sample.descriptor);
    } finally {
      bytes.fill(0);
    }
  }

  const scores: Score[] = [];
  let rejected = 0;
  for (const probe of split.probes) {
    const template = templates.get(probe.claimedId);
    if (!template) throw new Error("Prueba sin enrolamiento; el manifest ya fue validado.");
    const bytes = await readFile(await localPath(probe.image));
    let score = Infinity;
    try {
      let sample;
      try { sample = await engine.analyze(bytes, false); }
      catch (error) {
        if (!(error instanceof FaceInputError)) throw error;
        rejected++;
        rejectedByGroup[probe.group]++;
        scores.push({ genuine: probe.genuine, group: probe.group, score });
        continue;
      }
      if (quality(sample, "center")) {
        rejected++;
        rejectedByGroup[probe.group]++;
      } else {
        score = distance(template, sample.descriptor);
      }
      scores.push({ genuine: probe.genuine, group: probe.group, score });
    } finally {
      bytes.fill(0);
    }
  }
  return { scores, rejected, rejectedByGroup };
}

/** One-sided Wilson upper bound, used instead of claiming an exact FAR from a small sample. */
function wilsonUpper(successes: number, n: number, zScore = 1.645): number | null {
  if (n <= 0) return null;
  const p = successes / n;
  const denominator = 1 + (zScore * zScore) / n;
  const centre = p + (zScore * zScore) / (2 * n);
  const margin = zScore * Math.sqrt((p * (1 - p)) / n + (zScore * zScore) / (4 * n * n));
  return Math.min(1, (centre + margin) / denominator);
}

function measure(set: Score[], threshold: number) {
  const genuine = set.filter((item) => item.genuine);
  const impostors = set.filter((item) => !item.genuine);
  const falseAccepts = impostors.filter((item) => item.score <= threshold).length;
  const falseRejects = genuine.filter((item) => item.score > threshold).length;
  return {
    comparisons: set.length,
    genuine: genuine.length,
    impostors: impostors.length,
    falseAccepts,
    falseRejects,
    FAR: impostors.length ? falseAccepts / impostors.length : null,
    FRR: genuine.length ? falseRejects / genuine.length : null,
    FAR_upper_95_one_sided: wilsonUpper(falseAccepts, impostors.length),
    FRR_upper_95_one_sided: wilsonUpper(falseRejects, genuine.length),
  };
}

await validateManifest();
const data = manifest.data;
const calibration = await evaluateSplit(data.calibration);
const evaluation = await evaluateSplit(data.evaluation);
const sweep = Array.from({ length: 61 }, (_, index) => {
  const threshold = Math.round((0.15 + index * 0.01) * 100) / 100;
  return { threshold, ...measure(calibration.scores, threshold) };
});
const candidates = sweep
  .filter((row) => row.FAR_upper_95_one_sided !== null && row.FAR_upper_95_one_sided <= FACE_CALIBRATION_TARGET_FAR)
  .filter((row) => row.FRR !== null && row.FRR <= FACE_CALIBRATION_TARGET_FRR)
  .sort((a, b) => (a.FRR! - b.FRR!) || (b.threshold - a.threshold));
const selectedCandidate = candidates[0]?.threshold ?? null;
const evaluationAtThreshold = selectedCandidate === null ? null : measure(evaluation.scores, selectedCandidate);

const missingGroups = GROUPS.filter(
  (group) => !calibration.scores.some((item) => item.group === group) || !evaluation.scores.some((item) => item.group === group),
);
const groupEvidence = GROUPS.map((group) => {
  const rows = evaluation.scores.filter((item) => item.group === group);
  const genuine = rows.filter((item) => item.genuine).length;
  const impostors = rows.length - genuine;
  return {
    group,
    genuine,
    impostors,
    enoughGenuine: genuine >= FACE_CALIBRATION_MIN_GROUP_GENUINE,
    enoughImpostors: impostors >= FACE_CALIBRATION_MIN_GROUP_IMPOSTORS,
  };
});
const underpoweredGroups = groupEvidence
  .filter((item) => !item.enoughGenuine || !item.enoughImpostors)
  .map((item) => item.group);
const hasEnoughIndependentEvidence = !!evaluationAtThreshold
  && evaluationAtThreshold.impostors >= FACE_CALIBRATION_MIN_EVALUATION_IMPOSTORS
  && evaluationAtThreshold.genuine >= FACE_CALIBRATION_MIN_EVALUATION_GENUINE
  && underpoweredGroups.length === 0;
const farMeetsTarget = !!evaluationAtThreshold
  && evaluationAtThreshold.FAR_upper_95_one_sided !== null
  && evaluationAtThreshold.FAR_upper_95_one_sided <= FACE_CALIBRATION_TARGET_FAR;
const frrMeetsTarget = !!evaluationAtThreshold
  && evaluationAtThreshold.FRR !== null
  && evaluationAtThreshold.FRR <= FACE_CALIBRATION_TARGET_FRR;
const insufficientEvidence = selectedCandidate === null || !hasEnoughIndependentEvidence || missingGroups.length > 0;
const validated = !insufficientEvidence && farMeetsTarget && frrMeetsTarget;

const report = {
  model: engine.model,
  createdAt: new Date().toISOString(),
  status: validated ? "validated" : (insufficientEvidence ? "insufficient-evidence" : "evaluation-does-not-meet-target"),
  productionEnabled: false,
  target: {
    FAR: FACE_CALIBRATION_TARGET_FAR,
    FRR: FACE_CALIBRATION_TARGET_FRR,
    confidence: FACE_CALIBRATION_CONFIDENCE,
    minimumEvaluationImpostors: FACE_CALIBRATION_MIN_EVALUATION_IMPOSTORS,
    minimumEvaluationGenuine: FACE_CALIBRATION_MIN_EVALUATION_GENUINE,
    minimumGroupImpostors: FACE_CALIBRATION_MIN_GROUP_IMPOSTORS,
    minimumGroupGenuine: FACE_CALIBRATION_MIN_GROUP_GENUINE,
    zeroFalseAcceptRule: "Con cero falsos positivos, el límite superior 95% aproximado es 3/N; se requieren ~3000 impostores independientes para 0.1%.",
  },
  dataset: {
    name: data.dataset.name,
    source: data.dataset.source,
    license: data.dataset.license,
    restrictions: data.dataset.restrictions,
  },
  independence: {
    separateSplits: true,
    disjointSubjects: true,
    disjointSessions: true,
    reusedImages: false,
    note: "Cada comparación se cuenta una vez; no se presentan varias imágenes de la misma sesión como evidencia independiente.",
  },
  counts: {
    calibration: { enrollments: Object.keys(data.calibration.enrollments).length, probes: data.calibration.probes.length, rejected: calibration.rejected },
    evaluation: { enrollments: Object.keys(data.evaluation.enrollments).length, probes: data.evaluation.probes.length, rejected: evaluation.rejected },
  },
  selectedCandidate,
  evaluationAtThreshold,
  missingGroups,
  underpoweredGroups,
  groupEvidence,
  groups: selectedCandidate === null ? { calibration: [], evaluation: [] } : {
    calibration: GROUPS.map((group) => ({ group, ...measure(calibration.scores.filter((item) => item.group === group), selectedCandidate) })),
    evaluation: GROUPS.map((group) => ({ group, ...measure(evaluation.scores.filter((item) => item.group === group), selectedCandidate) })),
  },
  qualityRejections: {
    calibration: calibration.rejectedByGroup,
    evaluation: evaluation.rejectedByGroup,
  },
  sweep,
  caution: "No habilita la función. Un informe validado solo es evidencia si la licencia, el consentimiento y la revisión legal lo permiten; no sustituye una prueba física en Android ni una evaluación de deepfakes/PAD.",
};

await writeFile(process.argv[3] ?? "face-calibration.local.json", JSON.stringify(report, null, 2));
console.info("Informe agregado guardado. No se exportaron imágenes, identificadores ni plantillas.");
