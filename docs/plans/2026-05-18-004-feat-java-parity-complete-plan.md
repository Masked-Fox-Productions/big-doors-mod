---
title: "feat: Complete Java/Fabric feature parity with Bedrock edition"
type: feat
status: active
date: 2026-05-18
origin: docs/plans/2026-05-15-001-feat-java-fabric-port-plan.md
---

# feat: Complete Java/Fabric feature parity with Bedrock edition

## Overview

The initial Java port (completed per `docs/plans/2026-05-15-001-feat-java-fabric-port-plan.md`) delivered core door mechanics: hinge placement, panel detection, open/close, redstone, double doors, and break handling. Since then, the Bedrock edition has gained significant new features. This plan closes every remaining gap to achieve full feature parity.

## Problem Frame

The Java edition currently supports 64 materials, one panel block type, horizontal-only rotation, and no exotic geometry. The Bedrock edition has expanded to 208 materials across 13 groups, 5 panel block types (full block, fence, bars, pane, slab), hidden hinges, vertical doors, panel rotation states, overlay textures, close obstruction checking, boundary panels, assembly merge/split, hinge material tracking, and a complete ropes/whips system. Players on Java edition are missing roughly half the mod's features.

## Feature Audit — Parity Gap Summary

| # | Feature | Bedrock | Java | Gap |
|---|---------|---------|------|-----|
| 1 | Materials (groups 0-3, indices 0-63) | Yes | Yes | None |
| 2 | Materials (groups 4-12, indices 64-207) | Yes | No | **Missing** |
| 3 | Exotic geometry classes (fence/bars/pane/slab) | Yes | No | **Missing** |
| 4 | Multiple panel block types | 5 types | 1 type | **Missing** |
| 5 | Panel rotation states | Yes | No | **Missing** |
| 6 | Hidden hinge block | Yes | No | **Missing** |
| 7 | Hinge overlay / strap overlay | Yes | No | **Missing** |
| 8 | Vertical door mode (full pipeline + placement) | Partial (math exists) | Math only | **Missing pipeline + placement** |
| 9 | Close obstruction checking | Yes | No | **Missing** |
| 10 | Boundary panels (double-door center) | Yes | No | **Missing** |
| 11 | Assembly merge/resplit/reset | Yes | No | **Missing** |
| 12 | Hinge type + material tracking | Yes | No | **Missing** |
| 13 | Ropes, rope ladders, whips | Yes | No | **Deferred** (separate plan) |
| 14 | Redstone source tracking + monitors | Polling monitors | Scheduled close | **Acceptable difference** |
| 15 | Core door mechanics | Yes | Yes | None |
| 16 | Double door pairing + split | Yes | Yes | None |
| 17 | Redstone open/close | Yes | Yes | None |
| 18 | Entity sweep | Yes | Yes | None |
| 19 | Break handling | Yes | Yes | None |
| 20 | Persistence | Yes | Yes | None |

## Requirements Trace

- P1. Extend material registry to 208 entries using material_group (0-12) + material_id (0-15) split
- P2. Add geometry class system with fence, bars, pane, slab variants
- P3. Register 4 additional panel block types (fence, bars, pane, slab)
- P4. Add panel rotation block state and PanelRotation logic
- P5. Register hidden hinge block with impersonation behavior
- P6. Complete vertical door pipeline (auto-detection of vertical mode from first panel direction, obstruction check, door mover, placement). Vertical mode is set automatically when the first panel is placed above/below the hinge — no user-facing mode selection UI needed
- P7. Add close obstruction checking before closing doors
- P8. Add boundary panel support to DoorAssembly and DoorManager
- P9. Add assembly merge, resplit, reset, hinge removal to DoorManager
- P10. Add hinge type/material tracking to assembly hinge records
- P11. All existing tests continue to pass; new features have test coverage
- P12. Add overlay block state property to panel blocks. Regular hinge assemblies set overlay=1 (showing strap texture); hidden hinge assemblies set overlay=0
- ~~P13. Port ropes system~~ — **Deferred to separate plan.** The ropes system is independent of doors and will have its own Java port plan.

## Scope Boundaries

- **Ropes system:** Deferred to a separate Java ropes port plan. Independent of door features.
- **Overlay textures:** Included. Assets exist at `bigdoors_rp/textures/blocks/door_panel_overlay_h.png`, `hinge_overlay_h.png`, etc. Overlay is an integer block state (0=none, 1=strap) set based on hinge type.
- Redstone source tracking: Java uses `getBestNeighborSignal` + scheduled close checks. This is an acceptable platform difference — no change needed
- Block model/texture rendering: Bedrock uses custom geometry JSON; Java uses blockstate JSON with vanilla model references. Visual fidelity may differ slightly
- Recipes: Neither edition has crafting recipes — out of scope
- Settlements integration: Not applicable to Java
- Client-side rendering: Standard blockstate/model system only, no custom renderers

## Context & Research

### Relevant Code and Patterns

**Bedrock source of truth:**
- `bigdoors_bp/scripts/util/Constants.js` — 208-entry `MATERIAL_INDEX`, `GEOMETRY_INDEX`, `MATERIAL_GEOMETRY_CLASS` map, geometry class constants, `panelBlockIdForGeoClass()`
- `bigdoors_bp/scripts/domain/MaterialRegistry.js` — `resolveGeometryId()`, `resolveVerticalGeometryId()`, `panelBlockStates()`, `geometryClassForMaterial()`
- `bigdoors_bp/scripts/domain/PanelRotation.js` — `closedRotation()`, `openRotation()`
- `bigdoors_bp/scripts/domain/DoorAssembly.js` — `boundaryPanels`, `hingeType`, hinge records with `type` and `materialIndex`, `geometryId` on panels, `overlay` on panels
- `bigdoors_bp/scripts/domain/ObstructionChecker.js` — `checkClose()`
- `bigdoors_bp/scripts/DoorManager.js` — `mergeAssemblies()`, `resplitAssemblies()`, `resetAssembly()`, `removeHingeFromAssembly()`, `setHingeMaterialIndex()`, `setRedstoneSource()`/`clearRedstoneSource()`
- `bigdoors_bp/scripts/handler/InteractionHandler.js` — uses `getRotateFn()` for mode-aware rotation, geometry-aware panel states
- `bigdoors_bp/scripts/ropes/` — complete ropes subsystem
- `bigdoors_bp/blocks/hidden_hinge.json` — hidden hinge block definition
- `bigdoors_bp/blocks/door_panel_*.json` — exotic panel blocks

**Java implementation (current state):**
- `java-bigdoors/src/main/java/com/bigdoors/util/Constants.java` — 64-entry `MATERIAL_INDEX` only, no geometry constants
- `java-bigdoors/src/main/java/com/bigdoors/domain/MaterialRegistry.java` — `indexForTypeId()`, `typeIdForIndex()`, `isSupportedMaterial()` — no geometry functions
- `java-bigdoors/src/main/java/com/bigdoors/domain/DoorAssembly.java` — `PanelEntry` record lacks `geometryId` and `overlay`; no `boundaryPanels`; hinge positions are plain `BlockPos3` without type/material
- `java-bigdoors/src/main/java/com/bigdoors/domain/ObstructionChecker.java` — `checkPath()` only, no `checkClose()`; doesn't accept mode/facing
- `java-bigdoors/src/main/java/com/bigdoors/domain/RotationMath.java` — has vertical rotation, but no `getRotateFn()` dispatcher
- `java-bigdoors/src/main/java/com/bigdoors/subsystem/DoorMover.java` — hardcodes `rotateCW`/`rotateCCW`, no mode-aware rotation; no close obstruction check
- `java-bigdoors/src/main/java/com/bigdoors/DoorManager.java` — no merge, resplit, reset, removeHinge, setHingeMaterialIndex, redstoneSource tracking

