---
date: 2026-05-16
topic: strapped-hinge-overlay
---

# Strapped Hinge Overlay

## Problem Frame

The current hinge block has a fixed, opaque texture that visually breaks continuity with the door panels it connects. Players building large wooden doors want hinges that blend with their chosen material while still looking like functional hardware. Pre-baking every material+overlay combination would be a combinatorial explosion of texture files.

## Requirements

**Visual System**

- R1. Create a custom geometry for the strapped hinge with two overlapping cubes: an inner full-block cube for the base material and a fractionally-larger outer cube for the straps overlay.
- R2. The outer cube uses `alpha_test` render method so transparent pixels in the straps texture show the base material beneath.
- R3. Ship a single `straps` overlay PNG (iron strap pattern on mostly-transparent background). No per-material variants needed.
- R4. The inner cube uses the same material_instances permutation system as `door_panel.json` (same material_group/material_id states).

**Material Matching**

- R5. When a panel is placed adjacent to a strapped hinge, the hinge automatically adopts the same material as that panel.
- R6. If panels of different materials are adjacent, the first panel placed determines the hinge's material.
- R7. If the hinge has no adjacent panels yet, it displays a default material (oak planks) beneath the straps.

**Item and Crafting**

- R8. The overlay hinge is the primary item named "Hinge" (`bigdoors:hinge` — the existing block ID). It displays the base material + iron straps overlay.
- R9. The "Hidden Hinge" (`bigdoors:hidden_hinge`) is a separate craftable item that auto-matches panel material with NO overlay — visually indistinguishable from a door panel. It uses the same material permutation system as door_panel (no custom geometry needed, just a full block with material_instances).
- R10. The current dedicated hinge texture (`textures/blocks/hinge.png`) is retired. Both hinge variants now use material matching.

**Behavior**

- R11. Both hinge variants are functionally identical: same redstone conductivity, same assembly merging, same double-door detection, same rotation logic.
- R12. A Hinge and a Hidden Hinge can coexist in the same assembly (e.g., one at top, one at bottom).

## Success Criteria

- A player can craft a Hinge, place it, build oak-plank panels next to it, and see the hinge display oak planks with iron straps overlaid — without any custom texture files per material.
- A player can craft a Hidden Hinge, place it next to panels, and it becomes visually indistinguishable from the surrounding door panels.
- No combinatorial texture explosion: the overlay system uses exactly one straps PNG plus the existing material permutation system.

## Scope Boundaries

- Only one overlay style (iron straps) in this iteration. Additional overlay styles (chains, bolts, etc.) are future work.
- The straps texture is the same on all six faces — no directional/rotational variants of the overlay in v1.
- Java parity is out of scope for this brainstorm (separate planning needed for Fabric implementation).

## Key Decisions

- **Nested geometry over shader compositing**: Bedrock has no runtime texture blending in material_instances. Nested geometry with alpha_test is the standard add-on technique for overlays.
- **Two items over toggle**: "Hinge" (straps visible) and "Hidden Hinge" (fully blended). Clear player intent at craft time, no interaction complexity.
- **"Hinge" is the default name**: The strapped version is the more realistic/expected look for a large door. The strapless variant is the special case ("hidden").
- **Auto-match over explicit placement**: Reduces player friction — both hinge types just pick up whatever panels surround them. No extra step.
- **Retire the dedicated hinge texture**: The old opaque hinge look is replaced entirely by the material-matching system.

## Dependencies / Assumptions

- Bedrock custom geometry supports multiple cubes with independent material instance assignments per cube (verified: this is standard in geometry format 1.16.0+).
- The material_group/material_id state space (8x16 = 128 slots) has room for the strapped hinge to reuse the same states as door_panel without conflict.

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Needs research] What exact scale factor for the outer cube avoids Z-fighting while keeping the overlay visually flush? (Likely 16.1 or 16.02 pixels — needs in-game testing.)
- [Affects R5][Technical] Should the auto-match update reactively if panels are broken and replaced with a different material, or is it set-once on first adjacent panel?
- [Affects R8/R9][Technical] Recipe design for both variants — likely differentiated by iron nuggets/ingots for Hinge vs. a simpler recipe for Hidden Hinge.
- [Affects R10][Technical] Migration path for existing worlds: existing `bigdoors:hinge` blocks need to gracefully adopt the new visual system or be grandfathered.
- [Affects R12][Technical] How does assembly serialization handle mixed hinge types? Likely just a `type` field on each hinge position in the assembly data.

## Next Steps

-> `/ce:plan` for structured implementation planning
