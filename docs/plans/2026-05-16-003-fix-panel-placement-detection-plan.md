---
title: "fix: Accurate panel placement detection and orphaned panel cleanup"
type: fix
status: active
date: 2026-05-16
origin: docs/brainstorms/2026-05-14-big-doors-mod-requirements.md
---

# fix: Accurate panel placement detection and orphaned panel cleanup

## Overview

Panel placement detection has two bugs that compound in double-door and multi-row scenarios: (1) `_handlePanelNeighbor` accepts blocks outside the door's plane because it lacks coplanarity validation, and (2) `pairAndSplitAssemblies` orphans center panels in odd-column double doors without cleaning up the world block or position index. These cause blocks to be incorrectly added to doors and legitimate break/place actions to be silently ignored.

## Problem Frame

R5 states the hinge auto-detects which side the door is on, and R7 says "contiguous custom door blocks of the same material extending from the hinge's door side are considered part of the door." The current `_handlePanelNeighbor` path violates R7 by accepting blocks that are adjacent to a panel but perpendicular to the door plane (e.g., placed behind/in front of the door). R13 says the center block of an odd double door "stays fixed," but the implementation drops the center panel from both assemblies without reverting the `bigdoors:door_panel` block to vanilla, leaving an orphaned block that can't be broken or interacted with properly. (see origin: `docs/brainstorms/2026-05-14-big-doors-mod-requirements.md`)

## Requirements Trace

- R5. First block sets door orientation — placement detection must respect this orientation
- R7. Contiguous same-material blocks on the door side form the door — "door side" implies coplanarity with the hinge axis
- R13. Odd double-door center block stays fixed — must be reverted to vanilla, not left as orphaned door_panel
- R28. Breaking a door block removes it from the assembly — orphaned panels violate this

## Scope Boundaries

- No changes to double-door detection logic (`_checkDoubleDoor`) — only fixing the cleanup after pairing
- No changes to hinge placement (`HingePlacementHandler`) — that path already validates correctly (distance-1 check is appropriate there)
- No changes to rotation, obstruction, or interaction logic
- Vertical mode compatibility: the plane validation must work with `doorSide` values of `"up"` and `"down"` when the vertical rotation plan is implemented, but this plan only adds/tests horizontal mode behavior

## Context & Research

### Relevant Code and Patterns

- `bigdoors_bp/scripts/handler/PanelPlacementHandler.js:111-129` — `_handlePanelNeighbor` is the buggy path. Missing plane check; wall-side check uses `directionFromTo` which returns `null` for blocks >1 away from hinge
- `bigdoors_bp/scripts/handler/PanelPlacementHandler.js:26-37` — `directionFromTo` checks axes sequentially (dx first, then dz, then dy); returns the first ±1 match regardless of other axes, or null if none match
- `bigdoors_bp/scripts/DoorManager.js:176-227` — `pairAndSplitAssemblies` drops center panels (line 213: `v === midpoint` is silently skipped) and hinge-position panels (line 210: `v <= minVal || v >= maxVal`) without world cleanup
- `bigdoors_bp/scripts/handler/PanelPlacementHandler.js:78-109` — `_handleHingeNeighbor` is correct; `directionFromTo` is appropriate at distance-1 from hinge

### Bug Analysis

**Bug 1: Off-plane panel acceptance**

For a door with hinge at (0,0,0) and `doorSide="east"`, the door plane is X/Y with fixed Z=0. All panels should share Z=0. When a panel exists at (1,0,0) and a player places cobblestone at (1,0,1):

1. `_handlePanelNeighbor` finds the assembly via the adjacent panel
2. Wall-side check: `directionFromTo({0,0,0}, {1,0,1})` → `"east"` (dx=1 matches first, dz=1 is ignored)
3. `"east" !== "west"` → check passes despite the block being off-plane
4. Block is incorrectly converted to a door panel at Z=1

The same bug affects tall doors: a block at (1,2,1) adjacent to a panel at (1,2,0) passes the same check. And for blocks far from the hinge (e.g., `directionFromTo({0,0,0}, {3,0,2})` → `null`), the check also passes because `null !== wallSide`.

**Bug 2: Orphaned center panels**

For odd-column double doors (hinges at x=0 and x=4 with 3 panels between them):

1. `pairAndSplitAssemblies` computes midpoint = 2.0
2. Panel at x=2 has `v === midpoint` — falls through both `v < midpoint` and `v > midpoint` conditions
3. Panel is removed from position index (line 202-204) but the `bigdoors:door_panel` block remains in the world
4. Breaking the orphaned block: `findByPosition` returns null → mod ignores the break → player gets wrong item drop
5. Placing adjacent to orphaned block: `findByPosition` returns null → not added to any assembly → confusing

