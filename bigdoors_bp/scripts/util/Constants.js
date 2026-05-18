/**
 * Central configuration for the mod.
 * All magic numbers live here — nothing is hardcoded in logic files.
 */

// Block identifiers
export const HINGE_BLOCK_ID = "bigdoors:hinge";
export const HIDDEN_HINGE_BLOCK_ID = "bigdoors:hidden_hinge";
export const PANEL_BLOCK_ID = "bigdoors:door_panel";

// Reserved material index for hinges that haven't been matched to a panel yet
export const UNMATCHED_MATERIAL_INDEX = 255;

// Persistence
export const PERSISTENCE_KEY = "bigdoors:state";

// Scan / size limits
export const MAX_DOOR_SCAN_RADIUS = 16;

// Tick intervals (20 ticks = 1 second)
export const REDSTONE_DEBOUNCE_TICKS = 4;
export const REDSTONE_SOURCE_POLL_TICKS = 4;

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

  // Group 4: Logs and natural (indices 64–79)
  /* 64 */ "minecraft:oak_log",
  /* 65 */ "minecraft:spruce_log",
  /* 66 */ "minecraft:birch_log",
  /* 67 */ "minecraft:jungle_log",
  /* 68 */ "minecraft:acacia_log",
  /* 69 */ "minecraft:dark_oak_log",
  /* 70 */ "minecraft:mangrove_log",
  /* 71 */ "minecraft:cherry_log",
  /* 72 */ "minecraft:bamboo_block",
  /* 73 */ "minecraft:crimson_stem",
  /* 74 */ "minecraft:warped_stem",
  /* 75 */ "minecraft:dirt",
  /* 76 */ "minecraft:coarse_dirt",
  /* 77 */ "minecraft:mud",
  /* 78 */ "minecraft:clay",
  /* 79 */ "minecraft:packed_mud",

  // Group 5: Fences, bars, and gate-style blocks (indices 80–95)
  /* 80 */ "minecraft:oak_fence",
  /* 81 */ "minecraft:spruce_fence",
  /* 82 */ "minecraft:birch_fence",
  /* 83 */ "minecraft:jungle_fence",
  /* 84 */ "minecraft:acacia_fence",
  /* 85 */ "minecraft:dark_oak_fence",
  /* 86 */ "minecraft:mangrove_fence",
  /* 87 */ "minecraft:cherry_fence",
  /* 88 */ "minecraft:bamboo_fence",
  /* 89 */ "minecraft:crimson_fence",
  /* 90 */ "minecraft:warped_fence",
  /* 91 */ "minecraft:nether_brick_fence",
  /* 92 */ "minecraft:iron_bars",
  /* 93 */ "minecraft:glass",
  /* 94 */ "minecraft:tinted_glass",
  /* 95 */ "minecraft:copper_block",

  // Group 6: Terracotta (indices 96–111)
  /* 96  */ "minecraft:terracotta",
  /* 97  */ "minecraft:white_terracotta",
  /* 98  */ "minecraft:orange_terracotta",
  /* 99  */ "minecraft:magenta_terracotta",
  /* 100 */ "minecraft:light_blue_terracotta",
  /* 101 */ "minecraft:yellow_terracotta",
  /* 102 */ "minecraft:lime_terracotta",
  /* 103 */ "minecraft:pink_terracotta",
  /* 104 */ "minecraft:gray_terracotta",
  /* 105 */ "minecraft:light_gray_terracotta",
  /* 106 */ "minecraft:cyan_terracotta",
  /* 107 */ "minecraft:purple_terracotta",
  /* 108 */ "minecraft:blue_terracotta",
  /* 109 */ "minecraft:brown_terracotta",
  /* 110 */ "minecraft:green_terracotta",
  /* 111 */ "minecraft:red_terracotta",

  // Group 7: Metals, gems, and misc building (indices 112–127)
  /* 112 */ "minecraft:gold_block",
  /* 113 */ "minecraft:diamond_block",
  /* 114 */ "minecraft:emerald_block",
  /* 115 */ "minecraft:lapis_block",
  /* 116 */ "minecraft:netherite_block",
  /* 117 */ "minecraft:copper_bulb",
  /* 118 */ "minecraft:cut_copper",
  /* 119 */ "minecraft:quartz_block",
  /* 120 */ "minecraft:smooth_quartz",
  /* 121 */ "minecraft:obsidian",
  /* 122 */ "minecraft:blackstone",
  /* 123 */ "minecraft:polished_blackstone",
  /* 124 */ "minecraft:polished_blackstone_bricks",
  /* 125 */ "minecraft:tuff",
  /* 126 */ "minecraft:tuff_bricks",
  /* 127 */ "minecraft:mud_bricks",

  // Group 8: Slabs (indices 128–143)
  /* 128 */ "minecraft:oak_slab",
  /* 129 */ "minecraft:spruce_slab",
  /* 130 */ "minecraft:birch_slab",
  /* 131 */ "minecraft:jungle_slab",
  /* 132 */ "minecraft:acacia_slab",
  /* 133 */ "minecraft:dark_oak_slab",
  /* 134 */ "minecraft:mangrove_slab",
  /* 135 */ "minecraft:cherry_slab",
  /* 136 */ "minecraft:bamboo_slab",
  /* 137 */ "minecraft:crimson_slab",
  /* 138 */ "minecraft:warped_slab",
  /* 139 */ "minecraft:normal_stone_slab",
  /* 140 */ "minecraft:cobblestone_slab",
  /* 141 */ "minecraft:stone_brick_slab",
  /* 142 */ "minecraft:brick_slab",
  /* 143 */ "minecraft:sandstone_slab",

  // Group 9: Glass panes (indices 144–159)
  /* 144 */ "minecraft:glass_pane",
  /* 145 */ "minecraft:white_stained_glass_pane",
  /* 146 */ "minecraft:orange_stained_glass_pane",
  /* 147 */ "minecraft:magenta_stained_glass_pane",
  /* 148 */ "minecraft:light_blue_stained_glass_pane",
  /* 149 */ "minecraft:yellow_stained_glass_pane",
  /* 150 */ "minecraft:lime_stained_glass_pane",
  /* 151 */ "minecraft:pink_stained_glass_pane",
  /* 152 */ "minecraft:gray_stained_glass_pane",
  /* 153 */ "minecraft:light_gray_stained_glass_pane",
  /* 154 */ "minecraft:cyan_stained_glass_pane",
  /* 155 */ "minecraft:purple_stained_glass_pane",
  /* 156 */ "minecraft:blue_stained_glass_pane",
  /* 157 */ "minecraft:brown_stained_glass_pane",
  /* 158 */ "minecraft:green_stained_glass_pane",
  /* 159 */ "minecraft:red_stained_glass_pane",

  // Group 10: Slabs batch 2 (indices 160–175)
  /* 160 */ "minecraft:smooth_stone_slab",
  /* 161 */ "minecraft:nether_brick_slab",
  /* 162 */ "minecraft:quartz_slab",
  /* 163 */ "minecraft:red_sandstone_slab",
  /* 164 */ "minecraft:prismarine_slab",
  /* 165 */ "minecraft:dark_prismarine_slab",
  /* 166 */ "minecraft:prismarine_brick_slab",
  /* 167 */ "minecraft:mossy_cobblestone_slab",
  /* 168 */ "minecraft:smooth_sandstone_slab",
  /* 169 */ "minecraft:red_nether_brick_slab",
  /* 170 */ "minecraft:end_stone_brick_slab",
  /* 171 */ "minecraft:andesite_slab",
  /* 172 */ "minecraft:polished_andesite_slab",
  /* 173 */ "minecraft:diorite_slab",
  /* 174 */ "minecraft:polished_diorite_slab",
  /* 175 */ "minecraft:granite_slab",

  // Group 11: Slabs batch 3 (indices 176–191)
  /* 176 */ "minecraft:polished_granite_slab",
  /* 177 */ "minecraft:mossy_stone_brick_slab",
  /* 178 */ "minecraft:smooth_quartz_slab",
  /* 179 */ "minecraft:cut_sandstone_slab",
  /* 180 */ "minecraft:cut_red_sandstone_slab",
  /* 181 */ "minecraft:smooth_red_sandstone_slab",
  /* 182 */ "minecraft:cobbled_deepslate_slab",
  /* 183 */ "minecraft:polished_deepslate_slab",
  /* 184 */ "minecraft:deepslate_tile_slab",
  /* 185 */ "minecraft:deepslate_brick_slab",
  /* 186 */ "minecraft:mud_brick_slab",
  /* 187 */ "minecraft:blackstone_slab",
  /* 188 */ "minecraft:polished_blackstone_slab",
  /* 189 */ "minecraft:polished_blackstone_brick_slab",
  /* 190 */ "minecraft:tuff_slab",
  /* 191 */ "minecraft:tuff_brick_slab",

  // Group 12: Slabs batch 4 (indices 192–207)
  /* 192 */ "minecraft:polished_tuff_slab",
  /* 193 */ "minecraft:bamboo_mosaic_slab",
  /* 194 */ "minecraft:pale_oak_slab",
  /* 195 */ "minecraft:resin_brick_slab",
  /* 196 */ "minecraft:purpur_slab",
  /* 197 */ "minecraft:cut_copper_slab",
  /* 198 */ "minecraft:exposed_cut_copper_slab",
  /* 199 */ "minecraft:weathered_cut_copper_slab",
  /* 200 */ "minecraft:oxidized_cut_copper_slab",
  /* 201 */ "minecraft:waxed_cut_copper_slab",
  /* 202 */ "minecraft:waxed_exposed_cut_copper_slab",
  /* 203 */ "minecraft:waxed_weathered_cut_copper_slab",
  /* 204 */ "minecraft:waxed_oxidized_cut_copper_slab",
  /* 205 */ "",
  /* 206 */ "",
  /* 207 */ "",
];

