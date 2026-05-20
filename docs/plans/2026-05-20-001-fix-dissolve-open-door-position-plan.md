---
title: "fix: Dissolve open door in-place instead of snapping to closed positions"
type: fix
status: active
date: 2026-05-20
---

# fix: Dissolve open door in-place instead of snapping to closed positions

## Overview

When the hinge of an open door is broken and the assembly dissolves, `_dissolveAssembly` clears the panel blocks at their open positions, then places vanilla blocks at the **closed** positions. This makes the door visually "snap back" to its closed position before becoming vanilla blocks. The fix: convert panel blocks to vanilla at `currentPos` (where they actually are), not `closedPos`.

## Problem Frame

Breaking a hinge on an open door triggers `_dissolveAssembly`, which currently:
1. Clears all panel blocks at `currentPos` (open position) to air
2. Places vanilla blocks at `closedPos` (original closed position)

This creates a jarring visual — the door teleports back to its closed position before dissolving into vanilla blocks. The expected behavior is that the door panels stay where they are and convert to vanilla blocks in-place.

## Requirements Trace

- R1. When an open door's assembly dissolves, vanilla blocks appear at the panels' current (open) positions, not their closed positions
- R2. When a closed door's assembly dissolves, behavior is unchanged (vanilla blocks at closed positions, which equal current positions)
- R3. Boundary panels follow the same logic — use `currentPos` when open

## Scope Boundaries

- No changes to `handlePanelBreak` — individual panel breaks already use `event.block.location` which is correct
- No changes to the close path or interaction handler
- No changes to the domain model or position tracking

## Context & Research

### Relevant Code and Patterns

- `bigdoors_bp/scripts/handler/BreakHandler.js:75-101` — `_dissolveAssembly`, the method with the bug
- `bigdoors_bp/scripts/handler/BreakHandler.js:49-72` — `handleHingeBreak`, which calls `_dissolveAssembly`
- `bigdoors_bp/scripts/domain/DoorAssembly.js` — `panelPositions[].currentPos` vs `.closedPos`
- `tests/BreakHandler.test.mjs:189-211` — existing test "closes open door before dissolving assembly" which **asserts the current (wrong) behavior**: it expects open positions cleared to air and closed positions populated with vanilla blocks

### Institutional Learnings

None directly applicable.

## Key Technical Decisions

- **Use `currentPos` unconditionally**: Since `currentPos === closedPos` when the door is closed, we can simplify the dissolve logic to always place vanilla blocks at `currentPos`. The `isOpen` branch that clears open-position blocks becomes unnecessary — the blocks at `currentPos` are simply overwritten with their vanilla equivalents via `setType()`.

## Open Questions

### Resolved During Planning

- **Should we keep the air-clearing step?** No. Since we now place vanilla blocks at `currentPos` (the same positions that currently hold door_panel blocks), `setType(vanillaTypeId)` overwrites them directly. No need to clear to air first.

### Deferred to Implementation

- None

## Implementation Units

- [ ] **Unit 1: Fix `_dissolveAssembly` to use `currentPos`**

**Goal:** Convert panel blocks to vanilla at their current positions instead of their closed positions.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `bigdoors_bp/scripts/handler/BreakHandler.js`
- Modify: `tests/BreakHandler.test.mjs`

**Approach:**
- Remove the `if (assembly.isOpen)` air-clearing loop (lines 76-81) — it's no longer needed since we overwrite in-place
- Change `panel.closedPos` to `panel.currentPos` in the vanilla block placement loop (line 84)
- Change `panel.closedPos` to `panel.currentPos` in the boundary panel placement loop (line 95)
- Remove the duplicate `this._manager.dissolveAssembly(assembly.id)` call at line 100 — `handleHingeBreak` already calls it at line 66
- Update the existing test "closes open door before dissolving assembly" to assert the new behavior: open-position blocks become vanilla blocks, closed positions remain unchanged (air)
- Add a test for dissolving a closed door to confirm no regression

**Patterns to follow:**
- The existing test at line 189-211 shows the test structure: set up assembly, open it, place blocks, break hinge, assert block types at positions

**Test scenarios:**
- Happy path: dissolve open door — vanilla blocks appear at open positions, closed positions remain air
- Happy path: dissolve closed door — vanilla blocks appear at closed positions (unchanged behavior since `currentPos === closedPos`)
- Happy path: dissolve open door with boundary panels — boundary panel vanilla blocks appear at their current positions
- Edge case: dissolve open door with multiple panels at different open positions — each gets its correct vanilla material at its open position

**Verification:**
- `npm test` passes
- The "closes open door before dissolving assembly" test now asserts vanilla blocks at open positions
- A new closed-door dissolve test confirms backward compatibility

## System-Wide Impact

- **Interaction graph:** `_dissolveAssembly` is called only from `handleHingeBreak` when `dissolve_required`. No other callers.
- **Error propagation:** No change — `getBlock` null checks are preserved.
- **State lifecycle risks:** None — `dissolveAssembly` on the manager side already cleans up the position index using `currentPos`.
- **Unchanged invariants:** `handlePanelBreak`, `handleHingeBreak` drop logic, and all open/close paths are untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Boundary panels may not have `currentPos` updated when open | Verified: boundary panels are static — `InteractionHandler` does not move them during open/close, and `updatePanelPositions` only touches `panelPositions`. Therefore `boundaryPanels[].currentPos === closedPos` always, and using `currentPos` produces identical results to the old `closedPos` reference. No code change needed for R3; the fix is inherently safe for boundary panels. |

## Sources & References

- Bug location: `bigdoors_bp/scripts/handler/BreakHandler.js:75-101`
- Test file: `tests/BreakHandler.test.mjs`
