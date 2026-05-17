---
title: "feat: Add material-matching hinge with iron straps overlay"
type: feat
status: active
date: 2026-05-16
origin: docs/brainstorms/2026-05-16-strapped-hinge-overlay-requirements.md
---

# feat: Add material-matching hinge with iron straps overlay

## Overview

Replace the fixed-texture hinge with two material-matching variants: a "Hinge" (straps visible on the entire assembly) and a "Hidden Hinge" (no straps anywhere). When a strapped Hinge is used, ALL blocks in the assembly (hinge + panels) display the iron straps overlay on their four side faces on top of their base material. The overlay texture rotates with the assembly mode: horizontal straps for horizontal doors, vertical straps for vertical doors. Top and bottom faces never show the overlay. Boundary panels in odd-width double doors suppress their straps. Before any panel is attached, the hinge displays a dedicated unmatched texture (`hinge.png`); once material-matched, it switches to the panel's material plus the hinge overlay.

## Problem Frame

The current hinge has a single opaque texture that visually breaks the door surface. Players want hinges that blend with their door material while the entire door shows cohesive hardware (iron straps). The solution uses Bedrock's nested-geometry technique — thin overlay planes on the four side faces — to overlay a straps texture on any base material without combinatorial texture files. (see origin: `docs/brainstorms/2026-05-16-strapped-hinge-overlay-requirements.md`)

## Requirements Trace

- R1. Custom geometry with inner full-block cube (base material) and thin overlay planes on the four side faces (N/S/E/W in local space)
- R2. Overlay planes use `alpha_test` render method
- R3. Four overlay PNGs: panel straps (H and V) and hinge straps (H and V). V variants derived by rotating the user-provided H textures 90°
- R4. Inner cube uses same material_group/material_id permutation system as door_panel
- R5. Auto-match: hinge adopts first adjacent panel's material (set-once)
- R6. Default hinge appearance before material-match is the dedicated `hinge.png` texture (not oak_planks). A reserved material index distinguishes unmatched from matched state
- R7. "Hinge" (`bigdoors:hinge`) is the primary item — entire assembly shows straps on side faces
- R8. "Hidden Hinge" (`bigdoors:hidden_hinge`) — no straps anywhere in the assembly
- R9. Dedicated hinge texture retired for matched hinges; both variants use material matching once a panel is attached
- R10. Both variants functionally identical (redstone, assembly, rotation)
- R11. Mixed hinge types can coexist in one assembly; the primary hinge (first placed) is canonical and determines overlay for the entire assembly
- R12. Door panels in a strapped assembly display straps overlay (same side-face overlay geometry)
- R13. Overlay texture rotates with mode: horizontal bands for horizontal mode, vertical bands for vertical mode. The geometry variant (not the texture) also changes for panels in vertical mode to compensate for the panel_rotation X-axis rotation
- R14. Boundary panels (center column in odd-width double doors) suppress straps
- R15. Overlay appears only on the four side faces (N/S/E/W in world space). Top and bottom faces never show the overlay. Interior side faces between adjacent blocks in a row are hidden by the adjacent opaque block; Hidden Hinge handles the semi-transparent block case

## Scope Boundaries

- One overlay style (iron straps) only — future: chains, bolts, etc.
- Java parity out of scope
- No reactive material updates — set-once on first adjacent panel
- No per-block end-cap awareness — all 4 side faces get overlay, interior faces hidden by adjacent blocks. Per-block exterior-only overlay (end caps on row/column edges) is a potential future enhancement
- Semi-transparent blocks (glass, bars, etc.) may show interior overlay faces between adjacent blocks — Hidden Hinge is the intended solution for those materials

## Context & Research

### Relevant Code and Patterns

- `bigdoors_bp/blocks/door_panel.json` — material_group/material_id permutation pattern (32,768 permutations currently: 16×16×16×8), geometry_id/panel_rotation states
- `bigdoors_bp/scripts/domain/MaterialRegistry.js` — `materialToBlockStates()` / `indexForTypeId()` for flat-index ↔ block-state conversion
- `bigdoors_bp/scripts/domain/PanelRotation.js` — `closedRotation()` returns 0-3 for horizontal mode (Y rotation only) and 4-7 for vertical mode (90° X rotation + Y rotation)
- `bigdoors_bp/scripts/handler/HingePlacementHandler.js` — hinge placement, assembly merging
- `bigdoors_bp/scripts/handler/PanelPlacementHandler.js` — panel placement, assembly detection, `_checkDoubleDoor`
- `bigdoors_bp/scripts/handler/BreakHandler.js` — dissolution logic, item drops
- `bigdoors_bp/scripts/main.js` — block component registration (`system.beforeEvents.startup`)
- `bigdoors_bp/scripts/DoorManager.js` — `addHingeToAssembly()`, `addPanelToAssembly()`, position indexing, `pairAndSplitAssemblies()` (creates boundary panels)
- `bigdoors_bp/scripts/domain/DoorAssembly.js` — serialization, `hingePositions` array, `panelPositions` and `boundaryPanels` arrays
- Existing geometry files (format 1.21.0): `bigdoors_rp/models/blocks/door_panel_bars.geo.json` etc. — use simple bone + cube structure with box UV

### Key Technical Context

