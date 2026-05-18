import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset, __setWorld } from "./stubs/minecraft-server.mjs";
import { RopeManager } from "../bigdoors_bp/scripts/ropes/RopeManager.js";
import { ClimbableSubsystem } from "../bigdoors_bp/scripts/ropes/subsystem/ClimbableSubsystem.js";

function makePlayer(id, pos, opts = {}) {
  const effects = new Map();
  const _buttonStates = {
    Jump: (opts.isJumping ?? false) ? "Pressed" : "Released",
    Sneak: (opts.isSneaking ?? false) ? "Pressed" : "Released",
  };
  const movement = opts.movement ?? { x: 0, y: 0 };
  return {
    id,
    name: `Player${id}`,
    location: { ...pos },
    dimension: { id: opts.dimensionId ?? "minecraft:overworld" },
    inputInfo: {
      getButtonState(button) { return _buttonStates[button] ?? "Released"; },
      getMovementVector() { return movement; },
    },
    _buttonStates,
    _knockbacks: [],
    applyKnockback(vector, verticalStrength) {
      this._knockbacks.push({ vector, verticalStrength });
    },
    addEffect(effectId, duration, options) {
      effects.set(effectId, { duration, ...options });
    },
    removeEffect(effectId) {
      effects.delete(effectId);
    },
    getEffect(effectId) {
      return effects.get(effectId) ?? null;
    },
    _effects: effects,
  };
}

describe("ClimbableSubsystem", () => {
  let mgr;
  let sub;

  beforeEach(() => {
    __reset();
    mgr = new RopeManager();
    sub = new ClimbableSubsystem(mgr);
  });

  it("applies slow_falling when player is inside rope block", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const player = makePlayer("p1", { x: 0.5, y: 63, z: 0.5 });

    const w = { getAllPlayers() { return [player]; } };
    __setWorld(w);

    sub._tick();

    assert.ok(player._effects.has("slow_falling"));
  });

  it("applies upward knockback when player is jumping on rope", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const player = makePlayer("p1", { x: 0.5, y: 63, z: 0.5 }, { isJumping: true });

    const w = { getAllPlayers() { return [player]; } };
    __setWorld(w);

    sub._tick();

    assert.equal(player._knockbacks.length, 1);
    assert.ok(player._knockbacks[0].verticalStrength > 0);
  });

  it("removes slow_falling when player leaves rope block", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const player = makePlayer("p1", { x: 0.5, y: 63, z: 0.5 });
    const w = { getAllPlayers() { return [player]; } };
    __setWorld(w);

    sub._tick();
    assert.ok(player._effects.has("slow_falling"));

    player.location = { x: 10, y: 63, z: 10 };
    sub._tick();
    assert.equal(player._effects.has("slow_falling"), false);
  });

  it("removes slow_falling when sneaking on rope", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const player = makePlayer("p1", { x: 0.5, y: 63, z: 0.5 });
    const w = { getAllPlayers() { return [player]; } };
    __setWorld(w);

    sub._tick();
    assert.ok(player._effects.has("slow_falling"));

    player._buttonStates.Sneak = "Pressed";
    sub._tick();
    assert.equal(player._effects.has("slow_falling"), false);
  });

  it("applies knockback for rope ladder when jumping", () => {
    const chain = mgr.createChain("rope_ladder", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "north", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const player = makePlayer("p1", { x: 0.5, y: 63, z: 0.5 }, { isJumping: true });
    const w = { getAllPlayers() { return [player]; } };
    __setWorld(w);

    sub._tick();

    assert.equal(player._knockbacks.length, 1);
    assert.equal(player._effects.has("slow_falling"), false);
  });

  it("applies knockback for rope ladder when moving into it", () => {
    const chain = mgr.createChain("rope_ladder", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "north", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const player = makePlayer("p1", { x: 0.5, y: 63, z: 0.5 }, { movement: { x: 0, y: 1 } });
    const w = { getAllPlayers() { return [player]; } };
    __setWorld(w);

    sub._tick();

    assert.equal(player._knockbacks.length, 1);
    assert.deepEqual(player._knockbacks[0].vector, { x: 0, z: 0 });
  });

  it("multiple players tracked independently", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const p1 = makePlayer("p1", { x: 0.5, y: 63, z: 0.5 });
    const p2 = makePlayer("p2", { x: 10, y: 63, z: 10 });
    const w = { getAllPlayers() { return [p1, p2]; } };
    __setWorld(w);

    sub._tick();

    assert.ok(p1._effects.has("slow_falling"));
    assert.equal(p2._effects.has("slow_falling"), false);
  });

  it("cleans up stale entries when player disconnects", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const player = makePlayer("p1", { x: 0.5, y: 63, z: 0.5 });
    let players = [player];
    const w = { getAllPlayers() { return players; } };
    __setWorld(w);

    sub._tick();
    assert.ok(sub._climbingState.has("p1"));

    players = [];
    sub._tick();
    assert.equal(sub._climbingState.has("p1"), false);
  });

  it("detects rope at head height", () => {
    const chain = mgr.createChain("rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    mgr.addSegmentPosition(chain.id, "minecraft:overworld", { x: 0, y: 63, z: 0 });

    const player = makePlayer("p1", { x: 0.5, y: 62, z: 0.5 });
    const w = { getAllPlayers() { return [player]; } };
    __setWorld(w);

    sub._tick();
    assert.ok(player._effects.has("slow_falling"));
  });
});
