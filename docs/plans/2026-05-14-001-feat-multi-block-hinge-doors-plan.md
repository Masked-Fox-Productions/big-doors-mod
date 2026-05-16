---
title: "feat: Multi-block hinge doors"
type: feat
status: active
date: 2026-05-14
origin: docs/brainstorms/2026-05-14-big-doors-mod-requirements.md
deepened: 2026-05-14
---

# feat: Multi-block hinge doors

## Overview

Implement the Big Doors mod for Minecraft Bedrock Edition — a standalone mod that lets players build arbitrarily large doors from a curated set of ~30 common building materials using a Hinge custom block. Doors rotate 90 degrees on interaction, support redstone, detect obstructions, and persist across world reloads. The mod targets format_version 1.21.30+ and requires the "Upcoming Creator Features" experimental toggle for native redstone support (the `minecraft:redstone_consumer` component is experimental until format_version 1.26.0).

Java/Fabric edition parity is tracked separately and follows after the Bedrock implementation is complete.

## Problem Frame

Minecraft's vanilla doors are limited to 1x2 blocks. Players building castles, fortresses, and large structures need dramatic multi-block gates, drawbridges, and portcullises. Big Doors provides a Hinge block that enables this, working standalone or integrating with the Settlements defense scanner when both mods are installed. (see origin: `docs/brainstorms/2026-05-14-big-doors-mod-requirements.md`)

## Requirements Trace

### Block Definitions
- R1-R4: Hinge block — custom block with facing, mode, and optional material-match texture

### Assembly Detection & Stacking
- R5-R10: Door assembly — auto-detect orientation, vanilla block replacement with custom panel, contiguous same-material detection, vertical stacking

### Multi-hinge Variants
- R11-R14: Double doors — facing hinges, even split, odd center post, tall double-door merge

### Interaction Mechanics
- R15-R19: Opening/closing — click toggle, grid-snapped rotation away from player, entity sweep

### Obstruction & Entity Handling
- R20-R25: Obstruction — three-tier (soft/passable/solid), bidirectional fallback, frame blocks

### Persistence
- R26-R27: Persistence — assembly state survives world reload

### Disassembly
- R28-R29: Disassembly — break removes from assembly, hinge break closes first

### Redstone Integration
- R30-R32: Redstone — powered=open, default clockwise, double-door sync

### Cross-mod Integration
- R33-R35: Settlements integration — optional, closed=wall, open=breach

## Scope Boundaries

- No animated swing — blocks teleport to open/closed position
- No locking mechanism — future enhancement
- No sound effects beyond vanilla block placement sounds
- No portcullis mode (vertical sliding) — future extension of vertical hinges
- No "door breaks solid blocks" option — deferred nice-to-have
- Java edition follows in a separate planning pass after Bedrock is complete
- Settlements integration is a stub API — the scanner doesn't exist yet

## Context & Research

### Relevant Code and Patterns

**Settlements repo (`minecraft-siege`)** — established patterns to replicate:
- **Persistence:** `SettlementManager.load()` reads `world.getDynamicProperty(PERSISTENCE_KEY)`, parses JSON, maps via `fromJSON()`. `save()` calls `setDynamicProperty()`. Dual hydration: `worldInitialize` + `system.run()` fallback. Guarded by `_loaded` flag.
- **Block handlers:** Constructor takes manager, `register()` subscribes to `world.afterEvents.playerPlaceBlock`/`playerBreakBlock`, filters by `typeId`, delegates to `onPlace`/`onPlayerDestroy`.
- **Subsystems:** Constructor takes manager, `register()` wires Bedrock hooks. Never mutate other subsystems.
- **Chunked ops:** `EnclosureDetector` uses `system.runJob(generator)`, yielding every 256 ops. Short-circuits at max volume.
- **Constants:** All magic numbers in `Constants.js`. Block IDs, intervals, thresholds.
- **Block JSON:** Format version `1.20.60` (will bump to `1.21.30`), `minecraft:block` with identifier, components.

**Big Doors repo** — pure scaffold. `main.js` has commented-out wiring skeleton. `Example.js` placeholder domain class with `toJSON`/`fromJSON`. No real code yet.

### External References

- **Block permutations:** 65,536 per block, 65,536 world-wide. States: bool, integer range, or string enum.
- **Block replacement:** `block.setType(typeId)` and `block.setPermutation(BlockPermutation.resolve(typeId, states))`. No player-place events fire from script-side replacement. Chunk must be loaded.
- **Redstone:** `minecraft:redstone_consumer` component (format 1.21.30+) with `min_power: 0` + `onRedstoneUpdate` BlockCustomComponent hook. **Requires "Upcoming Creator Features" experimental toggle** until format_version 1.26.0 — this must be enabled in world settings and documented for users. Must use `min_power: 0` (not 1) so the hook fires on transition to 0, enabling the close path. Script checks `event.powerLevel > 0` to distinguish open vs. close. No polling needed.
- **Interaction:** `onPlayerInteract` BlockCustomComponent hook fires for custom blocks. Register via `blockComponentRegistry.registerCustomComponent()` during `system.beforeEvents.startup`. Block JSON references custom components by namespaced ID under `components` (e.g., `"bigdoors:hinge_component": {}`), not via `minecraft:on_interact`.
- **Per-block data:** No `setDynamicProperty()` on Block class. Use block states (limited) or script-side registry persisted to world dynamic property.
- **Entity queries:** `dimension.getEntities({location, maxDistance})` or `{location, volume}`. `entity.teleport(location)` for displacement.

## Key Technical Decisions

- **Single door panel block with curated material state:** One `bigdoors:door_panel` block type with a `bigdoors:material` integer state (0-29 initially, ~30 common building materials). Permutations swap `material_instances` to match source block textures. Script registry tracks exact vanilla typeId for drops. Avoids creating hundreds of block types while preserving visual fidelity. Unsupported materials are left as vanilla blocks and not incorporated into the door — this is a deliberate scope choice, not a gap. The material list can be expanded in future updates. (see origin decision: custom door block variants)

