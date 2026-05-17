---
title: "feat: Check for obstructions before closing door"
type: feat
status: completed
date: 2026-05-17
origin: docs/brainstorms/2026-05-14-big-doors-mod-requirements.md
deepened: 2026-05-17
---

# feat: Check for obstructions before closing door

## Overview

Add obstruction detection to the door close path. Currently, opening checks destination positions for solid blocks (R20–R25), but closing unconditionally moves panels back to their closed positions. If a player places a block in the closed-position footprint while the door is open, closing destroys that block without warning. This change applies the same three-tier obstruction logic to closing: soft blocks are destroyed, passable blocks drop items, and solid blocks prevent the door from closing.

## Problem Frame

A player opens a large door, places a chest or other solid block in the doorway, then triggers the door to close (via interaction or redstone signal loss). The door currently overwrites the solid block, destroying it. This violates the spirit of R23 (solid blocks prevent movement) and surprises players who expect the door to respect placed blocks bidirectionally.

## Requirements Trace

- R20. Before ~~opening~~ **any movement**, check all destination positions for the rotated blocks
- R21. Soft/replaceable blocks are destroyed and replaced by the door (applies to close)
- R22. Passable blocks are destroyed by the door but drop their items (applies to close)
- R23. Solid blocks prevent ~~opening~~ **movement** in that direction
- R24. If blocked, the door does not move (close has no fallback direction — it either closes or stays open)

## Scope Boundaries

- No "partial close" — if any closed-position is solidly obstructed, the entire door stays open
- No new UI feedback (particles, sounds) for blocked close — future enhancement
- Double-door partner close follows the same rule: if the partner is obstructed it stays open independently
- Redstone retry is implicit: blocked redstone close keeps the source monitor polling; next poll re-checks. Interaction close has no retry — player must re-interact

## Context & Research

### Relevant Code and Patterns

- `bigdoors_bp/scripts/domain/ObstructionChecker.js` — existing `checkPath()` checks destinations against a block query function. Currently used only for opening (rotating forward). Can be reused for close by passing closed positions as destinations.
- `bigdoors_bp/scripts/handler/InteractionHandler.js:_close()` — unconditionally moves panels to `closedPos`. Needs obstruction gate.
- `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js:_closeSingleAssembly()` — same pattern, also needs obstruction gate.
- `bigdoors_bp/scripts/handler/InteractionHandler.js:_tryClosePartner()` — calls `_close()` on partner; inherits the fix.
- `tests/ObstructionChecker.test.mjs` — existing test patterns for `classifyBlock` and `checkPath`.

## Key Technical Decisions

- **Reuse `checkPath` semantics without `checkPath` itself:** `checkPath` computes destinations via rotation math from panel positions + hinge. For close, destinations are simply `panel.closedPos` — no rotation needed. A new lighter function `checkClose(closedPositions, currentPositionSet, blockQueryFn)` in `ObstructionChecker.js` avoids coupling close-checking to rotation math while sharing `classifyBlock`.
- **No fallback direction on close:** Opening tries CW then CCW. Closing has exactly one target (the original closed positions). If obstructed, the door stays open. This matches real-world door behavior.
- **Partner independence:** If the primary side can close but the partner is obstructed, the primary closes and the partner stays open. This prevents a blocked partner from holding the primary open indefinitely.
- **Close must succeed before clearing redstone state:** Current code clears the redstone source and stops the source monitor *before* calling the close routine. This must be inverted: attempt the close first, and only clear state on success. Otherwise a blocked close loses its polling monitor and the door is stuck open permanently.
- **Loaded-destination validation on close:** Same as open (InteractionHandler lines 110–114), close must verify `dimension.getBlock(dest) != null` for all closed positions before destroying soft/passable blocks or moving panels. If any position is unloaded, the close aborts without modifying anything.
- **Atomic soft/passable destruction:** Soft and passable blocks must NOT be destroyed if a solid obstruction elsewhere in the footprint prevents the close. The solid-wins check must complete before any block destruction occurs.

## Open Questions

### Resolved During Planning

- **Should the door's own open-position panels count as obstructions at closed positions?** No — the same exclusion logic as `checkPath` applies: current panel positions are vacated during the move, so they cannot obstruct their own closed positions.

### Deferred to Implementation

- **Should `bigdoors:door_panel` blocks from the same assembly be excluded from obstruction at closed positions?** Current `checkPath` excludes `currentPosSet` which handles this. The close variant needs the same exclusion set built from `currentPos` values.

## Implementation Units

