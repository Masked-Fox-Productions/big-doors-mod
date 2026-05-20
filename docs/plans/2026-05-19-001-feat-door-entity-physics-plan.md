---
title: "feat: Door swing entity physics — positional displacement and impulse"
type: feat
status: active
date: 2026-05-19
---

# feat: Door swing entity physics — positional displacement and impulse

## Overview

Replace the current entity sweeper with physics-aware displacement. When a door opens or closes, entities in the swing arc are teleported to the front of the specific panel block that intersects them, then receive a knockback impulse proportional to how far that panel traveled. Entities also take fall-damage-style damage scaled by displacement distance — small doors are harmless, but getting catapulted by a massive vertical door hurts. This creates intuitive gameplay: a small door gives a gentle shove, while a long vertical door closing acts as a catapult with real consequences. Entities that would be crushed (pushed into a solid block) are displaced to the nearest open space, matching vanilla piston behavior.

## Problem Frame

The current `EntitySweeper` detects entities in the swept path but pushes them a fixed 1.5 blocks radially from the hinge (rotating doors) or along the shift axis (winch doors). This produces unintuitive movement — entities end up in unexpected positions unrelated to where the door panel actually lands. There's no momentum or impulse, so the interaction feels mechanical rather than physical. The user wants doors to feel like they *hit* you: you get shoved to where the panel ends up, then receive a push proportional to the force.

## Requirements Trace

- R1. Entities in the swing arc are matched to the specific panel block whose path intersects them
- R2. Matched entities are teleported to the position immediately in front of that panel's destination (on the outward-facing side)
- R3. After teleport, entities receive a knockback impulse proportional to the diagonal distance the panel traveled (source to destination)
- R4. A long vertical door (e.g. open/horizontal, closing upward) should act as a catapult — entities on the far end receive the largest impulse
- R5. If the teleport destination is a solid block (crush scenario), the entity is displaced to the nearest adjacent open space instead (piston-style behavior)
- R6. Both rotating doors (hinge) and linear doors (winch) receive the new physics
- R7. The system works for all entity types, not just players
- R8. Entities take distance-based damage (fall-damage formula): `max(0, floor(distance - DAMAGE_THRESHOLD))`. Small doors (under threshold) deal no damage; large doors deal increasing damage proportional to displacement

## Scope Boundaries

- Damage uses Bedrock's `entity.applyDamage()` with a vanilla-feeling cause; no custom damage system
- No partial-arc animation; the door still teleports instantly, entities are moved in the same tick
- No changes to the obstruction checker — entity physics runs after the door has already decided to move
- No special handling for entities riding other entities (mounts) — standard Bedrock behavior applies
- `computeArcPositions` needs two fixes for correct entity matching: (1) accept a `direction` parameter to sample the correct arc for CW vs CCW rotation (currently hardcoded to CW), and (2) support vertical-mode arc midpoints in the Y/Z or Y/X plane (currently horizontal-only). These are pre-existing limitations that the new per-panel matching makes more visible. Both fixes are scoped to Unit 1.

## Context & Research

### Relevant Code and Patterns

- `bigdoors_bp/scripts/subsystem/EntitySweeper.js` — current implementation with `sweep()` (rotating) and `sweepLinear()` (winch). Both detect entities via `dimension.getEntities()` within a bounding box, check if the entity's block position is in the swept set, and teleport by a fixed offset
- `bigdoors_bp/scripts/domain/RotationMath.js` — `computeArcPositions()` computes the 45-degree midpoint of a panel's arc; `rotateCW/CCW` and vertical variants compute final destinations
- `bigdoors_bp/scripts/domain/ObstructionChecker.js` — `classifyBlock()` determines if a block is air/soft/passable/solid; reusable for crush detection
- `bigdoors_bp/scripts/ropes/subsystem/ClimbableSubsystem.js:119` — existing usage of `entity.applyKnockback({x, z}, verticalStrength)` in this codebase
- `bigdoors_bp/scripts/util/Constants.js` — magic numbers belong here
- `bigdoors_bp/scripts/handler/InteractionHandler.js` and `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js` — call sites for `sweep()` and `sweepLinear()`

### Bedrock Script API

