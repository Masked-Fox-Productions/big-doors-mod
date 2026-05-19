#!/usr/bin/env node
/**
 * Generates the permutations array for hinge.json and door_panel.json.
 *
 * Bedrock replaces the ENTIRE minecraft:material_instances component when a
 * permutation matches, so a separate "mode" or "overlay" permutation that
 * sets only the "overlay" key will clobber the "*" key set by a material
 * permutation (and vice versa).  The fix is to emit combined permutations
 * that always set BOTH keys together.
 *
 * Run:  node tools/generate-block-json.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(ROOT, relPath), "utf-8"));
}

function writeJson(relPath, obj) {
  writeFileSync(resolve(ROOT, relPath), JSON.stringify(obj, null, 2) + "\n");
}

function q(state, op, value) {
  if (typeof value === "string") return `q.block_state('bigdoors:${state}') == '${value}'`;
  return `q.block_state('bigdoors:${state}') ${op} ${value}`;
}

function matCond(group, id) {
  return `${q("material_group", "==", group)} && ${q("material_id", "==", id)}`;
}

function mi(texture, renderMethod = "alpha_test") {
  return { texture, render_method: renderMethod };
}

// ---------------------------------------------------------------------------
// Extract material texture map from an existing block JSON.
// Returns Map<"group:id", string>  e.g.  "0:0" → "oak_planks"
// ---------------------------------------------------------------------------

function extractMaterialMap(blockJson) {
  const map = new Map();
  for (const perm of blockJson["minecraft:block"].permutations) {
    const cond = perm.condition;
    if (cond.includes("overlay") || cond.includes("mode")) continue;
    const mat = perm.components?.["minecraft:material_instances"];
    if (!mat?.["*"]) continue;
    const m = cond.match(
      /material_group'\)\s*==\s*(\d+)\s*&&\s*.*material_id'\)\s*==\s*(\d+)/
    );
    if (!m) continue;
    map.set(`${m[1]}:${m[2]}`, {
      texture: mat["*"].texture,
      renderMethod: mat["*"].render_method || "alpha_test",
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Hinge generation
// ---------------------------------------------------------------------------

function generateHinge(panelTexMap) {
  const hinge = readJson("bigdoors_bp/blocks/hinge.json");
  // Use the door_panel's texture map — the hinge adopts panel material
  // appearance and must reference the same (valid) texture shortnames.
  const texMap = panelTexMap;

  // Collect non-material, non-mode permutations (facing, unmatched)
  const kept = [];
  for (const perm of hinge["minecraft:block"].permutations) {
    const cond = perm.condition;
    // Keep facing permutations
    if (cond.includes("facing")) {
      kept.push(perm);
      continue;
    }
    // Keep unmatched override (15,15 → full_block geometry)
    if (cond.includes("material_group") && cond.includes("15") && cond.includes("material_id")) {
      const m = cond.match(/material_group'\)\s*==\s*15.*material_id'\)\s*==\s*15/);
      if (m) {
        kept.push(perm);
        continue;
      }
    }
  }

  // Generate combined material+mode permutations
  const combined = [];
  const modes = [
    {
      mode: "horizontal",
      geometry: "geometry.bigdoors.strapped_sides",
      overlayTex: "bigdoors_hinge_overlay_h",
    },
    {
      mode: "vertical",
      geometry: "geometry.bigdoors.strapped_sides",
      overlayTex: "bigdoors_hinge_overlay_v",
    },
  ];

  for (const [key, { texture, renderMethod }] of texMap) {
    const [g, id] = key.split(":").map(Number);
    // Skip the unmatched entry — already kept above
    if (g === 15 && id === 15) continue;

    for (const { mode, geometry, overlayTex } of modes) {
      combined.push({
        condition: `${q("mode", "==", mode)} && ${matCond(g, id)}`,
        components: {
          "minecraft:geometry": geometry,
          "minecraft:material_instances": {
            "*": mi(texture, renderMethod),
            overlay: mi(overlayTex),
          },
        },
      });
    }
  }

  // Assemble: facing first, then combined materials, then unmatched last
  const unmatched = kept.filter((p) => p.condition.includes("material_group"));
  const facing = kept.filter((p) => p.condition.includes("facing"));
  hinge["minecraft:block"].permutations = [...facing, ...combined, ...unmatched];

  writeJson("bigdoors_bp/blocks/hinge.json", hinge);
  console.log(
    `hinge.json: ${facing.length} facing + ${combined.length} material×mode + ${unmatched.length} unmatched = ${hinge["minecraft:block"].permutations.length} permutations`
  );
}

// ---------------------------------------------------------------------------
// Winch generation — identical to hinge but targets winch.json
// ---------------------------------------------------------------------------

function generateWinch(panelTexMap) {
  const winch = readJson("bigdoors_bp/blocks/winch.json");
  const texMap = panelTexMap;

  const kept = [];
  for (const perm of winch["minecraft:block"].permutations) {
    const cond = perm.condition;
    if (cond.includes("facing")) {
      kept.push(perm);
      continue;
    }
    if (cond.includes("material_group") && cond.includes("15") && cond.includes("material_id")) {
      const m = cond.match(/material_group'\)\s*==\s*15.*material_id'\)\s*==\s*15/);
      if (m) {
        kept.push(perm);
        continue;
      }
    }
  }

  const combined = [];
  const modes = [
    {
      mode: "horizontal",
      geometry: "geometry.bigdoors.winch_h",
    },
    {
      mode: "vertical",
      geometry: "geometry.bigdoors.winch_v",
    },
  ];

  for (const [key, { texture, renderMethod }] of texMap) {
    const [g, id] = key.split(":").map(Number);
    if (g === 15 && id === 15) continue;

    for (const { mode, geometry } of modes) {
      combined.push({
        condition: `${q("mode", "==", mode)} && ${matCond(g, id)}`,
        components: {
          "minecraft:geometry": geometry,
          "minecraft:material_instances": {
            "*": mi(texture, renderMethod),
            chain: mi("bigdoors_winch_front"),
            axle: mi("bigdoors_winch_side"),
          },
        },
      });
    }
  }

  const unmatched = kept.filter((p) => p.condition.includes("material_group"));
  const facing = kept.filter((p) => p.condition.includes("facing"));
  winch["minecraft:block"].permutations = [...facing, ...combined, ...unmatched];

  writeJson("bigdoors_bp/blocks/winch.json", winch);
  console.log(
    `winch.json: ${facing.length} facing + ${combined.length} material×mode + ${unmatched.length} unmatched = ${winch["minecraft:block"].permutations.length} permutations`
  );
}

// ---------------------------------------------------------------------------
// Door panel generation
// ---------------------------------------------------------------------------

// Flat indices that use non-full-block geometry (from Constants.js)
const NON_FULL_BLOCK = new Set([
  // Fences (80-91)
  ...Array.from({ length: 12 }, (_, i) => 80 + i),
  // Iron bars (92)
  92,
  // Slabs group 8 (128-143)
  ...Array.from({ length: 16 }, (_, i) => 128 + i),
  // Glass panes group 9 (144-159)
  ...Array.from({ length: 16 }, (_, i) => 144 + i),
  // Slabs batch 2 group 10 (160-175)
  ...Array.from({ length: 16 }, (_, i) => 160 + i),
  // Slabs batch 3 group 11 (176-191)
  ...Array.from({ length: 16 }, (_, i) => 176 + i),
  // Slabs batch 4 group 12 (192-195)
  ...Array.from({ length: 4 }, (_, i) => 192 + i),
]);

function generateDoorPanel() {
  const panel = readJson("bigdoors_bp/blocks/door_panel.json");
  const texMap = extractMaterialMap(panel);

  // Keep everything EXCEPT material permutations and overlay permutations
  const kept = [];
  for (const perm of panel["minecraft:block"].permutations) {
    const cond = perm.condition;
    // Skip material permutations (they set material_instances with *)
    if (cond.includes("material_group") && cond.includes("material_id")) continue;
    // Skip overlay permutations (they set overlay material_instances)
    if (cond.includes("overlay")) continue;
    kept.push(perm);
  }

  // Generate combined material+overlay permutations
  const materialPerms = [];
  const overlayPerms = [];

  for (const [key, { texture, renderMethod }] of texMap) {
    const [g, id] = key.split(":").map(Number);
    const flatIdx = g * 16 + id;
    const isFullBlock = !NON_FULL_BLOCK.has(flatIdx);

    // Base material permutation — always present
    materialPerms.push({
      condition: matCond(g, id),
      components: {
        "minecraft:material_instances": {
          "*": mi(texture, renderMethod),
        },
      },
    });

    if (isFullBlock) {
      overlayPerms.push({
        condition: `${q("overlay", "==", 1)} && ${q("geometry_id", "==", 0)} && ${q("panel_rotation", "<", 4)} && ${matCond(g, id)}`,
        components: {
          "minecraft:geometry": "geometry.bigdoors.strapped_sides",
          "minecraft:material_instances": {
            "*": mi(texture, renderMethod),
            overlay: mi("bigdoors_panel_overlay_h"),
          },
        },
      });
      overlayPerms.push({
        condition: `${q("overlay", "==", 1)} && ${q("geometry_id", "==", 0)} && ${q("panel_rotation", ">=", 4)} && ${matCond(g, id)}`,
        components: {
          "minecraft:geometry": "geometry.bigdoors.strapped_sides_v",
          "minecraft:material_instances": {
            "*": mi(texture, renderMethod),
            overlay: mi("bigdoors_panel_overlay_v"),
            overlay_ew: mi("bigdoors_panel_overlay_h"),
          },
        },
      });
    }
  }

  // Assemble: non-material permutations, then materials, then overlay combos
  // Overlay permutations MUST come after material permutations so they win
  panel["minecraft:block"].permutations = [
    ...kept,
    ...materialPerms,
    ...overlayPerms,
  ];

  writeJson("bigdoors_bp/blocks/door_panel.json", panel);
  console.log(
    `door_panel.json: ${kept.length} structural + ${materialPerms.length} material + ${overlayPerms.length} overlay = ${panel["minecraft:block"].permutations.length} permutations`
  );
  return texMap;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Door panel first — its texture map is the canonical source for both blocks.
const panelTexMap = generateDoorPanel();
generateHinge(panelTexMap);
generateWinch(panelTexMap);
console.log("Done.");
