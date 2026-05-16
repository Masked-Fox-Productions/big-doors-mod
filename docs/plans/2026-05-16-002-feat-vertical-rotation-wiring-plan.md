---
title: "feat: Wire vertical rotation mode into handlers and subsystems"
type: feat
status: active
date: 2026-05-16
origin: docs/brainstorms/2026-05-14-big-doors-mod-requirements.md
deepened: 2026-05-16
---

# feat: Wire vertical rotation mode into handlers and subsystems

## Overview

The domain layer already implements vertical rotation math (`rotateVerticalCW`, `rotateVerticalCCW`) with full test coverage, and `DoorAssembly` stores a `mode` field. However, the handler and subsystem layers always hardcode horizontal mode — hinge placement always sets `mode: "horizontal"`, the interaction handler only imports/uses horizontal rotation functions, the obstruction checker only rotates in the X/Z plane, and panel placement only scans horizontal neighbors. This plan wires vertical mode through all four layers so drawbridge/trapdoor-style doors work.

## Problem Frame

R2 specifies: "Hinge supports two rotation modes: horizontal (normal door) and vertical (trapdoor/drawbridge). Mode is determined by placement surface — floor/ceiling placement = vertical hinge, wall placement = horizontal hinge." The domain math exists, but no handler or subsystem uses it. Players placing hinges on floors/ceilings get a horizontal door that rotates incorrectly. (see origin: `docs/brainstorms/2026-05-14-big-doors-mod-requirements.md`)

## Requirements Trace

- R2. Vertical rotation mode determined by placement surface or first-panel direction
- R5. Panel attachment direction adapts to mode (horizontal neighbors for horizontal, vertical neighbors for vertical)
- R15-R19. Opening/closing uses mode-appropriate rotation functions
- R20-R25. Obstruction checking uses mode-appropriate rotation
- R30-R31. Redstone opening uses mode-appropriate rotation

## Scope Boundaries

- No changes to `DoorAssembly.js` — those fields are already correct. `RotationMath.js` and `ObstructionChecker.js` receive additive-only changes (new exports, optional parameters with backward-compatible defaults)
- Minimal block JSON change: extend `bigdoors:door_side` state to include `"up"` and `"down"` values for vertical panel attachment direction. No new blocks or components.
- No vertical double-door detection — defer to a future enhancement (horizontal double doors with vertical mode hinges are out of scope)
- No vertical `computeArcPositions` for entity sweep — acceptable approximation for v1 (entity sweep uses horizontal arc midpoints even for vertical doors; entities are still pushed away from hinge)

## Context & Research

### Relevant Code and Patterns

- `bigdoors_bp/scripts/domain/RotationMath.js:53-94` — `rotateVerticalCW` and `rotateVerticalCCW` already implemented with full test coverage
- `bigdoors_bp/scripts/domain/DoorAssembly.js:22` — `mode` field stored as `'horizontal'|'vertical'`
- `bigdoors_bp/scripts/handler/HingePlacementHandler.js:48` — hardcodes `"bigdoors:mode": "horizontal"`
- `bigdoors_bp/scripts/main.js:24` — `beforeOnPlayerPlace` stub on `bigdoors:hinge_component` (entry point for mode detection)
- `bigdoors_bp/scripts/handler/InteractionHandler.js:2` — only imports `rotateCW`/`rotateCCW`
- `bigdoors_bp/scripts/domain/ObstructionChecker.js:9` — only imports `rotateCW`/`rotateCCW`
- `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js:5` — only imports `rotateCW`/`rotateCCW`
- `bigdoors_bp/scripts/handler/PanelPlacementHandler.js:54` — only scans `HORIZONTAL_DIRS`

### External References

- Bedrock `BlockComponentPlayerPlaceBeforeEvent` (stable custom component callback) has a `face` property (`Direction` enum: `Up`, `Down`, `North`, `South`, `East`, `West`) and a writable `permutationToPlace` — usable for detecting floor/ceiling placement. The hinge block already declares `bigdoors:hinge_component` and the `beforeOnPlayerPlace` callback is stubbed in `main.js:24`.
- **Note:** The world-level `PlayerPlaceBlockAfterEvent` does NOT expose `face` (only `player`, `block`, `dimension`). The `PlayerPlaceBlockBeforeEvent` does have `face` but is experimental/pre-release. The custom component path is the correct stable API surface.

## Key Technical Decisions