- `Entity.applyImpulse(vector: {x, y, z})` — applies a full 3D velocity impulse. Preferred over `applyKnockback` because it takes a single vector with direction and magnitude combined, making it natural for "launch entity in the direction the door pushed them." The vector IS the velocity; no separate strength params.
- `Entity.applyKnockback(horizontalForce: {x, z}, verticalStrength: number)` — 2-parameter API (NOT 3). The horizontal vector includes magnitude (not normalized internally). Less suitable for door physics because it separates horizontal from vertical, but usable as a fallback.
- `Entity.applyDamage(amount, {cause: "entityAttack"})` — applies damage with a cause. Available causes include `"entityAttack"`, `"contact"`, `"piston"`, etc.
- `Entity.teleport(location)` — instant position change
- `Dimension.getEntities({location, maxDistance})` — spatial entity query

## Key Technical Decisions

- **Per-panel entity matching over radial push:** Instead of computing one push direction from the hinge, each entity is matched to the specific panel whose swept positions contain it. This makes the displacement contextual — an entity at the tip of a long door arm gets a large displacement, while one near the hinge gets a small one. The matching uses the existing `computeArcPositions` plus destination positions.
- **Displacement distance drives impulse strength, capped:** The impulse magnitude is `min(MAX_IMPULSE, BASE_IMPULSE + distance * IMPULSE_SCALE)`, where distance is the Euclidean distance between the matched panel's source and destination: `sqrt(dx² + dy² + dz²)`. The cap prevents absurdly powerful launches from very large doors while still allowing the catapult feel. The impulse direction is `normalize(teleportTarget - entity.originalPos)` — this points the entity away from where the door landed, which is more intuitive than the panel's motion vector.
- **"In front of" means the outward direction from the door's destination:** For rotating doors, "in front of" the destination panel is one block further along the radial direction from the hinge through the destination. For panels at or very near the hinge (radial distance < 1), use the door's facing direction as a fallback outward vector — the hinge panel barely moves so the facing direction is the most intuitive escape. For winch doors, it's one block further along the shift axis. For vertical-mode doors, the outward direction should incorporate the door's facing axis (perpendicular to the rotation plane), not just the radial direction — otherwise the topmost panel of a closing vertical door produces a purely vertical teleport with no horizontal push, undermining the catapult effect.
- **Crush resolution scans adjacent blocks:** When the computed teleport destination is solid, scan the 6 cardinal neighbors for air (using `classifyBlock`). Prefer the direction aligned with the door's push, then up, then any remaining direction. If all 6 are solid, teleport on top of the destination block (y+1) as a last resort.
- **Domain/subsystem split:** Displacement calculation (which panel matches, where to teleport, impulse vector) is pure math in the domain layer. Entity queries, teleport calls, and knockback application stay in the subsystem layer.
- **Use `applyImpulse` over `applyKnockback`:** `applyImpulse({x, y, z})` takes a single 3D velocity vector, which maps naturally to the displacement-based launch direction. `applyKnockback` separates horizontal from vertical strength, making it awkward for diagonal launches (catapult). Fall back to `applyKnockback` in try/catch if `applyImpulse` is unavailable on the entity type.
- **Distance-based damage with free threshold:** Damage follows the vanilla fall-damage pattern: `max(0, floor(distance - DOOR_DAMAGE_THRESHOLD))`. A threshold of 3 blocks means 1-3 panel doors deal no damage (just a push), while larger doors deal 1 damage per block beyond the threshold. This makes small doors safe/fun and large doors dangerous/exciting. Applied before teleport via `entity.applyDamage()` with `"entityAttack"` cause (the most vanilla-compatible cause for a mechanical impact).

## Open Questions

### Resolved During Planning

- **What happens when an entity would be crushed?** Push to nearest open space, piston-style. Distance-based damage is computed from the original panel displacement (source→dest), not the crush-resolved position — you got hit by the door regardless of where you ended up. After crush resolution, the impulse direction is recomputed as `normalize(resolvedPosition - entity.originalPos)` to push the entity away from the door rather than back into the wall.
- **Should entity physics block the door from moving?** No. The door moves unconditionally (after passing obstruction checks for blocks). Entity physics runs after obstruction checks pass but BEFORE block placement — destination positions are still air at sweep time, which is correct because teleporting an entity into a solid door panel would be wrong.
- **What about entities standing on a horizontal vertical-mode door that closes upward?** They match the panel beneath them and get teleported to in front of the now-vertical panel at the top, then receive a large upward+outward impulse. This is the "catapult" behavior.

### Deferred to Implementation

