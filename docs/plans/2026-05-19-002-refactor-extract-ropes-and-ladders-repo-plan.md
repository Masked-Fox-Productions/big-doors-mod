---
title: "refactor: Extract ropes-and-ladders into a standalone repo"
type: refactor
status: completed
date: 2026-05-19
origin: docs/brainstorms/2026-05-17-ropes-and-whips-requirements.md
---

# Extract ropes-and-ladders into a standalone repo

## Overview

The ropes, rope ladders, and whip functionality was developed inside big-doors-mod following the same architecture, but was always intended as a separate mod. This plan extracts all rope code into a new `Masked-Fox-Productions/ropes-and-ladders` GitHub repo created from the `minecraft-mod-template` template, then cleans up big-doors-mod so it contains only hinge/winch/door-panel functionality.

## Problem Frame

Two unrelated mods share a repo, complicating releases, manifests, and independent versioning. The rope code already uses a separate `ropes:` namespace, a separate `RopeManager`, and separate persistence — the coupling is minimal by design (see origin: `docs/brainstorms/2026-05-17-ropes-and-whips-requirements.md`, R1/R2 on separation).

## Requirements Trace

- R1. Create a new GitHub repo `Masked-Fox-Productions/ropes-and-ladders` from the `minecraft-mod-template` template
- R2. All rope, rope ladder, and whip code, assets, tests, and docs live in the new repo and pass tests
- R3. big-doors-mod retains only hinge, winch, and door-panel functionality and passes tests
- R4. The one code coupling point (`DIR_OFFSETS` import) is resolved
- R5. API versions in the new repo are bumped to match the rope code's requirements (`@minecraft/server` 2.7.0, `min_engine_version` 1.26.0)
- R6. Java/Fabric scaffolding is kept in the new repo for future parity

## Scope Boundaries

- No new features — this is a pure extraction
- No crafting recipes (deferred in origin doc)
- No Java rope implementation (Java scaffolding stays empty)
- No changes to rope gameplay logic — files are moved, not rewritten
- No CI/CD setup beyond what the template provides

## Context & Research

### Relevant Code and Patterns

**Rope code (self-contained under `bigdoors_bp/scripts/ropes/`):**
- `ropes/init.js` — wiring function, returns `{ interaction, breakHandler }` to `main.js`
- `ropes/RopeManager.js` — persistence, position index, chain CRUD
- `ropes/domain/RopeChain.js` — pure-JS domain model
- `ropes/handler/RopePlacementHandler.js`, `RopeInteractionHandler.js`, `RopeBreakHandler.js`
- `ropes/subsystem/WhipSubsystem.js`, `ClimbableSubsystem.js`
- `ropes/util/RopeConstants.js`, `ropePosKey.js`

**Single coupling point:** `RopeInteractionHandler.js` line 3 imports `DIR_OFFSETS` from `../../util/Constants.js` — a 6-entry directional offset map (4 cardinal + up/down). This is the only import from door code.

**Template structure:** `minecraft-mod-template` provides `mymod_bp/`, `mymod_rp/`, `java-mymod/`, test infrastructure, CI workflows, and a `scripts/setup.js` that replaces all `mymod`/`My Mod`/`com.mymod` placeholders and generates fresh UUIDs.

**Resource pack entries to split:**
- `terrain_texture.json` lines 380-394: 5 `ropes_*` entries (extract to new repo)
- `item_texture.json`: entirely rope content (move wholesale)
- `en_US.lang` lines 10-14: 5 rope/whip strings (extract to new repo)
- `bigdoors_rp/textures/blocks/winch_front.png` and `winch_side.png` in terrain_texture.json lines 395-400 stay in big-doors-mod

### Institutional Learnings

No `docs/solutions/` directory exists yet.

## Key Technical Decisions

