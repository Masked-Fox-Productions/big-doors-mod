# Cross-Platform Parity Checklist

Tracks feature parity between Bedrock and Java implementations.

## Core Door Mechanics

| Feature | Bedrock | Java | Notes |
|---|---|---|---|
| Hinge placement + assembly creation | Yes | Yes | |
| Panel detection + conversion | Yes | Yes | |
| Open / close (click interaction) | Yes | Yes | |
| Redstone open / close | Yes | Yes | |
| Double-door pairing + split | Yes | Yes | |
| Entity sweep on open | Yes | Yes | |
| Break handling (panel + hinge) | Yes | Yes | |
| Persistence (save / load) | Yes | Yes | |

## Materials & Geometry

| Feature | Bedrock | Java | Notes |
|---|---|---|---|
| Materials groups 0-3 (indices 0-63) | Yes | Yes | |
| Materials groups 4-12 (indices 64-207) | Yes | Yes | 208 total entries, 3 null slots (205-207) |
| Geometry class: full block (0) | Yes | Yes | DoorPanelBlock |
| Geometry class: fence (1) | Yes | Yes | DoorPanelFenceBlock |
| Geometry class: bars (5) | Yes | Yes | DoorPanelBarsBlock |
| Geometry class: slab (6) | Yes | Yes | DoorPanelSlabBlock |
| Geometry class: pane (7) | Yes | Yes | DoorPanelPaneBlock |
| Geometry variant blockstate | Yes | Yes | GEOMETRY_VARIANT property on exotic blocks |
| Material group/id split blockstate | Yes | Yes | MATERIAL_GROUP (0-12) + MATERIAL_ID (0-15) |

## Panel States & Rotation

| Feature | Bedrock | Java | Notes |
|---|---|---|---|
| Panel rotation (0-7) | Yes | Yes | PanelRotation domain class |
| Overlay blockstate (0-1) | Yes | Yes | Hinge strap overlay |
| Horizontal open/close rotation | Yes | Yes | |
| Vertical open/close rotation | Yes | Yes | |

## Door Modes

| Feature | Bedrock | Java | Notes |
|---|---|---|---|
| Horizontal mode | Yes | Yes | |
| Vertical mode (up/down placement) | Yes | Yes | Auto-detected from hinge placement direction |

## Hinges

| Feature | Bedrock | Java | Notes |
|---|---|---|---|
| Standard hinge block | Yes | Yes | HingeBlock |
| Hidden hinge block | Yes | Yes | HiddenHingeBlock extends HingeBlock |
| Hinge material tracking | Yes | Yes | setHingeMaterialIndex, updateHingeBlockStates |
| Hidden hinge material matching | Yes | Yes | MATCHED blockstate + material group/id |
| Hidden hinge break drops | Yes | Yes | Drops matched vanilla material or hinge item |

## Assembly Operations

| Feature | Bedrock | Java | Notes |
|---|---|---|---|
| Assembly merge | Yes | Yes | mergeAssemblies |
| Assembly resplit | Yes | Yes | resplitAssemblies |
| Assembly reset | Yes | Yes | resetAssembly |
| Hinge removal (contiguity check) | Yes | Yes | removeHingeFromAssembly |
| Boundary panels (double-door center) | Yes | Yes | |

## Obstruction Checking

| Feature | Bedrock | Java | Notes |
|---|---|---|---|
| Open obstruction check | Yes | Yes | Mode-aware path checking |
| Close obstruction check | Yes | Yes | checkClose with soft/passable blocks |

## Blockstate & Model Generation

| Feature | Bedrock | Java | Notes |
|---|---|---|---|
| Door panel blockstates + models | N/A (JSON defs) | Yes | Generated via tools/generate-blockstates.mjs |
| Exotic panel blockstates + models | N/A (JSON defs) | Yes | Fence, bars, pane, slab variants |
| Hidden hinge blockstates + models | N/A (JSON defs) | Yes | Matched + unmatched states |

## Deferred Features

| Feature | Bedrock | Java | Notes |
|---|---|---|---|
| Ropes | Yes | No | Separate plan: docs/plans/2026-05-18-002-feat-ropes-rope-ladders-whips-plan.md |
| Rope ladders | Yes | No | Separate plan |
| Whips | Yes | No | Separate plan |

## Platform Differences (Acceptable)

| Difference | Bedrock | Java | Rationale |
|---|---|---|---|
| Redstone source tracking | Polling monitors | Scheduled close via neighborChanged | Platform API difference — both achieve same gameplay result |
| Block definitions | JSON + Script API | Fabric block classes | Platform-native approach |
| Blockstate generation | N/A (JSON defs) | Node.js generator script | Java edition requires explicit blockstate/model JSON |