- **Exact impulse tuning:** `IMPULSE_SCALE` (0.5), `BASE_IMPULSE` (0.2), and `MAX_IMPULSE` (3.0) are starting guesses. The formula `min(MAX_IMPULSE, BASE_IMPULSE + distance * IMPULSE_SCALE)` needs in-game tuning with doors of various sizes.
- **Edge cases with multi-block entities (e.g. horses):** May need testing to see if Bedrock's entity location (foot position) is sufficient or if bounding-box checking is needed. Start with foot position.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
For each entity in the door's bounding box:
  1. Floor entity position to block coordinates
  2. Find which panel's swept positions (arc midpoints + destination) contain that block
  3. If no match → skip (entity not in the door's path)
  4. Compute displacement:
     - source = matched panel's current (pre-move) position
     - dest = matched panel's destination position
     - distance = euclidean(source, dest)
  5. Compute teleport target:
     - "outward" direction from hinge through dest (rotating) or along shift axis (linear)
     - target = dest + outward_unit_vector
  6. Crush check:
     - If target block is solid → scan neighbors for air, pick best alternative
  7. Apply damage (if distance > DOOR_DAMAGE_THRESHOLD):
     - damage = floor(distance - DOOR_DAMAGE_THRESHOLD)
  8. Teleport entity to target
  9. Apply impulse:
     - moveDelta = (target - entity.original_position)
     - impulse = normalize(moveDelta) * min(MAX_IMPULSE, BASE_IMPULSE + distance * IMPULSE_SCALE)
     - entity.applyImpulse(impulse)
```

## Implementation Units

- [ ] **Unit 1: Domain — displacement calculator**

**Goal:** Pure-math module that computes per-entity displacement: matched panel, teleport target, and impulse vector.

**Requirements:** R1, R2, R3, R4, R8

**Dependencies:** None

**Files:**
- Create: `bigdoors_bp/scripts/domain/DoorDisplacement.js`
- Modify: `bigdoors_bp/scripts/domain/RotationMath.js` (fix `computeArcPositions` for direction + vertical mode)
- Test: `tests/DoorDisplacement.test.mjs`
- Modify: `tests/RotationMath.test.mjs` (add tests for direction-aware and vertical arc positions)

**Approach:**
- Export `computeDisplacements(entities, sources, destinations, sweptPositionsByPanel, hingePos, mode, facing)` that returns an array of `{entity, teleportTarget, impulseVector, damage}`
- `impulseVector` is a full 3D `{x, y, z}` velocity vector ready for `applyImpulse` — direction is `normalize(teleportTarget - entity.originalPos)`, magnitude is `min(MAX_IMPULSE, BASE_IMPULSE + distance * IMPULSE_SCALE)`
- `entities` is an array of `{id, blockPos: {x,y,z}, originalPos: {x,y,z}}` (blockPos is floored for matching; originalPos is the precise position for impulse direction)
- `sweptPositionsByPanel` is an array parallel to `sources`/`destinations`, where each element is a Set of posKeys that panel sweeps through
- For rotating doors: outward direction = unit vector from hingePos through destination. Fallback to facing direction when panel is at the hinge (radial distance < 1). For vertical-mode, blend the facing axis into the outward direction so catapult produces horizontal push.
- For linear doors: outward direction = shift axis direction
- Distance = Euclidean distance from source to destination of matched panel
- Fix `computeArcPositions` to accept `direction` param (CW/CCW) and support vertical mode arc midpoints in the Y/Z or Y/X plane
- Add `IMPULSE_SCALE`, `BASE_IMPULSE`, `MAX_IMPULSE`, and `DOOR_DAMAGE_THRESHOLD` constants to `Constants.js`
- Damage calculation: `max(0, floor(distance - DOOR_DAMAGE_THRESHOLD))`, included in the returned displacement result

**Patterns to follow:**
- `bigdoors_bp/scripts/domain/RotationMath.js` — pure domain math, no Bedrock imports
- `bigdoors_bp/scripts/domain/ObstructionChecker.js` — uses `posKey`-style position matching

**Test scenarios:**
- Happy path: entity at destination of a 1-block door → teleported 1 block outward, small impulse, zero damage
- Happy path: entity at tip of 4-panel rotating door → large displacement distance, proportionally larger impulse, damage = floor(distance - 3)
- Happy path: vertical-mode door closing upward, entity on far panel → teleport target above and outward, large vertical impulse (catapult), significant damage
- Edge case: entity at hinge position (radial distance < 1) → uses facing direction as fallback outward vector, minimal impulse, zero damage
- Happy path: computeArcPositions with CCW direction → samples correct arc midpoint (mirrored from CW)
- Happy path: computeArcPositions for vertical-mode door → samples arc midpoint in Y/Z or Y/X plane
- Edge case: displacement distance exactly at threshold (3 blocks) → zero damage
- Edge case: displacement distance just above threshold (3.5 blocks) → zero damage (floor of 0.5 = 0... actually floor(3.5-3) = floor(0.5) = 0); distance 4.0 → damage 1
- Edge case: entity matches arc midpoint but not destination → still matched to correct panel
- Edge case: two panels' arcs overlap at a position → entity matched to the panel whose destination is closest to the entity
- Happy path: linear/winch door → outward direction is along shift axis, impulse scales with panel count

- [ ] **Unit 2: Domain — crush resolver**

**Goal:** Given a teleport target position, determine if it's blocked and find the nearest open alternative.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Create: `bigdoors_bp/scripts/domain/CrushResolver.js`
- Test: `tests/CrushResolver.test.mjs`

**Approach:**
- Export `resolveCrush(target, preferredDirection, blockQueryFn)` returning the final safe position
- `preferredDirection` is the outward direction computed by `computeDisplacements` — the direction the door pushed the entity. The subsystem passes this through from the displacement result so the crush resolver tries to escape in the same direction the door was pushing.
- `blockQueryFn` is the same pattern as `ObstructionChecker` — injected callback, keeps domain layer Bedrock-free
- Search order: preferred direction first, then up, then remaining cardinals, then y+1 above destination as last resort
- Uses `classifyBlock` from `ObstructionChecker.js` — anything that isn't "solid" is valid

**Patterns to follow:**
- `bigdoors_bp/scripts/domain/ObstructionChecker.js` — `classifyBlock` reuse, callback injection pattern

**Test scenarios:**
- Happy path: target is air → returns target unchanged
- Happy path: target is solid, preferred direction neighbor is air → returns preferred neighbor
- Edge case: target is solid, preferred blocked, up is air → returns up
- Edge case: all 6 cardinals solid → returns y+1 above original destination
- Edge case: target is a soft block (tall grass) → treated as open, returns target
- Error path: blockQueryFn returns null (unloaded) → treated as open (same as ObstructionChecker convention)

- [ ] **Unit 3: Subsystem — rewrite EntitySweeper**

**Goal:** Replace current `sweep()` and `sweepLinear()` with physics-aware versions that use the domain displacement calculator and crush resolver.

**Requirements:** R1, R2, R3, R5, R6, R7

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `bigdoors_bp/scripts/subsystem/EntitySweeper.js`
- Modify: `tests/EntitySweeper.test.mjs`

**Approach:**
- `sweep()` already accepts `sources` in its existing signature; build `sweptPositionsByPanel` from `computeArcPositions` per panel
- Convert entity locations to `{id, blockPos, originalPos}` domain objects, call `computeDisplacements`, then for each result: call `resolveCrush` with `blockQueryFn` wrapping `dimension.getBlock`, apply damage via `entity.applyDamage()` if `damage > 0`, `entity.teleport()`, then `entity.applyImpulse(impulseVector)` (fall back to `applyKnockback` if `applyImpulse` throws)
- `sweepLinear()` builds per-panel swept positions from the shift path, then follows the same flow
- Wrap `applyImpulse` in try/catch; if it fails (some entity types may not support it), fall back to `applyKnockback({x: impulseVector.x, z: impulseVector.z}, impulseVector.y)` in its own try/catch
- Keep entity query logic (bounding box, `getEntities`) in the subsystem

**Patterns to follow:**
- Current `EntitySweeper.js` — entity query pattern, try/catch around teleport
- `bigdoors_bp/scripts/ropes/subsystem/ClimbableSubsystem.js:117-123` — `applyKnockback` usage

**Test scenarios:**
- Happy path: entity in rotating door arc → teleported to front of destination, knockback applied
- Happy path: entity in winch door path → teleported along shift axis, knockback applied
- Happy path: multi-panel door, entity near tip → larger impulse than entity near hinge
- Edge case: entity outside swept path → not affected (existing behavior preserved)
- Edge case: entity would be crushed → displaced to nearest open space
- Error path: entity removed mid-sweep → try/catch handles gracefully
- Integration: verify `applyImpulse` is called with correct 3D vector derived from displacement (direction + capped magnitude)
- Happy path: entity hit by large door → `applyDamage` called with correct damage amount
- Edge case: entity hit by small door (under threshold) → `applyDamage` not called

- [ ] **Unit 4: Update call sites and constants**

**Goal:** Update InteractionHandler and RedstoneSubsystem call sites if `sweep`/`sweepLinear` signatures changed, and add impulse constants.

**Requirements:** R6

**Dependencies:** Unit 3

**Files:**
- Modify: `bigdoors_bp/scripts/handler/InteractionHandler.js`
- Modify: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Modify: `bigdoors_bp/scripts/util/Constants.js`

**Approach:**
- Add `IMPULSE_SCALE` (default 0.5), `BASE_IMPULSE` (default 0.2), `MAX_IMPULSE` (default 3.0), and `DOOR_DAMAGE_THRESHOLD` (default 3) to Constants.js — these are tuning starting points, adjust during gameplay testing
- `sweep()` already accepts sources, so no signature change needed for rotating door callers
- `sweepLinear()` callers already pass destinations; add `panelPositions` (sources) parameter to all sweepLinear call sites: `InteractionHandler.js:221`, `RedstoneSubsystem.js:218`, `RedstoneSubsystem.js:305`
- **Add sweep calls to close paths:** Currently neither `InteractionHandler._close()` nor `RedstoneSubsystem._closeSingleAssembly()` call any sweep function. Add sweep/sweepLinear calls to both close methods, positioned after obstruction checks pass but before block movement (same pattern as open paths). For rotating close: call `sweep(dimension, closedPositions, currentPositions, hingePos)`. For winch close: call `sweepLinear(dimension, closedPositions, currentPositions, shiftAxis, shiftSign)`
- Verify all 6 call sites pass correct arguments: 3 open paths (InteractionHandler + RedstoneSubsystem rotating + RedstoneSubsystem winch) and 3 close paths (same split)

**Patterns to follow:**
- Existing call sites in `InteractionHandler.js:147` and `RedstoneSubsystem.js:402`

**Test scenarios:**
- Integration: open a rotating door with an entity in the path → entity receives physics displacement (not fixed 1.5-block push)
- Integration: close a winch door with an entity in the path → entity pushed along shift axis with impulse
- Integration: verify no regression in obstruction checking (entity physics doesn't interfere with block obstruction checks)

**Verification:**
- All existing EntitySweeper tests pass (updated for new behavior)
- `npm test` passes
- Manual in-game test: stand in front of a small door, open it → gentle push; stand on a long horizontal vertical door, close it → catapult effect

## System-Wide Impact

- **Interaction graph:** `EntitySweeper` is called by `InteractionHandler` and `RedstoneSubsystem` during open. Close paths currently lack sweep calls — this plan adds them. The new code adds `applyImpulse` (preferred) and `applyDamage` calls on entities, which are new Bedrock API calls not previously used in the door system.
- **Execution order:** Entity sweep runs AFTER obstruction checks pass but BEFORE block placement (matching existing code at `InteractionHandler.js:147` and `RedstoneSubsystem.js:402`). Destination positions are still air at sweep time, so teleporting entities there is safe. Block movement and `manager.openDoor()`/`closeDoor()` happen after.
- **Error propagation:** All Bedrock API calls (`teleport`, `applyImpulse`, `getEntities`) are wrapped in try/catch. A failure in entity physics must not prevent the door from completing its block movement.
- **State lifecycle risks:** None — entity physics is stateless and produces no persistent side effects.
- **API surface parity:** Java edition will need equivalent physics when ported. The domain-layer split (Units 1-2) makes this straightforward since the math is pure JavaScript with no Bedrock dependencies.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `applyImpulse` may not work on all entity types (e.g. armor stands, item frames) | Try `applyImpulse` first, fall back to `applyKnockback`, fall back to teleport-only |
| Impulse scaling feels wrong in-game | `IMPULSE_SCALE`, `BASE_IMPULSE`, and `MAX_IMPULSE` in Constants.js are easy to tune |
| Catapult impulse may be too powerful, launching players into fall-damage range | `MAX_IMPULSE` cap prevents runaway velocity; tune with tall doors in testing |
| `getEntities` bounding box may miss entities on the edge | Current code already adds +2 padding to the radius; preserve this |
| `applyDamage` may kill entities unexpectedly with very large doors | Damage threshold of 3 means only doors with 4+ blocks of displacement deal damage; cap maximum damage via a `DOOR_DAMAGE_MAX` constant if needed |
| Damage cause string may not exist in all Bedrock versions | Use `"entityAttack"` which is universally available; wrap in try/catch |

## Sources & References

- Related code: `bigdoors_bp/scripts/subsystem/EntitySweeper.js`, `bigdoors_bp/scripts/domain/RotationMath.js`
- Related code: `bigdoors_bp/scripts/ropes/subsystem/ClimbableSubsystem.js:117-123` (applyKnockback usage pattern)
- Bedrock Script API: `@minecraft/server` 2.7.0 — Entity.applyImpulse, Entity.applyKnockback (2-param), Entity.applyDamage, Entity.teleport