- **Script-side assembly registry:** Persisted to a world dynamic property as JSON. Keyed by hinge position (`"x,y,z,dim"`). Stores: door-side facing, open/closed state, list of panel positions with their original material typeIds. Assembly membership is tracked centrally, not per-block. On interaction, the registry is consulted — no scan needed for known assemblies.

- **Lazy assembly detection with eager registration:** When a vanilla block is placed adjacent to a hinge, it is immediately replaced with `bigdoors:door_panel` and registered in the assembly. When interacted with, the registry already knows the assembly shape. This is "eager registration, lazy scan" — we register on placement but don't re-scan the world on interaction.

- **Format version 1.21.30:** Bumped from 1.20.0 to enable native `onRedstoneUpdate` hook. Avoids polling overhead.

- **BlockCustomComponent approach — single registrar per component name:** Bedrock allows only one object per component name in `blockComponentRegistry.registerCustomComponent()`. Register `bigdoors:hinge_component` **once** during `system.beforeEvents.startup` with a single composed object providing all hooks: `{ onPlayerInteract, onRedstoneUpdate, onPlayerDestroy, beforeOnPlayerPlace }`. Similarly register `bigdoors:panel_component` once with `{ onPlayerInteract, onPlayerDestroy }`. The composed object delegates to the appropriate handler/subsystem internally. InteractionHandler and RedstoneSubsystem provide hook implementations but do **not** each call `registerCustomComponent` independently — that would cause a duplicate registration error. Block JSON references these by namespaced ID (e.g., `"bigdoors:hinge_component": {}` directly under `components`).

- **Redstone min_power: 0:** The `minecraft:redstone_consumer` component uses `min_power: 0` so that `onRedstoneUpdate` fires on every signal change, including transitions down to 0. The script handler compares `event.powerLevel > 0` to decide open vs. close. Using `min_power: 1` would prevent the transition-to-zero event from firing, breaking the close path.

- **Rotation math:** 90° rotation around hinge Y-axis (horizontal mode) or X/Z-axis (vertical mode). In Minecraft Bedrock's coordinate system (+X east, +Z south), viewed from above, visual clockwise is N→E→S→W. **Formula A (visual CW from above):** `newX = hinge.x - (oldZ - hinge.z)`, `newZ = hinge.z + (oldX - hinge.x)`. A point east of the hinge moves south. **Formula B (visual CCW from above):** `newX = hinge.x + (oldZ - hinge.z)`, `newZ = hinge.z - (oldX - hinge.x)`. A point east of the hinge moves north. Round to nearest integer for grid snap. The "default clockwise" redstone behavior (R31) uses Formula A. Verify labeling in-game during Unit 1 implementation.

- **Double door symmetric opening:** When a double door is triggered, each half computes its own rotation direction independently. The half closer to the player opens "away from player." The other half mirrors to ensure symmetric outward opening. Both halves open/close atomically.

- **Assembly dissolution on hinge break:** When a hinge is broken: (1) if door is open, compute closed positions and teleport panels back, (2) replace all `bigdoors:door_panel` blocks with their original vanilla blocks using the material registry, (3) remove assembly from the persistence registry.

## Open Questions

### Resolved During Planning

- **Block variant approach:** Single `bigdoors:door_panel` with material-index state. ~30 curated materials initially. Script registry handles exact vanilla typeId for drops.
- **Redstone mechanism:** Native `onRedstoneUpdate` via `minecraft:redstone_consumer` component. Requires format_version 1.21.30+. No polling.
- **Persistence mechanism:** World dynamic property registry (like Settlements). Block states store visual info (material, facing); script registry stores assembly graph.
- **Interaction mechanism:** `onPlayerInteract` BlockCustomComponent on both hinge and door panel. Works for custom blocks.
- **Entity displacement:** `dimension.getEntities()` with volume query, `entity.teleport()` to nearest safe position outside the door footprint.
- **Multi-side placement (R5):** Next block wins. The door-side is determined by the first supported-material block placed adjacent to the hinge **after** the hinge is placed. The wall side is always opposite the door side. Hinge stores door-side as a block state once set. Subsequent placements on other sides are treated as normal blocks. For the "build wall first, then place hinge" workflow, the hinge-placement scan (Unit 4) sets door-side based on the direction where existing vanilla blocks are found. Once the scan converts blocks to panels, door-side is committed and cannot be overridden — "next block wins" only applies when door-side is still unset (0). If the scan finds blocks on exactly one side, it sets door-side and converts immediately. If blocks exist on multiple sides, door-side remains unset and the next manually placed block determines it.
- **Stacked hinge detection (R10):** On hinge placement, check up/down at same X/Z for existing hinges. Merge into the existing assembly if found. Assembly stored in registry by primary (lowest) hinge position.
- **Vertical hinge rotation (R2):** Same 90° logic, different axis. Horizontal mode rotates around Y-axis. Vertical mode rotates around the axis perpendicular to the hinge's facing direction (X or Z). Determined by hinge facing + mode block states.
- **Oriented blocks during rotation:** Deferred to a later enhancement. Phase 1 supports simple blocks only. Blocks with orientation states (stairs, logs) will rotate position but not update their facing — acceptable for initial release.
- **Soft/passable/solid categories (R21-R22):** Manual curated lists in Constants.js. No built-in Bedrock tag covers this cleanly. Soft: grass, flowers, snow layers, etc. Passable: signs, torches, vanilla doors, buttons. Solid: everything else.
- **Frame blocks (R20):** Any solid block on the wall-side of a hinge (opposite the door-side). When a solid block is behind the hinge, the door can only open away from it — effectively restricting rotation to one direction. No curated list needed; the existing solid classification from ObstructionChecker applies. The check is: query the block at the wall-side neighbor of the hinge; if solid, exclude that rotation direction.

### Deferred to Implementation

