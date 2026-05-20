import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { computeDisplacements } from "../bigdoors_bp/scripts/domain/DoorDisplacement.js";

function entity(x, y, z) {
  return {
    id: `e_${x}_${y}_${z}`,
    blockPos: { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) },
    originalPos: { x, y, z },
  };
}

function posKey(p) { return `${p.x},${p.y},${p.z}`; }

function makeSweptSets(sources, destinations, arcFn) {
  return sources.map((src, i) => {
    const s = new Set();
    if (arcFn) {
      for (const mid of arcFn(src)) s.add(posKey(mid));
    }
    s.add(posKey(destinations[i]));
    return s;
  });
}

describe("computeDisplacements — rotating door", () => {
  beforeEach(() => __reset());

  it("1-block door: entity at destination → teleported 1 block outward, small impulse, zero damage", () => {
    const hinge = { x: 0, y: 0, z: 0 };
    const sources = [{ x: 1, y: 0, z: 0 }];
    const dests = [{ x: 0, y: 0, z: 1 }];
    const swept = makeSweptSets(sources, dests);
    const entities = [entity(0, 0, 1)];

    const results = computeDisplacements(
      entities, sources, dests, swept, hinge, "rotating", "north"
    );

    assert.equal(results.length, 1);
    const r = results[0];
    assert.equal(r.damage, 0, "1-block door should deal no damage");
    assert.ok(r.teleportTarget, "should have teleport target");
    assert.ok(
      Math.abs(r.impulseVector.x) + Math.abs(r.impulseVector.y) + Math.abs(r.impulseVector.z) > 0,
      "should have nonzero impulse"
    );
  });

  it("4-panel door: entity at tip → large displacement, proportional impulse, damage = floor(dist - 3)", () => {
    const hinge = { x: 0, y: 0, z: 0 };
    const sources = [
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
    ];
    const dests = [
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 2 },
      { x: 0, y: 0, z: 3 },
      { x: 0, y: 0, z: 4 },
    ];
    const swept = makeSweptSets(sources, dests);
    const entities = [entity(0, 0, 4)];

    const results = computeDisplacements(
      entities, sources, dests, swept, hinge, "rotating", "north"
    );

    assert.equal(results.length, 1);
    const r = results[0];
    const panelDist = Math.sqrt((4 - 0) ** 2 + (0 - 0) ** 2 + (0 - 4) ** 2);
    assert.equal(r.damage, Math.max(0, Math.floor(panelDist - 3)));
  });

  it("entity at hinge (radial < 1) → uses facing direction as fallback, minimal impulse, zero damage", () => {
    const hinge = { x: 5, y: 0, z: 5 };
    const sources = [{ x: 5, y: 0, z: 5 }];
    const dests = [{ x: 5, y: 0, z: 5 }];
    const swept = makeSweptSets(sources, dests);
    const entities = [entity(5, 0, 5)];

    const results = computeDisplacements(
      entities, sources, dests, swept, hinge, "rotating", "north"
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].damage, 0);
    assert.equal(results[0].teleportTarget.z, 4, "should push north (facing fallback)");
  });

  it("entity not in swept path → not affected", () => {
    const hinge = { x: 0, y: 0, z: 0 };
    const sources = [{ x: 1, y: 0, z: 0 }];
    const dests = [{ x: 0, y: 0, z: 1 }];
    const swept = makeSweptSets(sources, dests);
    const entities = [entity(5, 5, 5)];

    const results = computeDisplacements(
      entities, sources, dests, swept, hinge, "rotating", "north"
    );

    assert.equal(results.length, 0);
  });

  it("entity matches arc midpoint but not destination → still matched", () => {
    const hinge = { x: 0, y: 0, z: 0 };
    const sources = [{ x: 4, y: 0, z: 0 }];
    const dests = [{ x: 0, y: 0, z: 4 }];
    const midpoint = { x: 3, y: 0, z: 3 };
    const swept = [new Set([posKey(midpoint), posKey(dests[0])])];
    const entities = [entity(3, 0, 3)];

    const results = computeDisplacements(
      entities, sources, dests, swept, hinge, "rotating", "north"
    );

    assert.equal(results.length, 1);
  });

  it("two panels' arcs overlap → entity matched to panel whose destination is closest", () => {
    const hinge = { x: 0, y: 0, z: 0 };
    const sources = [{ x: 2, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }];
    const dests = [{ x: 0, y: 0, z: 2 }, { x: 0, y: 0, z: 3 }];
    const overlap = posKey({ x: 2, y: 0, z: 2 });
    const swept = [
      new Set([overlap, posKey(dests[0])]),
      new Set([overlap, posKey(dests[1])]),
    ];
    const entities = [entity(2, 0, 2)];

    const results = computeDisplacements(
      entities, sources, dests, swept, hinge, "rotating", "north"
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].entity.id, entities[0].id);
  });

  it("displacement distance exactly at threshold (3 blocks) → zero damage", () => {
    const hinge = { x: 0, y: 0, z: 0 };
    const sources = [{ x: 3, y: 0, z: 0 }];
    const dests = [{ x: 0, y: 0, z: 3 }];
    const swept = makeSweptSets(sources, dests);
    const entities = [entity(0, 0, 3)];

    const results = computeDisplacements(
      entities, sources, dests, swept, hinge, "rotating", "north"
    );

    assert.equal(results.length, 1);
    const dist = Math.sqrt(9 + 9);
    assert.equal(results[0].damage, Math.max(0, Math.floor(dist - 3)));
  });

  it("displacement distance just above threshold → floor damage", () => {
    const hinge = { x: 0, y: 0, z: 0 };
    const sources = [{ x: 4, y: 0, z: 0 }];
    const dests = [{ x: 0, y: 0, z: 4 }];
    const swept = makeSweptSets(sources, dests);
    const entities = [entity(0, 0, 4)];

    const results = computeDisplacements(
      entities, sources, dests, swept, hinge, "rotating", "north"
    );

    const dist = Math.sqrt(16 + 16);
    assert.equal(results[0].damage, Math.max(0, Math.floor(dist - 3)));
  });
});

