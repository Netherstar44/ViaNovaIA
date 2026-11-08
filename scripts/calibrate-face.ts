// Local only. No network, photographs, embeddings or subject identifiers in output.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { VladFaceEngine } from "../server/identity/face-engine.js";
import { distance, quality } from "../server/identity/policy.js";
const schema = z.object({ consentConfirmed: z.literal(true),
  enrollments: z.record(z.string(), z.string()),
  probes: z.array(z.object({ claimedId: z.string(), image: z.string(), genuine: z.boolean(), group: z.enum(["normal", "poca-luz", "gafas", "piel-clara", "piel-media", "piel-oscura"]) })).min(1),
});
const file = process.argv[2];
if (!file) throw new Error("Uso: npm run face:calibrate -- ruta-local/manifest.json [reporte.json]");
const manifest = schema.safeParse(JSON.parse(await readFile(file, "utf8")));
if (!manifest.success) throw new Error("Manifest inválido o consentimiento no confirmado.");
const engine = new VladFaceEngine(), templates = new Map<string, number[]>();
const local = (fileName: string) => { if (/^[a-z]+:\/\//i.test(fileName)) throw new Error("Solo se permiten archivos locales."); return path.resolve(path.dirname(file), fileName); };
for (const [id, image] of Object.entries(manifest.data.enrollments)) {
  const bytes = await readFile(local(image));
  try { const sample = await engine.analyze(bytes, true); if (quality(sample, "center")) throw new Error("Un enrolamiento no supera calidad; corrige el conjunto local."); templates.set(id, sample.descriptor); }
  finally { bytes.fill(0); }
}
const scores: { genuine: boolean; group: string; score: number }[] = [];
for (const probe of manifest.data.probes) {
  const template = templates.get(probe.claimedId); if (!template) throw new Error("Probe sin enrolamiento.");
  const bytes = await readFile(local(probe.image)); let score = Infinity;
  try { const sample = await engine.analyze(bytes, false); if (!quality(sample, "center")) score = distance(template, sample.descriptor); }
  catch { /* Detection/quality rejection counts as a reject, never silently omitted. */ }
  finally { bytes.fill(0); }
  scores.push({ genuine: probe.genuine, group: probe.group, score });
}
const measure = (set: typeof scores, threshold: number) => {
  const genuine = set.filter(p => p.genuine), impostors = set.filter(p => !p.genuine);
  const falseAccepts = impostors.filter(p => p.score <= threshold).length;
  const falseRejects = genuine.filter(p => p.score > threshold).length;
  return { genuine: genuine.length, impostors: impostors.length, falseAccepts, falseRejects, FAR: impostors.length ? falseAccepts / impostors.length : null, FRR: genuine.length ? falseRejects / genuine.length : null };
};
const sweep = Array.from({ length: 61 }, (_, i) => { const threshold = Math.round((0.15 + i * 0.01) * 100) / 100; return { threshold, ...measure(scores, threshold) }; });
const candidates = sweep.filter(r => r.FAR !== null && r.FRR !== null && r.FAR <= 0.001).sort((a, b) => a.FRR! - b.FRR! || a.threshold - b.threshold);
const selected = candidates[0]?.threshold ?? null;
const report = { model: engine.model, createdAt: new Date().toISOString(), status: "exploratory-requires-independent-holdout", selectedCandidate: selected,
  caution: "No habilitar solo por cero errores: use conjunto independiente e intervalos de confianza. Con cero FA, límite superior 95% aproximado 3/N impostores.",
  missingGroups: ["normal", "poca-luz", "gafas", "piel-clara", "piel-media", "piel-oscura"].filter(g => !scores.some(p => p.group === g)),
  groups: selected === null ? [] : [...new Set(scores.map(p => p.group))].map(group => ({ group, ...measure(scores.filter(p => p.group === group), selected) })), sweep };
await writeFile(process.argv[3] ?? "face-calibration.local.json", JSON.stringify(report, null, 2));
console.info("Informe agregado guardado. No se exportaron imágenes, identificadores ni plantillas.");