- Exact list of ~30 supported door panel materials and their texture paths
- Optimal entity sweep radius and safe-position calculation algorithm
- Whether assembly scan on hinge placement should be chunked via `system.runJob` for very tall stacks
- Maximum panel count per assembly — no cap for v1, defer until world dynamic property size limits are hit in practice
- Settlements integration API surface — depends on scanner design in Phase 3

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌─────────────────────────────────────────────────────┐
│                     main.js                          │
│  1. DoorManager (creates, loads registry)            │
│  2. RedstoneSubsystem (registers onRedstoneUpdate)   │
│  3. HingePlacementHandler                            │
│  4. PanelPlacementHandler                            │
│  5. BreakHandler                                     │
│  6. InteractionHandler                               │
└─────────┬───────────────────────────────┬────────────┘
          │                               │
          v                               v
┌─────────────────────┐    ┌──────────────────────────┐
│   Domain Layer       │    │   Handler/Subsystem Layer │
│   (no MC imports)    │    │   (Bedrock API wiring)    │
│                      │    │                           │
│  DoorAssembly        │    │  HingePlacementHandler    │
│   - hingePositions[] │    │   onPlace: detect orient, │
│   - panelPositions[] │    │   register assembly       │
│   - materials{}      │    │                           │
│   - isOpen           │    │  PanelPlacementHandler    │
│   - facing           │    │   onPlace: replace vanilla│
│   - mode (h/v)       │    │   with door_panel, add to │
│   - toJSON/fromJSON  │    │   assembly registry       │
│                      │    │                           │
│  RotationMath        │    │  BreakHandler             │
│   - rotate90CW()     │    │   onPlayerDestroy: remove from    │
│   - rotate90CCW()    │    │   assembly or dissolve    │
│   - computeArc()     │    │                           │
│                      │    │  InteractionHandler       │
│  ObstructionChecker  │    │   onInteract: toggle door │
│   - checkPath()      │    │   via DoorManager         │
│   - classifyBlock()  │    │                           │
│                      │    │  RedstoneSubsystem        │
│  MaterialRegistry    │    │   onRedstoneUpdate:       │
│   - indexToTypeId{}  │    │   open/close via manager  │
│   - typeIdToIndex{}  │    │                           │
└─────────────────────┘    └──────────────────────────┘
          │
          v