## Key Technical Decisions

- **Material storage via material_group + material_id split (matching Bedrock):** The current Java `MATERIAL_INDEX` IntegerProperty has range 0-63. Expanding to 208 materials requires a property scheme change. Adopting Bedrock's two-property approach: `MATERIAL_GROUP` IntegerProperty (0-12) and `MATERIAL_ID` IntegerProperty (0-15). **Rationale:** This is primarily a **Bedrock parity choice** — matching the Bedrock property names and semantics exactly (`bigdoors:material_group` + `bigdoors:material_id`) simplifies cross-edition reasoning and keeps the domain layer's group/id conversion identical on both platforms. Note: in Java blockstate JSON, the total variant count is the same whether using one 0-207 property or two split properties (13 × 16 = 208 either way), so this is not a combinatorial reduction — it's an organizational and parity decision. The flat index is `group * 16 + id`. **Migration:** The existing `material_index` property (0-63) maps cleanly to groups 0-3 (`material_group = index / 16`, `material_id = index % 16`). Existing worlds need block data migration — either via a one-time migration on first load or by accepting a breaking change given the small Java user base.

- **Exotic geometry via Java blockstates, not custom models:** Bedrock uses custom geometry JSON files. Java will use multiple block types (DoorPanelFenceBlock, etc.) that extend vanilla Block with appropriate collision/outline shapes and vanilla-referenced models. Each exotic type gets its own blockstate JSON mapping material group/id to the correct vanilla texture. This avoids needing custom model renderers.

- **Panel rotation via block state property:** Add `PANEL_ROTATION` IntegerProperty (0-7) to all panel blocks, matching Bedrock's `bigdoors:panel_rotation` range. Values 0-3 are horizontal rotations (0°/90°/180°/270° Y-axis). Values 4-7 are used by vertical mode and exotic geometry classes for plane rotations. The rotation value controls model rotation in the blockstate JSON via `x`/`y` rotation fields.

- **Hidden hinge as separate Block subclass:** Like Bedrock's separate block JSON, Java gets a `HiddenHingeBlock extends HingeBlock` that overrides model/texture behavior to render as the matched panel material. Shares all logic with HingeBlock. **API changes required:** `DoorManager.createAssembly()` gains an optional `hingeType` parameter (default "hinge"). `addHingeToAssembly()` gains `hingeType` (default "hinge") and `materialIndex` (default UNMATCHED_MATERIAL_INDEX) so that new hinges are stored as HingeRecords. HiddenHingeBlock.setPlacedBy passes hingeType="hidden" through these updated signatures.

- **Boundary panels stored on DoorAssembly:** Match the Bedrock pattern — `boundaryPanels` list on the assembly, indexed in the position map. Boundary panels are center panels in double doors that don't rotate with either half.

- **Hinge records as structured objects:** Replace `List<BlockPos3>` with `List<HingeRecord>` containing `pos`, `type` ("hinge"/"hidden"), and `materialIndex`. Matches the Bedrock `hingePositions` structure. To minimize caller churn, `DoorAssembly` will provide a `getHingeBlockPositions()` convenience method returning `List<BlockPos3>` (extracted from records) so callers that only need positions can migrate incrementally.

- **Ropes system deferred to a separate plan:** The ropes system (rope chains, rope ladders, whips, climbing) is completely independent of the door system — no shared domain, blocks, or handlers. It will be planned and implemented separately. See `docs/plans/2026-05-18-002-feat-ropes-rope-ladders-whips-plan.md` for the existing Bedrock ropes plan. A Java ropes plan should be created when door parity is complete.

## Open Questions

### Resolved During Planning

- **Geometry variant selection at runtime:** Java can use `neighborUpdate` on exotic panel blocks to update their visual variant (solo/before/after/both) just like Bedrock resolves geometry IDs based on neighbor context. The variant is a block state property, not stored in the assembly.
- **Slab half (top/bottom):** Slab panels track `geometryId` on the PanelEntry (6=bottom, 8=top), matching the Bedrock pattern where placement handler resolves slab position based on click location.
### Deferred to Implementation

- Exact blockstate JSON structure for each exotic panel variant — data generator script required (see Unit 9)
- Migration strategy for existing Java worlds with material_index (0-63) → material_group + material_id — depends on how many Java worlds exist in the wild

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Phase 1: Domain Foundation
┌─────────────────────────────────────────────────────┐
│ Expand Constants.java:                               │
│   MATERIAL_INDEX[208], GEOMETRY_INDEX[15],           │
│   MATERIAL_GEOMETRY_CLASS Map, geometry class IDs    │
│                                                      │
│ Expand MaterialRegistry.java:                        │
│   geometryClassForMaterial(), resolveGeometryId(),   │
│   resolveVerticalGeometryId(), panelBlockStates()    │
│                                                      │
│ Add PanelRotation.java:                              │
│   closedRotation(), openRotation()                   │
│                                                      │
│ Add RotationMath.getRotateFn()                       │
│                                                      │
│ Expand DoorAssembly:                                 │
│   HingeRecord (pos, type, materialIndex)             │
│   PanelEntry + geometryId, boundaryPanels list       │
│                                                      │
│ Add ObstructionChecker.checkClose()                  │
│ Update checkPath() with mode/facing params           │
└─────────────────────────────────────────────────────┘
                        │
Phase 2: Block Layer     ▼
┌─────────────────────────────────────────────────────┐
│ Migrate DoorPanelBlock: material_index →             │
│   MATERIAL_GROUP (0-12) + MATERIAL_ID (0-15)        │
│                                                      │
│ Register exotic panel blocks:                        │
│   DoorPanelFenceBlock, DoorPanelBarsBlock,          │
│   DoorPanelPaneBlock, DoorPanelSlabBlock            │
│                                                      │
│ Register HiddenHingeBlock                            │
│                                                      │
│ Add PANEL_ROTATION state to all panels               │
│                                                      │
│ Blockstate JSON + models for all variants            │
└─────────────────────────────────────────────────────┘
                        │
Phase 3: Logic + Mgmt    ▼
┌─────────────────────────────────────────────────────┐
│ DoorManager additions:                               │
│   mergeAssemblies(), resplitAssemblies(),            │
│   resetAssembly(), removeHingeFromAssembly(),        │
│   setHingeMaterialIndex()                            │
│                                                      │
│ DoorMover: mode-aware rotation via getRotateFn(),    │
│   close obstruction check, geometry-aware block      │
│   type selection + rotation states                   │
│                                                      │
│ HingeBlock/DoorPanelBlock: geometry-aware placement, │
│   exotic block type selection, rotation states       │
└─────────────────────────────────────────────────────┘
                        │
