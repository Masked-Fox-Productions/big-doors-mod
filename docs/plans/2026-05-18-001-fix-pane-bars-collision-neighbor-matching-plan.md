---
title: "fix: Correct pane/bars/fence collision boxes and add neighbor-matching geometry variants"
type: fix
status: active
date: 2026-05-18
deepened: 2026-05-18
---

# fix: Correct pane/bars/fence collision boxes and add neighbor-matching geometry variants

## Overview

Glass pane and iron bars door panels have two issues: (1) their collision boxes are perpendicular to the visual geometry, and (2) they render as full-width panes/bars regardless of whether they have assembly neighbors, unlike fences which already have solo/before/after/both geometry variants. This plan fixes the collision axis and adds neighbor-matching variants for both panes and bars, following the established fence pattern.

## Problem Frame

When a player places a glass pane material next to a hinge, the resulting door panel looks correct (flat plane facing the right direction) but the collision box is rotated 90 degrees from the visual. Players can walk through the visible face and get blocked by empty space perpendicular to it.

Additionally, panes and bars always render as full-width geometry regardless of neighboring panels. Fences already have 4 geometry variants (solo/before/after/both) that connect only to panels and hinges in the same assembly. Panes and bars need the same treatment for visual consistency with vanilla behavior.

## Requirements Trace

- R1. Pane, bars, and fence collision boxes must align with their visual geometry at all rotations, including vertical-open rotations (5–6) where panels are tipped horizontal — players should be able to walk on them
- R2. Panes get 4 geometry variants (solo/before/after/both) matching vanilla glass pane neighbor-connection behavior
- R3. Bars get 4 geometry variants (solo/before/after/both) matching vanilla iron bars neighbor-connection behavior
- R4. Pane and bars neighbor-matching must use the same assembly-only connection logic as fences (connect only to door-panels and hinges in the same assembly, not arbitrary neighbors)
- R5. Each geometry variant gets an appropriately-sized collision and selection box
- R6. State space must stay within Bedrock's 65,536 permutation limit

## Scope Boundaries

- Only Bedrock edition (`bigdoors_bp/`) is in scope — Java parity is a separate task
- Upright orientations (`panel_rotation < 4`) and vertical-open orientations (`panel_rotation` 5–6) get custom collision boxes; fences are included alongside panes/bars since they also lack vertical-open collision today
- Exact pixel-perfect vanilla geometry is a non-goal; close approximations are fine
- The `_hasAssemblyBlockAt` connection logic is already correct and does not need changes
- This plan supersedes Unit 2 of `docs/plans/2026-05-17-006-feat-impersonated-block-collision-plan.md` (bars/pane collision) and also subsumes the vertical-open collision gap for fences from that plan's Unit 1

## Context & Research

### Relevant Code and Patterns

- `bigdoors_rp/models/blocks/door_panel_fence.geo.json` — 4-variant geometry file pattern to follow (solo/before/after/both as separate geometries in one file)
- `bigdoors_bp/scripts/domain/MaterialRegistry.js:resolveGeometryId()` — fence neighbor→geometry-ID resolution; panes and bars need parallel logic
- `bigdoors_bp/scripts/handler/PanelPlacementHandler.js:_neighborAxes()` — determines which axis to check for neighbors; currently only special-cases fences for vertical mode
- `bigdoors_bp/scripts/handler/PanelPlacementHandler.js:_placePanel()` — calls `resolveGeometryId` and `_updateNeighborGeometry`; already handles the full neighbor-update flow for any geometry class that returns varying IDs
- `bigdoors_bp/scripts/domain/PanelRotation.js:closedRotation()` — fences/slabs get rotation path 0–3; panes currently fall through to the flat-panel path (rotations 4–7 in vertical mode); this needs updating
- `bigdoors_bp/scripts/util/Constants.js` — `GEOMETRY_INDEX`, `GEOMETRY_CLASS_*` constants, `MATERIAL_GEOMETRY_CLASS` map

