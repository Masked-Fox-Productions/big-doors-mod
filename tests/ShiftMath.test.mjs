import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getShiftFn, axisForDoorSide } from "../bigdoors_bp/scripts/domain/ShiftMath.js";

describe("axisForDoorSide", () => {
  it("down → y", () => assert.equal(axisForDoorSide("down"), "y"));
  it("up → y", () => assert.equal(axisForDoorSide("up"), "y"));
  it("north → z", () => assert.equal(axisForDoorSide("north"), "z"));
  it("south → z", () => assert.equal(axisForDoorSide("south"), "z"));
  it("east → x", () => assert.equal(axisForDoorSide("east"), "x"));
  it("west → x", () => assert.equal(axisForDoorSide("west"), "x"));
});

describe("getShiftFn", () => {
  it("single winch vertical — panel below shifts above", () => {
    const shiftFn = getShiftFn([{ x: 0, y: 5, z: 0 }], "down");
    assert.deepEqual(shiftFn({ x: 0, y: 4, z: 0 }), { x: 0, y: 6, z: 0 });
  });

  it("single winch vertical — panel 2 below shifts 2 above", () => {
    const shiftFn = getShiftFn([{ x: 0, y: 5, z: 0 }], "down");
    assert.deepEqual(shiftFn({ x: 0, y: 3, z: 0 }), { x: 0, y: 7, z: 0 });
  });

  it("portcullis — winch at y=4, doorSide=down, panel at y=3", () => {
    const shiftFn = getShiftFn([{ x: 0, y: 4, z: 0 }], "down");
    assert.deepEqual(shiftFn({ x: 0, y: 3, z: 0 }), { x: 0, y: 5, z: 0 });
  });

  it("portcullis — winch at y=4, doorSide=down, panel at y=1", () => {
    const shiftFn = getShiftFn([{ x: 0, y: 4, z: 0 }], "down");
    assert.deepEqual(shiftFn({ x: 0, y: 1, z: 0 }), { x: 0, y: 7, z: 0 });
  });

  it("horizontal — winch at x=0, doorSide=east, panel at x=1", () => {
    const shiftFn = getShiftFn([{ x: 0, y: 0, z: 0 }], "east");
    assert.deepEqual(shiftFn({ x: 1, y: 0, z: 0 }), { x: -1, y: 0, z: 0 });
  });

  it("horizontal — winch at x=0, doorSide=east, panel at x=2", () => {
    const shiftFn = getShiftFn([{ x: 0, y: 0, z: 0 }], "east");
    assert.deepEqual(shiftFn({ x: 2, y: 0, z: 0 }), { x: -2, y: 0, z: 0 });
  });

  it("preserves non-shift axes for vertical shift", () => {
    const shiftFn = getShiftFn([{ x: 3, y: 5, z: 7 }], "down");
    const result = shiftFn({ x: 3, y: 4, z: 7 });
    assert.equal(result.x, 3);
    assert.equal(result.z, 7);
  });

  it("preserves non-shift axes for horizontal shift", () => {
    const shiftFn = getShiftFn([{ x: 0, y: 5, z: 3 }], "east");
    const result = shiftFn({ x: 1, y: 5, z: 3 });
    assert.equal(result.y, 5);
    assert.equal(result.z, 3);
  });

  it("multi-winch column — 2 winches at y=4,5 with panel at y=3", () => {
    const shiftFn = getShiftFn([{ x: 0, y: 4, z: 0 }, { x: 0, y: 5, z: 0 }], "down");
    // sum = 4+5 = 9, dest = 9 - 3 = 6
    assert.deepEqual(shiftFn({ x: 0, y: 3, z: 0 }), { x: 0, y: 6, z: 0 });
  });

  it("multi-winch column — 2 winches at y=4,5 with panel at y=2", () => {
    const shiftFn = getShiftFn([{ x: 0, y: 4, z: 0 }, { x: 0, y: 5, z: 0 }], "down");
    // sum = 4+5 = 9, dest = 9 - 2 = 7
    assert.deepEqual(shiftFn({ x: 0, y: 2, z: 0 }), { x: 0, y: 7, z: 0 });
  });
});
