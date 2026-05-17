---
title: "feat: Vanilla slab parity — collision, orientation, and top/bottom variants"
type: feat
status: active
date: 2026-05-16
---

# feat: Vanilla slab parity — collision, orientation, and top/bottom variants

## Overview

Slab door panels currently have three problems: (1) full-block collision makes them impossible to step onto without jumping, (2) placing a slab on the underside of a hinge ignores the vanilla top/bottom orientation, and (3) vertical doors tip slabs sideways via X90 rotation instead of keeping them flat. This plan fixes all three by reading the vanilla block's `minecraft:vertical_half` state, adding a top-slab geometry variant, setting half-height collision/selection boxes, and giving slabs their own rotation logic that keeps them flat in all door modes.

## Problem Frame

When a player places a vanilla slab next to a hinge, Minecraft has already determined top/bottom placement based on where the player clicked (top half of face → top slab, bottom half → bottom slab, bottom face of block above → top slab). The mod currently ignores this information, always using a bottom-slab geometry. Additionally, the collision box is full-block (the default for custom blocks with no `minecraft:collision_box` component), and vertical doors apply X90 rotation which tips the slab sideways.

## Requirements Trace

- R1. Slab panels must have half-height (8px) collision and selection boxes matching their visual geometry
- R2. Placing a slab on the bottom face of a hinge must produce a top-slab (flush with ceiling), matching vanilla behavior
- R3. Vertical doors (doorSide up/down) must keep slab panels flat (horizontal), not tipped sideways
- R4. Door open/close animations must correctly rotate flat slabs (using fence-equivalent rotation logic)
- R5. The top/bottom variant must persist across save/load and open/close cycles
- R6. Existing slab doors (pre-update) must not break — graceful fallback for panels without stored geometryId

## Scope Boundaries

- Does NOT add double-slab (full block from two slabs) behavior
- Does NOT change fence, bars, or pane rotation logic
- Does NOT add waterlogging or slab-specific breaking behavior
- Does NOT address the visual texture/appearance of the slab geometry (only shape, collision, and orientation)

## Context & Research

### Relevant Code and Patterns

- `bigdoors_rp/models/blocks/door_panel_slab.geo.json` — current bottom-slab geometry (origin [-8, 0, -8], size [16, 8, 16])
- `bigdoors_rp/models/blocks/door_panel_fence.geo.json` — reference for multi-variant geometry (4 variants in one file)
- `bigdoors_bp/blocks/door_panel.json` — block definition with permutations for geometry, rotation, and (soon) collision
- `bigdoors_bp/scripts/handler/PanelPlacementHandler.js` — placement logic, reads placed block, assigns rotation + geometry
- `bigdoors_bp/scripts/handler/InteractionHandler.js` — player-initiated open/close, duplicates rotation logic
- `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js` — redstone open/close, duplicates rotation logic
- `bigdoors_bp/scripts/domain/DoorAssembly.js` — panel data model (materialIndex, closedPos, currentPos)
- `bigdoors_bp/scripts/domain/MaterialRegistry.js` — geometry resolution
- `bigdoors_bp/scripts/util/Constants.js` — geometry IDs, classes, material mappings

### Key Pattern: Fence Rotation in Vertical Mode

Fence posts in vertical doors use Y-only rotation for the closed state (N/S→2, E/W→1) and X90+Y for the open state (N/S→6, E/W→5). Slabs should follow this same pattern: flat when closed, tipped when open.

### Bedrock Constraint: Geometry X-Axis Mirror

Custom block geometry in Bedrock has a mirrored X axis. The established rotation mappings (east=2, south=1, west=0, north=3) account for this. The CW/CCW formulas are also inverted: CW = `(closed + 3) % 4`, CCW = `(closed + 1) % 4`.

### Bedrock Constraint: Collision Box Independence

`minecraft:collision_box` and `minecraft:selection_box` are specified in world-space and are NOT rotated by `minecraft:transformation`. Separate permutations are needed for different rotated collision shapes.

## Key Technical Decisions