### Existing Collision Box Pattern

The slab and fence collision box permutations in `door_panel.json` (lines 139–282) establish the pattern: a condition matching `geometry_id == N && panel_rotation < 4` followed by `minecraft:collision_box` and `minecraft:selection_box` components. Fences and slabs are symmetric in X/Z so one permutation covers all upright rotations. Panes and bars are asymmetric (thin on one axis) so the collision box must account for whether `minecraft:transformation` rotates the collision box or not — see deferred question below.

Critically, no existing geometry class has collision permutations for `panel_rotation` 5–6 (vertical-open). Fences at rotations 5–6 currently fall back to full-block collision. This plan adds thin collision for rotations 5–6 across fence, pane, and bars geometry classes so players can walk on vertically-opened door panels.

### Vanilla Reference Geometry

| Shape | Vanilla behavior with 0 connections | With 1 connection | With 2 opposite connections |
|---|---|---|---|
| Glass pane | Plus/cross shape in block center | Half-pane extending from center toward connected side | Full-width flat pane |
| Iron bars | Plus/cross shape in block center | Half-bars extending from center toward connected side | Full-width bars |

### State Space Budget

Current: 16 × 16 × 9 × 8 × 2 = 36,864 permutations.
After adding 6 new geometry IDs (geometry_id values now span 0–14 for 15 total): 16 × 16 × 15 × 8 × 2 = 61,440 permutations.
Bedrock limit: 65,536. Headroom: 4,096 (94% consumed). Only one more geometry ID value can be added before hitting the limit.

## Key Technical Decisions

- **Reuse existing geometry IDs 5 and 7 as the "both" variant**: Existing panels in the world with `geometry_id=5` (bars) or `geometry_id=7` (pane) will display as the full-width "both" variant, maintaining backward compatibility. New solo/before/after variants get IDs 9–14.
- **Follow the fence geometry file pattern**: All 4 variants per shape live in one `.geo.json` file with separate geometry identifiers, matching `door_panel_fence.geo.json`.
- **Panes and bars use the fence rotation path**: Both shapes have geometry extending along the X axis with asymmetric before/after variants, just like fences. They should use rotations 0–3 (not the flat-panel rotations 4–7) so that `minecraft:transformation` aligns the extension axis with the door axis. This changes pane/bars rotation from the current "full panel" path to the "fence" path in `PanelRotation`.
- **Assembly-only neighbor connections (inherited)**: The existing `_hasAssemblyBlockAt` function already enforces that connections only form between blocks in the same assembly. No changes needed — panes and bars inherit this behavior by routing through the same `resolveGeometryId` → `_updateNeighborGeometry` pipeline that fences use.

## Open Questions

### Resolved During Planning

- **Do pane/bars need rotation-specific collision permutations for upright (0–3)?**: The existing collision plan assumes (not verified) that collision boxes are in local space and rotate with `minecraft:transformation`. The existing fence pattern (one collision box for all upright rotations) is consistent with this assumption — but fences are symmetric in X/Z, so they'd work either way. Unit 0 will verify this assumption in-game. If it holds, one collision permutation per geometry variant (gated on `panel_rotation < 4`) is sufficient. If not, pane/bars need per-rotation permutations (up to 4× entries for asymmetric shapes — increases JSON size but not state space). Vertical-open rotations (5–6) need separate collision permutations regardless, because the geometry is tipped 90° and the desired collision shape differs from the upright case.

### Deferred to Implementation

