# Morpheus Public Release Tree

This tree is generated from the private development workspace.

It intentionally excludes personal data, sync mirrors, local caches, logs, build outputs, native mobile/watch/desktop clients, private plugin surfaces, device exports, and local credentials.

Recommended workflow:

1. Run `npm run public:export` in the private workspace.
2. Inspect the generated `dist/public-repo/morpheus-public-*` tree.
3. Sync to a separate GitHub repository with `MORPHEUS_PUBLIC_REPO=/path/to/public/repo npm run public:export:sync`.
4. Commit from the public repository, not from the private workspace.
