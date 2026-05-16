/**
 * Central configuration for the mod.
 * All magic numbers live here — nothing is hardcoded in logic files.
 */

// Block identifiers
export const HINGE_BLOCK_ID = "bigdoors:hinge";
export const PANEL_BLOCK_ID = "bigdoors:door_panel";

// Persistence
export const PERSISTENCE_KEY = "bigdoors:state";

// Scan / size limits
export const MAX_DOOR_SCAN_RADIUS = 16;

// Tick intervals (20 ticks = 1 second)
export const REDSTONE_DEBOUNCE_TICKS = 4;

// Direction helpers — cardinal direction labels used by assemblies
export const DIRECTIONS = {
  NORTH: "north",
  SOUTH: "south",
  EAST: "east",
  WEST: "west",
};

// Offsets keyed by direction label
export const DIR_OFFSETS = {
  north: { x: 0, y: 0, z: -1 },
  south: { x: 0, y: 0, z: 1 },
  east:  { x: 1, y: 0, z: 0 },
  west:  { x: -1, y: 0, z: 0 },
  up:    { x: 0, y: 1, z: 0 },
  down:  { x: 0, y: -1, z: 0 },
};

// Opposite direction mapping
export const OPPOSITE_DIR = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
  up: "down",
  down: "up",
};

// --------------------------------------------------------------------------
// Block classification sets — used by ObstructionChecker.classifyBlock()
// --------------------------------------------------------------------------

/**
 * Soft blocks — destroyed silently when a door swings through them.
 * No item drops.
 */
export const SOFT_BLOCKS = new Set([
  "minecraft:short_grass",
  "minecraft:tall_grass",
  "minecraft:fern",
  "minecraft:large_fern",
  "minecraft:dead_bush",
  "minecraft:poppy",
  "minecraft:dandelion",
  "minecraft:blue_orchid",
  "minecraft:allium",
  "minecraft:azure_bluet",
  "minecraft:red_tulip",
  "minecraft:orange_tulip",
  "minecraft:white_tulip",
  "minecraft:pink_tulip",
  "minecraft:oxeye_daisy",
  "minecraft:cornflower",
  "minecraft:lily_of_the_valley",
  "minecraft:wither_rose",
  "minecraft:sunflower",
  "minecraft:lilac",
  "minecraft:rose_bush",
  "minecraft:peony",
  "minecraft:snow_layer",
  "minecraft:vine",
  "minecraft:cobweb",
]);

/**
 * Passable blocks — destroyed with item drops when a door swings through.
 */
export const PASSABLE_BLOCKS = new Set([
  "minecraft:torch",
  "minecraft:soul_torch",
  "minecraft:redstone_torch",
  "minecraft:wall_torch",      // Bedrock placement variant
  "minecraft:soul_wall_torch",
  "minecraft:redstone_wall_torch",
  "minecraft:oak_sign",
  "minecraft:spruce_sign",
  "minecraft:birch_sign",
  "minecraft:jungle_sign",
  "minecraft:acacia_sign",
  "minecraft:dark_oak_sign",
  "minecraft:mangrove_sign",
  "minecraft:cherry_sign",
  "minecraft:bamboo_sign",
  "minecraft:crimson_sign",
  "minecraft:warped_sign",
  "minecraft:oak_wall_sign",
  "minecraft:spruce_wall_sign",
  "minecraft:birch_wall_sign",
  "minecraft:jungle_wall_sign",
  "minecraft:acacia_wall_sign",
  "minecraft:dark_oak_wall_sign",
  "minecraft:wooden_door",
  "minecraft:spruce_door",
  "minecraft:birch_door",
  "minecraft:jungle_door",
  "minecraft:acacia_door",
  "minecraft:dark_oak_door",
  "minecraft:iron_door",
  "minecraft:wooden_button",
  "minecraft:stone_button",
  "minecraft:lever",
  "minecraft:wooden_pressure_plate",
  "minecraft:stone_pressure_plate",
  "minecraft:light_weighted_pressure_plate",
  "minecraft:heavy_weighted_pressure_plate",
  "minecraft:tripwire_hook",
  "minecraft:tripwire",
  "minecraft:flower_pot",
  "minecraft:rail",
  "minecraft:golden_rail",
  "minecraft:detector_rail",
  "minecraft:activator_rail",
  "minecraft:carpet",
  "minecraft:redstone_wire",
  "minecraft:repeater",
  "minecraft:comparator",
]);

