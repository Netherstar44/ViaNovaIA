import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Count only tracked application source. Dependencies, lockfiles, generated
// assets, videos and documentation cannot inflate the application total.
const root = fileURLToPath(new URL('../', import.meta.url));
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.sql']);
const directories = new Set(['client', 'server', 'shared', 'api', 'functions', 'scripts', 'script', 'tests', 'migrations']);
const files = execFileSync('git', ['ls-files', '-z'], {
  cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}).split('\0').filter(Boolean);
const groups = new Map();
const missing = [];
for (const file of files) {
  const directory = file.split('/')[0];
  if (!directories.has(directory) || !extensions.has(path.extname(file))) continue;
  if (file.endsWith('.d.ts') || /(^|\/)(dist|build|coverage|vendor|node_modules)(\/|$)/.test(file)) continue;
  let source;
  try { source = readFileSync(path.join(root, file), 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    missing.push(file);
    continue;
  }
  const lines = source ? source.replace(/\r\n/g, '\n').split('\n') : [];
  if (lines.at(-1) === '') lines.pop();
  const item = groups.get(directory) ?? { area: directory, files: 0, lines: 0, nonblank: 0 };
  item.files++;
  item.lines += lines.length;
  item.nonblank += lines.filter(line => line.trim()).length;
  groups.set(directory, item);
}
const areas = [...groups.values()].sort((a, b) => a.area.localeCompare(b.area));
const total = areas.reduce((sum, item) => ({
  files: sum.files + item.files,
  lines: sum.lines + item.lines,
  nonblank: sum.nonblank + item.nonblank,
}), { files: 0, lines: 0, nonblank: 0 });
const report = {
  definition: 'Tracked source files in the working tree; physical lines including comments. Not a measure of quality or completion.',
  areas, total, missing,
};
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  console.table(areas);
  console.info(`Total: ${total.files} archivos, ${total.lines} líneas físicas, ${total.nonblank} no vacías.`);
  console.info('Incluye comentarios. Excluye documentación, assets, lockfiles y declaraciones .d.ts.');
  if (missing.length) console.warn(`${missing.length} archivos rastreados ausentes; el total es incompleto.`);
}
if (missing.length) process.exitCode = 1;
