package com.bigdoors.util;

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
    public static final String PANEL_BLOCK_ID = "bigdoors:door_panel";

    // Persistence
    public static final String PERSISTENCE_KEY = "bigdoors:state";

    // Limits
    public static final int MAX_DOOR_SCAN_RADIUS = 16;
    public static final int REDSTONE_DEBOUNCE_TICKS = 2;

    // Directions
    public static final String NORTH = "north";
    public static final String SOUTH = "south";
    public static final String EAST = "east";
    public static final String WEST = "west";

    /** Direction offsets: direction name → BlockPos3 delta. */
    public static final Map<String, BlockPos3> DIR_OFFSETS = Map.of(
            NORTH, new BlockPos3(0, 0, -1),
            SOUTH, new BlockPos3(0, 0, 1),
            EAST,  new BlockPos3(1, 0, 0),
            WEST,  new BlockPos3(-1, 0, 0)
    );

    /** Opposite direction mapping. */
    public static final Map<String, String> OPPOSITE_DIR = Map.of(
            NORTH, SOUTH,
            SOUTH, NORTH,
            EAST, WEST,
            WEST, EAST
    );

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

    /** Material index — 64 supported materials, order matches the JS source. */
    public static final String[] MATERIAL_INDEX = {
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
    };
}
