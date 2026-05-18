import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { RopeManager } from "../bigdoors_bp/scripts/ropes/RopeManager.js";
import { WhipSubsystem } from "../bigdoors_bp/scripts/ropes/subsystem/WhipSubsystem.js";

function makeDimension(blockMap = {}) {
  return {
    id: "minecraft:overworld",
    getBlock(pos) {
      const key = `${pos.x},${pos.y},${pos.z}`;
      if (blockMap[key]) return blockMap[key];
      return {
        typeId: "minecraft:air",
        location: { ...pos },
        dimension: this,
        setType(t) { this.typeId = t; },
        setPermutation(p) { this._perm = p; },
      };
    },
  };
}

function makeTargetBlock(pos, dimension) {
  return {
    typeId: "minecraft:stone",
    location: { ...pos },
    dimension,
    setType(t) { this.typeId = t; },
    setPermutation(p) { this._perm = p; },
  };
}

function makePlayer(name = "TestPlayer", holdingWhip = true) {
  const items = [];
  if (holdingWhip) {
    items[0] = { typeId: "ropes:whip", amount: 1 };
  }
  return {
    name,
    selectedSlotIndex: 0,
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
    getEntitiesFromViewDirection() { return []; },
    getBlockFromViewDirection() { return null; },
  };
}

describe("WhipSubsystem", () => {
  let mgr;
  let whip;

  beforeEach(() => {
    __reset();
    mgr = new RopeManager();
    whip = new WhipSubsystem(mgr);
  });

  it("deploys rope segments from target block face", () => {
    const dim = makeDimension();
    const target = makeTargetBlock({ x: 5, y: 70, z: 5 }, dim);
    const player = makePlayer();
    player.getBlockFromViewDirection = () => ({
      block: target,
      face: "Up",
      distance: 4,
    });

    whip._handleWhipUse(player);

    const chains = [...mgr.getAllChains()];
    assert.equal(chains.length, 1);
    assert.equal(chains[0].isWhipDeployed, true);
    assert.equal(chains[0].deployerName, "TestPlayer");
    assert.equal(chains[0].drops[0].segments.length, 4);
  });

  it("stops at solid blocks during deployment", () => {
    const blockMap = {
      "5,69,5": { typeId: "minecraft:stone", setType() {}, setPermutation() {} },
    };
    const dim = makeDimension(blockMap);
    const target = makeTargetBlock({ x: 5, y: 70, z: 5 }, dim);
    const player = makePlayer();
    player.getBlockFromViewDirection = () => ({
      block: target,
      face: "Up",
      distance: 4,
    });

    whip._handleWhipUse(player);

    const chains = [...mgr.getAllChains()];
    assert.equal(chains.length, 1);
    assert.equal(chains[0].drops[0].segments.length, 2);
  });

  it("entity blocks deployment when closer than target", () => {
    const dim = makeDimension();
    const target = makeTargetBlock({ x: 5, y: 70, z: 5 }, dim);
    const player = makePlayer();
    player.getEntitiesFromViewDirection = () => [{ distance: 2 }];
    player.getBlockFromViewDirection = () => ({
      block: target,
      face: "Up",
      distance: 4,
    });

    whip._handleWhipUse(player);

    const chains = [...mgr.getAllChains()];
    assert.equal(chains.length, 0);
  });

  it("no-op when raycast hits nothing", () => {
    const player = makePlayer();
    whip._handleWhipUse(player);

    const chains = [...mgr.getAllChains()];
    assert.equal(chains.length, 0);
  });

  it("removes whip from player inventory after deployment", () => {
    const dim = makeDimension();
    const target = makeTargetBlock({ x: 5, y: 70, z: 5 }, dim);
    const player = makePlayer();
    player.getBlockFromViewDirection = () => ({
      block: target,
      face: "Up",
      distance: 4,
    });

    whip._handleWhipUse(player);

    const inv = player.getComponent("inventory").container;
    assert.equal(inv.getItem(0), null);
  });

  it("bottom segment gets whip_handle state", () => {
    const dim = makeDimension();
    const placed = [];
    const origGetBlock = dim.getBlock.bind(dim);
    dim.getBlock = (pos) => {
      const b = origGetBlock(pos);
      const origSetPerm = b.setPermutation.bind(b);
      b.setPermutation = (p) => {
        placed.push({ pos: { ...pos }, states: p.getAllStates() });
        origSetPerm(p);
      };
      return b;
    };

    const target = makeTargetBlock({ x: 5, y: 70, z: 5 }, dim);
    const player = makePlayer();
    player.getBlockFromViewDirection = () => ({
      block: target,
      face: "Up",
      distance: 4,
    });

    whip._handleWhipUse(player);

    const lastPlaced = placed[placed.length - 1];
    assert.equal(lastPlaced.states["ropes:rope_state"], "whip_handle");

    const firstPlaced = placed[0];
    assert.equal(firstPlaced.states["ropes:rope_state"], "segment");
  });
});