// --------------------------------------------------------------------------
// Geometry classes — maps geometry_id to a geometry identifier.
// 0 is always the full block (default).
// --------------------------------------------------------------------------

// Geometry ID headroom: 15 values × 16 groups × 16 IDs × 8 rotations × 2 overlays = 61,440 permutations (limit 65,536).
// Only one more geometry ID value (16 total) can be added before hitting the Bedrock permutation limit.
export const GEOMETRY_INDEX = [
  /* 0  */ "minecraft:geometry.full_block",
  /* 1  */ "geometry.bigdoors.fence_solo",
  /* 2  */ "geometry.bigdoors.fence_before",
  /* 3  */ "geometry.bigdoors.fence_after",
  /* 4  */ "geometry.bigdoors.fence_both",
  /* 5  */ "geometry.bigdoors.bars",
  /* 6  */ "geometry.bigdoors.slab",
  /* 7  */ "geometry.bigdoors.pane",
  /* 8  */ "geometry.bigdoors.slab_top",
  /* 9  */ "geometry.bigdoors.bars_solo",
  /* 10 */ "geometry.bigdoors.bars_before",
  /* 11 */ "geometry.bigdoors.bars_after",
  /* 12 */ "geometry.bigdoors.pane_solo",
  /* 13 */ "geometry.bigdoors.pane_before",
  /* 14 */ "geometry.bigdoors.pane_after",
];

