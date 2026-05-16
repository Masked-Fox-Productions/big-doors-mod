---
title: "feat: Port Big Doors to Java/Fabric edition"
type: feat
status: completed
date: 2026-05-15
origin: docs/brainstorms/2026-05-14-big-doors-mod-requirements.md
---

# feat: Port Big Doors to Java/Fabric edition

## Overview

Port the working Bedrock Big Doors mod to Java/Fabric edition (Minecraft 26.1.2, Fabric API 0.148.2, Java 25). The Bedrock side has ~10 production classes across domain, handler, and subsystem layers plus full test coverage. The Java scaffold exists but contains only stubs. The domain layer (DoorAssembly, RotationMath, ObstructionChecker, MaterialRegistry) is pure logic with no platform imports and ports to plain Java almost line-for-line. The handler/subsystem layer requires mapping Bedrock Script API hooks to Fabric equivalents.

## Problem Frame

Same problem as the Bedrock edition (see origin: `docs/brainstorms/2026-05-14-big-doors-mod-requirements.md`). Players need dramatic multi-block doors. This plan covers the Java/Fabric implementation to achieve cross-edition parity with the working Bedrock mod.

## Requirements Trace

Requirements R1-R32 from the origin document apply identically to the Java edition. R33-R35 (Settlements integration) are excluded — see Scope Boundaries. The Bedrock plan (`docs/plans/2026-05-14-001-feat-multi-block-hinge-doors-plan.md`) already maps these to implementation — this plan maps the same requirements to Java/Fabric equivalents.

## Scope Boundaries

- Same scope boundaries as the Bedrock plan (no animation, no locking, no portcullis mode)
- No cross-edition save compatibility — Bedrock and Java worlds are separate
- No Settlements integration for Java (R33-R35) — the Java Settlements mod doesn't exist yet
- Client-side rendering uses standard blockstate JSON + vanilla model system — no custom renderers in Phase 1

## Context & Research

### Relevant Code and Patterns

**Bedrock implementation (source of truth for behavior):**
- `bigdoors_bp/scripts/domain/` — DoorAssembly, RotationMath, ObstructionChecker, MaterialRegistry. Pure logic, no platform imports. Direct port targets.
- `bigdoors_bp/scripts/DoorManager.js` — Central state manager with position index, persistence, open/close/dissolve operations.
- `bigdoors_bp/scripts/handler/` — HingePlacementHandler, PanelPlacementHandler, BreakHandler, InteractionHandler. Platform-specific glue.
- `bigdoors_bp/scripts/subsystem/` — RedstoneSubsystem, EntitySweeper. Platform-specific event wiring.
- `bigdoors_bp/scripts/util/Constants.js` — All magic numbers, block IDs, material lists, direction helpers.
- `tests/*.test.mjs` — Full test suite. Test scenarios port to JUnit.

**Java scaffold:**
- `java-bigdoors/src/main/java/com/bigdoors/BigdoorsMod.java` — Mod entrypoint with lifecycle event stubs.
- `java-bigdoors/src/main/java/com/bigdoors/block/ModBlocks.java` — Empty block registration.
- `java-bigdoors/src/main/java/com/bigdoors/domain/Example.java` — Placeholder domain class.
- `java-bigdoors/src/test/java/com/bigdoors/domain/ExampleTest.java` — Placeholder JUnit test.

**Build configuration:**
- Minecraft 26.1.2, Fabric Loader 0.19.2, Fabric API 0.148.2+26.1.2
- Java 25, no mappings needed (MC 26.1+ ships unobfuscated)
- JUnit 5.11.4 for tests

### Bedrock-to-Fabric API Mapping

| Bedrock API | Fabric/Java Equivalent | Source |
|---|---|---|
| `world.afterEvents.playerPlaceBlock` (for own blocks) | `Block.onPlaced()` override | Vanilla MC |
| `world.afterEvents.playerPlaceBlock` (for ANY block near hinge) | `Block.neighborUpdate()` on HingeBlock/DoorPanelBlock | Vanilla MC |
| `world.afterEvents.playerBreakBlock` | `PlayerBlockBreakEvents.AFTER` | `fabric-events-interaction-v0` |
| Custom component `onPlayerInteract` | `Block.onUse()` override | Vanilla MC |
| Custom component `onRedstoneUpdate` | `Block.neighborUpdate()` + `world.getReceivedRedstonePower()` | Vanilla MC |
| `world.getDynamicProperty` / `setDynamicProperty` | `PersistentState` subclass with NBT | Vanilla MC |
| `dimension.getEntities({location, maxDistance})` | `world.getEntitiesByClass(class, Box, predicate)` | Vanilla MC |
| `block.setType()` / `block.setPermutation()` | `world.setBlockState(pos, state.with(...))` | Vanilla MC |
| `dimension.spawnItem()` | `new ItemEntity(...)` + `world.spawnEntity()` | Vanilla MC |
| Block JSON with states/permutations | `Block` subclass + `appendProperties()` + blockstate JSON | Vanilla MC |

