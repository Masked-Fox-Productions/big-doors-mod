package com.bigdoors.util;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * All magic numbers and shared constants for the Big Doors mod.
 * No Minecraft imports allowed.
 */
public final class Constants {

    private Constants() {}

    // Block IDs
    public static final String HINGE_BLOCK_ID = "bigdoors:hinge";
    public static final String HIDDEN_HINGE_BLOCK_ID = "bigdoors:hidden_hinge";
    public static final String PANEL_BLOCK_ID = "bigdoors:door_panel";
    public static final String PANEL_FENCE_BLOCK_ID = "bigdoors:door_panel_fence";
    public static final String PANEL_BARS_BLOCK_ID = "bigdoors:door_panel_bars";
    public static final String PANEL_PANE_BLOCK_ID = "bigdoors:door_panel_pane";
    public static final String PANEL_SLAB_BLOCK_ID = "bigdoors:door_panel_slab";

    public static final Set<String> PANEL_BLOCK_IDS = Set.of(
            PANEL_BLOCK_ID,
            PANEL_FENCE_BLOCK_ID,
            PANEL_BARS_BLOCK_ID,
            PANEL_PANE_BLOCK_ID,
            PANEL_SLAB_BLOCK_ID
    );

    public static final int UNMATCHED_MATERIAL_INDEX = 255;

    // Persistence
    public static final String PERSISTENCE_KEY = "bigdoors:state";

    // Limits
    public static final int MAX_DOOR_SCAN_RADIUS = 16;
    public static final int REDSTONE_DEBOUNCE_TICKS = 2;
    public static final int REDSTONE_PROPAGATION_POWER = 15;

    // Directions
    public static final String NORTH = "north";
    public static final String SOUTH = "south";
    public static final String EAST = "east";
    public static final String WEST = "west";
    public static final String UP = "up";
    public static final String DOWN = "down";

    /** Direction offsets: direction name → BlockPos3 delta (all 6 directions). */
    public static final Map<String, BlockPos3> DIR_OFFSETS;
    static {
        DIR_OFFSETS = new HashMap<>();
        DIR_OFFSETS.put(NORTH, new BlockPos3(0, 0, -1));
        DIR_OFFSETS.put(SOUTH, new BlockPos3(0, 0, 1));
        DIR_OFFSETS.put(EAST,  new BlockPos3(1, 0, 0));
        DIR_OFFSETS.put(WEST,  new BlockPos3(-1, 0, 0));
        DIR_OFFSETS.put(UP,    new BlockPos3(0, 1, 0));
        DIR_OFFSETS.put(DOWN,  new BlockPos3(0, -1, 0));
    }

    /** Horizontal-only direction offsets (cardinal directions). */
    public static final Map<String, BlockPos3> HORIZONTAL_DIR_OFFSETS = Map.of(
            NORTH, new BlockPos3(0, 0, -1),
            SOUTH, new BlockPos3(0, 0, 1),
            EAST,  new BlockPos3(1, 0, 0),
            WEST,  new BlockPos3(-1, 0, 0)
    );

    /** Opposite direction mapping. */
    public static final Map<String, String> OPPOSITE_DIR;
    static {
        OPPOSITE_DIR = new HashMap<>();
        OPPOSITE_DIR.put(NORTH, SOUTH);
        OPPOSITE_DIR.put(SOUTH, NORTH);
        OPPOSITE_DIR.put(EAST, WEST);
        OPPOSITE_DIR.put(WEST, EAST);
        OPPOSITE_DIR.put(UP, DOWN);
        OPPOSITE_DIR.put(DOWN, UP);
    }

    /** Blocks that are soft and can be displaced by door movement. */
    public static final Set<String> SOFT_BLOCKS = Set.of(
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
            "minecraft:cobweb"
    );

