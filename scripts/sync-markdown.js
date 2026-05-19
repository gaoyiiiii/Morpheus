#!/usr/bin/env node
const path = require('path');
const {
  readJson,
  normalizeData,
  generateMarkdownMirror,
  generateWritingStudioMirror,
  normalizeMirrorDeltaHint,
  pickSourceJson,
} = require('./markdown-mirror-lib');

const root = process.cwd();
const source = pickSourceJson(root);
const mirrorDelta = (() => {
  const raw = String(process.env.MORPH_MIRROR_DELTA || '').trim();
  if (!raw) return null;
  try {
    return normalizeMirrorDeltaHint(JSON.parse(raw));
  } catch (_) {
    return null;
  }
})();

if (!source) {
  console.error('未找到 data/*.json 数据快照');
  process.exit(1);
}

const data = normalizeData(readJson(source));
const outDir = generateMarkdownMirror({
  rootDir: root,
  data,
  sourceLabel: path.relative(root, source),
  delta: mirrorDelta,
});
const writingDir = generateWritingStudioMirror({
  rootDir: root,
  data,
  sourceLabel: path.relative(root, source),
});

console.log(`Markdown 镜像已生成${mirrorDelta ? '（增量）' : ''}: ${path.relative(root, outDir)}`);
console.log(`写作工作室派生层已生成: ${path.relative(root, writingDir)}`);