Key insight: Nearly everything maps to vanilla MC methods, not Fabric API. The only Fabric-specific APIs needed are `PlayerBlockBreakEvents` (for break detection with old state) and `ItemGroupEvents` (for creative inventory).

### Panel Detection via neighborUpdate

On Bedrock, a global `playerPlaceBlock` listener watches for vanilla blocks placed near hinges. Fabric has no equivalent global placement event. Instead, `neighborUpdate()` on HingeBlock and DoorPanelBlock achieves the same result:

- When a vanilla block is placed next to a hinge, the hinge's `neighborUpdate` fires
- The handler checks all 4 horizontal neighbors for unregistered supported materials
- If found, replaces the vanilla block with a door panel and registers it in the assembly

This is safe against false triggers: door movement only places `bigdoors:door_panel` blocks (not vanilla materials), redstone changes don't change neighbor block types, and block breaks produce air (not supported materials). A `Set<BlockPos>` conversion-in-progress guard on the manager provides additional safety during door operations and neighborUpdate recursion.

## Key Technical Decisions

- **Domain layer ports as pure Java:** DoorAssembly, RotationMath, ObstructionChecker, MaterialRegistry have zero Minecraft imports on both editions. Java versions use Gson (bundled with MC) for JSON serialization. Same coordinate system (+X east, +Z south, +Y up), same rotation formulas, same obstruction classification.

- **Single DoorPanelBlock with IntProperty for material index:** Matches the Bedrock `bigdoors:door_panel` with `material_group`/`material_id` states. Java uses a single `IntProperty` (range 0-63) since Java block states don't have the 16-value enum limit. Blockstate JSON maps each index to a model referencing the appropriate vanilla texture.

- **Block behavior via method overrides, not events:** HingeBlock and DoorPanelBlock extend `Block` and override `onPlaced()`, `onUse()`, `neighborUpdate()`, and `getDroppedStacks()`. This replaces Bedrock's custom component registration pattern. Simpler, no global event subscriptions needed for owned blocks.

- **PersistentState for world-scoped persistence:** Stores serialized assembly JSON in NBT via `PersistentState`, loaded from the Overworld's `PersistentState` only (not per-dimension). This matches Bedrock's single-world dynamic property and avoids split-state issues. Doors only exist in dimensions where the player builds them; the manager is a single in-memory instance. `markDirty()` replaces `manager.save()` — data auto-persists on world save.

- **Empty loot tables + manual item drops:** Same pattern as Bedrock. Both blocks have empty loot tables; break handler spawns the correct vanilla material item (for panels) or hinge item (for hinges).

- **neighborUpdate for both panel detection and redstone:** A single `neighborUpdate()` override handles two concerns: (1) detecting new vanilla blocks placed adjacent (panel conversion), and (2) detecting redstone power changes. The method checks `world.getReceivedRedstonePower(pos)` and compares against a `POWERED` block state property to detect transitions.

## Open Questions

### Resolved During Planning

- **Panel detection without global place event:** Use `neighborUpdate()` on HingeBlock/DoorPanelBlock. When a vanilla block is placed adjacent, the hinge/panel receives a neighbor update, checks for supported materials, and converts them. No mixin needed.
- **Material encoding:** Single `IntProperty(0-63)` instead of Bedrock's two-state split. Java doesn't have the 16-value enum limit.
- **Persistence format:** JSON string stored in NBT via PersistentState, using Gson for serialization. Keeps domain layer identical to Bedrock.
- **Block break detection:** `PlayerBlockBreakEvents.AFTER` from Fabric API provides the old `BlockState`, equivalent to Bedrock's `brokenBlockPermutation`.
- **MC 26.x API differences:** `neighborUpdate` signature includes `WireOrientation` parameter. `onUse()` no longer has `Hand` parameter. `RegistryKey`-based registration is the modern pattern.

