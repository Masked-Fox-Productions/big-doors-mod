import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { sweep } from "../bigdoors_bp/scripts/subsystem/EntitySweeper.js";

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
