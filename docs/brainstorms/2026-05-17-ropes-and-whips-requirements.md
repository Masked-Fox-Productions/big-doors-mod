---
date: 2026-05-17
topic: ropes-and-whips
---

# Ropes, Rope Ladders, and Whips

## Problem Frame

Players in survival and adventure builds need vertical traversal and utility options beyond vanilla ladders. Vanilla ladders require a backing block at every level and offer no ranged deployment. This feature adds three related items — Rope Ladders, Ropes, and Whips — that share an anchor-and-cascade topology (similar to the existing hinge/panel system) but serve distinct movement and utility roles. These will eventually spin out into a standalone add-on.

## User Flow

```
              ROPE LADDER — Simple Coil & Uncoil
    ┌──────────────────────────────────────────────────┐
    │ Place Rope Ladder on a wall face — starts COILED │
    └────────────────────┬─────────────────────────────┘
                         │
                         v
    ┌──────────────────────────────────────────────────┐
    │ Add segments (use rope ladder item on coil)      │
    └────────────────────┬─────────────────────────────┘
                         │
                         v
    ┌──────────────────────────────────────────────────┐
    │ Interact to UNCOIL: extends straight down        │
    │ Interact again to COIL: retracts back up         │
    │ (No cascading — single vertical column only)     │
    └──────────────────────────────────────────────────┘


              ROPE — Cascading Terrain-Follow
    ┌──────────────────────────────────────────────────┐
    │ Place Rope on any solid face (top, bottom, side) │
    │ — starts as a single COILED block                │
    └────────────────────┬─────────────────────────────┘
                         │
                         v
    ┌──────────────────────────────────────────────────┐
    │ Add segments (use rope item on coil)             │
    └────────────────────┬─────────────────────────────┘
                         │
                         v
    ┌──────────────────────────────────────────────────┐
    │ Interact to UNCOIL — extends downward:           │
    │                                                  │
    │ If solid below, rope falls off the nearest edge  │
    │ (player's facing direction first, then others):  │
    │                                                  │
    │   ██ Anchor (coil, 20 segments)                  │
    │   ████████ solid ground █████████                │
    │            │                                     │
    │            ├── segment                           │
    │            ├── segment                           │
    │            ├── segment                           │
    │            └── segment                           │
    │   ████████ solid ledge ██████████                │
    │            │                                     │
    │            └── coil (16 remaining)               │
    │                                                  │
    │ Excess segments pool as a coil in the last air   │
    │ block above the solid. Coil stays in that block. │
    └────────────────────┬─────────────────────────────┘
                         │
                         v
    ┌──────────────────────────────────────────────────┐
    │ Interact with the LEDGE COIL to extend further:  │
    │                                                  │
    │   Anchor (coil, 0 remaining)                     │
    │       │                                          │
    │       ├── segment                                │
    │       ├── segment                                │
    │       ├── segment                                │
    │       └── segment                                │
    │   ████████ solid ledge ██████████                │
    │            │                                     │
    │            ├── segment                           │
    │            ├── segment                           │
    │            :   ... (continues down)              │
    │            └── coil (N remaining)                │
    │                                                  │
    │ Repeat down the mountainside — each ledge gets   │
    │ a coil, each coil can extend the next drop.      │
    └──────────────────────────────────────────────────┘
                         │
                         v
    ┌──────────────────────────────────────────────────┐
    │ RETRACT from above: interact with any extended   │
    │ segment to pull up the bottommost segment (one   │
    │ at a time) back into the nearest coil below it.  │
    └──────────────────────────────────────────────────┘


                              WHIP
    ┌──────────────────────────────────────────────────┐
    │ Equip Whip in main hand                          │
    └────────────────────┬─────────────────────────────┘
                         │
             ┌───────────┴───────────┐
             v                       v
    ┌─────────────────┐    ┌──────────────────────────┐
    │ Attack: long    │    │ Use (right-click) on      │
    │ range, weak     │    │ any solid block face      │
    │ damage, medium  │    │ (including bottom face)   │
    │ knockback       │    │ within range               │
    └─────────────────┘    └──────────┬────────────────┘
                                      │
                                      v
                            ┌──────────────────────────┐
                            │ Creates 1–4 Rope segments│
                            │ downward from target face│
                            │ (stops at solid block)   │
                            │                          │
                            │ Bottom segment shows     │
                            │ whip handle texture      │
                            └──────────┬───────────────┘
                                       │
                                       v
                            ┌──────────────────────────┐
                            │ Break ANY segment:       │
                            │ entire chain removed,    │
                            │ rope-break particles,    │
                            │ Whip returned to         │
                            │ deployer's inventory     │
                            └──────────────────────────┘
```

