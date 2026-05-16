---
date: 2026-05-14
topic: big-doors-mod
---

# Big Doors Mod

## Problem Frame

Minecraft's vanilla doors are limited to 1x2 blocks. Players building castles, fortresses, and other large structures have no way to create dramatic multi-block gates, drawbridges, or portcullises that actually open and close. The Big Doors mod provides a Hinge block that lets players build arbitrarily large doors from any block type, with realistic rotation physics and obstruction detection.

This is a standalone mod (separate repo from Settlements) that works independently but integrates with the Settlements defense scanner when both are installed — closed doors count as walls, open doors count as breaches.

## User Flow

```
Place Hinge block
       |
       v
Place block adjacent to hinge ──> Vanilla block replaced with
       |                           custom bigdoors: variant
       v                           (first block sets door side)
Continue extending with same type
       |
       v
  Click door block or hinge
       |
       v
  Obstruction check ──> Blocked? ──> Try other direction
       |                                    |
       v                              Also blocked? ──> No movement
  Rotate 90° away from player
  (snap to nearest grid position)
  Sweep entities out of arc
       |
       v
  Click again ──> Close (reverse rotation)
```

## Requirements

**Hinge Block**
- R1. A custom `bigdoors:hinge` block that can be placed on any solid surface
- R2. Hinge supports two rotation modes: horizontal (normal door) and vertical (trapdoor/drawbridge). Mode is determined by placement surface — floor/ceiling placement = vertical hinge, wall placement = horizontal hinge
- R3. Hinge has a placeholder texture when no door blocks are attached
- R4. When door blocks are attached, the hinge texture optionally changes to match the door material. This is a configurable setting (on/off)

**Door Assembly**
- R5. When a block is placed adjacent to a hinge, the hinge auto-detects which side the new block is on. The first block placed sets the door's orientation (which side swings)
- R6. When a vanilla block is placed adjacent to a hinge on the door side, it is replaced with a custom `bigdoors:` variant that looks identical but supports interaction events. When broken, the custom variant drops the original vanilla block
- R7. Contiguous custom door blocks of the same material extending from the hinge's door side are considered part of the door
- R8. A block of a different type (or a non-door block) terminates the door — it is not part of the door and does not move
- R9. No maximum door width — any number of same-type blocks can extend from a hinge
- R10. When hinges are stacked vertically at the same X/Z position, they form a single door assembly. All stacked hinges and their attached blocks move together as one unit

**Double Doors**
- R11. When two hinges face each other with same-type blocks between them, they form a double door
- R12. Blocks between double-door hinges are divided evenly — each hinge owns the blocks on its side
- R13. With an odd number of blocks between hinges, the center block stays fixed (does not move with either side)
- R14. Vertically stacked hinges facing another stack of hinges merge into a single tall double-door assembly — all blocks on each side move together

**Opening and Closing**
- R15. Player interaction (click) on any door block or hinge toggles the door open/closed
- R16. When opening, the door rotates 90 degrees away from the player's position. Each block's rotated position is rounded to the nearest grid position (blocks snap like vanilla doors)
- R17. Clicking an open door closes it (reverses the rotation back to original position)
- R18. Default rotation direction is clockwise when viewed from above (used for redstone and when player position is ambiguous)
- R19. Entities (players, mobs) in the door's sweep arc are pushed out of the way during rotation

**Obstruction Detection**
- R20. Before opening, check all destination positions for the rotated blocks
- R21. Soft/replaceable blocks (grass, flowers, snow layers) are destroyed and replaced by the door
- R22. Passable blocks (signs, torches, vanilla doors) are destroyed by the door but drop their items
- R23. Solid blocks prevent opening in that direction
- R24. If opening direction is blocked, try the opposite direction. If both are blocked, the door does not move
- R25. Players can place solid "frame" blocks behind the hinge to restrict opening to one direction only (e.g., castle doors that only open outward)

**Persistence**
- R26. Door assemblies (hinge orientation, attached blocks, open/closed state) must persist across world save and reload
- R27. An open door must remain open after world reload with its assembly intact

**Disassembly**
- R28. Breaking a door block removes it from the assembly; the remaining blocks continue to function as a smaller door
- R29. Breaking a hinge auto-closes the door first (blocks snap back to original positions), then the assembly dissolves — attached blocks revert to normal vanilla blocks

**Redstone**
- R30. Hinge blocks respond to redstone power — powered = open, unpowered = closed
- R31. Redstone-triggered opening uses the default rotation direction (clockwise from above), subject to obstruction rules and frame-block restrictions
- R32. For double doors, redstone signal to either hinge opens/closes both sides

