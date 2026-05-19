---
name: morph-core
description: Read Morpheus state and call Morpheus Query / Action host contracts through the official Morpheus Core OpenClaw connector.
metadata: {"openclaw":{"requires":{"config":["plugins.entries.morph-core.enabled","plugins.entries.morph-core.config.baseUrl"]}}}
---

# Morpheus Core

Use this skill when the user wants OpenClaw to inspect or update Morpheus through its stable Query API and Action API.

This is Morpheus's phase-1 External Agent Skill identity. It is not a second action system: it must call Morpheus host contracts and let the host own permissions, boundaries, confirmation, receipts, and writes.

## Preferred flow

1. Start with `morph_capabilities` when you need to discover which Morpheus actions and endpoints are open in the current server.
2. If the connector appears misconfigured or unreachable, run `morph_diagnose_connection` before guessing.
3. Prefer `morph_action` as the default write path when you want the raw Morpheus Action Host v1 contract back, including `boundary / confirmation / verifier / receipt`.
   - For `confirm-required` actions, call `morph_action` with `surface: "manual"` first.
   - If the result comes back as `ok=false` with `errorCode=confirmation_required`, inspect the returned `confirmation / boundary / receipt`, then retry the same action with `confirmation.confirmed=true`.
4. Use collection read tools when you need bulk state:
   - `morph_projects`
   - `morph_reminders`
   - `morph_sops`
   - `morph_flash_thoughts`
   - `morph_daily`
5. Use `morph_summary` when you need a quick status snapshot.
6. Use `morph_entity` before updating an existing project, reminder, SOP, daily entry, or flash thought.
7. Convenience write tools remain available only as thin aliases for the most common low-risk writes:
   - `morph_create_flash_thought`
   - `morph_add_fixed_thought`
   - `morph_create_project`
   - `morph_append_project_block`
   - `morph_create_routine`
   - `morph_create_reminder`
   - `morph_add_project_reference`
   - `morph_append_daily_log`
8. Keep `actor`, `source`, and `requestId` stable when you can. Defaults are already provided by the plugin config.

## Rules

- Do not attempt destructive Morpheus actions. Phase 1 keeps delete, bulk overwrite, bulk archive, cross-domain bulk move, and secure vault mutation disabled.
- Do not assume every internal Morpheus action is open through this connector. Project status changes, reminder completion, SOP creation, and cross-entity linking still stay outside the default external boundary.
- Prefer Morpheus Action API over direct file writes or `/api/sync`.
- Prefer `morph_action` as the stable write contract; use convenience write tools only for repeated low-risk flows when their narrower payload shape is helpful.
- Convenience write tools do not own a second boundary policy. They forward to the same host action endpoint and should be read as aliases, not as a parallel action system.
- Treat `confirmation_required` as a structured host result, not as generic chat text. The retry should carry the same action plus explicit `confirmation`.
- If the user asks for a write that this plugin does not expose yet, explain that the Morpheus side has not opened that action safely.