- **Use `gh repo create --template` to create the repo:** The template is a GitHub template repo in the Masked Fox Productions org. Using `gh` avoids manual GitHub UI steps and creates the repo in the right org.
- **Run `setup.js` before copying rope files:** The setup script handles placeholder replacement and UUID generation. Running it first gives a clean slate with correct namespacing before rope files are overlaid.
- **Copy `DIR_OFFSETS` into `RopeConstants.js` rather than creating a shared package:** The value is 8 lines of trivial data. A shared dependency between two independent mods would create coupling worse than the duplication.
- **Flatten `scripts/ropes/` into `scripts/` in the new repo:** In big-doors-mod, rope code lived under a `ropes/` subdirectory because it was a guest. In its own repo, it should use the standard layout: `scripts/domain/`, `scripts/handler/`, `scripts/subsystem/`, `scripts/util/`.
- **Bump Bedrock API versions:** The template ships with `@minecraft/server` 1.12.0 / `min_engine_version` 1.20.0. The rope code uses APIs from 2.7.0 / 1.26.0, so manifests must be updated.

## Open Questions

### Resolved During Planning

- **Should Java scaffolding be kept?** Yes — user confirmed. Keep empty Fabric project for future parity.
- **Should `item_texture.json` be deleted from big-doors-mod?** Yes — it contains only rope entries. big-doors-mod has no items.

### Deferred to Implementation

- **Exact CLAUDE.md content for the new repo:** The template provides a skeleton; content should be adapted from big-doors-mod's CLAUDE.md with rope-specific details.
- **Whether `tests/helpers/mock-dimension.mjs` is needed by rope tests:** No — only door tests (BreakHandler, InteractionHandler, HingePlacementHandler) import it. Do not copy to the new repo.

## Implementation Units