    /** Blocks that are passable (non-solid, player can walk through). */
    public static final Set<String> PASSABLE_BLOCKS = Set.of(
            "minecraft:torch",
            "minecraft:soul_torch",
            "minecraft:redstone_torch",
            "minecraft:wall_torch",
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
            "minecraft:comparator"
    );

    /** Air-like blocks. */
    public static final Set<String> AIR_BLOCKS = Set.of(
            "minecraft:air",
            "minecraft:cave_air",
            "minecraft:void_air"
    );

    // -------------------------------------------------------------------------
    // Material index — 208 supported materials, order matches the JS source.
    // Null entries (205-207) are reserved/empty slots.
    // -------------------------------------------------------------------------

    public static final String[] MATERIAL_INDEX = {
            // Group 0: Wood planks + key building blocks (indices 0-15)
            "minecraft:oak_planks",           // 0
            "minecraft:spruce_planks",        // 1
            "minecraft:birch_planks",         // 2
            "minecraft:jungle_planks",        // 3
            "minecraft:acacia_planks",        // 4
            "minecraft:dark_oak_planks",      // 5
            "minecraft:mangrove_planks",      // 6
            "minecraft:cherry_planks",        // 7
            "minecraft:bamboo_planks",        // 8
            "minecraft:crimson_planks",       // 9
            "minecraft:warped_planks",        // 10
            "minecraft:stone",                // 11
            "minecraft:cobblestone",          // 12
            "minecraft:stone_bricks",         // 13
            "minecraft:bricks",               // 14
            "minecraft:iron_block",           // 15

            // Group 1: Extended stone types (indices 16-31)
            "minecraft:mossy_cobblestone",    // 16
            "minecraft:mossy_stone_bricks",   // 17
            "minecraft:cracked_stone_bricks", // 18
            "minecraft:sandstone",            // 19
            "minecraft:red_sandstone",        // 20
            "minecraft:deepslate",            // 21
            "minecraft:cobbled_deepslate",    // 22
            "minecraft:deepslate_bricks",     // 23
            "minecraft:deepslate_tiles",      // 24
            "minecraft:polished_deepslate",   // 25
            "minecraft:granite",              // 26
            "minecraft:diorite",              // 27
            "minecraft:andesite",             // 28
            "minecraft:prismarine",           // 29
            "minecraft:purpur_block",         // 30
            "minecraft:end_stone_bricks",     // 31

            // Group 2: Wool (indices 32-47)
            "minecraft:white_wool",           // 32
            "minecraft:orange_wool",          // 33
            "minecraft:magenta_wool",         // 34
            "minecraft:light_blue_wool",      // 35
            "minecraft:yellow_wool",          // 36
            "minecraft:lime_wool",            // 37
            "minecraft:pink_wool",            // 38
            "minecraft:gray_wool",            // 39
            "minecraft:light_gray_wool",      // 40
            "minecraft:cyan_wool",            // 41
            "minecraft:purple_wool",          // 42
            "minecraft:blue_wool",            // 43
            "minecraft:brown_wool",           // 44
            "minecraft:green_wool",           // 45
            "minecraft:red_wool",             // 46
            "minecraft:black_wool",           // 47

            // Group 3: Concrete (indices 48-63)
            "minecraft:white_concrete",       // 48
            "minecraft:orange_concrete",      // 49
            "minecraft:magenta_concrete",     // 50
            "minecraft:light_blue_concrete",  // 51
            "minecraft:yellow_concrete",      // 52
            "minecraft:lime_concrete",        // 53
            "minecraft:pink_concrete",        // 54
            "minecraft:gray_concrete",        // 55
            "minecraft:light_gray_concrete",  // 56
            "minecraft:cyan_concrete",        // 57
            "minecraft:purple_concrete",      // 58
            "minecraft:blue_concrete",        // 59
            "minecraft:brown_concrete",       // 60
            "minecraft:green_concrete",       // 61
            "minecraft:red_concrete",         // 62
            "minecraft:black_concrete",       // 63

            // Group 4: Logs and natural (indices 64-79)
            "minecraft:oak_log",              // 64
            "minecraft:spruce_log",           // 65
            "minecraft:birch_log",            // 66
            "minecraft:jungle_log",           // 67
            "minecraft:acacia_log",           // 68
            "minecraft:dark_oak_log",         // 69
            "minecraft:mangrove_log",         // 70
            "minecraft:cherry_log",           // 71
            "minecraft:bamboo_block",         // 72
            "minecraft:crimson_stem",         // 73
            "minecraft:warped_stem",          // 74
            "minecraft:dirt",                 // 75
            "minecraft:coarse_dirt",          // 76
            "minecraft:mud",                  // 77
            "minecraft:clay",                 // 78
            "minecraft:packed_mud",           // 79

            // Group 5: Fences, bars, and gate-style blocks (indices 80-95)
            "minecraft:oak_fence",            // 80
            "minecraft:spruce_fence",         // 81
            "minecraft:birch_fence",          // 82
            "minecraft:jungle_fence",         // 83
            "minecraft:acacia_fence",         // 84
            "minecraft:dark_oak_fence",       // 85
            "minecraft:mangrove_fence",       // 86
            "minecraft:cherry_fence",         // 87
            "minecraft:bamboo_fence",         // 88
            "minecraft:crimson_fence",        // 89
            "minecraft:warped_fence",         // 90
            "minecraft:nether_brick_fence",   // 91
            "minecraft:iron_bars",            // 92
            "minecraft:glass",                // 93
            "minecraft:tinted_glass",         // 94
            "minecraft:copper_block",         // 95

            // Group 6: Terracotta (indices 96-111)
            "minecraft:terracotta",           // 96
            "minecraft:white_terracotta",     // 97
            "minecraft:orange_terracotta",    // 98
            "minecraft:magenta_terracotta",   // 99
            "minecraft:light_blue_terracotta", // 100
            "minecraft:yellow_terracotta",    // 101
            "minecraft:lime_terracotta",      // 102
            "minecraft:pink_terracotta",      // 103
            "minecraft:gray_terracotta",      // 104
            "minecraft:light_gray_terracotta", // 105
            "minecraft:cyan_terracotta",      // 106
            "minecraft:purple_terracotta",    // 107
            "minecraft:blue_terracotta",      // 108
            "minecraft:brown_terracotta",     // 109
            "minecraft:green_terracotta",     // 110
            "minecraft:red_terracotta",       // 111

            // Group 7: Metals, gems, and misc building (indices 112-127)
            "minecraft:gold_block",           // 112
            "minecraft:diamond_block",        // 113
            "minecraft:emerald_block",        // 114
            "minecraft:lapis_block",          // 115
            "minecraft:netherite_block",      // 116
            "minecraft:copper_bulb",          // 117
            "minecraft:cut_copper",           // 118
            "minecraft:quartz_block",         // 119
            "minecraft:smooth_quartz",        // 120
            "minecraft:obsidian",             // 121
            "minecraft:blackstone",           // 122
            "minecraft:polished_blackstone",  // 123
            "minecraft:polished_blackstone_bricks", // 124
            "minecraft:tuff",                 // 125
            "minecraft:tuff_bricks",          // 126
            "minecraft:mud_bricks",           // 127

            // Group 8: Slabs (indices 128-143)
            "minecraft:oak_slab",             // 128
            "minecraft:spruce_slab",          // 129
            "minecraft:birch_slab",           // 130
            "minecraft:jungle_slab",          // 131
            "minecraft:acacia_slab",          // 132
            "minecraft:dark_oak_slab",        // 133
            "minecraft:mangrove_slab",        // 134
            "minecraft:cherry_slab",          // 135
            "minecraft:bamboo_slab",          // 136
            "minecraft:crimson_slab",         // 137
            "minecraft:warped_slab",          // 138
            "minecraft:normal_stone_slab",    // 139
            "minecraft:cobblestone_slab",     // 140
            "minecraft:stone_brick_slab",     // 141
            "minecraft:brick_slab",           // 142
            "minecraft:sandstone_slab",       // 143

            // Group 9: Glass panes (indices 144-159)
            "minecraft:glass_pane",           // 144
            "minecraft:white_stained_glass_pane",  // 145
            "minecraft:orange_stained_glass_pane", // 146
            "minecraft:magenta_stained_glass_pane", // 147
            "minecraft:light_blue_stained_glass_pane", // 148
            "minecraft:yellow_stained_glass_pane", // 149
            "minecraft:lime_stained_glass_pane",   // 150
            "minecraft:pink_stained_glass_pane",   // 151
            "minecraft:gray_stained_glass_pane",   // 152
            "minecraft:light_gray_stained_glass_pane", // 153
            "minecraft:cyan_stained_glass_pane",   // 154
            "minecraft:purple_stained_glass_pane", // 155
            "minecraft:blue_stained_glass_pane",   // 156
            "minecraft:brown_stained_glass_pane",  // 157
            "minecraft:green_stained_glass_pane",  // 158
            "minecraft:red_stained_glass_pane",    // 159

            // Group 10: Slabs batch 2 (indices 160-175)
            "minecraft:smooth_stone_slab",    // 160
            "minecraft:nether_brick_slab",    // 161
            "minecraft:quartz_slab",          // 162
            "minecraft:red_sandstone_slab",   // 163
            "minecraft:prismarine_slab",      // 164
            "minecraft:dark_prismarine_slab", // 165
            "minecraft:prismarine_brick_slab", // 166
            "minecraft:mossy_cobblestone_slab", // 167
            "minecraft:smooth_sandstone_slab", // 168
            "minecraft:red_nether_brick_slab", // 169
            "minecraft:end_stone_brick_slab", // 170
            "minecraft:andesite_slab",        // 171
            "minecraft:polished_andesite_slab", // 172
            "minecraft:diorite_slab",         // 173
            "minecraft:polished_diorite_slab", // 174
            "minecraft:granite_slab",         // 175

            // Group 11: Slabs batch 3 (indices 176-191)
            "minecraft:polished_granite_slab", // 176
            "minecraft:mossy_stone_brick_slab", // 177
            "minecraft:smooth_quartz_slab",   // 178
            "minecraft:cut_sandstone_slab",   // 179
            "minecraft:cut_red_sandstone_slab", // 180
            "minecraft:smooth_red_sandstone_slab", // 181
            "minecraft:cobbled_deepslate_slab", // 182
            "minecraft:polished_deepslate_slab", // 183
            "minecraft:deepslate_tile_slab",  // 184
            "minecraft:deepslate_brick_slab", // 185
            "minecraft:mud_brick_slab",       // 186
            "minecraft:blackstone_slab",      // 187
            "minecraft:polished_blackstone_slab", // 188
            "minecraft:polished_blackstone_brick_slab", // 189
            "minecraft:tuff_slab",            // 190
            "minecraft:tuff_brick_slab",      // 191

            // Group 12: Slabs batch 4 (indices 192-207)
            "minecraft:polished_tuff_slab",   // 192
            "minecraft:bamboo_mosaic_slab",   // 193
            "minecraft:pale_oak_slab",        // 194
            "minecraft:resin_brick_slab",     // 195
            "minecraft:purpur_slab",          // 196
            "minecraft:cut_copper_slab",      // 197
            "minecraft:exposed_cut_copper_slab", // 198
            "minecraft:weathered_cut_copper_slab", // 199
            "minecraft:oxidized_cut_copper_slab", // 200
            "minecraft:waxed_cut_copper_slab", // 201
            "minecraft:waxed_exposed_cut_copper_slab", // 202
            "minecraft:waxed_weathered_cut_copper_slab", // 203
            "minecraft:waxed_oxidized_cut_copper_slab", // 204
            null,                             // 205 (reserved)
            null,                             // 206 (reserved)
            null,                             // 207 (reserved)
    };

