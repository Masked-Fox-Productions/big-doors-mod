import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { DoorManager } from "../bigdoors_bp/scripts/DoorManager.js";
import { PanelPlacementHandler } from "../bigdoors_bp/scripts/handler/PanelPlacementHandler.js";
import {
  makeMockDimension,
  placeBlock,
} from "./helpers/mock-dimension.mjs";
import { HINGE_BLOCK_ID, HIDDEN_HINGE_BLOCK_ID, PANEL_BLOCK_ID, PANEL_SLAB_BLOCK_ID, GEOMETRY_CLASS_SLAB, GEOMETRY_ID_SLAB_TOP, UNMATCHED_MATERIAL_INDEX } from "../bigdoors_bp/scripts/util/Constants.js";

describe("PanelPlacementHandler", () => {
  let manager;
  let handler;

  beforeEach(() => {
    __reset();
    manager = new DoorManager();
    handler = new PanelPlacementHandler(manager);
  });

  function setupHingeAssembly(dim, hingePos, facing, mode, doorSide) {
    placeBlock(dim, HINGE_BLOCK_ID, hingePos, {
      "bigdoors:facing": facing,
      "bigdoors:mode": mode,
      "bigdoors:door_side": doorSide,
    });
    const assembly = manager.createAssembly(hingePos, facing, mode);
    if (doorSide) {
      manager.setDoorSide(assembly.id, doorSide);
    }
    return assembly;
  }

  it("placing supported material next to hinge with unset door_side sets door_side and converts block", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, true);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.doorSide, "east");
    assert.equal(assembly.panelPositions.length, 1);
    assert.equal(block.typeId, PANEL_BLOCK_ID);
  });

  it("placing unsupported material next to hinge does not convert", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "");

    const block = placeBlock(dim, "minecraft:sponge", { x: 1, y: 0, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, false);
    assert.equal(block.typeId, "minecraft:sponge");
  });

  it("placing block on door_side of hinge converts it", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, true);
    assert.equal(block.typeId, PANEL_BLOCK_ID);
  });

  it("placing block on wall side (opposite of door_side) is ignored", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: -1, y: 0, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, false);
    assert.equal(block.typeId, "minecraft:cobblestone");
  });

  it("placing block on a side that is not the door_side is ignored", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 0, z: 1 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, false);
    assert.equal(block.typeId, "minecraft:cobblestone");
  });

  it("placing a vanilla block adjacent to an existing door panel expands the assembly", () => {
    const dim = makeMockDimension();
    const assembly = setupHingeAssembly(
      dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east"
    );

    placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, {
      "bigdoors:material": 12,
    });
    manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12);

    const newBlock = placeBlock(dim, "minecraft:cobblestone", { x: 2, y: 0, z: 0 });

    const result = handler.onPlace(newBlock, dim);
    assert.equal(result, true);
    assert.equal(newBlock.typeId, PANEL_BLOCK_ID);
    assert.equal(assembly.panelPositions.length, 2);
  });

  it("panel-adjacent expansion stops at unsupported materials", () => {
    const dim = makeMockDimension();
    const assembly = setupHingeAssembly(
      dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east"
    );

    placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, {
      "bigdoors:material": 12,
    });
    manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12);

    const newBlock = placeBlock(dim, "minecraft:sponge", { x: 2, y: 0, z: 0 });

    const result = handler.onPlace(newBlock, dim);
    assert.equal(result, false);
    assert.equal(newBlock.typeId, "minecraft:sponge");
    assert.equal(assembly.panelPositions.length, 1);
  });

  it("panel-adjacent expansion does not cross to the wall side of the hinge", () => {
    const dim = makeMockDimension();
    const assembly = setupHingeAssembly(
      dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east"
    );

    placeBlock(dim, PANEL_BLOCK_ID, { x: -1, y: 0, z: 0 }, {
      "bigdoors:material": 12,
    });

    const wallBlock = placeBlock(dim, "minecraft:cobblestone", { x: -1, y: 0, z: 0 });

    const result = handler.onPlace(wallBlock, dim);
    assert.equal(result, false);
  });

  it("hinge block placement events are ignored", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 1, y: 0, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, false);
  });

  it("panel block placement events are ignored", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

    const block = placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, false);
  });

  it("placing supported material next to hinge on north side sets door_side to north", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "east", "horizontal", "");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 0, z: -1 });

    handler.onPlace(block, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.doorSide, "north");
  });

  it("material index is preserved on converted panels", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

    const block = placeBlock(dim, "minecraft:oak_planks", { x: 1, y: 0, z: 0 });

    handler.onPlace(block, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.panelPositions[0].materialIndex, 0);
  });

  it("placing block above vertical-mode hinge converts it with door_side=up", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "vertical", "");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 1, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, true);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.doorSide, "up");
    assert.equal(assembly.panelPositions.length, 1);
    assert.equal(block.typeId, PANEL_BLOCK_ID);
  });

  it("placing block below vertical-mode hinge converts it with door_side=down", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 5, z: 0 }, "north", "vertical", "");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 4, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, true);

    const assembly = manager.findByPosition({ x: 0, y: 5, z: 0 });
    assert.equal(assembly.doorSide, "down");
  });

  it("placing block horizontally adjacent to vertical-mode hinge (doorSide=up) does NOT convert", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "vertical", "up");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, false);
    assert.equal(block.typeId, "minecraft:cobblestone");
  });

  it("first panel above hinge switches mode to vertical", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 1, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, true);
    assert.equal(block.typeId, PANEL_BLOCK_ID);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.mode, "vertical");
    assert.equal(assembly.doorSide, "up");
  });

  it("first panel beside hinge keeps mode horizontal", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, true);
    assert.equal(block.typeId, PANEL_BLOCK_ID);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.mode, "horizontal");
    assert.equal(assembly.doorSide, "east");
  });

  it("panel-adjacent expansion works vertically for vertical-mode assembly", () => {
    const dim = makeMockDimension();
    const assembly = setupHingeAssembly(
      dim, { x: 0, y: 0, z: 0 }, "north", "vertical", "up"
    );

    placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: 1, z: 0 });
    manager.addPanelToAssembly(assembly.id, { x: 0, y: 1, z: 0 }, 12);

    const newBlock = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 2, z: 0 });

    const result = handler.onPlace(newBlock, dim);
    assert.equal(result, true);
    assert.equal(newBlock.typeId, PANEL_BLOCK_ID);
    assert.equal(assembly.panelPositions.length, 2);
  });

  it("horizontal neighbor of vertical panel is NOT converted (mode gate)", () => {
    const dim = makeMockDimension();
    const assembly = setupHingeAssembly(
      dim, { x: 0, y: 0, z: 0 }, "north", "vertical", "up"
    );

    placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: 1, z: 0 });
    manager.addPanelToAssembly(assembly.id, { x: 0, y: 1, z: 0 }, 12);

    const newBlock = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 1, z: 0 });

    const result = handler.onPlace(newBlock, dim);
    assert.equal(result, false);
    assert.equal(newBlock.typeId, "minecraft:cobblestone");
  });

  it("wall-side exclusion works for vertical doors (door_side=up blocks down)", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 5, z: 0 }, "north", "vertical", "up");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 4, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, false);
  });

  it("horizontal-mode panel placement still works (no regression)", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, true);
    assert.equal(block.typeId, PANEL_BLOCK_ID);
  });

  it("placing block above horizontal-mode hinge with doorSide=east does NOT convert (mode gate)", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 1, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, false);
    assert.equal(block.typeId, "minecraft:cobblestone");
  });

  describe("coplanarity validation", () => {
    it("block behind east-door plane (Z+1) NOT converted via hinge neighbor", () => {
      const dim = makeMockDimension();
      setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 0, z: 1 });

      const result = handler.onPlace(block, dim);
      assert.equal(result, false);
      assert.equal(block.typeId, "minecraft:cobblestone");
    });

    it("block in front of east-door plane (Z-1) NOT converted via hinge neighbor", () => {
      const dim = makeMockDimension();
      setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 0, z: -1 });

      const result = handler.onPlace(block, dim);
      assert.equal(result, false);
      assert.equal(block.typeId, "minecraft:cobblestone");
    });

    it("block off-plane adjacent to panel at Y=2 NOT converted via panel neighbor", () => {
      const dim = makeMockDimension();
      const assembly = setupHingeAssembly(
        dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east"
      );
      manager.addHingeToAssembly(assembly.id, { x: 0, y: 1, z: 0 });
      manager.addHingeToAssembly(assembly.id, { x: 0, y: 2, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 1, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 2, z: 0 });

      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 2, z: 0 });
      manager.addPanelToAssembly(assembly.id, { x: 1, y: 2, z: 0 }, 12);

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 2, z: 1 });

      const result = handler.onPlace(block, dim);
      assert.equal(result, false);
      assert.equal(block.typeId, "minecraft:cobblestone");
    });

    it("north/south door off-plane (wrong X) NOT converted via panel neighbor", () => {
      const dim = makeMockDimension();
      const assembly = setupHingeAssembly(
        dim, { x: 0, y: 0, z: 0 }, "east", "horizontal", "south"
      );

      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: 0, z: 1 });
      manager.addPanelToAssembly(assembly.id, { x: 0, y: 0, z: 1 }, 12);

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 1 });

      const result = handler.onPlace(block, dim);
      assert.equal(result, false);
      assert.equal(block.typeId, "minecraft:cobblestone");
    });

    it("in-plane at Y+1 (second row) IS converted via panel neighbor", () => {
      const dim = makeMockDimension();
      const assembly = setupHingeAssembly(
        dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east"
      );
      manager.addHingeToAssembly(assembly.id, { x: 0, y: 1, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 1, z: 0 });

      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 });
      manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12);

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 1, z: 0 });

      const result = handler.onPlace(block, dim);
      assert.equal(result, true);
      assert.equal(block.typeId, PANEL_BLOCK_ID);
    });

    it("in-plane extending further from hinge IS converted via panel neighbor", () => {
      const dim = makeMockDimension();
      const assembly = setupHingeAssembly(
        dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east"
      );

      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 });
      manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12);
      placeBlock(dim, PANEL_BLOCK_ID, { x: 2, y: 0, z: 0 });
      manager.addPanelToAssembly(assembly.id, { x: 2, y: 0, z: 0 }, 12);

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 3, y: 0, z: 0 });

      const result = handler.onPlace(block, dim);
      assert.equal(result, true);
      assert.equal(block.typeId, PANEL_BLOCK_ID);
    });

    it("vertical door (north-facing): off-plane (wrong Z) NOT converted", () => {
      const dim = makeMockDimension();
      const assembly = setupHingeAssembly(
        dim, { x: 0, y: 0, z: 0 }, "north", "vertical", "up"
      );

      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: 1, z: 0 });
      manager.addPanelToAssembly(assembly.id, { x: 0, y: 1, z: 0 }, 12);

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 1, z: 1 });

      const result = handler.onPlace(block, dim);
      assert.equal(result, false);
      assert.equal(block.typeId, "minecraft:cobblestone");
    });

    it("vertical door (east-facing): off-plane (wrong X) NOT converted", () => {
      const dim = makeMockDimension();
      const assembly = setupHingeAssembly(
        dim, { x: 0, y: 0, z: 0 }, "east", "vertical", "down"
      );

      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: -1, z: 0 });
      manager.addPanelToAssembly(assembly.id, { x: 0, y: -1, z: 0 }, 12);

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: -1, z: 0 });

      const result = handler.onPlace(block, dim);
      assert.equal(result, false);
      assert.equal(block.typeId, "minecraft:cobblestone");
    });

    it("vertical door with merged hinge: panel below second hinge IS converted", () => {
      const dim = makeMockDimension();
      const assembly = setupHingeAssembly(
        dim, { x: 0, y: 5, z: 0 }, "north", "vertical", "down"
      );
      manager.addHingeToAssembly(assembly.id, { x: 1, y: 5, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 1, y: 5, z: 0 });

      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: 4, z: 0 });
      manager.addPanelToAssembly(assembly.id, { x: 0, y: 4, z: 0 }, 12);

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 4, z: 0 });

      const result = handler.onPlace(block, dim);
      assert.equal(result, true);
      assert.equal(block.typeId, PANEL_BLOCK_ID);
      assert.equal(assembly.panelPositions.length, 2);
    });
  });

  describe("overlay and hinge material matching", () => {
    it("panel placed next to strapped hinge gets overlay=1", () => {
      const dim = makeMockDimension();
      setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
      handler.onPlace(block, dim);

      const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
      assert.equal(assembly.panelPositions[0].overlay, 1);
    });

    it("panel placed next to hidden hinge gets overlay=0", () => {
      const dim = makeMockDimension();
      placeBlock(dim, HIDDEN_HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
        "bigdoors:facing": "north",
        "bigdoors:mode": "horizontal",
        "bigdoors:door_side": "east",
      });
      const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal", "hidden");
      manager.setDoorSide(assembly.id, "east");

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
      handler.onPlace(block, dim);

      assert.equal(assembly.panelPositions[0].overlay, 0);
    });

    it("first panel sets hinge material to match panel material", () => {
      const dim = makeMockDimension();
      setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
      assert.equal(assembly.hingePositions[0].materialIndex, UNMATCHED_MATERIAL_INDEX);

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
      handler.onPlace(block, dim);

      assert.notEqual(assembly.hingePositions[0].materialIndex, UNMATCHED_MATERIAL_INDEX);
    });

    it("second panel does not change hinge material", () => {
      const dim = makeMockDimension();
      setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      const block1 = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
      handler.onPlace(block1, dim);

      const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
      const firstMatIdx = assembly.hingePositions[0].materialIndex;

      const block2 = placeBlock(dim, "minecraft:cobblestone", { x: 2, y: 0, z: 0 });
      handler.onPlace(block2, dim);

      assert.equal(assembly.hingePositions[0].materialIndex, firstMatIdx);
    });

    it("all hinges in assembly get material set on first panel", () => {
      const dim = makeMockDimension();
      const assembly = setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");
      manager.addHingeToAssembly(assembly.id, { x: 0, y: 1, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 1, z: 0 });

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
      handler.onPlace(block, dim);

      assert.notEqual(assembly.hingePositions[0].materialIndex, UNMATCHED_MATERIAL_INDEX);
      assert.notEqual(assembly.hingePositions[1].materialIndex, UNMATCHED_MATERIAL_INDEX);
      assert.equal(assembly.hingePositions[0].materialIndex, assembly.hingePositions[1].materialIndex);
    });
  });

  describe("material matching", () => {
    it("mismatched material next to hinge with existing panels is rejected", () => {
      const dim = makeMockDimension();
      const assembly = setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      const block1 = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
      handler.onPlace(block1, dim);
      assert.equal(assembly.panelPositions.length, 1);

      const block2 = placeBlock(dim, "minecraft:oak_planks", { x: 2, y: 0, z: 0 });
      const result = handler.onPlace(block2, dim);
      assert.equal(result, false);
      assert.equal(block2.typeId, "minecraft:oak_planks");
      assert.equal(assembly.panelPositions.length, 1);
    });

    it("matching material next to existing panel is accepted", () => {
      const dim = makeMockDimension();
      const assembly = setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      const block1 = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
      handler.onPlace(block1, dim);

      const block2 = placeBlock(dim, "minecraft:cobblestone", { x: 2, y: 0, z: 0 });
      const result = handler.onPlace(block2, dim);
      assert.equal(result, true);
      assert.equal(block2.typeId, PANEL_BLOCK_ID);
      assert.equal(assembly.panelPositions.length, 2);
    });

    it("first panel of any supported material is accepted", () => {
      const dim = makeMockDimension();
      setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      const block = placeBlock(dim, "minecraft:birch_planks", { x: 1, y: 0, z: 0 });
      const result = handler.onPlace(block, dim);
      assert.equal(result, true);
      assert.equal(block.typeId, PANEL_BLOCK_ID);
    });

    it("mismatched material adjacent to panel neighbor is rejected", () => {
      const dim = makeMockDimension();
      const assembly = setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 });
      manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12);

      const block = placeBlock(dim, "minecraft:oak_planks", { x: 2, y: 0, z: 0 });
      const result = handler.onPlace(block, dim);
      assert.equal(result, false);
      assert.equal(block.typeId, "minecraft:oak_planks");
      assert.equal(assembly.panelPositions.length, 1);
    });
  });

  describe("boundary panel overlay suppression", () => {
    it("boundary panels get overlay=0 after double-door pairing", () => {
      const dim = makeMockDimension();
      const assemblyA = setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      placeBlock(dim, HINGE_BLOCK_ID, { x: 4, y: 0, z: 0 }, {
        "bigdoors:facing": "north",
        "bigdoors:mode": "horizontal",
        "bigdoors:door_side": "west",
      });
      const assemblyB = manager.createAssembly({ x: 4, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyB.id, "west");

      for (let x = 1; x <= 3; x++) {
        placeBlock(dim, PANEL_BLOCK_ID, { x, y: 0, z: 0 });
        manager.addPanelToAssembly(assemblyA.id, { x, y: 0, z: 0 }, 12, undefined, 1);
      }
      for (let x = 3; x >= 1; x--) {
        placeBlock(dim, PANEL_BLOCK_ID, { x, y: 0, z: 0 });
        manager.addPanelToAssembly(assemblyB.id, { x, y: 0, z: 0 }, 12, undefined, 1);
      }

      manager.pairAndSplitAssemblies(assemblyA.id, assemblyB.id);

      assert.ok(assemblyA.boundaryPanels.length > 0, "should have boundary panels");
      for (const bp of assemblyA.boundaryPanels) {
        assert.equal(bp.overlay, 0, "boundary panel overlay should be 0");
      }
    });
  });

  describe("slab placement", () => {
    it("bottom slab stores default geometry_id (GEOMETRY_CLASS_SLAB)", () => {
      const dim = makeMockDimension();
      setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      const block = placeBlock(dim, "minecraft:oak_slab", { x: 1, y: 0, z: 0 }, {
        "minecraft:vertical_half": "bottom",
      });

      const result = handler.onPlace(block, dim);
      assert.equal(result, true);
      assert.equal(block.typeId, PANEL_SLAB_BLOCK_ID);

      const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
      assert.equal(assembly.panelPositions[0].geometryId, GEOMETRY_CLASS_SLAB);
    });

    it("top slab stores GEOMETRY_ID_SLAB_TOP", () => {
      const dim = makeMockDimension();
      setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      const block = placeBlock(dim, "minecraft:oak_slab", { x: 1, y: 0, z: 0 }, {
        "minecraft:vertical_half": "top",
      });

      const result = handler.onPlace(block, dim);
      assert.equal(result, true);
      assert.equal(block.typeId, PANEL_SLAB_BLOCK_ID);

      const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
      assert.equal(assembly.panelPositions[0].geometryId, GEOMETRY_ID_SLAB_TOP);
    });

    it("non-slab material does not store geometryId", () => {
      const dim = makeMockDimension();
      setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "east");

      const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });

      handler.onPlace(block, dim);

      const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
      assert.equal(assembly.panelPositions[0].geometryId, undefined);
    });
  });
});
