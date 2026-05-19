import {
  collectStandaloneWebRootDrift,
  parseWebRootArg,
  summarizeDrift,
  syncStandaloneWebRoot,
} from './lib/standalone-web-root-sync.mjs';

async function main() {
  const webRoot = parseWebRootArg(process.argv);
  const before = await collectStandaloneWebRootDrift(webRoot);
  if (!before.length) {
    console.log(`[dist:web:sync] Already in sync ${webRoot}`);
    return;
  }
  console.log(`[dist:web:sync] Syncing ${webRoot}`);
  summarizeDrift(before, 20).forEach((line) => {
    console.log(`- ${line}`);
  });
  if (before.length > 20) {
    console.log(`- ...and ${before.length - 20} more`);
  }
  await syncStandaloneWebRoot(webRoot);
  const after = await collectStandaloneWebRootDrift(webRoot);
  if (after.length) {
    console.error(`[dist:web:sync] Sync finished but drift remains in ${webRoot}`);
    summarizeDrift(after, 40).forEach((line) => {
      console.error(`- ${line}`);
    });
    process.exitCode = 1;
    return;
  }
  console.log(`[dist:web:sync] Synced ${webRoot}`);
}

main().catch((error) => {
  console.error(`[dist:web:sync] ${error && error.stack ? error.stack : String(error)}`);
  process.exit(1);
});
