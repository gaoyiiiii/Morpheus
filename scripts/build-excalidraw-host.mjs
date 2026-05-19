import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'assets/js/excalidraw-host-entry.jsx');
const outdir = path.join(root, 'assets/vendor/excalidraw');

await fs.rm(outdir, { recursive: true, force: true });

await build({
  entryPoints: [entry],
  outdir,
  bundle: true,
  splitting: false,
  format: 'iife',
  platform: 'browser',
  target: ['es2018'],
  minify: true,
  sourcemap: false,
  jsx: 'automatic',
  legalComments: 'none',
  mainFields: ['browser', 'module', 'main'],
  conditions: ['production'],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  entryNames: '[name]',
  assetNames: 'assets/[name]-[hash]',
  loader: {
    '.css': 'css',
    '.gif': 'file',
    '.jpg': 'file',
    '.jpeg': 'file',
    '.png': 'file',
    '.svg': 'file',
    '.ttf': 'file',
    '.woff': 'file',
    '.woff2': 'file',
  },
});