Phase 4: Integration     ▼
┌─────────────────────────────────────────────────────┐
│ Wire all features into mod initialization            │
│ Full test suite + in-game verification               │
│ Update parity checklist                              │
│                                                      │
│ Ropes system → separate plan (independent of doors)  │
└─────────────────────────────────────────────────────┘
```

## Implementation Units

### Phase 1: Domain Foundation

- [ ] **Unit 1: Expand Constants and MaterialRegistry**

**Goal:** Extend the material registry from 64 to 208 entries. Add geometry class system, geometry index, and all geometry-related functions.

**Requirements:** P1, P2

**Dependencies:** None

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/util/Constants.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/domain/MaterialRegistry.java`
- Modify: `java-bigdoors/src/test/java/com/bigdoors/domain/MaterialRegistryTest.java`

**Approach:**
- Add `MATERIAL_INDEX` entries 64-207 matching Bedrock's `Constants.js` groups 4-12 (logs, fences, terracotta, metals, slabs, glass panes). **Note:** Entries 205-207 are empty/reserved in Bedrock. Represent as `null` in the Java array. Update the `TYPE_TO_INDEX` static initializer to skip null entries: `if (Constants.MATERIAL_INDEX[i] != null) TYPE_TO_INDEX.put(...)`. The blockstate generator (Unit 9) handles the corresponding group=12, id=13/14/15 variants with a fallback model
- Add `GEOMETRY_INDEX` array (15 entries) and geometry class constants (`GEOMETRY_CLASS_FENCE`, `GEOMETRY_CLASS_BARS`, etc.)
- Add `MATERIAL_GEOMETRY_CLASS` as `Map<Integer, Integer>` mapping material indices to their geometry class
- Add `materialGroupForIndex(int flatIndex)` → `flatIndex / 16` and `materialIdForIndex(int flatIndex)` → `flatIndex % 16` to MaterialRegistry (these map flat indices to the block state properties)
- Add `flatIndexFromGroupAndId(int group, int id)` → `group * 16 + id` to MaterialRegistry
- Add `panelBlockIdForGeoClass()` and `panelBlockIdForMaterial()` to MaterialRegistry
- Add `geometryClassForMaterial()`, `resolveGeometryId()`, `resolveVerticalGeometryId()`, `panelBlockStates()` to MaterialRegistry
- Add `isSlabGeometryId()` helper
- Add up/down to `DIR_OFFSETS` and `OPPOSITE_DIR` in Constants. Add a `HORIZONTAL_DIR_OFFSETS` helper (or `horizontalDirOffsets()`) returning only the four cardinal entries. **Guard required:** `HingeBlock.tryConvertNeighbors()` and `DoorPanelBlock.neighborChanged()` iterate DIR_OFFSETS for panel detection — these must use `HORIZONTAL_DIR_OFFSETS` when assembly mode is horizontal, otherwise they will greedily convert vertically adjacent blocks into panels. The vertical directions should only be included when `assembly.getMode() == "vertical"`
- Add `UNMATCHED_MATERIAL_INDEX = 255` to Constants (used by Unit 4 for unmatched hidden hinges)

**Patterns to follow:**
- Bedrock `Constants.js` lines 168-507 for MATERIAL_INDEX groups 4-12
- Bedrock `Constants.js` lines 411-506 for GEOMETRY_INDEX and MATERIAL_GEOMETRY_CLASS
- Bedrock `MaterialRegistry.js` for all geometry-related functions

**Test scenarios:**
- Happy path: indexForTypeId("minecraft:oak_log") returns 64
- Happy path: indexForTypeId("minecraft:oak_fence") returns 80
- Happy path: indexForTypeId("minecraft:oak_slab") returns 128
- Happy path: indexForTypeId("minecraft:glass_pane") returns 144
- Happy path: geometryClassForMaterial(80) returns GEOMETRY_CLASS_FENCE
- Happy path: geometryClassForMaterial(92) returns GEOMETRY_CLASS_BARS
- Happy path: geometryClassForMaterial(128) returns GEOMETRY_CLASS_SLAB
- Happy path: geometryClassForMaterial(144) returns GEOMETRY_CLASS_PANE
- Happy path: geometryClassForMaterial(0) returns 0 (full block)
- Happy path: resolveGeometryId(80, true, true) returns 4 (fence_both)
- Happy path: resolveGeometryId(80, true, false) returns 2 (fence_before)
- Happy path: resolveGeometryId(80, false, true) returns 3 (fence_after)
- Happy path: resolveGeometryId(80, false, false) returns 1 (fence_solo)
- Happy path: resolveGeometryId(92, true, true) returns 5 (bars full)
- Happy path: resolveGeometryId(92, true, false) returns 10 (bars_before)
- Happy path: resolveGeometryId(128, true, true) returns slab geometry (slab class ignores neighbors — returns geoClass directly)
- Happy path: resolveGeometryId(128, false, false) returns slab geometry (same — no neighbor variants for slab)
- Edge case: resolveGeometryId(0, true, true) returns 0 (full block ignores neighbors)
- Happy path: isSlabGeometryId(6) returns true (bottom slab)
- Happy path: isSlabGeometryId(8) returns true (top slab)
- Happy path: isSlabGeometryId(0) returns false (full block)
- Edge case: indexForTypeId(null) returns -1
- Edge case: isSupportedMaterial("") returns false
- Edge case: MATERIAL_INDEX[205] is null (reserved slot)

**Verification:**
- `./gradlew test` passes all MaterialRegistry tests
- No Minecraft imports in Constants or MaterialRegistry

---

- [ ] **Unit 2: Add PanelRotation domain class**

**Goal:** Port PanelRotation.js to Java — computes rotation state values for panel blocks based on door configuration.

**Requirements:** P4

**Dependencies:** Unit 1 (geometry class constants)

**Files:**
- Create: `java-bigdoors/src/main/java/com/bigdoors/domain/PanelRotation.java`
- Test: `java-bigdoors/src/test/java/com/bigdoors/domain/PanelRotationTest.java`

**Approach:**
- Port `closedRotation(doorSide, facing, geoClass)` and `openRotation(mode, doorSide, facing, direction, geoClass)` as static methods
- Return int rotation values (0-7) matching Bedrock's `bigdoors:panel_rotation` range
- Exotic geometry classes (fence, slab, bars, pane) use different rotation indices than full blocks

**Patterns to follow:**
- Bedrock `PanelRotation.js` — direct port

**Test scenarios:**
- Happy path: closedRotation("east", "north", 0) returns 2 (full block, door on east)
- Happy path: closedRotation("south", "north", 0) returns 1
- Happy path: closedRotation("west", "north", 0) returns 0
- Happy path: closedRotation("north", "north", 0) returns 3
- Happy path: closedRotation("up", "north", GEOMETRY_CLASS_FENCE) returns 2 (vertical exotic)
- Happy path: closedRotation("up", "east", GEOMETRY_CLASS_FENCE) returns 1
- Happy path: openRotation("horizontal", "east", "north", "cw", 0) returns (2+3)%4 = 1
- Happy path: openRotation("horizontal", "east", "north", "ccw", 0) returns (2+1)%4 = 3
- Happy path: openRotation("vertical", "up", "north", "cw", 0) returns 1
- Happy path: openRotation("vertical", "up", "east", GEOMETRY_CLASS_FENCE) returns 5

