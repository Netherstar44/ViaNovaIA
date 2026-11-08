/**
 * Master audio de 300 s (5 min) para ViaNova IA.
 *
 * - Voz: tomas Sarah existentes (S1-S6 al inicio, S7 al cierre).
 * - Música: Mixkit "Discover" (587) extendida a 300 s con crossfades.
 * - SFX: cues sobre las acciones visibles de cada escena.
 * Salida: assets/audio/master5-pre.wav (lo normaliza normalize-audio-5min.sh).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const audio = path.join(root, "assets", "audio");
const sfxDir = path.join(audio, "sfx");
const voDir = path.join(audio, "vo");
const tmp = "/tmp/opencode/vianova-5min-audio";
fs.mkdirSync(tmp, { recursive: true });

const music5 = path.join(audio, "music5.wav");
const pre = path.join(audio, "master5-pre.wav");

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: "inherit" });
}
function duration(file) {
  return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());
}
function ms(s) { return Math.round(s * 1000); }

// 1) cama musical continua de 300 s a partir de Mixkit 587.
if (!fs.existsSync(music5)) {
  const src = path.join(audio, "mixkit-587.mp3");
  const musicFilter = [
    "[0:a]atrim=start=24:end=94,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[a1]",
    "[0:a]atrim=start=60:end=130,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[a2]",
    "[0:a]atrim=start=24:end=94,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[a3]",
    "[0:a]atrim=start=60:end=130,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[a4]",
    "[0:a]atrim=start=24:end=94,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[a5]",
    "[a1][a2]acrossfade=d=6:c1=tri:c2=tri[b1]",
    "[b1][a3]acrossfade=d=6:c1=tri:c2=tri[b2]",
    "[b2][a4]acrossfade=d=6:c1=tri:c2=tri[b3]",
    "[b3][a5]acrossfade=d=6:c1=tri:c2=tri[music]",
  ].join(";");
  run("ffmpeg", ["-y", "-v", "error", "-i", src, "-filter_complex", musicFilter, "-map", "[music]", "-t", "300", "-ar", "48000", "-ac", "2", "-c:a", "pcm_f32le", music5]);
  console.log("music5.wav listo:", music5);
}

// Voz Sarah: S1-S6 (0-58) y cierre S7 (292-300).
const vo = [
  ["01", 0.8], ["02", 6.2], ["03", 12.0], ["04", 27.4], ["05", 38.3],
  ["06", 42.2], ["07", 51.0], ["08", 292.6], ["09b", 297.2],
].map(([n, at]) => ({ file: path.join(voDir, `sarah-eleven_v3-${n}.mp3`), at, gain: -2.2 }));

const sfxPeak = {
  "impact-soft": -0.3, "ui-click": -6.6, "whoosh-soft": -0.5, "riser-warm": 0.6,
  "whoosh-deep": -0.3, "key-tick": -8.1, "notification-pop": -0.4, "paper-slide": -17.6,
  "ui-pop": -6.9, "map-pin": -5.1, "ui-click-soft": -9.5, "mic-click": -8.3,
  "confirm-wood": -0.4, "car-door": -8.4, "like-pop": -0.4, "swipe-fabric": -0.2,
};

const sfxCues = [
  // S1-S6 (mismos cues del video de 66 s)
  ["impact-soft", 0.15, -15], ["ui-click", 1.86, -24], ["whoosh-soft", 2.55, -19],
  ["riser-warm", 4.75, -17], ["whoosh-deep", 5.45, -17], ["key-tick", 6.90, -26],
  ["notification-pop", 9.00, -18], ["paper-slide", 10.10, -28], ["paper-slide", 10.40, -28],
  ["paper-slide", 10.65, -28], ["ui-pop", 11.35, -24], ["whoosh-soft", 15.35, -19],
  ["map-pin", 16.45, -23], ["map-pin", 16.70, -23], ["map-pin", 16.95, -23],
  ["map-pin", 17.20, -23], ["whoosh-soft", 19.05, -19], ["ui-click-soft", 23.55, -24],
  ["whoosh-soft", 26.40, -19], ["ui-click", 27.95, -24], ["paper-slide", 28.45, -28],
  ["paper-slide", 29.00, -28], ["mic-click", 30.65, -22], ["key-tick", 32.55, -26],
  ["key-tick", 32.80, -26], ["confirm-wood", 33.70, -18], ["ui-click", 34.90, -24],
  ["confirm-wood", 35.08, -18], ["notification-pop", 35.35, -18], ["car-door", 38.15, -28],
  ["ui-pop", 40.28, -24], ["ui-click-soft", 42.55, -24], ["whoosh-soft", 43.10, -19],
  ["like-pop", 44.80, -20], ["ui-click", 45.75, -24], ["ui-pop", 45.95, -24],
  ["whoosh-soft", 49.60, -19], ["notification-pop", 50.10, -18], ["ui-pop", 53.05, -24],
  // S08 roles (58-118)
  ["whoosh-deep", 58.00, -17], ["impact-soft", 58.15, -15], ["ui-pop", 59.00, -24],
  ["ui-click-soft", 64.00, -24], ["ui-click-soft", 72.00, -24], ["ui-click-soft", 80.00, -24],
  ["ui-click-soft", 88.00, -24], ["car-door", 96.00, -28], ["ui-click-soft", 104.00, -24],
  ["ui-click-soft", 112.00, -24], ["riser-warm", 116.50, -17],
  // S09 viajero + social (118-178)
  ["whoosh-soft", 118.00, -19], ["key-tick", 122.00, -26], ["map-pin", 132.00, -23],
  ["confirm-wood", 144.00, -18], ["like-pop", 156.00, -20], ["ui-pop", 168.00, -24],
  ["whoosh-soft", 176.00, -19],
  // S10 negocios + captura 360 (178-238)
  ["notification-pop", 178.50, -18], ["ui-click", 182.00, -24], ["mic-click", 190.00, -22],
  ["key-tick", 198.00, -26], ["confirm-wood", 214.00, -18], ["notification-pop", 226.00, -18],
  ["whoosh-soft", 236.00, -19],
  // S11 inmersivo (238-292)
  ["whoosh-deep", 238.00, -17], ["impact-soft", 238.20, -15], ["ui-pop", 240.00, -24],
  ["map-pin", 254.00, -23], ["confirm-wood", 270.00, -18], ["riser-warm", 288.00, -17],
  // S07 cierre (292-300)
  ["whoosh-soft", 291.55, -19], ["whoosh-deep", 292.05, -17], ["impact-soft", 292.20, -15],
  ["swipe-fabric", 293.75, -22], ["confirm-wood", 297.20, -18],
].map(([name, at, targetPeak]) => ({
  file: path.join(sfxDir, `${name}.mp3`),
  at,
  gain: targetPeak - sfxPeak[name],
}));

const inputs = [];
const filters = [];
let idx = 0;
for (const [i, take] of vo.entries()) {
  const d = duration(take.file);
  inputs.push("-i", take.file);
  const fadeOut = Math.max(0, d - 0.06);
  filters.push(
    `[${idx}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
    `volume=${take.gain}dB,afade=t=in:st=0:d=0.02,afade=t=out:st=${fadeOut.toFixed(3)}:d=0.06,` +
    `adelay=${ms(take.at)}|${ms(take.at)}[vo${i}]`,
  );
  idx += 1;
}
inputs.push("-i", music5);
const musicIdx = idx;
idx += 1;
for (const [i, cue] of sfxCues.entries()) {
  inputs.push("-i", cue.file);
  filters.push(
    `[${idx}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
    `volume=${cue.gain.toFixed(1)}dB,adelay=${ms(cue.at)}|${ms(cue.at)}[sfx${i}]`,
  );
  idx += 1;
}

const voLabels = vo.map((_, i) => `[vo${i}]`).join("");
const sfxLabels = sfxCues.map((_, i) => `[sfx${i}]`).join("");
filters.push(`${voLabels}amix=inputs=${vo.length}:normalize=0:dropout_transition=0,alimiter=limit=0.68:attack=5:release=80:level=false,apad=whole_dur=300,atrim=0:300,asetpts=PTS-STARTPTS[vobus]`);
filters.push("[vobus]asplit=2[vomix][voside]");
filters.push(
  `[${musicIdx}:a]atrim=0:300,asetpts=PTS-STARTPTS,aresample=48000,` +
  `aformat=sample_fmts=fltp:channel_layouts=stereo,volume=-11dB,` +
  `afade=t=in:st=0:d=1.5,afade=t=out:st=296:d=4[music]`,
);
filters.push("[music][voside]sidechaincompress=threshold=0.05:ratio=5:attack=100:release=500:makeup=1[musicduck]");
filters.push(`[vomix][musicduck]${sfxLabels}amix=inputs=${2 + sfxCues.length}:normalize=0:dropout_transition=0,atrim=0:300,asetpts=PTS-STARTPTS[pre]`);

const filterFile = path.join(tmp, "filter5.txt");
fs.writeFileSync(filterFile, filters.join(";\n") + ";\n");
console.log(`Mezclando master 300 s desde ${idx} entradas...`);
run("ffmpeg", ["-y", ...inputs, "-filter_complex_script", filterFile, "-map", "[pre]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_f32le", pre]);
console.log("Pre-master 300 s listo:", pre);
