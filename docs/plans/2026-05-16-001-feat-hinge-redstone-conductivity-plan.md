---
title: "feat: Enable redstone conductivity and propagation on hinge blocks"
type: feat
status: active
date: 2026-05-16
---

# feat: Enable redstone conductivity and propagation on hinge blocks

## Overview

The hinge block should fully participate in redstone circuits — both receiving power from adjacent redstone wire (conductor) and passing signal through to blocks on the other side (propagation). Currently it has a bare `minecraft:redstone_consumer: {}` which fires `onRedstoneUpdate` but uses defaults: no conductivity and no propagation.

## Problem Frame

A player running redstone wire past a hinge expects the hinge to behave like a solid redstone-aware block: it should power up when adjacent wire is active, and the signal should continue through it. Currently the hinge only reacts when directly powered (e.g., by a repeater aimed at it), which is unintuitive.

## Requirements Trace

- R1. Hinge block acts as a redstone conductor — adjacent redstone wire reliably powers it
- R2. Hinge block propagates redstone signal through to blocks on the opposite side
- R3. Existing `onRedstoneUpdate` behavior (door open/close) continues to work unchanged

## Scope Boundaries

- Panel blocks are NOT made redstone-aware — only hinges
- No Bedrock script changes — the `RedstoneSubsystem` already handles `onRedstoneUpdate` correctly. Java parity changes are deferred to the Java port plan (Unit 7)
- No signal strength filtering (keep `min_power` at default 0)

## Context & Research

### Relevant Code and Patterns

- `bigdoors_bp/blocks/hinge.json` — block definition, already has `"minecraft:redstone_consumer": {}`
- `bigdoors_bp/scripts/main.js:27-29` — `onRedstoneUpdate` callback already wired to `RedstoneSubsystem`
- `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js` — handles power level changes, no modifications needed

### External References