- [ ] **Unit 1: Create repo from template and run setup**

  **Goal:** A new `Masked-Fox-Productions/ropes-and-ladders` repo exists at `C:\Projects\ropes-and-ladders` with all placeholders replaced.

  **Requirements:** R1

  **Dependencies:** None

  **Files:**
  - Create: `C:\Projects\ropes-and-ladders` (entire repo)

  **Approach:**
  - Run `gh repo create Masked-Fox-Productions/ropes-and-ladders --template Masked-Fox-Productions/minecraft-mod-template --clone --public` **from `C:\Projects`** so the clone lands at `C:\Projects\ropes-and-ladders`
  - Run `node scripts/setup.js --name "Ropes and Ladders" --id ropes --group com.ropes --author "Aaron Pogue"` inside the new repo
  - Manually rename pack directories: `mymod_bp` → `ropes_bp`, `mymod_rp` → `ropes_rp`
  - Manually rename Java directory: `java-mymod` → `java-ropes`
  - Inside `java-ropes`, rename Java package directories and files (`setup.js` replaces file contents only — paths are manual):
    - `src/main/java/com/mymod/` → `src/main/java/com/ropes/`
    - `src/test/java/com/mymod/` → `src/test/java/com/ropes/`
    - `src/main/java/com/ropes/MymodMod.java` → `RopesMod.java`
    - `src/main/java/com/ropes/client/MymodModClient.java` → `RopesModClient.java`
    - `src/main/resources/mymod.mixins.json` → `ropes.mixins.json`
  - Bump `ropes_bp/manifest.json` to `@minecraft/server` 2.7.0 and `min_engine_version` 1.26.0

  **Patterns to follow:**
  - Template's `SETUP.md` documents the full setup flow

  **Test scenarios:**
  - Happy path: `npm test` passes in the new repo (template's example test should still work after setup)
  - Happy path: `cd java-ropes && ./gradlew build` passes after all renames

  **Verification:**
  - Repo exists on GitHub under `Masked-Fox-Productions/ropes-and-ladders`
  - Local clone at `C:\Projects\ropes-and-ladders` has no `mymod` references remaining in file contents or directory/file names
  - Both `ropes_bp/manifest.json` and `ropes_rp/manifest.json` have fresh UUIDs distinct from all bigdoors manifest UUIDs, and correct API versions
  - `cd java-ropes && ./gradlew build` passes (validates R6 Java scaffolding — confirms package paths, class names, and mixin config are all consistent)

- [ ] **Unit 2: Copy rope scripts and flatten directory structure**

  **Goal:** All rope scripts live in the new repo under the standard `scripts/` layout with corrected import paths.

  **Requirements:** R2, R4

  **Dependencies:** Unit 1

  **Files:**
  - Create: `ropes_bp/scripts/domain/RopeChain.js` (from `bigdoors_bp/scripts/ropes/domain/RopeChain.js`)
  - Create: `ropes_bp/scripts/handler/RopePlacementHandler.js`
  - Create: `ropes_bp/scripts/handler/RopeInteractionHandler.js`
  - Create: `ropes_bp/scripts/handler/RopeBreakHandler.js`
  - Create: `ropes_bp/scripts/subsystem/WhipSubsystem.js`
  - Create: `ropes_bp/scripts/subsystem/ClimbableSubsystem.js`
  - Create: `ropes_bp/scripts/util/RopeConstants.js`
  - Create: `ropes_bp/scripts/util/ropePosKey.js`
  - Create: `ropes_bp/scripts/RopeManager.js`
  - Modify: `ropes_bp/scripts/util/RopeConstants.js` (add `DIR_OFFSETS`)
  - Modify: `ropes_bp/scripts/handler/RopeInteractionHandler.js` (fix `DIR_OFFSETS` import path)
  - Delete: template placeholder files (`scripts/domain/Example.js`, `scripts/util/Constants.js`, `tests/Example.test.mjs`)

  **Approach:**
  - Copy all files from `bigdoors_bp/scripts/ropes/` into the flattened structure, except `init.js` (handled in Unit 3)
  - Add `DIR_OFFSETS` to `RopeConstants.js` (8 lines — 6 entries for north/south/east/west/up/down + braces)
  - Update `RopeInteractionHandler.js` import from `../../util/Constants.js` to `../util/RopeConstants.js`
  - The internal directory structure (`domain/`, `handler/`, `subsystem/`, `util/`) is preserved during flattening, so most relative imports remain unchanged. The only import that truly changes is the `DIR_OFFSETS` import above. After copying, verify all imports resolve by running tests.
  - Delete template placeholder domain/constants files

  **Patterns to follow:**
  - big-doors-mod's `scripts/` directory structure (domain/, handler/, subsystem/, util/)

  **Test scenarios:**
  - Happy path: all import paths resolve correctly (verified when tests run in Unit 4)
  - Edge case: `DIR_OFFSETS` values in new repo match original exactly

  **Verification:**
  - No import references to `../../util/Constants.js` or `../ropes/` paths remain
  - `DIR_OFFSETS` is defined in `RopeConstants.js`

- [ ] **Unit 3: Build the new repo's main.js and init.js**

  **Goal:** The new repo's entry point wires up RopeManager, block components, persistence, and subsystems.

  **Requirements:** R2

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `ropes_bp/scripts/main.js` (rewrite from template skeleton)
  - Create: `ropes_bp/scripts/init.js` (adapted from `bigdoors_bp/scripts/ropes/init.js`)

  **Approach:**
  - Build `main.js` with the same startup pattern as big-doors-mod:
    - In `beforeEvents.startup`: register `ropes:rope_component` (onPlayerInteract, onPlayerBreak, beforeOnPlayerPlace) and `ropes:rope_ladder_component` (same callbacks)
    - Instantiate `RopeManager`
    - Wire `worldLoad` + `system.run` fallback for `ropeManager.load()`
    - Call `initRopes(ropeManager)` and capture `{ interaction, breakHandler }` for the component callbacks
  - Change log prefix from `[bigdoors]` to `[ropes]`
  - Adapt `init.js` from existing `ropes/init.js` with updated import paths. `init.js` returns `{ interaction, breakHandler }` to `main.js` (same pattern as big-doors-mod). `main.js` exports `ropeManager`.

  **Patterns to follow:**
  - big-doors-mod's `main.js` startup order: components in `beforeEvents.startup`, manager instantiation, worldLoad + fallback persistence, handler registration

  **Test scenarios:**
  - Happy path: module loads without import errors (verified when tests run in Unit 4)

  **Verification:**
  - `main.js` imports only from local `./` paths, never from `bigdoors` or `../../`
  - Startup order matches the architecture convention

- [ ] **Unit 4: Copy block/item JSON, resource pack assets, and tests**

  **Goal:** All rope content files (blocks, items, geometry, textures, lang strings) and tests are in the new repo and tests pass.

  **Requirements:** R2, R5

  **Dependencies:** Unit 2, Unit 3

  **Files:**
  - Create: `ropes_bp/blocks/rope.json`, `ropes_bp/blocks/rope_ladder.json`
  - Create: `ropes_bp/items/rope.json`, `ropes_bp/items/rope_ladder.json`, `ropes_bp/items/whip.json`
  - Create: `ropes_rp/models/blocks/rope.geo.json`, `rope_ladder.geo.json`, `rope_wall.geo.json`
  - Create: `ropes_rp/textures/blocks/rope_segment.png`, `rope_coil.png`, `rope_ladder_segment.png`, `rope_ladder_coil.png`, `whip_handle.png`
  - Create: `ropes_rp/textures/items/rope.png`, `rope_ladder.png`, `whip.png`
  - Create: `ropes_rp/textures/terrain_texture.json` (5 `ropes_*` entries only)
  - Create: `ropes_rp/textures/item_texture.json` (3 rope item entries)
  - Modify: `ropes_rp/texts/en_US.lang` (rope/whip strings)
  - Create: `tests/ClimbableSubsystem.test.mjs`, `RopeBreakHandler.test.mjs`, `RopeChain.test.mjs`, `RopeInteractionHandler.test.mjs`, `RopeManager.test.mjs`, `RopePlacementHandler.test.mjs`, `WhipSubsystem.test.mjs`
  - Copy: `tests/stubs/minecraft-server.mjs`, `tests/hooks.mjs`, `tests/register-hooks.mjs` (if template versions differ from big-doors-mod's)

  **Approach:**
  - Copy block/item JSON wholesale — they already use `ropes:` namespace
  - Copy geometry and texture files as binary copies
  - Build `terrain_texture.json` with `resource_pack_name: "ropes"` and only the 5 rope entries
  - Build `item_texture.json` from scratch with `resource_pack_name: "ropes"` and 3 rope item entries (do not copy big-doors-mod's version wholesale — it has `resource_pack_name: "bigdoors"`)
  - Replace `en_US.lang` with the 5 rope/whip strings from big-doors-mod's lang file
  - Copy all 7 rope test files. Update import paths: `../bigdoors_bp/scripts/ropes/X` becomes `../ropes_bp/scripts/X` (the `ropes/` segment drops because the code is flattened into the top-level scripts directory). Grep for any remaining `bigdoors_bp` references and fix.
  - Ensure test stubs match (compare template's stubs with big-doors-mod's — the big-doors-mod version may have features the rope tests depend on)

  **Patterns to follow:**
  - big-doors-mod's `terrain_texture.json` structure
  - Existing test file import patterns

  **Test scenarios:**
  - Happy path: `npm test` passes in the new repo — all 7 rope test files run green
  - Edge case: test stubs export all symbols that rope tests use (`__setWorld`, `__setSystem`, `__reset`, etc.)

  **Verification:**
  - `npm test` passes with all 7 test files
  - No references to `bigdoors` namespace in any rope content file
  - Grep block JSON files for `minecraft:custom_components` entries and confirm each has a matching `registerCustomComponent` call in `main.js`

- [ ] **Unit 5: Update CLAUDE.md and docs in the new repo**

  **Goal:** The new repo has accurate project documentation.

  **Requirements:** R2

  **Dependencies:** Unit 4

  **Files:**
  - Modify: `CLAUDE.md` in new repo
  - Delete: template `SETUP.md` and `scripts/setup.js`
  - Modify: `docs/parity-checklist.md` (rope features only)

  **Approach:**
  - Adapt CLAUDE.md from big-doors-mod's version, replacing big-doors references with ropes-and-ladders specifics
  - Keep the same architecture sections (domain/subsystem/handler layers, startup order, persistence, conventions)
  - Update block IDs, namespace references, and file paths
  - Update parity checklist to track only rope/ladder/whip features
  - Remove setup.js and SETUP.md (setup is complete)

  **Test expectation:** none -- documentation-only changes

  **Verification:**
  - CLAUDE.md accurately describes the ropes repo's architecture
  - No references to `bigdoors` namespace or door functionality

- [ ] **Unit 6: Clean up big-doors-mod — remove rope code**

  **Goal:** big-doors-mod contains only hinge/winch/door-panel functionality and passes tests.

  **Requirements:** R3

  **Dependencies:** Unit 4 (new repo tests pass before we delete from source)

  **Files:**
  - Modify: `bigdoors_bp/scripts/main.js` (remove rope imports, registrations, lifecycle)
  - Delete: `bigdoors_bp/scripts/ropes/` (entire directory)
  - Delete: `bigdoors_bp/blocks/rope.json`, `bigdoors_bp/blocks/rope_ladder.json`
  - Delete: `bigdoors_bp/items/` (entire directory — only contained rope items)
  - Delete: `bigdoors_rp/models/blocks/rope.geo.json`, `rope_ladder.geo.json`, `rope_wall.geo.json`
  - Delete: `bigdoors_rp/textures/blocks/rope_segment.png`, `rope_coil.png`, `rope_ladder_segment.png`, `rope_ladder_coil.png`, `whip_handle.png`
  - Delete: `bigdoors_rp/textures/items/` (entire directory — only contained rope textures)
  - Delete: `bigdoors_rp/textures/item_texture.json`
  - Modify: `bigdoors_rp/textures/terrain_texture.json` (remove 5 `ropes_*` entries)
  - Modify: `bigdoors_rp/texts/en_US.lang` (remove lines 10-14)
  - Delete: `tests/ClimbableSubsystem.test.mjs`, `RopeBreakHandler.test.mjs`, `RopeChain.test.mjs`, `RopeInteractionHandler.test.mjs`, `RopeManager.test.mjs`, `RopePlacementHandler.test.mjs`, `WhipSubsystem.test.mjs`
  - Modify: `docs/parity-checklist.md` (remove rope references)
  - Copy to new repo then delete: `docs/brainstorms/2026-05-17-ropes-and-whips-requirements.md`
  - Copy to new repo then delete: `docs/plans/2026-05-18-002-feat-ropes-rope-ladders-whips-plan.md`
  - Modify: `README.md` (add migration note warning that rope functionality has moved to a separate mod)

  **Approach:**
  - In `main.js`, remove all rope-related code:
    - Rope imports (`RopeManager`, `initRopes`, `ROPE_BLOCK_ID`, `ROPE_LADDER_BLOCK_ID`)
    - Rope handler variable declarations (`ropeManager`, `ropeInteraction`, `ropeBreak`)
    - Rope component registrations (`ropes:rope_component`, `ropes:rope_ladder_component`) from the `beforeEvents.startup` subscriber
    - `ropeManager = new RopeManager()` instantiation
    - `ropeManager.load()` calls from both the `worldLoad` subscriber and the `system.run` fallback
    - `initRopes(ropeManager)` call and its result destructuring
    - `ropeManager` from the module export (keep `export { manager }` only)
  - Delete all rope files and directories
  - Remove rope entries from shared resource pack files
  - Remove rope tests
  - Clean up parity checklist
  - Add a migration note to `README.md` warning players that rope, rope ladder, and whip functionality has moved to the separate `ropes-and-ladders` mod. Players must install both mods when updating.

  **Patterns to follow:**
  - The remaining `main.js` should contain only bigdoors imports, door component registrations, DoorManager lifecycle, and door handler registration. Grep for `rope` to confirm nothing remains.

  **Test scenarios:**
  - Happy path: `npm test` passes in big-doors-mod with only door tests remaining
  - Edge case: no dangling imports — grep for `ropes` in scripts/ returns zero results
  - Integration: door functionality is unaffected — existing door tests all pass

  **Verification:**
  - `npm test` passes
  - No files under `bigdoors_bp/`, `bigdoors_rp/`, or `tests/` reference the `ropes` namespace (docs/plans may still mention ropes — that's expected)
  - `main.js` only wires up door components

- [ ] **Unit 7: Initial commit and push for the new repo**

  **Goal:** The new repo has a clean initial commit with all rope content and passes CI.

  **Requirements:** R1, R2

  **Dependencies:** Unit 5

  **Files:**
  - All files in `C:\Projects\ropes-and-ladders`

  **Approach:**
  - Stage all files, commit with a descriptive message
  - Push to `main` on `Masked-Fox-Productions/ropes-and-ladders`
  - Verify GitHub Actions CI runs (test-bedrock.yml, test-java.yml)

  **Test expectation:** none -- commit/push operation. CI validates.

  **Verification:**
  - GitHub repo has the initial commit
  - CI workflows pass (Bedrock tests green, Java tests green with scaffolding)

## System-Wide Impact

- **Interaction graph:** `main.js` in both repos is rewritten. No cross-repo runtime dependencies. The two mods can be installed independently in Minecraft.
- **Error propagation:** No change — each mod has its own manager and persistence key.
- **State lifecycle risks:** Persistence keys are already separate (`bigdoors:state` vs `ropes:state`). No risk of data corruption.
- **API surface parity:** The `ropes:` block namespace, component names, and persistence format are unchanged. Worlds with existing rope builds should work with the extracted mod.
- **Unchanged invariants:** Door functionality (hinges, winches, panels, redstone) is completely untouched in behavior. The only changes to big-doors-mod are deletions.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Test stubs in template may be older than big-doors-mod's stubs | Compare stubs before copying; use big-doors-mod's version if it has features rope tests depend on |
| Import path errors after flattening `scripts/ropes/` to `scripts/` | All 7 test files must pass before proceeding to cleanup |
| Existing worlds with both mods installed | Both mods can coexist — different namespaces, different persistence keys, no conflicts. However, the old big-doors-mod (pre-extraction) and new ropes-and-ladders cannot run simultaneously (duplicate component registration). Players must update big-doors-mod and install ropes-and-ladders at the same time. |
| Template API version mismatch | Explicitly bump in Unit 1 before copying rope code |
| Players updating big-doors-mod without installing ropes-and-ladders | Existing rope blocks become unknown blocks. Add a migration note to big-doors-mod's changelog warning that rope functionality has moved to a separate mod. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-17-ropes-and-whips-requirements.md](docs/brainstorms/2026-05-17-ropes-and-whips-requirements.md)
- **Original implementation plan:** [docs/plans/2026-05-18-002-feat-ropes-rope-ladders-whips-plan.md](docs/plans/2026-05-18-002-feat-ropes-rope-ladders-whips-plan.md)
- **Template setup guide:** `../minecraft-mod-template/SETUP.md`
- Related code: `bigdoors_bp/scripts/ropes/` (entire subtree), `bigdoors_bp/scripts/main.js`