- **Read `minecraft:vertical_half` from placed block**: The vanilla slab already has this state set correctly by Minecraft's placement logic. Reading it avoids reimplementing click-face detection. Rationale: matches vanilla behavior exactly with minimal code.
- **Add a `geometry.bigdoors.slab_top` geometry variant at geometry_id 8**: Following the fence pattern of multiple geometry IDs per class. Simpler than trying to flip via rotation (no X180 exists in the rotation set). Rationale: straightforward, uses established pattern.
- **Store `geometryId` in panel data**: The top/bottom choice must survive open/close cycles and persistence. Adding an optional field to the panel object (backward-compatible — old panels default to resolution as before). Rationale: general-purpose and works for any future geometry that varies per-panel.
- **Slab-specific rotation branch in all three rotation functions**: Slabs use fence-equivalent Y-only closed rotation and X90+Y open rotation. Rationale: keeps slabs flat when closed, tips correctly on open, reuses proven fence rotation values.
- **Collision box permutations gated by `geometry_id == 6 || geometry_id == 8` and `panel_rotation < 4`**: Only slabs in flat orientation (rotations 0-3) get half-height collision. When tipped (rotations 4-7, i.e., door is open), full-block collision is acceptable as a simplification. Rationale: avoids complex per-axis collision math for the transient open state.

## Open Questions

### Resolved During Planning

- **Should vertical slabs stay flat or become wall-slabs?** Stay flat — confirmed by user. Matches vanilla behavior.
- **Should collision be half-height or full-block?** Half-height — confirmed by user. Enables stepping onto slab doors.
- **How to determine top vs bottom?** Read `minecraft:vertical_half` from the vanilla block before conversion. The block event gives us the already-placed vanilla slab with its state set by Minecraft.

### Deferred to Implementation

- **Exact Molang condition syntax for compound permutations**: Need to verify whether `q.block_state('bigdoors:geometry_id') == 6 && q.block_state('bigdoors:panel_rotation') < 4` is valid in 1.26.0. Fallback if compound `&&` or `<` operators are unsupported: enumerate 8 individual permutations (4 rotations × 2 geometry IDs), each with equality conditions like `q.block_state('bigdoors:geometry_id') == 6 && q.block_state('bigdoors:panel_rotation') == 0`.
- **Whether `selection_box` should match `collision_box` exactly or use a slightly different size**: Will test in-game for targeting feel.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Placement Flow:
  Player places vanilla slab → Minecraft sets vertical_half state
  → PanelPlacementHandler.onPlace fires
  → Read block.permutation.getState("minecraft:vertical_half")
  → If "top": geometryId = 8 (slab_top), else: geometryId = 6 (slab)
  → Compute rotation (slab-specific: Y-only for all modes)
  → Store panel with geometryId in assembly
  → Set block permutation with geometry_id + rotation + collision

Rotation Logic (closed state):
  Horizontal door: east=2, south=1, west=0, north=3  (same as before)
  Vertical door:   N/S facing → 2, E/W facing → 1   (NEW: was 5/4 with X90)

Rotation Logic (open state):
  Horizontal door: CW=(closed+3)%4, CCW=(closed+1)%4  (same as before)
  Vertical door:   N/S → 6 (X90+Y180), E/W → 5 (X90+Y90)  (NEW: was 1/0)

Collision Permutations:
  geometry_id 6 + rotation 0-3 → collision [-8, 0, -8] size [16, 8, 16]
  geometry_id 8 + rotation 0-3 → collision [-8, 8, -8] size [16, 8, 16]
  geometry_id 6/8 + rotation 4-7 → default full-block (no override needed)