- Block state budget: Bedrock max 65,536 permutations per block type.
  - Current door_panel: material_group(16) × material_id(16) × geometry_id(16) × panel_rotation(8) = 32,768.
  - With overlay(2, boolean): 32,768 × 2 = 65,536 — exactly at the limit. Overlay MUST be boolean [0, 1], not ternary. H vs V is derived from panel_rotation (0-3 = horizontal, 4-7 = vertical).
  - Hinge: facing(4) × mode(2) × door_side(7) × material_group(16) × material_id(16) = 14,336 — safe.
- The door_panel already has a `bigdoors:geometry_id` state (0=full_block, 1-8=fence/bars/slab/pane). The overlay only applies when geometry_id=0 (full block).
- Panel rotation 4-7 applies a 90° X-axis rotation (`minecraft:transformation`). This rotates local N/S faces to world UP/DOWN. The vertical overlay geometry must compensate by placing overlay planes on local UP/DOWN/E/W instead of N/S/E/W.
- Bedrock 1.26.0 format: `material_instances` components from multiple matching permutations MERGE (keys combine) rather than replace. This allows material permutations to set `"*"` and overlay permutations to set `"overlay"` independently, avoiding combinatorial explosion.

## Key Technical Decisions

- **Hinge keeps `bigdoors:hinge` ID**: Existing blocks gain material states; old hinges default to the unmatched index showing `hinge.png`.
- **Unmatched hinge texture**: A reserved material index (e.g., material_group=15, material_id=15) maps to `hinge.png` in the hinge block JSON. This is the default when first placed. When the first panel is attached, the handler updates to the panel's material index, switching to material-matched appearance + overlay.
- **Hidden Hinge is a new block**: `bigdoors:hidden_hinge` with identical states but uses full_block geometry (no overlay).
- **Panel overlay state is boolean (`bigdoors:overlay`)**: Values [0, 1] (none / strapped). H vs V derived from panel_rotation at the geometry and texture level. This keeps door_panel at exactly 65,536 permutations (the Bedrock limit). A ternary [0, 1, 2] overlay state would exceed the limit (98,304).
- **Side-face-only overlay via thin planes**: Instead of a full outer cube (which shows straps on all 6 faces), the overlay geometry uses 4 thin planes positioned just outside each side face. Top and bottom never get overlay. This matches the user's intent — straps wrap around the outside of the row/column, and interior connection faces are hidden by adjacent opaque blocks.
- **Two geometry variants for panel rotation**: Horizontal mode panels (rotation 0-3) use overlay planes on local N/S/E/W. Vertical mode panels (rotation 4-7) use overlay planes on local UP/DOWN/E/W, which become world N/S/E/W after the 90° X rotation. The hinge uses only the N/S/E/W variant since it only rotates around Y.
- **Separate panel and hinge overlay textures**: User-provided `door_panel_overlay.png` and `hinge_overlay.png` are the H variants. V variants created by rotating 90°. Four terrain_texture entries total.
- **Permutation merging for overlay textures**: Material permutations set `"*"` only. Overlay permutations (2 entries: one for H mode, one for V mode) set `"overlay"` only. Bedrock's 1.26.0 permutation component merging combines both into the final material_instances.
- **Material set-once**: First panel placed determines all hinge materials in the assembly. Subsequent panels don't change it.
- **DoorAssembly stores hinge type**: Each entry in `hingePositions` gains `type` ("hinge"/"hidden") and `materialIndex`. `fromJSON` defaults missing fields for backward compat.
- **Boundary panels suppress straps**: `pairAndSplitAssemblies` callers set overlay=0 on boundary panels' block permutations.

## Open Questions

### Resolved During Planning

- **Overlay state design**: Boolean `bigdoors:overlay` [0, 1] rather than ternary [0, 1, 2]. H/V derived from panel_rotation. A ternary state exceeds the 65,536 permutation limit.
- **Strap face selection**: Overlay on 4 side faces only (N/S/E/W in world space), no top/bottom. Interior faces hidden by adjacent blocks. Semi-transparent blocks use Hidden Hinge.
- **Strap rotation mechanism**: Two geometry variants handle panel rotation compensation. Two texture variants (H and V) per block type handle the visual rotation.
- **Boundary panel handling**: Boundary panels get overlay=0 at pair time. Simple and matches existing special-case logic in `pairAndSplitAssemblies`.
- **Mixed hinge semantics**: The primary hinge (first placed) is canonical and determines overlay for the entire assembly.
- **Unmatched hinge appearance**: Uses dedicated `hinge.png` texture via reserved material index. Transitions to material-matched + overlay when first panel is attached.
- **Straps texture art**: User-provided PNGs (`door_panel_overlay.png`, `hinge_overlay.png`) serve as the H variants. V variants derived by 90° rotation.

### Deferred to Implementation