- [ ] **Unit 1: Add `checkClose` to ObstructionChecker**

**Goal:** Provide a domain-layer function that checks whether a door's closed positions are obstructable, reusing `classifyBlock`.

**Requirements:** R20, R21, R22, R23

**Dependencies:** None

**Files:**
- Modify: `bigdoors_bp/scripts/domain/ObstructionChecker.js`
- Test: `tests/ObstructionChecker.test.mjs`

**Approach:**
- Export a new `checkClose(closedPositions, currentPositionSet, blockQueryFn)` function
- `closedPositions` is an array of `{x,y,z}` targets
- `currentPositionSet` is a `Set` of `"x,y,z"` strings for positions being vacated (excluded from obstruction)
- Returns `{canClose, obstructedPositions, softBlocks, passableBlocks}` — same structure as `checkPath` but the boolean field is `canClose` (not `canOpen`); callers in Units 2 and 3 must reference the correct field
- Reuse `classifyBlock` for tier classification

**Patterns to follow:**
- `checkPath` in the same file — same return shape, same tier logic, same position-set exclusion

**Test scenarios:**
- Happy path: all closed positions are air → `canClose: true`, empty arrays
- Happy path: closed position occupied by soft block → `canClose: true`, position in `softBlocks`
- Happy path: closed position occupied by passable block → `canClose: true`, position in `passableBlocks`
- Edge case: closed position occupied by solid block → `canClose: false`, position in `obstructedPositions`
- Edge case: closed position is in `currentPositionSet` (self-exclusion) → not treated as obstruction
- Edge case: mix of soft + solid → `canClose: false` (solid wins)

**Verification:**
- `npm test` passes with new test cases covering all three tiers and the self-exclusion case

- [ ] **Unit 2: Gate `_close` in InteractionHandler with obstruction check**

**Goal:** Prevent player-triggered close when closed positions are solidly obstructed or unloaded.

**Requirements:** R23, R24

**Dependencies:** Unit 1

**Files:**
- Modify: `bigdoors_bp/scripts/handler/InteractionHandler.js`
- Test: `tests/InteractionHandler.test.mjs` (create if not exists)

**Approach:**
- In `_close(assembly, dimension)`, restructure so that redstone source is NOT cleared until close succeeds:
  1. Build `closedPositions` from `assembly.panelPositions.map(p => p.closedPos)`
  2. Validate all closed positions are loaded: for each, `dimension.getBlock(pos)` must be non-null. If any are null, return early (abort — no state changes)
  3. Build `currentPositionSet` from `assembly.getAllCurrentPositions()`
  4. Build `blockQueryFn` that returns the typeId for loaded blocks
  5. Call `checkClose(closedPositions, currentPositionSet, blockQueryFn)`
  6. If `!result.canClose`, return early — door stays open, no soft/passable destruction, no state changes
  7. If closeable, destroy soft/passable blocks (same pattern as `_attemptOpen`), proceed with panel movement
  8. ONLY AFTER successful movement: call `this._manager.clearRedstoneSource(assembly.id)` and `manager.closeDoor()`
- `_close` should return a boolean (true = closed, false = blocked) so callers can react
- `_tryClosePartner` already calls `_close` — partner independence is automatic (if partner close returns false, primary still closes)

**Patterns to follow:**
- `_attemptOpen` in the same file — loaded-block validation (lines 110–114), soft/passable destruction pattern before movement

**Test scenarios:**
- Happy path: closed positions are air → door closes normally, `manager.closeDoor` called, redstone source cleared
- Happy path: closed positions have soft blocks → soft blocks destroyed, door closes
- Error path: solid block at one closed position → door stays open, no blocks moved, no soft blocks destroyed, `manager.closeDoor` NOT called, redstone source NOT cleared
- Error path: soft + solid in closed footprint → no movement, no soft block destruction, no drops, no manager close (solid wins — nothing happens)
- Error path: closed position unloaded (getBlock returns null) → close aborts, no state changes
- Integration: double door where primary can close but partner is obstructed → primary closes, partner stays open

**Verification:**
- `npm test` passes; manual in-game test: open door, place cobblestone in doorway, click door — door stays open

- [ ] **Unit 3: Restructure RedstoneSubsystem close to clear state only after success**

**Goal:** Prevent redstone-triggered close when closed positions are solidly obstructed, and ensure the source monitor keeps polling so the close retries when the obstruction is removed.

**Requirements:** R23, R24, R30

**Dependencies:** Unit 1

**Files:**
- Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Test: `tests/RedstoneSubsystem.test.mjs` (create if not exists)

