import {
  collectStandaloneWebRootDrift,
  parseWebRootArg,
  summarizeDrift,
} from './lib/standalone-web-root-sync.mjs';

async function main() {
  const webRoot = parseWebRootArg(process.argv);
  const drift = await collectStandaloneWebRootDrift(webRoot);
  if (!drift.length) {
    console.log(`[dist:web:check] OK ${webRoot}`);
    return;
  }
  console.error(`[dist:web:check] Drift detected in ${webRoot}`);
  summarizeDrift(drift, 40).forEach((line) => {
    console.error(`- ${line}`);
  });
  if (drift.length > 40) {
    console.error(`- ...and ${drift.length - 40} more`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[dist:web:check] ${error && error.stack ? error.stack : String(error)}`);
  process.exit(1);
});
