import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { sweep, sweepLinear } from "../bigdoors_bp/scripts/subsystem/EntitySweeper.js";

function makeEntity(x, y, z) {
  return {
    id: `entity_${x}_${y}_${z}`,
    location: { x, y, z },
    _teleported: null,
    _impulse: null,
    _knockback: null,
    _damage: null,
    teleport(dest) {
      this._teleported = dest;
    },
    applyImpulse(vec) {
      this._impulse = vec;
    },
    applyKnockback(horizontal, vertical) {
      this._knockback = { horizontal, vertical };
    },
    applyDamage(amount, options) {
      this._damage = { amount, options };
    },
  };
}

function makeDimension(entities, blockMap = {}) {
  return {
    getEntities() { return entities; },
    getBlock(pos) {
      const key = `${pos.x},${pos.y},${pos.z}`;
      return { typeId: blockMap[key] ?? null };
    },
  };
}

describe("EntitySweeper — rotating door physics", () => {
  beforeEach(() => __reset());

  it("teleports entity in sweep path to front of destination and applies impulse", () => {
    const entity = makeEntity(0, 0, 1);
    const dimension = makeDimension([entity]);

    const hingePos = { x: 0, y: 0, z: 0 };
    const sources = [{ x: 1, y: 0, z: 0 }];
    const destinations = [{ x: 0, y: 0, z: 1 }];

    sweep(dimension, destinations, sources, hingePos);

    assert.ok(entity._teleported, "Entity should have been teleported");
    assert.ok(entity._impulse, "Entity should have received impulse");
  });

  it("does not affect entities outside the sweep path", () => {
    const entity = makeEntity(5, 0, 5);
    const dimension = makeDimension([entity]);

    sweep(dimension, [{ x: 0, y: 0, z: 1 }], [{ x: 1, y: 0, z: 0 }], { x: 0, y: 0, z: 0 });

    assert.equal(entity._teleported, null);
    assert.equal(entity._impulse, null);
  });

  it("multi-panel door: entity near tip gets larger impulse than near hinge", () => {
    const entityTip = makeEntity(0, 0, 4);
    const entityHinge = makeEntity(0, 0, 1);
    const dimension = makeDimension([entityTip, entityHinge]);

    const hingePos = { x: 0, y: 0, z: 0 };
    const sources = [
      { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
    ];
    const destinations = [
      { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 2 },
      { x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 4 },
    ];

    sweep(dimension, destinations, sources, hingePos);

    assert.ok(entityTip._impulse, "Tip entity should get impulse");
    assert.ok(entityHinge._impulse, "Hinge entity should get impulse");

    const tipMag = Math.sqrt(entityTip._impulse.x ** 2 + entityTip._impulse.y ** 2 + entityTip._impulse.z ** 2);
    const hingeMag = Math.sqrt(entityHinge._impulse.x ** 2 + entityHinge._impulse.y ** 2 + entityHinge._impulse.z ** 2);
    assert.ok(tipMag > hingeMag, "Tip impulse should be larger than hinge impulse");
  });

  it("applies correct 3D impulse vector direction", () => {
    const entity = makeEntity(0, 0, 1);
    const dimension = makeDimension([entity]);

    sweep(dimension, [{ x: 0, y: 0, z: 1 }], [{ x: 1, y: 0, z: 0 }], { x: 0, y: 0, z: 0 });

    assert.ok(entity._impulse);
    assert.equal(typeof entity._impulse.x, "number");
    assert.equal(typeof entity._impulse.y, "number");
    assert.equal(typeof entity._impulse.z, "number");
  });

  it("large door applies damage to entity", () => {
    const entity = makeEntity(0, 0, 4);
    const dimension = makeDimension([entity]);

    const hingePos = { x: 0, y: 0, z: 0 };
    const sources = [
      { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
    ];
    const destinations = [
      { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 2 },
      { x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 4 },
    ];

    sweep(dimension, destinations, sources, hingePos);

    assert.ok(entity._damage, "Large door should deal damage");
    assert.ok(entity._damage.amount > 0);
  });

  it("small door (under threshold) does not apply damage", () => {
    const entity = makeEntity(0, 0, 1);
    const dimension = makeDimension([entity]);

    sweep(dimension, [{ x: 0, y: 0, z: 1 }], [{ x: 1, y: 0, z: 0 }], { x: 0, y: 0, z: 0 });

    assert.equal(entity._damage, null, "Small door should not deal damage");
  });

  it("entity would be crushed → displaced to nearest open space", () => {
    const entity = makeEntity(0, 0, 1);
    const blockMap = { "0,0,2": "minecraft:stone" };
    const dimension = makeDimension([entity], blockMap);

    sweep(dimension, [{ x: 0, y: 0, z: 1 }], [{ x: 1, y: 0, z: 0 }], { x: 0, y: 0, z: 0 });

    assert.ok(entity._teleported);
    assert.notDeepEqual(
      { x: Math.floor(entity._teleported.x), y: Math.floor(entity._teleported.y), z: Math.floor(entity._teleported.z) },
      { x: 0, y: 0, z: 2 },
      "Should not teleport into solid block"
    );
  });

  it("handles entity removal gracefully during sweep", () => {
    const entity = {
      id: "fragile",
      location: { x: 0, y: 0, z: 1 },
      teleport() { throw new Error("Entity removed"); },
      applyImpulse() { throw new Error("Entity removed"); },
      applyKnockback() { throw new Error("Entity removed"); },
      applyDamage() { throw new Error("Entity removed"); },
    };
    const dimension = makeDimension([entity]);

    assert.doesNotThrow(() => {
      sweep(dimension, [{ x: 0, y: 0, z: 1 }], [{ x: 1, y: 0, z: 0 }], { x: 0, y: 0, z: 0 });
    });
  });

  it("falls back to applyKnockback when applyImpulse throws", () => {
    const entity = makeEntity(0, 0, 1);
    entity.applyImpulse = () => { throw new Error("not supported"); };
    const dimension = makeDimension([entity]);

    sweep(dimension, [{ x: 0, y: 0, z: 1 }], [{ x: 1, y: 0, z: 0 }], { x: 0, y: 0, z: 0 });

    assert.ok(entity._knockback, "Should fall back to knockback");
  });
});

describe("EntitySweeper — linear door physics", () => {
  beforeEach(() => __reset());

  it("pushes entity at destination along shift axis with impulse", () => {
    const entity = makeEntity(0, 1, 0);
    const dimension = makeDimension([entity]);
    const sources = [{ x: 0, y: 0, z: 0 }];
    const destinations = [{ x: 0, y: 1, z: 0 }];

    sweepLinear(dimension, destinations, sources, "y", 1);

    assert.ok(entity._teleported, "Entity should be teleported");
    assert.ok(entity._impulse, "Entity should receive impulse");
    assert.ok(entity._impulse.y > 0, "Impulse should be in +Y direction");
  });

  it("does not push entity outside destination positions", () => {
    const entity = makeEntity(5, 5, 5);
    const dimension = makeDimension([entity]);

    sweepLinear(dimension, [{ x: 0, y: 1, z: 0 }], [{ x: 0, y: 0, z: 0 }], "y", 1);

    assert.equal(entity._teleported, null);
  });

  it("pushes in negative direction when shiftSign is -1", () => {
    const entity = makeEntity(0, 0, 0);
    const dimension = makeDimension([entity]);

    sweepLinear(dimension, [{ x: 0, y: 0, z: 0 }], [{ x: 0, y: 1, z: 0 }], "y", -1);

    assert.ok(entity._teleported);
    assert.ok(entity._impulse);
    assert.ok(entity._impulse.y < 0, "Impulse should be in -Y direction");
  });

  it("does nothing with empty destinations", () => {
    const entity = makeEntity(0, 0, 0);
    const dimension = makeDimension([entity]);

    sweepLinear(dimension, [], [], "y", 1);

    assert.equal(entity._teleported, null);
  });

  it("portcullis destinations spanning multiple Y levels", () => {
    const entityAtTop = makeEntity(0, 7, 0);
    const entityFarAway = makeEntity(10, 7, 10);
    const dimension = makeDimension([entityAtTop, entityFarAway]);

    const sources = [{ x: 0, y: 4, z: 0 }, { x: 0, y: 5, z: 0 }, { x: 0, y: 6, z: 0 }];
    const destinations = [{ x: 0, y: 5, z: 0 }, { x: 0, y: 6, z: 0 }, { x: 0, y: 7, z: 0 }];

    sweepLinear(dimension, destinations, sources, "y", 1);

    assert.ok(entityAtTop._teleported, "Entity at top of destination range should be detected");
    assert.equal(entityFarAway._teleported, null, "Entity far away should not be affected");
  });
});
