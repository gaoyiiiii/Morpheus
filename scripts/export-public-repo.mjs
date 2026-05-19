#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const stamp = process.env.MORPHEUS_PUBLIC_STAMP || new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
const defaultOut = path.join(root, 'dist', 'public-repo', `morpheus-public-${stamp}`);
const args = process.argv.slice(2);

function readArg(name, fallback = '') {
  const prefix = `${name}=`;
  const inline = args.find((item) => item.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const target = path.resolve(readArg('--target', process.env.MORPHEUS_PUBLIC_REPO || defaultOut));
const syncMode = args.includes('--sync') || process.env.MORPHEUS_PUBLIC_SYNC === '1';
const forceDelete = args.includes('--delete') || process.env.MORPHEUS_PUBLIC_DELETE === '1';
const checkOnly = args.includes('--check');

const excludedDirNames = new Set([
  '.git',
  '.github-private',
  '.claude',
  '.build-ios',
  '.cursor',
  '.derived',
  '.tmp',
  '.tmp-playwright',
  '.tmp-ui-sweep-backups',
  'tmp',
  'node_modules',
  'dist',
  'build',
  'DerivedData',
  'xcuserdata',
  'private-kernel',
  'recovery',
  'test-results',
  'librelink-mcp-server-main',
]);

const excludedPathPrefixes = [
  'data/',
  'morph_md_mirror/',
  'writing-studio/',
  'writing-studio/morph-derived/',
  'channel-ops-workspace/',
  'librelink-mcp-server-main/',
  'ios-app/',
  'watch-app/',
  'macos-app/',
  'ios-app/build/',
  '.build-ios/',
  'build/',
  'dist/',
  'dev/',
  'docs/',
  'examples/',
  'scripts/contracts/',
  'scripts/skills/',
  'scripts/writing/',
  'skills/',
  'morph-runtime/',
  'private-kernel/',
  'extensions/atlas/',
  'extensions/codex-remote-plugin/',
  'extensions/example-plugin/',
  'extensions/expense-ledger-plugin/',
  'extensions/jcring-plugin/',
  'extensions/local-packages/',
  'extensions/pomodoro-plugin/',
  'extensions/sop-plugin/',
  'extensions/visual-organizer-plugin/',
  'extensions/wechat-article-formatter/',
];

const allowedDataFiles = new Set([
  'data/README.md',
  'data/codex-remote.config.example.json',
  'data/morph-owner-loop.config.example.json',
  'data/morph-owner-loop-monitor.config.example.json',
  'data/proactive-agent.config.example.json',
]);

const allowedDocsFiles = new Set([
  'docs/morph-public-release-workflow.md',
]);

const allowedRuntimeFiles = new Set([
  'morph-runtime/action-boundaries.json',
  'morph-runtime/action-contract.json',
  'morph-runtime/action-policy.json',
  'morph-runtime/action-registry.json',
  'morph-runtime/context-rules.json',
  'morph-runtime/memory-rules.md',
  'morph-runtime/skills.json',
]);

const excludedBasenames = new Set([
  '.DS_Store',
  '.env',
  '.env.local',
  '.env.production',
  '.npmrc',
  'local-manifest.json',
  'optional-plugins.catalog.json',
]);

const excludedExtensions = new Set([
  '.dmg',
  '.zip',
  '.log',
  '.sqlite',
  '.sqlite3',
  '.sqlite-shm',
  '.sqlite-wal',
  '.sqlite3-shm',
  '.sqlite3-wal',
  '.xcuserstate',
  '.mobileprovision',
]);

const excludedRuntimeFiles = new Set([
  'assets/js/atlas-plugin-runtime.js',
  'assets/js/codex-remote-bootstrap-runtime.js',
  'assets/js/ai-chat-recovery-runtime.js',
  'assets/js/expense-ledger-analytics-runtime.js',
  'assets/js/expense-ledger-content-runtime.js',
  'assets/js/expense-ledger-draft-runtime.js',
  'assets/js/expense-ledger-host-runtime.js',
  'assets/js/expense-ledger-import-runtime.js',
  'assets/js/expense-ledger-mutation-runtime.js',
  'assets/js/expense-ledger-render-runtime.js',
  'assets/js/expense-ledger-view-runtime.js',
  'assets/js/local-plugin-codex-remote-runtime.js',
  'assets/js/sop-codec-runtime.js',
  'assets/js/wechat-article-formatter-runtime.js',
  'scripts/morph-cli.js',
  'scripts/legacy/archive-writing-studio.js',
]);

const publicGeneratedFiles = new Map([
  ['README.md', `# Morpheus

Morpheus is a local-first personal operating workspace.

This public tree is the Web-only public client generated from the private development workspace. It excludes personal data, private sync mirrors, local credentials, native mobile/watch/desktop clients, device exports, and internal-only plugin surfaces.

## Local Run

\`\`\`bash
npm install
npm run build
npm start
\`\`\`

Then open:

\`\`\`text
http://127.0.0.1:2199/
\`\`\`

## Public Release Workflow

See [docs/morph-public-release-workflow.md](docs/morph-public-release-workflow.md).
`],
  ['PUBLIC_RELEASE.md', `# Morpheus Public Release Tree

This tree is generated from the private development workspace.

It intentionally excludes personal data, sync mirrors, local caches, logs, build outputs, native mobile/watch/desktop clients, private plugin surfaces, device exports, and local credentials.

Recommended workflow:

1. Run \`npm run public:export\` in the private workspace.
2. Inspect the generated \`dist/public-repo/morpheus-public-*\` tree.
3. Sync to a separate GitHub repository with \`MORPHEUS_PUBLIC_REPO=/path/to/public/repo npm run public:export:sync\`.
4. Commit from the public repository, not from the private workspace.
`],
  ['.env.example', `# Morpheus public example environment
HOST=127.0.0.1
PORT=2199
`],
]);

const secretPatterns = [
  { name: 'OpenAI-style API key', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'GitHub token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g },
  { name: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: 'Bearer token', regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{30,}\b/g },
  { name: 'private absolute user path', regex: /\/Users\/yiiiii\/(?:Library|Desktop|Downloads|Documents|\.codex|Morpheus|lianOS_web)/g },
  { name: 'iCloud container path', regex: /Mobile Documents\/com~apple~CloudDocs\/Morph/g },
];

function toRel(abs) {
  return path.relative(root, abs).split(path.sep).join('/');
}

function shouldSkip(rel, dirent) {
  if (!rel) return false;
  const base = path.basename(rel);
  if (excludedBasenames.has(base)) return true;
  if (base.startsWith('.tmp')) return true;
  if (/^tmp[_-]/i.test(base)) return true;
  if (/^docs-skills-/i.test(base)) return true;
  if (dirent?.isDirectory?.() && excludedDirNames.has(base)) return true;
  if (allowedDataFiles.has(rel)) return false;
  if (allowedDocsFiles.has(rel)) return false;
  if (allowedRuntimeFiles.has(rel)) return false;
  if (base === 'README.md' && rel !== 'README.md') return true;
  if (rel.startsWith('docs/')) return true;
  if (rel.startsWith('morph-runtime/')) return true;
  if (excludedRuntimeFiles.has(rel)) return true;
  if (excludedPathPrefixes.some((prefix) => rel === prefix.slice(0, -1) || rel.startsWith(prefix))) return true;
  if (rel.startsWith('data/') && !allowedDataFiles.has(rel)) return true;
  if (/\.(?:bak|backup|tmp|ndjson|out|err|map)$/i.test(base)) return true;
  if (excludedExtensions.has(path.extname(base))) return true;
  if (/localstorage|bootstrap-cache|device-|live-data/i.test(rel) && !allowedDataFiles.has(rel)) return true;
  if (/secret|token|credential|apikey|api-key/i.test(rel) && !rel.endsWith('.example.json')) return true;
  return false;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  const mode = fs.statSync(src).mode;
  fs.chmodSync(dest, mode);
}

function walkCopy(srcDir, destDir, copied = []) {
  for (const dirent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, dirent.name);
    const rel = toRel(src);
    if (shouldSkip(rel, dirent)) continue;
    const dest = path.join(destDir, rel);
    if (dirent.isDirectory()) {
      walkCopy(src, destDir, copied);
    } else if (dirent.isFile()) {
      copyFile(src, dest);
      copied.push(rel);
    }
  }
  return copied;
}

function removeManagedTargetContents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

function writeGeneratedFiles(destDir) {
  for (const [rel, content] of publicGeneratedFiles) {
    const abs = path.join(destDir, rel);
    ensureDir(path.dirname(abs));
    fs.writeFileSync(abs, content, 'utf8');
  }
}

function sanitizePackageJson(destDir) {
  const packageFile = path.join(destDir, 'package.json');
  if (!fs.existsSync(packageFile)) return;
  const parsed = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  parsed.private = false;
  parsed.scripts = {
    'build:css': 'npx tailwindcss -i assets/styles/app.tailwind.input.css -o assets/styles/app.compiled.css',
    'build:excalidraw-host': 'node scripts/build-excalidraw-host.mjs',
    'build:thought-graph-vendor': 'node scripts/build-thought-graph-vendor.mjs',
    build: 'npm run build:css && npm run build:excalidraw-host && npm run build:thought-graph-vendor',
    start: 'node server.js',
    dev: 'npm run build:css && node server.js',
    'web:package:runtime': 'bash scripts/package-web-runtime-release.sh',
  };
  fs.writeFileSync(packageFile, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
}

function writePublicConnectorStubs(destDir) {
  const stubs = new Map([
    ['scripts/connectors/atlas-store.js', `function createAtlasStore() {
  return {
    listTopics() { return []; },
    getTopic() { return null; },
    saveTopic() { return { ok: false, error: 'atlas_disabled_in_public_build' }; },
  };
}

module.exports = { createAtlasStore };
`],
    ['scripts/connectors/atlas-api.js', `function handleAtlasApiRequest(_req, res) {
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'atlas_disabled_in_public_build' }));
  return true;
}

module.exports = { handleAtlasApiRequest };
`],
    ['scripts/connectors/codex-remote-api.js', `function handleCodexRemoteApiRequest(_req, res) {
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'codex_remote_disabled_in_public_build' }));
  return true;
}

module.exports = { handleCodexRemoteApiRequest };
`],
  ]);
  for (const [rel, content] of stubs) {
    const abs = path.join(destDir, rel);
    ensureDir(path.dirname(abs));
    fs.writeFileSync(abs, content, 'utf8');
  }
}

function readTextMaybe(file) {
  const stat = fs.statSync(file);
  if (stat.size > 2_000_000) return null;
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) return null;
  return buffer.toString('utf8');
}

function scanTree(destDir) {
  const issues = [];
  const forbiddenPathFragments = [
    '.tmp',
    'test-results',
    'recovery',
    'morph_md_mirror',
    'private-kernel',
    'bootstrap-cache',
    'localstorage',
    'live-data.json',
    'flash-thoughts-backup',
    'ai-chat-sessions',
    'daily-months',
    'expense-ledger',
    'librelink-mcp-server-main',
    'ios-app',
    'watch-app',
    'macos-app',
    'writing-studio',
    'scripts/skills',
    'scripts/writing',
    'jcring-plugin',
    'sop-plugin',
    'codex-remote-plugin',
    'wechat-article-formatter',
    'atlas-plugin-runtime.js',
    'local-plugin-codex-remote-runtime.js',
  ];

  function visit(dir) {
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, dirent.name);
      const rel = path.relative(destDir, abs).split(path.sep).join('/');
      if (forbiddenPathFragments.some((fragment) => rel.includes(fragment))) {
        issues.push({ rel, reason: 'forbidden public path fragment' });
      }
      if (dirent.isDirectory()) {
        if (dirent.name !== '.git') visit(abs);
        continue;
      }
      if (!dirent.isFile()) continue;
      const text = readTextMaybe(abs);
      if (!text) continue;
      for (const pattern of secretPatterns) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(text)) {
          issues.push({ rel, reason: pattern.name });
        }
      }
    }
  }

  visit(destDir);
  return issues;
}