export const GEOMETRY_CLASS_FENCE = 1;
export const GEOMETRY_CLASS_BARS = 5;
export const GEOMETRY_CLASS_SLAB = 6;
export const GEOMETRY_CLASS_PANE = 7;
export const GEOMETRY_ID_SLAB_TOP = 8;

export function isSlabGeometryId(geoId) {
  return geoId === GEOMETRY_CLASS_SLAB || geoId === GEOMETRY_ID_SLAB_TOP;
}

// --------------------------------------------------------------------------
// Material-to-geometry-class mapping — which geometry family a material uses.
// The placement handler resolves the specific variant (e.g. fence_left vs
// fence_middle) based on neighbor context. This map stores the "base" class.
// Anything not listed here defaults to geometry 0 (full block).
// --------------------------------------------------------------------------

export const MATERIAL_GEOMETRY_CLASS = new Map([
  // Fences → fence class
  [80, GEOMETRY_CLASS_FENCE],  // oak_fence
  [81, GEOMETRY_CLASS_FENCE],  // spruce_fence
  [82, GEOMETRY_CLASS_FENCE],  // birch_fence
  [83, GEOMETRY_CLASS_FENCE],  // jungle_fence
  [84, GEOMETRY_CLASS_FENCE],  // acacia_fence
  [85, GEOMETRY_CLASS_FENCE],  // dark_oak_fence
  [86, GEOMETRY_CLASS_FENCE],  // mangrove_fence
  [87, GEOMETRY_CLASS_FENCE],  // cherry_fence
  [88, GEOMETRY_CLASS_FENCE],  // bamboo_fence
  [89, GEOMETRY_CLASS_FENCE],  // crimson_fence
  [90, GEOMETRY_CLASS_FENCE],  // warped_fence
  [91, GEOMETRY_CLASS_FENCE],  // nether_brick_fence
  // Iron bars
  [92, GEOMETRY_CLASS_BARS],
  // Slabs
  [128, GEOMETRY_CLASS_SLAB], [129, GEOMETRY_CLASS_SLAB], [130, GEOMETRY_CLASS_SLAB],
  [131, GEOMETRY_CLASS_SLAB], [132, GEOMETRY_CLASS_SLAB], [133, GEOMETRY_CLASS_SLAB],
  [134, GEOMETRY_CLASS_SLAB], [135, GEOMETRY_CLASS_SLAB], [136, GEOMETRY_CLASS_SLAB],
  [137, GEOMETRY_CLASS_SLAB], [138, GEOMETRY_CLASS_SLAB], [139, GEOMETRY_CLASS_SLAB],
  [140, GEOMETRY_CLASS_SLAB], [141, GEOMETRY_CLASS_SLAB], [142, GEOMETRY_CLASS_SLAB],
  [143, GEOMETRY_CLASS_SLAB],
  // Glass panes
  [144, GEOMETRY_CLASS_PANE], [145, GEOMETRY_CLASS_PANE], [146, GEOMETRY_CLASS_PANE],
  [147, GEOMETRY_CLASS_PANE], [148, GEOMETRY_CLASS_PANE], [149, GEOMETRY_CLASS_PANE],
  [150, GEOMETRY_CLASS_PANE], [151, GEOMETRY_CLASS_PANE], [152, GEOMETRY_CLASS_PANE],
  [153, GEOMETRY_CLASS_PANE], [154, GEOMETRY_CLASS_PANE], [155, GEOMETRY_CLASS_PANE],
  [156, GEOMETRY_CLASS_PANE], [157, GEOMETRY_CLASS_PANE], [158, GEOMETRY_CLASS_PANE],
  [159, GEOMETRY_CLASS_PANE],
  // Slabs batch 2
  [160, GEOMETRY_CLASS_SLAB], [161, GEOMETRY_CLASS_SLAB], [162, GEOMETRY_CLASS_SLAB],
  [163, GEOMETRY_CLASS_SLAB], [164, GEOMETRY_CLASS_SLAB], [165, GEOMETRY_CLASS_SLAB],
  [166, GEOMETRY_CLASS_SLAB], [167, GEOMETRY_CLASS_SLAB], [168, GEOMETRY_CLASS_SLAB],
  [169, GEOMETRY_CLASS_SLAB], [170, GEOMETRY_CLASS_SLAB], [171, GEOMETRY_CLASS_SLAB],
  [172, GEOMETRY_CLASS_SLAB], [173, GEOMETRY_CLASS_SLAB], [174, GEOMETRY_CLASS_SLAB],
  [175, GEOMETRY_CLASS_SLAB],
  // Slabs batch 3
  [176, GEOMETRY_CLASS_SLAB], [177, GEOMETRY_CLASS_SLAB], [178, GEOMETRY_CLASS_SLAB],
  [179, GEOMETRY_CLASS_SLAB], [180, GEOMETRY_CLASS_SLAB], [181, GEOMETRY_CLASS_SLAB],
  [182, GEOMETRY_CLASS_SLAB], [183, GEOMETRY_CLASS_SLAB], [184, GEOMETRY_CLASS_SLAB],
  [185, GEOMETRY_CLASS_SLAB], [186, GEOMETRY_CLASS_SLAB], [187, GEOMETRY_CLASS_SLAB],
  [188, GEOMETRY_CLASS_SLAB], [189, GEOMETRY_CLASS_SLAB], [190, GEOMETRY_CLASS_SLAB],
  [191, GEOMETRY_CLASS_SLAB],
  // Slabs batch 4
  [192, GEOMETRY_CLASS_SLAB], [193, GEOMETRY_CLASS_SLAB], [194, GEOMETRY_CLASS_SLAB],
  [195, GEOMETRY_CLASS_SLAB], [196, GEOMETRY_CLASS_SLAB], [197, GEOMETRY_CLASS_SLAB],
  [198, GEOMETRY_CLASS_SLAB], [199, GEOMETRY_CLASS_SLAB], [200, GEOMETRY_CLASS_SLAB],
  [201, GEOMETRY_CLASS_SLAB], [202, GEOMETRY_CLASS_SLAB], [203, GEOMETRY_CLASS_SLAB],
  [204, GEOMETRY_CLASS_SLAB],
]);