┌─────────────────────┐
│   DoorManager        │
│   (source of truth)  │
│                      │
│  - assemblies Map    │
│  - load() / save()   │
│  - createAssembly()  │
│  - addPanel()        │
│  - removePanel()     │
│  - openDoor()        │
│  - closeDoor()       │
│  - dissolveAssembly()│
│  - findByPosition()  │
└─────────────────────┘
```

**Data flow for opening a door:**
1. Player clicks door panel or hinge → `onPlayerInteract` fires
2. InteractionHandler calls `manager.findByPosition(blockPos)`
3. Manager returns the DoorAssembly
4. If closed: compute rotation direction (away from player), run ObstructionChecker, execute RotationMath, sweep entities, move blocks via `block.setPermutation()`/`dimension.setBlockType()`, update assembly state, `manager.save()`
5. If open: reverse rotation, restore original positions, update state, save

## Implementation Units

- [ ] **Unit 1: Constants, material registry, and domain classes**

**Goal:** Establish the domain layer foundation — all pure JS classes with no Bedrock imports, fully testable under node:test.

**Requirements:** R1-R10, R20-R25 (domain representations)

**Dependencies:** None

**Files:**
- Modify: `bigdoors_bp/scripts/util/Constants.js`
- Delete: `bigdoors_bp/scripts/domain/Example.js` (scaffold placeholder, no longer needed)
- Create: `bigdoors_bp/scripts/domain/MaterialRegistry.js`
- Create: `bigdoors_bp/scripts/domain/DoorAssembly.js`
- Create: `bigdoors_bp/scripts/domain/RotationMath.js`
- Create: `bigdoors_bp/scripts/domain/ObstructionChecker.js`
- Test: `tests/DoorAssembly.test.mjs`
- Test: `tests/RotationMath.test.mjs`
- Test: `tests/ObstructionChecker.test.mjs`
- Test: `tests/MaterialRegistry.test.mjs`

**Approach:**
- `Constants.js`: Block IDs (`HINGE_BLOCK_ID = 'bigdoors:hinge'`, `PANEL_BLOCK_ID = 'bigdoors:door_panel'`), `PERSISTENCE_KEY`, material lists (SOFT_BLOCKS, PASSABLE_BLOCKS), `MAX_DOOR_SCAN_RADIUS` (default 16 — limits how far from a hinge the placement scan extends), and the curated material index map (~30 entries)
- `MaterialRegistry.js`: Bidirectional mapping between material index (integer) and vanilla typeId string. `indexForTypeId(typeId)` returns the index or -1 for unsupported materials. `typeIdForIndex(index)` returns the vanilla typeId for drops. Pure data, no Bedrock imports
- `DoorAssembly.js`: Domain object representing one door assembly. Properties: `primaryHingePos`, `hingePositions[]`, `panelPositions[]` (each with materialIndex, `closedPos`, and `currentPos`), `facing` (north/south/east/west), `mode` (horizontal/vertical), `isOpen`, `openDirection`. Methods: `addHinge(pos)`, `addPanel(pos, materialIndex)`, `removePanel(pos)`, `updatePanelPositions(newPositions)`, `getAllCurrentPositions()`, `toJSON()`, `static fromJSON()`. Each panel tracks both its original (closed) position and its current position — when the door opens, `currentPos` is updated to the rotated position; when it closes, `currentPos` reverts to `closedPos`. Tracks double-door partner assembly ID if paired
- `RotationMath.js`: Pure math functions. `rotateCW(pos, hingePos)` → new {x,y,z} rounded to int (visual CW from above: Formula A). `rotateCCW(pos, hingePos)` → new pos (visual CCW from above: Formula B). `computeArcPositions(pos, hingePos)` → array of intermediate positions for entity sweep. Horizontal mode rotates X/Z around Y. Vertical mode rotates Y/Z around X (or Y/X around Z) based on facing
- `ObstructionChecker.js`: `classifyBlock(typeId)` → 'soft'|'passable'|'solid' using Constants lists. `checkPath(panelPositions, hingePos, direction, blockQueryFn)` → {canOpen, obstructedPositions, softBlocks, passableBlocks}. Takes a callback for block queries so the domain stays Bedrock-free

**Patterns to follow:**
- `Settlement.js` in Settlements: domain class with `toJSON`/`fromJSON`, no Bedrock imports
- `Constants.js` in Settlements: centralized magic numbers
- `professionRules.js`: pure function split off from handler for testability

**Test scenarios:**
- Happy path: DoorAssembly round-trips through toJSON/fromJSON with all properties preserved
- Happy path: MaterialRegistry maps cobblestone index to "minecraft:cobblestone" and back
- Happy path: rotateCW({x:5,y:0,z:3}, {x:3,y:0,z:3}) returns {x:3,y:0,z:5} (point 2 blocks east moves to 2 blocks south — visual CW from above)
- Happy path: rotateCCW({x:5,y:0,z:3}, {x:3,y:0,z:3}) returns {x:3,y:0,z:1} (point 2 blocks east moves to 2 blocks north — visual CCW from above)
- Happy path: rotateCCW reverses rotateCW for any position
- Edge case: rotation of position at hinge (distance 0) returns hinge position unchanged
- Edge case: rotation of position far from hinge (distance 20) produces valid integer result
- Happy path: classifyBlock("minecraft:short_grass") returns 'soft'
- Happy path: classifyBlock("minecraft:oak_sign") returns 'passable'
- Happy path: classifyBlock("minecraft:stone") returns 'solid'
- Happy path: checkPath returns canOpen:true when all destinations are air (blockQueryFn returns null/air)
- Edge case: checkPath returns canOpen:false when any destination is solid
- Edge case: checkPath returns soft/passable lists for mixed destinations
- Happy path: DoorAssembly.addPanel increases panel count, removePanel decreases it
- Edge case: MaterialRegistry.indexForTypeId returns -1 for unsupported block type
- Happy path: vertical mode rotation rotates Y axis correctly
- Happy path: DoorAssembly.updatePanelPositions updates currentPos for all panels
- Happy path: DoorAssembly.getAllCurrentPositions returns currentPos (not closedPos) when door is open
- Edge case: DoorAssembly round-trips through toJSON/fromJSON preserving both closedPos and currentPos

**Verification:**
- All domain classes instantiate, serialize, and deserialize correctly
- Rotation math produces correct grid-snapped positions for horizontal and vertical modes
- Obstruction classification matches the curated block lists
- `npm test` passes with all test files

---

- [ ] **Unit 2: Block JSON definitions**

**Goal:** Define the hinge and door panel custom blocks with proper components, states, and permutations so they exist in-game with correct visuals and interaction support.

**Requirements:** R1-R4, R6, R30 (block infrastructure)

**Dependencies:** Unit 1 (Constants.js for block IDs and material list)

**Files:**
- Modify: `bigdoors_bp/manifest.json` (bump min_engine_version from [1, 20, 0] to [1, 21, 30], bump @minecraft/server dependency from 1.12.0 to 1.16.0+ — required for BlockCustomComponent V2 and native redstone_consumer support)
- Modify: `bigdoors_rp/manifest.json` (bump min_engine_version from [1, 20, 0] to [1, 21, 30])
- Create: `bigdoors_bp/blocks/hinge.json`
- Create: `bigdoors_bp/blocks/door_panel.json`
- Create: `bigdoors_bp/loot_tables/empty.json` (empty loot table — both blocks reference this to suppress default drops; script handles all drop logic)
- Create: `bigdoors_rp/textures/blocks/hinge.png` (placeholder)
- Create: `bigdoors_rp/textures/blocks/hinge_active.png` (placeholder)
- Create: `bigdoors_rp/textures/terrain_texture.json` (add texture short-names for hinge and door panel material aliases — these short-names are referenced by `material_instances` in block JSON permutations)
- Modify: `bigdoors_rp/texts/en_US.lang` (add block display names)
- Modify: `tests/stubs/minecraft-server.mjs` (add `system.beforeEvents.startup` stub for BlockCustomComponent registration, add `BlockPermutation` export with static `resolve()` method)

**Approach:**
- `hinge.json`: format_version `1.21.30`. States: `bigdoors:facing` (0-3 = N/S/E/W), `bigdoors:mode` (0-1 = horizontal/vertical), `bigdoors:door_side` (0-4 = unset/N/S/E/W). Components: `minecraft:destructible_by_mining`, `"bigdoors:hinge_component": {}` (custom component V2 — referenced by namespaced ID directly under `components`, not via `minecraft:on_interact`), `minecraft:redstone_consumer` with `min_power: 0` (fires `onRedstoneUpdate` on every signal change including transitions to 0; script compares `powerLevel > 0`), `minecraft:loot` pointing to an empty loot table (drops handled by script to ensure correct item). Permutations rotate geometry based on facing state. Placeholder texture for now. **Note:** Redstone requires "Upcoming Creator Features" experimental toggle until format_version 1.26.0
- `door_panel.json`: format_version `1.21.30`. States: `bigdoors:material` (0-29 for ~30 materials). Components: `minecraft:destructible_by_mining`, `"bigdoors:panel_component": {}` (custom component V2 — referenced by namespaced ID directly under `components`), `minecraft:loot` pointing to an empty loot table (drops handled by script — spawns original vanilla material). Permutations: each material index maps to a `material_instances` override using the vanilla block's texture short-name from `terrain_texture.json`. Full-block geometry
- Placeholder textures: simple colored blocks. Real textures can be iterated on later
- `terrain_texture.json`: Add texture short-names (e.g., `bigdoors_hinge`, `bigdoors_panel_cobblestone`) that map to the texture file paths. Door panel permutations reference vanilla texture paths via these aliases in `material_instances`. Each material index permutation maps to the corresponding vanilla block's texture short-name
- Lang file entries for `tile.bigdoors:hinge.name` and `tile.bigdoors:door_panel.name`
- Both blocks should include `minecraft:creative_category` component (or equivalent menu configuration) to appear in the creative inventory under an appropriate tab

**Patterns to follow:**
- `homestead_block.json` in Settlements: block JSON structure with `minecraft:block`, identifier, components
- Bedrock wiki block permutation examples for state-to-texture mapping

**Test scenarios:**
- Test expectation: none — block JSON is declarative and validated by Minecraft's content log on world load. Verification is in-game.

**Verification:**
- Both blocks appear in the creative inventory
- Hinge block can be placed on any solid surface
- Door panel block appears with correct texture for each material permutation
- No content log errors on world load

---

- [ ] **Unit 3: DoorManager, persistence, and main.js wiring**

**Goal:** Implement the central manager, persistence, and main.js startup wiring including BlockCustomComponent registration. This enables in-game smoke testing from Unit 4 onward.

**Requirements:** R26-R27 (persistence)

**Dependencies:** Unit 1 (DoorAssembly, MaterialRegistry), Unit 2 (block JSONs, test stubs)

**Files:**
- Create: `bigdoors_bp/scripts/DoorManager.js`
- Modify: `bigdoors_bp/scripts/main.js` (startup wiring: manager creation, component registration, dual hydration)
- Test: `tests/DoorManager.test.mjs`

**Approach:**
- Constructor: `this._assemblies = new Map()`, `this._positionIndex = new Map()` (reverse lookup: position key → assembly ID), `this._loaded = false`
- `load()`: Read `world.getDynamicProperty(PERSISTENCE_KEY)`, parse JSON, reconstruct via `DoorAssembly.fromJSON()`, populate both maps. Guard with `_loaded` flag (same pattern as SettlementManager)
- `save()`: Serialize all assemblies to JSON, write via `world.setDynamicProperty()`. Wrap in try/catch — if the payload exceeds the dynamic property size limit, log a warning to content log. This is the safety net for the deferred "no cap" decision
- `createAssembly(hingePos, facing, mode)` → new DoorAssembly, assigns ID, saves
- `addPanelToAssembly(assemblyId, panelPos, materialIndex)` → updates assembly and position index, saves
- `removePanelFromAssembly(assemblyId, panelPos)` → updates assembly, saves. If no panels remain, dissolve
- `findByPosition(pos, dimensionId)` → DoorAssembly or null, via position index
- `dissolveAssembly(assemblyId)` → removes from both maps, saves
- `openDoor(assemblyId, direction, newPositions)` / `closeDoor(assemblyId)` → updates assembly state, calls `assembly.updatePanelPositions()`, rebuilds `_positionIndex` for all affected panel positions (removes old current positions, adds new current positions), saves. This ensures `findByPosition()` works for open-position panels (interaction or break on a moved panel)
- Dual hydration: `worldInitialize` event + `system.run()` fallback
- **main.js wiring:** Subscribe to `system.beforeEvents.startup` at module scope (this event fires at engine startup, before `worldInitialize`). In the callback, register BlockCustomComponents as single composed objects: hinge component `{ onPlayerInteract, onPlayerDestroy, beforeOnPlayerPlace }`, panel component `{ onPlayerInteract, onPlayerDestroy }`. Initially the hook implementations can be stubs that log — real implementations are wired in Units 4-6. After component registration, create DoorManager instance, set up dual hydration, log startup. The manager variable is declared at module scope so component callbacks can reference it via closure
- `onRedstoneUpdate` is added to the hinge component composition later in Unit 8

**Patterns to follow:**
- `SettlementManager.js`: save/load pattern, `_loaded` guard, dual hydration, `findContaining()` lookup
- `main.js` in Settlements: load-bearing startup order with manager → subsystems → handlers

**Test scenarios:**
- Happy path: createAssembly stores a new assembly retrievable by findByPosition
- Happy path: save/load round-trip preserves all assemblies with correct state
- Happy path: addPanelToAssembly adds panel, findByPosition returns the assembly for the panel's position
- Happy path: removePanelFromAssembly removes panel from assembly, position no longer found
- Edge case: removePanelFromAssembly on last panel dissolves the assembly
- Happy path: openDoor/closeDoor updates assembly isOpen state
- Edge case: load() with empty/null dynamic property initializes empty registry
- Edge case: load() called twice (dual hydration) does not duplicate assemblies (_loaded guard)
- Happy path: dissolveAssembly removes all positions from index
- Happy path: openDoor updates _positionIndex — old panel positions removed, new rotated positions added
- Happy path: findByPosition returns the assembly when queried at a panel's open (rotated) position
- Happy path: closeDoor reverts _positionIndex to original closed positions
- Edge case: findByPosition returns null for a panel's closed position when the door is open (panel has moved)
- Edge case: findByPosition still returns the assembly for a hinge position when the door is open (hinge positions are never removed from the index during open/close)

- Integration: main.js startup registers both component names without duplicate-registration errors
- Edge case: save() with oversized payload logs warning instead of crashing

**Verification:**
- Manager round-trips assemblies through save/load using test stubs
- Position index correctly maps both hinge and panel positions to their assemblies, updating on open/close
- The mod loads in a Bedrock world with no content log errors (smoke test for wiring)
- `npm test` passes

---

- [ ] **Unit 4: Hinge and panel placement handlers**

**Goal:** Handle block placement events — when a hinge is placed, create an assembly; when a vanilla block is placed adjacent to a hinge, replace it with a door panel and register it.

**Requirements:** R1, R2, R5-R10

**Dependencies:** Unit 2 (block JSONs), Unit 3 (DoorManager)

**Files:**
- Create: `bigdoors_bp/scripts/handler/HingePlacementHandler.js`
- Create: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js`
- Test: `tests/HingePlacementHandler.test.mjs`
- Test: `tests/PanelPlacementHandler.test.mjs`