    // -------------------------------------------------------------------------
    // Geometry classes
    // -------------------------------------------------------------------------

    public static final String[] GEOMETRY_INDEX = {
            "minecraft:geometry.full_block",       // 0
            "geometry.bigdoors.fence_solo",        // 1
            "geometry.bigdoors.fence_before",      // 2
            "geometry.bigdoors.fence_after",       // 3
            "geometry.bigdoors.fence_both",        // 4
            "geometry.bigdoors.bars",              // 5
            "geometry.bigdoors.slab",              // 6
            "geometry.bigdoors.pane",              // 7
            "geometry.bigdoors.slab_top",          // 8
            "geometry.bigdoors.bars_solo",         // 9
            "geometry.bigdoors.bars_before",       // 10
            "geometry.bigdoors.bars_after",        // 11
            "geometry.bigdoors.pane_solo",         // 12
            "geometry.bigdoors.pane_before",       // 13
            "geometry.bigdoors.pane_after",        // 14
    };

    public static final int GEOMETRY_CLASS_FENCE = 1;
    public static final int GEOMETRY_CLASS_BARS = 5;
    public static final int GEOMETRY_CLASS_SLAB = 6;
    public static final int GEOMETRY_CLASS_PANE = 7;
    public static final int GEOMETRY_ID_SLAB_TOP = 8;