## Requirements

**Namespace and Identity**
- R1. All new blocks and items use the `ropes:` namespace prefix (e.g., `ropes:rope_ladder`, `ropes:rope`, `ropes:whip`) to allow clean separation into a standalone add-on later.
- R2. Ropes blocks, items, scripts, and resources live inside the existing `bigdoors_bp/` and `bigdoors_rp/` packs for now. Code is organized under its own directory (e.g., `scripts/ropes/`) but shares the Big Doors manifest and entry point. Physical pack separation is deferred to when the add-on actually spins out.

**Rope Ladder**
- R3. A `ropes:rope_ladder` block that can be placed on any wall face of a solid block (wall faces only, like a vanilla ladder — not floor or ceiling). This initial placement creates the anchor block. Subsequent Rope Ladder blocks can only be placed directly below existing ones in the same column — they do not need a backing wall.
- R4. Rope Ladders have a collision box and are climbable by walking into them (same behavior as vanilla ladders).
- R5. Rope Ladders support simple coil/uncoil (see R9-R12): extend straight down, retract straight up. No cascading terrain-follow — Rope Ladders operate in a single vertical column only. A castle defender can coil a ladder to pull it up, then uncoil to lower it again.

**Rope**
- R6. A `ropes:rope` block that can be placed on the top, bottom, or side face of a solid block (including the bottom face, for hanging from ceilings or overhangs). This initial placement creates the anchor block. Subsequent Rope blocks can only be placed directly below existing ones in the same column — they do not need a backing block.
- R7. Rope blocks have no collision — players and entities pass through freely.
- R8. Ropes are climbable like vines: players inside a Rope block can move up with Space and down with Shift.

**Coil/Uncoil (Shared Base Mechanic)**
- R9. Each rope/ladder anchor block tracks a segment count — the number of blocks it can extend downward when uncoiled.
- R10. **Coiled state:** The anchor block displays a coiled texture (pile on floor or loop on wall depending on placement face). It occupies a single block regardless of segment count.
- R11. **Uncoil:** On interact (right-click), the anchor extends downward, placing one rope/ladder block per segment until it runs out of segments or hits a solid block. If the block directly below the anchor is solid (e.g., a coil sitting on a floor), the rope looks for an edge to fall off: first check the adjacent block in the direction the player is facing — if that position has air below it, the rope extends downward from there. If the player's facing direction has no drop, check the remaining cardinal faces in order. If no adjacent edge is found, the rope cannot uncoil (stays coiled).
- R12. **Recoil:** On interact with the anchor while extended, all extended segments retract back into the anchor block. The segment count is preserved (no segments are lost during recoil). The anchor returns to coiled state with its full segment count.

**Cascading Terrain-Follow (Ropes Only — not Rope Ladders)**
- R13. When a Rope uncoils and hits a solid block before running out of segments, excess segments pool as a coil in the last air block above the solid (the bottommost extended block becomes a "ledge coil" showing the coiled texture).
- R14. Interacting with a ledge coil extends it further downward from that position, creating a new vertical drop. If this drop also hits a solid block, another ledge coil forms with remaining segments. This can cascade multiple times down complex terrain.
- R15. **Retract from above (one at a time):** Interacting with any extended segment above a ledge coil pulls the bottommost extended segment (from the lowest active drop) back into the nearest coil above it. Each interact retracts one segment. Repeated interaction gradually shortens the rope from the bottom up.
- R16. **Full recoil:** Interacting with the top-level anchor recoils the entire rope — all drops, all ledge coils, all segments retract back into the anchor block with full segment count preserved.