- Whether 16.1 or 16.02 outer plane offset feels better in-game (start at 0.05px offset from face)
- Recipe design for both hinge variants
- Exact reserved material index for unmatched hinge state (suggested: material_group=15, material_id=15)
- Per-cube material_instance support and permutation merging — validated by Unit 0 spike before main implementation begins
- Vertical texture orientation under rotations 4-7 — validated by Unit 0 spike; fallback approaches documented in Unit 1

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌──────────────────────────────────────────────────────────────┐
│ BLOCK: bigdoors:hinge                                        │
│ States: facing, mode, door_side, material_group, material_id │
│ Geometry: geometry.bigdoors.strapped_sides (always overlaid) │
│   Inner cube: "*" = base material (or hinge.png if unmatched)│
│   4 side planes: "overlay" = hinge straps texture            │
│ Overlay texture selected by mode state:                      │
│   mode=horizontal → bigdoors_hinge_overlay_h                 │
│   mode=vertical   → bigdoors_hinge_overlay_v                 │
│ Unmatched state (material_group=15, material_id=15):         │
│   "*" = hinge.png texture, geometry = full_block (no overlay)│
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ BLOCK: bigdoors:hidden_hinge                                 │
│ States: facing, mode, door_side, material_group, material_id │
│ Geometry: minecraft:geometry.full_block (no overlay)         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ BLOCK: bigdoors:door_panel                                   │
│ States: material_group, material_id, geometry_id,            │
│         panel_rotation, overlay                              │
│ overlay=0 → existing geometry, opaque material only          │
│ overlay=1, rotation 0-3 → strapped_sides.geo.json            │
│   "overlay" = bigdoors_panel_overlay_h                       │
│ overlay=1, rotation 4-7 → strapped_sides_v.geo.json          │
│   "overlay" = bigdoors_panel_overlay_v                       │
│ Permutation budget: 16×16×16×8×2 = 65,536 (at limit)        │
└──────────────────────────────────────────────────────────────┘

GEOMETRY: strapped_sides.geo.json (shared by hinge + horizontal panels)
  Bone "root":
    Inner cube: origin [-8, 0, -8] size [16,16,16]  → material "*"
    N plane:    origin [-8, 0, -8.05] size [16,16,0.1] → material "overlay"
    S plane:    origin [-8, 0, 7.95]  size [16,16,0.1] → material "overlay"
    E plane:    origin [7.95, 0, -8]  size [0.1,16,16] → material "overlay"
    W plane:    origin [-8.05, 0, -8] size [0.1,16,16] → material "overlay"

GEOMETRY: strapped_sides_v.geo.json (vertical panels only)
  Same structure but overlay planes on UP/DOWN/E/W instead of N/S/E/W.
  After 90° X rotation (panel_rotation 4-7), these become world N/S/E/W.

FLOW: Panel Placement
  1. Player places material block next to hinge/panel
  2. PanelPlacementHandler converts it to door_panel
  3. Determines overlay value from assembly:
     - Assembly has strapped hinge → overlay = 1
     - Assembly has hidden hinge → overlay = 0
  4. Sets panel permutation with material states + overlay + panel_rotation
     - panel_rotation encodes mode; geometry permutations select
       strapped_sides (rotation 0-3) or strapped_sides_v (rotation 4-7)
     - overlay permutations select H or V texture independently
  5. If first panel in assembly, updates hinge material states from
     unmatched index to panel's material index

FLOW: Hinge Material Transition
  1. Hinge placed → material_group=15, material_id=15 (unmatched)
     → hinge.json permutation shows hinge.png, full_block geometry
  2. First panel placed adjacent:
     a. Handler calls setHingeMaterialIndex(assemblyId, panelMatIdx)
     b. Handler updates hinge block permutation to matched material
     c. Hinge now shows: material texture + overlay geometry + straps

NOTE: Mode is set atomically with the first panel placement (no pre-existing
panels to update). There is no "mode change after panels exist" scenario —
mode is determined once and locked. No separate flow needed.

FLOW: Double Door Pairing
  pairAndSplitAssemblies() handles data only (splits panel arrays).
  The CALLER (PanelPlacementHandler._checkDoubleDoor or
  HingePlacementHandler._detectDoubleDoor) updates boundary panel
  block permutations to overlay=0 after pairing completes.
  - Boundary panels get overlay=0 (straps suppressed)
  - Non-boundary panels retain their overlay value
