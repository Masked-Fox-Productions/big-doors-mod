---
title: "fix: Correct strap overlay texture and geometry assignments"
type: fix
status: completed
date: 2026-05-17
origin: docs/plans/2026-05-16-001-feat-strapped-hinge-overlay-plan.md
---

# fix: Correct strap overlay texture and geometry assignments

## Overview

The strap overlay system is showing wrong strap orientations and on wrong faces across several scenarios. Two root causes: (1) the door panel generator assigns `_v` texture where `_h` is needed, and (2) the hinge generator uses `strapped_sides_v` geometry for vertical mode when it should use `strapped_sides` (all 6 faces).

## Problem Frame

After implementing the strapped hinge overlay feature, in-game testing revealed four issues:

| Scenario | What's wrong | Root cause |
|----------|-------------|------------|
| Horizontal panel (open + closed) | Straps rotated up-down instead of matching png (left-right) | Generator assigns `_v` texture; should be `_h` |
| Vertical hinge (closed) | Straps on wrong face (top/bottom only; E/W falls back to base material because `overlay_ew` is never set) | Generator uses `strapped_sides_v` geometry which lacks N/S overlay planes and the permutation never maps `overlay_ew` |
| Vertical hinge (open) | Correct — straps visible on top/bottom with up-down orientation | Coincidentally correct: `_v` on top/bottom of `strapped_sides_v` |
| Vertical panel (open + closed) | Straps unrotated (left-right) instead of rotated (up-down) | Generator assigns `_v` texture and lacks rotation-aware geometry split |

The horizontal hinge is the only scenario that currently works correctly.

## Requirements Trace

- R13 (origin plan). Overlay texture rotates with mode: horizontal bands for horizontal mode, vertical bands for vertical mode
- R15 (origin plan). Overlay appears on all six faces of both hinge and panel blocks
  - **Relaxed for vertical-closed panels (rotation >= 4):** `strapped_sides_v` covers 4 of 6 world faces (N/S/E/W after X rotation maps local top/bottom → world N/S). World top/bottom are uncovered. This is acceptable because vertical-closed panels stack vertically and the top/bottom faces are always occluded by adjacent panels or the hinge. Full 6-face coverage for vertical-closed panels would require a new geometry file, which is out of scope for this fix.

## Scope Boundaries

- Only texture/geometry assignment changes in the generators and regenerated JSON
- No changes to geometry files (`strapped_sides.geo.json`, `strapped_sides_v.geo.json`)
- No changes to game logic (PanelPlacementHandler, InteractionHandler, etc.)
- No changes to the texture PNGs themselves

## Context & Research

### Key Empirical Findings

Bedrock texture orientation on side faces (observed in-game):
- `_h` texture (horizontal bars in PNG) → horizontal/left-right straps on unrotated side faces
- `_v` texture (vertical bars in PNG) → vertical/up-down straps on unrotated side faces
- When a block has 90° X rotation (panel_rotation 4-7), the texture orientation on the rotated faces flips 90°

### Geometry Recap

- `strapped_sides.geo.json`: overlay planes on **all 6 faces** (N/S/E/W/top/bottom), all using `overlay` material instance
- `strapped_sides_v.geo.json`: overlay planes on **top/bottom** (`overlay` material) and **E/W** (`overlay_ew` material). No N/S overlay planes. Designed for vertical-closed panels (rotation 4-7) where X rotation maps local top/bottom → world N/S

### Why `_h` Works for Vertical-Open Panels

Vertical-open full-block panels use rotation 0 (facing E/W) or rotation 1 (facing N/S). These are Y-rotation-only values — no X tilt. With `_h` texture:

- **Rotation 0** (Y=0°, E/W facing): horizontal bars stay E/W → bars point toward E/W hinge axis
- **Rotation 1** (Y=90°, N/S facing): horizontal bars rotate to N/S → bars point toward N/S hinge axis

The Y rotation chosen by `openRotation("vertical", ...)` naturally aligns `_h` bars toward the hinge. No separate texture or rotation value is needed — `_h` serves both horizontal and vertical-open cases.

## Key Technical Decisions

- **Single texture (`_h`) for rotation < 4**: The Y rotation applied by `minecraft:transformation` rotates both the block shape and the overlay texture. Since `openRotation` selects Y values that align with the hinge axis, `_h` bars naturally point toward the hinge for vertical-open panels while showing the expected horizontal pattern for horizontal panels.
- **`strapped_sides` geometry for both hinge modes**: The hinge block never has X rotation (it only has `facing` Y rotation). It needs overlay on all 6 faces regardless of mode. Only the texture changes between modes (`_h` vs `_v`).
- **Keep `strapped_sides_v` for panel rotation >= 4**: Vertical-closed panels have 90° X rotation which moves local N/S to world top/bottom. `strapped_sides_v` compensates by placing overlay on local top/bottom (→ world N/S) and local E/W.
- **Remove old generator**: `scripts/gen-block-json.mjs` is the original generator, superseded by `tools/generate-block-json.mjs`. Remove it to eliminate a maintenance burden and source of confusion. The old generator also produces `hidden_hinge.json`, but that block's JSON is static (no overlay, `full_block` geometry, material permutations only) and does not need regeneration — it was only generated once to bootstrap the file. If `hidden_hinge.json` needs regeneration in the future, add it to `tools/generate-block-json.mjs` at that time.

## Open Questions

### Resolved During Planning

- **Can we distinguish vertical-open from horizontal in panel permutations?** No — both use rotation 0-1. But `_h` texture works correctly for both due to Y rotation alignment with the hinge axis.
- **Does the hinge need `strapped_sides_v`?** No. The hinge never has X rotation, so it needs overlay on all 6 local faces (= all 6 world faces). `strapped_sides` covers this.

### Deferred to Implementation

