import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { DoorManager } from "../bigdoors_bp/scripts/DoorManager.js";
import { PanelPlacementHandler } from "../bigdoors_bp/scripts/handler/PanelPlacementHandler.js";
import {
  makeMockDimension,
  placeBlock,
} from "./helpers/mock-dimension.mjs";
import { HINGE_BLOCK_ID, PANEL_BLOCK_ID } from "../bigdoors_bp/scripts/util/Constants.js";

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

    const block = placeBlock(dim, "minecraft:diamond_block", { x: 1, y: 0, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, false);
    assert.equal(block.typeId, "minecraft:diamond_block");
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

    const newBlock = placeBlock(dim, "minecraft:diamond_block", { x: 2, y: 0, z: 0 });

    const result = handler.onPlace(newBlock, dim);
    assert.equal(result, false);
    assert.equal(newBlock.typeId, "minecraft:diamond_block");
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

  it("placing block horizontally adjacent to vertical-mode hinge does NOT convert", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "vertical", "");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, false);
    assert.equal(block.typeId, "minecraft:cobblestone");
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

  it("placing block above horizontal-mode hinge does NOT convert (mode gate)", () => {
    const dim = makeMockDimension();
    setupHingeAssembly(dim, { x: 0, y: 0, z: 0 }, "north", "horizontal", "");

    const block = placeBlock(dim, "minecraft:cobblestone", { x: 0, y: 1, z: 0 });

    const result = handler.onPlace(block, dim);
    assert.equal(result, false);
    assert.equal(block.typeId, "minecraft:cobblestone");
  });
});