- **Mode detection strategy:** Use the custom component's `beforeOnPlayerPlace(e)` callback on `bigdoors:hinge_component`. The stable `BlockComponentPlayerPlaceBeforeEvent` exposes `e.face` (Direction enum). If `face === "Up"` (placed on top of a block below = floor) or `face === "Down"` (placed on bottom of a block above = ceiling), set mode to `"vertical"`. Otherwise `"horizontal"`. Set `e.permutationToPlace` with the correct mode/facing directly — this avoids the previous pattern of setting permutation after placement. The `HingePlacementHandler.onPlace()` then reads the already-correct block state rather than overwriting it. This directly implements R2's "placement surface" rule using a stable API.

- **Rotation function selection:** Introduce a helper function `getRotateFn(mode, facing, direction)` that returns the correct rotation function. This avoids duplicating the mode-check logic in InteractionHandler, RedstoneSubsystem, and ObstructionChecker. Callers pass `assembly.mode, assembly.facing, "cw"/"ccw"`.

- **ObstructionChecker mode parameter:** Add `mode` and `facing` parameters to `checkPath()`. When mode is `"vertical"`, use `rotateVerticalCW`/`rotateVerticalCCW` instead of `rotateCW`/`rotateCCW`. This is the only domain-layer change — it extends the function signature without breaking existing callers (default to horizontal).

- **Vertical panel attachment:** For vertical-mode assemblies, `PanelPlacementHandler` also checks above/below the hinge (Y+1 and Y-1) in addition to horizontal neighbors. The "door side" for vertical doors uses `"up"` or `"down"` — add these to the direction system in Constants.js.

- **Block state extension:** Extend `bigdoors:door_side` in `bigdoors_bp/blocks/hinge.json` to include `"up"` and `"down"` values. Without this, `BlockPermutation.resolve()` will reject vertical door_side values at runtime.

- **Stacked hinge permutation rewrite after merge:** When `_mergeWithAdjacentHinge()` finds an existing assembly, the placed hinge must adopt the assembly's mode — rewrite the block permutation after merge using `assembly.mode` and `assembly.facing`. This prevents a newly-placed hinge from retaining a face-detected mode that conflicts with the assembly it joins.

## Open Questions

### Resolved During Planning

- **How to detect floor/ceiling placement:** Use `e.face` from the custom component's `beforeOnPlayerPlace` callback (`BlockComponentPlayerPlaceBeforeEvent`, stable API). `Up`/`Down` = vertical mode. The world-level `PlayerPlaceBlockAfterEvent` does NOT have `face`; the `PlayerPlaceBlockBeforeEvent` has it but is experimental. The custom component is the correct stable surface.
- **Where to put the rotation function selector:** In `RotationMath.js` as a new exported helper `getRotateFn(mode, facing, direction)` — keeps it in the domain layer, testable without Bedrock imports.
- **How to store vertical door_side:** Extend the `bigdoors:door_side` block state enum in `hinge.json` to include `"up"` and `"down"`. Without this, `BlockPermutation.resolve()` rejects those values.
- **How to handle stacked hinge mode conflicts:** After `_mergeWithAdjacentHinge()`, rewrite the placed hinge's permutation using the assembly's mode. The assembly's mode is authoritative; the detected face of the newly placed hinge is discarded on merge.

### Deferred to Implementation

- Exact entity sweep behavior for vertical doors — the current horizontal `computeArcPositions` is an acceptable approximation for v1
- Whether vertical doors need different double-door detection logic

## Implementation Units

- [ ] **Unit 1: Add rotation function selector, extend ObstructionChecker, and update block schema**

**Goal:** Add a domain-layer helper that selects the correct rotation function based on mode/facing/direction, extend `checkPath()` to accept mode parameters, extend the hinge block state to support vertical door_side values, and add vertical directions to Constants.

**Requirements:** R2, R15-R25

**Dependencies:** None

**Files:**
- Modify: `bigdoors_bp/scripts/domain/RotationMath.js`
- Modify: `bigdoors_bp/scripts/domain/ObstructionChecker.js`
- Modify: `bigdoors_bp/scripts/util/Constants.js`
- Modify: `bigdoors_bp/blocks/hinge.json`
- Test: `tests/RotationMath.test.mjs`
- Test: `tests/ObstructionChecker.test.mjs`