- **Does `minecraft:collision_box` actually rotate with `minecraft:transformation`?**: Verify in-game by placing a pane panel at different door orientations and testing collision from all sides. If collision does NOT rotate, rotation-specific permutations will be needed (doubling the collision permutation count for panes/bars). The plan assumes it does rotate based on the existing collision plan's analysis.
- **Vertical-open collision box orientation at rotations 5–6**: When `minecraft:transformation` rotates the block 90° on X (rotations 5–6), verify whether the collision_box values need to be pre-rotated to account for the transformation or specified in world-space. Test with a fence first (thick enough to clearly see collision alignment) then apply the same approach to pane/bars. If collision does rotate with transformation, the vertical-open permutation should use the same local-space values but may need different dimensions (thin-horizontal slab shape for walkability).
- **Solo variant geometry dimensions**: The exact cube sizes for the cross-shaped solo variants should be tuned visually in-game. A reasonable starting point is two intersecting 2-pixel-thick planes forming a plus shape.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Geometry ID mapping (after changes):

  ID 0  = full_block (default)
  ID 1  = fence_solo        ─┐
  ID 2  = fence_before       │ existing fence
  ID 3  = fence_after        │ variants
  ID 4  = fence_both        ─┘
  ID 5  = bars_both   (was "bars" — backward compat)
  ID 6  = slab
  ID 7  = pane_both   (was "pane" — backward compat)
  ID 8  = slab_top
  ID 9  = bars_solo    ─┐
  ID 10 = bars_before   │ new bars
  ID 11 = bars_after   ─┘ variants
  ID 12 = pane_solo    ─┐
  ID 13 = pane_before   │ new pane
  ID 14 = pane_after   ─┘ variants

resolveGeometryId logic (pseudo):

  if geoClass == FENCE:    return fenceVariant(before, after)  // existing
  if geoClass == BARS:     return barsVariant(before, after)   // new
  if geoClass == PANE:     return paneVariant(before, after)   // new
  otherwise:               return geoClass                     // unchanged
