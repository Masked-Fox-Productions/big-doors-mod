---
title: "fix: Robust assembly merge on hinge placement and graceful hinge break"
type: fix
status: completed
date: 2026-05-17
deepened: 2026-05-17
---

# fix: Robust assembly merge on hinge placement and graceful hinge break

## Overview

Two related bugs in assembly lifecycle management:

1. **Merge bug**: `_mergeWithAdjacentHinge()` returns on the first adjacent assembly it finds. When a hinge bridges two existing assemblies (e.g., placing y=2 between y=1 and y=3 groups), only one group is merged — the other remains a separate assembly. Panels then attach to the wrong assembly depending on which one `findByPosition` resolves first.

2. **Break bug**: `handleHingeBreak()` calls `_dissolveAssembly()` unconditionally, reverting all panels to vanilla blocks. In a multi-hinge assembly, breaking one hinge should remove it from the assembly while keeping the door functional if the remaining hinges are still contiguous.

## Problem Frame

Players build hinge columns out of order (e.g., y=0, y=1, y=3, y=2). The bridge hinge at y=2 should union the y=0–1 and y=3 assemblies into one, but currently only joins one. This causes panels to split across phantom assemblies, producing doors that appear unified but behave as two separate doors.

Separately, breaking any hinge destroys the entire assembly — even if only one of four hinges was removed and the remaining three still form a valid contiguous column. In double-doors this is especially destructive: breaking one hinge near a boundary can dissolve both halves.

## Requirements Trace

- R1. A bridge hinge placed between two existing assemblies must union them into a single assembly
- R2. All hinge positions, panels, boundary panels, and partner state must transfer correctly during a union
- R3. The position index must remain consistent after union (no orphaned keys)
- R4. Breaking a hinge from a multi-hinge assembly removes only that hinge
- R5. If remaining hinges are contiguous, the assembly stays intact with all its panels
- R6. If zero hinges remain after break, the assembly dissolves (existing behavior)
- R7. Double-door partner state must be preserved when a non-terminal hinge is broken

## Scope Boundaries

- No changes to panel break behavior (already works correctly — removes one panel, resets on last)
- No changes to double-door pairing/splitting logic itself
- No changes to movement/rotation subsystem
- Vertical-mode horizontal merges follow the same union logic as vertical stacking
- Assembly split on hinge break (disconnected remaining hinges → two assemblies) is explicitly out of scope; if remaining hinges are non-contiguous, dissolve the assembly
- No Java implementation in this phase; Bedrock only until stable

## Context & Research

### Relevant Code and Patterns

- `bigdoors_bp/scripts/handler/HingePlacementHandler.js:89` — `_mergeWithAdjacentHinge()` returns on first match
- `bigdoors_bp/scripts/handler/BreakHandler.js:49` — `handleHingeBreak()` dissolves unconditionally
- `bigdoors_bp/scripts/handler/BreakHandler.js:70` — `_dissolveAssembly()` reverts all panels
- `bigdoors_bp/scripts/DoorManager.js:81` — `addHingeToAssembly()` pattern for index management
- `bigdoors_bp/scripts/DoorManager.js:130` — `dissolveAssembly()` cleanup pattern
- `bigdoors_bp/scripts/DoorManager.js:236` — `pairAndSplitAssemblies()` shows how to transfer panels between assemblies and update position index
- `bigdoors_bp/scripts/domain/DoorAssembly.js:54` — `addHinge()` domain method

### Patterns to Follow

- Manager methods handle `_positionIndex` updates; domain classes are index-unaware
- All state mutations end with `this.save()`
- Handlers delegate to manager; manager delegates to domain objects
- Test helpers in `tests/helpers/mock-dimension.mjs` provide `makeMockDimension`, `placeBlock`, `makeMockPlayer`

## Key Technical Decisions

