#!/usr/bin/env node
/**
 * Generates blockstate and model JSON files for all bigdoors block types.
 * Run: node tools/generate-blockstates.mjs
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';

const ASSETS = join(import.meta.dirname, '..', 'java-bigdoors', 'src', 'main', 'resources', 'assets', 'bigdoors');
const BLOCKSTATES = join(ASSETS, 'blockstates');
const MODELS_BLOCK = join(ASSETS, 'models', 'block');
const MODELS_ITEM = join(ASSETS, 'models', 'item');

const GROUPS = 13;  // 0-12
const IDS = 16;     // 0-15
const ROTATIONS = 8; // 0-7
const OVERLAYS = 2;  // 0-1
const GEO_VARIANTS = 16; // 0-15

const ROTATION_Y = [0, 90, 180, 270, 0, 90, 180, 270];

// Material index to vanilla texture mapping (block name, not full path)
// Extracted from Constants.java MATERIAL_INDEX
const MATERIALS = [
    // Group 0
    'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks',
    'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks',
    'bamboo_planks', 'crimson_planks', 'warped_planks', 'stone',
    'cobblestone', 'stone_bricks', 'bricks', 'iron_block',
    // Group 1
    'mossy_cobblestone', 'mossy_stone_bricks', 'cracked_stone_bricks', 'sandstone',
    'red_sandstone', 'deepslate', 'cobbled_deepslate', 'deepslate_bricks',
    'deepslate_tiles', 'polished_deepslate', 'granite', 'diorite',
    'andesite', 'prismarine', 'purpur_block', 'end_stone_bricks',
    // Group 2
    'white_wool', 'orange_wool', 'magenta_wool', 'light_blue_wool',
    'yellow_wool', 'lime_wool', 'pink_wool', 'gray_wool',
    'light_gray_wool', 'cyan_wool', 'purple_wool', 'blue_wool',
    'brown_wool', 'green_wool', 'red_wool', 'black_wool',
    // Group 3
    'white_concrete', 'orange_concrete', 'magenta_concrete', 'light_blue_concrete',
    'yellow_concrete', 'lime_concrete', 'pink_concrete', 'gray_concrete',
    'light_gray_concrete', 'cyan_concrete', 'purple_concrete', 'blue_concrete',
    'brown_concrete', 'green_concrete', 'red_concrete', 'black_concrete',
    // Group 4
    'oak_log', 'spruce_log', 'birch_log', 'jungle_log',
    'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log',
    'bamboo_block', 'crimson_stem', 'warped_stem', 'dirt',
    'coarse_dirt', 'mud', 'clay', 'packed_mud',
    // Group 5: fences + bars + misc
    'oak_fence', 'spruce_fence', 'birch_fence', 'jungle_fence',
    'acacia_fence', 'dark_oak_fence', 'mangrove_fence', 'cherry_fence',
    'bamboo_fence', 'crimson_fence', 'warped_fence', 'nether_brick_fence',
    'iron_bars', 'glass', 'tinted_glass', 'copper_block',
    // Group 6: terracotta
    'terracotta', 'white_terracotta', 'orange_terracotta', 'magenta_terracotta',
    'light_blue_terracotta', 'yellow_terracotta', 'lime_terracotta', 'pink_terracotta',
    'gray_terracotta', 'light_gray_terracotta', 'cyan_terracotta', 'purple_terracotta',
    'blue_terracotta', 'brown_terracotta', 'green_terracotta', 'red_terracotta',
    // Group 7: metals/gems
    'gold_block', 'diamond_block', 'emerald_block', 'lapis_block',
    'netherite_block', 'copper_bulb', 'cut_copper', 'quartz_block',
    'smooth_quartz', 'obsidian', 'blackstone', 'polished_blackstone',
    'polished_blackstone_bricks', 'tuff', 'tuff_bricks', 'mud_bricks',
    // Group 8: slabs batch 1
    'oak_slab', 'spruce_slab', 'birch_slab', 'jungle_slab',
    'acacia_slab', 'dark_oak_slab', 'mangrove_slab', 'cherry_slab',
    'bamboo_slab', 'crimson_slab', 'warped_slab', 'normal_stone_slab',
    'cobblestone_slab', 'stone_brick_slab', 'brick_slab', 'sandstone_slab',
    // Group 9: glass panes
    'glass_pane', 'white_stained_glass_pane', 'orange_stained_glass_pane', 'magenta_stained_glass_pane',
    'light_blue_stained_glass_pane', 'yellow_stained_glass_pane', 'lime_stained_glass_pane', 'pink_stained_glass_pane',
    'gray_stained_glass_pane', 'light_gray_stained_glass_pane', 'cyan_stained_glass_pane', 'purple_stained_glass_pane',
    'blue_stained_glass_pane', 'brown_stained_glass_pane', 'green_stained_glass_pane', 'red_stained_glass_pane',
    // Group 10: slabs batch 2
    'smooth_stone_slab', 'nether_brick_slab', 'quartz_slab', 'red_sandstone_slab',
    'prismarine_slab', 'dark_prismarine_slab', 'prismarine_brick_slab', 'mossy_cobblestone_slab',
    'smooth_sandstone_slab', 'red_nether_brick_slab', 'end_stone_brick_slab', 'andesite_slab',
    'polished_andesite_slab', 'diorite_slab', 'polished_diorite_slab', 'granite_slab',
    // Group 11: slabs batch 3
    'polished_granite_slab', 'mossy_stone_brick_slab', 'smooth_quartz_slab', 'cut_sandstone_slab',
    'cut_red_sandstone_slab', 'smooth_red_sandstone_slab', 'cobbled_deepslate_slab', 'polished_deepslate_slab',
    'deepslate_tile_slab', 'deepslate_brick_slab', 'mud_brick_slab', 'blackstone_slab',
    'polished_blackstone_slab', 'polished_blackstone_brick_slab', 'tuff_slab', 'tuff_brick_slab',
    // Group 12: slabs batch 4
    'polished_tuff_slab', 'bamboo_mosaic_slab', 'pale_oak_slab', 'resin_brick_slab',
    'purpur_slab', 'cut_copper_slab', 'exposed_cut_copper_slab', 'weathered_cut_copper_slab',
    'oxidized_cut_copper_slab', 'waxed_cut_copper_slab', 'waxed_exposed_cut_copper_slab', 'waxed_weathered_cut_copper_slab',
    'waxed_oxidized_cut_copper_slab', null, null, null,
];

// Map material name to its texture path in vanilla
// Most blocks use minecraft:block/<name> but some special cases exist
function textureForMaterial(name) {
    if (!name) return 'bigdoors:block/missing_material';

    // Slabs use the planks/block texture, not a slab-specific texture
    const SLAB_TEXTURE_MAP = {
        'oak_slab': 'oak_planks', 'spruce_slab': 'spruce_planks', 'birch_slab': 'birch_planks',
        'jungle_slab': 'jungle_planks', 'acacia_slab': 'acacia_planks', 'dark_oak_slab': 'dark_oak_planks',
        'mangrove_slab': 'mangrove_planks', 'cherry_slab': 'cherry_planks', 'bamboo_slab': 'bamboo_planks',
        'crimson_slab': 'crimson_planks', 'warped_slab': 'warped_planks',
        'normal_stone_slab': 'stone', 'cobblestone_slab': 'cobblestone',
        'stone_brick_slab': 'stone_bricks', 'brick_slab': 'bricks',
        'sandstone_slab': 'sandstone', 'smooth_stone_slab': 'smooth_stone',
        'nether_brick_slab': 'nether_bricks', 'quartz_slab': 'quartz_block_side',
        'red_sandstone_slab': 'red_sandstone', 'prismarine_slab': 'prismarine',
        'dark_prismarine_slab': 'dark_prismarine', 'prismarine_brick_slab': 'prismarine_bricks',
        'mossy_cobblestone_slab': 'mossy_cobblestone', 'smooth_sandstone_slab': 'sandstone_top',
        'red_nether_brick_slab': 'red_nether_bricks', 'end_stone_brick_slab': 'end_stone_bricks',
        'andesite_slab': 'andesite', 'polished_andesite_slab': 'polished_andesite',
        'diorite_slab': 'diorite', 'polished_diorite_slab': 'polished_diorite',
        'granite_slab': 'granite', 'polished_granite_slab': 'polished_granite',
        'mossy_stone_brick_slab': 'mossy_stone_bricks', 'smooth_quartz_slab': 'quartz_block_bottom',
        'cut_sandstone_slab': 'cut_sandstone', 'cut_red_sandstone_slab': 'cut_red_sandstone',
        'smooth_red_sandstone_slab': 'red_sandstone_top',
        'cobbled_deepslate_slab': 'cobbled_deepslate', 'polished_deepslate_slab': 'polished_deepslate',
        'deepslate_tile_slab': 'deepslate_tiles', 'deepslate_brick_slab': 'deepslate_bricks',
        'mud_brick_slab': 'mud_bricks', 'blackstone_slab': 'blackstone',
        'polished_blackstone_slab': 'polished_blackstone',
        'polished_blackstone_brick_slab': 'polished_blackstone_bricks',
        'tuff_slab': 'tuff', 'tuff_brick_slab': 'tuff_bricks',
        'polished_tuff_slab': 'polished_tuff', 'bamboo_mosaic_slab': 'bamboo_mosaic',
        'pale_oak_slab': 'pale_oak_planks', 'resin_brick_slab': 'resin_bricks',
        'purpur_slab': 'purpur_block', 'cut_copper_slab': 'cut_copper',
        'exposed_cut_copper_slab': 'exposed_cut_copper', 'weathered_cut_copper_slab': 'weathered_cut_copper',
        'oxidized_cut_copper_slab': 'oxidized_cut_copper', 'waxed_cut_copper_slab': 'cut_copper',
        'waxed_exposed_cut_copper_slab': 'exposed_cut_copper',
        'waxed_weathered_cut_copper_slab': 'weathered_cut_copper',
        'waxed_oxidized_cut_copper_slab': 'oxidized_cut_copper',
    };

    // Fences use their corresponding planks texture
    const FENCE_TEXTURE_MAP = {
        'oak_fence': 'oak_planks', 'spruce_fence': 'spruce_planks', 'birch_fence': 'birch_planks',
        'jungle_fence': 'jungle_planks', 'acacia_fence': 'acacia_planks', 'dark_oak_fence': 'dark_oak_planks',
        'mangrove_fence': 'mangrove_planks', 'cherry_fence': 'cherry_planks', 'bamboo_fence': 'bamboo_planks',
        'crimson_fence': 'crimson_planks', 'warped_fence': 'warped_planks', 'nether_brick_fence': 'nether_bricks',
    };

    // Glass panes use the glass block texture
    const PANE_TEXTURE_MAP = {
        'glass_pane': 'glass',
        'white_stained_glass_pane': 'white_stained_glass',
        'orange_stained_glass_pane': 'orange_stained_glass',
        'magenta_stained_glass_pane': 'magenta_stained_glass',
        'light_blue_stained_glass_pane': 'light_blue_stained_glass',
        'yellow_stained_glass_pane': 'yellow_stained_glass',
        'lime_stained_glass_pane': 'lime_stained_glass',
        'pink_stained_glass_pane': 'pink_stained_glass',
        'gray_stained_glass_pane': 'gray_stained_glass',
        'light_gray_stained_glass_pane': 'light_gray_stained_glass',
        'cyan_stained_glass_pane': 'cyan_stained_glass',
        'purple_stained_glass_pane': 'purple_stained_glass',
        'blue_stained_glass_pane': 'blue_stained_glass',
        'brown_stained_glass_pane': 'brown_stained_glass',
        'green_stained_glass_pane': 'green_stained_glass',
        'red_stained_glass_pane': 'red_stained_glass',
    };

    if (SLAB_TEXTURE_MAP[name]) return `minecraft:block/${SLAB_TEXTURE_MAP[name]}`;
    if (FENCE_TEXTURE_MAP[name]) return `minecraft:block/${FENCE_TEXTURE_MAP[name]}`;
    if (PANE_TEXTURE_MAP[name]) return `minecraft:block/${PANE_TEXTURE_MAP[name]}`;

    // iron_bars uses iron_bars texture
    if (name === 'iron_bars') return 'minecraft:block/iron_bars';

    return `minecraft:block/${name}`;
}

function ensureDir(dir) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function writeJson(path, obj) {
    ensureDir(dirname(path));
    writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
}

function modelPath(blockType, group, id) {
    return `bigdoors:block/${blockType}/${group}_${id}`;
}

// --- Generate door_panel blockstate ---
function generateDoorPanel() {
    const variants = {};
    for (let g = 0; g < GROUPS; g++) {
        for (let id = 0; id < IDS; id++) {
            const flatIdx = g * 16 + id;
            const mat = MATERIALS[flatIdx];
            const model = mat ? modelPath('door_panel', g, id) : 'bigdoors:block/missing_material';

            for (let rot = 0; rot < ROTATIONS; rot++) {
                for (let ov = 0; ov < OVERLAYS; ov++) {
                    const key = `material_group=${g},material_id=${id},overlay=${ov},panel_rotation=${rot},powered=false`;
                    const key2 = `material_group=${g},material_id=${id},overlay=${ov},panel_rotation=${rot},powered=true`;
                    const entry = { model };
                    if (ROTATION_Y[rot] !== 0) entry.y = ROTATION_Y[rot];
                    variants[key] = entry;
                    variants[key2] = entry;
                }
            }

            // Generate model file
            if (mat) {
                writeJson(join(MODELS_BLOCK, 'door_panel', `${g}_${id}.json`), {
                    parent: 'minecraft:block/cube_all',
                    textures: { all: textureForMaterial(mat) }
                });
            }
        }
    }

    writeJson(join(BLOCKSTATES, 'door_panel.json'), { variants });
}

// --- Generate exotic panel blockstates ---
function generateExoticPanel(blockType) {
    const variants = {};
    for (let g = 0; g < GROUPS; g++) {
        for (let id = 0; id < IDS; id++) {
            const flatIdx = g * 16 + id;
            const mat = MATERIALS[flatIdx];
            const model = mat ? modelPath(blockType, g, id) : 'bigdoors:block/missing_material';

            for (let rot = 0; rot < ROTATIONS; rot++) {
                for (let ov = 0; ov < OVERLAYS; ov++) {
                    for (let gv = 0; gv < GEO_VARIANTS; gv++) {
                        const key = `geometry_variant=${gv},material_group=${g},material_id=${id},overlay=${ov},panel_rotation=${rot},powered=false`;
                        const key2 = `geometry_variant=${gv},material_group=${g},material_id=${id},overlay=${ov},panel_rotation=${rot},powered=true`;
                        const entry = { model };
                        if (ROTATION_Y[rot] !== 0) entry.y = ROTATION_Y[rot];
                        variants[key] = entry;
                        variants[key2] = entry;
                    }
                }
            }

            // Generate model file
            if (mat) {
                const parentMap = {
                    'door_panel_fence': 'minecraft:block/fence_post',
                    'door_panel_bars': 'minecraft:block/cube_all',
                    'door_panel_pane': 'minecraft:block/cube_all',
                    'door_panel_slab': 'minecraft:block/slab',
                };
                const parent = parentMap[blockType] || 'minecraft:block/cube_all';
                const tex = textureForMaterial(mat);

                if (blockType === 'door_panel_slab') {
                    writeJson(join(MODELS_BLOCK, blockType, `${g}_${id}.json`), {
                        parent: 'minecraft:block/slab',
                        textures: { bottom: tex, top: tex, side: tex }
                    });
                } else if (blockType === 'door_panel_fence') {
                    writeJson(join(MODELS_BLOCK, blockType, `${g}_${id}.json`), {
                        parent: 'minecraft:block/fence_post',
                        textures: { texture: tex }
                    });
                } else {
                    writeJson(join(MODELS_BLOCK, blockType, `${g}_${id}.json`), {
                        parent: 'minecraft:block/cube_all',
                        textures: { all: tex }
                    });
                }
            }
        }
    }

    writeJson(join(BLOCKSTATES, `${blockType}.json`), { variants });
}

// --- Generate hidden_hinge blockstate ---
function generateHiddenHinge() {
    const facings = ['north', 'south', 'west', 'east'];
    const facingY = { north: 0, south: 180, west: 270, east: 90 };
    const modes = ['horizontal', 'vertical'];
    const variants = {};

    for (const facing of facings) {
        for (const mode of modes) {
            for (const powered of [false, true]) {
                // Unmatched
                for (let g = 0; g < GROUPS; g++) {
                    for (let id = 0; id < IDS; id++) {
                        const key = `facing=${facing},matched=false,material_group=${g},material_id=${id},mode=${mode},powered=${powered}`;
                        const entry = { model: 'bigdoors:block/hidden_hinge_unmatched' };
                        if (facingY[facing] !== 0) entry.y = facingY[facing];
                        variants[key] = entry;
                    }
                }

                // Matched
                for (let g = 0; g < GROUPS; g++) {
                    for (let id = 0; id < IDS; id++) {
                        const flatIdx = g * 16 + id;
                        const mat = MATERIALS[flatIdx];
                        const model = mat
                            ? modelPath('hidden_hinge', g, id)
                            : 'bigdoors:block/missing_material';

                        const key = `facing=${facing},matched=true,material_group=${g},material_id=${id},mode=${mode},powered=${powered}`;
                        const entry = { model };
                        if (facingY[facing] !== 0) entry.y = facingY[facing];
                        variants[key] = entry;
                    }
                }
            }
        }
    }

    // Generate model files for matched materials
    for (let g = 0; g < GROUPS; g++) {
        for (let id = 0; id < IDS; id++) {
            const flatIdx = g * 16 + id;
            const mat = MATERIALS[flatIdx];
            if (mat) {
                writeJson(join(MODELS_BLOCK, 'hidden_hinge', `${g}_${id}.json`), {
                    parent: 'minecraft:block/cube_all',
                    textures: { all: textureForMaterial(mat) }
                });
            }
        }
    }

    // Unmatched model
    writeJson(join(MODELS_BLOCK, 'hidden_hinge_unmatched.json'), {
        parent: 'minecraft:block/cube_all',
        textures: { all: 'bigdoors:block/hidden_hinge_unmatched' }
    });

    writeJson(join(BLOCKSTATES, 'hidden_hinge.json'), { variants });
}

// --- Generate missing material model ---
function generateMissingMaterial() {
    writeJson(join(MODELS_BLOCK, 'missing_material.json'), {
        parent: 'minecraft:block/cube_all',
        textures: { all: 'minecraft:block/missing' }
    });
}

// --- Generate item models ---
function generateItemModels() {
    const items = [
        ['door_panel', 'bigdoors:block/door_panel/0_0'],
        ['door_panel_fence', 'bigdoors:block/door_panel_fence/0_0'],
        ['door_panel_bars', 'bigdoors:block/door_panel_bars/0_0'],
        ['door_panel_pane', 'bigdoors:block/door_panel_pane/0_0'],
        ['door_panel_slab', 'bigdoors:block/door_panel_slab/0_0'],
        ['hidden_hinge', 'bigdoors:block/hidden_hinge_unmatched'],
    ];

    for (const [name, parent] of items) {
        writeJson(join(MODELS_ITEM, `${name}.json`), { parent });
    }
}

// --- Main ---
console.log('Generating blockstate and model files...');

// Clean old numbered models
const oldModelDir = join(MODELS_BLOCK, 'door_panel');
if (existsSync(oldModelDir)) {
    for (const f of readdirSync(oldModelDir)) {
        if (/^\d+\.json$/.test(f)) rmSync(join(oldModelDir, f));
    }
}

generateMissingMaterial();
generateDoorPanel();
generateExoticPanel('door_panel_fence');
generateExoticPanel('door_panel_bars');
generateExoticPanel('door_panel_pane');
generateExoticPanel('door_panel_slab');
generateHiddenHinge();
generateItemModels();

// Lang
const langPath = join(ASSETS, 'lang', 'en_us.json');
ensureDir(dirname(langPath));
let lang = {};
try {
    lang = JSON.parse(readFileSync(langPath, 'utf8'));
} catch { /* start fresh */ }
Object.assign(lang, {
    'block.bigdoors.door_panel': 'Door Panel',
    'block.bigdoors.door_panel_fence': 'Door Panel (Fence)',
    'block.bigdoors.door_panel_bars': 'Door Panel (Bars)',
    'block.bigdoors.door_panel_pane': 'Door Panel (Pane)',
    'block.bigdoors.door_panel_slab': 'Door Panel (Slab)',
    'block.bigdoors.hidden_hinge': 'Hidden Hinge',
    'block.bigdoors.hinge': 'Hinge',
});
writeJson(langPath, lang);

console.log('Done. Generated blockstate, model, and lang files.');
