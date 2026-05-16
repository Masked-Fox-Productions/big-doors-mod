# Big Doors

Build massive doors, gates, and drawbridges from any block type. Place a Hinge block, attach blocks to one side, and click to swing them open.

Works standalone or alongside the [Settlements](https://github.com/Masked-Fox-Productions/minecraft-siege) mod, where closed doors count as walls and open doors count as breaches during raids.

## How It Works

### Place a Hinge

The Hinge is a custom block (`bigdoors:hinge`). Place it against a wall or frame where you want the pivot point.

```
Top-down view:

  X O - - -       X = existing wall
  X - - - -       O = hinge
                   - = air
```

### Attach Door Blocks

Place blocks of the same type on the free side of the hinge. The first block you place sets the door's orientation.

```
  X O H H H -     H = door blocks (e.g., Cobblestone)
  X - - - - -
```

Stack hinges vertically to make tall doors. Three hinges tall with blocks attached to each creates a 3-high door that swings as one unit.

### Open and Close

Click the door or hinge to swing it 90 degrees away from you. Click again to close.

```
  - H - - - -        - - - - - -
  X O - - - -   or   X O - - - -     (opens away from player)
  X - - - - -        X H - - - -
```

### Double Doors

Place two hinges facing each other with same-type blocks between them. They split evenly and open symmetrically.

```
  Closed:              Open:
  X O H H H H O X     X O - - - - O X
  X X - - - - X X     X X H - - H X X
                           H - - H
```

With an odd number of blocks between hinges, the center block stays fixed as a post.

### Control Direction

Solid blocks behind the hinge prevent opening in that direction. Use frame blocks to make castle doors that only open outward:

```
  X O H H H H O X     Frame blocks (X) behind hinges
  X X - - - - X X     force doors to open outward only
```

### Redstone

Hinge blocks respond to redstone. Powered = open, unpowered = closed. Direction defaults to clockwise (from above), controlled by frame blocks.

### Obstruction Rules

- **Soft blocks** (grass, flowers, snow) — destroyed and replaced by the door
- **Passable blocks** (signs, torches) — door occupies the same space
- **Solid blocks** — prevent opening in that direction

If one direction is blocked, the door tries the other. If both are blocked, it doesn't move.

## Hinge Modes

- **Horizontal** (placed on a wall) — swings like a normal door
- **Vertical** (placed on floor/ceiling) — swings like a trapdoor or drawbridge

## Installation

### Bedrock Edition

1. Download the latest `.mcpack` files from [Releases](../../releases)
2. Double-click each file to import into Minecraft
3. Enable both packs (behavior + resource) on your world

### Java Edition (Fabric)

1. Install [Fabric Loader](https://fabricmc.net/) for your Minecraft version
2. Download the latest `.jar` from [Releases](../../releases)
3. Place it in your `.minecraft/mods/` folder

## Development

### Bedrock (Script API)

```bash
npm test                    # run all tests
```

No build step or package install required. Scripts target `@minecraft/server` 1.12.0.

### Java (Fabric)

```bash
cd java-bigdoors
./gradlew test              # run tests
./gradlew build             # build mod JAR
./gradlew deployToMods      # build and copy to .minecraft/mods/
```

### Project Structure

```
bigdoors_bp/                # Bedrock behavior pack
  scripts/
    main.js                 # entry point
    domain/                 # pure JS domain logic (no Bedrock imports)
    blocks/                 # block event handlers
    util/                   # constants and helpers
bigdoors_rp/                # Bedrock resource pack
java-bigdoors/              # Java/Fabric mod
  src/main/java/com/bigdoors/
    domain/                 # pure Java domain logic
    block/                  # block registration and behavior
tests/                      # Bedrock unit tests (node:test)
```

## Settlements Integration

When both Big Doors and Settlements are installed:

- **Closed doors** register as solid wall segments for the defense scanner
- **Open doors** register as breaches/gaps
- No configuration needed — detection is automatic

Without Settlements, Big Doors works as a fully standalone mod.

## License

MIT
