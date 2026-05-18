import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GEOMETRY_INDEX } from "../bigdoors_bp/scripts/util/Constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function readJson(rel) {
  return JSON.parse(readFileSync(resolve(ROOT, rel), "utf-8"));
}

function permsMatching(blockJson, predicate) {
  return blockJson["minecraft:block"].permutations.filter((p) =>
    predicate(p.condition)
  );
}

describe("Block JSON integrity", () => {
  const hinge = readJson("bigdoors_bp/blocks/hinge.json");
  const panel = readJson("bigdoors_bp/blocks/door_panel.json");

  describe("hinge.json", () => {
    it("horizontal mode uses strapped_sides geometry", () => {
      const perms = permsMatching(hinge, (c) => c.includes("'horizontal'"));
      assert.ok(perms.length > 0, "should have horizontal permutations");
      for (const p of perms) {
        assert.equal(
          p.components["minecraft:geometry"],
          "geometry.bigdoors.strapped_sides"
        );
      }
    });

    it("vertical mode uses strapped_sides geometry (not _v)", () => {
      const perms = permsMatching(hinge, (c) => c.includes("'vertical'"));
      assert.ok(perms.length > 0, "should have vertical permutations");
      for (const p of perms) {
        assert.equal(
          p.components["minecraft:geometry"],
          "geometry.bigdoors.strapped_sides"
        );
      }
    });

    it("vertical mode overlay references hinge_overlay_v", () => {
      const perms = permsMatching(hinge, (c) => c.includes("'vertical'"));
      for (const p of perms) {
        assert.equal(
          p.components["minecraft:material_instances"].overlay.texture,
          "bigdoors_hinge_overlay_v"
        );
      }
    });

    it("horizontal mode overlay references hinge_overlay_h", () => {
      const perms = permsMatching(hinge, (c) => c.includes("'horizontal'"));
      for (const p of perms) {
        assert.equal(
          p.components["minecraft:material_instances"].overlay.texture,
          "bigdoors_hinge_overlay_h"
        );
      }
    });

    it("unmatched (15,15) uses full_block geometry", () => {
      const perms = permsMatching(
        hinge,
        (c) => c.includes("15") && c.includes("material_group") && !c.includes("mode")
      );
      assert.ok(perms.length > 0, "should have unmatched permutation");
      for (const p of perms) {
        assert.equal(
          p.components["minecraft:geometry"],
          "minecraft:geometry.full_block"
        );
      }
    });
  });

  describe("door_panel.json", () => {
    it("rotation < 4 overlay uses panel_overlay_h", () => {
      const perms = permsMatching(
        panel,
        (c) => c.includes("overlay") && c.includes("panel_rotation") && c.includes("< 4")
      );
      assert.ok(perms.length > 0, "should have rotation < 4 overlay permutations");
      for (const p of perms) {
        assert.equal(
          p.components["minecraft:material_instances"].overlay.texture,
          "bigdoors_panel_overlay_h"
        );
      }
    });

    it("rotation >= 4 overlay uses panel_overlay_v and overlay_ew uses panel_overlay_h", () => {
      const perms = permsMatching(
        panel,
        (c) => c.includes("overlay") && c.includes("panel_rotation") && c.includes(">= 4")
      );
      assert.ok(perms.length > 0, "should have rotation >= 4 overlay permutations");
      for (const p of perms) {
        const mats = p.components["minecraft:material_instances"];
        assert.equal(mats.overlay.texture, "bigdoors_panel_overlay_v");
        assert.equal(mats.overlay_ew.texture, "bigdoors_panel_overlay_h");
      }
    });

    it("rotation >= 4 overlay uses strapped_sides_v geometry", () => {
      const perms = permsMatching(
        panel,
        (c) => c.includes("overlay") && c.includes("panel_rotation") && c.includes(">= 4")
      );
      for (const p of perms) {
        assert.equal(
          p.components["minecraft:geometry"],
          "geometry.bigdoors.strapped_sides_v"
        );
      }
    });

    it("rotation < 4 overlay uses strapped_sides geometry", () => {
      const perms = permsMatching(
        panel,
        (c) => c.includes("overlay") && c.includes("panel_rotation") && c.includes("< 4")
      );
      for (const p of perms) {
        assert.equal(
          p.components["minecraft:geometry"],
          "geometry.bigdoors.strapped_sides"
        );
      }
    });

    it("geometry_id state contains only full block values", () => {
      const states = panel["minecraft:block"].description.states["bigdoors:geometry_id"];
      assert.deepEqual(states, [0, 1]);
    });

    it("every nonzero geometry_id maps to a GEOMETRY_INDEX entry", () => {
      for (let id = 1; id <= 14; id++) {
        assert.ok(GEOMETRY_INDEX[id], `geometry_id ${id} missing from GEOMETRY_INDEX`);
      }
    });

    it("no duplicate geometry_id values in state array", () => {
      const states = panel["minecraft:block"].description.states["bigdoors:geometry_id"];
      const unique = new Set(states);
      assert.equal(unique.size, states.length, "duplicate geometry_id values found");
    });

    it("total permutation count is within Bedrock limit (65536)", () => {
      const s = panel["minecraft:block"].description.states;
      const count = s["bigdoors:material_group"].length *
                    s["bigdoors:material_id"].length *
                    s["bigdoors:geometry_id"].length *
                    s["bigdoors:panel_rotation"].length *
                    s["bigdoors:overlay"].length;
      assert.ok(count <= 65536, `permutation count ${count} exceeds 65536`);
    });
  });
});