**Verification:**
- All rotation values match Bedrock PanelRotation.js for equivalent inputs
- `./gradlew test` passes

---

- [ ] **Unit 3: Add getRotateFn to RotationMath**

**Goal:** Add mode-aware rotation function dispatcher matching Bedrock's `getRotateFn()`.

**Requirements:** P6

**Dependencies:** None (RotationMath already has all rotation functions)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/domain/RotationMath.java`
- Modify: `java-bigdoors/src/test/java/com/bigdoors/domain/RotationMathTest.java`

**Approach:**
- Add `BiFunction<BlockPos3, BlockPos3, BlockPos3> getRotateFn(String mode, String facing, String direction)` that returns the appropriate rotation function
- Vertical mode returns a lambda that captures facing in its closure: `(pos, hinge) -> RotationMath.rotateVerticalCW(pos, hinge, facing)`. The facing parameter is not passed through the BiFunction signature
- Horizontal mode returns `rotateCW` or `rotateCCW` method reference

**Patterns to follow:**
- Bedrock `RotationMath.js` `getRotateFn()`

**Test scenarios:**
- Happy path: getRotateFn("horizontal", "", "cw") produces same result as rotateCW
- Happy path: getRotateFn("horizontal", "", "ccw") produces same result as rotateCCW
- Happy path: getRotateFn("vertical", "north", "cw") produces same result as rotateVerticalCW with "north"
- Happy path: getRotateFn("vertical", "east", "ccw") produces same result as rotateVerticalCCW with "east"

**Verification:**
- `./gradlew test` passes

---

- [ ] **Unit 4: Expand DoorAssembly with hinge records, geometryId, boundary panels**

**Goal:** Bring DoorAssembly to full parity with the Bedrock version — structured hinge records, panel geometryId, and boundary panels.

**Requirements:** P8, P10

**Dependencies:** Unit 1 (Constants for UNMATCHED_MATERIAL_INDEX)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/domain/DoorAssembly.java`
- Modify: `java-bigdoors/src/test/java/com/bigdoors/domain/DoorAssemblyTest.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/HingeBlock.java` (update hinge position access)
- Modify: `java-bigdoors/src/main/java/com/bigdoors/subsystem/DoorMover.java` (update hinge iteration)
- Modify: `java-bigdoors/src/main/java/com/bigdoors/DoorManager.java` (update hinge iteration in load() and dissolveAssembly())
- Modify: `java-bigdoors/src/main/java/com/bigdoors/subsystem/RedstoneHandler.java` (update hinge iteration in executeCloseCheck())