```

## Implementation Units

- [ ] **Unit 1: Add top-slab geometry and collision permutations**

**Goal:** Create the geometry file for top-slab and wire up collision/selection boxes in the block definition.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Create: `bigdoors_rp/models/blocks/door_panel_slab_top.geo.json`
- Modify: `bigdoors_bp/blocks/door_panel.json`
- Modify: `bigdoors_bp/scripts/util/Constants.js`

**Approach:**
- Create `geometry.bigdoors.slab_top` with cube origin [-8, 8, -8], size [16, 8, 16]
- Add geometry_id 8 permutation in door_panel.json mapping to this geometry
- Add collision_box + selection_box permutations for geometry_id 6 and 8 (flat rotations only)
- Add `GEOMETRY_ID_SLAB_TOP = 8` constant and update `GEOMETRY_INDEX`
- Add `isSlabGeometryId(geoId)` helper to Constants.js (returns true for 6 or 8) — this disambiguates geometry_class (always 6 for slabs) from geometry_id (6 for bottom, 8 for top). Code that needs "is this a slab?" should use the helper, not compare against GEOMETRY_CLASS_SLAB directly when working with resolved geometry IDs.

**Patterns to follow:**
- `bigdoors_rp/models/blocks/door_panel_slab.geo.json` for geometry file format
- Existing geometry permutations in door_panel.json (lines 33-60)

**Test expectation:** none — pure JSON/constant definitions, verified visually in-game

**Verification:**
- Placing a slab door panel and standing on it works without jumping
- The block's selection outline matches the visible slab shape
- A top-slab variant can be summoned via `/setblock` with geometry_id 8

---

- [ ] **Unit 2: Persist geometryId in panel data model**

**Goal:** Add an optional `geometryId` field to panel data so the top/bottom slab choice survives open/close cycles and world reload.

**Requirements:** R5, R6

**Dependencies:** Unit 1 (needs the constant)

**Files:**
- Modify: `bigdoors_bp/scripts/domain/DoorAssembly.js`
- Modify: `bigdoors_bp/scripts/DoorManager.js`
- Test: `tests/DoorAssembly.test.mjs` (create if absent, or add to existing)

**Approach:**
- Add optional `geometryId` to `addPanel(pos, materialIndex, geometryId)` — defaults to undefined
- Include in `toJSON()` only when defined (keeps JSON compact for full-block panels)
- Restore in `fromJSON()` — missing field means "resolve dynamically" (backward compat)
- Update `DoorManager.addPanelToAssembly` to accept and forward the geometryId

**Patterns to follow:**
- The existing `materialIndex` field in panel objects
- The `boundaryPanels` pattern for optional data

**Test scenarios:**
- Happy path: addPanel with geometryId stores and retrieves it via toJSON/fromJSON round-trip
- Happy path: addPanel without geometryId omits it from JSON (backward compat)
- Edge case: fromJSON with missing geometryId field sets undefined (no crash)

**Verification:**
- Panels with geometryId serialize and deserialize correctly
- Existing save data (without geometryId) loads without errors

---

- [ ] **Unit 3: Read vanilla slab state and assign geometry during placement**

**Goal:** PanelPlacementHandler reads `minecraft:vertical_half` from the placed vanilla slab block and uses it to choose between geometry_id 6 (bottom) or 8 (top).

**Requirements:** R2, R5

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js`
- Test: `tests/PanelPlacementHandler.test.mjs`

**Approach:**
- In `_placePanel`, before calling `resolveGeometryId`, check if geoClass is GEOMETRY_CLASS_SLAB
- If so, read `block.permutation.getState("minecraft:vertical_half")` from the source block
- Override geoId with GEOMETRY_ID_SLAB_TOP (8) if state is "top", else keep 6
- Pass the resolved geoId to `addPanelToAssembly`

**Patterns to follow:**
- Existing `block.permutation` usage in the codebase
- The fence neighbor resolution pattern (override geoId based on context)

**Test scenarios:**
- Happy path: placing a bottom-slab next to hinge produces geometry_id 6
- Happy path: placing a top-slab (clicking bottom face) produces geometry_id 8
- Integration: the geometryId is stored in the assembly panel data after placement

**Verification:**
- Placing a slab on the bottom face of a hinge creates a top-slab panel (flush with ceiling)
- Placing a slab on a side face creates a bottom-slab panel (sitting on floor)

---

- [ ] **Unit 4: Extract rotation logic to shared domain function and add slab branch**

**Goal:** Eliminate the three-way duplication of rotation logic by extracting `closedRotation` and `openRotation` into a shared domain module (`domain/PanelRotation.js`). Add the slab-specific branch (flat Y-only closed, X90+Y open) in the shared implementation. Replace inline rotation methods in all three consumers.

**Requirements:** R3, R4

**Dependencies:** Unit 1 (needs GEOMETRY_CLASS_SLAB constant, already exists)