describe("computeDisplacements — vertical-mode catapult", () => {
  beforeEach(() => __reset());

  it("vertical door closing upward, entity on far panel → teleport above+outward, large impulse", () => {
    const hinge = { x: 0, y: 0, z: 0 };
    const sources = [
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 2 },
      { x: 0, y: 0, z: 3 },
      { x: 0, y: 0, z: 4 },
    ];
    const dests = [
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 2, z: 0 },
      { x: 0, y: 3, z: 0 },
      { x: 0, y: 4, z: 0 },
    ];
    const swept = makeSweptSets(sources, dests);
    const entities = [entity(0, 4, 0)];

    const results = computeDisplacements(
      entities, sources, dests, swept, hinge, "rotating", "north", "", 1, "vertical"
    );

    assert.equal(results.length, 1);
    const r = results[0];
    assert.ok(r.teleportTarget.y >= 4, "should teleport above destination");
    assert.ok(r.impulseVector.y > 0, "should have upward impulse component");
    assert.ok(r.damage > 0, "large door should deal damage");
  });
});

describe("computeDisplacements — linear/winch door", () => {
  beforeEach(() => __reset());

  it("linear door → outward direction along shift axis, impulse scales with distance", () => {
    const hinge = { x: 0, y: 0, z: 0 };
    const sources = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 2, z: 0 },
    ];
    const dests = [
      { x: 0, y: 3, z: 0 },
      { x: 0, y: 4, z: 0 },
      { x: 0, y: 5, z: 0 },
    ];
    const swept = makeSweptSets(sources, dests);
    const entities = [entity(0, 3, 0)];

    const results = computeDisplacements(
      entities, sources, dests, swept, hinge, "linear", "", "y", 1
    );

    assert.equal(results.length, 1);
    const r = results[0];
    assert.ok(r.teleportTarget.y > dests[0].y, "should teleport beyond destination in shift dir");
  });
});
