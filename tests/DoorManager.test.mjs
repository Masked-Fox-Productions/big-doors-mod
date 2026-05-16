import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset, __setWorld, world } from "./stubs/minecraft-server.mjs";
import { DoorManager } from "../bigdoors_bp/scripts/DoorManager.js";

describe("DoorManager", () => {
  let mgr;

  beforeEach(() => {
    __reset();
    mgr = new DoorManager();
  });

  it("createAssembly stores a new assembly retrievable by findByPosition", () => {
    const assembly = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    assert.equal(assembly.id, "door_1");
    assert.equal(assembly.facing, "north");

    const found = mgr.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(found, assembly);
  });

  it("save/load round-trip preserves all assemblies with correct state", () => {
    const a1 = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.addPanelToAssembly(a1.id, { x: 1, y: 0, z: 0 }, 3);
    const a2 = mgr.createAssembly({ x: 10, y: 0, z: 0 }, "south", "vertical");

    const mgr2 = new DoorManager();
    mgr2.load();

    const loaded1 = mgr2.getAssembly("door_1");
    assert.ok(loaded1);
    assert.equal(loaded1.facing, "north");
    assert.equal(loaded1.mode, "horizontal");
    assert.equal(loaded1.panelPositions.length, 1);
    assert.equal(loaded1.panelPositions[0].materialIndex, 3);

    const loaded2 = mgr2.getAssembly("door_2");
    assert.ok(loaded2);
    assert.equal(loaded2.facing, "south");
    assert.equal(loaded2.mode, "vertical");
  });

  it("addPanelToAssembly adds panel, findByPosition returns the assembly for the panel position", () => {
    const assembly = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 5);

    const found = mgr.findByPosition({ x: 1, y: 0, z: 0 });
    assert.equal(found, assembly);
  });

  it("removePanelFromAssembly removes panel, position no longer found", () => {
    const assembly = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 5);
    mgr.addPanelToAssembly(assembly.id, { x: 2, y: 0, z: 0 }, 5);
    mgr.removePanelFromAssembly(assembly.id, { x: 1, y: 0, z: 0 });

    assert.equal(mgr.findByPosition({ x: 1, y: 0, z: 0 }), null);
    assert.equal(mgr.findByPosition({ x: 2, y: 0, z: 0 }), assembly);
  });

  it("removePanelFromAssembly on last panel dissolves the assembly", () => {
    const assembly = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 5);
    mgr.removePanelFromAssembly(assembly.id, { x: 1, y: 0, z: 0 });

    assert.equal(mgr.getAssembly(assembly.id), null);
    assert.equal(mgr.findByPosition({ x: 0, y: 0, z: 0 }), null);
  });

  it("openDoor/closeDoor updates assembly isOpen state", () => {
    const assembly = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 0);

    mgr.openDoor(assembly.id, "cw", [{ x: 0, y: 0, z: 1 }]);
    assert.equal(assembly.isOpen, true);
    assert.equal(assembly.openDirection, "cw");

    mgr.closeDoor(assembly.id);
    assert.equal(assembly.isOpen, false);
    assert.equal(assembly.openDirection, "");
  });

  it("load() with null dynamic property initializes empty registry", () => {
    mgr.load();
    assert.equal(mgr.findByPosition({ x: 0, y: 0, z: 0 }), null);
  });

  it("load() called twice does not duplicate assemblies", () => {
    mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");

    const mgr2 = new DoorManager();
    mgr2.load();
    mgr2.load();

    assert.equal(mgr2._assemblies.size, 1);
  });

  it("dissolveAssembly removes all positions from index", () => {
    const assembly = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 0);
    mgr.addPanelToAssembly(assembly.id, { x: 2, y: 0, z: 0 }, 0);
    mgr.dissolveAssembly(assembly.id);

    assert.equal(mgr.findByPosition({ x: 0, y: 0, z: 0 }), null);
    assert.equal(mgr.findByPosition({ x: 1, y: 0, z: 0 }), null);
    assert.equal(mgr.findByPosition({ x: 2, y: 0, z: 0 }), null);
    assert.equal(mgr.getAssembly(assembly.id), null);
  });

  it("openDoor updates _positionIndex — old positions removed, new positions added", () => {
    const assembly = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 0);
    mgr.addPanelToAssembly(assembly.id, { x: 2, y: 0, z: 0 }, 0);

    mgr.openDoor(assembly.id, "cw", [
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 2 },
    ]);

    assert.equal(mgr.findByPosition({ x: 0, y: 0, z: 1 }), assembly);
    assert.equal(mgr.findByPosition({ x: 0, y: 0, z: 2 }), assembly);
  });

  it("findByPosition returns assembly at open (rotated) position", () => {
    const assembly = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 0);

    mgr.openDoor(assembly.id, "cw", [{ x: 0, y: 0, z: 1 }]);

    const found = mgr.findByPosition({ x: 0, y: 0, z: 1 });
    assert.equal(found, assembly);
  });

  it("closeDoor reverts _positionIndex to original closed positions", () => {
    const assembly = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 0);

    mgr.openDoor(assembly.id, "cw", [{ x: 0, y: 0, z: 1 }]);
    mgr.closeDoor(assembly.id);

    assert.equal(mgr.findByPosition({ x: 1, y: 0, z: 0 }), assembly);
    assert.equal(mgr.findByPosition({ x: 0, y: 0, z: 1 }), null);
  });

  it("findByPosition returns null for closed position when door is open", () => {
    const assembly = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 0);

    mgr.openDoor(assembly.id, "cw", [{ x: 0, y: 0, z: 1 }]);

    assert.equal(mgr.findByPosition({ x: 1, y: 0, z: 0 }), null);
  });

  it("findByPosition still returns assembly for hinge position when door is open", () => {
    const assembly = mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 0);

    mgr.openDoor(assembly.id, "cw", [{ x: 0, y: 0, z: 1 }]);

    const found = mgr.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(found, assembly);
  });

  it("save() with oversized payload logs warning instead of crashing", () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (msg) => warnings.push(msg);

    __setWorld({
      getDynamicProperty() { return undefined; },
      setDynamicProperty() { throw new Error("Payload too large"); },
    });

    const mgr2 = new DoorManager();
    mgr2.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");

    console.warn = origWarn;

    assert.ok(warnings.some((w) => w.includes("Failed to save")));
  });

  it("load() restores _nextId so new assemblies get unique ids", () => {
    mgr.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    mgr.createAssembly({ x: 5, y: 0, z: 0 }, "south", "horizontal");

    const mgr2 = new DoorManager();
    mgr2.load();
    const a3 = mgr2.createAssembly({ x: 10, y: 0, z: 0 }, "east", "vertical");
    assert.equal(a3.id, "door_3");
  });
});