**Files:**
- Create: `bigdoors_bp/scripts/domain/PanelRotation.js`
- Modify: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js`
- Modify: `bigdoors_bp/scripts/handler/InteractionHandler.js`
- Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Test: `tests/PanelRotation.test.mjs`

**Approach:**
- Create `domain/PanelRotation.js` exporting `closedRotation(doorSide, facing, geoClass)` and `openRotation(mode, facing, direction, geoClass)`
- No `@minecraft/server` imports — pure domain logic, fully testable
- Include fence, slab, and default branches in one place
- Slab vertical closed: N/S→2, E/W→1 (flat, Y-only — same values as fence)
- Slab vertical open: N/S→6 (X90+Y180), E/W→5 (X90+Y90) — same as fence
- Horizontal mode stays unchanged for all classes
- Remove `_panelRotation` from PanelPlacementHandler, `_closedRotation`/`_openRotation` from InteractionHandler and RedstoneSubsystem — replace with imports from the shared module

**Patterns to follow:**
- `bigdoors_bp/scripts/domain/RotationMath.js` — existing pure-domain rotation module

**Test scenarios:**
- Happy path: vertical slab door (doorSide up), facing north → closed rotation 2 (not 5)
- Happy path: vertical slab door (doorSide up), facing east → closed rotation 1 (not 4)
- Happy path: vertical slab door opens CW, facing north → open rotation 6
- Happy path: vertical slab door opens CCW, facing east → open rotation 5
- Happy path: horizontal slab door retains existing rotation values (east=2, south=1, west=0, north=3)
- Happy path: fence vertical closed/open values unchanged (N/S closed=2, open=6; E/W closed=1, open=5)
- Happy path: horizontal fence/full-block CW=(closed+3)%4, CCW=(closed+1)%4
- Edge case: non-slab geometries (bars, pane) in vertical mode still get X90 rotations (4/5)

**Verification:**
- All existing tests pass (rotation behavior unchanged for non-slab classes)
- Vertical slab door panels appear flat (horizontal) when closed
- Opening a vertical slab door tips the panels correctly
- Only one implementation of rotation logic exists (no duplication)

---

- [ ] **Unit 5: Use stored geometryId in open/close state resolution**

**Goal:** InteractionHandler and RedstoneSubsystem use the panel's stored geometryId (when present) instead of re-resolving, ensuring top-slab panels remain top-slabs through open/close.

**Requirements:** R4, R5

**Dependencies:** Unit 2, Unit 4

**Files:**
- Modify: `bigdoors_bp/scripts/handler/InteractionHandler.js`
- Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Test: `tests/RedstoneSubsystem.test.mjs`

**Approach:**
- In `_resolveGeoForPanel` (InteractionHandler) and `_panelStates` (RedstoneSubsystem): check if `panel.geometryId` is defined; if so, use it directly instead of calling resolveGeometryId
- This preserves the top-slab choice and is also a correct optimization for fence panels (though fences still need neighbor re-resolution, so only apply the shortcut for slab-class materials)

**Patterns to follow:**
- The fence-specific `_resolveVerticalFenceGeo` carve-out already demonstrates geo-class-specific resolution

**Test scenarios:**
- Happy path: opening a door with a top-slab panel (geometryId=8) produces geometry_id 8 in the open state
- Happy path: closing restores geometry_id 8
- Edge case: legacy panel without geometryId falls back to resolveGeometryId (returns 6)
- Integration: full open→close cycle on a mixed door (top-slab + bottom-slab panels) preserves each panel's variant through both InteractionHandler (player click) and RedstoneSubsystem (signal) code paths

**Verification:**
- A top-slab door panel remains a top-slab after open and close
- A bottom-slab door panel remains a bottom-slab after open and close
- Legacy saves (without geometryId) continue to work

## System-Wide Impact

- **Interaction graph:** PanelPlacementHandler now reads vanilla block state before converting. InteractionHandler and RedstoneSubsystem now read `panel.geometryId`. DoorAssembly serialization adds optional field.
- **Error propagation:** If `getState("minecraft:vertical_half")` returns null/undefined (non-slab block), the code falls back to bottom-slab. No crash path.
- **State lifecycle risks:** Adding a field to persisted panel data. Backward-compatible via optional field (undefined = resolve dynamically). Forward-compatible: if a user downgrades, the extra field is silently ignored by older fromJSON.
- **API surface parity:** Rotation logic is extracted to `domain/PanelRotation.js` — single source of truth for all three consumers. No sync risk.
- **Unchanged invariants:** Fence rotation logic, bars/pane rotation logic, full-block panel behavior, double-door detection, entity sweeping — all unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `minecraft:vertical_half` state name may differ in Bedrock 1.26.0 | Verify against Bedrock docs/in-game testing; fall back to checking if state is truthy |
| Compound Molang conditions in permutations may not work as expected | Test with simple `&&` first; if unsupported, use nested permutation ordering (later permutation overrides earlier) |
| Adding collision_box permutations increases block permutation count | Only 2-4 new permutations needed; well within Bedrock's limits |
| `GEOMETRY_CLASS_SLAB` (6) equals bottom-slab geometry_id (6) | `isSlabGeometryId()` helper ensures code checks the right thing; documented in Constants.js |

## Sources & References

- Related code: `bigdoors_rp/models/blocks/door_panel_fence.geo.json` (multi-variant geometry pattern)
- Related code: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js:220-236` (current slab rotation)
- Bedrock docs: Block states documentation for `minecraft:vertical_half`
- Memory: `feedback_bedrock_geometry_x_mirror.md` (X-axis mirror affects rotation mappings)