**Approach:**
- `HingePlacementHandler.register()`: Subscribe to `world.afterEvents.playerPlaceBlock`, filter for `HINGE_BLOCK_ID`. On place: determine facing from player look direction, determine mode from placement surface (floor/ceiling = vertical, wall = horizontal), set block states (`bigdoors:facing`, `bigdoors:mode`, `bigdoors:door_side` = 0/unset), check up/down for existing hinges (vertical stacking R10) — if found, merge into existing assembly, else create new assembly via manager. **After creating/merging the assembly, scan all 4 horizontal neighbors for existing vanilla blocks of a supported material.** If found on exactly one side, set `bigdoors:door_side` to that direction and scan that entire face (horizontally + vertically for multi-row doors), replacing contiguous supported-material vanilla blocks with `bigdoors:door_panel` and registering them. If found on multiple sides, leave `door_side` unset — the next manually placed block (via PanelPlacementHandler) will set it ("next block wins"). Stop scanning at air, unsupported materials, non-vanilla blocks, or `MAX_DOOR_SCAN_RADIUS` (defined in Constants.js — a reasonable default like 16 blocks from the hinge). This prevents accidental conversion of large structures
- `PanelPlacementHandler.register()`: Subscribe to `world.afterEvents.playerPlaceBlock`, filter for NON-hinge, NON-panel blocks. On place: check all 4 horizontal neighbors for (a) a hinge block, or (b) an existing `bigdoors:door_panel` that belongs to an assembly. **Hinge-adjacent:** If a hinge is found: check the hinge's `bigdoors:door_side` state. If unset (0), the placed block's direction from the hinge becomes the door-side — update the hinge block state ("next block wins"). If door-side is already set and the placed block is NOT on that side, ignore it. Look up material index via MaterialRegistry. If supported material: replace placed block with `bigdoors:door_panel` (set material state), add to assembly via manager. If unsupported material: leave as-is. **Panel-adjacent expansion:** If no hinge neighbor but an existing door panel neighbor is found, check if the placed block is on the same plane as the assembly (same row/column relative to the hinge). If so and the material is supported, replace with door_panel and add to the assembly. This handles building wide doors where blocks beyond the first column are adjacent to panels, not hinges

