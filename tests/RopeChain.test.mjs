import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RopeChain } from "../bigdoors_bp/scripts/ropes/domain/RopeChain.js";

describe("RopeChain", () => {
  it("creates with initial state: one drop, all segments in remaining", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "north", 10);
    assert.equal(chain.id, "rope_1");
    assert.equal(chain.type, "rope");
    assert.equal(chain.dimensionId, "minecraft:overworld");
    assert.deepEqual(chain.anchorPos, { x: 0, y: 64, z: 0 });
    assert.equal(chain.anchorFace, "north");
    assert.equal(chain.totalSegments, 10);
    assert.equal(chain.drops.length, 1);
    assert.equal(chain.drops[0].remaining, 10);
    assert.equal(chain.drops[0].segments.length, 0);
  });

  it("toJSON round-trips through fromJSON with all fields preserved", () => {
    const chain = new RopeChain("rope_5", "rope_ladder", "minecraft:nether", { x: 10, y: 20, z: 30 }, "east", 8);
    chain.isWhipDeployed = true;
    chain.deployerName = "TestPlayer";
    chain.extendDrop(0, [{ x: 10, y: 19, z: 30 }, { x: 10, y: 18, z: 30 }]);

    const json = chain.toJSON();
    const restored = RopeChain.fromJSON(json);

    assert.equal(restored.id, "rope_5");
    assert.equal(restored.type, "rope_ladder");
    assert.equal(restored.dimensionId, "minecraft:nether");
    assert.deepEqual(restored.anchorPos, { x: 10, y: 20, z: 30 });
    assert.equal(restored.anchorFace, "east");
    assert.equal(restored.isWhipDeployed, true);
    assert.equal(restored.deployerName, "TestPlayer");
    assert.equal(restored.totalSegments, 8);
    assert.equal(restored.drops[0].remaining, 6);
    assert.equal(restored.drops[0].segments.length, 2);
  });

  it("totalSegments is a computed getter summing remaining + segments across drops", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 20);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }, { x: 0, y: 62, z: 0 }]);
    assert.equal(chain.totalSegments, 20);
    assert.equal(chain.drops[0].remaining, 18);
    assert.equal(chain.drops[0].segments.length, 2);
  });

  it("handles 0 segments (anchor placed but no segments)", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "north", 0);
    assert.equal(chain.totalSegments, 0);
    assert.equal(chain.drops[0].remaining, 0);
  });

  it("respects MAX_CHAIN_LENGTH when adding segments", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "north", 60);
    const added = chain.addSegments(10);
    assert.equal(added, 4);
    assert.equal(chain.totalSegments, 64);
  });

  it("extendDrop places segments and decrements remaining", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    const positions = [
      { x: 0, y: 63, z: 0 },
      { x: 0, y: 62, z: 0 },
      { x: 0, y: 61, z: 0 },
    ];
    const result = chain.extendDrop(0, positions);
    assert.equal(result.extended, 3);
    assert.equal(result.remaining, 2);
    assert.equal(chain.drops[0].segments.length, 3);
  });

  it("extendDrop does not extend beyond remaining", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 2);
    const positions = [
      { x: 0, y: 63, z: 0 },
      { x: 0, y: 62, z: 0 },
      { x: 0, y: 61, z: 0 },
      { x: 0, y: 60, z: 0 },
    ];
    const result = chain.extendDrop(0, positions);
    assert.equal(result.extended, 2);
    assert.equal(chain.drops[0].segments.length, 2);
  });

  it("createLedgeCoil transfers remaining from parent to new drop", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 20);
    chain.extendDrop(0, [
      { x: 0, y: 63, z: 0 },
      { x: 0, y: 62, z: 0 },
    ]);
    const ledge = chain.createLedgeCoil(0, { x: 0, y: 61, z: 0 });
    assert.ok(ledge);
    assert.equal(ledge.remaining, 18);
    assert.equal(chain.drops[0].remaining, 0);
    assert.equal(chain.drops.length, 2);
    assert.equal(chain.totalSegments, 20);
  });

  it("retractOneFromBottom removes last segment of bottommost drop", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [
      { x: 0, y: 63, z: 0 },
      { x: 0, y: 62, z: 0 },
    ]);
    const result = chain.retractOneFromBottom();
    assert.deepEqual(result.removed, { x: 0, y: 62, z: 0 });
    assert.equal(chain.drops[0].segments.length, 1);
    assert.equal(chain.drops[0].remaining, 4);
  });

  it("retractOneFromBottom merges empty drop back into parent", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    chain.createLedgeCoil(0, { x: 0, y: 62, z: 0 });
    chain.extendDrop(1, [{ x: 0, y: 61, z: 0 }]);

    chain.retractOneFromBottom();
    assert.equal(chain.drops.length, 1);
    assert.equal(chain.drops[0].remaining, 9);
  });

  it("fullRecoil clears all drops and restores total to anchor", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 20);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }, { x: 0, y: 62, z: 0 }]);
    chain.createLedgeCoil(0, { x: 0, y: 61, z: 0 });
    chain.extendDrop(1, [{ x: 0, y: 60, z: 0 }]);

    const removed = chain.fullRecoil();
    assert.equal(chain.drops.length, 1);
    assert.equal(chain.totalSegments, 20);
    assert.equal(chain.drops[0].remaining, 20);
    assert.ok(removed.length > 0);
  });

  it("breakAtSegment removes segment and all downstream drops", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    chain.extendDrop(0, [
      { x: 0, y: 63, z: 0 },
      { x: 0, y: 62, z: 0 },
      { x: 0, y: 61, z: 0 },
    ]);
    const broken = chain.breakAtSegment(0, 1);
    assert.equal(broken.length, 2);
    assert.deepEqual(broken[0], { x: 0, y: 62, z: 0 });
    assert.deepEqual(broken[1], { x: 0, y: 61, z: 0 });
    assert.equal(chain.drops[0].segments.length, 1);
  });

  it("breakAll returns all positions including anchor", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 3);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    const all = chain.breakAll();
    assert.ok(all.some(p => p.x === 0 && p.y === 64 && p.z === 0));
    assert.ok(all.some(p => p.x === 0 && p.y === 63 && p.z === 0));
  });

  it("getAllPositions includes anchor, ledge coils, and segments", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 10);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);
    chain.createLedgeCoil(0, { x: 0, y: 62, z: 0 });

    const positions = chain.getAllPositions();
    assert.ok(positions.some(p => p.x === 0 && p.y === 64 && p.z === 0));
    assert.ok(positions.some(p => p.x === 0 && p.y === 63 && p.z === 0));
    assert.ok(positions.some(p => p.x === 0 && p.y === 62 && p.z === 0));
  });

  it("getDropForPosition finds coil and segment positions", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 0, y: 64, z: 0 }, "up", 5);
    chain.extendDrop(0, [{ x: 0, y: 63, z: 0 }]);

    const coilResult = chain.getDropForPosition({ x: 0, y: 64, z: 0 });
    assert.ok(coilResult);
    assert.equal(coilResult.isCoil, true);

    const segResult = chain.getDropForPosition({ x: 0, y: 63, z: 0 });
    assert.ok(segResult);
    assert.equal(segResult.isCoil, false);
    assert.equal(segResult.segmentIndex, 0);

    const noResult = chain.getDropForPosition({ x: 99, y: 99, z: 99 });
    assert.equal(noResult, null);
  });

  it("isAnchor correctly identifies anchor position", () => {
    const chain = new RopeChain("rope_1", "rope", "minecraft:overworld", { x: 5, y: 10, z: 15 }, "north", 3);
    assert.equal(chain.isAnchor({ x: 5, y: 10, z: 15 }), true);
    assert.equal(chain.isAnchor({ x: 5, y: 9, z: 15 }), false);
  });
});