- **Union into earliest-created assembly (lowest `door_N`)**: When merging N assemblies, the handler must collect all unique adjacent assembly IDs, parse the numeric `door_N` suffix from each, sort ascending, and use the lowest as canonical. The scan order in `_mergeWithAdjacentHinge()` (y+1 before y-1) must not determine canonicality — it only determines discovery order. After collecting, the lowest-ID assembly absorbs the rest via `mergeAssemblies()`.

- **Copy full hinge records during merge, not `addHinge()`**: `DoorAssembly.addHinge()` always assigns `UNMATCHED_MATERIAL_INDEX`, which would overwrite any real `materialIndex` on absorbed hinges that already have panels. During merge, copy the full hinge record `{x, y, z, type, materialIndex}` directly into the canonical assembly's `hingePositions` array, preserving material state.

- **Canonical partner wins during merge**: If the canonical assembly already has a `partnerAssemblyId` and an absorbed assembly has a different partner, unpair the absorbed assembly's partner before merging (call `unpairAssembly` on the absorbed assembly). This prevents an inconsistent double-door graph. If only the absorbed assembly has a partner, transfer that partnership to the canonical assembly.

- **Contiguity check on break uses strict no-gap definition**: After removing a hinge, sort remaining hinge positions along the stacking axis (y for horizontal-mode, the rotation axis for vertical-mode). Check that each consecutive pair differs by exactly 1 — any gap means the column is non-contiguous. A single remaining hinge is trivially contiguous. This avoids incorrectly keeping disconnected sets like `[y=0, y=1, y=3, y=4]`.

- **Manager owns the merge method**: `mergeAssemblies()` belongs on `DoorManager` (not `DoorAssembly`) because it needs to update `_positionIndex` and delete absorbed assemblies. The domain class needs a new `addHingeRecord(record)` that copies a full hinge entry (preserving materialIndex), alongside the existing `addHinge()` which assigns `UNMATCHED_MATERIAL_INDEX`.

- **Dissolution returns data before deleting**: `removeHingeFromAssembly()` returns a result object `{ status: "kept" | "dissolve_required", assembly }` instead of calling `dissolveAssembly()` internally. The handler receives the still-populated assembly object, reverts world blocks, then calls `manager.dissolveAssembly()` to clean up manager state. This avoids relying on a stale object after manager deletion.

- **Primary hinge recalculation after hinge removal**: When a hinge is removed, if it was `primaryHingePos`, update `primaryHingePos` to the first remaining hinge. This keeps the primary hinge stable for double-door axis calculations.

## Open Questions

### Resolved During Planning

- **Should union preserve partner state?** Yes — if only one assembly (canonical or absorbed) has a partner, that partnership transfers to the canonical assembly. If the canonical already has a partner and an absorbed assembly has a different partner, the canonical's partner wins: call `unpairAssembly()` on the absorbed assembly before merging to cleanly dissolve that double-door relationship. This is deterministic and avoids an inconsistent double-door graph.

- **Should breaking a hinge update the in-world block states of remaining hinges?** No — remaining hinge blocks already have correct permutation states. Only the broken hinge's block is already gone (the break event fires after the block is destroyed).

### Deferred to Implementation

- Exact iteration order when checking contiguity (BFS vs sorted-array scan) — both work for a small set of positions, implementer can choose

## Implementation Units

- [x] **Unit 1: Add `mergeAssemblies()` to DoorManager**

**Goal:** Provide a manager method that unions multiple assemblies into one canonical assembly.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `bigdoors_bp/scripts/DoorManager.js`
- Modify: `bigdoors_bp/scripts/domain/DoorAssembly.js`
- Test: `tests/DoorManager.test.mjs`