**Patterns to follow:**
- `HomesteadHandler.js` in Settlements: constructor takes manager, `register()` subscribes to place/break events, `onPlace()` method does the work
- `CallingHandler.onPlace` for the save-after-mutation pattern

**Test scenarios:**
- Happy path: placing a hinge on a wall creates a horizontal-mode assembly with correct facing
- Happy path: placing a hinge on a floor creates a vertical-mode assembly
- Happy path: placing cobblestone adjacent to a hinge's door-side replaces it with door_panel and registers in assembly
- Edge case: placing an unsupported material adjacent to a hinge does not replace it
- Happy path: placing a second hinge above an existing hinge merges into the same assembly (vertical stacking)
- Happy path: first block placed after hinge sets the hinge's door-side to that direction (next block wins)
- Edge case: placing a block on a different side of a hinge that already has a door-side set is ignored
- Edge case: wall side is always opposite the door side — blocks on the wall side are not converted
- Happy path: placing a hinge next to an existing 3-wide wall of cobblestone scans and converts all 3 blocks into door panels
- Happy path: placing a hinge next to a 3-wide, 2-tall wall converts all 6 blocks (horizontal + vertical scan)
- Happy path: placing a vanilla block adjacent to an existing door panel (not a hinge) expands the assembly
- Edge case: panel-adjacent expansion stops at unsupported materials
- Edge case: panel-adjacent expansion does not cross to the opposite side of the hinge

**Verification:**
- Hinge placement creates assemblies with correct facing and mode
- Hinge placement scans for existing vanilla blocks on the door-side and converts them
- Vanilla blocks adjacent to hinges or existing panels are replaced with door panels
- Vertical stacking merges assemblies correctly
- `npm test` passes

---

- [ ] **Unit 5: Door open/close interaction and rotation**

**Goal:** Implement the core door mechanic — clicking a door panel or hinge rotates all panels 90 degrees, checking for obstructions, sweeping entities, and updating block positions.

**Requirements:** R15-R25 (opening, closing, obstruction, entity sweep)

**Dependencies:** Unit 1 (RotationMath, ObstructionChecker), Unit 3 (DoorManager), Unit 4 (placement handlers)

**Files:**
- Create: `bigdoors_bp/scripts/handler/InteractionHandler.js`
- Create: `bigdoors_bp/scripts/subsystem/EntitySweeper.js`
- Test: `tests/InteractionHandler.test.mjs`
- Test: `tests/EntitySweeper.test.mjs`

**Approach:**
- `InteractionHandler`: Provides `onPlayerInteract` implementations for both hinge and panel components (composed into the single-registrar objects during main.js startup — see Key Technical Decisions). On interact: look up assembly via `manager.findByPosition()`. If closed: determine direction (away from player using player position vs hinge position), run `ObstructionChecker.checkPath()` with a block-query callback that calls `dimension.getBlock()`. If blocked, try opposite direction. If both blocked, do nothing. If clear: destroy soft blocks, destroy passable blocks (drop items), teleport panels to rotated positions using `block.setType()`/`setPermutation()`, set old positions to air, sweep entities via EntitySweeper, update assembly state, save. If open: reverse rotation (use stored openDirection), restore panels to original positions, save
- `EntitySweeper`: Query entities in the swept volume using `dimension.getEntities({location, volume})`. For each entity in the arc, teleport to nearest position outside the door footprint. Direction: push away from hinge along the sweep direction
- Block movement algorithm (three-phase): (1) compute all {source, destination, materialState} tuples and validate every destination is in a loaded chunk via `safeGetBlock()` — if any destination returns undefined/null (unloaded chunk), abort the entire operation and leave the door in its current state, (2) set all source positions to air, (3) set all destination positions to `bigdoors:door_panel` with correct material state. This three-phase approach prevents read-after-write hazards when source and destination sets overlap

