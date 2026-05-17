---
title: "fix: Reset hinge to fresh state when last panel is broken"
type: fix
status: active
date: 2026-05-16
origin: docs/brainstorms/2026-05-14-big-doors-mod-requirements.md
---

# fix: Reset hinge to fresh state when last panel is broken

## Overview

When a player breaks the last door_panel attached to a Hinge, the assembly is currently dissolved entirely — removing the hinge from the manager's tracking. The hinge block remains in the world but becomes inert ("dead"). Instead, the hinge should reset to a fresh assembly state, ready to accept new panels.

## Problem Frame

R28 says "Breaking a door block removes it from the assembly; the remaining blocks continue to function as a smaller door." When the last panel is broken, there are zero remaining blocks — the hinge itself should still function. R29 defines dissolution only when the *hinge* is broken, not when panels are removed. The current implementation incorrectly dissolves on last-panel-break.

## Requirements Trace

- R28. Breaking a door block removes it from the assembly; remaining blocks continue to function
- R5. Hinge auto-detects door side from the first block placed adjacent (fresh hinge must be able to do this again)

## Scope Boundaries

- Does NOT change hinge-break behavior (R29 dissolution remains as-is)
- Does NOT change multi-panel break behavior (middle panels already work correctly)
- Does NOT affect double-door unpairing (that is already handled separately in the manager)

## Context & Research

### Relevant Code and Patterns

- `bigdoors_bp/scripts/DoorManager.js:111-122` — `removePanelFromAssembly` calls `dissolveAssembly` when `panelPositions.length === 0`
- `bigdoors_bp/scripts/DoorManager.js:130-146` — `dissolveAssembly` deletes the assembly entirely from the map and position index
- `bigdoors_bp/scripts/handler/BreakHandler.js:10-29` — `handlePanelBreak` calls the manager method but has no post-check logic
- `bigdoors_bp/scripts/handler/PanelPlacementHandler.js:104-137` — `_handleHingeNeighbor` checks `assembly.doorSide` to determine if the hinge is fresh; a reset hinge with `doorSide = ""` will correctly accept new panels on any side
- `bigdoors_bp/scripts/domain/DoorAssembly.js` — `doorSide`, `mode`, `partnerAssemblyId`, `boundaryPanels` are the fields that need clearing

### Key Insight

The `PanelPlacementHandler._handleHingeNeighbor` method already handles the "no doorSide" case (lines 118-129): it sets the door side and mode from the first block placed. So resetting `doorSide` to `""` is sufficient to make the hinge accept new panels — no changes needed in the placement handler.

## Key Technical Decisions

- **Reset in the manager, not dissolve:** Replace the `dissolveAssembly` call with a new `resetAssembly` method that clears panel state and doorSide but keeps the assembly and hinge positions in the index. This is cleaner than adding post-hoc logic in BreakHandler.
- **Reset hinge block permutation in BreakHandler:** The physical hinge block's `bigdoors:door_side` state must be set back to `"none"` so it visually matches the fresh state. This belongs in BreakHandler since it needs the dimension/block context the manager doesn't have.
- **Unpair partner if paired:** If the assembly has a partner (double door), unpair before resetting. This preserves the partner's panels correctly.

## Open Questions

### Resolved During Planning

- **Should mode reset too?** Yes — mode is derived from the first panel placement direction, so it should reset alongside doorSide. The hinge block permutation should reflect this.

### Deferred to Implementation

- None.

## Implementation Units

- [ ] **Unit 1: Add `resetAssembly` to DoorManager and use it instead of dissolve on last panel**

**Goal:** When the last panel is removed, reset the assembly to fresh state instead of dissolving it.

**Requirements:** R28, R5

**Dependencies:** None

**Files:**
- Modify: `bigdoors_bp/scripts/DoorManager.js`
- Test: `tests/DoorManager.test.mjs`

**Approach:**
- Add `resetAssembly(assemblyId)` method that: unpairs if partnered, clears `panelPositions`, `boundaryPanels`, `doorSide`, `mode`, `isOpen`, `openDirection`
- Change `removePanelFromAssembly` to call `resetAssembly` instead of `dissolveAssembly` when last panel is removed
- The assembly and its hinge positions stay in `_assemblies` and `_positionIndex`

**Patterns to follow:**
- `dissolveAssembly` for how to clean up position index entries for panels
- `unpairAssembly` for partner cleanup

**Test scenarios:**
- Happy path: remove last panel -> assembly still exists, `findByPosition(hingePos)` still returns it, `doorSide` is empty, `panelPositions` is empty
- Happy path: after reset, adding a new panel on a different side works (doorSide updates)
- Edge case: remove last panel from a paired assembly -> both assemblies unpaired, reset assembly has no partner
- Edge case: remove last panel from open door -> assembly resets (isOpen = false)
- Integration: existing test "removePanelFromAssembly on last panel dissolves the assembly" must be updated to expect reset behavior instead

**Verification:**
- `mgr.getAssembly(id)` returns the assembly after last panel break
- `mgr.findByPosition(hingePos)` still returns the assembly
- Assembly fields are in fresh state: doorSide empty, panelPositions empty, isOpen false

- [ ] **Unit 2: Reset hinge block permutation in BreakHandler**

**Goal:** When the last panel is broken, update the physical hinge block(s) to show the fresh state (`door_side: "none"`).

**Requirements:** R28

**Dependencies:** Unit 1

**Files:**
- Modify: `bigdoors_bp/scripts/handler/BreakHandler.js`
- Test: `tests/BreakHandler.test.mjs`

**Approach:**
- After calling `removePanelFromAssembly`, check if the assembly still exists but has zero panels (indicating a reset just happened)
- If so, iterate the assembly's `hingePositions` and set each hinge block's permutation to `door_side: "none"` with the assembly's facing
- Use `BlockPermutation.resolve(HINGE_BLOCK_ID, { "bigdoors:facing": facing, "bigdoors:mode": mode, "bigdoors:door_side": "none" })`

**Patterns to follow:**
- `PanelPlacementHandler._handleHingeNeighbor` lines 123-129 for how hinge permutations are set
- `HingePlacementHandler.onPlace` for the hinge block state format

**Test scenarios:**
- Happy path: break last panel -> hinge block has `door_side: "none"` permutation
- Happy path: break last panel with multiple stacked hinges -> all hinge blocks reset
- Edge case: break non-last panel -> hinge block unchanged
- Integration: existing "dissolves assembly when last panel is broken" test must be updated to verify hinge reset instead of dissolution

**Verification:**
- After breaking the last panel, the hinge block's permutation shows `door_side` as `"none"`
- The hinge can subsequently accept new panels placed on any side

## System-Wide Impact

- **Interaction graph:** RedstoneSubsystem queries assembly state — a reset assembly with no panels won't trigger any redstone logic (early return on `panelPositions.length === 0` already exists in InteractionHandler)
- **Persistence:** `save()` is called by `resetAssembly`, so the fresh state persists across reload
- **API surface parity:** Java edition will need the same fix if it shares this bug

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Existing tests assert dissolution on last panel break | Tests are updated in the same units — no surprise failures |
| Partner assembly state corruption on reset | Explicitly unpair before resetting, reusing existing `unpairAssembly` logic |
