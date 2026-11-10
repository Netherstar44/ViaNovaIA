import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Count only tracked application source. Dependencies, lockfiles, generated
// assets, videos and documentation cannot inflate the application total.
export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.sql']);
export const directories = new Set(['client', 'server', 'shared', 'api', 'functions', 'scripts', 'script', 'tests', 'migrations']);
const excludedPath = /(^|\/)(dist|build|coverage|vendor|node_modules)(\/|$)/;
const definition = 'Tracked source files in the working tree; physical lines including comments. Not a measure of quality or completion.';

export function isCountedFile(file) {
  return directories.has(file.split('/')[0])
    && extensions.has(path.extname(file))
    && !file.endsWith('.d.ts')
    && !excludedPath.test(file);
}

export function countLines(source) {
  const lines = source ? source.replace(/\r\n/g, '\n').split('\n') : [];
  if (lines.at(-1) === '') lines.pop();
  return { lines: lines.length, nonblank: lines.filter(line => line.trim()).length };
}

export function collectMetrics({ root = projectRoot, files }) {
  const groups = new Map();
  const missing = [];
  for (const file of files) {
    if (!isCountedFile(file)) continue;
    let source;
    try { source = readFileSync(path.join(root, file), 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      missing.push(file);
      continue;
    }
    const counts = countLines(source);
    const directory = file.split('/')[0];
    const item = groups.get(directory) ?? { area: directory, files: 0, lines: 0, nonblank: 0 };
    item.files++;
    item.lines += counts.lines;
    item.nonblank += counts.nonblank;
    groups.set(directory, item);
  }
  const areas = [...groups.values()].sort((a, b) => a.area.localeCompare(b.area));
  const total = areas.reduce((sum, item) => ({
    files: sum.files + item.files,
    lines: sum.lines + item.lines,
    nonblank: sum.nonblank + item.nonblank,
  }), { files: 0, lines: 0, nonblank: 0 });
  return { areas, total, missing };
}

export function listTrackedFiles(root = projectRoot) {
  return execFileSync('git', ['ls-files', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }).split('\0').filter(Boolean);
}

export function buildReport({ root = projectRoot, files }) {
  return { definition, ...collectMetrics({ root, files }) };
}

function invokedAsCli() {
  if (!process.argv[1]) return false;
  const self = path.resolve(fileURLToPath(import.meta.url));
  const invoked = path.resolve(process.argv[1]);
  return process.platform === 'win32' ? self.toLowerCase() === invoked.toLowerCase() : self === invoked;
}

if (invokedAsCli()) {
  const report = buildReport({ files: listTrackedFiles() });
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    console.table(report.areas);
    console.info(`Total: ${report.total.files} archivos, ${report.total.lines} líneas físicas, ${report.total.nonblank} no vacías.`);
    console.info('Incluye comentarios. Excluye documentación, assets, lockfiles y declaraciones .d.ts.');
    if (report.missing.length) console.warn(`${report.missing.length} archivos rastreados ausentes; el total es incompleto.`);
  }
  if (report.missing.length) process.exitCode = 1;
}
