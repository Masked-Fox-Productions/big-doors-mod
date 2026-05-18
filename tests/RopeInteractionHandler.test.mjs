import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { RopeManager } from "../bigdoors_bp/scripts/ropes/RopeManager.js";
import { RopeInteractionHandler } from "../bigdoors_bp/scripts/ropes/handler/RopeInteractionHandler.js";

function makeDimension(blockMap = {}) {
  return {
    id: "minecraft:overworld",
    getBlock(pos) {
      const key = `${pos.x},${pos.y},${pos.z}`;
      if (blockMap[key]) return blockMap[key];
      return {
        typeId: "minecraft:air",
        setType(t) { this.typeId = t; },
        setPermutation(p) { this._perm = p; },
      };
    },
  };
}

function makePlayer(yaw = 0, holdingItem = null) {
  return {
    getRotation() { return { x: 0, y: yaw }; },
    selectedSlotIndex: 0,
    getComponent(name) {
      if (name !== "inventory") return null;
      return {
        container: {
          getItem(slot) { return holdingItem; },
          setItem(slot, item) { holdingItem = item; },
        },
      };
    },
  };
}

function makeBlock(typeId, pos, dimension) {
  return {
    typeId,
    location: { ...pos },
    dimension,
  };
}

describe("RopeInteractionHandler", () => {
  let mgr;
  let handler;

  beforeEach(() => {
    __reset();
    mgr = new RopeManager();
    handler = new RopeInteractionHandler(mgr);
  });

  it("uncoil: interact with coiled anchor extends segments downward", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    const player = makePlayer();
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    assert.equal(chain.drops[0].segments.length, 10);
    assert.equal(chain.drops[0].remaining, 0);
  });

  it("recoil: interact with extended anchor retracts all segments", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [
      { x: 0, y: 63, z: 0 },
      { x: 0, y: 62, z: 0 },
    ]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 62, z: 0 });

    const player = makePlayer();
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    assert.equal(chain.drops.length, 1);
    assert.equal(chain.drops[0].segments.length, 0);
    assert.equal(chain.drops[0].remaining, 5);
  });

  it("add segment: holding rope item on coil increments remaining", () => {
    const holdingItem = { typeId: "ropes:rope", amount: 5 };
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 3);
    const player = makePlayer(0, holdingItem);
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    assert.equal(chain.totalSegments, 4);
  });

  it("no-op: interact with coil that has 0 remaining does nothing", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 0);
    const player = makePlayer();
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);
    assert.equal(chain.totalSegments, 0);
  });

  it("uncoil stops at solid block below", () => {
    const blockMap = {
      "0,61,0": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
    };
    const dim = makeDimension(blockMap);
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    const player = makePlayer();
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    assert.equal(chain.drops[0].segments.length, 2);
    assert.equal(chain.drops[0].remaining, 8);
  });

  it("retract one: interact with non-coil segment removes bottom segment", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [
      { x: 0, y: 63, z: 0 },
      { x: 0, y: 62, z: 0 },
    ]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 62, z: 0 });

    const player = makePlayer();
    const block = makeBlock("ropes:rope", { x: 0, y: 63, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    assert.equal(chain.drops[0].segments.length, 1);
    assert.equal(chain.drops[0].remaining, 4);
  });

  it("whip-deployed ropes skip interaction", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.isWhipDeployed = true;
    const player = makePlayer();
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);
    assert.equal(chain.drops[0].remaining, 5);
  });

  it("edge-finding: solid below, air to the side, extends from edge", () => {
    const blockMap = {
      "0,63,0": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
      "1,64,0": { typeId: "minecraft:air", setType() {}, setPermutation() {} },
      "1,63,0": { typeId: "minecraft:air", setType() {}, setPermutation() {} },
    };
    const dim = makeDimension(blockMap);
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    const player = makePlayer(270);
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    assert.ok(chain.drops[0].segments.length > 0);
  });

  it("integration: after uncoil, all segment positions indexed in manager", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 3);
    const player = makePlayer();
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    for (const seg of chain.drops[0].segments) {
      const found = mgr.getChainAtPosition("minecraft:overworld", seg);
      assert.equal(found, chain);
    }
  });

  it("integration: after recoil, all positions removed from index", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 3);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }, { x: 0, y: 62, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 62, z: 0 });

    const player = makePlayer();
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    assert.equal(mgr.getChainAtPosition("minecraft:overworld", { x: 0, y: 63, z: 0 }), null);
    assert.equal(mgr.getChainAtPosition("minecraft:overworld", { x: 0, y: 62, z: 0 }), null);
  });
});