- [minecraft:redstone_consumer](https://github.com/microsoftdocs/minecraft-creator/blob/main/creator/Reference/Content/BlockReference/Examples/BlockComponents/minecraftBlock_redstone_consumer.md) — `propagates_power` (boolean, default false)
- [minecraft:redstone_conductivity](https://github.com/microsoftdocs/minecraft-creator/blob/main/creator/Reference/Content/BlockReference/Examples/BlockComponents/minecraftBlock_redstone_conductivity.md) — `redstone_conductor` (boolean, default false), requires format_version 1.21.30+ (we use 1.26.0)

## Key Technical Decisions

- **Add both components in the same change:** `redstone_conductor: true` and `propagates_power: true` are independent JSON properties on independent components. No reason to stage them separately.
- **Keep `allows_wire_to_step_down: true`** (default): redstone wire should be able to stair-step down onto the hinge block, matching solid block behavior.
- **Keep `min_power: 0`** (default): any signal strength should activate the door, which is the current behavior.

## Open Questions

### Resolved During Planning

- **Does format_version support these properties?** Yes — `redstone_conductivity` requires 1.21.30+, expanded `redstone_consumer` requires 1.21.130+, and the block already uses 1.26.0.
- **Will `propagates_power` conflict with the `onRedstoneUpdate` callback?** No — propagation is a block-level mechanic; the callback still fires independently.

### Deferred to Implementation

- **Does `propagates_power` cause feedback loops with double-doors?** Unlikely since both hinges would receive the same external signal, but worth verifying in-game.

## Implementation Units

- [ ] **Unit 1: Add redstone conductivity and propagation to hinge block JSON**

**Goal:** Make the hinge block conduct and propagate redstone signal.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `bigdoors_bp/blocks/hinge.json`

**Approach:**
- Add `minecraft:redstone_conductivity` component with `redstone_conductor: true`
- Expand existing `minecraft:redstone_consumer: {}` to `{ "propagates_power": true }`
- Both go in the top-level `components` block (not in permutations — the docs note `redstone_consumer` is not available in permutations)

**Patterns to follow:**
- Existing component style in `bigdoors_bp/blocks/hinge.json`

**Test scenarios:**
- Happy path: place hinge adjacent to powered redstone wire — `onRedstoneUpdate` fires with `powerLevel > 0`, door opens
- Happy path: remove redstone power — `onRedstoneUpdate` fires with `powerLevel === 0`, door closes
- Happy path: place redstone wire on far side of hinge — signal propagates through and powers the wire
- Edge case: double-door pair with redstone on one side — both doors open without feedback loop
- Integration: existing interaction-based open/close still works when no redstone is present

**Verification:**
- In-game: redstone wire visually connects to and powers the hinge block
- In-game: signal continues through the hinge to the other side
- Existing `RedstoneSubsystem` behavior unchanged — doors open/close on power transitions

## System-Wide Impact

- **Interaction graph:** `onRedstoneUpdate` callback is unchanged; only the block-level signal routing changes
- **Error propagation:** N/A — no new error paths
- **State lifecycle risks:** None — the `RedstoneSubsystem` already debounces via `REDSTONE_DEBOUNCE_TICKS` and the manager handles state
- **Unchanged invariants:** `RedstoneSubsystem.handleRedstoneUpdate` API, door open/close logic, persistence

## Deferred: Java/Fabric Parity

The Java port is in progress (see `docs/plans/2026-05-15-001-feat-java-fabric-port-plan.md`). The Java `HingeBlock` does not exist yet — the domain layer is complete but block classes have not been created. When Unit 7 of the Java port plan (Redstone and double doors) is implemented, the equivalent of this Bedrock change must be accounted for.

### How redstone conductivity works in Java vs Bedrock

On Bedrock, conductivity and propagation are explicit JSON component properties. On Java/Fabric, they are emergent from the `Block` class hierarchy:

- **Conductivity (R1 equivalent):** In Java, any full opaque block automatically conducts redstone — `Block.isSolidBlock()` returns true, and adjacent redstone wire powers it. If `HingeBlock` extends `Block` and uses `minecraft:geometry.full_block` (the plan's current intent), conductivity should work out of the box with no override needed. **Verify this during Unit 7 implementation.**

- **Propagation (R2 equivalent):** In Java, a solid block that receives weak redstone power does *not* automatically emit power to the far side — that's "strong powering" which only repeaters do. To match Bedrock's `propagates_power: true` behavior, `HingeBlock` would need to override `emitsRedstonePower()` → `true` and `getWeakRedstonePower()` to emit the received power level to the far side. **This is the one piece that requires explicit code.**

### Implementation notes for Java Unit 7

When implementing redstone in the Java port:

1. **Confirm default conductivity:** Place a HingeBlock in-game, run redstone wire adjacent. If `neighborUpdate` fires with power > 0, conductivity works by default. No code needed.

2. **Add propagation overrides if parity with Bedrock is desired:**
   - Override `emitsRedstonePower(BlockState state)` → return `true`
   - Override `getWeakRedstonePower(BlockState state, BlockView world, BlockPos pos, Direction direction)` → emit power only toward the *opposite* face from the input direction. Naively returning `world.getReceivedRedstonePower(pos)` for all directions creates a feedback loop (the block sees its own emission as input). Use directional filtering: track which face receives power and only emit on the opposite side, similar to how vanilla repeaters work.
   - Bedrock's `propagates_power` passes full signal strength — no -1 decay. Match this for parity.
   - Add `POWERED` BooleanProperty if not already present (Unit 7 plan already includes this)

3. **Wire step-down:** Java handles this automatically for full blocks — no override needed.

4. **Test scenarios (additive to Java Unit 7):**
   - Happy path: redstone wire adjacent to HingeBlock powers it → door opens
   - Happy path: redstone signal propagates through HingeBlock to wire on the far side
   - Edge case: signal passes through at full strength (matching Bedrock `propagates_power` — no decay)
   - Edge case: hinge does not create a feedback loop (emits only on the opposite face from input)

### Timing

This deferred work should be picked up during Java port Unit 7 (Redstone and double doors). No separate plan needed — the implementation notes above extend the existing unit.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `propagates_power` creates unintended signal loops through hinges in cramped builds | Accept — matches vanilla solid block behavior; players expect this |
| Component incompatibility with `bigdoors:hinge_component` custom component | Low risk — both are independent component registrations; verify in-game |