```

## Implementation Units

- [ ] **Unit 0: Verify collision_box rotation behavior (spike)**

  **Goal:** Determine whether `minecraft:collision_box` rotates with `minecraft:transformation` — this is the load-bearing assumption for the entire collision approach

  **Requirements:** R1

  **Dependencies:** None

  **Files:**
  - No files modified — this is an in-game verification spike

  **Approach:**
  - Place a door panel with an asymmetric collision box (existing bars or pane at ID 5 or 7) at different `panel_rotation` values
  - Test collision from all four sides to determine whether the thin axis rotates with the block or stays world-axis-aligned
  - Also test at rotations 5–6 (vertical-open): does collision rotate when the block is tipped 90° on X?
  - Document the result as a comment in `door_panel.json` near the collision permutations

  **Test scenarios:**
  - Happy path: collision_box rotates with transformation → proceed with one collision permutation per geometry variant for upright rotations
  - Error path: collision_box does NOT rotate → Unit 5 needs per-rotation collision permutations for asymmetric shapes (up to 4× upright entries for pane/bars, though this increases JSON size, not state space — the 61,440 state-space figure is unchanged since permutation conditions use existing state values)

  **Verification:**
  - A clear answer documented: "collision_box DOES/DOES NOT rotate with minecraft:transformation"
  - If it does not rotate, revise Unit 5 approach before proceeding

- [ ] **Unit 1: Add geometry variant files for panes and bars**

  **Goal:** Define the 4 geometry shapes for each of panes and bars (solo/before/after/both)

  **Requirements:** R2, R3

  **Dependencies:** None

  **Files:**
  - Modify: `bigdoors_rp/models/blocks/door_panel_pane.geo.json` (add solo/before/after variants alongside existing full pane)
  - Modify: `bigdoors_rp/models/blocks/door_panel_bars.geo.json` (add solo/before/after variants alongside existing full bars)

  **Approach:**
  - Follow the `door_panel_fence.geo.json` multi-geometry-per-file pattern
  - Existing full-width geometry becomes the "both" variant (identifier stays the same for backward compat)
  - "before" variant extends cubes from center toward -X
  - "after" variant extends cubes from center toward +X
  - "solo" variant uses a cross/plus shape (two intersecting thin planes)
  - Bars variants include the horizontal crossbar rails in the connected direction (mirroring how fence_before/after have rails)

  **Patterns to follow:**
  - `bigdoors_rp/models/blocks/door_panel_fence.geo.json`

  **Test scenarios:**
  - Happy path: each geometry identifier loads without error in Bedrock (verified by placing panels of each variant in-game)

  **Verification:**
  - All 6 new geometry identifiers (IDs 9–14) resolve in the resource pack without warnings; existing identifiers for IDs 5 and 7 remain unchanged

- [ ] **Unit 2: Register new geometry IDs and update resolution logic**

  **Goal:** Wire up the new geometry variants in Constants and MaterialRegistry so panes and bars get neighbor-aware geometry IDs

  **Requirements:** R2, R3, R4, R6

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `bigdoors_bp/scripts/util/Constants.js`
  - Modify: `bigdoors_bp/scripts/domain/MaterialRegistry.js`
  - Modify: `bigdoors_bp/blocks/door_panel.json` (expand geometry_id state array and add ID→geometry permutation mappings)
  - Test: `tests/MaterialRegistry.test.mjs`

  **Approach:**
  - Add 6 new entries to `GEOMETRY_INDEX` (IDs 9–14)
  - Following the fence pattern, do NOT add per-variant `GEOMETRY_CLASS_*` constants. `GEOMETRY_CLASS_BARS` (5) and `GEOMETRY_CLASS_PANE` (7) already exist as class markers that route resolution logic. Only add new geometry identifier strings to `GEOMETRY_INDEX` for IDs 9–14
  - Restructure the existing early-return guard in `resolveGeometryId` (line 36: `if (geoClass !== GEOMETRY_CLASS_FENCE) return geoClass;`) — this currently short-circuits all non-fence classes including bars and pane. Replace with individual checks or a switch so bars and pane classes fall through to their respective resolution branches
  - Add two new branches for `GEOMETRY_CLASS_BARS` and `GEOMETRY_CLASS_PANE`, mapping `(hasNeighborBefore, hasNeighborAfter)` to the correct variant ID: bars → both=5, solo=9, before=10, after=11; pane → both=7, solo=12, before=13, after=14
  - Expand `geometry_id` state array in `door_panel.json` from 0–8 to 0–14

  **Patterns to follow:**
  - Existing fence branch in `resolveGeometryId` (lines 33–42 of `MaterialRegistry.js`)

  **Test scenarios:**
  - Happy path: `resolveGeometryId` returns bars_both (5) when bars material has both neighbors
  - Happy path: `resolveGeometryId` returns bars_solo (9) when bars material has no neighbors
  - Happy path: `resolveGeometryId` returns bars_before (10) when bars material has only before-neighbor
  - Happy path: `resolveGeometryId` returns bars_after (11) when bars material has only after-neighbor
  - Happy path: same 4 scenarios for pane materials (IDs 7, 12, 13, 14)
  - Edge case: existing non-bars, non-pane, non-fence materials still return their geometry class unchanged

  **Verification:**
  - `npm test` passes with new MaterialRegistry tests covering all neighbor combinations for bars and pane classes

- [ ] **Unit 3: Update PanelRotation for pane and bars geometry classes**

  **Goal:** Panes and bars use the fence/slab rotation path instead of the flat-panel path

  **Requirements:** R1 (rotation affects collision alignment), R2, R3

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `bigdoors_bp/scripts/domain/PanelRotation.js`
  - Test: `tests/PanelRotation.test.mjs`

  **Approach:**
  - In `closedRotation`: add `GEOMETRY_CLASS_PANE` and `GEOMETRY_CLASS_BARS` to the fence/slab condition for the vertical-mode special case
  - In `openRotation`: same addition to the vertical-mode condition
  - Horizontal mode already falls through to the default path (rotations 0–3), which is correct for all three geometry classes

  **Patterns to follow:**
  - Existing `GEOMETRY_CLASS_FENCE || GEOMETRY_CLASS_SLAB` conditions in `PanelRotation.js`

  **Test scenarios:**
  - Happy path: `closedRotation("up", "north", GEOMETRY_CLASS_PANE)` returns 2 (same as fence)
  - Happy path: `closedRotation("up", "east", GEOMETRY_CLASS_BARS)` returns 1 (same as fence)
  - Happy path: `closedRotation("east", "north", GEOMETRY_CLASS_PANE)` returns 2 (horizontal mode, unchanged)
  - Happy path: `openRotation("vertical", "up", "north", "cw", GEOMETRY_CLASS_PANE)` returns 6 (same as fence)
  - Edge case: fence and slab rotations are unchanged (no regression)

  **Verification:**
  - `npm test` passes with new PanelRotation tests for pane and bars geometry classes

- [ ] **Unit 4: Update _neighborAxes and imports for pane and bars**

  **Goal:** Vertical-mode pane and bars panels check the correct perpendicular axis for neighbors; PanelPlacementHandler imports the necessary constants

  **Requirements:** R2, R3, R4

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js`
  - Test: `tests/PanelPlacementHandler.test.mjs`

  **Approach:**
  - Add `GEOMETRY_CLASS_PANE` and `GEOMETRY_CLASS_BARS` to the import from `Constants.js` (they are exported but not currently imported in PanelPlacementHandler)
  - In `_neighborAxes`: extend the vertical-mode fence condition to also include `GEOMETRY_CLASS_PANE` and `GEOMETRY_CLASS_BARS`
  - The horizontal-mode default path already works correctly for panes/bars (before = toward hinge, after = away from hinge)

  **Patterns to follow:**
  - Existing `isVertical && geoClass === GEOMETRY_CLASS_FENCE` block in `_neighborAxes`

  **Test scenarios:**
  - Happy path: place a pane material adjacent to a hinge on a horizontal-mode east-door — geometry resolves to pane_before (hinge is a valid same-assembly neighbor via `_hasAssemblyBlockAt`)
  - Happy path: place a second pane material extending east from the first — first panel updates to pane_both, second is pane_before (first has hinge neighbor + second panel, second has only first panel)
  - Happy path: place panes with no hinge or panel neighbors — geometry resolves to pane_solo
  - Integration: place a pane adjacent to a hinge, then a non-assembly block on the other side — pane stays pane_before (only the hinge-side connection counts; assembly-only rule blocks the non-assembly neighbor)
  - Edge case: vertical-mode assembly with pane material — neighbor axis uses perpendicular facing direction, not doorSide

  **Verification:**
  - `npm test` passes; in-game pane panels connect to same-assembly neighbors only