```

## Implementation Units

- [ ] **Unit 0: Spike — verify permutation merging and per-cube material_instance**

**Goal:** Validate the two load-bearing Bedrock engine assumptions before committing to the full implementation.

**Requirements:** All (blocking prerequisite)

**Dependencies:** None

**Files:**
- Create: `bigdoors_bp/blocks/test_overlay_spike.json` (temporary, delete after verification)
- Create: `bigdoors_rp/models/blocks/test_overlay_spike.geo.json` (temporary)

**Approach:**
- Create a minimal test block with 2 states: `test_material` [0, 1] and `test_overlay` [0, 1] (4 permutations total)
- Geometry: 1 inner cube + 1 overlay plane, with per-cube `material_instance` property assigning `"overlay"` to the plane
- Two permutation entries: one sets `"*"` based on `test_material`, another sets `"overlay"` based on `test_overlay`
- Place in-game and verify:
  1. Per-cube material_instance works (overlay plane renders differently from inner cube)
  2. Permutation merging works (both `"*"` and `"overlay"` resolve correctly when set by separate permutations)
  3. Vertical texture orientation: place a block with `strapped_sides_v` geometry + V texture under all 4 rotation transforms (panel_rotation 4-7) and confirm vertical bands appear vertical on all world-side faces
- **If per-cube material_instance fails:** switch to separate bones (one bone for inner cube, one for overlay planes). Each bone name maps to a material_instance key.
- **If permutation merging fails:** each material permutation must include the `"overlay"` entry alongside `"*"`. This is verbose but mechanical — script-generate the JSON. Document the generation script in the plan.
- Delete test block files after verification.

**Test scenarios:**
- In-game visual verification only

**Verification:**
- Both assumptions confirmed OR fallback approach documented and integrated into subsequent units

---

- [ ] **Unit 1: Custom geometry files**

**Goal:** Create the side-face overlay geometry for both horizontal and vertical panel orientations.

**Requirements:** R1, R2, R15

**Dependencies:** None

**Files:**
- Create: `bigdoors_rp/models/blocks/strapped_sides.geo.json`
- Create: `bigdoors_rp/models/blocks/strapped_sides_v.geo.json`

**Approach:**
- Both files use geometry format 1.21.0 (matching existing project geometries)
- Each has one bone with 5 cubes: inner [−8, 0, −8] size [16,16,16] plus 4 thin overlay planes
- `strapped_sides.geo.json`: overlay planes on N, S, E, W faces (positioned 0.05px outside the block face)
- `strapped_sides_v.geo.json`: overlay planes on UP, DOWN, E, W faces (compensates for panel_rotation 4-7 X-axis rotation — after rotation these become world N/S/E/W)
- **Rotation math note:** Panel rotations 4-7 all include 90° X but vary in Y (0°, 90°, 180°, 270°). All 4 variants place the UP/DOWN/E/W planes onto world-space side faces, but the Y rotation may affect texture orientation (bands appearing rotated). Verify in-game during Unit 0 spike that V texture bands appear vertical on all world-space side faces for rotations 4, 5, 6, and 7. If bands rotate incorrectly for some Y values, solutions: (a) use `per_face` UV remapping in the geometry, (b) create per-rotation geometry variants, or (c) make the V texture rotationally symmetric (4-way tileable strap pattern).
- Inner cube uses default material instance (`"*"`)
- Overlay planes use named material instance (`"overlay"`) — verify per-cube `material_instance` property support in format 1.21.0; if unsupported, split into separate bones (validated in Unit 0 spike)
- Plane thickness: 0.1px (e.g., size [16, 16, 0.1] for N/S planes). Thin enough that edge faces are invisible
- Both geometry files shared by hinge and panel blocks (texture determined by block JSON material_instances)

**Patterns to follow:**
- `bigdoors_rp/models/blocks/door_panel_bars.geo.json` — bone/cube structure and format version

**Test scenarios:**
- Test expectation: none — static asset files validated visually in-game

**Verification:**
- Both geometry files are valid JSON with format 1.21.0
- Each has 5 cubes: 1 inner full block + 4 thin overlay planes
- `strapped_sides`: overlay planes on N/S/E/W
- `strapped_sides_v`: overlay planes on UP/DOWN/E/W
- Overlay planes reference the `"overlay"` material instance

---

- [ ] **Unit 2: Straps overlay textures and hinge base texture**

**Goal:** Install the user-provided overlay PNGs, create rotated V variants, and add terrain_texture entries.

**Requirements:** R3, R6

**Dependencies:** None

**Files:**
- Move: `door_panel_overlay.png` → `bigdoors_rp/textures/blocks/door_panel_overlay_h.png`
- Create: `bigdoors_rp/textures/blocks/door_panel_overlay_v.png` (90° rotation of H)
- Move: `hinge_overlay.png` → `bigdoors_rp/textures/blocks/hinge_overlay_h.png`
- Create: `bigdoors_rp/textures/blocks/hinge_overlay_v.png` (90° rotation of H)
- Move: `hinge.png` → `bigdoors_rp/textures/blocks/hinge_unmatched.png`
- Modify: `bigdoors_rp/textures/terrain_texture.json`

**Approach:**
- User-provided H textures are 16×16 PNGs with alpha channel showing horizontal iron strap bands
- V variants are the same texture rotated 90° clockwise to show vertical bands
- `hinge.png` is the unmatched hinge appearance — renamed to `hinge_unmatched.png` to distinguish from the retired `hinge.png`
- Add terrain_texture entries: `"bigdoors_panel_overlay_h"`, `"bigdoors_panel_overlay_v"`, `"bigdoors_hinge_overlay_h"`, `"bigdoors_hinge_overlay_v"`, `"bigdoors_hinge_unmatched"`
- (Retired texture entry removal handled in Unit 12)

**Patterns to follow:**
- Existing terrain_texture.json entry format

**Test scenarios:**
- Test expectation: none — visual assets

**Verification:**
- terrain_texture.json has all 5 new entries
- All PNGs are 16×16 with alpha transparency
- V variants show bands rotated 90° from H variants

---

- [ ] **Unit 3: Update hinge block JSON — material states + overlay geometry**

**Goal:** Add material states to the hinge block and wire up the side-face overlay geometry with mode-driven overlay texture. Include unmatched state.

**Requirements:** R1, R2, R4, R6, R7, R9, R13

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `bigdoors_bp/blocks/hinge.json`

**Approach:**
- Add states: `"bigdoors:material_group": [0..15]`, `"bigdoors:material_id": [0..15]`
- Default geometry: `geometry.bigdoors.strapped_sides` (always has overlay when matched)
- Material instances: `"*"` = base material (opaque, permuted by material states), `"overlay"` = straps texture (alpha_test)
- Overlay texture selection via permutations (2 entries, merged with material permutations):
  - mode=horizontal → `"overlay": { "texture": "bigdoors_hinge_overlay_h", "render_method": "alpha_test" }`
  - mode=vertical → `"overlay": { "texture": "bigdoors_hinge_overlay_v", "render_method": "alpha_test" }`
- Material texture permutations: same 200+ entry pattern as door_panel.json
- **Unmatched state permutation**: condition `material_group == 15 && material_id == 15` → geometry = `minecraft:geometry.full_block`, material_instances = `{ "*": { "texture": "bigdoors_hinge_unmatched", "render_method": "opaque" } }`. This permutation must be listed AFTER material and overlay permutations so it overrides both.
- Total permutations: 4 × 2 × 7 × 16 × 16 = 14,336 (well under limit)

**Patterns to follow:**
- `bigdoors_bp/blocks/door_panel.json` material permutations

**Test scenarios:**
- Test expectation: none — JSON block definition validated at engine load time

**Verification:**
- Hinge has all states: facing, mode, door_side, material_group, material_id
- Permutation count = 14,336 (under limit)
- Overlay texture switches based on mode state
- Unmatched state (15, 15) shows `hinge_unmatched` texture with full_block geometry

---

- [ ] **Unit 4: Create hidden_hinge block JSON**

**Goal:** Define the Hidden Hinge block — material-matched, no overlay.

**Requirements:** R8, R10

**Dependencies:** None

**Files:**
- Create: `bigdoors_bp/blocks/hidden_hinge.json`

**Approach:**
- Same states as hinge: facing, mode, door_side, material_group, material_id
- Geometry: `minecraft:geometry.full_block` (no overlay)
- Single material instance `"*"`: opaque, permuted by material states
- Same functional components: destructible_by_mining, loot (empty), redstone_consumer, redstone_conductivity
- Custom component: `bigdoors:hidden_hinge_component`
- Unmatched state (15, 15): shows `bigdoors_hinge_unmatched` texture (same as regular hinge before match)

**Patterns to follow:**
- `bigdoors_bp/blocks/hinge.json` for structure
- `bigdoors_bp/blocks/door_panel.json` for material permutations

**Test scenarios:**
- Test expectation: none — JSON block definition

**Verification:**
- Has all 5 states matching hinge block
- Uses full_block geometry, opaque render, no overlay
- Unmatched state shows `hinge_unmatched` texture

---

- [ ] **Unit 5: Update door_panel block JSON — add overlay state**

**Goal:** Add a boolean `overlay` state to the door_panel block so panels can conditionally show straps on their side faces.

**Requirements:** R12, R13, R14, R15

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `bigdoors_bp/blocks/door_panel.json`

**Approach:**
- Add state: `"bigdoors:overlay": [0, 1]` (none / strapped). Boolean, NOT ternary — a ternary state would exceed the 65,536 permutation limit.
- H vs V is derived from panel_rotation at the permutation level:
  - `overlay == 1 && geometry_id == 0 && panel_rotation < 4` → `geometry.bigdoors.strapped_sides` + `"overlay": { "texture": "bigdoors_panel_overlay_h", "render_method": "alpha_test" }`
  - `overlay == 1 && geometry_id == 0 && panel_rotation >= 4` → `geometry.bigdoors.strapped_sides_v` + `"overlay": { "texture": "bigdoors_panel_overlay_v", "render_method": "alpha_test" }`
- These overlay permutations set `"overlay"` material instance only; material permutations set `"*"` only. Both merge via Bedrock's permutation component merging. If merging is not supported, fallback: include `"overlay"` entry in every material permutation (mechanical duplication).
- Existing material and geometry_id permutations remain unchanged
- Total permutations: 16 × 16 × 16 × 8 × 2 = 65,536 (exactly at limit)
- Non-full-block geometries (fence, bars, slab, pane) ignore overlay — their geometry_id permutations take precedence and do not include overlay planes

**Patterns to follow:**
- Existing material and geometry_id permutation patterns in the same file
- Existing `panel_rotation < 4` condition pattern used for slab collision boxes

**Test scenarios:**
- Test expectation: none — JSON block definition

**Verification:**
- Panel has 5 states: material_group, material_id, geometry_id, panel_rotation, overlay
- overlay=0 shows no straps; overlay=1 shows straps with correct orientation based on panel_rotation
- Correct geometry variant selected: strapped_sides for rotation 0-3, strapped_sides_v for rotation 4-7
- Non-full-block geometries (fence, bars) ignore overlay
- Permutation count = 65,536 (exactly at limit)

---

- [ ] **Unit 6: Update Constants and DoorAssembly for hinge types**

**Goal:** Add hidden_hinge constant and extend assembly serialization for hinge type tracking.

**Requirements:** R10, R11

**Dependencies:** None

**Files:**
- Modify: `bigdoors_bp/scripts/util/Constants.js`
- Modify: `bigdoors_bp/scripts/domain/DoorAssembly.js`
- Test: `tests/DoorAssembly.test.mjs`

**Approach:**
- Add `HIDDEN_HINGE_BLOCK_ID = "bigdoors:hidden_hinge"` and `UNMATCHED_MATERIAL_INDEX` to Constants. The unmatched index is the flat index corresponding to material_group=15, material_id=15 (or whichever reserved slot is chosen).
- Change `hingePositions` entries from `{x, y, z}` to `{x, y, z, type, materialIndex}`
  - `type`: `"hinge"` or `"hidden"`
  - `materialIndex`: flat material index (default = UNMATCHED_MATERIAL_INDEX)
- Material-set detection uses `materialIndex !== UNMATCHED_MATERIAL_INDEX` — no separate boolean needed
- Update constructor to include `type` and `materialIndex` when pushing `primaryHingePos` into `hingePositions`
- Update `addHinge(pos, type = "hinge")` signature
- Update `DoorManager.createAssembly()` to accept a `type` parameter and pass it to the DoorAssembly constructor
- Add `hingeType` getter that returns the type of `hingePositions[0]` (the first hinge placed — same as `primaryHingePos`). This determines assembly overlay behavior.
- Update `toJSON()` / `fromJSON()` — `fromJSON` defaults missing `type` to `"hinge"`, missing `materialIndex` to UNMATCHED_MATERIAL_INDEX

**Patterns to follow:**
- `panelPositions` entries already carry `materialIndex`

**Test scenarios:**
- Happy path: Create assembly, add hinge with type "hidden", serialization round-trips
- Happy path: Add hinge with materialIndex set, toJSON includes it
- Edge case: fromJSON with legacy data (no type/materialIndex) defaults correctly
- Edge case: Mixed hinge types in same assembly — `hingeType` returns primary hinge's type
- Edge case: Assembly with only hidden hinges — `hingeType` returns "hidden"

**Verification:**
- Existing tests pass
- New tests confirm backward-compatible deserialization and type tracking

---

- [ ] **Unit 7: Register hidden_hinge component + update HingePlacementHandler**

**Goal:** Wire up the hidden_hinge block component and update the handler to recognize both hinge types.

**Requirements:** R10, R11

**Dependencies:** Unit 4, Unit 6

**Files:**
- Modify: `bigdoors_bp/scripts/main.js`
- Modify: `bigdoors_bp/scripts/handler/HingePlacementHandler.js`
- Test: `tests/HingePlacementHandler.test.mjs` (create if needed)

**Approach:**
- Register `bigdoors:hidden_hinge_component` in startup subscriber (same handler wiring as `bigdoors:hinge_component`: onPlayerInteract, onPlayerBreak, beforeOnPlayerPlace, onRedstoneUpdate)
- `beforeOnPlayerPlace` resolves facing/mode/door_side plus default material states (UNMATCHED_MATERIAL_INDEX)
- Update the `playerPlaceBlock` subscription filter to accept both `HINGE_BLOCK_ID` and `HIDDEN_HINGE_BLOCK_ID` (current filter only checks `!== HINGE_BLOCK_ID`)
- Determine type from `event.block.typeId`
- Pass type to `manager.createAssembly()` and `manager.addHingeToAssembly()`
- Mixed merging: any hinge type can merge with any existing assembly (R11)
- **Critical: preserve block ID** — all `BlockPermutation.resolve()` calls for hinges must resolve against the placed block's `typeId` (or the stored hinge entry type), NOT a hardcoded `HINGE_BLOCK_ID`. This prevents hidden hinges from being converted to regular hinges when merging or updating states.

**Patterns to follow:**
- Existing `bigdoors:hinge_component` registration block in main.js
- Current `HingePlacementHandler.register()` / `onPlace()`

**Test scenarios:**
- Happy path: Place hidden hinge — creates assembly with type "hidden"
- Happy path: Place regular hinge — creates assembly with type "hinge"
- Integration: Place hidden hinge adjacent to regular hinge — merges into same assembly
- Edge case: Place hidden hinge adjacent to another hidden hinge — merges correctly

**Verification:**
- Hidden hinge triggers all handlers identically to regular hinge
- Both hinge types create/merge assemblies with correct type tracking

---

- [ ] **Unit 8: Update PanelPlacementHandler — overlay assignment + hinge material matching**

**Goal:** When panels are placed, assign the correct overlay state based on assembly hinge type. Also set hinge material on first panel, transitioning from unmatched to matched appearance.

**Requirements:** R5, R6, R7, R12, R13

**Dependencies:** Unit 5, Unit 6, Unit 7

**Files:**
- Modify: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js`
- Modify: `bigdoors_bp/scripts/DoorManager.js`
- Test: `tests/PanelPlacementHandler.test.mjs` (existing or create)