// --------------------------------------------------------------------------
// Air / non-solid blocks the door can freely occupy
// --------------------------------------------------------------------------
export const AIR_BLOCKS = new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air",
]);

// --------------------------------------------------------------------------
// Curated material index — maps integer index to vanilla block typeId.
// Used by the door_panel block's bigdoors:material state.
// --------------------------------------------------------------------------

export const MATERIAL_INDEX = [
  // Group 0: Wood planks + key building blocks (indices 0–15)
  /* 0  */ "minecraft:oak_planks",
  /* 1  */ "minecraft:spruce_planks",
  /* 2  */ "minecraft:birch_planks",
  /* 3  */ "minecraft:jungle_planks",
  /* 4  */ "minecraft:acacia_planks",
  /* 5  */ "minecraft:dark_oak_planks",
  /* 6  */ "minecraft:mangrove_planks",
  /* 7  */ "minecraft:cherry_planks",
  /* 8  */ "minecraft:bamboo_planks",
  /* 9  */ "minecraft:crimson_planks",
  /* 10 */ "minecraft:warped_planks",
  /* 11 */ "minecraft:stone",
  /* 12 */ "minecraft:cobblestone",
  /* 13 */ "minecraft:stone_bricks",
  /* 14 */ "minecraft:bricks",
  /* 15 */ "minecraft:iron_block",

  // Group 1: Extended stone types (indices 16–31)
  /* 16 */ "minecraft:mossy_cobblestone",
  /* 17 */ "minecraft:mossy_stone_bricks",
  /* 18 */ "minecraft:cracked_stone_bricks",
  /* 19 */ "minecraft:sandstone",
  /* 20 */ "minecraft:red_sandstone",
  /* 21 */ "minecraft:deepslate",
  /* 22 */ "minecraft:cobbled_deepslate",
  /* 23 */ "minecraft:deepslate_bricks",
  /* 24 */ "minecraft:deepslate_tiles",
  /* 25 */ "minecraft:polished_deepslate",
  /* 26 */ "minecraft:granite",
  /* 27 */ "minecraft:diorite",
  /* 28 */ "minecraft:andesite",
  /* 29 */ "minecraft:prismarine",
  /* 30 */ "minecraft:purpur_block",
  /* 31 */ "minecraft:end_stone_bricks",

  // Group 2: Wool (indices 32–47)
  /* 32 */ "minecraft:white_wool",
  /* 33 */ "minecraft:orange_wool",
  /* 34 */ "minecraft:magenta_wool",
  /* 35 */ "minecraft:light_blue_wool",
  /* 36 */ "minecraft:yellow_wool",
  /* 37 */ "minecraft:lime_wool",
  /* 38 */ "minecraft:pink_wool",
  /* 39 */ "minecraft:gray_wool",
  /* 40 */ "minecraft:light_gray_wool",
  /* 41 */ "minecraft:cyan_wool",
  /* 42 */ "minecraft:purple_wool",
  /* 43 */ "minecraft:blue_wool",
  /* 44 */ "minecraft:brown_wool",
  /* 45 */ "minecraft:green_wool",
  /* 46 */ "minecraft:red_wool",
  /* 47 */ "minecraft:black_wool",

  // Group 3: Concrete (indices 48–63)
  /* 48 */ "minecraft:white_concrete",
  /* 49 */ "minecraft:orange_concrete",
  /* 50 */ "minecraft:magenta_concrete",
  /* 51 */ "minecraft:light_blue_concrete",
  /* 52 */ "minecraft:yellow_concrete",
  /* 53 */ "minecraft:lime_concrete",
  /* 54 */ "minecraft:pink_concrete",
  /* 55 */ "minecraft:gray_concrete",
  /* 56 */ "minecraft:light_gray_concrete",
  /* 57 */ "minecraft:cyan_concrete",
  /* 58 */ "minecraft:purple_concrete",
  /* 59 */ "minecraft:blue_concrete",
  /* 60 */ "minecraft:brown_concrete",
  /* 61 */ "minecraft:green_concrete",
  /* 62 */ "minecraft:red_concrete",
  /* 63 */ "minecraft:black_concrete",
];