function main() {
  if (!fs.existsSync(path.join(root, 'morph.html')) || !fs.existsSync(path.join(root, 'package.json'))) {
    throw new Error(`Resolved root does not look like the Morpheus workspace: ${root}`);
  }
  if (target === root || target.startsWith(`${root}${path.sep}`) && !target.includes(`${path.sep}dist${path.sep}public-repo${path.sep}`)) {
    throw new Error(`Refusing to export over the private workspace: ${target}`);
  }
  if (checkOnly && !fs.existsSync(target)) {
    throw new Error(`Check target does not exist: ${target}`);
  }
  if (!checkOnly) {
    if (fs.existsSync(target) && syncMode && !forceDelete) {
      throw new Error('Target exists. Re-run with --delete or MORPHEUS_PUBLIC_DELETE=1 to replace non-.git contents.');
    }
    if (fs.existsSync(target) && forceDelete) removeManagedTargetContents(target);
    ensureDir(target);
    const copied = walkCopy(root, target);
    writeGeneratedFiles(target);
    sanitizePackageJson(target);
    writePublicConnectorStubs(target);
    console.log(`[morpheus:public-export] copied ${copied.length} files to ${target}`);
  }
  const issues = scanTree(target);
  if (issues.length) {
    console.error('[morpheus:public-export] public export scan failed:');
    for (const issue of issues.slice(0, 80)) {
      console.error(`- ${issue.rel}: ${issue.reason}`);
    }
    if (issues.length > 80) console.error(`... ${issues.length - 80} more`);
    process.exit(1);
  }
  console.log(`[morpheus:public-export] scan passed: ${target}`);
}

try {
  main();
} catch (error) {
  console.error(`[morpheus:public-export] ERROR: ${error.message}`);
  process.exit(1);
}