**Approach:**
- Add `mergeAssemblies(canonicalId, ...otherIds)` to `DoorManager`
- Add `addHingeRecord(record)` to `DoorAssembly` — pushes a full `{x, y, z, type, materialIndex}` object without overwriting `materialIndex` (unlike `addHinge()` which always sets `UNMATCHED_MATERIAL_INDEX`)
- For each absorbed assembly: copy all `hingePositions` into canonical via `addHingeRecord()`, move all `panelPositions` and `boundaryPanels` into canonical, update `_positionIndex` for every moved position
- Partner transfer: if canonical has no partner but absorbed does, transfer absorbed's partnership to canonical (update both sides). If canonical already has a partner and absorbed has a different partner, call `unpairAssembly(absorbedId)` first to cleanly dissolve that relationship. Then delete the absorbed assembly from `_assemblies`
- Adopt `doorSide`, `mode`, `facing`, and material from the canonical assembly (which inherited them from the first-found adjacent assembly during merge)
- Recalculate `primaryHingePos` as the minimum-y (for horizontal mode) or minimum along the rotation axis (for vertical mode) hinge position across all merged hinges

**Patterns to follow:**
- `pairAndSplitAssemblies()` in `DoorManager.js:236` — same pattern of moving panels between assemblies and updating `_positionIndex`
- `dissolveAssembly()` in `DoorManager.js:130` — cleanup pattern for removing an assembly