### Deferred to Implementation

- Exact blockstate JSON structure for 64 material variants — may need a data generator
- Exact `onUse` method signature in MC 26.1.2 — verify by browsing generated sources (`./gradlew genSources`)

### Pre-Implementation Spike: neighborUpdate Verification

Before starting Unit 4, run a minimal spike to verify `neighborUpdate` fires reliably when vanilla blocks are placed adjacent to a custom block. Create a temporary test block that logs all `neighborUpdate` calls, place it in-game, and place vanilla blocks adjacent. Confirm the update fires for all 4 horizontal neighbors and verify the timing (same tick vs deferred). This de-risks the entire panel detection mechanism. If `neighborUpdate` doesn't fire reliably, fall back to a mixin on `Block.onPlaced()` in the affected scenarios.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌──────────────────────────────────────────────────────┐
│                  BigdoorsMod.java                      │
│  onInitialize():                                       │
│    1. ModBlocks.initialize() — register blocks         │
│    2. Register PlayerBlockBreakEvents listener         │
│    3. ServerLifecycleEvents.SERVER_STARTED → load()    │
│    4. ServerLifecycleEvents.SERVER_STOPPING → save()   │
└──────────┬────────────────────────────────┬────────────┘
           │                                │
           v                                v
┌──────────────────────┐     ┌──────────────────────────┐
│   Domain Layer        │     │   Block Layer             │
│   (no MC imports)     │     │   (MC Block subclasses)   │
│                       │     │                           │
│  DoorAssembly         │     │  HingeBlock extends Block │
│  RotationMath         │     │   .onPlaced() → create    │
│  ObstructionChecker   │     │     assembly, merge stack  │
│  MaterialRegistry     │     │   .onUse() → toggle door  │
│  Constants            │     │   .neighborUpdate() →     │
│                       │     │     panel detection +      │
│                       │     │     redstone handling      │
│                       │     │                           │
│                       │     │  DoorPanelBlock            │
│                       │     │   .onUse() → toggle door  │
│                       │     │   .neighborUpdate() →     │
│                       │     │     panel expansion        │
│                       │     │   .getDroppedStacks() →   │
│                       │     │     empty (manual drops)   │
└──────────────────────┘     └──────────────────────────┘
           │
           v
