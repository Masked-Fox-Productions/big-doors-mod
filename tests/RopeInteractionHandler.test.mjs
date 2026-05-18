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

  it("add segment: holding rope item on coil is disabled by config", () => {
    const holdingItem = { typeId: "ropes:rope", amount: 5 };
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 0);
    const player = makePlayer(0, holdingItem);
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    assert.equal(chain.totalSegments, 0);
    assert.equal(holdingItem.amount, 5);
  });

  it("no-op: interact with coil that has 0 remaining does nothing", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 0);
    const player = makePlayer();
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);
    assert.equal(chain.totalSegments, 0);
  });

  it("uncoil stops at solid and creates ledge coil with remaining segments", () => {
    const blockMap = {
      "0,61,0": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
    };
    const dim = makeDimension(blockMap);
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    const player = makePlayer();
    const block = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    assert.equal(chain.drops.length, 2);
    assert.equal(chain.drops[0].segments.length, 1);
    assert.equal(chain.drops[0].remaining, 0);
    assert.deepEqual(chain.drops[1].coilPos, { x: 0, y: 62, z: 0 });
    assert.equal(chain.drops[1].remaining, 9);
    assert.equal(chain.totalSegments, 10);
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

  it("cascade: interact with ledge coil extends further downward", () => {
    const blockMap = {
      "0,61,0": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
    };
    const dim = makeDimension(blockMap);
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    const player = makePlayer();
    const anchorBlock = makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(anchorBlock, player, dim);

    assert.equal(chain.drops.length, 2);
    const ledgeCoil = chain.drops[1];
    assert.equal(ledgeCoil.remaining, 9);

    mgr.addSegmentPosition(chain.id, "minecraft:overworld", ledgeCoil.coilPos);
    const ledgeBlock = makeBlock("ropes:rope", ledgeCoil.coilPos, dim);
    handler.handleInteract(ledgeBlock, player, dim);

    assert.equal(ledgeCoil.segments.length, 9);
    assert.equal(ledgeCoil.remaining, 0);
  });

  it("cascade: multi-level cascading with two ledges", () => {
    const blockMap = {
      "0,61,0": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
      "0,56,1": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
    };
    const dim = makeDimension(blockMap);
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 20);
    const player = makePlayer();

    handler.handleInteract(makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim), player, dim);
    assert.equal(chain.drops.length, 2);
    assert.equal(chain.drops[0].segments.length, 1);
    assert.deepEqual(chain.drops[1].coilPos, { x: 0, y: 62, z: 0 });
    assert.equal(chain.drops[1].remaining, 19);

    mgr.addSegmentPosition(chain.id, "minecraft:overworld", chain.drops[1].coilPos);
    handler.handleInteract(makeBlock("ropes:rope", chain.drops[1].coilPos, dim), player, dim);

    assert.equal(chain.drops.length, 3);
    assert.equal(chain.drops[1].segments.length, 5);
    assert.deepEqual(chain.drops[2].coilPos, { x: 0, y: 57, z: 1 });
    assert.equal(chain.drops[2].remaining, 14);
    assert.equal(chain.totalSegments, 20);
  });

  it("cascade: full recoil from anchor clears all drops and ledge coils", () => {
    const blockMap = {
      "0,61,0": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
    };
    const dim = makeDimension(blockMap);
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    const player = makePlayer();

    handler.handleInteract(makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim), player, dim);
    assert.equal(chain.drops.length, 2);

    mgr.addSegmentPosition(chain.id, "minecraft:overworld", chain.drops[1].coilPos);
    handler.handleInteract(makeBlock("ropes:rope", chain.drops[1].coilPos, dim), player, dim);
    assert.ok(chain.drops[1].segments.length > 0);

    for (const drop of chain.drops) {
      for (const seg of drop.segments) {
        mgr.addSegmentPosition(chain.id, "minecraft:overworld", seg);
      }
    }

    handler.handleInteract(makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim), player, dim);

    assert.equal(chain.drops.length, 1);
    assert.equal(chain.drops[0].remaining, 10);
    assert.equal(chain.drops[0].segments.length, 0);
    assert.equal(chain.totalSegments, 10);
  });

  it("cascade: one-at-a-time retract removes bottommost segment", () => {
    const blockMap = {
      "0,61,0": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
    };
    const dim = makeDimension(blockMap);
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    const player = makePlayer();

    handler.handleInteract(makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim), player, dim);

    mgr.addSegmentPosition(chain.id, "minecraft:overworld", chain.drops[1].coilPos);
    handler.handleInteract(makeBlock("ropes:rope", chain.drops[1].coilPos, dim), player, dim);

    for (const drop of chain.drops) {
      for (const seg of drop.segments) {
        mgr.addSegmentPosition(chain.id, "minecraft:overworld", seg);
      }
    }

    const bottomSeg = chain.drops[1].segments[chain.drops[1].segments.length - 1];
    const segCount = chain.drops[1].segments.length;

    const segBlock = makeBlock("ropes:rope", chain.drops[0].segments[0], dim);
    handler.handleInteract(segBlock, player, dim);

    assert.equal(chain.drops[1].segments.length, segCount - 1);
  });

  it("rope ladder: clicking any segment triggers full recoil", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope_ladder", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "north", 5);
    chain.extendDrop(0, [
      { x: 0, y: 63, z: 0 },
      { x: 0, y: 62, z: 0 },
      { x: 0, y: 61, z: 0 },
    ]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 62, z: 0 });
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 61, z: 0 });

    const player = makePlayer();
    const block = makeBlock("ropes:rope_ladder", { x: 0, y: 62, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    assert.equal(chain.drops.length, 1);
    assert.equal(chain.drops[0].segments.length, 0);
    assert.equal(chain.drops[0].remaining, 5);
  });

  it("cascade: rope ladder skips cascade, no ledge coil on solid", () => {
    const blockMap = {
      "0,61,0": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
    };
    const dim = makeDimension(blockMap);
    const chain = mgr.createChain("rope_ladder", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "north", 10);
    const player = makePlayer();
    const block = makeBlock("ropes:rope_ladder", { x: 0, y: 64, z: 0 }, dim);

    handler.handleInteract(block, player, dim);

    assert.equal(chain.drops.length, 1);
    assert.equal(chain.drops[0].segments.length, 2);
    assert.equal(chain.drops[0].remaining, 8);
  });

  it("cascade: position index tracks ledge coil positions", () => {
    const blockMap = {
      "0,61,0": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
    };
    const dim = makeDimension(blockMap);
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    const player = makePlayer();

    handler.handleInteract(makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim), player, dim);

    const ledgePos = chain.drops[1].coilPos;
    const found = mgr.getChainAtPosition("minecraft:overworld", ledgePos);
    assert.equal(found, chain);
  });

  it("cascade: adding segments to ledge coil then full recoil preserves total", () => {
    const blockMap = {
      "0,61,0": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
    };
    const dim = makeDimension(blockMap);
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    const player = makePlayer();

    handler.handleInteract(makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim), player, dim);
    assert.equal(chain.drops.length, 2);

    chain.addSegments(3, 1);
    assert.equal(chain.totalSegments, 13);

    for (const drop of chain.drops) {
      for (const seg of drop.segments) {
        mgr.addSegmentPosition(chain.id, "minecraft:overworld", seg);
      }
    }
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", chain.drops[1].coilPos);

    handler.handleInteract(makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim), player, dim);

    assert.equal(chain.drops.length, 1);
    assert.equal(chain.totalSegments, 13);
    assert.equal(chain.drops[0].remaining, 13);
  });
});
