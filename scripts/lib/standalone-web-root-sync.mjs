import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(LIB_DIR, '..', '..');
export const DEFAULT_WEB_ROOT = path.join(PROJECT_ROOT, 'dist', 'Morpheus.app', 'Contents', 'Resources', 'www');

const MANIFEST = [
  { type: 'file', source: 'morph.html', target: 'morph.html', required: true },
  { type: 'file', source: 'space-embed.html', target: 'space-embed.html', required: false },
  { type: 'dir', source: 'assets', target: 'assets', required: true },
  { type: 'dir', source: 'extensions', target: 'extensions', required: true },
  { type: 'file', source: path.join('scripts', 'sync-markdown.js'), target: path.join('scripts', 'sync-markdown.js'), required: true },
  { type: 'file', source: path.join('scripts', 'import-markdown.js'), target: path.join('scripts', 'import-markdown.js'), required: true },
  { type: 'file', source: path.join('scripts', 'markdown-mirror-lib.js'), target: path.join('scripts', 'markdown-mirror-lib.js'), required: true },
];

function normalizeRel(relPath = '') {
  return String(relPath || '').split(path.sep).join('/');
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (_) {
    return false;
  }
}

async function readDirRecursive(rootPath, relPath = '') {
  const currentPath = relPath ? path.join(rootPath, relPath) : rootPath;
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const rows = [];
  for (const entry of entries) {
    const nextRel = relPath ? path.join(relPath, entry.name) : entry.name;
    if (entry.isDirectory()) {
      rows.push(...(await readDirRecursive(rootPath, nextRel)));
      continue;
    }
    if (!entry.isFile()) continue;
    rows.push(normalizeRel(nextRel));
  }
  rows.sort();
  return rows;
}

async function compareFile(sourcePath, targetPath) {
  const [sourceBuffer, targetBuffer] = await Promise.all([
    fs.readFile(sourcePath),
    fs.readFile(targetPath),
  ]);
  return sourceBuffer.equals(targetBuffer);
}

export async function collectStandaloneWebRootDrift(webRoot = DEFAULT_WEB_ROOT) {
  const drift = [];
  for (const entry of MANIFEST) {
    const sourcePath = path.join(PROJECT_ROOT, entry.source);
    const targetPath = path.join(webRoot, entry.target);
    const sourceExists = await pathExists(sourcePath);
    if (!sourceExists) {
      if (entry.required) {
        drift.push({
          type: 'missing-source',
          relPath: normalizeRel(entry.source),
          detail: 'required source entry is missing',
        });
      }
      if (await pathExists(targetPath)) {
        drift.push({
          type: 'stale-target',
          relPath: normalizeRel(entry.target),
          detail: 'target exists but source entry does not',
        });
      }
      continue;
    }
    const targetExists = await pathExists(targetPath);
    if (!targetExists) {
      drift.push({
        type: 'missing-target',
        relPath: normalizeRel(entry.target),
        detail: 'bundle entry is missing',
      });
      continue;
    }
    if (entry.type === 'file') {
      const same = await compareFile(sourcePath, targetPath);
      if (!same) {
        drift.push({
          type: 'file-mismatch',
          relPath: normalizeRel(entry.target),
          detail: 'file content differs',
        });
      }
      continue;
    }
    const [sourceFiles, targetFiles] = await Promise.all([
      readDirRecursive(sourcePath),
      readDirRecursive(targetPath),
    ]);
    const sourceSet = new Set(sourceFiles);
    const targetSet = new Set(targetFiles);
    for (const rel of sourceFiles) {
      if (!targetSet.has(rel)) {
        drift.push({
          type: 'missing-target',
          relPath: normalizeRel(path.join(entry.target, rel)),
          detail: 'bundle file is missing',
        });
      }
    }
    for (const rel of targetFiles) {
      if (!sourceSet.has(rel)) {
        drift.push({
          type: 'stale-target',
          relPath: normalizeRel(path.join(entry.target, rel)),
          detail: 'bundle has a stale file',
        });
      }
    }
    for (const rel of sourceFiles) {
      if (!targetSet.has(rel)) continue;
      const same = await compareFile(path.join(sourcePath, rel), path.join(targetPath, rel));
      if (!same) {
        drift.push({
          type: 'file-mismatch',
          relPath: normalizeRel(path.join(entry.target, rel)),
          detail: 'file content differs',
        });
      }
    }
  }
  return drift;
}

export async function syncStandaloneWebRoot(webRoot = DEFAULT_WEB_ROOT) {
  const exists = await pathExists(webRoot);
  if (!exists) {
    throw new Error(`Standalone web root not found: ${webRoot}`);
  }
  await fs.mkdir(path.join(webRoot, 'scripts'), { recursive: true });
  for (const entry of MANIFEST) {
    const sourcePath = path.join(PROJECT_ROOT, entry.source);
    const targetPath = path.join(webRoot, entry.target);
    const sourceExists = await pathExists(sourcePath);
    if (!sourceExists) {
      if (!entry.required) {
        await fs.rm(targetPath, { recursive: true, force: true });
        continue;
      }
      throw new Error(`Required source entry missing: ${sourcePath}`);
    }
    if (entry.type === 'dir') {
      await fs.rm(targetPath, { recursive: true, force: true });
      await fs.cp(sourcePath, targetPath, { recursive: true, force: true });
      continue;
    }
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }
}

export function parseWebRootArg(argv = []) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const flagIndex = args.findIndex((item) => item === '--app-path');
  if (flagIndex >= 0) {
    const raw = String(args[flagIndex + 1] || '').trim();
    if (!raw) {
      throw new Error('Missing value for --app-path');
    }
    const appPath = path.resolve(process.cwd(), raw);
    return path.join(appPath, 'Contents', 'Resources', 'www');
  }
  return DEFAULT_WEB_ROOT;
}

export function summarizeDrift(drift = [], limit = 20) {
  const items = Array.isArray(drift) ? drift : [];
  const head = items.slice(0, Math.max(1, Number(limit) || 20));
  return head.map((item) => `${item.type}: ${item.relPath} (${item.detail})`);
}
