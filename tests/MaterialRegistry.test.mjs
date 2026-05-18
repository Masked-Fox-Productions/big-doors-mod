import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  indexForTypeId,
  typeIdForIndex,
  resolveGeometryId,
} from "../bigdoors_bp/scripts/domain/MaterialRegistry.js";

describe("MaterialRegistry", () => {
  it("maps cobblestone typeId to its index and back", () => {
    const idx = indexForTypeId("minecraft:cobblestone");
    assert.ok(idx >= 0, "cobblestone should have a valid index");
    assert.equal(typeIdForIndex(idx), "minecraft:cobblestone");
  });

  it("maps oak_planks (index 0) round-trip", () => {
    assert.equal(indexForTypeId("minecraft:oak_planks"), 0);
    assert.equal(typeIdForIndex(0), "minecraft:oak_planks");
  });

  it("maps iron_block (last entry) round-trip", () => {
    const idx = indexForTypeId("minecraft:iron_block");
    assert.ok(idx >= 0);
    assert.equal(typeIdForIndex(idx), "minecraft:iron_block");
  });

  it("returns -1 for an unsupported block type", () => {
    assert.equal(indexForTypeId("minecraft:sponge"), -1);
  });

  it("returns -1 for undefined input", () => {
    assert.equal(indexForTypeId(undefined), -1);
  });

  it("returns undefined for an out-of-range index", () => {
    assert.equal(typeIdForIndex(999), undefined);
    assert.equal(typeIdForIndex(-1), undefined);
  });

  it("all entries round-trip correctly", () => {
    for (let i = 0; i < 30; i++) {
      const typeId = typeIdForIndex(i);
      if (typeId === undefined) continue;
      assert.equal(indexForTypeId(typeId), i, `round-trip failed for index ${i}`);
    }
  });
});

describe("resolveGeometryId — fence", () => {
  const FENCE_MAT = indexForTypeId("minecraft:oak_fence");

  it("returns fence_both (4) with both neighbors", () => {
    assert.equal(resolveGeometryId(FENCE_MAT, true, true), 4);
  });
  it("returns fence_before (2) with only before neighbor", () => {
    assert.equal(resolveGeometryId(FENCE_MAT, true, false), 2);
  });
  it("returns fence_after (3) with only after neighbor", () => {
    assert.equal(resolveGeometryId(FENCE_MAT, false, true), 3);
  });
  it("returns fence_solo (1) with no neighbors", () => {
    assert.equal(resolveGeometryId(FENCE_MAT, false, false), 1);
  });
});

describe("resolveGeometryId — bars", () => {
  const BARS_MAT = indexForTypeId("minecraft:iron_bars");

  it("returns bars_both (5) with both neighbors", () => {
    assert.equal(resolveGeometryId(BARS_MAT, true, true), 5);
  });
  it("returns bars_solo (9) with no neighbors", () => {
    assert.equal(resolveGeometryId(BARS_MAT, false, false), 9);
  });
  it("returns bars_before (10) with only before neighbor", () => {
    assert.equal(resolveGeometryId(BARS_MAT, true, false), 10);
  });
  it("returns bars_after (11) with only after neighbor", () => {
    assert.equal(resolveGeometryId(BARS_MAT, false, true), 11);
  });
});

describe("resolveGeometryId — pane", () => {
  const PANE_MAT = indexForTypeId("minecraft:glass_pane");

  it("returns pane_both (7) with both neighbors", () => {
    assert.equal(resolveGeometryId(PANE_MAT, true, true), 7);
  });
  it("returns pane_solo (12) with no neighbors", () => {
    assert.equal(resolveGeometryId(PANE_MAT, false, false), 12);
  });
  it("returns pane_before (13) with only before neighbor", () => {
    assert.equal(resolveGeometryId(PANE_MAT, true, false), 13);
  });
  it("returns pane_after (14) with only after neighbor", () => {
    assert.equal(resolveGeometryId(PANE_MAT, false, true), 14);
  });
});

describe("resolveGeometryId — non-neighbor-aware classes", () => {
  it("returns 0 for full-block material", () => {
    const mat = indexForTypeId("minecraft:oak_planks");
    assert.equal(resolveGeometryId(mat, true, true), 0);
  });
  it("returns slab class (6) for slab material regardless of neighbors", () => {
    const mat = indexForTypeId("minecraft:oak_slab");
    assert.equal(resolveGeometryId(mat, false, false), 6);
    assert.equal(resolveGeometryId(mat, true, true), 6);
  });
});
