import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rotateCW,
  rotateCCW,
  rotateVerticalCW,
  rotateVerticalCCW,
  computeArcPositions,
  getRotateFn,
} from "../bigdoors_bp/scripts/domain/RotationMath.js";

describe("RotationMath — horizontal", () => {
  const hinge = { x: 3, y: 0, z: 3 };

  it("rotateCW moves a point 2 blocks east to 2 blocks south", () => {
    // Point at (5,0,3) is 2 east of hinge (3,0,3)
    // CW from above: east → south → newZ = hinge.z + dx = 3 + 2 = 5, newX = hinge.x - dz = 3 - 0 = 3
    const result = rotateCW({ x: 5, y: 0, z: 3 }, hinge);
    assert.deepEqual(result, { x: 3, y: 0, z: 5 });
  });

  it("rotateCCW moves a point 2 blocks east to 2 blocks north", () => {
    // CCW from above: east → north → newZ = hinge.z - dx = 3 - 2 = 1, newX = hinge.x + dz = 3 + 0 = 3
    const result = rotateCCW({ x: 5, y: 0, z: 3 }, hinge);
    assert.deepEqual(result, { x: 3, y: 0, z: 1 });
  });

  it("rotateCCW reverses rotateCW for any position", () => {
    const testPositions = [
      { x: 5, y: 0, z: 3 },
      { x: 1, y: 5, z: 7 },
      { x: 3, y: 0, z: 3 },   // at hinge
      { x: 10, y: 3, z: -5 },
      { x: -2, y: 0, z: 8 },
    ];
    for (const pos of testPositions) {
      const rotated = rotateCW(pos, hinge);
      const restored = rotateCCW(rotated, hinge);
      assert.deepEqual(
        restored,
        { x: pos.x, y: pos.y, z: pos.z },
        `CCW should reverse CW for pos ${JSON.stringify(pos)}`
      );
    }
  });

  it("rotation at hinge (distance 0) returns hinge unchanged", () => {
    const atHinge = { x: 3, y: 0, z: 3 };
    assert.deepEqual(rotateCW(atHinge, hinge), { x: 3, y: 0, z: 3 });
    assert.deepEqual(rotateCCW(atHinge, hinge), { x: 3, y: 0, z: 3 });
  });

  it("rotation far from hinge (distance 20) produces valid integer result", () => {
    const farPos = { x: 23, y: 0, z: 3 };
    const result = rotateCW(farPos, hinge);
    assert.equal(Number.isInteger(result.x), true);
    assert.equal(Number.isInteger(result.y), true);
    assert.equal(Number.isInteger(result.z), true);
    // 20 east → 20 south
    assert.deepEqual(result, { x: 3, y: 0, z: 23 });
  });

  it("preserves Y coordinate during horizontal rotation", () => {
    const pos = { x: 5, y: 42, z: 3 };
    assert.equal(rotateCW(pos, hinge).y, 42);
    assert.equal(rotateCCW(pos, hinge).y, 42);
  });

  it("four CW rotations return to original position", () => {
    const pos = { x: 7, y: 2, z: 1 };
    let current = pos;
    for (let i = 0; i < 4; i++) {
      current = rotateCW(current, hinge);
    }
    assert.deepEqual(current, { x: pos.x, y: pos.y, z: pos.z });
  });
});

describe("RotationMath — vertical (north/south facing)", () => {
  const hinge = { x: 0, y: 5, z: 0 };

  it("rotateVerticalCW rotates in Y/Z plane for north-facing hinge", () => {
    // Point 2 blocks above hinge: (0, 7, 0)
    // Axis runs E/W, so Y and Z change, X stays
    // dz=0, dy=2 → newY = 5-0=5, newZ = 0+2=2
    const pos = { x: 0, y: 7, z: 0 };
    const result = rotateVerticalCW(pos, hinge, "north");
    assert.deepEqual(result, { x: 0, y: 5, z: 2 });
  });

  it("rotateVerticalCCW reverses rotateVerticalCW for north-facing", () => {
    const pos = { x: 0, y: 7, z: 3 };
    const rotated = rotateVerticalCW(pos, hinge, "north");
    const restored = rotateVerticalCCW(rotated, hinge, "north");
    assert.deepEqual(restored, { x: pos.x, y: pos.y, z: pos.z });
  });

  it("preserves X coordinate for north/south vertical rotation", () => {
    const pos = { x: 99, y: 8, z: 2 };
    assert.equal(rotateVerticalCW(pos, hinge, "north").x, 99);
    assert.equal(rotateVerticalCCW(pos, hinge, "south").x, 99);
  });
});

