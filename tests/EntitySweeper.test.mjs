import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { sweep, sweepLinear } from "../bigdoors_bp/scripts/subsystem/EntitySweeper.js";

function makeEntity(x, y, z) {
  return {
    location: { x, y, z },
    _teleported: null,
    teleport(dest) {
      this._teleported = dest;
    },
  };
}

describe("EntitySweeper", () => {
  beforeEach(() => {
    __reset();
  });

  it("teleports entities in the sweep path away from the hinge", () => {
    // Entity at (0,0,1) which is the destination of the rotation
    const entity = makeEntity(0, 0, 1);
    const dimension = {
      getEntities() {
        return [entity];
      },
    };

    const hingePos = { x: 0, y: 0, z: 0 };
    const sources = [{ x: 1, y: 0, z: 0 }];
    const destinations = [{ x: 0, y: 0, z: 1 }];

    sweep(dimension, destinations, sources, hingePos);

    assert.ok(entity._teleported, "Entity should have been teleported");
  });

  it("does not teleport entities outside the sweep path", () => {
    const entity = makeEntity(5, 0, 5);
    const dimension = {
      getEntities() {
        return [entity];
      },
    };

    const hingePos = { x: 0, y: 0, z: 0 };
    const sources = [{ x: 1, y: 0, z: 0 }];
    const destinations = [{ x: 0, y: 0, z: 1 }];

    sweep(dimension, destinations, sources, hingePos);

    assert.equal(entity._teleported, null, "Entity should not have been teleported");
  });

  it("handles entities at destination positions", () => {
    const entity = makeEntity(0, 0, 1);
    const dimension = {
      getEntities() {
        return [entity];
      },
    };

    const hingePos = { x: 0, y: 0, z: 0 };
    const sources = [{ x: 1, y: 0, z: 0 }];
    const destinations = [{ x: 0, y: 0, z: 1 }];

    sweep(dimension, destinations, sources, hingePos);

    assert.ok(entity._teleported, "Entity at destination should be teleported");
  });
});

describe("sweepLinear", () => {
  it("pushes entity at destination in the shift direction", () => {
    const entity = makeEntity(0, 1, 0);
    const dimension = {
      getEntities() { return [entity]; },
    };

    sweepLinear(dimension, [{ x: 0, y: 1, z: 0 }], "y", 1);

    assert.ok(entity._teleported, "Entity at destination should be teleported");
    assert.ok(entity._teleported.y > 1, "Entity should be pushed in +Y direction");
  });

  it("does not push entity outside destination positions", () => {
    const entity = makeEntity(5, 5, 5);
    const dimension = {
      getEntities() { return [entity]; },
    };

    sweepLinear(dimension, [{ x: 0, y: 1, z: 0 }], "y", 1);

    assert.equal(entity._teleported, null, "Entity outside destinations should not be teleported");
  });

  it("pushes in negative direction when shiftSign is -1", () => {
    const entity = makeEntity(0, -1, 0);
    const dimension = {
      getEntities() { return [entity]; },
    };

    sweepLinear(dimension, [{ x: 0, y: -1, z: 0 }], "y", -1);

    assert.ok(entity._teleported);
    assert.ok(entity._teleported.y < -1, "Entity should be pushed in -Y direction");
  });

  it("handles horizontal axis (x) shift", () => {
    const entity = makeEntity(3, 0, 0);
    const dimension = {
      getEntities() { return [entity]; },
    };

    sweepLinear(dimension, [{ x: 3, y: 0, z: 0 }], "x", 1);

    assert.ok(entity._teleported);
    assert.ok(entity._teleported.x > 3, "Entity should be pushed in +X direction");
    assert.equal(entity._teleported.y, 0, "Y should be unchanged");
    assert.equal(entity._teleported.z, 0, "Z should be unchanged");
  });

  it("portcullis destinations spanning multiple Y levels uses 3D bounding box", () => {
    const entityAtTop = makeEntity(0, 7, 0);
    const entityAtBottom = makeEntity(0, 5, 0);
    const entityFarAway = makeEntity(10, 7, 10);
    const dimension = {
      getEntities() { return [entityAtTop, entityAtBottom, entityFarAway]; },
    };

    const destinations = [
      { x: 0, y: 5, z: 0 },
      { x: 0, y: 6, z: 0 },
      { x: 0, y: 7, z: 0 },
    ];

    sweepLinear(dimension, destinations, "y", 1);

    assert.ok(entityAtTop._teleported, "Entity at top of destination range should be detected");
    assert.ok(entityAtBottom._teleported, "Entity at bottom of destination range should be detected");
    assert.equal(entityFarAway._teleported, null, "Entity far away should not be affected");
  });

  it("does nothing with empty destinations", () => {
    const entity = makeEntity(0, 0, 0);
    const dimension = {
      getEntities() { return [entity]; },
    };

    sweepLinear(dimension, [], "y", 1);

    assert.equal(entity._teleported, null);
  });

  it("horizontal winch — all destinations share Y level", () => {
    const entity = makeEntity(2, 0, 0);
    const dimension = {
      getEntities() { return [entity]; },
    };

    const destinations = [
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
    ];

    sweepLinear(dimension, destinations, "x", 1);

    assert.ok(entity._teleported, "Entity at destination should be pushed");
    assert.ok(entity._teleported.x > 2);
  });
});
