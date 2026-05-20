---
title: "fix: Correct iron bars geometry — even spacing, eliminate Z-fighting"
type: fix
status: completed
date: 2026-05-20
---

# fix: Correct iron bars geometry — even spacing, eliminate Z-fighting

## Overview

The iron bars door panel geometry has uneven bar spacing and texture flickering (Z-fighting). The vertical bars are unevenly distributed (gaps of 2px, 1px, 1px, 2px) and the horizontal crossrails share the exact same Z-plane as the vertical bars, causing coplanar face flicker at every intersection. This plan redesigns the bar geometry to use 3 evenly-spaced vertical bars with recessed crossrails.

## Problem Frame

When players build a Winch-fed Portcullis with iron bar panels, the bars look wrong compared to vanilla iron bars: bars are too close together (especially the center pair which are only 1px apart), and horizontal crossrails flicker due to Z-fighting where they intersect vertical bars. Vanilla iron bars are flat textured planes, not 3D cubes, so exact replication isn't possible — but 3 evenly-spaced bars per block with proper Z-separation is the closest visual match using 3D geometry.

## Requirements Trace

- R1. Bars geometry uses 3 evenly-spaced vertical bars instead of the current 5 unevenly-spaced bars
- R2. Horizontal crossrails must not share the same Z-plane as vertical bars (no Z-fighting)
- R3. All 4 geometry variants (both/solo/before/after) must be updated consistently
- R4. Collision boxes remain unchanged (they are already correct from the previous plan)

## Scope Boundaries

- Geometry file only — no script, block JSON, or collision box changes needed
- The geometry IDs (5, 9, 10, 11) and all wiring (Constants, MaterialRegistry, PanelRotation, PanelPlacementHandler) are already correct from the previous plan and do not need changes
- Java parity is out of scope

## Context & Research

### Relevant Code and Patterns

- `bigdoors_rp/models/blocks/door_panel_bars.geo.json` — the only file being changed
- `bigdoors_rp/models/blocks/door_panel_fence.geo.json` — reference for how the fence handles solo/before/after/both variants with centered posts and side rails

### Current Geometry Analysis

**Current bars "both" variant (5 bars, uneven):**
```
Vertical bars at X: [-8,-6], [-4,-2], [-1,+1], [+2,+4], [+6,+8]
Gaps:                  2px      1px      1px      2px
Crossrails: Y=7 and Y=14, origin Z=-1, size Z=2 (same plane as bars → Z-fighting)
```

**Current Z-fighting cause:** Every vertical bar has `origin: [_, _, -1], size: [2, 16, 2]`. Every crossrail also has `origin: [_, _, -1], size: [_, 2, 2]`. At intersections, the faces are perfectly coplanar.

### Target Geometry Design

**New bars "both" variant (3 bars, even spacing):**
```
Vertical bars at X: [-6,-4], [-1,+1], [+4,+6]  (size 2 each)
Gaps:          2px     3px      3px     2px
Crossrails: Y=6 and Y=12, origin Z=0, size Z=2 (offset +1 from bars)
Bars:        origin Z=-1, size Z=2
```

The crossrails are offset 1px forward in Z relative to the vertical bars. Where they intersect, the crossrail sits inside the bar volume rather than sharing an outer face, eliminating Z-fighting. The crossrails protrude 1px on the front face and are flush with the back face — subtle enough to look correct from all angles.

**Variant geometry:**
- **both** (ID 5): 3 bars spanning full width [-6 to +6], crossrails from -8 to +8
- **solo** (ID 9): cross shape — center bar [-1,+1] in both X and Z axes, crossrails in both directions
- **before** (ID 10): 2 bars from center toward -X: bars at [-6,-4] and [-1,+1], crossrails from -8 to 0
- **after** (ID 11): 2 bars from center toward +X: bars at [-1,+1] and [+4,+6], crossrails from 0 to +8

## Key Technical Decisions

- **3 bars instead of 4 or 5**: Vanilla iron bars are flat textured planes, not 3D cubes. With 3D cubes, fewer wider-spaced bars reads better and more closely approximates the vanilla appearance when viewed in a row. The user confirmed 3 bars after comparing against vanilla screenshots.
- **Z-offset crossrails instead of thinner crossrails**: Offsetting the crossrail Z origin by 1px (from -1 to 0) is simpler and more robust than making crossrails fractionally thinner. The 1px protrusion on one face is visually subtle.
- **2px crossrail height**: Matches the current crossrail height and produces a thinner, more vanilla-like horizontal connector compared to the fence's 3px rails.

## Implementation Units

- [ ] **Unit 1: Redesign bars geometry in all 4 variants**

  **Goal:** Replace the current uneven 5-bar geometry with evenly-spaced 3-bar geometry and Z-offset crossrails across all variants

  **Requirements:** R1, R2, R3

  **Dependencies:** None

  **Files:**
  - Modify: `bigdoors_rp/models/blocks/door_panel_bars.geo.json`

  **Approach:**
  - Replace all cube definitions in all 4 geometry identifiers
  - Vertical bars use `origin Z = -1, size Z = 2` (unchanged depth)
  - Crossrails use `origin Z = 0, size Z = 2` (offset 1px forward to avoid coplanar faces)
  - `geometry.bigdoors.bars` (both): 3 vertical bars at X origins -6, -1, +4; crossrails span -8 to +8
  - `geometry.bigdoors.bars_solo` (solo): center bar at X=-1 with perpendicular bars at Z=-6 and Z=+4; crossrails in both X and Z directions
  - `geometry.bigdoors.bars_before` (before): 2 bars at X=-6 and X=-1; crossrails from -8 to 0
  - `geometry.bigdoors.bars_after` (after): 2 bars at X=-1 and X=+4; crossrails from 0 to +8

  **Patterns to follow:**
  - `bigdoors_rp/models/blocks/door_panel_fence.geo.json` — how solo uses cross shape, how before/after extend from center

  **Test scenarios:**
  - Happy path: place bars in a 3-wide assembly — bars are evenly spaced with visible gaps, no flickering at crossrail intersections
  - Happy path: place a solo bars panel — cross shape renders without Z-fighting
  - Happy path: place bars at end of assembly — before/after variants show 2 bars with half-width crossrails
  - Edge case: rotate bars panels to all 4 upright rotations and both vertical-open rotations — geometry looks correct at all angles

  **Verification:**
  - In-game: place bar panels in various assembly configurations, verify even spacing and no texture flickering from any viewing angle

## System-Wide Impact

- **Collision boxes unchanged**: The collision boxes in `door_panel_bars.json` use origin/size values based on half-block and full-block extents, not individual bar positions. They remain correct.
- **Visual change**: Existing worlds with bars panels will see the updated geometry (3 bars instead of 5) on next load. This is a visual improvement, not a breaking change.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Solo variant cross shape may look odd with only 3 bars per axis | Follow the fence solo pattern — the center bar + perpendicular arms is an established visual |
| Z-offset crossrails visible from side angles | 1px offset is subtle; test in-game from multiple angles before finalizing |

## Sources & References

- Previous plan: `docs/plans/2026-05-18-001-fix-pane-bars-collision-neighbor-matching-plan.md`
- Fence geometry reference: `bigdoors_rp/models/blocks/door_panel_fence.geo.json`
- [Iron Bars – Minecraft Wiki](https://minecraft.wiki/w/Iron_Bars)
