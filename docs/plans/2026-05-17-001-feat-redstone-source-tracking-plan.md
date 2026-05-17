---
title: "feat: Track redstone source block for intuitive door auto-close"
type: feat
status: active
date: 2026-05-17
deepened: 2026-05-17
---

# feat: Track redstone source block for intuitive door auto-close

## Overview

Replace the current "scan all assembly positions for residual power" close strategy with source-block tracking. When redstone opens a door, remember which external block supplied the signal. Poll that block to decide when to close. Manually-opened doors have no tracked source and stay open until manually closed or adopted by a new redstone source.

## Problem Frame

The current `RedstoneSubsystem` closes a door when `powerLevel === 0` fires on any assembly block and a deferred re-scan finds no power on any hinge or panel position. This breaks when a door swings away from a pressure plate — the rotated panels lose contact with the signal, the re-scan finds zero power everywhere, and the door slams shut immediately even though the pressure plate is still active.

The fix: remember the specific world block (e.g., the pressure plate's position) that originally triggered the open, and monitor *that* block's power level. The door stays open as long as that source block is powered, regardless of where the panels rotated to.

## Requirements Trace

- R1. Redstone-opened doors track the source block position that triggered the open
- R2. The door auto-closes only when the tracked source block depowers (not when assembly blocks lose contact)
- R3. Manually-opened doors (player interaction) have no tracked source and stay open indefinitely
- R4. A redstone source can "adopt" an already-open door (setting itself as the tracked source) only if it is in conductive contact with a current assembly block position
- R5. If an adopted source depowers, the door closes (toggle behavior for pressure plates near open doors)
- R6. Partner/double-door coordination continues to work — both doors share the same source tracking lifecycle

## Scope Boundaries

- No changes to how redstone *opens* a door (direction preference, obstruction check, sweep — all unchanged)
- No changes to the InteractionHandler's open/close logic beyond clearing the source on manual close
- No separate polling subsystem class — source monitoring is handled within RedstoneSubsystem via `system.runInterval`, replacing the event-driven deferred close check
- Panel blocks remain redstone-aware (they still fire `onRedstoneUpdate`) but panel events no longer trigger auto-close; only the tracked source matters
- Java parity deferred — this plan is Bedrock-only
- Overworld only — doors in Nether/End are not in scope for this iteration (if needed later, store dimension ID alongside source position)

## Context & Research

### Relevant Code and Patterns

- `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js` — current open/close logic, `_scheduleCloseCheck` is the target for refactoring
- `bigdoors_bp/scripts/domain/DoorAssembly.js` — domain model, needs new `redstoneSource` field
- `bigdoors_bp/scripts/DoorManager.js` — persistence, position index, debounce tracking
- `bigdoors_bp/scripts/handler/InteractionHandler.js` — manual open/close, must clear source on manual toggle
- `bigdoors_bp/scripts/util/Constants.js` — `REDSTONE_DEBOUNCE_TICKS`, add polling interval constant
- `bigdoors_bp/blocks/hinge.json` — hinge block definition with `onRedstoneUpdate` component

### Key Existing Patterns

- Debounce via `manager.setRedstoneDebounce()` / `isRedstoneDebounced()` — reuse for close polling
- `_preferredDirectionFromSignal()` already identifies the powered neighbor that isn't part of the door — this is exactly the source block we want to track
- `system.runTimeout()` for deferred checks — extend to periodic source polling
- Domain objects are pure JS (no `@minecraft/server` imports) — the `redstoneSource` field stores only `{x,y,z}` coordinates
- Persistence via `toJSON()`/`fromJSON()` — new field must serialize

## Key Technical Decisions

- **Store source on `DoorAssembly` (domain layer):** The source position is part of the door's state — it must persist across world reloads so a door reopened from persistence still knows its source. A `{x,y,z}` or `null` field is domain-safe (no Bedrock imports).
- **Poll the source block, don't rely on `onRedstoneUpdate` for close:** The source block (e.g., pressure plate) is not part of the door assembly, so it doesn't fire `onRedstoneUpdate` callbacks on door blocks when it depowers. We must actively poll it. Use `system.runInterval` with a short tick interval.
- **"Source" means the immediate powered neighbor, not the true signal origin:** If a repeater sits between a pressure plate and the door, the stored source is the repeater (the immediate neighbor with power). This is intentional — the repeater depowers when the plate depowers (with at most 1-4 tick delay from repeater settings), so the door still closes correctly. We don't need to trace the full redstone graph back to the original input device.
- **"Conductive contact" means adjacency to a current assembly position:** A source can adopt an open door only if the source block is within 1 block (6-neighbor) of any current hinge or panel position. This is the same adjacency check the existing `_preferredDirectionFromSignal` uses.
- **Manual interaction always clears the source:** When a player right-clicks to close a redstone-opened door, that's an intentional override. Clear the tracked source so the door doesn't fight the player by re-opening on the next poll.
- **Manual interaction on an open door with a powered source still closes it:** The player's intent overrides redstone. The source is cleared, preventing auto-reopen. However, if the source later depowers and re-powers, the door will open fresh via the normal `power > 0 && !isOpen` path — this is intentional (the user said "a new redstone impulse resets them").
- **`_sourceMonitors` map is a sanctioned exception to "no subsystem state":** The subsystem stores ephemeral `system.runInterval` handles. This is purely runtime bookkeeping (not authoritative state) — the manager's `redstoneSource` field is the source of truth. The map exists only to enable cleanup.
- **Source clearing must happen BEFORE closing the door:** `clearRedstoneSource` → `closeDoor` ordering prevents a TOCTOU race where the poll tick fires between close and clear, sees a non-null source on a closed door, and skips cleanup.
- **Adoption does not override an assembly's own source:** If an assembly already has a tracked source (from the redstone open that opened it), a new `onRedstoneUpdate` event on that same assembly is ignored — one source at a time per door. However, when source changes propagate to a partner (on open or adoption), the partner's source IS overwritten to maintain R6 coordination. Partner doors always share the same source so they close together.

## Open Questions

### Resolved During Planning

- **How do we detect the source block on open?** The existing `_preferredDirectionFromSignal()` already scans neighbors of the signaled assembly block to find the external powered block. We extract and store that position.
- **What if the source block is destroyed?** `dimension.getBlock(pos)` returns an air block. `getRedstonePower()` may return `null`/`undefined` rather than `0` for air — the poll must treat any non-positive value (null, undefined, or 0) as depowered using the `power != null && power > 0` pattern. The door will auto-close. This is correct behavior.
- **What about multi-block doors where multiple panels receive signals from different sources?** Only the first signal that triggers the open is stored. Subsequent `onRedstoneUpdate` events while the door is already open are handled by the adoption logic (R4).

### Deferred to Implementation

- **Exact polling interval for source monitoring:** Start with `REDSTONE_DEBOUNCE_TICKS` (4 ticks / 0.2s) and adjust if performance or responsiveness is an issue.
- **Whether `system.runInterval` or repeated `system.runTimeout` is more appropriate:** Depends on whether we need to cancel the interval on close. Likely `runInterval` with a stored handle that gets cleared.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
STATE MACHINE per assembly:

  [CLOSED, source=null]
       |
       | onRedstoneUpdate(power>0) on assembly block
       | → identify source neighbor
       | → open door
       | → store source position
       | → start source monitor
       v
  [OPEN, source={x,y,z}]
       |                          |
       | source depowers          | player interacts
       | → close door             | → close door
       | → clear source           | → clear source
       | → stop monitor           | → stop monitor
       v                          v
  [CLOSED, source=null]      [CLOSED, source=null]

  [CLOSED, source=null]
       |
       | player interacts (manual open)
       v
  [OPEN, source=null]
       |                          |
       | onRedstoneUpdate(power>0)| player interacts
       | on assembly block        | → close door
       | AND source is adjacent   |
       | → adopt source           |
       | → start monitor          |
       v                          v
  [OPEN, source={x,y,z}]    [CLOSED, source=null]
       |
       | source depowers
       | → close door
       | → clear source
       | → stop monitor
       v
  [CLOSED, source=null]
```

**Source monitoring approach:**
- On open (with source): start `system.runInterval` polling the source block's power
- On close or manual override: `system.clearRun` the interval handle
- The interval handle is ephemeral (not persisted) — on world reload, any open door with a non-null source restarts its monitor during the load/hydration phase

## Implementation Units

- [ ] **Unit 1: Add `redstoneSource` field to DoorAssembly domain model**

**Goal:** Extend the domain model to store the tracked redstone source position, with serialization support.

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `bigdoors_bp/scripts/domain/DoorAssembly.js`
- Test: `tests/DoorAssembly.test.mjs`

**Approach:**
- Add `this.redstoneSource = null` in the constructor (type: `{x,y,z}` or `null`)
- Include in `toJSON()` output (omit if null to keep payloads small)
- Restore in `fromJSON()` (default to null if absent for backward compat with existing saves)

**Patterns to follow:**
- Same pattern as `partnerAssemblyId` — nullable field, conditionally serialized

**Test scenarios:**
- Happy path: new assembly has `redstoneSource === null`
- Happy path: `toJSON()` includes `redstoneSource` when set, omits when null
- Happy path: `fromJSON()` restores a saved source position correctly
- Edge case: `fromJSON()` on legacy data without `redstoneSource` field defaults to null (backward compat)

**Verification:**
- Unit tests pass for serialization round-trip with and without source

---

- [ ] **Unit 2: Store source position on redstone open and add manager helpers**

**Goal:** When the RedstoneSubsystem opens a door, identify and persist the external source block position.

**Requirements:** R1, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Modify: `bigdoors_bp/scripts/DoorManager.js`
- Test: `tests/RedstoneSubsystem.test.mjs`

**Approach:**
- Extract the source identification logic from `_preferredDirectionFromSignal()` into a reusable helper (or inline the result capture)
- After `_openWithRedstone` succeeds, set `assembly.redstoneSource = sourcePos` and call `manager.save()`
- Add `manager.setRedstoneSource(assemblyId, pos)` and `manager.clearRedstoneSource(assemblyId)` convenience methods that set the field and save
- For partner doors: the partner also gets the same source position stored (both doors close together when the source depowers)

**Patterns to follow:**
- `manager.openDoor()` pattern — mutate assembly state, update index, save

**Test scenarios:**
- Happy path: redstone open stores the correct source neighbor position on the assembly
- Happy path: partner assembly also receives the source position
- Edge case: if no external powered neighbor is found (signal comes from unknown direction), source remains null (door opens but behaves as manually-opened for close purposes)
- Integration: source persists through save/load cycle

**Verification:**
- After a redstone open, `assembly.redstoneSource` is a valid `{x,y,z}` matching the powered neighbor
- Partner assembly has the same source stored

---

- [ ] **Unit 3: Replace deferred close scan with source-block polling**

**Goal:** Instead of scanning all assembly positions for residual power, monitor the tracked source block and close only when it depowers.

**Requirements:** R2, R6

**Dependencies:** Unit 2

**Files:**
- Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Modify: `bigdoors_bp/scripts/util/Constants.js`
- Test: `tests/RedstoneSubsystem.test.mjs`

**Approach:**
- Add `REDSTONE_SOURCE_POLL_TICKS` constant (start at 4 ticks, same as debounce)
- After a successful redstone open, start a `system.runInterval` that polls `dimension.getBlock(source).getRedstonePower()`
- Store the interval handle in an ephemeral map (`_sourceMonitors: Map<assemblyId, runHandle>`) on the subsystem — NOT persisted
- When source power drops to 0: close the door (and partner), clear the source, clear the interval
- Remove the old `_scheduleCloseCheck` logic entirely (or keep it only as a fallback for doors with null source — but those shouldn't auto-close anyway)
- When `onRedstoneUpdate` fires with `powerLevel === 0` on an assembly block that has a tracked source: ignore it (don't close). The monitor handles closing.
- When `onRedstoneUpdate` fires with `powerLevel === 0` on an assembly block with NO tracked source: also ignore it (manually-opened, stays open per R3)
- Poll callback's first guard: `if (!assembly.redstoneSource) { clearInterval; return; }` — this is how manual-close propagates to the monitor without direct handler→subsystem coupling
- When an assembly is dissolved or reset (via `BreakHandler`), the monitor self-cleans on its next poll tick: the poll checks `manager.getAssembly(id)` — if null (dissolved) or `!assembly.redstoneSource` (reset), it clears the interval and removes itself from `_sourceMonitors`. No explicit manager→subsystem callback needed; poll-time detection is sufficient since the interval is at most 4 ticks.

**Patterns to follow:**
- `system.runInterval` / `system.clearRun` pattern from Bedrock Script API
- Debounce check before closing (reuse existing debounce mechanism)

**Test scenarios:**
- Happy path: door stays open while source block remains powered, even though panel blocks report power=0
- Happy path: door closes when source block depowers
- Happy path: partner door closes simultaneously
- Edge case: source block destroyed (air) → power reads as 0 �� door closes
- Edge case: multiple rapid power toggles on source → debounce prevents oscillation
- Edge case: door broken/dissolved while monitor is active → monitor clears itself (no leaked intervals)
- Error path: dimension.getBlock throws LocationInUnloadedChunkError (not null) → wrap in try/catch, skip this poll tick, don't close
- Error path: getRedstonePower() returns null/undefined for non-redstone blocks (e.g., air) → treat as depowered (use `power != null && power > 0` pattern matching existing code at line 65)

**Verification:**
- A pressure plate in front of a big door keeps it open while stepped on, closes when player walks away
- Door does NOT slam shut when panels rotate away from the plate

---

- [ ] **Unit 4: Implement redstone adoption for already-open doors**

**Goal:** Allow a redstone source to "adopt" a manually-opened (or source-less) door if it's in conductive contact with a current assembly position.

**Requirements:** R4, R5

**Dependencies:** Unit 3

**Files:**
- Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Test: `tests/RedstoneSubsystem.test.mjs`

**Approach:**
- In `handleRedstoneUpdate`: when `powerLevel > 0` and the door IS already open (currently this case is a no-op), check if `assembly.redstoneSource` is null
- If null: the door was manually opened. Check adjacency — is the signaled assembly block adjacent to a non-door block with power? If yes, that neighbor is the source. Adopt it: set `assembly.redstoneSource`, start the monitor
- If `redstoneSource` is already set (different source): ignore. One source at a time.
- "Conductive contact" = the `onRedstoneUpdate` event itself proves contact — it only fires on assembly blocks that are receiving power. The event's existence IS the adjacency proof.

**Patterns to follow:**
- Reuse the source-identification logic from Unit 2
- Same monitor start pattern from Unit 3

**Test scenarios:**
- Happy path: manually open door, then activate adjacent pressure plate → source is adopted, door will close when plate depowers
- Happy path: door that swung AWAY from a pressure plate (no assembly block adjacent to plate) → plate activation does NOT adopt (no `onRedstoneUpdate` fires on assembly blocks because they're out of range)
- Edge case: door already has a tracked source → new redstone signal is ignored (no source override)
- Edge case: partner door also gets the adopted source
- Integration: adopt → source depowers → door closes correctly

**Verification:**
- A pressure plate next to an already-open door (that's still in contact) will close it when the player walks away
- A pressure plate that's NOT adjacent to any current assembly position has no effect

---

- [ ] **Unit 5: Clear source on manual interaction and handle re-open after manual close**

**Goal:** When a player manually closes a redstone-opened door, clear the tracked source and stop the monitor. Ensure the system doesn't fight the player.

**Requirements:** R3, R5

**Dependencies:** Unit 3

**Files:**
- Modify: `bigdoors_bp/scripts/handler/InteractionHandler.js`
- Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Test: `tests/InteractionHandler.test.mjs`

**Approach:**
- In `InteractionHandler._close()`: call `manager.clearRedstoneSource(assembly.id)` BEFORE `manager.closeDoor()` — this ordering prevents the TOCTOU race described in Key Technical Decisions (the poll sees source=null and self-terminates before it could observe a closed-but-source-set state)
- The handler does NOT need to directly signal the subsystem. The poll interval checks `assembly.redstoneSource` on each tick; when it sees null, it clears itself (option c — simplest, no new coupling)
- In `InteractionHandler._close()` for partner doors: also clear partner's source before closing partner
- When a player manually OPENS a door, source stays null (no monitor started). This is existing behavior, just make it explicit.

**Patterns to follow:**
- InteractionHandler already sets debounce after interaction — same pattern for source clearing

**Test scenarios:**
- Happy path: player closes a redstone-opened door → source cleared, monitor stops, door stays closed even if source block is still powered
- Happy path: player closes partner door → both sources cleared
- Edge case: player opens a door manually while a nearby pressure plate is active but not adjacent → no source set, door stays open
- Edge case: player opens door manually, then closes it, then pressure plate activates → door re-opens via normal redstone path (source is fresh)

**Verification:**
- Manual close always wins over redstone — door doesn't re-open by itself after player closes it
- After manual close, the pressure plate can still open the door fresh (not stuck in limbo)

---

- [ ] **Unit 6: Restart monitors on world load for persisted open doors**

**Goal:** When the world loads and an assembly has `isOpen === true` and `redstoneSource !== null`, restart the source monitor so auto-close still works after reload.

**Requirements:** R2

**Dependencies:** Unit 3

**Files:**
- Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Modify: `bigdoors_bp/scripts/main.js`
- Test: `tests/RedstoneSubsystem.test.mjs`

**Approach:**
- Add a `restoreMonitors()` method on RedstoneSubsystem that obtains the dimension internally via `world.getDimension("overworld")` (scoped to overworld per Scope Boundaries)
- After `manager.load()` completes (in both `worldLoad` and the `system.run` fallback), call `redstone.restoreMonitors()`
- Iterate all assemblies; for any with `isOpen && redstoneSource !== null`, start a poll interval
- Store the dimension reference on the subsystem instance (set once during restore, reused by all monitors)

**Patterns to follow:**
- Same startup wiring pattern as existing handler registration in `main.js`

**Test scenarios:**
- Happy path: save world with redstone-opened door, reload → monitor restarts, door closes when source depowers
- Edge case: door was open with source, but source block was destroyed before reload → first poll finds air/power=0, door closes
- Edge case: door was manually opened (source=null) → no monitor started on reload, door stays open

**Verification:**
- Redstone-opened doors survive world reload and still auto-close correctly
- Manually-opened doors survive reload and stay open

## System-Wide Impact

- **Interaction graph:** `InteractionHandler` now has a dependency on source-clearing (via manager). `RedstoneSubsystem` gains poll intervals as a new execution pattern. `main.js` startup gains a monitor restoration step. `BreakHandler` / assembly dissolution must clear active monitors.
- **Error propagation:** `dimension.getBlock()` throws `LocationInUnloadedChunkError` when the source block's chunk is unloaded (not null return). The poll must wrap in try/catch and skip that tick. Chunk reload will restore the block and subsequent polls will read correctly.
- **State lifecycle risks:** The interval handles (`_sourceMonitors` map) are ephemeral — if the subsystem is garbage collected or the script reloads without cleanup, intervals could leak. Mitigation: `restoreMonitors` on load clears any stale handles before starting new ones. Assembly dissolution/reset must also clear the monitor.
- **Race window on manual close:** Up to `REDSTONE_SOURCE_POLL_TICKS` (4 ticks) may elapse between source clearing and the monitor self-terminating. During this window, the poll fires, sees `redstoneSource === null`, and clears itself harmlessly. No re-open is possible because the poll only monitors — it does not open doors.
- **API surface parity:** Java port will need equivalent logic. Deferred — not in scope.
- **Unchanged invariants:** Door open mechanics (direction preference, obstruction check, sweep, block movement), panel placement/break handlers, hinge placement, double-door pairing, entity sweeper — all unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `system.runInterval` performance with many open doors | Each open door is one lightweight poll (single `getBlock` + `getRedstonePower` call). Even 50 simultaneous open doors is negligible vs. tick budget. |
| Chunk unload causes false close | Poll skips when `getBlock` returns null; only closes on confirmed power=0 |
| Backward compat with existing saves | `fromJSON` defaults `redstoneSource` to null — existing open doors behave as manually-opened (won't auto-close until interacted with) |
| Source block replaced with non-powered block (e.g., player places stone over pressure plate) | Power reads as 0, door closes. Correct and intuitive behavior. |
