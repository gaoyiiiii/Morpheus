import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['assets/js/vendor/thought-graph-vendor.entry.js'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  sourcemap: false,
  target: ['es2020'],
  outfile: 'assets/js/vendor/thought-graph-vendor.js',
  logLevel: 'info',
});