**Approach:**
- **HIDDEN_HINGE_BLOCK_ID recognition**: Update `register()` filter (line 55-59) to also exclude `HIDDEN_HINGE_BLOCK_ID` from vanilla-block processing. Update `onPlace()` neighbor checks (line 76) to recognize `HIDDEN_HINGE_BLOCK_ID` as a hinge neighbor. Update `_hasAssemblyBlockAt()` (line 200) to include `HIDDEN_HINGE_BLOCK_ID` in the typeId check.
- When converting a block to door_panel, determine overlay value:
  - Check assembly's `hingeType`: if "hinge" → overlay = 1. If "hidden" → overlay = 0.
- Store `overlay` value on the panelPositions entry (for Unit 11 movement preservation)
- Include overlay in the `BlockPermutation.resolve()` call alongside material_group/material_id/panel_rotation
- The panel_rotation (set by `closedRotation()`) already encodes H vs V mode. The block JSON permutations select the correct overlay geometry (strapped_sides vs strapped_sides_v) and texture (H vs V) based on both overlay and panel_rotation.
- Add `setHingeMaterialIndex(assemblyId, materialIndex)` to DoorManager — updates all hinge entries' materialIndex in the data model. This is data-only; DoorManager does not touch blocks.
- Update `DoorManager.resetAssembly()` to also reset hinge materialIndex fields back to `UNMATCHED_MATERIAL_INDEX` (currently it clears panelPositions, boundaryPanels, doorSide, mode, isOpen, openDirection but would leave stale materialIndex values)
- The handler (PanelPlacementHandler) is responsible for updating the actual hinge block permutations after calling `setHingeMaterialIndex`. It already has dimension access. Iterate `assembly.hingePositions`, call `dimension.getBlock(pos).setPermutation()` using the entry's `type` to resolve the correct block ID (`HINGE_BLOCK_ID` or `HIDDEN_HINGE_BLOCK_ID`). The material states change from the unmatched index to the panel's material index.
- After first `addPanelToAssembly()`, check if `assembly.hingePositions[0].materialIndex === UNMATCHED_MATERIAL_INDEX` — if so, call `setHingeMaterialIndex` then update hinge blocks
- Use `panelBlockStates(matIdx, geoId, rotation, overlay)` (extend with 4th overlay param) in all `BlockPermutation.resolve(PANEL_BLOCK_ID, ...)` calls, replacing direct `materialToBlockStates()` usage for panels
- Also update `_updateNeighborGeometry()` (line 233) to use `panelBlockStates()` with overlay when rebuilding neighbor permutations. Read overlay from the panel's stored `panelPositions` entry.
- Also update `RedstoneSubsystem._findSourceNeighbor()` to recognize `HIDDEN_HINGE_BLOCK_ID` as a valid source