**Why double doors and tall doors are worst affected:**

- Double doors trigger `pairAndSplitAssemblies`, which creates orphaned panels
- Tall doors (multiple rows) have more panels distant from hinges, where `directionFromTo` returns null, bypassing the wall-side check
- The combination (tall double door with odd columns) creates multiple orphaned panels across rows AND has many positions where off-plane placement is accepted

## Key Technical Decisions

- **Plane validation via depth-axis check:** Rather than trying to fix `directionFromTo` for arbitrary distances, add a direct coplanarity check. For horizontal doors, determine the "depth axis" from `doorSide` — east/west doors have fixed Z, north/south doors have fixed X — and verify the new block matches the hinge's coordinate on that axis. This is simpler, correct at any distance, and extends naturally to vertical mode (up/down doors will have both X and Z fixed).

- **Plane check lives in `PanelPlacementHandler` not domain:** This is a handler-layer concern (validating placement against the physical world state). The domain layer (`DoorAssembly`) doesn't need to know about plane geometry — it just stores panels.

- **`pairAndSplitAssemblies` takes a dimension parameter for cleanup:** The method needs world access to revert orphaned panels to vanilla blocks. Since `DoorManager` already receives dimension references from callers, this follows the existing pattern. The manager reverts the orphaned panel block to its vanilla material and spawns no items (the block was never "broken" — it's being unassigned from the door).

- **Center panel reverts to vanilla, not air:** Per R13, the center block "stays fixed." The player placed a vanilla block there; it should go back to being that vanilla block, not disappear.

## Open Questions

### Resolved During Planning

- **Should off-plane blocks adjacent to panels be silently ignored or produce feedback?** Silently ignored — consistent with how unsupported materials are handled (no chat message, block just stays vanilla). The player's block isn't consumed or changed.

- **What about panels that extend vertically (Y axis) in horizontal mode — do they need plane validation?** Yes. A panel at (1,1,0) in a Z=0 plane door is valid (extends the door upward). A panel at (1,1,1) is not (off-plane). The depth-axis check handles this correctly because it only constrains the depth axis (Z in this case), not Y.

- **Should `pairAndSplitAssemblies` also clean up panels at hinge positions (`v <= minVal || v >= maxVal`)?** Yes, as a safety net. Panels should never exist at hinge positions in normal gameplay, but the splitting loop naturally drops them (line 210). Since the revert callback already handles dropped panels, hinge-position panels are reverted alongside center panels — no special handling needed, just inclusive collection in the same loop.

### Deferred to Implementation

- Exact behavior when `pairAndSplitAssemblies` encounters a panel whose vanilla material can't be resolved — likely just set to air as a fallback

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Panel placement validation flow (after finding assembly via adjacent panel):

  1. Is block a supported material? → No → reject
  2. Does assembly have a doorSide set? → No → reject
  3. Is block coplanar with the door?
     → Determine depth axis from doorSide:
       east/west → depth axis is Z
       north/south → depth axis is X
       up/down → depth axes are both X and Z (vertical column)
     → Compare new block's depth-axis coord to primaryHingePos coord
     → Mismatch → reject
  4. Is block on the wall side of the hinge?
     → Determine door-extension axis from doorSide:
       east → +X, west → -X, north → -Z, south → +Z
     → Check new block's extension-axis coord relative to ANY hinge
     → If new block is on the opposite side of any hinge → reject
  5. Accept → convert to door_panel, add to assembly

pairAndSplitAssemblies cleanup:

  Before: drops orphaned panels silently
  After:  collect orphaned panels, revert each to vanilla block via dimension
```

## Implementation Units

- [ ] **Unit 1: Add plane validation to PanelPlacementHandler**

**Goal:** Prevent blocks outside the door plane from being added to assemblies via the panel-neighbor path. Replace the ineffective distance-1 wall-side check with a proper geometric check.

**Requirements:** R5, R7

**Dependencies:** None

**Files:**
- Modify: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js`
- Test: `tests/PanelPlacementHandler.test.mjs`

**Approach:**
- Add a private method (e.g., `_isCoplanar(assembly, pos)`) that checks whether `pos` shares the correct coordinate with `assembly.primaryHingePos` based on `assembly.doorSide`:
  - `doorSide` east/west → `pos.z === primaryHingePos.z`
  - `doorSide` north/south → `pos.x === primaryHingePos.x`
  - `doorSide` up/down → `pos.x === primaryHingePos.x && pos.z === primaryHingePos.z` (include in code structure for forward-compatibility with vertical mode, but no vertical-mode tests in this plan — tested when the vertical rotation plan is implemented)
- Add `_isCoplanar` as a new check in `_handlePanelNeighbor`, inserted before the existing wall-side check. The coplanarity check rejects off-plane blocks; the wall-side check remains as defense-in-depth against invariant violations (e.g., if a panel ever exists on the wall side due to a bug or data corruption, the wall-side check prevents further expansion in that direction).
- Also add the coplanarity check to `_handleHingeNeighbor` as a safety guard — currently that path works because `directionFromTo` constrains to distance-1, but the explicit check makes intent clearer and prevents future regressions.
- Note: the wall-side exclusion in `_handleHingeNeighbor` (preventing the first panel from being placed on the wall side) is still needed alongside the plane check — the plane check ensures the block is IN the door plane, the wall-side check ensures it's on the correct SIDE within that plane.

**Patterns to follow:**
- Existing `_handleHingeNeighbor` / `_handlePanelNeighbor` structure
- `OPPOSITE_DIR` mapping in Constants.js for direction relationships

**Test scenarios:**
- Happy path: block placed in-plane adjacent to existing panel is converted (east door, same Z as hinge)
- Happy path: block placed in-plane but at Y+1 (second row) adjacent to existing panel is converted
- Happy path: block placed extending door further from hinge (in-plane, farther along extension axis) is converted
- Edge case: block placed behind door plane (Z+1 for east door) adjacent to existing panel is NOT converted
- Edge case: block placed in front of door plane (Z-1 for east door) adjacent to existing panel is NOT converted
- Edge case: tall door — block off-plane at Y=2 adjacent to panel at Y=2 is NOT converted (distance from hinge is irrelevant)
- Edge case: north/south door — block off-plane (wrong X) is NOT converted
- Happy path: existing hinge-neighbor placement tests still pass (no regression)

**Verification:**
- Off-plane blocks adjacent to panels are silently rejected
- In-plane blocks at any distance from hinge are correctly accepted
- All existing PanelPlacementHandler tests pass
- `npm test` passes

---

- [ ] **Unit 2: Clean up orphaned panels in pairAndSplitAssemblies**

**Goal:** When `pairAndSplitAssemblies` drops panels (center panel of odd-count double doors), revert the world blocks from `bigdoors:door_panel` to their original vanilla material.

**Requirements:** R13, R28

**Dependencies:** None (independent of Unit 1)

**Files:**
- Modify: `bigdoors_bp/scripts/DoorManager.js`
- Modify: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js` (update `_checkDoubleDoor` call to pass dimension)
- Modify: `bigdoors_bp/scripts/handler/HingePlacementHandler.js` (update `_detectDoubleDoor`/call to pass dimension if it triggers pairing)
- Test: `tests/DoubleDoor.test.mjs`
- Test: `tests/DoorManager.test.mjs`

**Approach:**
- Change `pairAndSplitAssemblies(assemblyIdA, assemblyIdB)` signature to accept an optional `revertCallback` function: `pairAndSplitAssemblies(assemblyIdA, assemblyIdB, revertCallback)`. The callback signature is `(pos, materialIndex) => void`. This keeps the domain-adjacent manager free of Bedrock imports while letting the handler layer provide world-mutation logic.
- In the panel-splitting loop, collect panels that are dropped (center panel at midpoint, any panels at hinge positions). After splitting, call `revertCallback(panel.closedPos, panel.materialIndex)` for each dropped panel.
- In `PanelPlacementHandler._checkDoubleDoor`, pass a revert callback that:
  1. Gets the block at the position via `dimension.getBlock(pos)`
  2. Resolves the vanilla typeId via `typeIdForIndex(materialIndex)`
  3. Sets the block type to the vanilla block (or air if typeId can't be resolved)
- In `HingePlacementHandler._detectDoubleDoor` / the `pairAndSplitAssemblies` call there, pass the same kind of callback. (Currently `_detectDoubleDoor` doesn't have panels to drop since it's called at hinge-placement time, but passing the callback prevents a regression if that changes.)

**Patterns to follow:**
- Existing callback pattern used in `checkPath` (ObstructionChecker takes `blockQueryFn`)
- `typeIdForIndex` from MaterialRegistry for resolving vanilla block types

**Test scenarios:**
- Happy path: odd-column double door (3 panels between hinges) — center panel is reverted to vanilla block
- Happy path: even-column double door (4 panels between hinges) — no panels orphaned, no revert needed
- Happy path: tall odd-column double door (3 columns × 3 rows) — center column panels at all Y levels are reverted
- Edge case: center panel with unknown material index — block reverted to air (fallback)
- Edge case: panel at hinge position (safety-net path) — reverted to vanilla block alongside center panels
- Edge case: revert callback not provided (backward compat) — panels dropped silently as before
- Integration: after pairing, breaking the center vanilla block works normally (drops vanilla item, not door_panel)
- Integration: after pairing, placing a new block adjacent to the center vanilla block does NOT convert it (it's no longer tracked)

**Verification:**
- Center blocks in odd double doors are vanilla blocks after pairing
- No orphaned `bigdoors:door_panel` blocks remain untracked
- Even double doors are unaffected
- `npm test` passes

---

- [ ] **Unit 3: Add Java parity for both fixes**

**Goal:** Apply the same plane validation and orphaned-panel cleanup to the Java Fabric edition.

**Requirements:** R5, R7, R13, R28 (Java parity)

**Dependencies:** Unit 1, Unit 2 (Bedrock fixes define the behavior)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/HingeBlock.java` (`neighborChanged` at line 173 handles panel detection from hinge neighbors)
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelBlock.java` (`neighborChanged` at line 91 handles panel expansion from panel neighbors)
- Modify: `java-bigdoors/src/main/java/com/bigdoors/DoorManager.java` (pairAndSplitAssemblies cleanup)
- Test: corresponding JUnit test files

**Approach:**
- Mirror the Bedrock plane validation logic in the Java panel placement handler
- Mirror the orphaned-panel cleanup in Java's `pairAndSplitAssemblies`
- The Java BreakHandler already has a `startConversion`/`endConversion` guard pattern (see `BreakHandler.java:89-128`) — the revert callback should use the same guard to prevent placement events from re-triggering on the reverted blocks

**Patterns to follow:**
- Java `BreakHandler` conversion guard pattern (`startConversion`/`endConversion`)
- Java `DoorManager` position index management

**Test scenarios:**
- Same scenarios as Units 1 and 2, adapted for JUnit
- Happy path: plane validation rejects off-plane blocks in Java
- Happy path: orphaned center panels reverted to vanilla in Java
- Edge case: conversion guard prevents re-triggering during revert

**Verification:**
- Java tests pass (`./gradlew test`)
- Behavior matches Bedrock edition

## System-Wide Impact

- **Interaction graph:** No new event subscriptions. The plane check is a filter within the existing `playerPlaceBlock` handler. The `pairAndSplitAssemblies` change adds a world mutation (block type change) that could fire `playerPlaceBlock` — the revert callback should NOT trigger panel conversion. In Bedrock, this is safe because the callback sets the vanilla block type, not `bigdoors:door_panel`, so the `PanelPlacementHandler.register()` filter (`event.block.typeId === PANEL_BLOCK_ID`) won't fire. In Java, the conversion guard pattern prevents re-triggering.
- **Error propagation:** If `dimension.getBlock(pos)` returns null during revert (chunk unloaded), the panel is left as `bigdoors:door_panel` — same as current behavior. Not worse.
- **State lifecycle risks:** The position index is already correctly cleaned up by `pairAndSplitAssemblies` (line 202-204 deletes all panel positions). The new code only adds world-block reversion, not index changes. Note: `pairAndSplitAssemblies` is only called during construction (from `_checkDoubleDoor` and `_detectDoubleDoor`), so the door is always closed — `closedPos` and `currentPos` are identical, and the revert callback uses `closedPos` safely.
- **API surface parity:** Both Bedrock and Java editions need these fixes (Unit 3).
- **Unchanged invariants:** `_handleHingeNeighbor` continues to work as before (plane check is additive safety). Double-door detection logic (`_checkDoubleDoor`) is unchanged. Opening/closing mechanics are unaffected. Position index behavior during open/close is unaffected.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Plane validation breaks legitimate panel placement in edge cases | Thorough test coverage of multi-row, multi-column, and double-door configurations. The depth-axis check is geometrically sound — a panel is in the door plane if and only if it shares the depth coordinate |
| Revert callback fires during world generation or chunk loading | The callback is only invoked from `pairAndSplitAssemblies`, which is only called from player-triggered paths (panel placement, hinge placement). Not a risk. |
| Vertical mode (`doorSide` up/down) isn't tested yet | The plane validation design handles up/down by fixing both X and Z, which is correct for vertical-column panels. Explicit tests will be added when the vertical rotation plan is implemented. |
| `pairAndSplitAssemblies` signature change breaks callers | The revert callback is optional — existing callers without it continue to work (panels dropped silently as before) |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-14-big-doors-mod-requirements.md](docs/brainstorms/2026-05-14-big-doors-mod-requirements.md)
- **Related plan:** [docs/plans/2026-05-16-002-feat-vertical-rotation-wiring-plan.md](docs/plans/2026-05-16-002-feat-vertical-rotation-wiring-plan.md) — Unit 3 modifies `PanelPlacementHandler` for vertical mode; this fix must be compatible
- Related code: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js` (primary bug location)
- Related code: `bigdoors_bp/scripts/DoorManager.js:176-227` (orphaned panel bug location)