- Whether the `*` material on hinge permutations should use `opaque` vs `alpha_test` render method (current generator uses `alpha_test` for both; not related to this bug)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
CORRECT ASSIGNMENTS (after fix):

HINGE (both modes use strapped_sides geometry, all 6 overlay faces):
  mode=horizontal → overlay: hinge_overlay_h  (horizontal bars)
  mode=vertical   → overlay: hinge_overlay_v  (vertical bars)

DOOR PANEL:
  rotation < 4  → strapped_sides geometry    + overlay: panel_overlay_h
  rotation >= 4 → strapped_sides_v geometry  + overlay: panel_overlay_v
                                             + overlay_ew: panel_overlay_h

BEFORE (broken — generator has rotation split but JSON was never regenerated with it):
  Hinge vertical: strapped_sides_v ← MISSING N/S planes, overlay_ew unmapped
  Panel < 4:      panel_overlay_v  ← WRONG texture (should be _h)
  Panel >= 4:     already correct in generator code, just not on disk

AFTER (fixed):
  Hinge vertical: strapped_sides   ← all 6 faces covered
  Panel < 4:      panel_overlay_h  ← correct horizontal bars
  Panel >= 4:     unchanged        ← already correct in generator
```

## Implementation Units

- [ ] **Unit 1: Fix generators and regenerate JSON**

**Goal:** Correct the texture and geometry assignments in `tools/generate-block-json.mjs`, regenerate `hinge.json` and `door_panel.json`, and remove the old generator.

**Requirements:** R13, R15

**Dependencies:** None

**Files:**
- Modify: `tools/generate-block-json.mjs`
- Delete: `scripts/gen-block-json.mjs`
- Regenerate: `bigdoors_bp/blocks/hinge.json`
- Regenerate: `bigdoors_bp/blocks/door_panel.json`

**Approach:**

In `tools/generate-block-json.mjs`:
1. **Hinge vertical mode** (~line 105): Change geometry from `geometry.bigdoors.strapped_sides_v` to `geometry.bigdoors.strapped_sides`. This eliminates the need for `overlay_ew` in hinge permutations since `strapped_sides` uses only `overlay` material on all faces.
2. **Panel overlay rotation < 4** (~line 200): Change overlay texture from `bigdoors_panel_overlay_v` to `bigdoors_panel_overlay_h`.
3. **Panel overlay rotation >= 4** (~line 208-215): No change needed — `overlay → panel_overlay_v` and `overlay_ew → panel_overlay_h` are already correct.

Then run `node tools/generate-block-json.mjs` to regenerate both block JSONs.

Delete `scripts/gen-block-json.mjs` — it's the older generator that `tools/generate-block-json.mjs` replaced.

**Patterns to follow:**
- Existing generator structure and `mi()` helper

**Test scenarios:**
- Happy path: Run `npm test` — all existing tests pass
- Happy path: Regenerated `hinge.json` has `strapped_sides` geometry for both horizontal and vertical modes
- Happy path: Regenerated `hinge.json` vertical-mode permutations reference `bigdoors_hinge_overlay_v` texture (vertical straps on vertical hinges)
- Happy path: Regenerated `door_panel.json` rotation < 4 overlay references `bigdoors_panel_overlay_h` texture
- Happy path: Regenerated `door_panel.json` rotation >= 4 overlay references `bigdoors_panel_overlay_v` (overlay) and `bigdoors_panel_overlay_h` (overlay_ew)
- Edge case: Hinge unmatched state (15,15) still uses `full_block` geometry
- Assertion: Add a small test that reads the regenerated JSON and asserts geometry and texture name assignments for hinge (both modes) and panel (both rotation ranges)

**Verification:**
- `hinge.json` vertical-mode permutations reference `geometry.bigdoors.strapped_sides` (not `_v`)
- `door_panel.json` overlay permutations for rotation < 4 reference `bigdoors_panel_overlay_h`
- `door_panel.json` overlay permutations for rotation >= 4 reference `bigdoors_panel_overlay_v` and `bigdoors_panel_overlay_h`
- All existing tests pass
- In-game: all four scenarios (horizontal hinge/panel, vertical hinge/panel) show correct strap orientation

## System-Wide Impact

- **Interaction graph:** No code changes — only JSON block definitions change. All game logic (placement, movement, pairing) is unaffected.
- **Permutation counts:** Hinge count stays the same (combined mode×material permutations). Panel overlay permutation count will roughly double because the generator's rotation split (`< 4` and `>= 4`) was never regenerated into the on-disk JSON — regeneration adds rotation conditions to every full-block overlay permutation. Total panel permutations remain well within the 65,536 Bedrock limit.
- **Unchanged invariants:** `strapped_sides.geo.json` and `strapped_sides_v.geo.json` are not modified. Texture PNGs are not modified. Game logic files are not modified.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Texture orientation analysis is wrong — in-game results differ from predicted | The fix is two line changes in the generator + regeneration. Easy to iterate if in-game testing shows issues. |
| Removing `scripts/gen-block-json.mjs` orphans `hidden_hinge.json` generation | `hidden_hinge.json` is static (no overlay, `full_block` geometry) and doesn't need regeneration. If it does in the future, add it to the canonical generator. Git history preserves the old file. |

## Sources & References

- **Origin plan:** [docs/plans/2026-05-16-001-feat-strapped-hinge-overlay-plan.md](docs/plans/2026-05-16-001-feat-strapped-hinge-overlay-plan.md)
- Generator: `tools/generate-block-json.mjs`
- Panel rotation logic: `bigdoors_bp/scripts/domain/PanelRotation.js`
- Geometry files: `bigdoors_rp/models/blocks/strapped_sides.geo.json`, `bigdoors_rp/models/blocks/strapped_sides_v.geo.json`