┌──────────────────────┐
│   DoorManager         │
│   (server-side state) │
│                       │
│  - assemblies Map     │
│  - positionIndex Map  │
│  - BigDoorsState      │
│    (PersistentState)  │
│  - load() / save()    │
│  - all assembly ops   │
└──────────────────────┘
```

**Key difference from Bedrock:** A thinner platform layer. Block behavior entry points live on Block subclasses via method overrides (replacing Bedrock's global event subscriptions). Shared logic that doesn't belong on a single block class lives in helper classes (`DoorMover` for block movement, `EntitySweeper` for entity displacement, `BreakHandler` for the Fabric break event listener). The manager is accessed via a static reference on `BigdoorsMod` (standard Fabric pattern) rather than constructor injection.

## Implementation Units

- [ ] **Unit 1: Constants and domain layer port**

**Goal:** Port all pure-logic classes from JS to Java. These have zero Minecraft imports and are testable with plain JUnit.

**Requirements:** R1-R10, R20-R25 (domain representations)

**Dependencies:** None

**Files:**
- Delete: `java-bigdoors/src/main/java/com/bigdoors/domain/Example.java`
- Delete: `java-bigdoors/src/test/java/com/bigdoors/domain/ExampleTest.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/util/Constants.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/util/BlockPos3.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/domain/DoorAssembly.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/domain/RotationMath.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/domain/ObstructionChecker.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/domain/MaterialRegistry.java`
- Test: `java-bigdoors/src/test/java/com/bigdoors/domain/DoorAssemblyTest.java`
- Test: `java-bigdoors/src/test/java/com/bigdoors/domain/RotationMathTest.java`
- Test: `java-bigdoors/src/test/java/com/bigdoors/domain/ObstructionCheckerTest.java`
- Test: `java-bigdoors/src/test/java/com/bigdoors/domain/MaterialRegistryTest.java`

**Approach:**
- `BlockPos3` — lightweight record `(int x, int y, int z)` used by domain classes instead of MC's `BlockPos`. Keeps domain layer MC-free. Has `toKey()` for map lookups.
- `Constants` — static final fields for block IDs, material lists (as `Set<String>`), direction enums, direction offsets, scan limits. Direct port from `Constants.js`.
- `DoorAssembly` — direct port. `toJson()`/`fromJson()` using Gson `JsonObject`. Same fields: id, primaryHingePos, hingePositions, panelPositions (with materialIndex/closedPos/currentPos), facing, doorSide, mode, isOpen, openDirection, partnerAssemblyId.
- `RotationMath` — static methods. Same formulas: `rotateCW`, `rotateCCW`, `rotateVerticalCW`, `rotateVerticalCCW`, `computeArcPositions`. Same coordinate system.
- `ObstructionChecker` — static methods. `classifyBlock(String typeId)` → enum. `checkPath(positions, hingePos, direction, blockQueryFn)` with `Function<BlockPos3, String>` callback.
- `MaterialRegistry` — static bidirectional maps. Same 64-entry `MATERIAL_INDEX` array. Uses `String` type IDs internally (e.g., `"minecraft:cobblestone"`) matching Java's `Identifier.toString()` format. The block layer converts between `Identifier`/`RegistryKey<Block>` and `String` at the boundary — the domain layer never imports MC classes.

**Patterns to follow:**
- Bedrock domain classes at `bigdoors_bp/scripts/domain/`
- Bedrock test suite at `tests/*.test.mjs` — port test scenarios to JUnit

**Test scenarios:**
- Happy path: DoorAssembly round-trips through toJson/fromJson preserving all fields
- Happy path: MaterialRegistry maps cobblestone index to "minecraft:cobblestone" and back
- Happy path: rotateCW({5,0,3}, {3,0,3}) returns {3,0,5} — point east of hinge moves south
- Happy path: rotateCCW({5,0,3}, {3,0,3}) returns {3,0,1} — point east moves north
- Happy path: rotateCCW reverses rotateCW for any position
- Edge case: rotation at hinge (distance 0) returns hinge unchanged
- Edge case: rotation far from hinge (distance 20) produces valid integer result
- Happy path: classifyBlock("minecraft:short_grass") returns SOFT
- Happy path: classifyBlock("minecraft:torch") returns PASSABLE
- Happy path: classifyBlock("minecraft:stone") returns SOLID
- Happy path: checkPath returns canOpen=true when all destinations are air
- Edge case: checkPath returns canOpen=false when any destination is solid
- Edge case: checkPath populates soft/passable lists for mixed destinations
- Happy path: DoorAssembly.addPanel increases panel count, removePanel decreases it
- Edge case: MaterialRegistry.indexForTypeId returns -1 for unsupported block
- Happy path: four CW rotations return to original position

**Verification:**
- `cd java-bigdoors && ./gradlew test` passes all domain tests
- No Minecraft imports in any domain class

---

- [ ] **Unit 2: Block registration and assets**

**Goal:** Register HingeBlock and DoorPanelBlock with proper block states, models, textures, and creative inventory placement. Blocks exist in-game but have no behavior yet.

**Requirements:** R1-R4, R6 (block infrastructure)

**Dependencies:** Unit 1 (Constants for block IDs and material list)

**Files:**
- Create: `java-bigdoors/src/main/java/com/bigdoors/block/HingeBlock.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelBlock.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/ModBlocks.java`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/blockstates/hinge.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/blockstates/door_panel.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/models/block/hinge.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/models/block/door_panel/` (one model per material variant referencing vanilla textures)
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/models/item/hinge.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/models/item/door_panel.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/textures/block/hinge.png` (placeholder)
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/lang/en_us.json`
- Create: `java-bigdoors/src/main/resources/data/bigdoors/loot_tables/blocks/hinge.json` (empty — script handles drops)
- Create: `java-bigdoors/src/main/resources/data/bigdoors/loot_tables/blocks/door_panel.json` (empty)

**Approach:**
- `HingeBlock extends Block`: Properties — `FACING` (DirectionProperty, horizontal), `MODE` (EnumProperty: horizontal/vertical), `DOOR_SIDE` (EnumProperty: none/north/south/east/west). Override `appendProperties()`, `getPlacementState()` (set facing from player direction). Empty `getDroppedStacks()` override (drops handled manually).
- `DoorPanelBlock extends Block`: Properties — `MATERIAL_INDEX` (IntProperty, 0-63). Override `appendProperties()`. Empty `getDroppedStacks()`.
- `ModBlocks`: Register both blocks and their BlockItems using `RegistryKey`-based registration. Add to creative inventory via `ItemGroupEvents.modifyEntriesEvent()`.
- Blockstate JSON for hinge: map facing variants to rotated models.
- Blockstate JSON for door panel: map each material index to a model that references the corresponding vanilla block texture (e.g., index 0 → model using `minecraft:block/oak_planks` texture).
- Item models: standard block item models.
- Loot tables: empty JSON `{"type": "minecraft:empty"}` — both blocks suppress default drops.

**Patterns to follow:**
- Standard Fabric block registration pattern with RegistryKey
- Vanilla door/trapdoor blocks for block state structure

**Test scenarios:**
- Test expectation: none — block registration is declarative. Verified by loading the mod in-game.

**Verification:**
- `./gradlew build` succeeds without errors
- Both blocks appear in the creative inventory
- Hinge block can be placed with correct facing from player direction
- Door panel block displays correct texture for each material index
- No crash on world load

---

- [ ] **Unit 3: DoorManager, persistence, and mod initialization**

**Goal:** Port DoorManager with PersistentState persistence and wire up the mod entrypoint so assemblies survive world save/reload.

**Requirements:** R26-R27 (persistence)

**Dependencies:** Unit 1 (DoorAssembly, domain classes), Unit 2 (ModBlocks)

**Files:**
- Create: `java-bigdoors/src/main/java/com/bigdoors/DoorManager.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/BigDoorsState.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/BigdoorsMod.java`
- Test: `java-bigdoors/src/test/java/com/bigdoors/DoorManagerTest.java`

**Approach:**
- `DoorManager`: Direct port from `bigdoors_bp/scripts/DoorManager.js`. Same `_assemblies` HashMap, `_positionIndex` HashMap, same methods: `createAssembly`, `addHingeToAssembly`, `addPanelToAssembly`, `removePanelFromAssembly`, `findByPosition`, `dissolveAssembly`, `openDoor`, `closeDoor`, `pairAndSplitAssemblies`, `setDoorSide`. `save()` serializes to JSON and stores via `BigDoorsState`. `load()` deserializes from `BigDoorsState`.
- `BigDoorsState extends PersistentState`: Stores serialized JSON string in NBT. MC 26.x may use `PersistentState.Type` with codec-based serialization rather than the older `writeNbt()`/`createFromNbt()` pattern — run `./gradlew genSources` and check the `PersistentState` class before implementing. Accessed from the Overworld's `PersistentStateManager` via `server.getOverworld().getPersistentStateManager()`.
- `BigdoorsMod.onInitialize()`: Register blocks, register `PlayerBlockBreakEvents.AFTER` listener (for break handling), register `ServerLifecycleEvents.SERVER_STARTED` → create DoorManager + load. Store manager reference as static field on `BigdoorsMod` for access from block classes. The manager must be initialized before any block callback fires — `SERVER_STARTED` guarantees this since block events cannot fire before the server is started.
- Manager is server-scoped. Block method overrides access it via `BigdoorsMod.getManager()`. Returns null before server start; block callbacks must null-check and early-return.

**Patterns to follow:**
- Bedrock `DoorManager.js` for all state management logic
- Fabric `PersistentState` pattern for world-scoped persistence

**Test scenarios:**
- Happy path: createAssembly stores assembly retrievable by findByPosition
- Happy path: addPanelToAssembly makes panel position findable
- Happy path: removePanelFromAssembly removes panel, position no longer found
- Edge case: removePanelFromAssembly on last panel dissolves the assembly
- Happy path: openDoor/closeDoor updates isOpen state and position index
- Happy path: findByPosition returns assembly at panel's open (rotated) position
- Edge case: findByPosition returns null for closed position when door is open
- Happy path: dissolveAssembly removes all positions from index
- Happy path: pairAndSplitAssemblies correctly pairs and splits panels between two assemblies with updated position index
- Happy path: save/load round-trip preserves all assemblies (test via direct JSON serialization, without PersistentState — domain-level test)

**Verification:**
- DoorManager passes all JUnit tests
- Mod loads in-game, manager initializes on server start, data persists across world reload

---

- [ ] **Unit 4: Hinge placement and panel detection**

**Goal:** When a hinge is placed, create an assembly. When a vanilla block is placed adjacent to a hinge or existing panel, convert it to a door panel. Vertical hinge stacking merges assemblies.

**Requirements:** R1, R2, R5-R10

**Dependencies:** Unit 2 (HingeBlock, DoorPanelBlock), Unit 3 (DoorManager)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/HingeBlock.java` (add onPlaced, neighborUpdate)
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelBlock.java` (add neighborUpdate)
- Test: `java-bigdoors/src/test/java/com/bigdoors/block/HingePlacementTest.java`
- Test: `java-bigdoors/src/test/java/com/bigdoors/block/PanelDetectionTest.java`

**Approach:**
- `HingeBlock.onPlaced()`: Determine facing from player direction, set block state. Check above/below for existing hinges (R10 stacking) — merge into existing assembly or create new one.
- `HingeBlock.neighborUpdate()`: Two responsibilities: (1) Check horizontal neighbors for unregistered supported vanilla materials. If assembly has no door_side set and exactly one neighbor is a supported material, set door_side and convert it. If door_side is set, only convert blocks on the door side. (2) Redstone power detection (wired in Unit 7).
- `DoorPanelBlock.neighborUpdate()`: Check horizontal neighbors for unregistered supported vanilla materials. If found on the assembly's door side (not wall side), convert and add to assembly. This handles panel-adjacent expansion for wide doors.
- Guard against recursive conversions: conversions call `world.setBlockState()` which triggers more `neighborUpdate` calls. Use a `Set<BlockPos>` on the manager to track positions currently being converted, skip if already in progress.

**Patterns to follow:**
- Bedrock `HingePlacementHandler.js` and `PanelPlacementHandler.js` for logic
- Bedrock test suite for scenarios

**Test scenarios:**
- Happy path: placing a hinge creates a horizontal-mode assembly with correct facing
- Happy path: placing a second hinge above existing one merges into same assembly
- Happy path: placing cobblestone next to a hinge converts it to a door panel (neighborUpdate path)
- Happy path: first converted block sets the hinge's door_side
- Edge case: placing unsupported material next to hinge does not convert
- Edge case: block on wall side (opposite door_side) is not converted
- Happy path: placing a vanilla block adjacent to an existing panel expands the assembly
- Edge case: panel expansion stops at unsupported materials
- Happy path: hinge ignores pre-placed blocks (no auto-scan on placement — only neighborUpdate from new placements)

**Verification:**
- Hinge placement creates assemblies
- Vanilla blocks placed next to hinges/panels are converted to door panels
- Stacking and expansion work correctly
- `./gradlew test` passes

---

- [ ] **Unit 5: Door open/close interaction**

**Goal:** Clicking a hinge or door panel toggles the door open/closed with obstruction checking, entity sweeping, and grid-snapped rotation.

**Requirements:** R15-R25 (opening, closing, obstruction, entity sweep)

**Dependencies:** Unit 1 (RotationMath, ObstructionChecker), Unit 3 (DoorManager), Unit 4 (placement)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/HingeBlock.java` (add onUse)
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelBlock.java` (add onUse)
- Create: `java-bigdoors/src/main/java/com/bigdoors/subsystem/DoorMover.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/subsystem/EntitySweeper.java`
- Test: `java-bigdoors/src/test/java/com/bigdoors/subsystem/DoorMoverTest.java`

**Approach:**
- `HingeBlock.onUse()` and `DoorPanelBlock.onUse()`: If player is sneaking, return `ActionResult.PASS` to allow normal block placement against the door. Otherwise, look up assembly via manager. If closed, determine direction (away from player), check obstruction, fallback to opposite direction if blocked. If open, close. Delegate to DoorMover.
- `DoorMover`: Encapsulates the three-phase block movement algorithm (compute, clear, place). Handles soft block destruction, passable block destruction with item drops, entity sweep, and manager state updates. Ported from `InteractionHandler._attemptOpen()` and `_close()`. Uses `world.setBlockState()` for block placement.
- `EntitySweeper`: Port from `bigdoors_bp/scripts/subsystem/EntitySweeper.js`. Uses `world.getEntitiesByClass(LivingEntity.class, Box, predicate)` instead of Bedrock's `dimension.getEntities()`. Teleports entities out of the sweep arc.
- Direction preference: compute CW and CCW destinations, pick the direction that moves panels away from the player (same Manhattan distance heuristic as Bedrock).

**Patterns to follow:**
- Bedrock `InteractionHandler.js` and `EntitySweeper.js`

**Test scenarios:**
- Happy path: clicking a closed door opens it — panels move to rotated positions
- Happy path: clicking an open door closes it — panels return to original positions
- Happy path: door opens away from the player's side
- Edge case: door blocked on one side opens in the opposite direction
- Edge case: door blocked on both sides does not move
- Happy path: soft blocks in path are destroyed silently
- Happy path: passable blocks in path are destroyed with item drops
- Integration: opening updates isOpen state and persists via manager

**Verification:**
- Doors open and close in-game with correct rotation
- Obstruction detection works for all three tiers
- Entity sweep pushes entities out of the arc
- `./gradlew test` passes

---

- [ ] **Unit 6: Break handling**

**Goal:** Breaking a panel removes it from its assembly and drops the original vanilla material. Breaking a hinge closes the door first, reverts all panels to vanilla blocks, and dissolves the assembly.

**Requirements:** R28-R29 (disassembly)

**Dependencies:** Unit 3 (DoorManager), Unit 5 (DoorMover for close logic)

**Files:**
- Create: `java-bigdoors/src/main/java/com/bigdoors/handler/BreakHandler.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/BigdoorsMod.java` (register break event listener)
- Test: `java-bigdoors/src/test/java/com/bigdoors/handler/BreakHandlerTest.java`

**Approach:**
- `BreakHandler`: Registered as a `PlayerBlockBreakEvents.AFTER` listener in `BigdoorsMod.onInitialize()`. The `state` parameter provides the old block state (equivalent to Bedrock's `brokenBlockPermutation`).
- Panel break: Look up assembly by position. Read material index from the old block state's `MATERIAL_INDEX` property. Remove panel from assembly via manager. Spawn the vanilla material item using `ItemEntity`.
- Hinge break: Look up assembly. If open, close the door first (revert panels to closed positions). Before reverting panels to vanilla blocks, add all panel positions to the manager's conversion-in-progress guard (`Set<BlockPos>`) to prevent adjacent hinges' `neighborUpdate` from re-converting them. Replace all door panels with their original vanilla blocks. Clear the guard. Dissolve assembly. Spawn hinge item.

**Patterns to follow:**
- Bedrock `BreakHandler.js`
- Bedrock `tests/BreakHandler.test.mjs` for test scenarios

**Test scenarios:**
- Happy path: breaking a panel removes it from assembly and drops the correct vanilla block
- Happy path: breaking a hinge on a closed door reverts panels to vanilla blocks and dissolves assembly
- Happy path: breaking a hinge on an open door closes first, then dissolves
- Edge case: breaking the last panel dissolves the assembly
- Edge case: breaking a panel not in any assembly does nothing
- Edge case: breaking a hinge does not cause adjacent hinges to re-convert reverted panels (neighborUpdate guard)
- Integration: dropped item matches the panel's material index (cobblestone panel → cobblestone item)

**Verification:**
- Breaking panels shrinks doors, drops correct materials
- Breaking hinges dissolves assemblies cleanly
- `./gradlew test` passes

---

- [ ] **Unit 7: Redstone and double doors**

**Goal:** Redstone power toggles doors open/closed. Double-door detection pairs assemblies for symmetric opening.

**Requirements:** R11-R14 (double doors), R30-R32 (redstone)

**Dependencies:** Unit 4 (placement), Unit 5 (DoorMover)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/HingeBlock.java` (add redstone logic to neighborUpdate)
- Modify: `java-bigdoors/src/main/java/com/bigdoors/DoorManager.java` (ensure pairAndSplitAssemblies is complete)
- Test: `java-bigdoors/src/test/java/com/bigdoors/subsystem/RedstoneTest.java`
- Test: `java-bigdoors/src/test/java/com/bigdoors/block/DoubleDoorTest.java`

**Approach:**
- Redstone: In `HingeBlock.neighborUpdate()`, after the panel detection logic, check `world.getReceivedRedstonePower(pos)`. Compare against a `POWERED` BooleanProperty on HingeBlock. On transition to powered: open door in default CW direction (subject to obstruction). On transition to unpowered: close door. For double doors, signal to either hinge opens/closes both.
- Double doors: Port the detection logic from `PanelPlacementHandler._checkDoubleDoor()` and `HingePlacementHandler._detectDoubleDoor()`. When panel detection runs and finds a paired hinge configuration, call `manager.pairAndSplitAssemblies()`. Partner opening/closing logic in DoorMover mirrors the Bedrock `InteractionHandler._tryOpenPartner()` / `_tryClosePartner()` and `RedstoneSubsystem._openWithRedstone()` / `_closeWithRedstone()`.

**Patterns to follow:**
- Bedrock `RedstoneSubsystem.js` for redstone logic
- Bedrock `PanelPlacementHandler._checkDoubleDoor()` for double-door detection
- Bedrock `DoorManager.pairAndSplitAssemblies()` for split logic

**Test scenarios:**
- Happy path: powering a hinge opens the door in CW direction
- Happy path: removing power closes the door
- Edge case: power on already-open door does nothing
- Edge case: power on obstructed door does not open
- Happy path: two facing hinges with 4 panels form a double door, panels split 2-2
- Happy path: clicking either half of a double door opens both symmetrically
- Edge case: odd panel count — center panel stays fixed
- Happy path: redstone to one hinge of a double door opens both halves

**Verification:**
- Redstone toggles doors in-game
- Double doors form and operate symmetrically
- `./gradlew test` passes
- Update `docs/parity-checklist.md` with Bedrock vs Java status for each feature
- Update `fabric.mod.json` description and `CLAUDE.md` Java section if needed
- All 7 success criteria from the requirements doc pass in-game:
  1. 5-wide, 3-tall cobblestone gate swings open/closed
  2. Double doors open symmetrically outward
  3. Frame blocks restrict door direction
  4. Redstone remotely opens/closes doors
  5. Doors refuse to open into solid obstructions
  6. Door left open survives world save/reload
  7. Breaking a hinge snaps door closed before dissolving

## System-Wide Impact

- **Interaction graph:** Block method overrides (`onPlaced`, `onUse`, `neighborUpdate`) → DoorManager → PersistentState. `PlayerBlockBreakEvents.AFTER` → BreakHandler → DoorManager. All mutations flow through the manager.
- **Error propagation:** `world.getBlockState()` never returns null in Java (returns air state for unloaded chunks). Unlike Bedrock, no need for safe-get wrappers. Door movement should still abort if chunks are unloaded — check `world.isChunkLoaded()` before operating.
- **State lifecycle risks:** Same as Bedrock — partial block movement if interrupted. Mitigated by synchronous single-tick movement. `markDirty()` ensures PersistentState is saved on next world save.
- **neighborUpdate recursion:** `world.setBlockState()` during panel conversion triggers more `neighborUpdate` calls. Mitigated by conversion-in-progress guard set on the manager.
- **API surface parity:** Java edition behavior should match Bedrock for all R1-R32 requirements. Platform differences are documented in the parity checklist.
- **Unchanged invariants:** No vanilla block behavior is modified. No mixins needed. Only Fabric events (`PlayerBlockBreakEvents`, `ItemGroupEvents`, `ServerLifecycleEvents`) are used.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `neighborUpdate` may not fire for all adjacent placement scenarios (e.g., pistons, command blocks) | Acceptable for v1 — we only need player-placed blocks. Add mixin fallback later if needed |
| 64 blockstate variants for door_panel creates large blockstate JSON | Consider a data generator or script to produce the JSON. 64 entries is verbose but manageable |
| MC 26.x API changes from documentation examples | Run `./gradlew genSources` early to verify exact method signatures before writing block code |
| `neighborUpdate` recursion during panel conversion | Use conversion-in-progress guard (`Set<BlockPos>`) on manager |
| PersistentState JSON payload size for very large builds | Same risk as Bedrock. Monitor in practice, no cap for v1 |
| Block model/texture rendering differences between editions | Accept minor visual differences. Document in parity checklist |
| Explosions/pistons bypass `PlayerBlockBreakEvents.AFTER` | Accept for v1 (same limitation as Bedrock). Orphaned assemblies are benign — they self-clean when the world position no longer matches. Consider explosion event listener as future work |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-14-big-doors-mod-requirements.md](docs/brainstorms/2026-05-14-big-doors-mod-requirements.md)
- **Bedrock plan:** [docs/plans/2026-05-14-001-feat-multi-block-hinge-doors-plan.md](docs/plans/2026-05-14-001-feat-multi-block-hinge-doors-plan.md)
- **Bedrock implementation:** `bigdoors_bp/scripts/` (domain, handler, subsystem layers)
- **Bedrock test suite:** `tests/*.test.mjs`
- Fabric API events: `fabric-events-interaction-v0` for `PlayerBlockBreakEvents`
- Fabric API item groups: `fabric-item-group-api-v1` for `ItemGroupEvents`
- Vanilla MC: `PersistentState`, `Block` method overrides, `World.setBlockState()`