**Approach:**
- Add `getRotateFn(mode, facing, direction)` to `RotationMath.js`. For `mode === "horizontal"`, returns `rotateCW` or `rotateCCW`. For `mode === "vertical"`, returns a bound version of `rotateVerticalCW` or `rotateVerticalCCW` with the `facing` parameter curried in, so the returned function has the same `(pos, hingePos) => pos` signature as the horizontal variants.
- Extend `checkPath(panelPositions, hingePos, direction, blockQueryFn, mode, facing)` — last two params default to `"horizontal"` and `""` for backward compatibility. Use `getRotateFn` internally.
- Add `"up"` and `"down"` to `DIR_OFFSETS` in Constants.js: `up: {x:0, y:1, z:0}`, `down: {x:0, y:-1, z:0}`. Add to `OPPOSITE_DIR`: `up: "down"`, `down: "up"`.
- Extend `bigdoors:door_side` in `bigdoors_bp/blocks/hinge.json` from `["none", "north", "south", "east", "west"]` to `["none", "north", "south", "east", "west", "up", "down"]`. Without this, `BlockPermutation.resolve()` will reject vertical door_side values at runtime.

**Patterns to follow:**
- Existing `rotateCW`/`rotateCCW` function signature for the returned function shape

**Test scenarios:**
- Happy path: `getRotateFn("horizontal", "north", "cw")` returns a function that behaves like `rotateCW`
- Happy path: `getRotateFn("vertical", "north", "cw")` returns a function that behaves like `rotateVerticalCW` with facing="north"
- Happy path: `getRotateFn("vertical", "east", "ccw")` returns a function that behaves like `rotateVerticalCCW` with facing="east"
- Happy path: `checkPath` with mode="vertical", facing="north" uses vertical rotation to compute destinations
- Happy path: `checkPath` with no mode/facing args (backward compat) uses horizontal rotation
- Edge case: `checkPath` in vertical mode correctly identifies solid blocks at vertical destinations

**Verification:**
- `getRotateFn` returns correct rotation functions for all mode/facing/direction combos
- `checkPath` works identically to before when mode params are omitted
- `npm test` passes

---

- [ ] **Unit 2: Wire vertical mode into hinge placement (custom component + handler)**

**Goal:** Detect floor/ceiling placement via the stable custom component callback and create vertical-mode assemblies. Fix stacked hinge permutation to adopt the assembly's mode after merge.

**Requirements:** R2

**Dependencies:** Unit 1 (Constants with up/down directions, extended hinge block state)

**Files:**
- Modify: `bigdoors_bp/scripts/main.js` (the `beforeOnPlayerPlace` stub)
- Modify: `bigdoors_bp/scripts/handler/HingePlacementHandler.js`
- Test: `tests/HingePlacementHandler.test.mjs`

**Approach:**
- **Custom component (`main.js:24`):** Replace the stub `beforeOnPlayerPlace(e)` with mode detection logic. Read `e.face` — if `"Up"` or `"Down"`, compute `mode = "vertical"`, else `mode = "horizontal"`. Compute facing from `e.player.getViewDirection()`. Set `e.permutationToPlace = BlockPermutation.resolve(HINGE_BLOCK_ID, { "bigdoors:facing": facing, "bigdoors:mode": mode, "bigdoors:door_side": "none" })`. This ensures the block is placed with the correct state from the start — no overwrite needed in the after-event handler.
- **HingePlacementHandler changes:** Remove the initial `block.setPermutation(...)` call at line 45-51 — the custom component already set the correct permutation. Instead, read the mode from the placed block's permutation: `block.permutation.getState("bigdoors:mode")`. Use this mode for `manager.createAssembly()`.
- **Stacked hinge merge fix:** After `_mergeWithAdjacentHinge()` returns an existing assembly, rewrite the placed hinge's permutation to match the assembly's mode and facing. This prevents a hinge placed on a floor (face-detected as vertical) from keeping that mode when it merges into an existing horizontal assembly above/below it.
- In `_detectDoubleDoor`, add guard: skip candidate assemblies where `otherAssembly.mode !== assembly.mode` to prevent cross-mode pairing

**Patterns to follow:**
- Existing custom component registration pattern in `main.js` (`beforeOnPlayerPlace`, `onPlayerInteract`)
- Existing `facingFromViewDirection` pattern for deriving facing from view direction

**Test scenarios:**
- Happy path: placing a hinge with face="Up" (on floor) creates a vertical-mode assembly
- Happy path: placing a hinge with face="Down" (on ceiling) creates a vertical-mode assembly
- Happy path: placing a hinge with face="North" (on wall) creates a horizontal-mode assembly (existing behavior)
- Happy path: stacking a hinge above a vertical-mode hinge merges into the vertical assembly
- Edge case: stacking a hinge with a different detected face onto an existing assembly adopts the assembly's mode (permutation is rewritten after merge)
- Edge case: block state `bigdoors:mode` is set to "vertical" for floor/ceiling placement
- Edge case: double-door detection skips cross-mode candidates