**Patterns to follow:**
- `BlockScanner.safeGetBlock()` pattern for handling unloaded chunks
- Three-phase block movement (compute, clear, place) to avoid read-after-write hazards — similar to how `EnclosureDetector` pre-computes before acting

**Test scenarios:**
- Happy path: clicking a closed single-hinge door opens it — panels move to rotated positions
- Happy path: clicking an open door closes it — panels return to original positions
- Happy path: door opens away from the player's side
- Edge case: door blocked on player's side opens in the opposite direction
- Edge case: door blocked on both sides does not move
- Happy path: soft blocks in the path are destroyed (no drops)
- Happy path: passable blocks in the path are destroyed with item drops
- Edge case: solid block in the path prevents opening in that direction
- Happy path: frame blocks behind hinge restrict opening to one direction
- Edge case: door movement aborts if any destination position is in an unloaded chunk — door stays in current state
- Integration: opening a door updates the assembly's isOpen state in the manager
- Integration: opening a door triggers manager.save() for persistence

**Verification:**
- Doors open and close correctly with grid-snapped rotation
- Obstruction detection correctly classifies blocks and prevents/allows movement
- Assembly state is persisted after every toggle
- `npm test` passes

---

- [ ] **Unit 6: Disassembly and break handling**

**Goal:** Handle block break events — removing panels from assemblies and dissolving assemblies when hinges are broken (with close-first behavior).

**Requirements:** R28-R29 (disassembly)

**Dependencies:** Unit 3 (DoorManager), Unit 5 (InteractionHandler for close logic)

**Files:**
- Create: `bigdoors_bp/scripts/handler/BreakHandler.js`
- Test: `tests/BreakHandler.test.mjs`

**Approach:**
- **Event strategy:** Use custom component `onPlayerDestroy` hooks (not `world.afterEvents.playerBreakBlock`) for both hinge and panel breaks. The `BlockComponentPlayerDestroyEvent` provides `destroyedBlockPermutation` which preserves the block's state data (material index, facing, door-side) even after the block is removed. Note: `onPlayerDestroy` only fires for player-initiated destruction. Explosion/piston destruction of door blocks is out of scope for v1 — add `world.afterEvents.blockExplode` handling as a future enhancement if needed. To prevent default drops (which would drop the custom block item), set `minecraft:loot` to an empty loot table on both block JSONs — all drop logic is handled by the script to ensure the correct vanilla material is dropped
- `BreakHandler`: Provides `onPlayerDestroy` implementations for both `bigdoors:hinge_component` and `bigdoors:panel_component`. These are composed into the single-registrar component objects (see Key Technical Decisions)
- Panel break: Look up assembly via `manager.findByPosition()`. Remove panel from assembly. Spawn the original vanilla block item (using material registry to get the vanilla typeId) at the break position. Assembly continues with remaining panels
- Hinge break: Look up assembly. If door is open, execute close logic (compute original positions, teleport panels back). Then for each remaining panel in the assembly, replace `bigdoors:door_panel` with the original vanilla block (using `block.setType()`). Dissolve assembly from manager. Spawn the hinge item at the break position
- For vertically stacked hinges: breaking one hinge from a stack splits the assembly or dissolves the sub-assembly depending on remaining hinges

**Patterns to follow:**
- `HomesteadHandler.onPlayerDestroy` in Settlements: break event handling with manager delegation
- Assembly dissolution follows the same save-after-mutation pattern

**Test scenarios:**
- Happy path: breaking a door panel removes it from the assembly, remaining door functions normally
- Happy path: breaking a hinge on a closed door reverts all panels to vanilla blocks and dissolves assembly
- Happy path: breaking a hinge on an open door closes the door first, then dissolves
- Edge case: breaking the last panel in an assembly dissolves the assembly
- Integration: panel drops the correct vanilla block type (cobblestone panel drops cobblestone)
- Edge case: breaking a middle hinge from a 3-tall stack — assembly splits or dissolves based on remaining connectivity

**Verification:**
- Breaking panels shrinks doors correctly
- Breaking hinges closes and dissolves assemblies
- Correct vanilla blocks are dropped/restored
- `npm test` passes

---

- [ ] **Unit 7: Double doors and tall double-door assemblies**

**Goal:** Detect and handle double doors — two facing hinges with panels between them that open symmetrically.

**Requirements:** R11-R14 (double doors, odd center post, tall merge)

**Dependencies:** Unit 5 (InteractionHandler), Unit 4 (HingePlacementHandler)

**Files:**
- Modify: `bigdoors_bp/scripts/handler/PanelPlacementHandler.js` (double-door detection)
- Modify: `bigdoors_bp/scripts/handler/InteractionHandler.js` (symmetric opening)
- Modify: `bigdoors_bp/scripts/domain/DoorAssembly.js` (partner assembly tracking)
- Test: `tests/DoubleDoor.test.mjs`

**Approach:**
- Double-door detection: When panels are placed between two hinges, check if the hinges face each other (door-sides pointing toward each other). If so, pair the two assemblies. Split panels evenly — each hinge owns its half. With odd count, center panel remains a `bigdoors:door_panel` owned by neither assembly (removed from both). It stays in place during open/close, acts as a solid block for obstruction checks, and if broken, drops its vanilla material like any other panel (looked up from its material state, not from an assembly)
- Symmetric opening: When either half of a double door is interacted with, both halves open. The half closer to the player opens "away from player." The other half opens in the mirror direction. Both assemblies update atomically
- Tall double doors (R14): When vertically stacked hinges face another stack, all stacks merge into paired assemblies. Detection: after stacking merge (from Unit 4), check if the merged assembly's hinges face another assembly's hinges
- Partner tracking: `DoorAssembly` gets a `partnerAssemblyId` field. When one opens, the other opens too

**Patterns to follow:**
- DoorAssembly partner pattern is similar to how Settlements links beacons to charter-tier settlements