    public static boolean isSlabGeometryId(int geoId) {
        return geoId == GEOMETRY_CLASS_SLAB || geoId == GEOMETRY_ID_SLAB_TOP;
    }

    public static String panelBlockIdForGeoClass(int geoClass) {
        return switch (geoClass) {
            case GEOMETRY_CLASS_FENCE -> PANEL_FENCE_BLOCK_ID;
            case GEOMETRY_CLASS_BARS -> PANEL_BARS_BLOCK_ID;
            case GEOMETRY_CLASS_PANE -> PANEL_PANE_BLOCK_ID;
            case GEOMETRY_CLASS_SLAB -> PANEL_SLAB_BLOCK_ID;
            default -> PANEL_BLOCK_ID;
        };
    }

    // -------------------------------------------------------------------------
    // Material-to-geometry-class mapping
    // -------------------------------------------------------------------------

    public static final Map<Integer, Integer> MATERIAL_GEOMETRY_CLASS;
    static {
        MATERIAL_GEOMETRY_CLASS = new HashMap<>();
        // Fences (80-91)
        for (int i = 80; i <= 91; i++) MATERIAL_GEOMETRY_CLASS.put(i, GEOMETRY_CLASS_FENCE);
        // Iron bars (92)
        MATERIAL_GEOMETRY_CLASS.put(92, GEOMETRY_CLASS_BARS);
        // Slabs group 8 (128-143)
        for (int i = 128; i <= 143; i++) MATERIAL_GEOMETRY_CLASS.put(i, GEOMETRY_CLASS_SLAB);
        // Glass panes (144-159)
        for (int i = 144; i <= 159; i++) MATERIAL_GEOMETRY_CLASS.put(i, GEOMETRY_CLASS_PANE);
        // Slabs group 10 (160-175)
        for (int i = 160; i <= 175; i++) MATERIAL_GEOMETRY_CLASS.put(i, GEOMETRY_CLASS_SLAB);
        // Slabs group 11 (176-191)
        for (int i = 176; i <= 191; i++) MATERIAL_GEOMETRY_CLASS.put(i, GEOMETRY_CLASS_SLAB);
        // Slabs group 12 (192-204)
        for (int i = 192; i <= 204; i++) MATERIAL_GEOMETRY_CLASS.put(i, GEOMETRY_CLASS_SLAB);
    }
}
