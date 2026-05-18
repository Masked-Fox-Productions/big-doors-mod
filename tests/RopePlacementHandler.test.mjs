import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { RopeManager } from "../bigdoors_bp/scripts/ropes/RopeManager.js";
import { RopePlacementHandler } from "../bigdoors_bp/scripts/ropes/handler/RopePlacementHandler.js";

function makeBlock(typeId, pos, face, stateKey) {
  const states = {};
  if (stateKey) states[stateKey] = face;
  states["ropes:face"] = face;
  const block = {
    typeId,
    location: { ...pos },
    dimension: {
      id: "minecraft:overworld",
      getBlock(p) { return null; },
    },
    permutation: {
      getState(name) { return states[name] ?? null; },
    },
    setPermutation(perm) {
      block.permutation = perm;
    },
  };
  return block;
}

describe("RopePlacementHandler", () => {
  let mgr;
  let handler;

  beforeEach(() => {
    __reset();
    mgr = new RopeManager();
    handler = new RopePlacementHandler(mgr);
  });

  it("placing rope on wall face creates chain with correct face and type", () => {
    const block = makeBlock("ropes:rope", { x: 5, y: 64, z: 5 }, "north", "ropes:rope_state");
    handler._onPlace(block, {}, block.dimension);

    const chain = mgr.getChainAtPosition("minecraft:overworld", { x: 5, y: 64, z: 5 });
    assert.ok(chain);
    assert.equal(chain.type, "rope");
    assert.equal(chain.anchorFace, "north");
    assert.equal(chain.totalSegments, 0);
  });

  it("placing rope ladder creates chain with rope_ladder type", () => {
    const block = makeBlock("ropes:rope_ladder", { x: 3, y: 64, z: 3 }, "east", "ropes:ladder_state");
    handler._onPlace(block, {}, block.dimension);

    const chain = mgr.getChainAtPosition("minecraft:overworld", { x: 3, y: 64, z: 3 });
    assert.ok(chain);
    assert.equal(chain.type, "rope_ladder");
  });

  it("placing rope below existing extended rope adds segment to chain", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 5, y: 64, z: 5 }, "up", 5);
    chain.extendDrop(0, [{ x: 5, y: 63, z: 5 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 5, y: 63, z: 5 });

    const block = makeBlock("ropes:rope", { x: 5, y: 62, z: 5 }, "up", "ropes:rope_state");
    handler._onPlace(block, {}, block.dimension);

    const found = mgr.getChainAtPosition("minecraft:overworld", { x: 5, y: 62, z: 5 });
    assert.equal(found, chain);
    assert.equal(chain.drops[0].segments.length, 2);
  });

  it("placing rope not adjacent to any chain creates new standalone chain", () => {
    mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);

    const block = makeBlock("ropes:rope", { x: 100, y: 64, z: 100 }, "up", "ropes:rope_state");
    handler._onPlace(block, {}, block.dimension);

    const chain = mgr.getChainAtPosition("minecraft:overworld", { x: 100, y: 64, z: 100 });
    assert.ok(chain);
    assert.notEqual(chain.id, "rope_1");
  });

  it("placing rope adjacent to chain but not directly below creates new chain", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 5, y: 64, z: 5 }, "up", 5);
    chain.extendDrop(0, [{ x: 5, y: 63, z: 5 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 5, y: 63, z: 5 });

    const block = makeBlock("ropes:rope", { x: 6, y: 63, z: 5 }, "up", "ropes:rope_state");
    handler._onPlace(block, {}, block.dimension);

    const found = mgr.getChainAtPosition("minecraft:overworld", { x: 6, y: 63, z: 5 });
    assert.ok(found);
    assert.notEqual(found.id, chain.id);
  });

  it("placing rope below coiled anchor joins chain as segment", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 5, y: 64, z: 5 }, "up", 0);

    const block = makeBlock("ropes:rope", { x: 5, y: 63, z: 5 }, "up", "ropes:rope_state");
    handler._onPlace(block, {}, block.dimension);

    const found = mgr.getChainAtPosition("minecraft:overworld", { x: 5, y: 63, z: 5 });
    assert.equal(found, chain);
    assert.equal(chain.drops[0].segments.length, 1);
    assert.equal(block.permutation.getState("ropes:rope_state"), "segment");
  });

  it("placing rope above existing chain joins chain as segment", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 5, y: 63, z: 5 }, "up", 0);

    const block = makeBlock("ropes:rope", { x: 5, y: 64, z: 5 }, "up", "ropes:rope_state");
    handler._onPlace(block, {}, block.dimension);

    const found = mgr.getChainAtPosition("minecraft:overworld", { x: 5, y: 64, z: 5 });
    assert.equal(found, chain);
    assert.equal(block.permutation.getState("ropes:rope_state"), "segment");
  });

  it("placing rope ladder below coiled anchor joins chain", () => {
    const chain = mgr.createChain("rope_ladder", "minecraft:overworld", { x: 5, y: 64, z: 5 }, "north", 0);

    const block = makeBlock("ropes:rope_ladder", { x: 5, y: 63, z: 5 }, "north", "ropes:ladder_state");
    handler._onPlace(block, {}, block.dimension);

    const found = mgr.getChainAtPosition("minecraft:overworld", { x: 5, y: 63, z: 5 });
    assert.equal(found, chain);
    assert.equal(block.permutation.getState("ropes:ladder_state"), "segment");
  });

  it("placement creates chain in RopeManager and position index is updated", () => {
    const block = makeBlock("ropes:rope", { x: 10, y: 50, z: 10 }, "south", "ropes:rope_state");
    handler._onPlace(block, {}, block.dimension);

    const chain = mgr.getChainAtPosition("minecraft:overworld", { x: 10, y: 50, z: 10 });
    assert.ok(chain);
    assert.equal(chain.dimensionId, "minecraft:overworld");
  });
});
