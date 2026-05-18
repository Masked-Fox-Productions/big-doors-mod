import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { RopeManager } from "../bigdoors_bp/scripts/ropes/RopeManager.js";

describe("RopeManager", () => {
  let mgr;

  beforeEach(() => {
    __reset();
    mgr = new RopeManager();
  });

  it("createChain stores a chain retrievable by getChainAtPosition", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "north", 10);
    assert.equal(chain.id, "rope_1");
    assert.equal(chain.type, "rope");
    assert.equal(chain.totalSegments, 10);

    const found = mgr.getChainAtPosition("minecraft:overworld", { x: 0, y: 64, z: 0 });
    assert.equal(found, chain);
  });

  it("save/load round-trips correctly", () => {
    mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "north", 10);
    mgr.createChain("rope_ladder", "minecraft:overworld", { x: 5, y: 64, z: 5 }, "east", 5);

    const mgr2 = new RopeManager();
    mgr2.load();

    const chain1 = mgr2.getChain("rope_1");
    assert.ok(chain1);
    assert.equal(chain1.type, "rope");
    assert.equal(chain1.totalSegments, 10);

    const chain2 = mgr2.getChain("rope_2");
    assert.ok(chain2);
    assert.equal(chain2.type, "rope_ladder");
  });

  it("load is idempotent — calling twice does not duplicate chains", () => {
    mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "north", 5);

    const mgr2 = new RopeManager();
    mgr2.load();
    mgr2.load();

    let count = 0;
    for (const _ of mgr2.getAllChains()) count++;
    assert.equal(count, 1);
  });

  it("indexes support block position in _supportIndex", () => {
    mgr.createChain("rope", "minecraft:overworld", { x: 5, y: 64, z: 5 }, "north", 5);
    const supportChains = mgr.getChainsForSupportBlock("minecraft:overworld", { x: 5, y: 64, z: 4 });
    assert.ok(supportChains);
    assert.ok(supportChains.has("rope_1"));
  });

  it("two chains on same support block (different faces) -> Set contains both", () => {
    // Both anchors on different faces of the block at {5, 64, 5}
    mgr.createChain("rope", "minecraft:overworld", { x: 5, y: 64, z: 4 }, "south", 5); // support at z+1 = {5,64,5}
    mgr.createChain("rope", "minecraft:overworld", { x: 4, y: 64, z: 5 }, "east", 5);  // support at x+1 = {5,64,5}
    const supportChains = mgr.getChainsForSupportBlock("minecraft:overworld", { x: 5, y: 64, z: 5 });
    assert.ok(supportChains);
    assert.ok(supportChains.has("rope_1"));
    assert.ok(supportChains.has("rope_2"));
  });

  it("removeChain cleans up position index and support index", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "north", 5);
    mgr.removeChain(chain.id);

    assert.equal(mgr.getChainAtPosition("minecraft:overworld", { x: 0, y: 64, z: 0 }), null);
    assert.equal(mgr.getChainsForSupportBlock("minecraft:overworld", { x: 0, y: 64, z: -1 }), null);
  });

  it("position index uses dimension-prefixed keys — no cross-dimension collision", () => {
    mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    mgr.createChain("rope", "minecraft:nether", { x: 0, y: 64, z: 0 }, "up", 3);

    const ow = mgr.getChainAtPosition("minecraft:overworld", { x: 0, y: 64, z: 0 });
    const nether = mgr.getChainAtPosition("minecraft:nether", { x: 0, y: 64, z: 0 });

    assert.equal(ow.id, "rope_1");
    assert.equal(nether.id, "rope_2");
  });

  it("addSegmentPosition / removeSegmentPosition updates index", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    assert.equal(mgr.getChainAtPosition("minecraft:overworld", { x: 0, y: 63, z: 0 }), chain);

    mgr.removeSegmentPosition("minecraft:overworld", { x: 0, y: 63, z: 0 });
    assert.equal(mgr.getChainAtPosition("minecraft:overworld", { x: 0, y: 63, z: 0 }), null);
  });

  it("getChain returns null for unknown id", () => {
    assert.equal(mgr.getChain("nonexistent"), null);
  });

  it("getChainAtPosition returns null for unindexed position", () => {
    assert.equal(mgr.getChainAtPosition("minecraft:overworld", { x: 99, y: 99, z: 99 }), null);
  });
});