**Approach:**
- Replace `List<BlockPos3> hingePositions` with `List<HingeRecord> hingePositions` where `HingeRecord` is a record `(BlockPos3 pos, String type, int materialIndex)`
- Add `getHingeBlockPositions()` convenience method returning `List<BlockPos3>` extracted from HingeRecords — callers that only need positions use this to minimize churn
- Expand `PanelEntry` record to include optional `geometryId` (Integer, nullable) and `overlay` (int, default 0). Overload `addPanel()`: keep existing `addPanel(BlockPos3 pos, int materialIndex)` signature with defaults (geometryId=null, overlay=0), and add `addPanel(BlockPos3 pos, int materialIndex, Integer geometryId, int overlay)` so existing callers remain valid until Unit 6/11 update them
- Add `List<PanelEntry> boundaryPanels` field
- Add methods: `addHingeRecord()`, `removeHinge()`, `removeBoundaryPanel()`, `getHingeType()`
- Update `toJson()`/`fromJson()` to serialize/deserialize all new fields (including boundaryPanels list)
- Update all callers that access `hingePositions` directly — use `getHingeBlockPositions()` or iterate `HingeRecord` list as appropriate. Known call sites: HingeBlock (panel detection), DoorMover (hinge position checks), DoorManager.load() (positionIndex rebuild), DoorManager.dissolveAssembly() (index cleanup), RedstoneHandler.executeCloseCheck() (power check). Grep for all `getHingePositions()` calls before closing this unit.
- **Boundary panel indexing:** `DoorManager.load()` must index boundaryPanels into positionIndex alongside regular panels so `findByPosition()` returns the assembly for boundary panel positions. `DoorManager.dissolveAssembly()` must clear boundary panel index entries from positionIndex (state cleanup only — no world block mutation; block removal is BreakHandler's responsibility).
- **fromJson detection mechanism:** For each element in the hingePositions JSON array, check if the element has a `"pos"` key. If yes, parse as HingeRecord (new format). If no, parse as plain BlockPos3 and wrap in HingeRecord with type="hinge" and materialIndex=UNMATCHED_MATERIAL_INDEX

**Patterns to follow:**
- Bedrock `DoorAssembly.js` — constructor, serialization, hinge/panel management

**Test scenarios:**
- Happy path: toJson/fromJson round-trip preserves hingeType, materialIndex, geometryId, boundaryPanels
- Happy path: addHingeRecord adds a hinge with type and materialIndex
- Happy path: removeHinge removes by position
- Happy path: addPanel with geometryId stores the value
- Happy path: getHingeType returns type of first hinge
- Happy path: getHingeBlockPositions returns positions extracted from HingeRecords
- **Backward compat: fromJson with old-format hinge positions (plain BlockPos3 array) deserializes as HingeRecords with type="hinge" and materialIndex=UNMATCHED_MATERIAL_INDEX**
- Edge case: fromJson with missing geometryId results in null
- Happy path: boundaryPanels serialized and deserialized correctly
- Happy path: addPanel with overlay value stores the overlay on PanelEntry
- Happy path: toJson/fromJson round-trip preserves overlay on panels and boundary panels

**Verification:**
- Existing DoorAssembly tests still pass
- Old-format JSON loads correctly (backward compatibility)
- New fields are persisted correctly
- `./gradlew test` passes

---

- [ ] **Unit 5: Add checkClose and mode-aware checkPath to ObstructionChecker**

**Goal:** Add close obstruction checking and update `checkPath` to support vertical mode.

**Requirements:** P6, P7

**Dependencies:** Unit 3 (getRotateFn)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/domain/ObstructionChecker.java`
- Modify: `java-bigdoors/src/test/java/com/bigdoors/domain/ObstructionCheckerTest.java`

**Approach:**
- Add `mode` and `facing` parameters to `checkPath()` — use `RotationMath.getRotateFn()` instead of hardcoded `rotateCW`/`rotateCCW`
- Add `checkClose(List<BlockPos3> closedPositions, Set<String> currentPositionKeys, Function<BlockPos3, String> blockQueryFn)` returning a `CloseCheckResult(boolean canClose, List<BlockPos3> softBlocks, List<BlockPos3> passableBlocks)`
- Maintain backward compatibility: keep existing `checkPath` overload that defaults to horizontal mode

**Patterns to follow:**
- Bedrock `ObstructionChecker.js` — `checkPath()` and `checkClose()`

**Test scenarios:**
- Happy path: checkPath in horizontal mode works identically to existing tests
- Happy path: checkPath in vertical/north mode rotates in Y/Z plane correctly
- Happy path: checkClose returns canClose=true when all closed positions are air
- Happy path: checkClose skips positions in the currentPositionSet (being vacated)
- Edge case: checkClose returns canClose=false when a closed position is solid
- Happy path: checkClose identifies soft and passable blocks in closed positions

**Verification:**
- All existing obstruction tests still pass
- `./gradlew test` passes

---

- [ ] **Unit 6: Expand DoorManager with merge, resplit, reset, hinge removal**

**Goal:** Add all missing assembly management operations to DoorManager.

**Requirements:** P8, P9, P10

**Dependencies:** Unit 4 (expanded DoorAssembly)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/DoorManager.java`
- Modify: `java-bigdoors/src/test/java/com/bigdoors/DoorManagerTest.java`

**Approach:**
- Port `mergeAssemblies(canonicalId, ...otherIds)` — absorb hinges, panels, boundary panels from other assemblies into canonical; update primaryHingePos; transfer partner relationships
- Port `resplitAssemblies(idA, idB)` — re-distribute panels and boundary panels between paired assemblies
- Port `resetAssembly(assemblyId)` — unpair, clear panels/boundary panels/doorSide/mode, reset hinge materialIndex
- Port `removeHingeFromAssembly(assemblyId, hingePos)` — remove hinge, check contiguity on the correct axis, dissolve if non-contiguous
- Port `setHingeMaterialIndex(assemblyId, materialIndex)` — set materialIndex on all hinges
- Port `setMode(assemblyId, mode)` — set assembly mode ("horizontal"/"vertical")
- Update `createAssembly(hingePos, facing, mode, hingeType)` to accept optional `hingeType` parameter (default "hinge") and store as HingeRecord
- Update `addHingeToAssembly(assemblyId, hingePos, hingeType, materialIndex)` to accept optional `hingeType` (default "hinge") and `materialIndex` (default UNMATCHED_MATERIAL_INDEX)
- Update existing `pairAndSplitAssemblies` (already implemented at DoorManager.java) to handle boundary panels — panels at the exact midpoint that the current implementation silently drops (condition `v < midpoint` / `v > midpoint` excludes `v == midpoint`) should be captured into the assembly's boundaryPanels list instead of being discarded
- Update `unpairAssembly` to reabsorb boundary panels back into regular panels and re-index them
- Update `addPanelToAssembly` to accept geometryId and overlay parameters
- **Boundary panel lifecycle:** `load()` must index boundaryPanels into positionIndex. `dissolveAssembly()` must clear boundary panel positionIndex entries (state cleanup only — DoorManager never mutates world blocks; see architectural note below). `findByPosition()` already works via positionIndex — no change needed once indexing is correct. Redstone checks in `RedstoneHandler.executeCloseCheck()` should skip boundary panels (they don't move).
- **Architectural constraint — DoorManager is world-agnostic:** DoorManager has no Level reference and must never perform world block mutations (setBlockAndUpdate, removeBlock, etc.). All world block removal during assembly dissolution is handled by BreakHandler, which calls `dissolveAssembly()` after it has already reverted blocks to vanilla. New code (merge, resplit, reset, removeHinge) must follow the same pattern: DoorManager handles state/index cleanup, and any world block changes are the caller's responsibility (BreakHandler or the subsystem performing the action)

**Patterns to follow:**
- Bedrock `DoorManager.js` — all listed methods

**Test scenarios:**
- Happy path: mergeAssemblies absorbs panels and hinges from second assembly into first
- Happy path: mergeAssemblies updates primaryHingePos to lowest hinge
- Happy path: mergeAssemblies transfers partner relationship from absorbed assembly
- Happy path: removeHingeFromAssembly with remaining contiguous hinges keeps assembly
- Happy path: removeHingeFromAssembly creating non-contiguous hinges returns dissolve_required
- Happy path: removeHingeFromAssembly removing last hinge returns dissolve_required
- Happy path: resetAssembly clears panels, doorSide, mode, unpairs partner
- Happy path: setHingeMaterialIndex updates all hinges in assembly
- Happy path: pairAndSplitAssemblies creates boundary panels from center/edge panels
- Happy path: unpairAssembly reabsorbs boundary panels back into regular panels
- Happy path: resplitAssemblies redistributes all panels including boundary panels
- Happy path: createAssembly with hingeType="hidden" stores HingeRecord with type="hidden"
- Happy path: addHingeToAssembly with hingeType and materialIndex stores correct HingeRecord
- Happy path: setMode changes assembly mode from "horizontal" to "vertical"
- Happy path: setDoorSide sets assembly doorSide direction
- Happy path: load() indexes boundary panels into positionIndex so findByPosition works for them
- Happy path: dissolveAssembly clears boundary panel index entries from positionIndex (no world block mutation)
- Happy path: unpairAssembly reabsorbs boundary panels and re-indexes their positions

**Verification:**
- `./gradlew test` passes all DoorManager tests

---

### Phase 2: Block Layer

- [ ] **Unit 7: Migrate DoorPanelBlock to material_group/material_id and register exotic panel blocks**

**Goal:** Replace `MATERIAL_INDEX` (0-63) with `MATERIAL_GROUP` (0-12) + `MATERIAL_ID` (0-15) on DoorPanelBlock. Add DoorPanelFenceBlock, DoorPanelBarsBlock, DoorPanelPaneBlock, DoorPanelSlabBlock with correct collision shapes and block states.

**Requirements:** P1, P3, P4

**Dependencies:** Unit 1 (geometry classes, materialGroupForIndex/materialIdForIndex), Unit 2 (PanelRotation)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelBlock.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelFenceBlock.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelBarsBlock.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelPaneBlock.java`
- Create: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelSlabBlock.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/ModBlocks.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/handler/BreakHandler.java` — replace `oldState.getValue(DoorPanelBlock.MATERIAL_INDEX)` with `MaterialRegistry.flatIndexFromGroupAndId(oldState.getValue(DoorPanelBlock.MATERIAL_GROUP), oldState.getValue(DoorPanelBlock.MATERIAL_ID))` to reconstruct the flat index for item drops

**Approach:**
- Replace `MATERIAL_INDEX` IntegerProperty (0-63) with `MATERIAL_GROUP` IntegerProperty (0-12) and `MATERIAL_ID` IntegerProperty (0-15) on DoorPanelBlock. This matches Bedrock's `bigdoors:material_group` + `bigdoors:material_id` split for cross-edition parity (see Key Technical Decisions for rationale)
- Add `PANEL_ROTATION` IntegerProperty (0-7) to base DoorPanelBlock
- Add `OVERLAY` IntegerProperty (0-1) to base DoorPanelBlock. Value 1 = show strap/hinge overlay texture; value 0 = no overlay. Regular hinge assemblies set overlay=1, hidden hinge assemblies set overlay=0
- Each exotic block MUST extend DoorPanelBlock so that existing `instanceof DoorPanelBlock` checks in BreakHandler, DoorMover, and HingeBlock continue to work without modification. Collision shape overrides via `getShape()` or `getCollisionShape()`
- Fence panels: narrow post shape like vanilla fences
- Bars panels: thin grid shape like vanilla iron bars
- Pane panels: thin flat shape like vanilla glass panes
- Slab panels: half-height shape like vanilla slabs
- Add `GEOMETRY_VARIANT` IntegerProperty to exotic blocks for solo/before/after/both neighbor variants
- Collision shapes (VoxelShape) do NOT auto-rotate with PANEL_ROTATION — each exotic block must compute rotated VoxelShapes for each rotation value. Pre-compute rotated shapes in a static array indexed by rotation
- Register all 4 new blocks in ModBlocks alongside existing door_panel
- Add `ModBlocks.panelBlockForGeoClass(int geoClass)` helper returning the correct Block instance
- Add all to creative inventory
- **Breaking change note:** Existing Java worlds with placed door panels will lose those blocks due to the property rename. This is acceptable given the small Java user base. Document in release notes.

**Patterns to follow:**
- Existing `DoorPanelBlock.java` for block state and interaction patterns
- Vanilla `FenceBlock`, `IronBarsBlock`, `PaneBlock`, `SlabBlock` for collision shapes
- Bedrock block state names: `bigdoors:material_group`, `bigdoors:material_id`

**Test scenarios:**
Test expectation: none — block registration is declarative. Verified by loading the mod in-game.

**Verification:**
- `./gradlew build` succeeds
- All 5 panel block types appear in creative inventory
- Each exotic block has correct collision shape in-game
- Block states include MATERIAL_GROUP, MATERIAL_ID, PANEL_ROTATION, OVERLAY, and where applicable GEOMETRY_VARIANT

---

- [ ] **Unit 8: Register HiddenHingeBlock**

**Goal:** Add hidden hinge block that renders as the matched panel material instead of showing a visible hinge texture.

**Requirements:** P5

**Dependencies:** Unit 4 (hinge type tracking), Unit 7 (panel blocks exist)

**Files:**
- Create: `java-bigdoors/src/main/java/com/bigdoors/block/HiddenHingeBlock.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/ModBlocks.java`

**Approach:**
- `HiddenHingeBlock extends HingeBlock` — same behavior, different block ID and model
- Adds `MATERIAL_GROUP` and `MATERIAL_ID` IntegerProperties (matching DoorPanelBlock) so it can display the matched panel's texture. **Unmatched state:** UNMATCHED_MATERIAL_INDEX (255) is a domain-only constant — it cannot be stored as a block state value (255 doesn't fit in group 0-12 + id 0-15). On placement, initialize MATERIAL_GROUP=0, MATERIAL_ID=0 as a placeholder. Update to actual material when the first panel converts. Use a boolean `MATCHED` block state property to distinguish matched vs. unmatched rendering (unmatched hinge uses a dedicated "unmatched hinge" model/texture).
- `setPlacedBy` creates assembly with `hingeType = "hidden"`
- Blockstate JSON maps `facing` × `matched` × `material_group` × `material_id` to models. When `matched=false`, always uses the unmatched hinge model regardless of group/id values
- Add to creative inventory alongside regular hinge

**Patterns to follow:**
- Bedrock `hidden_hinge.json` block definition
- Existing `HingeBlock.java` for all behavior

**Test scenarios:**
Test expectation: none — block registration and rendering. Verified in-game.

**Verification:**
- `./gradlew build` succeeds
- Hidden hinge appears in creative inventory
- Hidden hinge creates assembly with hingeType="hidden"
- Hidden hinge renders as matching material texture when matched

---

- [ ] **Unit 9: Blockstate JSON and models for all blocks**

**Goal:** Create blockstate definitions and models for all exotic panel variants, hidden hinge material variants, and panel rotation states.

**Requirements:** P1, P2, P3, P4, P5

**Dependencies:** Unit 7 (exotic blocks registered), Unit 8 (hidden hinge registered)

**Files:**
- Create: `tools/generate-blockstates.mjs` (data generator — required, not optional)
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/blockstates/door_panel_fence.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/blockstates/door_panel_bars.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/blockstates/door_panel_pane.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/blockstates/door_panel_slab.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/blockstates/hidden_hinge.json`
- Modify: `java-bigdoors/src/main/resources/assets/bigdoors/blockstates/door_panel.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/models/block/` (exotic variant models)
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/models/item/door_panel_fence.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/models/item/door_panel_bars.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/models/item/door_panel_pane.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/models/item/door_panel_slab.json`
- Create: `java-bigdoors/src/main/resources/assets/bigdoors/models/item/hidden_hinge.json`
- Modify: `java-bigdoors/src/main/resources/assets/bigdoors/lang/en_us.json`

**Approach:**
- Update existing door_panel blockstate to use `material_group` + `material_id` + `panel_rotation` + `overlay` in variant keys, mapping to y-rotation in model references. Overlay=1 models use the overlay texture layers from `bigdoors_rp/textures/blocks/door_panel_overlay_h.png` and `door_panel_overlay_v.png`
- Each exotic panel blockstate maps `material_group` × `material_id` × `panel_rotation` × `overlay` × `geometry_variant` to a model
- Hidden hinge blockstate maps `facing` × `mode` × `powered` × `matched` × `material_group` × `material_id` to models. HiddenHingeBlock inherits FACING, MODE, POWERED from HingeBlock and adds MATCHED, MATERIAL_GROUP, MATERIAL_ID. When `matched=false`, all group/id combinations use the unmatched hinge model. When `matched=true`, the model is selected by group/id. MODE and POWERED states must be present even though they don't affect the model — omitting them causes missing-variant errors for legal block states
- Model files reference vanilla textures by material group+id

**Requirement:** A data generator script (`tools/generate-blockstates.mjs`) is required. The combinatorial size (13 groups × 16 ids × 8 rotations × 2 overlay × up to 4 geometry variants) makes hand-writing infeasible. The generator reads MATERIAL_INDEX from Constants and produces all blockstate and model JSON files. **Null material handling (indices 205-207):** MATERIAL_INDEX entries 205-207 are null (reserved slots in group 12). The generator must still emit blockstate variants for group=12, id=13/14/15 since Java requires all legal property combinations to map to a model. Use a dedicated `bigdoors:missing_material` fallback model (magenta/black checkerboard texture, the Minecraft convention for missing textures) for these variants. This prevents missing-model warnings without implying the materials are real.

**Patterns to follow:**
- Existing `door_panel.json` blockstate structure
- Vanilla blockstate JSON patterns for rotation (`y: 90`, `y: 180`, etc.)

**Test scenarios:**
Test expectation: none — asset files. Verified visually in-game.

**Verification:**
- `./gradlew build` succeeds without missing model warnings
- All panel types render correct textures for their material index
- Panel rotation visually rotates the block model
- Hidden hinge displays correct material texture

---

### Phase 3: Logic Integration

- [ ] **Unit 10: DoorMover overhaul — mode-aware rotation, close checks, geometry-aware block type selection**

**Goal:** Make DoorMover fully parity-complete: mode-aware rotation via getRotateFn, close obstruction checking, and geometry-aware panel block type selection during open/close movement. Currently DoorMover hardcodes `ModBlocks.DOOR_PANEL_BLOCK` — this must select the correct block type per panel.

**Requirements:** P2, P3, P4, P6, P7

**Dependencies:** Unit 1 (geometry classes), Unit 2 (PanelRotation), Unit 3 (getRotateFn), Unit 5 (checkClose), Unit 7 (exotic blocks + panelBlockForGeoClass)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/subsystem/DoorMover.java`

**Approach:**
- Replace all hardcoded `rotateCW`/`rotateCCW` calls with `RotationMath.getRotateFn(assembly.getMode(), assembly.getFacing(), direction)`
- Pass mode and facing to `ObstructionChecker.checkPath()`
- Add close obstruction check in `closeAssembly()` — call `ObstructionChecker.checkClose()` before moving blocks; abort if obstructed
- Update `preferredDirection()` and `preferredDirectionFromSource()` to use 3D Manhattan distance: `abs(dest.x - ref.x) + abs(dest.y - ref.y) + abs(dest.z - ref.z)`. Current code omits Y, which causes vertical doors to default to arbitrary direction when the player is at the same XZ as the door
- **Critical fix:** Replace hardcoded `ModBlocks.DOOR_PANEL_BLOCK` in `attemptOpen()` and `closeAssembly()` with `ModBlocks.panelBlockForGeoClass(geometryClassForMaterial(panel.materialIndex))` to select correct block type per panel
- During open: compute `openRotation()` for each panel, set PANEL_ROTATION state, set correct block type
- During close: compute `closedRotation()` for each panel, restore correct block type with closed rotation
- Set GEOMETRY_VARIANT state for exotic panels based on neighbor context at each position. **Exception for slabs:** Slab panels must restore their GEOMETRY_VARIANT from `PanelEntry.geometryId` (6=bottom, 8=top), not from neighbor resolution. Slabs have no neighbor-dependent variants — their top/bottom identity is set at placement time and stored on the PanelEntry. Use `MaterialRegistry.isSlabGeometryId()` to branch: if slab, read from PanelEntry; otherwise resolve from neighbors
- **Boundary panels:** DoorMover must skip boundary panels during open/close movement — they stay in place. Only iterate `assembly.getPanelPositions()`, not `assembly.getBoundaryPanels()`
- **Overlay state:** Set OVERLAY block state on each panel during open/close using the panel's stored overlay value

**Patterns to follow:**
- Bedrock `InteractionHandler.js` `_attemptOpen()`, `_close()`, `_resolveGeoForPanel()`
- Bedrock `RedstoneSubsystem.js` `_openSingleAssembly()` and `_closeSingleAssembly()`

**Test scenarios:**
- Happy path: horizontal mode open still works identically
- Happy path: vertical mode open uses vertical rotation functions
- Happy path: close checks for obstructions before closing and aborts if blocked
- Happy path: close destroys soft blocks and passable blocks in closed positions
- Edge case: close with solid block in closed position does not close the door
- Happy path: opening a fence door sets correct panel_rotation on fence blocks
- Happy path: opening a mixed-material door places correct block type per panel
- Happy path: closing restores correct closedRotation values and block types
- Happy path: slab panels restore GEOMETRY_VARIANT from PanelEntry.geometryId (top/bottom), not neighbor resolution
- Happy path: preferredDirection for vertical door returns correct direction based on Y distance from player
- Happy path: boundary panels are not moved during open/close
- Happy path: overlay block state is set on panels during open/close

**Verification:**
- All existing door movement works unchanged
- Vertical doors open/close correctly
- Exotic doors open/close with correct block types
- `./gradlew test` passes

---

- [ ] **Unit 11: Geometry-aware panel placement**

**Goal:** Panel placement (vanilla block → panel conversion) selects the correct panel block type, sets geometry/rotation states, and auto-detects vertical mode from the first panel's direction relative to the hinge.

**Requirements:** P2, P3, P4, P6

**Dependencies:** Unit 1, Unit 2, Unit 6 (setMode/setDoorSide), Unit 7 (exotic blocks)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/HingeBlock.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelFenceBlock.java` (neighborUpdate)
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelBarsBlock.java` (neighborUpdate)
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelPaneBlock.java` (neighborUpdate)
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/DoorPanelSlabBlock.java` (neighborUpdate)

**Approach:**
- In HingeBlock panel detection: use `MaterialRegistry.geometryClassForMaterial()` to select the correct panel block type via `ModBlocks.panelBlockForGeoClass()`
- **Vertical mode auto-detection:** When the first panel is placed (assembly has no doorSide yet), determine direction from hinge to panel. If the direction is up/down, call `manager.setMode(assemblyId, "vertical")`; otherwise `"horizontal"`. Call `manager.setDoorSide(assemblyId, direction)`. This matches Bedrock's `PanelPlacementHandler.js` lines 138-140. Subsequent panels enforce mode consistency: vertical assemblies reject horizontal panel directions and vice versa
- **Overlay assignment:** Set overlay=1 for regular hinge assemblies, overlay=0 for hidden hinge assemblies (matching Bedrock `PanelPlacementHandler.js` line 211)
- During panel placement: resolve geometry variant based on neighbor context, compute closedRotation, set PANEL_ROTATION, OVERLAY, and GEOMETRY_VARIANT states
- Store geometryId on PanelEntry for slabs (top/bottom detection at placement time)
- Exotic panel neighborUpdate (in each exotic subclass, not base DoorPanelBlock): update GEOMETRY_VARIANT when adjacent panels change
- Update `HingeBlock.setPlacedBy()` to pass "horizontal" as initial mode (unchanged default), but the mode is overridden when the first panel is placed. Remove hardcoded "horizontal" from `getStateForPlacement()` — the MODE block state should start as HORIZONTAL and update when the first panel triggers mode detection

**Patterns to follow:**
- Bedrock `PanelPlacementHandler.js` for material → block type selection
- Bedrock `InteractionHandler.js` `_resolveGeoForPanel()`

**Test scenarios:**
- Happy path: placing oak_fence next to hinge creates a door_panel_fence block
- Happy path: placing iron_bars creates door_panel_bars
- Happy path: placing glass_pane creates door_panel_pane
- Happy path: placing oak_slab creates door_panel_slab
- Happy path: placing cobblestone creates regular door_panel
- Happy path: placing first panel above hinge sets mode="vertical" and doorSide="up"
- Happy path: placing first panel to the east of hinge sets mode="horizontal" and doorSide="east"
- Edge case: placing a horizontal panel on a vertical-mode assembly is rejected
- Edge case: placing a vertical panel on a horizontal-mode assembly is rejected
- Happy path: panels on regular hinge assembly get overlay=1
- Happy path: panels on hidden hinge assembly get overlay=0
- Integration: geometry variant updates when neighboring panels change
- Edge case: placing a supported block above a horizontal door panel does NOT convert it to a panel (DIR_OFFSETS guard)

**Verification:**
- Exotic materials place as correct block types in-game
- Vertical mode auto-detects from first panel placement direction
- `./gradlew test` passes

---

- [ ] **Unit 12: Hidden hinge behavior integration**

**Goal:** Wire hidden hinge into assembly creation, break handling, and panel material matching.

**Requirements:** P5, P10

**Dependencies:** Unit 4 (hinge records), Unit 6 (setHingeMaterialIndex), Unit 8 (HiddenHingeBlock)

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/block/HiddenHingeBlock.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/handler/BreakHandler.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/DoorManager.java`

**Approach:**
- HiddenHingeBlock.setPlacedBy: pass `hingeType = "hidden"` to createAssembly (using the updated API signature from Unit 6)
- When first panel is added to an assembly with hidden hinges: call `setHingeMaterialIndex()` to match the panel material; update the hidden hinge block state's MATERIAL_GROUP and MATERIAL_ID in-world. Panels on hidden hinge assemblies get overlay=0 (no strap texture)
- BreakHandler: when breaking a hidden hinge, drop the original material item if matched, otherwise drop the hinge item. Note: BreakHandler already uses `instanceof DoorPanelBlock` which covers all exotic types (per Unit 7 requirement). Hidden hinge needs its own `instanceof HiddenHingeBlock` check for the material drop logic. BreakHandler must also handle boundary panel breaks — remove from the assembly's boundaryPanels list and update positionIndex. Additionally, BreakHandler.handleHingeBreak must revert boundary panel blocks to vanilla at their closed positions (alongside regular panels) before calling dissolveAssembly, since DoorManager is world-agnostic and never mutates blocks.
- HiddenHingeBlock neighborUpdate: same panel detection as HingeBlock

**Patterns to follow:**
- Bedrock `HingePlacementHandler.js` for hidden hinge creation
- Bedrock `BreakHandler.js` for hidden hinge break behavior

**Test scenarios:**
- Happy path: placing hidden hinge creates assembly with hingeType="hidden"
- Happy path: first panel conversion sets hinge material index
- Happy path: hidden hinge renders as matching material after panel conversion
- Happy path: breaking hidden hinge with matched material drops that material
- Edge case: breaking unmatched hidden hinge drops hinge item

**Verification:**
- Hidden hinges function identically to regular hinges with visual difference
- In-game hidden hinge texture matches first panel material

---

### Phase 4: Integration and Parity Verification

> **Note:** The ropes system (formerly Phase 4, Units 13-17) has been extracted to a separate plan. The ropes system is entirely independent of doors — no shared domain, blocks, or handlers. See Scope Boundaries.

- [ ] **Unit 13: Wire all new features into mod initialization and update parity checklist**

**Goal:** Ensure all new blocks, handlers, and subsystems are properly registered and the parity checklist reflects current status.

**Requirements:** P11

**Dependencies:** All previous units

**Files:**
- Modify: `java-bigdoors/src/main/java/com/bigdoors/BigdoorsMod.java`
- Modify: `java-bigdoors/src/main/java/com/bigdoors/client/BigdoorsModClient.java`
- Modify: `java-bigdoors/src/main/resources/fabric.mod.json`
- Modify: `docs/parity-checklist.md`

**Approach:**
- Verify initialization order: ModBlocks (including new exotic + hidden hinge blocks) → event listeners → lifecycle hooks
- Update fabric.mod.json description and version
- Fill in parity checklist with complete feature-by-feature Bedrock vs Java status (noting ropes as deferred — overlay is in scope and should be marked complete)
- Run full test suite and in-game verification

**Patterns to follow:**
- Existing `BigdoorsMod.onInitialize()` structure
- Bedrock `main.js` initialization order

**Test scenarios:**
- Integration: mod loads without errors on fresh world
- Integration: all 5 panel types can be placed and function as door panels
- Integration: hidden hinge creates assembly and matches panel material
- Integration: vertical door opens and closes correctly
- Integration: close obstruction check prevents closing into solid blocks
- Integration: double-door boundary panels work correctly
- Happy path: all existing unit tests pass unchanged

**Verification:**
- `./gradlew test` passes all tests (domain + integration)
- `./gradlew build` produces working mod JAR
- Parity checklist updated with current door parity status
- In-game: all door features work on Java edition

## System-Wide Impact

- **Interaction graph:** New block types (4 exotic panels + hidden hinge) all funnel through the same DoorManager → DoorMover → PersistentState pipeline.
- **Error propagation:** All new blocks follow the same null-check pattern: `BigdoorsMod.getManager()` may return null before server start.
- **State lifecycle risks:** DoorPanelBlock property rename (material_index → material_group + material_id) is a breaking change for existing placed blocks. DoorAssembly JSON changes (HingeRecord, geometryId, boundaryPanels) are backward-compatible — old-format JSON deserializes with defaults. See Unit 4 for migration tests.
- **API surface parity:** After completion, Java and Bedrock support identical door features with platform-appropriate implementations. Redstone source tracking remains the one acceptable behavioral difference. Ropes are deferred to a separate plan.
- **Integration coverage:** Unit tests verify domain logic. In-game testing verifies block placement, door movement, rotation, and persistence. The combinatorial space of 208 materials × 5 block types × 8 rotations is large — visual spot-checking by material group is sufficient.
- **Unchanged invariants:** No vanilla block behavior modified. No mixins. Only Fabric events used.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Blockstate JSON combinatorial size (13 groups × 16 ids × 8 rotations × 2 overlay × up to 4 geometry variants) | Required data generator script produces blockstates and models programmatically (Unit 9) |
| material_group + material_id property rename breaks existing Java worlds | Acceptable given small Java user base. Document in release notes. |
| DoorAssembly JSON backward compatibility (HingeRecord format) | Old-format JSON auto-migrates with defaults. Explicit backward compat test in Unit 4. |
| Vertical mode edge cases not tested in current Java codebase | Vertical rotation math already exists and passes tests. Pipeline integration is the risk — test in-game early |
| VoxelShape rotation for exotic panels | Pre-compute rotated shapes per rotation value in static arrays. Verify collision in-game. |
| Hidden hinge texture updates on panel conversion | Use `level.setBlockAndUpdate()` with new MATERIAL_GROUP/MATERIAL_ID state — triggers client-side model update |

## Phased Delivery

### Phase 1 (Units 1-6): Domain Foundation
All domain changes, no new blocks. Existing Java mod continues working. Domain tests verify parity.

### Phase 2 (Units 7-9): Block Layer
DoorPanelBlock migrated to material_group/material_id. New exotic blocks registered with models. Creative inventory expanded.

### Phase 3 (Units 10-12): Logic Integration
Full door feature parity. Vertical mode, exotic geometry, hidden hinges, close checks all functional.

### Phase 4 (Unit 13): Integration Verification
Final wiring, testing, and parity checklist update. Ropes system planned separately.

## Sources & References

- **Origin document:** [docs/plans/2026-05-15-001-feat-java-fabric-port-plan.md](docs/plans/2026-05-15-001-feat-java-fabric-port-plan.md)
- **Bedrock implementation:** `bigdoors_bp/scripts/` (domain, handler, subsystem layers)
- **Bedrock test suite:** `tests/*.test.mjs`
- **Java implementation:** `java-bigdoors/src/main/java/com/bigdoors/`
- **Java test suite:** `java-bigdoors/src/test/java/com/bigdoors/`
- Related plans: `docs/plans/2026-05-18-003-refactor-split-exotic-geometry-blocks-plan.md`, `docs/plans/2026-05-17-003-feat-close-obstruction-check-plan.md`, `docs/plans/2026-05-18-002-feat-ropes-rope-ladders-whips-plan.md`