**Patterns to follow:**
- Existing `panelBlockStates(matIdx, geoId, rotation)` in MaterialRegistry.js (line 62-69) — extend with overlay parameter
- `DoorManager.setDoorSide()` / `setMode()` pattern for the data-only method
- Handler-side block mutation pattern: handlers already do `dimension.getBlock().setPermutation()` for hinge facing/mode/door_side updates

**Test scenarios:**
- Happy path: Place panel next to strapped hinge — panel gets overlay=1
- Happy path: Place panel next to hidden hinge — panel gets overlay=0
- Happy path: First panel sets hinge material to match (transitions from unmatched to matched)
- Happy path: Second panel does NOT change hinge material (set-once)
- Edge case: Assembly with multiple hinges — all hinges get material set on first panel
- Edge case: Mixed hinge types in assembly — overlay determined by primary hinge type

**Verification:**
- Panels receive correct overlay state based on assembly
- Hinge material updates on first panel only
- Hinge transitions from `hinge_unmatched` texture to material-matched + overlay

---

- [ ] **Unit 9: Update BreakHandler for both hinge types**

**Goal:** Drop correct item type when hinge is broken.

**Requirements:** R10

**Dependencies:** Unit 6

**Files:**
- Modify: `bigdoors_bp/scripts/handler/BreakHandler.js`
- Test: `tests/BreakHandler.test.mjs`