- [ ] **Unit 5: Fix collision boxes and add permutations for all pane/bars/fence variants including vertical-open**

  **Goal:** Every pane, bars, and fence geometry variant has correctly-oriented collision and selection boxes at both upright (0–3) and vertical-open (5–6) rotations

  **Requirements:** R1, R5

  **Dependencies:** Units 0, 1, 2, 3 (Unit 0 determines whether per-rotation collision permutations are needed; collision values must be defined assuming the fence rotation path from Unit 3, not the old flat-panel path)

  **Files:**
  - Modify: `bigdoors_bp/blocks/door_panel.json`

  **Approach:**
  - **Upright pane/bars collision (panel_rotation < 4):**
    - Fix the existing bars (ID 5) and pane (ID 7) collision/selection boxes: swap from `origin: [-1, 0, -8], size: [2, 16, 16]` to `origin: [-8, 0, -1], size: [16, 16, 2]` — the "both" variants
    - Add collision/selection permutations for each new variant ID (9–14), gated on `panel_rotation < 4`:
      - Solo (9, 12): small centered collision. Known limitation: Bedrock custom blocks support only one collision_box, so a cross-shaped geometry can't have pixel-accurate collision. Use a small square post (like fence solo but thinner) — "too small" is preferable to "too large" since invisible walls blocking empty space are worse than slightly permeable cross-arms
      - Before (10, 13): half-width collision extending from -8 to 0 on X
      - After (11, 14): half-width collision extending from 0 to +8 on X
  - **Vertical-open collision (panel_rotation 5 or 6) for fence, pane, and bars:**
    - Add collision permutations for fence IDs 1–4 at rotations 5–6: thin horizontal collision matching the post rotated 90° (walkable surface)
    - Add collision permutations for pane IDs 7, 12–14 at rotations 5–6: thin horizontal slab collision (the pane is now lying flat)
    - Add collision permutations for bars IDs 5, 9–11 at rotations 5–6: thin horizontal slab collision matching bars lying flat
    - The exact collision dimensions at rotations 5–6 depend on whether `minecraft:collision_box` rotates with `minecraft:transformation` — see deferred question. If collision rotates, the permutation uses local-space values that produce a thin horizontal slab after the 90° X-rotation. If collision does NOT rotate, use pre-rotated world-space values directly.
  - Also add geometry permutations mapping each new ID to its geometry identifier
  - Verify in-game by testing fence vertical-open collision first (thicker geometry makes misalignment obvious), then apply same approach to panes/bars
  - **Worked example (verify during implementation):** Consider a vertical-mode pane_both door facing north, doorSide=up. OLD path: closedRotation returns 5 (flat-panel), transformation rotates [90°, 90°, 0°], collision [-1, 0, -8] size [2, 16, 16]. NEW path: closedRotation returns 2 (fence), transformation rotates [0°, 180°, 0°], collision [-8, 0, -1] size [16, 16, 2]. The implementer should trace both the old and new transforms to confirm the new combination produces correct alignment — changing both collision values and rotation path simultaneously requires verifying their combined effect

  **Patterns to follow:**
  - Existing slab and fence collision permutations in `door_panel.json` (lines 139–282)
  - Geometry-to-permutation mappings (lines 89–137)

  **Test scenarios:**
  - Happy path: pane_both panel (ID 7) upright — player blocked when walking into the flat face, passes through perpendicular to it (collision now matches visual)
  - Happy path: bars_both panel (ID 5) upright — same correction
  - Happy path: pane_before (ID 13) upright — collision covers only the half extending toward hinge
  - Happy path: pane_solo (ID 12) upright — collision covers the center cross area
  - Happy path: fence at rotation 5 (vertical-open) — player can walk on top of the horizontally-tipped fence post; collision is thin-horizontal, not full-block
  - Happy path: pane_both at rotation 6 (vertical-open) — player can walk on top of the horizontally-tipped pane; collision is thin-horizontal
  - Happy path: bars_both at rotation 5 (vertical-open) — same walkable thin-horizontal collision
  - Edge case: rotations 4 and 7 (other vertical orientations) retain full-block collision
  - Integration: open a vertical-mode door with pane panels — collision transitions from upright-thin to horizontal-thin correctly

  **Verification:**
  - In-game: place pane/bars/fence panels, open door in vertical mode, walk on top of horizontally-rotated panels to confirm thin collision allows standing on them