**Test scenarios:**
- Happy path: two facing hinges with 4 panels between them form a double door, panels split 2-2
- Happy path: clicking either half opens both halves symmetrically outward
- Edge case: odd panel count (3 between hinges) — center panel stays fixed, each hinge gets 1
- Happy path: 3-tall double door (stacked hinges on both sides) merges into one tall double-door assembly
- Edge case: double door with one side blocked opens only the unblocked side (or neither if both blocked)
- Integration: closing a double door closes both halves and saves both assemblies

**Verification:**
- Double doors form correctly when hinges face each other
- Both halves open/close symmetrically
- Odd center posts remain fixed
- Tall double doors work as a single unit

---

- [ ] **Unit 8: Redstone subsystem**

**Goal:** Add redstone-triggered door opening/closing by composing `onRedstoneUpdate` into the existing hinge component registration.

**Requirements:** R30-R32 (redstone)

**Dependencies:** Unit 5 (InteractionHandler for open/close logic). Double-door redstone sync (R32) requires Unit 7 but basic redstone (R30-R31) can be implemented and tested independently

**Files:**
- Create: `bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js`
- Modify: `bigdoors_bp/scripts/main.js` (add `onRedstoneUpdate` to hinge component composition)
- Test: `tests/RedstoneSubsystem.test.mjs`

**Approach:**
- `RedstoneSubsystem`: Provides the `onRedstoneUpdate` implementation for the hinge component. Because `min_power: 0`, the hook fires on every signal change. On power change: if `event.powerLevel > 0` and door is closed, open door using default direction (visual CW from above / Formula A), subject to obstruction and frame-block rules. If `event.powerLevel === 0` and door is open, close door. For double doors, signal to either hinge triggers both. State guard: no-op if door is already in the desired state (e.g., power > 0 but door already open)
- `main.js` update: Add `onRedstoneUpdate` to the hinge component's composed object (the component was already registered in Unit 3 with stub hooks — this replaces the redstone stub with the real implementation)

**Patterns to follow:**
- `SpawnSuppressor` in Settlements: subsystem pattern with constructor(manager) + register()

**Test scenarios:**
- Happy path: powering a hinge with redstone opens the door in the default (CW) direction
- Happy path: removing redstone power closes the door
- Edge case: redstone signal on an already-open door does nothing
- Edge case: redstone signal on an obstructed door does not open
- Happy path: redstone to one hinge of a double door opens both halves

**Verification:**
- Redstone toggles doors correctly
- All 7 success criteria from the requirements doc pass in-game testing

## System-Wide Impact

- **Interaction graph:** BlockCustomComponent hooks (`onPlayerInteract`, `onRedstoneUpdate`) → handler/subsystem → DoorManager → persistence. All mutations flow through the manager
- **Error propagation:** `dimension.getBlock()` can throw for unloaded chunks — all block queries should use a safe wrapper (like Settlements' `safeGetBlock`). Failures during door movement should abort and leave the door in its current state (not half-moved)
- **State lifecycle risks:** Partial block movement (some panels moved, some not) if the operation is interrupted. Mitigation: compute all destination positions first, validate all are accessible, then execute all moves in a single synchronous pass. If any destination is in an unloaded chunk, abort. **No chunked/async movement in v1** — all block moves are synchronous within a single tick. If this causes frame drops on very large doors, a future enhancement can add `system.runJob` chunking with an `isMoving` in-progress state, interruption recovery on reload, and a panel-count threshold constant. Until then, synchronous movement avoids partial-move corruption
- **Integration coverage:** The vanilla-to-panel replacement (Unit 4) + break-to-vanilla restoration (Unit 6) cycle must be verified end-to-end: place vanilla block → auto-replace → break panel → drops correct vanilla item
- **Unchanged invariants:** The mod does not modify any vanilla block behavior. Hinge and door panel are new custom blocks. No vanilla event handlers are overridden

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Permutation budget: ~30 materials × permutations may compete with other mods' block registrations | Monitor world-wide permutation count. Start with 30 materials, expand conservatively |
| Large door movement freezes game on low-end devices | v1 uses synchronous single-tick movement. If frame drops are observed, a future enhancement adds `system.runJob` chunking with in-progress state and recovery. No cap on panel count for now — defer until practical limits are hit |
| Block replacement race condition: player breaks the vanilla block in the same tick it's being replaced | Use `beforeOnPlayerPlace` if available, or validate block still exists before replacement |
| Unloaded chunks during door movement for doors spanning chunk boundaries | Abort door movement if any destination position is in an unloaded chunk. Use safe block access wrapper |
| Format version 1.21.30 requirement excludes older Minecraft versions | Documented in README. 1.21.30 is widely available (released 2024) |
| Redstone requires "Upcoming Creator Features" experimental toggle (until format_version 1.26.0) | Document in README and in-game setup instructions. Redstone is degraded gracefully — doors still work via click interaction without the toggle |

## Documentation / Operational Notes

- Update `CLAUDE.md` to reflect new architecture (domain classes, handlers, subsystems specific to Big Doors) and the updated `@minecraft/server` dependency version (1.16.0+) and `min_engine_version` (1.21.30)
- Update `docs/design.md` with the multi-block door design, assembly lifecycle, and rotation math
- Update `docs/parity-checklist.md` to track which features are Bedrock-only vs. cross-edition
- README already written with installation and usage instructions

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-14-big-doors-mod-requirements.md](docs/brainstorms/2026-05-14-big-doors-mod-requirements.md)
- **Settlements repo patterns:** `SettlementManager.js`, `HomesteadHandler.js`, `EnclosureDetector.js`, `Constants.js`, `main.js` in `C:\Projects\minecraft-siege\settlements_bp\scripts\`
- **Bedrock block permutations:** https://wiki.bedrock.dev/blocks/block-permutations
- **Bedrock redstone components:** https://wiki.bedrock.dev/blocks/redstone-components
- **BlockCustomComponent API:** https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockcustomcomponent
- **Block replacement API:** `Block.setType()`, `Block.setPermutation()`, `BlockPermutation.resolve()`
- **Entity queries:** `Dimension.getEntities(EntityQueryOptions)` with `location` + `volume`
