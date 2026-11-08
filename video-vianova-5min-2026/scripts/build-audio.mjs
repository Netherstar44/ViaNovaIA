/**
 * Build the 66 s master audio bed for the ViaNova IA promo.
 *
 * Layout: Sarah voiceover, one Mixkit music bed (starting at 24 s of the
 * source so the 66 s cut follows the track's build), and a sparse set of
 * sound effects placed on visible actions. The mix is then measured and
 * normalised to -14 LUFS, with a -1.5 dBTP limiter, before AAC encoding.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const audio = path.join(root, "assets", "audio");
const out = path.join(audio, "master.wav");
const tmp = "/tmp/opencode/vianova-audio";
fs.mkdirSync(tmp, { recursive: true });

function duration(file) {
  return Number(
    execFileSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      file,
    ], { encoding: "utf8" }).trim(),
  );
}

function ms(seconds) {
  return Math.round(seconds * 1000);
}

// All times are absolute on the 66 s master.
const vo = [
  ["01", 0.8, -2.2],
  ["02", 6.2, -2.2],
  ["03", 12.0, -2.2],
  ["04", 27.4, -2.2],
  ["05", 38.3, -2.2],
  ["06", 42.2, -2.2],
  ["07", 51.0, -2.2],
  ["08", 58.6, -2.2],
  ["09b", 63.2, -2.2],
].map(([n, at, gain]) => ({
  file: path.join(audio, "vo", `sarah-eleven_v3-${n}.mp3`),
  at,
  gain,
}));

// Measured true peaks (dBFS) for the source effect files.
const sfxPeak = {
  "impact-soft": -0.3,
  "ui-click": -6.6,
  "whoosh-soft": -0.5,
  "riser-warm": 0.6,
  "whoosh-deep": -0.3,
  "key-tick": -8.1,
  "notification-pop": -0.4,
  "paper-slide": -17.6,
  "ui-pop": -6.9,
  "map-pin": -5.1,
  "ui-click-soft": -9.5,
  "mic-click": -8.3,
  "confirm-wood": -0.4,
  "car-door": -8.4,
  "like-pop": -0.4,
  "swipe-fabric": -0.2,
};

// Peak levels are deliberately conservative: the master bus gets the final
// loudness lift, and this keeps the voice clearly in front of the effects.
const sfx = [
  ["impact-soft", 0.15, -15],
  ["ui-click", 1.86, -24],
  ["whoosh-soft", 2.55, -19],
  ["riser-warm", 4.75, -17],
  ["whoosh-deep", 5.45, -17],
  ["key-tick", 6.90, -26],
  ["notification-pop", 9.00, -18],
  ["paper-slide", 10.10, -28],
  ["paper-slide", 10.40, -28],
  ["paper-slide", 10.65, -28],
  ["ui-pop", 11.35, -24],
  ["whoosh-soft", 15.35, -19],
  ["map-pin", 16.45, -23],
  ["map-pin", 16.70, -23],
  ["map-pin", 16.95, -23],
  ["map-pin", 17.20, -23],
  ["whoosh-soft", 19.05, -19],
  ["ui-click-soft", 23.55, -24],
  ["whoosh-soft", 26.40, -19],
  ["ui-click", 27.95, -24],
  ["paper-slide", 28.45, -28],
  ["paper-slide", 29.00, -28],
  ["mic-click", 30.65, -22],
  ["key-tick", 32.55, -26],
  ["key-tick", 32.80, -26],
  ["confirm-wood", 33.70, -18],
  ["ui-click", 34.90, -24],
  ["confirm-wood", 35.08, -18],
  ["notification-pop", 35.35, -18],
  ["car-door", 38.15, -28],
  ["ui-pop", 40.28, -24],
  ["ui-click-soft", 42.55, -24],
  ["whoosh-soft", 43.10, -19],
  ["like-pop", 44.80, -20],
  ["ui-click", 45.75, -24],
  ["ui-pop", 45.95, -24],
  ["whoosh-soft", 49.60, -19],
  ["notification-pop", 50.10, -18],
  ["ui-pop", 53.05, -24],
  ["whoosh-soft", 57.55, -19],
  ["whoosh-deep", 58.05, -17],
  ["impact-soft", 58.20, -15],
  ["swipe-fabric", 59.75, -22],
  ["confirm-wood", 63.20, -18],
].map(([name, at, targetPeak]) => ({
  file: path.join(audio, "sfx", `${name}.mp3`),
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
inputs.push("-i", path.join(audio, "mixkit-587.mp3"));
const musicIdx = idx;
idx += 1;

for (const [i, cue] of sfx.entries()) {
  inputs.push("-i", cue.file);
  filters.push(
    `[${idx}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
      `volume=${cue.gain.toFixed(1)}dB,adelay=${ms(cue.at)}|${ms(cue.at)}[sfx${i}]`,
  );
  idx += 1;
}

const voLabels = vo.map((_, i) => `[vo${i}]`).join("");
const sfxLabels = sfx.map((_, i) => `[sfx${i}]`).join("");
filters.push(
  `${voLabels}amix=inputs=${vo.length}:normalize=0:dropout_transition=0,` +
    `alimiter=limit=0.68:attack=5:release=80:level=false,apad=whole_dur=66,atrim=0:66,asetpts=PTS-STARTPTS[vobus]`,
);
filters.push("[vobus]asplit=2[vomix][voside]");
filters.push(
  `[${musicIdx}:a]atrim=start=24:end=90,asetpts=PTS-STARTPTS,aresample=48000,` +
    `aformat=sample_fmts=fltp:channel_layouts=stereo,volume=-10dB,` +
    `afade=t=in:st=0:d=1.2,afade=t=out:st=63:d=3[music]`,
);
filters.push(
  `[music][voside]sidechaincompress=threshold=0.05:ratio=5:attack=100:release=500:makeup=1[musicduck]`,
);
const mixInputs = `[vomix][musicduck]${sfxLabels}`;
filters.push(
  `${mixInputs}amix=inputs=${2 + sfx.length}:normalize=0:dropout_transition=0,` +
    `atrim=0:66,asetpts=PTS-STARTPTS[pre]`,
);

const filterFile = path.join(tmp, "filter.txt");
fs.writeFileSync(filterFile, filters.join(";\n") + ";\n");

const args = [
  "-y",
  ...inputs,
  "-filter_complex_script", filterFile,
  "-map", "[pre]",
  "-ar", "48000",
  "-ac", "2",
  "-c:a", "pcm_f32le",
  out,
];
console.log(`Building pre-master from ${idx} inputs...`);
execFileSync("ffmpeg", args, { stdio: "inherit" });
console.log(`Pre-master: ${out}`);