- [ ] **Unit 6: Update InteractionHandler and RedstoneSubsystem for pane/bars vertical-mode geometry**

  **Goal:** Door open/close via player interaction and redstone correctly resolves pane/bars geometry variants in vertical mode

  **Requirements:** R2, R3

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `bigdoors_bp/scripts/handler/InteractionHandler.js`
  - Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
  - Test: `tests/InteractionHandler.test.mjs`
  - Test: `tests/RedstoneSubsystem.test.mjs`

  **Approach:**
  - Both files have hardcoded `geoClass === GEOMETRY_CLASS_FENCE` conditions for vertical-mode geometry resolution (`InteractionHandler.js:256`, `RedstoneSubsystem.js:336`). Extend these to include `GEOMETRY_CLASS_PANE` and `GEOMETRY_CLASS_BARS`
  - Add the new constants to imports in both files
  - Extract the duplicated `_resolveVerticalFenceGeo` method into a shared domain/utility function (MaterialRegistry is a natural home) since it now handles 3 geometry classes. Both files should call the shared function instead of maintaining identical copies
  - **Horizontal-mode fallback path:** The non-vertical fallback in both files (`InteractionHandler.js:260`, `RedstoneSubsystem.js:339`) sets `hasNeighborBefore = true` and infers `hasNeighborAfter` from panel index ordering. After this plan, `resolveGeometryId` returns different IDs based on these booleans. Verify that `assembly.panelPositions` is always ordered from hinge outward in horizontal mode — if so, this ordering invariant makes the fallback correct. If not, the fallback needs spatial neighbor resolution like the vertical path

  **Patterns to follow:**
  - The existing `_resolveVerticalFenceGeo` method in both files

  **Test scenarios:**
  - Happy path: open a vertical-mode door with pane panels via player interaction — geometry resolves correctly per neighbor context
  - Happy path: open a vertical-mode door with bars panels via player interaction — geometry resolves correctly
  - Happy path: open a vertical-mode door with pane panels via redstone — `_panelStates` resolves pane geometry correctly per neighbor context
  - Happy path: open a vertical-mode door with bars panels via redstone — `_panelStates` resolves bars geometry correctly
  - Happy path: close a vertical-mode door with pane panels via redstone — geometry returns to upright neighbor-aware variant
  - Edge case: horizontal-mode pane/bars doors are unaffected (vertical-mode condition does not trigger) — test in both InteractionHandler and RedstoneSubsystem
  - Edge case: fence vertical-mode behavior is unchanged (no regression) — test in both files

  **Verification:**
  - `npm test` passes with both InteractionHandler and RedstoneSubsystem tests covering pane/bars vertical-mode geometry resolution

