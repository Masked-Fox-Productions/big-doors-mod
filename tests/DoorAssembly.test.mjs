import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DoorAssembly } from "../bigdoors_bp/scripts/domain/DoorAssembly.js";
import { UNMATCHED_MATERIAL_INDEX } from "../bigdoors_bp/scripts/util/Constants.js";

describe("DoorAssembly", () => {
  let assembly;

  beforeEach(() => {
    assembly = new DoorAssembly(
      "test-1",
      { x: 0, y: 0, z: 0 },
      "north",
      "horizontal"
    );
  });

  it("initializes with correct defaults", () => {
    assert.equal(assembly.id, "test-1");
    assert.deepEqual(assembly.primaryHingePos, { x: 0, y: 0, z: 0 });
    assert.equal(assembly.hingePositions.length, 1);
    assert.equal(assembly.panelPositions.length, 0);
    assert.equal(assembly.facing, "north");
    assert.equal(assembly.mode, "horizontal");
    assert.equal(assembly.isOpen, false);
    assert.equal(assembly.openDirection, "");
    assert.equal(assembly.partnerAssemblyId, null);
  });

  it("addHinge increases hinge count", () => {
    assembly.addHinge({ x: 0, y: 1, z: 0 });
    assert.equal(assembly.hingePositions.length, 2);
  });

  it("addPanel increases panel count", () => {
    assembly.addPanel({ x: 1, y: 0, z: 0 }, 12);
    assert.equal(assembly.panelPositions.length, 1);
    assert.equal(assembly.panelPositions[0].materialIndex, 12);
  });

  it("removePanel decreases panel count", () => {
    assembly.addPanel({ x: 1, y: 0, z: 0 }, 12);
    assembly.addPanel({ x: 2, y: 0, z: 0 }, 11);
    assert.equal(assembly.panelPositions.length, 2);

    const removed = assembly.removePanel({ x: 1, y: 0, z: 0 });
    assert.equal(removed, true);
    assert.equal(assembly.panelPositions.length, 1);
  });

  it("removePanel returns false for non-existent position", () => {
    const removed = assembly.removePanel({ x: 99, y: 99, z: 99 });
    assert.equal(removed, false);
  });

  it("updatePanelPositions updates currentPos for all panels", () => {
    assembly.addPanel({ x: 1, y: 0, z: 0 }, 12);
    assembly.addPanel({ x: 2, y: 0, z: 0 }, 11);

    assembly.updatePanelPositions([
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 2 },
    ]);

    assert.deepEqual(assembly.panelPositions[0].currentPos, { x: 0, y: 0, z: 1 });
    assert.deepEqual(assembly.panelPositions[1].currentPos, { x: 0, y: 0, z: 2 });
    // closedPos should be unchanged
    assert.deepEqual(assembly.panelPositions[0].closedPos, { x: 1, y: 0, z: 0 });
    assert.deepEqual(assembly.panelPositions[1].closedPos, { x: 2, y: 0, z: 0 });
  });

  it("getAllCurrentPositions returns currentPos values", () => {
    assembly.addPanel({ x: 1, y: 0, z: 0 }, 12);
    assembly.addPanel({ x: 2, y: 0, z: 0 }, 11);

    // Before rotation, currentPos equals closedPos
    const positions = assembly.getAllCurrentPositions();
    assert.deepEqual(positions, [
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ]);

    // After rotation
    assembly.updatePanelPositions([
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 2 },
    ]);
    assembly.isOpen = true;

    const openPositions = assembly.getAllCurrentPositions();
    assert.deepEqual(openPositions, [
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 2 },
    ]);
  });

  it("round-trips through toJSON/fromJSON with all properties preserved", () => {
    assembly.addHinge({ x: 0, y: 1, z: 0 });
    assembly.addPanel({ x: 1, y: 0, z: 0 }, 12);
    assembly.addPanel({ x: 2, y: 0, z: 0 }, 11);
    assembly.doorSide = "east";
    assembly.isOpen = true;
    assembly.openDirection = "cw";
    assembly.partnerAssemblyId = "partner-1";

    // Simulate rotated positions
    assembly.updatePanelPositions([
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 2 },
    ]);

    const json = assembly.toJSON();
    const restored = DoorAssembly.fromJSON(json);

    assert.equal(restored.id, "test-1");
    assert.deepEqual(restored.primaryHingePos, { x: 0, y: 0, z: 0 });
    assert.equal(restored.hingePositions.length, 2);
    assert.equal(restored.panelPositions.length, 2);
    assert.equal(restored.facing, "north");
    assert.equal(restored.doorSide, "east");
    assert.equal(restored.mode, "horizontal");
    assert.equal(restored.isOpen, true);
    assert.equal(restored.openDirection, "cw");
    assert.equal(restored.partnerAssemblyId, "partner-1");
  });

  it("preserves closedPos and currentPos through serialization", () => {
    assembly.addPanel({ x: 1, y: 0, z: 0 }, 12);
    assembly.updatePanelPositions([{ x: 0, y: 0, z: 1 }]);

    const json = assembly.toJSON();
    const restored = DoorAssembly.fromJSON(json);

    assert.deepEqual(restored.panelPositions[0].closedPos, { x: 1, y: 0, z: 0 });
    assert.deepEqual(restored.panelPositions[0].currentPos, { x: 0, y: 0, z: 1 });
  });

  it("fromJSON handles missing optional fields gracefully", () => {
    const minimal = {
      id: "min-1",
      primaryHingePos: { x: 0, y: 0, z: 0 },
      hingePositions: [{ x: 0, y: 0, z: 0 }],
      panelPositions: [],
      facing: "south",
      mode: "vertical",
    };

    const restored = DoorAssembly.fromJSON(minimal);
    assert.equal(restored.isOpen, false);
    assert.equal(restored.openDirection, "");
    assert.equal(restored.partnerAssemblyId, null);
    assert.equal(restored.doorSide, "");
  });

  it("does not share references with the source positions", () => {
    const pos = { x: 5, y: 0, z: 5 };
    assembly.addPanel(pos, 0);
    pos.x = 999;
    assert.equal(assembly.panelPositions[0].closedPos.x, 5);
  });

  it("addPanel with geometryId stores and round-trips through toJSON/fromJSON", () => {
    assembly.addPanel({ x: 1, y: 0, z: 0 }, 128, 8);
    assert.equal(assembly.panelPositions[0].geometryId, 8);

    const json = assembly.toJSON();
    assert.equal(json.panelPositions[0].geometryId, 8);

    const restored = DoorAssembly.fromJSON(json);
    assert.equal(restored.panelPositions[0].geometryId, 8);
  });

  it("addPanel without geometryId omits it from JSON", () => {
    assembly.addPanel({ x: 1, y: 0, z: 0 }, 128);
    assert.equal(assembly.panelPositions[0].geometryId, undefined);

    const json = assembly.toJSON();
    assert.equal("geometryId" in json.panelPositions[0], false);
  });

  it("fromJSON with missing geometryId sets undefined", () => {
    const json = {
      id: "legacy-1",
      primaryHingePos: { x: 0, y: 0, z: 0 },
      hingePositions: [{ x: 0, y: 0, z: 0 }],
      panelPositions: [{ materialIndex: 128, closedPos: { x: 1, y: 0, z: 0 }, currentPos: { x: 1, y: 0, z: 0 } }],
      facing: "north",
      mode: "horizontal",
    };
    const restored = DoorAssembly.fromJSON(json);
    assert.equal(restored.panelPositions[0].geometryId, undefined);
  });

  it("new assembly has redstoneSource === null", () => {
    assert.equal(assembly.redstoneSource, null);
  });

  it("toJSON includes redstoneSource when set, omits when null", () => {
    const jsonWithout = assembly.toJSON();
    assert.equal("redstoneSource" in jsonWithout, false);

    assembly.redstoneSource = { x: 5, y: 0, z: 3 };
    const jsonWith = assembly.toJSON();
    assert.deepEqual(jsonWith.redstoneSource, { x: 5, y: 0, z: 3 });
  });

  it("fromJSON restores a saved redstoneSource position correctly", () => {
    assembly.redstoneSource = { x: 2, y: 1, z: -1 };
    const json = assembly.toJSON();
    const restored = DoorAssembly.fromJSON(json);
    assert.deepEqual(restored.redstoneSource, { x: 2, y: 1, z: -1 });
  });

  it("fromJSON on legacy data without redstoneSource defaults to null", () => {
    const legacy = {
      id: "legacy-rs",
      primaryHingePos: { x: 0, y: 0, z: 0 },
      hingePositions: [{ x: 0, y: 0, z: 0 }],
      panelPositions: [],
      facing: "north",
      mode: "horizontal",
    };
    const restored = DoorAssembly.fromJSON(legacy);
    assert.equal(restored.redstoneSource, null);
  });

  describe("hinge type and material tracking", () => {
    it("constructor defaults to hinge type with unmatched material", () => {
      assert.equal(assembly.hingePositions[0].type, "hinge");
      assert.equal(assembly.hingePositions[0].materialIndex, UNMATCHED_MATERIAL_INDEX);
    });

    it("constructor accepts hidden hinge type", () => {
      const hidden = new DoorAssembly("h-1", { x: 0, y: 0, z: 0 }, "north", "horizontal", "hidden");
      assert.equal(hidden.hingePositions[0].type, "hidden");
      assert.equal(hidden.hingeType, "hidden");
    });

    it("hingeType getter returns primary hinge type", () => {
      assert.equal(assembly.hingeType, "hinge");
      assembly.addHinge({ x: 0, y: 1, z: 0 }, "hidden");
      assert.equal(assembly.hingeType, "hinge");
    });

    it("addHinge stores type and unmatched materialIndex", () => {
      assembly.addHinge({ x: 0, y: 1, z: 0 }, "hidden");
      assert.equal(assembly.hingePositions[1].type, "hidden");
      assert.equal(assembly.hingePositions[1].materialIndex, UNMATCHED_MATERIAL_INDEX);
    });

    it("hinge type and materialIndex round-trip through toJSON/fromJSON", () => {
      assembly.addHinge({ x: 0, y: 1, z: 0 }, "hidden");
      assembly.hingePositions[0].materialIndex = 5;

      const json = assembly.toJSON();
      assert.equal(json.hingePositions[0].type, "hinge");
      assert.equal(json.hingePositions[0].materialIndex, 5);
      assert.equal(json.hingePositions[1].type, "hidden");

      const restored = DoorAssembly.fromJSON(json);
      assert.equal(restored.hingePositions[0].type, "hinge");
      assert.equal(restored.hingePositions[0].materialIndex, 5);
      assert.equal(restored.hingePositions[1].type, "hidden");
      assert.equal(restored.hingePositions[1].materialIndex, UNMATCHED_MATERIAL_INDEX);
      assert.equal(restored.hingeType, "hinge");
    });

    it("fromJSON with legacy hinge data defaults type to hinge", () => {
      const legacy = {
        id: "legacy-hinge",
        primaryHingePos: { x: 0, y: 0, z: 0 },
        hingePositions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }],
        panelPositions: [],
        facing: "north",
        mode: "horizontal",
      };
      const restored = DoorAssembly.fromJSON(legacy);
      assert.equal(restored.hingePositions[0].type, "hinge");
      assert.equal(restored.hingePositions[0].materialIndex, UNMATCHED_MATERIAL_INDEX);
      assert.equal(restored.hingePositions[1].type, "hinge");
      assert.equal(restored.hingeType, "hinge");
    });

    it("assembly with only hidden hinges returns hidden from hingeType", () => {
      const hidden = new DoorAssembly("hh-1", { x: 0, y: 0, z: 0 }, "north", "horizontal", "hidden");
      hidden.addHinge({ x: 0, y: 1, z: 0 }, "hidden");
      assert.equal(hidden.hingeType, "hidden");
    });

    it("winch type round-trips through toJSON/fromJSON", () => {
      const winch = new DoorAssembly("w-1", { x: 0, y: 4, z: 0 }, "north", "vertical", "winch");
      winch.addHinge({ x: 1, y: 4, z: 0 }, "winch");
      winch.doorSide = "down";
      winch.addPanel({ x: 0, y: 3, z: 0 }, 92);

      const json = winch.toJSON();
      assert.equal(json.hingePositions[0].type, "winch");
      assert.equal(json.hingePositions[1].type, "winch");

      const restored = DoorAssembly.fromJSON(json);
      assert.equal(restored.hingeType, "winch");
      assert.equal(restored.hingePositions[0].type, "winch");
      assert.equal(restored.hingePositions[1].type, "winch");
      assert.equal(restored.panelPositions.length, 1);
    });

    it("hidden_winch type round-trips through toJSON/fromJSON", () => {
      const hw = new DoorAssembly("hw-1", { x: 0, y: 4, z: 0 }, "north", "vertical", "hidden_winch");
      const json = hw.toJSON();
      const restored = DoorAssembly.fromJSON(json);
      assert.equal(restored.hingeType, "hidden_winch");
    });
  });

  describe("panel overlay tracking", () => {
    it("addPanel defaults overlay to 0", () => {
      assembly.addPanel({ x: 1, y: 0, z: 0 }, 12);
      assert.equal(assembly.panelPositions[0].overlay, 0);
    });

    it("addPanel accepts overlay parameter", () => {
      assembly.addPanel({ x: 1, y: 0, z: 0 }, 12, undefined, 1);
      assert.equal(assembly.panelPositions[0].overlay, 1);
    });

    it("overlay round-trips through toJSON/fromJSON", () => {
      assembly.addPanel({ x: 1, y: 0, z: 0 }, 12, undefined, 1);
      assembly.addPanel({ x: 2, y: 0, z: 0 }, 11, undefined, 0);

      const json = assembly.toJSON();
      assert.equal(json.panelPositions[0].overlay, 1);
      assert.equal(json.panelPositions[1].overlay, 0);

      const restored = DoorAssembly.fromJSON(json);
      assert.equal(restored.panelPositions[0].overlay, 1);
      assert.equal(restored.panelPositions[1].overlay, 0);
    });

    it("fromJSON with legacy panel data defaults overlay to 0", () => {
      const legacy = {
        id: "legacy-panel",
        primaryHingePos: { x: 0, y: 0, z: 0 },
        hingePositions: [{ x: 0, y: 0, z: 0 }],
        panelPositions: [{ materialIndex: 12, closedPos: { x: 1, y: 0, z: 0 }, currentPos: { x: 1, y: 0, z: 0 } }],
        boundaryPanels: [{ materialIndex: 5, closedPos: { x: 2, y: 0, z: 0 }, currentPos: { x: 2, y: 0, z: 0 } }],
        facing: "north",
        mode: "horizontal",
      };
      const restored = DoorAssembly.fromJSON(legacy);
      assert.equal(restored.panelPositions[0].overlay, 0);
      assert.equal(restored.boundaryPanels[0].overlay, 0);
    });
  });
});
