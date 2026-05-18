import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const blocksDir = join(__dirname, "..", "bigdoors_bp", "blocks");

const doorPanel = JSON.parse(readFileSync(join(blocksDir, "door_panel.json"), "utf8"));
const allPerms = doorPanel["minecraft:block"].permutations;

// Extract shared rotation permutations (panel_rotation == N → transformation)
const rotationPerms = allPerms.filter(p =>
  /^q\.block_state\('bigdoors:panel_rotation'\) == \d+$/.test(p.condition) &&
  p.components["minecraft:transformation"]
);

// Extract material_instances permutations (material_group + material_id only, no overlay)
const materialPerms = allPerms.filter(p =>
  /^q\.block_state\('bigdoors:material_group'\) == \d+ && q\.block_state\('bigdoors:material_id'\) == \d+$/.test(p.condition)
);

// Geometry IDs per block type (global IDs kept as-is)
const blockTypes = {
  door_panel_fence: {
    geoIds: [1, 2, 3, 4],
    geoPerms: [
      // geometry_id → geometry model
      { geoId: 1, geometry: "geometry.bigdoors.fence_solo" },
      { geoId: 2, geometry: "geometry.bigdoors.fence_before" },
      { geoId: 3, geometry: "geometry.bigdoors.fence_after" },
      { geoId: 4, geometry: "geometry.bigdoors.fence_both" },
    ],
  },
  door_panel_bars: {
    geoIds: [5, 9, 10, 11],
    geoPerms: [
      { geoId: 5, geometry: "geometry.bigdoors.bars" },
      { geoId: 9, geometry: "geometry.bigdoors.bars_solo" },
      { geoId: 10, geometry: "geometry.bigdoors.bars_before" },
      { geoId: 11, geometry: "geometry.bigdoors.bars_after" },
    ],
  },
  door_panel_pane: {
    geoIds: [7, 12, 13, 14],
    geoPerms: [
      { geoId: 7, geometry: "geometry.bigdoors.pane" },
      { geoId: 12, geometry: "geometry.bigdoors.pane_solo" },
      { geoId: 13, geometry: "geometry.bigdoors.pane_before" },
      { geoId: 14, geometry: "geometry.bigdoors.pane_after" },
    ],
  },
  door_panel_slab: {
    geoIds: [6, 8],
    geoPerms: [
      { geoId: 6, geometry: "geometry.bigdoors.slab" },
      { geoId: 8, geometry: "geometry.bigdoors.slab_top" },
    ],
  },
};

// Extract collision/selection box permutations for specific geometry IDs
function extractCollisionPerms(geoIds) {
  return allPerms.filter(p => {
    if (!p.components["minecraft:collision_box"] && !p.components["minecraft:selection_box"]) return false;
    // Check if this permutation references any of our geo IDs
    for (const id of geoIds) {
      if (p.condition.includes(`'bigdoors:geometry_id') == ${id}`)) return true;
    }
    return false;
  });
}

for (const [name, config] of Object.entries(blockTypes)) {
  const identifier = `bigdoors:${name}`;

  // Build geometry permutations
  const geometryPermutations = config.geoPerms.map(g => ({
    condition: `q.block_state('bigdoors:geometry_id') == ${g.geoId}`,
    components: { "minecraft:geometry": g.geometry },
  }));

  // Extract collision permutations for this block's geo IDs
  const collisionPermutations = extractCollisionPerms(config.geoIds);

  // Assemble all permutations in order: geometry, collision, rotation, material
  const permutations = [
    ...geometryPermutations,
    ...collisionPermutations,
    ...rotationPerms,
    ...materialPerms,
  ];

  const block = {
    format_version: "1.26.0",
    "minecraft:block": {
      description: {
        identifier,
        states: {
          "bigdoors:material_group": [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
          "bigdoors:material_id": [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
          "bigdoors:geometry_id": config.geoIds,
          "bigdoors:panel_rotation": [0,1,2,3,4,5,6,7],
          "bigdoors:overlay": [0, 1],
        },
      },
      components: {
        "minecraft:destructible_by_mining": { seconds_to_destroy: 3 },
        "minecraft:loot": "loot_tables/empty.json",
        "bigdoors:panel_component": {},
        "minecraft:redstone_consumer": {},
        "minecraft:geometry": config.geoPerms[0].geometry,
        "minecraft:material_instances": {
          "*": { texture: "oak_planks", render_method: "alpha_test" },
        },
      },
      permutations,
    },
  };

  const outPath = join(blocksDir, `${name}.json`);
  writeFileSync(outPath, JSON.stringify(block, null, 2) + "\n");

  // Calculate permutation count
  const stateProduct = 16 * 16 * config.geoIds.length * 8 * 2;
  console.log(`${name}.json: ${config.geoIds.length} geo IDs, ${stateProduct} permutations, ${permutations.length} permutation conditions`);
}

console.log("\nDone. Block JSONs generated.");