**Approach:**
- `handleHingeBreak`: look up hinge entry in assembly to get `type` field
- Drop correct item: HINGE_BLOCK_ID for "hinge", HIDDEN_HINGE_BLOCK_ID for "hidden"
- Dissolution logic already handles panels (restores vanilla blocks) — no change needed there

**Patterns to follow:**
- Current `handleHingeBreak` logic

**Test scenarios:**
- Happy path: Break regular hinge — drops `bigdoors:hinge`
- Happy path: Break hidden hinge — drops `bigdoors:hidden_hinge`
- Happy path: Break in creative — no drops for either type
- Integration: Dissolve assembly with mixed hinges — each drops correctly

**Verification:**
- Correct item type drops for each variant
- Creative mode suppresses drops for both

---

- [ ] **Unit 10: Update pairAndSplitAssemblies — suppress boundary panel straps**

**Goal:** When double doors pair and create boundary panels, set their overlay to 0 (no straps).

**Requirements:** R14

**Dependencies:** Unit 5, Unit 8

**Files:**
- Modify: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js`
- Modify: `bigdoors_bp/scripts/handler/HingePlacementHandler.js`
- Test: `tests/PanelPlacementHandler.test.mjs`

**Approach:**
- `pairAndSplitAssemblies()` remains a pure data operation (no dimension access) — consistent with current architecture
- The callers (`PanelPlacementHandler._checkDoubleDoor` and `HingePlacementHandler._detectDoubleDoor`) already have dimension access
- After `pairAndSplitAssemblies()` returns, the caller iterates boundary panels and calls `getBlock().setPermutation()` to set overlay=0
- Boundary panels in the assembly data don't need a special flag — their overlay is set on the block itself

**Patterns to follow:**
- Existing caller pattern: `_checkDoubleDoor` already calls `pairAndSplitAssemblies` then could do post-processing
- `BlockPermutation.resolve()` pattern used throughout handlers

**Test scenarios:**
- Happy path: Pair two strapped assemblies — boundary panels get overlay=0
- Happy path: Pair two hidden assemblies — boundary panels already have overlay=0, no change
- Edge case: Unpair assemblies — boundary panels rejoin assembly, should their overlay be restored? (Defer: leave as 0 for now, acceptable UX)

**Verification:**
- Center-column panels in odd-width double doors show no straps after pairing

---

- [ ] **Unit 11: Preserve overlay state during open/close movement**

**Goal:** Ensure panels retain their overlay state when InteractionHandler and RedstoneSubsystem recreate panel blocks during door open/close.

**Requirements:** R7, R12, R13

**Dependencies:** Unit 5, Unit 6, Unit 8

**Files:**
- Modify: `bigdoors_bp/scripts/handler/InteractionHandler.js`
- Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Test: `tests/InteractionHandler.test.mjs`

**Approach:**
- Both InteractionHandler (`_open`, `_close`) and RedstoneSubsystem (`_openWithRedstone`, `_closeSingleAssembly`) rebuild panel blocks using `BlockPermutation.resolve(PANEL_BLOCK_ID, materialToBlockStates(t.materialIndex))`. This loses the overlay state.
- **Approach: store overlay per panelPositions entry.** Each entry in `panelPositions` gains an `overlay` field (0 or 1) set at placement time by PanelPlacementHandler (Unit 8). Movement code reads `panel.overlay` directly without recomputing from hinge type. This keeps movement paths simple and decoupled from hinge-type logic.
- Use the existing `panelBlockStates(materialIndex, geoId, rotation)` function (MaterialRegistry.js line 62-69) — extend it with a 4th parameter `overlay` to include `"bigdoors:overlay"` in the returned states object. Use this in all four movement code paths.
- **Boundary panels are static** — they don't move during open/close (they're the center column in odd-width double doors). Movement code only iterates `panelPositions`, never `boundaryPanels`. No boundary panel handling needed here.

**Patterns to follow:**
- Current tuple-based movement pattern in InteractionHandler
- `materialToBlockStates()` in MaterialRegistry

**Test scenarios:**
- Happy path: Open strapped door — destination panels have overlay=1
- Happy path: Close strapped door — closed panels retain overlay=1
- Happy path: Open hidden door — panels retain overlay=0
- Edge case: Boundary panels in a strapped double door — remain overlay=0 after movement
- Integration: Redstone-triggered open/close preserves overlay same as manual

**Verification:**
- Panels do not lose their straps appearance after being moved by interaction or redstone
- Boundary panels remain strapless after movement

---

- [ ] **Unit 12: Lang strings and texture cleanup**

**Goal:** Add display names for both hinge variants and remove retired texture references.

**Requirements:** R7, R9

**Dependencies:** Unit 3, Unit 4

**Files:**
- Modify: `bigdoors_rp/texts/languages.json` (or create en_US.lang)
- Modify: `bigdoors_rp/textures/terrain_texture.json`

**Approach:**
- Add: `tile.bigdoors:hinge.name=Hinge`, `tile.bigdoors:hidden_hinge.name=Hidden Hinge`
- Remove `bigdoors_hinge_active` from terrain_texture.json
- Repurpose `bigdoors_hinge` entry to point to `hinge_unmatched` (or remove and use new entry name)
- Delete: `bigdoors_rp/textures/blocks/hinge_active.png`

**Patterns to follow:**
- Standard Bedrock lang format

**Test scenarios:**
- Test expectation: none — localization and cleanup

**Verification:**
- Both blocks show correct names in inventory
- No broken texture references

## System-Wide Impact

- **Interaction graph:** InteractionHandler and RedstoneSubsystem rebuild panel permutations during open/close — they must include the overlay state (Unit 11). RotationMath operates on positions only and is unaffected.
- **Error propagation:** If overlay state update fails (chunk unloaded), the panel retains its last overlay value. Non-fatal — visual glitch only.
- **State lifecycle risks:** Existing worlds: `bigdoors:hinge` blocks gain default material states (0, 0). Since 0,0 is not the unmatched index (15, 15), existing hinges will show oak_planks + overlay — a reasonable migration default. Existing `door_panel` blocks gain default overlay=0 (no straps). Both are safe defaults matching Bedrock's "first value" behavior for new states.
- **API surface parity:** Hidden_hinge must register same block component hooks. Panel overlay state must be included in all `BlockPermutation.resolve()` calls for panels.
- **Integration coverage:** Critical path: PanelPlacement → determine overlay from assembly → resolve permutation with overlay. Also: pairAndSplitAssemblies → suppress boundary straps. Also: hinge material transition from unmatched to matched.
- **Unchanged invariants:** RotationMath, EntitySweeper, ObstructionChecker are unaffected — they operate on positions and material indices, not overlay states. Open/close movement logic is structurally unchanged but now passes overlay alongside material states (Unit 11).
- **Permutation budget:** door_panel is at exactly 65,536 (the Bedrock limit). No additional states can be added to door_panel without reducing an existing state's range. This is a hard constraint going forward.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Panel permutation count at exact limit (65,536) | Boolean overlay keeps it at the limit. Future state additions require reducing another state's range or splitting into a new block type. |
| Per-cube material_instance may not be supported in geo format 1.21.0 | Fallback: use separate bones for inner cube vs overlay planes (bone name maps to material instance) |
| Permutation component merging may not work as expected in 1.26.0 | Fallback: include `"overlay"` entry in every material permutation (verbose but mechanical; consider script-generating the JSON) |
| Z-fighting on overlay planes | Start at 0.05px offset; trivially adjustable in geometry JSON |
| Existing worlds: hinges get material (0,0) = oak_planks instead of unmatched | Acceptable migration: old hinges show oak + straps. Not ideal but reasonable. |
| Panel overlay state backward compat | Bedrock defaults new states to first value (0 = no straps) — existing panels unaffected |
| Interior overlay faces visible through semi-transparent blocks | Hidden Hinge is the intended solution. Documented as a known limitation for strapped assemblies with transparent materials. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-16-strapped-hinge-overlay-requirements.md](docs/brainstorms/2026-05-16-strapped-hinge-overlay-requirements.md)
- Related code: `bigdoors_bp/blocks/door_panel.json` (material permutation pattern, panel_rotation state)
- Related code: `bigdoors_bp/scripts/domain/MaterialRegistry.js` (material index system)
- Related code: `bigdoors_bp/scripts/domain/PanelRotation.js` (closedRotation — rotation 0-3 horizontal, 4-7 vertical)
- Related code: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js` (panel placement)
- Related code: `bigdoors_bp/scripts/DoorManager.js` (assembly management, pairing)
- User-provided textures: `door_panel_overlay.png`, `hinge_overlay.png`, `hinge.png`
