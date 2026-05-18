import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset, __setWorld } from "./stubs/minecraft-server.mjs";
import { RopeManager } from "../bigdoors_bp/scripts/ropes/RopeManager.js";
import { RopeBreakHandler } from "../bigdoors_bp/scripts/ropes/handler/RopeBreakHandler.js";

function makeDimension(blockMap = {}) {
  const spawned = [];
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
    spawnItem(item, pos) {
      spawned.push({ typeId: item.typeId, amount: item.amount, pos: { ...pos } });
    },
    _spawned: spawned,
  };
}

function makeBlock(typeId, pos, dimension) {
  return {
    typeId,
    location: { ...pos },
    dimension,
  };
}

function makePlayer(name = "TestPlayer", creative = false) {
  const items = [];
  return {
    name,
    getGameMode() { return creative ? "Creative" : "Survival"; },
    dimension: { id: "minecraft:overworld" },
    location: { x: 0, y: 64, z: 0 },
    getComponent(n) {
      if (n !== "inventory") return null;
      return {
        container: {
          size: 36,
          getItem(i) { return items[i] ?? null; },
          setItem(i, item) { items[i] = item; },
        },
      };
    },
  };
}

describe("RopeBreakHandler", () => {
  let mgr;
  let handler;

  beforeEach(() => {
    __reset();
    mgr = new RopeManager();
    handler = new RopeBreakHandler(mgr);
  });

  it("anchor break removes entire chain", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }, { x: 0, y: 62, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 62, z: 0 });

    const event = {
      block: makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim),
      player: makePlayer(),
    };

    handler.handleBreak(event);

    assert.equal(mgr.getChain(chain.id), null);
    assert.equal(dim._spawned.length, 1);
    assert.equal(dim._spawned[0].typeId, "ropes:rope");
  });

  it("mid-chain break drops segments below, keeps segments above", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    chain.extendDrop(0, [
      { x: 0, y: 63, z: 0 },
      { x: 0, y: 62, z: 0 },
      { x: 0, y: 61, z: 0 },
    ]);
    for (const seg of chain.drops[0].segments) {
      mgr.addSegmentPosition(chain.id, "minecraft:overworld", seg);
    }

    const event = {
      block: makeBlock("ropes:rope", { x: 0, y: 62, z: 0 }, dim),
      player: makePlayer(),
    };

    handler.handleBreak(event);

    assert.equal(chain.drops[0].segments.length, 1);
    assert.equal(chain.drops[0].remaining, 7);
    assert.equal(dim._spawned.length, 1);
    assert.equal(dim._spawned[0].amount, 1);
  });

  it("break above ledge coil removes all downstream drops", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 15);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }, { x: 0, y: 62, z: 0 }]);
    chain.createLedgeCoil(0, { x: 0, y: 61, z: 0 });
    chain.extendDrop(1, [{ x: 0, y: 60, z: 0 }, { x: 0, y: 59, z: 0 }]);

    for (const drop of chain.drops) {
      for (const seg of drop.segments) {
        mgr.addSegmentPosition(chain.id, "minecraft:overworld", seg);
      }
    }
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 61, z: 0 });

    const event = {
      block: makeBlock("ropes:rope", { x: 0, y: 62, z: 0 }, dim),
      player: makePlayer(),
    };

    handler.handleBreak(event);

    assert.equal(chain.drops.length, 1);
    assert.equal(chain.drops[0].segments.length, 1);
  });

  it("whip chain break: entire chain removed, no rope drops", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 0);
    chain.isWhipDeployed = true;
    chain.deployerName = "TestPlayer";
    chain.drops[0].segments = [
      { x: 0, y: 63, z: 0 },
      { x: 0, y: 62, z: 0 },
    ];
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 62, z: 0 });

    handler._breakEntireChain(chain, dim, false);

    assert.equal(mgr.getChain(chain.id), null);
    const ropeDrops = dim._spawned.filter(s => s.typeId === "ropes:rope");
    assert.equal(ropeDrops.length, 0);
  });

  it("whip return: whip added to deployer inventory", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 0);
    chain.isWhipDeployed = true;
    chain.deployerName = "TestPlayer";
    chain.drops[0].segments = [{ x: 0, y: 63, z: 0 }];

    const player = makePlayer("TestPlayer");
    const w = {
      ...makeDimension(),
      afterEvents: {
        playerPlaceBlock: { subscribe() {} },
        playerBreakBlock: { subscribe() {} },
        entitySpawn: { subscribe() {} },
        worldInitialize: { subscribe() {} },
        itemUse: { subscribe() {} },
      },
      beforeEvents: {
        entitySpawn: { subscribe() {} },
        playerBreakBlock: { subscribe() {} },
      },
      getDynamicProperty() { return undefined; },
      setDynamicProperty() {},
      getDimension() { return dim; },
      getPlayers() { return [player]; },
      getAllPlayers() { return [player]; },
    };
    __setWorld(w);

    const freshMgr = new RopeManager();
    const freshHandler = new RopeBreakHandler(freshMgr);
    const c = freshMgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 0);
    c.isWhipDeployed = true;
    c.deployerName = "TestPlayer";
    c.drops[0].segments = [{ x: 0, y: 63, z: 0 }];

    freshHandler._breakEntireChain(c, dim, false);

    const inv = player.getComponent("inventory").container;
    const item = inv.getItem(0);
    assert.ok(item);
    assert.equal(item.typeId, "ropes:whip");
  });

  it("support block removal triggers chain break", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 3);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const supportPos = { x: 0, y: 65, z: 0 };
    const chainIds = mgr.getChainsForSupportBlock("minecraft:overworld", supportPos);
    assert.ok(chainIds);
    assert.ok(chainIds.has(chain.id));
  });

  it("break last segment: chain persists as coiled anchor", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const event = {
      block: makeBlock("ropes:rope", { x: 0, y: 63, z: 0 }, dim),
      player: makePlayer(),
    };

    handler.handleBreak(event);

    assert.ok(mgr.getChain(chain.id));
    assert.equal(chain.drops[0].segments.length, 0);
    assert.equal(chain.drops[0].remaining, 4);
  });

  it("creative mode: no items dropped", () => {
    const dim = makeDimension();
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 3);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const event = {
      block: makeBlock("ropes:rope", { x: 0, y: 64, z: 0 }, dim),
      player: makePlayer("TestPlayer", true),
    };

    handler.handleBreak(event);

    assert.equal(dim._spawned.length, 0);
  });
});
