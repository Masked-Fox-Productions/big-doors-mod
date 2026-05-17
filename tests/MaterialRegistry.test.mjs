import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  indexForTypeId,
  typeIdForIndex,
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
