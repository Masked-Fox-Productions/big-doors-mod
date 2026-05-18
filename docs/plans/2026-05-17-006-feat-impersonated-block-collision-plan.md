---
title: "feat: Add collision/selection boxes for impersonated block geometries"
type: feat
status: active
date: 2026-05-17
---

# feat: Add collision/selection boxes for impersonated block geometries

## Overview

Door panels that impersonate non-full-block shapes (fences, bars, panes) currently retain the default full-block collision and selection boxes. This means a player can jump on top of a fence-shaped door panel as if it were 1 block tall, even though vanilla fences are 1.5 blocks tall. The fix is to add `minecraft:collision_box` and `minecraft:selection_box` permutations for each non-full-block geometry class, matching vanilla block dimensions.

## Problem Frame

When a door panel adopts a fence geometry via `bigdoors:geometry_id`, the visual model changes but the physics don't. Players can walk through what should be a solid post or jump over what should be a 1.5-block barrier. This breaks immersion and gameplay balance.

## Scope Boundaries

- Only `door_panel.json` is in scope — hinges do not support geometry switching
- Only upright orientations (`panel_rotation < 4`) get adjusted boxes, matching the existing slab pattern — rotated panels during door movement keep full-block collision to avoid physics glitches mid-swing
- Exact pixel-perfect vanilla parity is a non-goal; close approximations are fine

## Context & Research

### Relevant Code and Patterns

- `bigdoors_bp/blocks/door_panel.json` lines 139–195: existing slab collision/selection box permutations — this is the exact pattern to follow
- Geometry IDs 1–4 = fence variants, 5 = bars, 7 = pane (from `Constants.js` `GEOMETRY_INDEX`)
- Bedrock `minecraft:collision_box` supports Y range 0–24, confirming 1.5-block-tall fences are possible on custom blocks

### Vanilla Reference Dimensions

| Block type | Collision box | Selection box |
|---|---|---|
| Fence post | origin [-2, 0, -2], size [4, 24, 4] | origin [-2, 0, -2], size [4, 16, 4] |
| Iron bars | origin [-1, 0, -8], size [2, 16, 16] | origin [-1, 0, -8], size [2, 16, 16] |
| Glass pane | origin [-1, 0, -8], size [2, 16, 16] | origin [-1, 0, -8], size [2, 16, 16] |

Note: Fence collision is 1.5 blocks tall but selection is only 1 block — this matches vanilla behavior where you can't target the invisible upper collision area. Bars and panes are thin on one axis (2 pixels wide). The exact axis depends on rotation, but since door panels already handle facing via `minecraft:transformation` permutations, the collision box is defined in local space and rotates with the block.

## Key Technical Decisions

- **Use same gating pattern as slabs (`panel_rotation < 4`)**: Rotated panels during door swing keep full-block collision. This avoids mid-animation physics issues and follows the established convention.
- **All fence geometry IDs (1–4) share the same collision box**: The rails connecting fence posts are visual only — vanilla fences also use just the post dimensions for collision per block.
- **Bars and panes share dimensions**: Both are thin full-height blocks in vanilla with identical collision profiles.

## Open Questions

### Deferred to Implementation

- Exact vanilla fence collision dimensions may need in-game verification — the plan uses approximate values that can be tuned by placing a vanilla fence and comparing jump behavior

## Implementation Units

- [ ] **Unit 1: Add fence collision/selection box permutations**

  **Goal:** Fence-impersonating door panels block players at 1.5 blocks tall

  **Dependencies:** None

  **Files:**
  - Modify: `bigdoors_bp/blocks/door_panel.json`

  **Approach:**
  - Add a single permutation covering geometry IDs 1–4 (all fence variants) with `panel_rotation < 4` gate
  - Collision box: 1.5 blocks tall, post-width
  - Selection box: 1 block tall, post-width (matches vanilla — you can't target the invisible upper collision)
  - Place these permutations adjacent to the existing slab collision permutations

  **Patterns to follow:**
  - Lines 139–195 of `door_panel.json` — slab collision/selection box permutations

  **Test scenarios:**
  - Happy path: place a door panel impersonating a fence (geometry_id 1), attempt to jump over — player should be blocked as with a vanilla fence
  - Happy path: target/select a fence-impersonating panel — selection highlight should match the post shape, not a full block
  - Edge case: rotated fence panel (panel_rotation >= 4) should retain full-block collision

  **Verification:**
  - In-game: place fence-impersonating door panel, verify player cannot jump over it; compare with adjacent vanilla fence

- [ ] **Unit 2: Add bars/pane collision/selection box permutations**

  **Goal:** Bars and pane-impersonating door panels have thin collision matching vanilla

  **Dependencies:** Unit 1 (pattern established)

  **Files:**
  - Modify: `bigdoors_bp/blocks/door_panel.json`

  **Approach:**
  - Add permutations for geometry ID 5 (bars) and 7 (pane), both with `panel_rotation < 4` gate
  - Both use thin collision (2 pixels wide on one axis, full 16 on the other)
  - Same collision and selection dimensions for both (vanilla bars and panes behave identically)

  **Patterns to follow:**
  - Unit 1's fence permutations and existing slab permutations

  **Test scenarios:**
  - Happy path: place a bars-impersonating panel, walk into the thin side — player should pass through; walk into the wide face — player should be blocked
  - Happy path: place a pane-impersonating panel, verify same thin collision behavior
  - Edge case: rotated bars/pane panels keep full-block collision

  **Verification:**
  - In-game: walk around bars/pane panels from different angles, confirm thin collision matches vanilla behavior

## System-Wide Impact

- **Permutation count:** Adding ~4 new permutation entries to an already large file (443 conditions). This is well within Bedrock's permutation limits since the state space isn't changing — just adding more condition→component mappings.
- **Door animation:** No impact — rotated panels (`panel_rotation >= 4`) are excluded from custom collision, so mid-swing physics are unchanged.
- **Unchanged invariants:** Slab collision behavior, visual geometry, material matching, and all domain/subsystem logic are untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Collision box dimensions don't match vanilla exactly | Tune in-game by comparing side-by-side with vanilla blocks; approximate values are acceptable |
| Thin bars/pane collision may feel wrong on rotated-facing panels | The `panel_rotation < 4` gate prevents this; rotated panels use full-block collision |
