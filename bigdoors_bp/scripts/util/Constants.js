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
export const REDSTONE_DEBOUNCE_TICKS = 2;

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
};

// Opposite direction mapping
export const OPPOSITE_DIR = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
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
  /* 13 */ "minecraft:mossy_cobblestone",
  /* 14 */ "minecraft:stone_bricks",
  /* 15 */ "minecraft:mossy_stone_bricks",
  /* 16 */ "minecraft:cracked_stone_bricks",
  /* 17 */ "minecraft:bricks",
  /* 18 */ "minecraft:sandstone",
  /* 19 */ "minecraft:red_sandstone",
  /* 20 */ "minecraft:deepslate",
  /* 21 */ "minecraft:cobbled_deepslate",
  /* 22 */ "minecraft:deepslate_bricks",
  /* 23 */ "minecraft:deepslate_tiles",
  /* 24 */ "minecraft:polished_deepslate",
  /* 25 */ "minecraft:granite",
  /* 26 */ "minecraft:diorite",
  /* 27 */ "minecraft:andesite",
  /* 28 */ "minecraft:prismarine",
  /* 29 */ "minecraft:iron_block",
];