**Approach:**
- **Critical sequencing fix:** Current code in the source monitor callback calls `clearRedstoneSource` and `_stopSourceMonitor` BEFORE `_closeSingleAssembly`. This must be inverted.
- `_closeSingleAssembly` must return success/failure (boolean):
  1. Validate all closed positions are loaded (same as Unit 2)
  2. Build position sets
  3. Call `checkClose`
  4. If obstructed or unloaded, return `false` — no block manipulation, no state change
  5. If closeable, destroy soft/passable, move panels, call `manager.closeDoor()`, return `true`
- In the source monitor callback (around line 65–83), restructure to:
  1. Debounce check (unchanged)
  2. Call `_closeSingleAssembly` — get boolean result
  3. If `true`: THEN call `clearRedstoneSource` + `_stopSourceMonitor`
  4. If `false`: do nothing — monitor continues polling, next interval re-evaluates
- Same pattern for partner at lines 73–79: only clear partner source + stop partner monitor if partner close succeeds
- Soft + solid in footprint: no blocks destroyed, no drops (solid wins check comes before any destruction)

**Patterns to follow:**
- Unit 2's gate logic and return-value pattern in `InteractionHandler._close`
- Opening validation pattern (loaded-block check) from `InteractionHandler._attemptOpen`

**Test scenarios:**
- Happy path: redstone signal drops, closed positions clear → door closes normally, source cleared, monitor stopped
- Error path: redstone signal drops but solid block in doorway → door stays open, `clearRedstoneSource` NOT called, `_stopSourceMonitor` NOT called, monitor keeps running
- Error path: soft + solid in closed footprint → no movement, no soft block destruction, monitor keeps running
- Error path: closed positions unloaded → close aborts, monitor keeps running
- Edge case: obstruction removed before next poll → door closes on next poll tick, then source cleared and monitor stopped
- Integration: double door redstone close where one side is obstructed → unobstructed side closes (its source cleared), obstructed side stays open (its monitor keeps polling)

**Verification:**
- `npm test` passes; manual in-game test: open door via redstone, place block in doorway, remove redstone — door stays open; remove block — door closes on next poll

## System-Wide Impact

- **Interaction graph:** `InteractionHandler._close` and `RedstoneSubsystem._closeSingleAssembly` gain a new dependency on `checkClose` from `ObstructionChecker`. No other callers affected.
- **Error propagation:** A blocked close is silent (no exception) — the method returns `false`. State remains consistent (door stays open in manager). No soft/passable blocks are destroyed when a solid obstruction exists anywhere in the footprint.
- **State lifecycle risks:** If close is blocked, `manager.closeDoor()` is never called, so `isOpen` stays `true` and `currentPos` remains at the open position. Critically, `clearRedstoneSource` must also NOT be called on failure — otherwise the redstone state is lost while the door is still open.
- **Redstone source monitor:** When close is blocked by obstruction, the source monitor must continue polling (not be cleared). The next poll re-attempts close. This requires restructuring the callback: current code clears source/stops monitor BEFORE the close attempt. The new sequence is: attempt close → on success, clear and stop; on failure, leave monitor running.
- **Unloaded chunks:** Close must handle `dimension.getBlock()` returning `null` for unloaded positions the same way open does — abort entirely. Without this, `classifyBlock(null)` returns `'air'` which incorrectly allows the close to proceed into unloaded territory.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Redstone source monitor clears before close succeeds, leaving door permanently open | Restructure the monitor callback: `_closeSingleAssembly` returns boolean; clear source and stop monitor only on `true` |
| Door's own panels at open positions incorrectly classified as obstructions at closed positions | Build `currentPositionSet` from open positions — same exclusion pattern as `checkPath` |
| Unloaded closed positions treated as air, allowing close into unloaded chunks | Explicit loaded-block validation before obstruction check — abort if any `getBlock()` returns null |
| Soft blocks destroyed even when solid elsewhere prevents close | Ensure `checkClose` result is evaluated BEFORE any soft/passable destruction — solid wins means nothing happens |
| InteractionHandler clears redstone source before close attempt, losing state on blocked close | Move `clearRedstoneSource` call to after successful close return |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-14-big-doors-mod-requirements.md](docs/brainstorms/2026-05-14-big-doors-mod-requirements.md)
- Related code: `bigdoors_bp/scripts/domain/ObstructionChecker.js:checkPath`
- Related code: `bigdoors_bp/scripts/handler/InteractionHandler.js:_attemptOpen`
