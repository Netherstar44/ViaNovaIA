const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const baseDir = path.resolve(__dirname, '..');
const audioDir = path.join(baseDir, 'assets', 'audio');

const delays = [
  300,    // vo-01 at 0.3s
  4200,   // vo-02 at 4.2s
  10500,  // vo-03 at 10.5s
  17500,  // vo-04 at 17.5s
  22500,  // vo-05 at 22.5s
  27500,  // vo-06 at 27.5s
  33500,  // vo-07 at 33.5s
  39500   // vo-08 at 39.5s
];

let inputs = [];
let filterParts = [];
for (let i = 1; i <= 8; i++) {
  const file = path.join(audioDir, `vo-0${i}.mp3`);
  inputs.push(`-i "${file}"`);
  filterParts.push(`[${i-1}:a]adelay=${delays[i-1]}|${delays[i-1]}[a${i}]`);
}

const filterStr = filterParts.join(';') + ';[a1][a2][a3][a4][a5][a6][a7][a8]amix=inputs=8:dropout_transition=0:normalize=0[out]';
const outFile = path.join(audioDir, 'voiceover.mp3');

const cmd = `ffmpeg -y ${inputs.join(' ')} -filter_complex "${filterStr}" -map "[out]" -t 49.5 -b:a 192k "${outFile}"`;
console.log('Running ffmpeg to build master voiceover...');
execSync(cmd, { stdio: 'inherit' });
console.log('Master voiceover created at:', outFile);