describe("RotationMath — vertical (east/west facing)", () => {
  const hinge = { x: 0, y: 5, z: 0 };

  it("rotateVerticalCW rotates in Y/X plane for east-facing hinge", () => {
    // Point 2 blocks above hinge: (0, 7, 0)
    // Axis runs N/S, so Y and X change, Z stays
    // dx=0, dy=2 → newX = 0+2=2, newY = 5-0=5
    const pos = { x: 0, y: 7, z: 0 };
    const result = rotateVerticalCW(pos, hinge, "east");
    assert.deepEqual(result, { x: 2, y: 5, z: 0 });
  });

  it("rotateVerticalCCW reverses rotateVerticalCW for east-facing", () => {
    const pos = { x: 3, y: 8, z: 0 };
    const rotated = rotateVerticalCW(pos, hinge, "east");
    const restored = rotateVerticalCCW(rotated, hinge, "east");
    assert.deepEqual(restored, { x: pos.x, y: pos.y, z: pos.z });
  });

  it("preserves Z coordinate for east/west vertical rotation", () => {
    const pos = { x: 3, y: 8, z: 77 };
    assert.equal(rotateVerticalCW(pos, hinge, "east").z, 77);
    assert.equal(rotateVerticalCCW(pos, hinge, "west").z, 77);
  });
});

describe("getRotateFn", () => {
  const hinge = { x: 0, y: 5, z: 0 };

  it("returns rotateCW-equivalent for horizontal/cw", () => {
    const fn = getRotateFn("horizontal", "north", "cw");
    const pos = { x: 2, y: 5, z: 0 };
    assert.deepEqual(fn(pos, hinge), rotateCW(pos, hinge));
  });

  it("returns rotateCCW-equivalent for horizontal/ccw", () => {
    const fn = getRotateFn("horizontal", "north", "ccw");
    const pos = { x: 2, y: 5, z: 0 };
    assert.deepEqual(fn(pos, hinge), rotateCCW(pos, hinge));
  });

  it("returns rotateVerticalCW with facing curried for vertical/north/cw", () => {
    const fn = getRotateFn("vertical", "north", "cw");
    const pos = { x: 0, y: 7, z: 0 };
    assert.deepEqual(fn(pos, hinge), rotateVerticalCW(pos, hinge, "north"));
  });

  it("returns rotateVerticalCCW with facing curried for vertical/east/ccw", () => {
    const fn = getRotateFn("vertical", "east", "ccw");
    const pos = { x: 0, y: 7, z: 0 };
    assert.deepEqual(fn(pos, hinge), rotateVerticalCCW(pos, hinge, "east"));
  });

  it("returned vertical function has (pos, hingePos) signature", () => {
    const fn = getRotateFn("vertical", "south", "cw");
    const pos = { x: 3, y: 7, z: 0 };
    const result = fn(pos, hinge);
    assert.deepEqual(result, rotateVerticalCW(pos, hinge, "south"));
  });
});

describe("computeArcPositions", () => {
  it("returns intermediate positions for entity sweep", () => {
    const hinge = { x: 0, y: 0, z: 0 };
    const pos = { x: 4, y: 0, z: 0 };
    const arc = computeArcPositions(pos, hinge);
    assert.ok(arc.length > 0, "should return at least one arc position");
    // The midpoint at 45 degrees should be at roughly (2.8, 0, 2.8)
    assert.equal(arc[0].y, 0);
    assert.ok(Number.isInteger(arc[0].x));
    assert.ok(Number.isInteger(arc[0].z));
  });

  it("returns hinge-area position when panel is at hinge", () => {
    const hinge = { x: 5, y: 0, z: 5 };
    const arc = computeArcPositions(hinge, hinge);
    assert.equal(arc.length, 1);
    assert.deepEqual(arc[0], { x: 5, y: 0, z: 5 });
  });
});
