import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyBlock,
  checkPath,
} from "../bigdoors_bp/scripts/domain/ObstructionChecker.js";

describe("classifyBlock", () => {
  it("returns 'air' for null/undefined", () => {
    assert.equal(classifyBlock(null), "air");
    assert.equal(classifyBlock(undefined), "air");
  });

  it("returns 'air' for air blocks", () => {
    assert.equal(classifyBlock("minecraft:air"), "air");
    assert.equal(classifyBlock("minecraft:cave_air"), "air");
  });

  it("returns 'soft' for grass", () => {
    assert.equal(classifyBlock("minecraft:short_grass"), "soft");
  });

  it("returns 'soft' for flowers", () => {
    assert.equal(classifyBlock("minecraft:poppy"), "soft");
    assert.equal(classifyBlock("minecraft:dandelion"), "soft");
  });

  it("returns 'soft' for snow layer", () => {
    assert.equal(classifyBlock("minecraft:snow_layer"), "soft");
  });

  it("returns 'passable' for signs", () => {
    assert.equal(classifyBlock("minecraft:oak_sign"), "passable");
  });

  it("returns 'passable' for torches", () => {
    assert.equal(classifyBlock("minecraft:torch"), "passable");
    assert.equal(classifyBlock("minecraft:soul_torch"), "passable");
  });

  it("returns 'passable' for doors", () => {
    assert.equal(classifyBlock("minecraft:wooden_door"), "passable");
  });

  it("returns 'passable' for buttons and levers", () => {
    assert.equal(classifyBlock("minecraft:wooden_button"), "passable");
    assert.equal(classifyBlock("minecraft:lever"), "passable");
  });

  it("returns 'solid' for stone", () => {
    assert.equal(classifyBlock("minecraft:stone"), "solid");
  });

  it("returns 'solid' for cobblestone", () => {
    assert.equal(classifyBlock("minecraft:cobblestone"), "solid");
  });

  it("returns 'solid' for unknown blocks", () => {
    assert.equal(classifyBlock("minecraft:diamond_block"), "solid");
    assert.equal(classifyBlock("somemod:custom_block"), "solid");
  });
});

describe("checkPath", () => {
  const hinge = { x: 0, y: 0, z: 0 };

  it("returns canOpen:true when all destinations are air", () => {
    const panels = [
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ];
    const blockQuery = (_pos) => null; // all air

    const result = checkPath(panels, hinge, "cw", blockQuery);
    assert.equal(result.canOpen, true);
    assert.equal(result.obstructedPositions.length, 0);
    assert.equal(result.softBlocks.length, 0);
    assert.equal(result.passableBlocks.length, 0);
  });

  it("returns canOpen:false when any destination is solid", () => {
    const panels = [
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ];
    // CW: (1,0,0) → (0,0,1), (2,0,0) → (0,0,2)
    const blockQuery = (pos) => {
      if (pos.x === 0 && pos.z === 2) return "minecraft:stone";
      return null;
    };

    const result = checkPath(panels, hinge, "cw", blockQuery);
    assert.equal(result.canOpen, false);
    assert.equal(result.obstructedPositions.length, 1);
  });

  it("returns soft/passable lists for mixed destinations", () => {
    const panels = [
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
    ];
    // CW: (1,0,0)→(0,0,1), (2,0,0)→(0,0,2), (3,0,0)→(0,0,3)
    const blockQuery = (pos) => {
      if (pos.z === 1) return "minecraft:short_grass"; // soft
      if (pos.z === 2) return "minecraft:torch";       // passable
      return null;                                      // air
    };

    const result = checkPath(panels, hinge, "cw", blockQuery);
    assert.equal(result.canOpen, true);
    assert.equal(result.softBlocks.length, 1);
    assert.equal(result.passableBlocks.length, 1);
  });

  it("handles CCW direction correctly", () => {
    const panels = [{ x: 1, y: 0, z: 0 }];
    // CCW: (1,0,0) → (0,0,-1)
    const blockQuery = (pos) => {
      if (pos.z === -1) return "minecraft:stone";
      return null;
    };

    const result = checkPath(panels, hinge, "ccw", blockQuery);
    assert.equal(result.canOpen, false);
    assert.equal(result.obstructedPositions.length, 1);
  });

  it("does not flag current panel positions as obstructions", () => {
    // A door with panels at (1,0,0) and (0,0,1).
    // CW rotation of (1,0,0) → (0,0,1) — which is a current panel position.
    // Since that panel will also vacate, it should not be flagged.
    const panels = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    ];
    const blockQuery = (_pos) => null;

    const result = checkPath(panels, hinge, "cw", blockQuery);
    assert.equal(result.canOpen, true);
  });

  it("returns empty lists for a door with no panels", () => {
    const result = checkPath([], hinge, "cw", () => null);
    assert.equal(result.canOpen, true);
    assert.equal(result.obstructedPositions.length, 0);
  });
});
