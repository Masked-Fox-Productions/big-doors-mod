import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { closedRotation, openRotation } from "../bigdoors_bp/scripts/domain/PanelRotation.js";
import {
  GEOMETRY_CLASS_FENCE,
  GEOMETRY_CLASS_SLAB,
} from "../bigdoors_bp/scripts/util/Constants.js";

describe("closedRotation", () => {
  it("horizontal east -> 2", () => {
    assert.equal(closedRotation("east", "north", 0), 2);
  });

  it("horizontal south -> 1", () => {
    assert.equal(closedRotation("south", "north", 0), 1);
  });

  it("horizontal west -> 0", () => {
    assert.equal(closedRotation("west", "north", 0), 0);
  });

  it("horizontal north -> 3", () => {
    assert.equal(closedRotation("north", "east", 0), 3);
  });

  it("vertical full-block facing north -> 5", () => {
    assert.equal(closedRotation("up", "north", 0), 5);
  });

  it("vertical full-block facing east -> 4", () => {
    assert.equal(closedRotation("up", "east", 0), 4);
  });

  it("vertical fence facing north -> 2", () => {
    assert.equal(closedRotation("up", "north", GEOMETRY_CLASS_FENCE), 2);
  });

  it("vertical fence facing east -> 1", () => {
    assert.equal(closedRotation("down", "east", GEOMETRY_CLASS_FENCE), 1);
  });

  it("vertical slab facing north -> 2 (same as fence)", () => {
    assert.equal(closedRotation("up", "north", GEOMETRY_CLASS_SLAB), 2);
  });

  it("vertical slab facing east -> 1 (same as fence)", () => {
    assert.equal(closedRotation("down", "east", GEOMETRY_CLASS_SLAB), 1);
  });
});

describe("openRotation", () => {
  it("vertical full-block facing north -> 1", () => {
    assert.equal(openRotation("vertical", "up", "north", "cw", 0), 1);
  });

  it("vertical full-block facing east -> 0", () => {
    assert.equal(openRotation("vertical", "up", "east", "cw", 0), 0);
  });

  it("vertical fence facing north -> 6", () => {
    assert.equal(openRotation("vertical", "up", "north", "cw", GEOMETRY_CLASS_FENCE), 6);
  });

  it("vertical fence facing east -> 5", () => {
    assert.equal(openRotation("vertical", "up", "east", "cw", GEOMETRY_CLASS_FENCE), 5);
  });

  it("vertical slab facing north -> 6 (same as fence)", () => {
    assert.equal(openRotation("vertical", "up", "north", "cw", GEOMETRY_CLASS_SLAB), 6);
  });

  it("horizontal cw from east (closed=2) -> 1", () => {
    assert.equal(openRotation("horizontal", "east", "north", "cw", 0), 1);
  });

  it("horizontal ccw from east (closed=2) -> 3", () => {
    assert.equal(openRotation("horizontal", "east", "north", "ccw", 0), 3);
  });

  it("horizontal cw from south (closed=1) -> 0", () => {
    assert.equal(openRotation("horizontal", "south", "north", "cw", 0), 0);
  });

  it("horizontal ccw from south (closed=1) -> 2", () => {
    assert.equal(openRotation("horizontal", "south", "north", "ccw", 0), 2);
  });
});