**Verification:**
- Floor/ceiling hinge placement creates vertical-mode assemblies
- Wall hinge placement still creates horizontal-mode assemblies (no regression)
- Stacked hinges always match their assembly's mode regardless of placement face
- `npm test` passes

---

- [ ] **Unit 3: Wire vertical mode into PanelPlacementHandler**

**Goal:** Allow panels to attach above/below vertical-mode hinges, with explicit mode gating for both hinge-neighbor and panel-neighbor paths.

**Requirements:** R2, R5

**Dependencies:** Unit 1 (Constants with up/down), Unit 2 (vertical assemblies exist)

**Files:**
- Modify: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js`
- Test: `tests/PanelPlacementHandler.test.mjs`

**Approach:**
- When checking for adjacent hinges, also check Y+1 and Y-1 (not just the 4 horizontal directions)
- For vertical-mode assemblies: the "door side" is `"up"` or `"down"` based on where the first panel is placed relative to the hinge. The direction-from-hinge logic needs to handle vertical offsets: if `to.y - from.y === 1` → `"up"`, if `-1` → `"down"`
- Extend `directionFromTo()` to handle vertical offsets
- **Mode gate in `_handleHingeNeighbor`:** After retrieving the assembly, filter by mode — if `assembly.mode === "vertical"`, only accept `placedDir` values of `"up"` or `"down"` (return false for horizontal directions). If `assembly.mode === "horizontal"`, only accept horizontal directions (return false for `"up"` or `"down"`). This prevents cross-mode panel attachment
- **Mode gate in `_handlePanelNeighbor`:** After retrieving the assembly from the adjacent panel, apply the same axis gate — if `assembly.mode === "vertical"`, only expand vertically (the direction from hinge to the new block must be `"up"` or `"down"`). If `assembly.mode === "horizontal"`, only expand horizontally. Without this gate, a horizontal neighbor of an existing vertical panel would incorrectly convert, creating a panel that expands perpendicular to the door's rotation axis.
- Panel-adjacent expansion should also check vertically when the assembly is vertical mode — extend the neighbor scan loop to include Y+1/Y-1 in addition to horizontal directions
- The wall-side exclusion logic (`OPPOSITE_DIR[assembly.doorSide]`) already works if we add up/down to `OPPOSITE_DIR`
- **Guard `_checkDoubleDoor`:** Add early return when `assembly.mode === "vertical"` to explicitly skip double-door detection for vertical assemblies, consistent with the scope deferral

**Patterns to follow:**
- Existing `_handleHingeNeighbor` / `_handlePanelNeighbor` pattern

**Test scenarios:**
- Happy path: placing a block above a vertical-mode hinge converts it to a door panel with door_side="up"
- Happy path: placing a block below a vertical-mode hinge converts it to a door panel with door_side="down"
- Edge case: placing a block horizontally adjacent to a vertical-mode hinge with no door_side set does NOT convert it (panels must be above/below for vertical mode)
- Happy path: panel-adjacent expansion works vertically (placing a block above an existing vertical panel extends the door)
- Edge case: placing a block horizontally adjacent to an existing vertical panel does NOT convert it (mode gate prevents cross-axis expansion)
- Edge case: wall-side exclusion — if door_side="up", blocks placed below the hinge are not converted
- Happy path: horizontal-mode hinge panel placement still works as before (no regression)
- Edge case: horizontal neighbor of a vertical panel is not converted even when the block is a valid material

**Verification:**
- Vertical-mode panels attach above/below hinges
- Horizontal panel placement is unaffected
- Cross-axis expansion is blocked for both modes
- `npm test` passes

---

- [ ] **Unit 4: Wire vertical mode into InteractionHandler and RedstoneSubsystem**

**Goal:** Use mode-appropriate rotation when opening/closing doors via interaction or redstone.

**Requirements:** R15-R19, R30-R31

**Dependencies:** Unit 1 (getRotateFn, extended checkPath)

**Files:**
- Modify: `bigdoors_bp/scripts/handler/InteractionHandler.js`
- Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Test: `tests/InteractionHandler.test.mjs`
- Test: `tests/RedstoneSubsystem.test.mjs`

**Approach:**
- **InteractionHandler:**
  - Import `getRotateFn` from `RotationMath.js`
  - Change `_preferredDirection(panelPositions, hingePos, player)` to `_preferredDirection(assembly, hingePos, player)` so it has access to mode/facing. Use `getRotateFn(assembly.mode, assembly.facing, "cw")` and `getRotateFn(assembly.mode, assembly.facing, "ccw")` instead of `rotateCW`/`rotateCCW` directly. Update distance calculation to include Y component: `Math.abs(d.x - playerPos.x) + Math.abs(d.y - playerPos.y) + Math.abs(d.z - playerPos.z)` — this is backward-compatible since horizontal rotation preserves Y
  - In `_attemptOpen`: pass `assembly.mode` and `assembly.facing` to `checkPath()`. Use `getRotateFn` for computing destinations
  - Close path (`_close`) doesn't need changes — it restores to `closedPos` directly, no rotation math involved

- **RedstoneSubsystem:**
  - Import `getRotateFn` from `RotationMath.js`
  - In `_openWithRedstone` and `_openSingleAssembly`: pass `assembly.mode` and `assembly.facing` to `checkPath()`
  - In `_executeOpen`: use `getRotateFn(assembly.mode, assembly.facing, direction)` instead of ternary `rotateCW`/`rotateCCW`

**Patterns to follow:**
- Existing rotation function selection pattern in `_attemptOpen` line 89

**Test scenarios:**
- Happy path: interacting with a vertical-mode closed door opens it using vertical rotation (panels move in the Y plane)
- Happy path: interacting with a vertical-mode open door closes it (panels return to closed positions)
- Happy path: vertical door opens away from the player (preferred direction logic works with vertical rotation)
- Edge case: vertical door blocked in one direction falls back to opposite direction
- Edge case: vertical door blocked in both vertical directions does not move
- Happy path: redstone powers a vertical-mode hinge — door opens using vertical rotation
- Happy path: redstone depowers a vertical-mode hinge — door closes
- Happy path: horizontal-mode doors still work exactly as before (no regression)
- Integration: full cycle — place vertical hinge on floor, place panels above, interact to open, verify panels moved to horizontal positions via vertical rotation

**Verification:**
- Vertical doors open/close correctly with proper rotation axis
- Horizontal doors are unaffected
- Redstone works for both modes
- `npm test` passes

## System-Wide Impact

- **Interaction graph:** No new event subscriptions. Changes flow through the same manager path. The mode parameter propagates from hinge placement → assembly → rotation at open/close time
- **Error propagation:** No change — unloaded-chunk abort still applies. Vertical rotation destinations may span more Y levels, but the same safety checks apply
- **State lifecycle risks:** None — mode is set once at hinge placement time and persisted with the assembly. No mid-lifecycle mode changes
- **API surface parity:** Java edition will need the same vertical wiring in its handler layer. The Java `RotationMath` already has vertical methods (per the Java port plan Unit 1)
- **Unchanged invariants:** Horizontal-mode doors are completely unaffected. All existing tests must continue to pass. The `checkPath` signature extension uses default parameters for backward compatibility

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Custom component `beforeOnPlayerPlace` not firing in edge cases (e.g., command-placed blocks) | The mod only needs player-placed hinges to detect mode. Command/structure-placed hinges will default to horizontal mode via the block JSON default state, which is acceptable |
| `bigdoors:door_side` schema extension requires re-importing the pack on existing worlds | The state enum extension is additive — existing "none"/"north"/etc. values remain valid. Bedrock handles new enum values gracefully on pack updates |
| Vertical doors spanning many Y levels could cause frame drops | Same risk as horizontal doors — deferred to future chunked movement enhancement. No special mitigation needed |
| Entity sweep approximation (horizontal arc) may miss entities during vertical rotation | Acceptable for v1. The push-away-from-hinge logic still works. Can add vertical arc computation later |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-14-big-doors-mod-requirements.md](docs/brainstorms/2026-05-14-big-doors-mod-requirements.md)
- **Parent plan:** [docs/plans/2026-05-14-001-feat-multi-block-hinge-doors-plan.md](docs/plans/2026-05-14-001-feat-multi-block-hinge-doors-plan.md) — Unit 4 describes the intended vertical mode wiring that was not implemented
- Related domain code: `bigdoors_bp/scripts/domain/RotationMath.js` (vertical functions at lines 53-94)
- Related tests: `tests/RotationMath.test.mjs` (vertical test coverage at lines 78-123)