**Adding Segments**
- R17. A player can increase a rope or rope ladder's segment count by using a rope/ladder item on a coiled block (anchor or ledge coil), or by placing a new rope/ladder block at the bottom of an already-extended chain.

**Breaking Extended Segments**
- R18. Breaking any extended (uncoiled) segment causes all extended segments below it in the same chain to break and drop as items — including any ledge coils and their downstream drops. Extended segments above the break remain intact (they retain their anchor connection). The anchor block's segment count decreases by the number of segments lost. Coiled segments in the anchor are unaffected.

**Whip (Item)**
- R19. A `ropes:whip` main-hand item with dual functionality: weapon and tool.
- R20. As a weapon: long range (comparable to a spear/trident), weak damage, medium knockback.
- R21. As a tool: right-click on any solid block face within range (including bottom faces) to deploy virtual Rope segments. Deployment creates 1 to 4 Rope segments extending downward from the targeted block face, stopping early if a solid block is encountered.
- R22. The bottommost segment of a whip-deployed rope uses a distinct texture showing the whip handle dangling at the end. All other whip-deployed segments look identical to hand-placed Rope blocks.
- R23. Whip-deployed Rope segments are climbable (same as R8).
- R24. Breaking ANY block in a whip-deployed chain removes the ENTIRE chain (all segments, not just those below the break). Plays a rope-break particle effect. No rope item drops are created.
- R25. The Whip is returned to the deployer's inventory if they are online and in the same dimension as the rope anchor. If the deployer is online in the same dimension but their inventory is full, spawn the Whip as an item entity at the deployer's position. Otherwise (deployer offline, in a different dimension, or not found), spawn the Whip as an item entity at the rope's anchor location.
- R26. Whip-deployed ropes do not support coil/uncoil interaction or cascading — they are a temporary deployment that exists until broken.

## Success Criteria

- A player can place a Rope on a cliff edge, add 20 segments, uncoil it, watch it drop 4 blocks to a ledge with 16 segments pooling as a coil, interact with that coil to extend the next drop, and repeat down a mountainside — creating a cascading staircase of climbable vertical sections.
- A player can retract a cascading rope from the top one segment at a time, pulling up the bottommost segment from the lowest active drop.
- A player can place a Rope Ladder on a wall, add segments, uncoil it straight down, climb it, and recoil it from the top. Rope Ladders do not cascade.
- A player can deploy a Whip from a cliff edge onto any block face (including the bottom of an overhang), see rope segments appear downward, climb down them, then break the rope and have the Whip return to inventory.
- Breaking a middle segment of any hand-placed rope chain drops all segments below (including downstream ledge coils and drops) while leaving segments above intact.
- Breaking any segment of a whip-deployed chain removes the entire chain.
- The three items feel distinct in gameplay: Rope Ladder = easy climbing infrastructure with tactical coil/uncoil, Rope = terrain-following cascading vertical line, Whip = quick-deploy tactical tool.

## Scope Boundaries

- **No horizontal ropes** — Ropes only hang vertically downward from an anchor or ledge coil. Horizontal spanning may come in a future version.
- **No rope physics or swinging** — Ropes are static blocks, not entities with physics simulation.
- **No rope bridges** — Combinations of horizontal + vertical rope are out of scope.
- **Crafting recipes are deferred to planning** — Specific recipe ingredients and shapes will be decided during implementation planning.
- **No Whip enchantments** — The Whip has fixed stats; enchantment support is out of scope.
- **Java parity is deferred** — Initial implementation targets Bedrock only. Java parity tracking will be added to `docs/parity-checklist.md` before v1.0.
- **Physical pack separation is deferred** — Ropes live in bigdoors packs for now; split to standalone packs when actually spinning out the add-on.
- **No Rope Ladder cascading** — Rope Ladders are simple vertical coil/uncoil only. Terrain-follow cascading is a Rope-specific feature.