**Test scenarios:**
- Happy path: merge two assemblies (A has hinges y=0,1; B has hinge y=3) → canonical has 3 hinges, B is deleted, position index maps all 3 to canonical
- Happy path: merge two assemblies where absorbed assembly has panels → panels transfer to canonical, position index updated
- Happy path: merge where absorbed assembly has a partner → partner's `partnerAssemblyId` now points to canonical
- Happy path: merge where absorbed hinges have a real `materialIndex` (not UNMATCHED) → canonical preserves those materialIndex values
- Edge case: merge where canonical has partner A and absorbed has partner B → call `unpairAssembly(absorbedId)` to break B's partnership, then merge proceeds with canonical keeping partner A
- Edge case: merge where both assemblies have panels with overlapping material → all panels preserved (no dedup needed since hinges don't share panel positions)
- Edge case: merge three assemblies at once (hinge bridges two non-adjacent groups that each have an adjacent third) → all three union into one
- Integration: after merge, `findByPosition()` returns canonical for all former positions of absorbed assemblies

**Verification:**
- All hinge and panel positions from merged assemblies resolve to the canonical assembly via `findByPosition()`
- Absorbed assemblies no longer exist in `_assemblies`
- Partner references are consistent (no dangling `partnerAssemblyId`)

- [x] **Unit 2: Fix `_mergeWithAdjacentHinge()` to collect and union all adjacent assemblies**

**Goal:** Make hinge placement merge all reachable adjacent assemblies, not just the first.

**Requirements:** R1, R3

**Dependencies:** Unit 1

**Files:**
- Modify: `bigdoors_bp/scripts/handler/HingePlacementHandler.js`
- Test: `tests/HingePlacementHandler.test.mjs`

**Approach:**
- Change `_mergeWithAdjacentHinge()` to collect all unique adjacent assemblies (by ID) instead of returning on the first match
- After collecting, sort by numeric `door_N` suffix (ascending) to determine the canonical assembly — do not rely on scan order (y+1 before y-1)
- If one assembly found: add hinge to it (existing behavior)
- If multiple found: add hinge to the canonical (lowest `door_N`), then call `manager.mergeAssemblies(canonical.id, ...rest)` to union them all
- Return the canonical assembly in all cases

**Patterns to follow:**
- Current `_mergeWithAdjacentHinge()` structure — keep the vertical-first, then horizontal scan order
- The new hinge still gets added to the canonical assembly via `addHingeToAssembly()`

**Test scenarios:**
- Happy path: place hinges in order [y=0, y=1, y=3, y=2] → after y=2, all four are in one assembly
- Happy path: place hinges [y=0, y=1, y=3, y=2] then place a panel at row 0 → all four hinges get the same material
- Edge case: bridge hinge with panels already on both sides → panels from both original assemblies belong to the merged assembly
- Edge case: bridge hinge in vertical mode (horizontal neighbors) → same union behavior along the horizontal axis
- Edge case: hinge placed with one vertical neighbor (assembly A) and one horizontal neighbor (assembly B, vertical mode) → both merge into canonical
- Integration: after bridge placement, `findByPosition()` on all hinge positions returns the same assembly

**Verification:**
- Placing hinges in any order on a contiguous column always produces exactly one assembly
- Panel placement after merge updates all hinges in the unified assembly

- [x] **Unit 3: Add `removeHingeFromAssembly()` to DoorManager**

**Goal:** Provide a manager method that removes a single hinge from an assembly and checks contiguity.

**Requirements:** R4, R5, R6

**Dependencies:** None (can start in parallel with Units 1-2; blocks Unit 4)

**Files:**
- Modify: `bigdoors_bp/scripts/DoorManager.js`
- Modify: `bigdoors_bp/scripts/domain/DoorAssembly.js`
- Test: `tests/DoorManager.test.mjs`

**Approach:**
- Add `removeHinge(pos)` to `DoorAssembly` — removes the hinge entry from `hingePositions` by position match
- Add `removeHingeFromAssembly(assemblyId, hingePos)` to `DoorManager`:
  1. Remove hinge from domain object
  2. Delete position from `_positionIndex`
  3. If no hinges remain → call `unpairAssembly(assemblyId)` if partnered, return `{ status: "dissolve_required", assembly }`
  4. Check contiguity of remaining hinges using strict no-gap definition: sort positions along stacking axis (y for horizontal mode, rotation axis for vertical mode), then verify each consecutive pair differs by exactly 1. A single remaining hinge is trivially contiguous
  5. If contiguous → update `primaryHingePos` to the new minimum hinge, call `save()`, return `{ status: "kept", assembly }`
  6. If not contiguous → call `unpairAssembly(assemblyId)` if partnered, return `{ status: "dissolve_required", assembly }` (out-of-scope to split)
- The manager does **not** call `dissolveAssembly()` itself — it returns the still-populated assembly object so the handler can revert world blocks before the handler calls `dissolveAssembly()` to clean up manager state
- The `dissolve_required` path deliberately skips `save()` because `dissolveAssembly()` will call `save()` after full cleanup. This is safe because Bedrock Script API is single-threaded with no interleaved event processing within a handler call

**Patterns to follow:**
- `removePanelFromAssembly()` in `DoorManager.js:111` — similar remove-and-check pattern
- `dissolveAssembly()` for cleanup

**Test scenarios:**
- Happy path: remove one hinge from a 3-hinge contiguous column [y=0,1,2], remove y=2 → returns `{ status: "kept" }`, assembly has 2 hinges, panels intact
- Happy path: remove hinge, remaining are contiguous → `primaryHingePos` updated to lowest remaining
- Happy path: remove last hinge → returns `{ status: "dissolve_required", assembly }` with populated panel arrays for world revert
- Happy path: remove last hinge from partnered assembly → partner's `partnerAssemblyId` cleared before returning dissolve_required
- Edge case: remove middle hinge from [y=0, y=1, y=2] → remaining y=0 and y=2 are non-contiguous (gap at y=1) → dissolve_required
- Edge case: remove hinge from [y=0, y=1, y=3, y=4] leaving [y=0, y=1, y=4] → non-contiguous (gap at y=2-3) → dissolve_required
- Edge case: remove hinge that was `primaryHingePos` → `primaryHingePos` recalculated
- Edge case: assembly has partner, hinge removed but assembly survives → partner relationship preserved
- Edge case: single-hinge assembly, remove it → dissolve_required (trivially zero hinges)

**Verification:**
- After removal, `findByPosition(removedHingePos)` returns null
- Assembly survives with correct hinge count when contiguous
- Returns `dissolve_required` (not dissolved yet) when remaining hinges are non-contiguous — assembly object still has panel data for world revert

- [x] **Unit 4: Update `handleHingeBreak()` to use graceful removal**

**Goal:** Replace unconditional `_dissolveAssembly()` with the new `removeHingeFromAssembly()` path.

**Requirements:** R4, R5, R6, R7

**Dependencies:** Unit 3

**Files:**
- Modify: `bigdoors_bp/scripts/handler/BreakHandler.js`
- Test: `tests/BreakHandler.test.mjs`

**Approach:**
- In `handleHingeBreak()`, call `manager.removeHingeFromAssembly(assembly.id, hingePos)` instead of `_dissolveAssembly()`
- If result status is `"dissolve_required"`: use the returned `assembly` object (still populated with panel data) to revert panels to vanilla blocks via `_dissolveAssembly()`, then call `manager.dissolveAssembly(assembly.id)` to clean up manager state
- If result status is `"kept"`: do nothing to panels — they stay as door panels
- Item drop logic stays the same (drop the broken hinge block in survival)
- `_dissolveAssembly()` is refactored to accept an assembly object as a parameter (it already does) and remains the handler's responsibility for world-block revert

**Patterns to follow:**
- Current `handleHingeBreak()` structure
- `handlePanelBreak()` pattern of checking remaining count before deciding action

**Test scenarios:**
- Happy path: break one hinge from 3-hinge assembly, remaining contiguous → assembly survives, panels untouched, hinge item dropped
- Happy path: break last hinge → manager returns dissolve_required, handler reverts panels to vanilla, then calls dissolveAssembly (existing behavior preserved)
- Happy path: break hinge from 2-hinge assembly leaving 1 → assembly survives with 1 hinge
- Edge case: break middle hinge leaving non-contiguous remainder → handler receives dissolve_required with populated assembly, reverts panels, then calls dissolveAssembly
- Edge case: break hinge on a double-door assembly, assembly survives → partner relationship preserved, double-door still works
- Error path: break hinge at position not in any assembly → no-op (existing behavior)
- Integration: break one hinge, then place a panel → panel attaches to surviving assembly correctly

**Verification:**
- Breaking a non-terminal hinge preserves the door's panels and functionality
- Breaking the only hinge fully dissolves the assembly (backward compatibility)
- Item drops work correctly in all cases

## System-Wide Impact

- **Interaction graph:** `HingePlacementHandler.onPlace()` → `DoorManager.mergeAssemblies()`. `BreakHandler.handleHingeBreak()` → `DoorManager.removeHingeFromAssembly()`. No other subsystems are affected — movement, redstone, and interaction handlers all work through the manager's existing API.
- **Error propagation:** If `mergeAssemblies` fails partway through (unlikely — all in-memory), the position index could be inconsistent. Mitigation: perform all index deletions before insertions, matching the pattern in `pairAndSplitAssemblies`.
- **State lifecycle risks:** Partner assembly references must be updated atomically during merge. If assembly A absorbs assembly B, and B had partner C, then C's `partnerAssemblyId` must change from B to A in the same `save()` call.
- **Persistence:** Both merge and break-removal trigger `save()`, so the world dynamic property stays consistent. No new persistence keys or schema changes needed.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Merge reorders hingePositions, breaking primaryHingePos assumptions | Explicitly recalculate primaryHingePos after merge as min-position hinge |
| Non-contiguous detection has off-by-one on vertical-mode axis | Test with both horizontal and vertical assemblies; contiguity check uses sorted position comparison |
| Breaking hinge on open door leaves panels in rotated positions without enough hinges | Out of scope for now — dissolution handles open doors already; graceful removal only keeps assembly if contiguous, which means the rotation axis is still valid |

## Sources & References

- Related code: `bigdoors_bp/scripts/DoorManager.js` — all assembly state management
- Related code: `bigdoors_bp/scripts/handler/HingePlacementHandler.js:89` — merge entry point
- Related code: `bigdoors_bp/scripts/handler/BreakHandler.js:49` — break entry point