- [ ] **Unit 7: Add block JSON integrity tests for geometry state expansion**

  **Goal:** Verify that the expanded geometry_id state space in `door_panel.json` is internally consistent and within Bedrock limits

  **Requirements:** R6

  **Dependencies:** Units 2, 5

  **Files:**
  - Test: `tests/DoorPanelJson.test.mjs`

  **Approach:**
  - Parse `bigdoors_bp/blocks/door_panel.json` in the test and validate structural invariants
  - These are static integrity checks, not runtime tests — they guard against manual JSON editing errors

  **Patterns to follow:**
  - Existing test structure in `tests/*.test.mjs`

  **Test scenarios:**
  - Happy path: `geometry_id` state values span exactly 0–14 (15 values)
  - Happy path: every nonzero `geometry_id` value has a corresponding geometry permutation mapping it to a geometry identifier
  - Happy path: every pane and bars geometry ID (5, 7, 9–14) has a collision/selection permutation for `panel_rotation < 4`
  - Happy path: every fence, pane, and bars geometry ID with neighbor variants has collision/selection permutations for `panel_rotation == 5` and `panel_rotation == 6`
  - Happy path: every geometry_id value referenced in collision/selection permutation conditions exists in the geometry_id state range (reverse integrity check)
  - Semantic: for pane and bars geometry IDs, the thin collision axis (the dimension with size=2) matches the expected thin geometry axis — catches the original "collision perpendicular to visual" bug class
  - Edge case: total permutation count (product of all state value counts) is <= 65,536
  - Edge case: no duplicate geometry_id values in the state array

  **Verification:**
  - `npm test` passes; integrity tests catch any future JSON edits that break geometry/collision consistency

## System-Wide Impact