**Integration with Settlements (when both installed)**
- R33. Closed doors register as solid wall segments for the defense scanner
- R34. Open doors register as breaches/gaps for the defense scanner
- R35. Integration is optional — Big Doors works fully standalone

## Success Criteria

- A player can build a 5-wide, 3-tall castle gate from cobblestone that swings open and closed on interaction
- Double doors open symmetrically outward when clicked
- Frame blocks successfully restrict door direction
- Redstone can remotely open/close doors
- Doors refuse to open into solid obstructions
- A door left open survives world save/reload with correct state
- Breaking a hinge snaps the door closed before dissolving the assembly

## Scope Boundaries

- No animated swing (blocks teleport to open/closed position) — animation is a future enhancement
- No locking mechanism (lock with redstone or key) — future enhancement
- No sound effects beyond vanilla block placement sounds — future enhancement
- No portcullis mode (vertical sliding) in Phase 1 — this is a future extension of vertical hinges
- Configurable "door breaks solid blocks" is a deferred nice-to-have, not Phase 1

## Key Decisions

- **Auto-detect orientation:** Hinge door-side is set by the first block placed adjacent, not by player-facing direction. Simpler and more intuitive — players just build naturally
- **Custom door block variants:** Vanilla blocks placed as door panels are silently replaced with `bigdoors:` custom variants. This enables click interaction on door blocks and clean disassembly (dropping vanilla blocks when broken). The visual appearance matches the original block
- **Grid-snapped rotation:** Rotated block positions are rounded to the nearest grid position. Wide doors produce a diagonal/staircase pattern when open — this is acceptable and consistent with how other block-moving mods work
- **Entity sweep:** Entities in the rotation arc are pushed out of the way, not treated as obstructions
- **Three-tier obstruction:** Soft blocks (destroyed silently), passable blocks (destroyed with item drops), solid blocks (prevent movement)
- **Toggle behavior:** Any click on an open door closes it. No 180-degree rotation or multi-step opening
- **Odd double-door split:** Center block stays fixed, creating a natural center post
- **Hinge break closes first:** Breaking a hinge snaps the door closed, then dissolves the assembly
- **Full merge for tall double doors:** Vertically stacked hinges facing another stack merge into one assembly
- **Redstone default direction:** Clockwise from above. Frame blocks control direction
- **Standalone mod:** Separate repo and pack from Settlements. Integration via optional API/block-type detection, not tight coupling

## Dependencies / Assumptions

- Template repo (`minecraft-mod-template`) provides the project scaffold for both Bedrock and Java editions
- Settlements defense scanner (Phase 3) must support modded block types — not a blocker for Big Doors development, but the scanner interface needs to be extensible
- Bedrock Script API `@minecraft/server` 1.12.0 supports the block placement/break events and `system.runJob` needed for obstruction scanning

## Outstanding Questions

### Deferred to Planning
- [Affects R2][Technical] How to implement vertical hinge rotation math — does vertical mode use a different rotation axis or the same 90-degree logic rotated?
- [Affects R10][Needs research] How to detect and link vertically stacked hinges — persistent ID on the assembly, or scan on each interaction?
- [Affects R21-R22][Needs research] What is the complete list of "soft" vs "passable" vs "solid" block categories in Bedrock Script API? Is there a tag or property, or does it need a manual list?
- [Affects R33-R35][Technical] What integration mechanism should Big Doors use to communicate with the Settlements defense scanner? Block tags, custom components, or an event-based API?
- [Affects R5][Technical] What happens if blocks are placed on multiple sides of a hinge before any door assembly forms? Does only the first placement count, or can the hinge be re-oriented?
- [Affects R6][Technical] How many custom `bigdoors:` block variants are needed? One per vanilla block type, or a generic door block with a dynamic property storing the original material?
- [Affects R4][Technical] Dynamic hinge texture matching requires block permutations — how many material variants can be supported without exceeding Bedrock's permutation limits?
- [Affects R26-R27][Technical] What persistence mechanism for door state — world dynamic property registry, per-hinge block states, or hybrid approach?
- [Affects R30][Needs research] What Bedrock Script API mechanism detects redstone power changes on custom blocks? Polling via runInterval or block JSON redstone conductivity component?
- [Affects R19][Technical] How should entities be displaced during door sweep — teleport to nearest safe position, apply velocity, or treat occupied spaces as soft obstruction?
- [Affects R16][Technical] For double doors, how to ensure symmetric outward opening rather than both halves swinging in the "away from player" direction?
- [Affects R16][Technical] Blocks with orientation states (stairs, logs, slabs) need their facing permutation updated during rotation — how to handle this generically?

## Next Steps

-> `/ce:plan` for structured implementation planning