## Key Decisions

- **Separate `ropes:` namespace**: Avoids migration pain when these spin out into their own add-on. Worth the extra manifest setup now.
- **Shared packs for now, separate later**: Ropes code lives inside bigdoors_bp/ to share the script entry point and avoid the complexity of multi-pack architecture during initial development.
- **Vertical-only ropes**: Horizontal rope stretching adds significant complexity (auto-connection, multi-axis geometry) for a feature that can be added later without breaking changes.
- **Rope Ladder = ladder behavior, Rope = vine behavior**: Gives each item a distinct gameplay identity. Rope Ladders have collision and are walked-into; Ropes are passable and climbed with Space/Shift.
- **Coil/uncoil mechanic**: Ropes and Rope Ladders track segment count and can be extended/retracted interactively. Adds tactical depth (castle defenders can pull up ladders) and avoids the need for per-block placement of long chains.
- **Cascading terrain-follow for Ropes only**: Ropes follow terrain by pooling excess segments as ledge coils, creating multi-drop cascading paths down complex terrain. Rope Ladders keep simple single-column behavior since they're wall-mounted infrastructure.
- **One-at-a-time retraction from above**: Interacting with a segment above a ledge coil pulls up one segment from the bottommost drop. Gives precise control without bulk operations.
- **Whip handle on bottom segment**: Subtle visual indicator that a rope chain is whip-deployed, without requiring a fully separate block type for every segment.
- **Whip chains break as a unit**: Unlike hand-placed ropes (which cascade downward only), breaking any segment of a whip-deployed chain removes the entire chain. This matches the mental model that the whip is a single tool deployment, not permanent infrastructure.
- **Whip return to deployer**: The whip tracks its deployer and returns to their inventory when the chain breaks. Falls back to item entity drop if the deployer is offline.
- **Bottom-face attachment for Ropes and Whips**: Ropes can anchor to the underside of blocks (ceilings, overhangs), and Whips can target bottom faces. Rope Ladders remain wall-only.

## Dependencies / Assumptions

- Bedrock Script API supports custom item use-on-block events for the Whip's right-click deployment.
- Custom blocks can be made climbable (ladder-like or vine-like behavior) via block components or script workarounds.

## Outstanding Questions

### Resolve Before Planning

(None — all product decisions resolved.)

### Deferred to Planning

- [Affects R4, R8][Needs research] How to implement climbable behavior for custom blocks in Bedrock — does `minecraft:climbable` work on custom blocks, or does it need a script-based workaround (e.g., applying slow-falling + jump boost)?
- [Affects R21][Needs research] Which Bedrock Script API events support custom item right-click on a block face? Need to confirm `itemUseOn` or equivalent provides the target block and face direction.
- [Affects R20][Technical] Specific weapon stats (damage, range, knockback values) for the Whip — tuning values to be determined during implementation.
- [Affects R22][Technical] How to distinguish whip-deployed rope from hand-placed rope in the script layer — block state flag vs. separate tracking in persistence.
- [Affects R9][Technical] How to persist segment count on the anchor block and ledge coils — block state integer vs. world dynamic property.
- [Affects R13][Technical] Geometry and behavior for ledge coils — whether they use the same block type with a state flag or a distinct visual variant. Can players interact with ledge coils to add segments (R17)?
- [Affects R18][Technical] Maximum rope chain length — balance between gameplay utility and cascade break performance (many block operations in one tick across multiple drops).
- [Affects R13-R16][Technical] Data model for multi-drop cascading — how ledge coils track their relationship to the parent anchor and their remaining segment count. Single shared pool vs. per-coil tracking.

## Next Steps

-> `/ce:plan` for structured implementation planning