- **State space**: geometry_id expands from 9 to 15 values, pushing total permutations from 36,864 to 61,440 (94% of the 65,536 limit). Future geometry classes will need to be budgeted carefully.
- **Permutation count in JSON**: Adding ~12 geometry permutations, ~6 upright collision pairs, and ~12 vertical-open collision pairs (for fence + pane + bars at rotations 5–6). The file is already large but this is within Bedrock's processing capability.
- **Door animation**: The rotation calculation for upright panes/bars in vertical mode changes from the flat-panel path (rotations 4–7) to the fence path (rotations 0–3). Horizontal-mode doors are unaffected (both paths produce the same rotations 0–3). Existing vertical-mode pane/bars doors that are currently OPEN will have stale `panel_rotation` values (4–5) stored in their block states — the new collision permutations are written for rotations 0–3, so collision will be incorrect until the door is closed and reopened. This is accepted as a known limitation since vertical-mode pane/bars doors are rare; no migration step is needed.
- **Vertical-open collision (new)**: Fence, pane, and bars panels at rotations 5–6 will transition from full-block collision to thin-horizontal collision. This is the desired behavior (walkable surfaces), but players who previously relied on the invisible full-block collision of vertically-opened fences may notice a change.
- **InteractionHandler / RedstoneSubsystem**: Both files have `geoClass === GEOMETRY_CLASS_FENCE` guards for vertical-mode geometry resolution. These must be extended for pane and bars classes (Unit 6), otherwise vertical-mode pane/bars doors will skip neighbor-aware geometry resolution during open/close.
- **Break handler**: When a pane/bars panel is broken, `_updateNeighborGeometry` on adjacent panels will re-resolve their geometry variant. This already works correctly for fences and will work for panes/bars since they use the same code path.
- **Backward compatibility**: Existing world panels with `geometry_id=5` (bars) or `geometry_id=7` (pane) display as the "both" variant, which matches their current full-width appearance.
- **Unchanged invariants**: Slab geometry, full-block panels, material matching, persistence, and all domain logic are untouched. Fence geometry shapes are unchanged — only fence collision at rotations 5–6 is affected.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| State space at 94% capacity limits future geometry additions — only 1 more geometry ID value can be added (headroom: 4,096 of 65,536) | Monitor; if more classes are needed, a block-splitting strategy (second block type for overflow geometry) is the most likely path. Add a comment to `Constants.js` next to `GEOMETRY_INDEX` documenting remaining headroom. Note: rotation-specific collision permutations (if needed per Unit 0 spike) increase JSON size but do NOT affect state space — they use existing `panel_rotation` values, not new ones |
| `minecraft:collision_box` may not rotate with `minecraft:transformation` | Verify in-game early in implementation; if collision is world-axis-aligned, add rotation-specific permutations (doubles collision entries but stays within permutation limits) |
| Pane/bars rotation change from flat-panel path to fence path could affect existing doors in-world | Existing horizontal-mode doors are unaffected (both paths produce rotations 0–3). Existing vertical-mode pane/bars doors that are currently OPEN will have stale rotation values (4–5) that map to different collision/geometry under the new scheme until the door is closed and reopened. This is accepted as a known limitation — vertical-mode pane/bars doors are rare. No migration step is needed; the door self-corrects on next interaction. |
| Vertical-open fence collision changes from full-block to thin-horizontal | This is intentionally desired behavior; existing fences lacked proper vertical-open collision and this fixes it |

## Sources & References

- Existing collision plan: `docs/plans/2026-05-17-006-feat-impersonated-block-collision-plan.md` — this plan supersedes Unit 2 of that plan (bars/pane collision) and extends it with neighbor-matching
- Fence geometry pattern: `bigdoors_rp/models/blocks/door_panel_fence.geo.json`
- Neighbor resolution: `bigdoors_bp/scripts/domain/MaterialRegistry.js:resolveGeometryId()`
- Rotation logic: `bigdoors_bp/scripts/domain/PanelRotation.js`
- Placement handler: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js`
