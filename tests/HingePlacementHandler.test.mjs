import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { DoorManager } from "../bigdoors_bp/scripts/DoorManager.js";
import { HingePlacementHandler } from "../bigdoors_bp/scripts/handler/HingePlacementHandler.js";
import {
  makeMockDimension,
  makeMockPlayer,
  placeBlock,
} from "./helpers/mock-dimension.mjs";
import { HINGE_BLOCK_ID, PANEL_BLOCK_ID } from "../bigdoors_bp/scripts/util/Constants.js";

describe("HingePlacementHandler", () => {
  let manager;
  let handler;

  beforeEach(() => {
    __reset();
    manager = new DoorManager();
    handler = new HingePlacementHandler(manager);
  });

  it("placing a hinge creates horizontal-mode assembly with correct facing", () => {
    const dim = makeMockDimension();
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "north", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none",
    });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.ok(assembly);
    assert.equal(assembly.facing, "north");
    assert.equal(assembly.mode, "horizontal");
  });

  it("facing is south when permutation says south", () => {
    const dim = makeMockDimension();
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "south", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none",
    });
    const player = makeMockPlayer({ x: 0, y: 0, z: 1 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.facing, "south");
  });

  it("facing is west when permutation says west", () => {
    const dim = makeMockDimension();
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "west", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none",
    });
    const player = makeMockPlayer({ x: -1, y: 0, z: 0 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.facing, "west");
  });

  it("facing is east when permutation says east", () => {
    const dim = makeMockDimension();
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "east", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none",
    });
    const player = makeMockPlayer({ x: 1, y: 0, z: 0 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.facing, "east");
  });

  it("placing hinge with face=Up creates vertical-mode assembly", () => {
    const dim = makeMockDimension();
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "north", "bigdoors:mode": "vertical", "bigdoors:door_side": "none",
    });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.ok(assembly);
    assert.equal(assembly.mode, "vertical");
    assert.equal(assembly.facing, "north");
  });

  it("placing hinge with face=Down creates vertical-mode assembly", () => {
    const dim = makeMockDimension();
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "east", "bigdoors:mode": "vertical", "bigdoors:door_side": "none",
    });
    const player = makeMockPlayer({ x: 1, y: 0, z: 0 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.ok(assembly);
    assert.equal(assembly.mode, "vertical");
    assert.equal(assembly.facing, "east");
  });

  it("second hinge above existing hinge merges into same assembly", () => {
    const dim = makeMockDimension();
    const hingeStates = { "bigdoors:facing": "north", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none" };

    const block1 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, hingeStates);
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });
    handler.onPlace(block1, player, dim);

    const block2 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 1, z: 0 }, hingeStates);
    handler.onPlace(block2, player, dim);

    const assembly1 = manager.findByPosition({ x: 0, y: 0, z: 0 });
    const assembly2 = manager.findByPosition({ x: 0, y: 1, z: 0 });
    assert.equal(assembly1, assembly2);
    assert.equal(assembly1.hingePositions.length, 2);
  });

  it("second hinge below existing hinge merges into same assembly", () => {
    const dim = makeMockDimension();
    const hingeStates = { "bigdoors:facing": "north", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none" };

    const block1 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 1, z: 0 }, hingeStates);
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });
    handler.onPlace(block1, player, dim);

    const block2 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, hingeStates);
    handler.onPlace(block2, player, dim);

    const assembly1 = manager.findByPosition({ x: 0, y: 1, z: 0 });
    const assembly2 = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly1, assembly2);
    assert.equal(assembly1.hingePositions.length, 2);
  });

  it("horizontal neighbor of vertical hinge merges into same assembly", () => {
    const dim = makeMockDimension();

    const block1 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "north", "bigdoors:mode": "vertical", "bigdoors:door_side": "none",
    });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });
    handler.onPlace(block1, player, dim);

    const block2 = placeBlock(dim, HINGE_BLOCK_ID, { x: 1, y: 0, z: 0 }, {
      "bigdoors:facing": "north", "bigdoors:mode": "vertical", "bigdoors:door_side": "none",
    });
    handler.onPlace(block2, player, dim);

    const assembly1 = manager.findByPosition({ x: 0, y: 0, z: 0 });
    const assembly2 = manager.findByPosition({ x: 1, y: 0, z: 0 });
    assert.equal(assembly1, assembly2);
    assert.equal(assembly1.hingePositions.length, 2);
    assert.equal(assembly1.mode, "vertical");
  });

  it("horizontal neighbor of horizontal hinge does NOT merge (only stacks vertically)", () => {
    const dim = makeMockDimension();

    const block1 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "north", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none",
    });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });
    handler.onPlace(block1, player, dim);

    const block2 = placeBlock(dim, HINGE_BLOCK_ID, { x: 1, y: 0, z: 0 }, {
      "bigdoors:facing": "north", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none",
    });
    handler.onPlace(block2, player, dim);

    const assembly1 = manager.findByPosition({ x: 0, y: 0, z: 0 });
    const assembly2 = manager.findByPosition({ x: 1, y: 0, z: 0 });
    assert.notEqual(assembly1, assembly2);
  });

  it("stacked hinge with different detected mode adopts assembly's mode after merge", () => {
    const dim = makeMockDimension();

    const block1 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "north", "bigdoors:mode": "vertical", "bigdoors:door_side": "none",
    });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });
    handler.onPlace(block1, player, dim);

    // Second hinge detected as horizontal but should adopt vertical from assembly
    const block2 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 1, z: 0 }, {
      "bigdoors:facing": "east", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none",
    });
    handler.onPlace(block2, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 1, z: 0 });
    assert.equal(assembly.mode, "vertical");
    // Block permutation should be rewritten to match assembly
    assert.equal(block2.permutation.getState("bigdoors:mode"), "vertical");
    assert.equal(block2.permutation.getState("bigdoors:facing"), "north");
  });

  it("double-door detection skips cross-mode candidates", () => {
    const dim = makeMockDimension();

    // Place a horizontal assembly with a panel
    const hinge1 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "north", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none",
    });
    handler.onPlace(hinge1, makeMockPlayer({ x: 0, y: 0, z: -1 }), dim);
    const asm1 = manager.findByPosition({ x: 0, y: 0, z: 0 });
    manager.setDoorSide(asm1.id, "east");
    manager.addPanelToAssembly(asm1.id, { x: 1, y: 0, z: 0 }, 0);
    placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 });

    // Place a vertical hinge adjacent — should NOT pair
    const hinge2 = placeBlock(dim, HINGE_BLOCK_ID, { x: 2, y: 0, z: 0 }, {
      "bigdoors:facing": "north", "bigdoors:mode": "vertical", "bigdoors:door_side": "none",
    });
    handler.onPlace(hinge2, makeMockPlayer({ x: 0, y: 0, z: -1 }), dim);

    const asm2 = manager.findByPosition({ x: 2, y: 0, z: 0 });
    assert.ok(!asm2.partnerAssemblyId);
    assert.ok(!asm1.partnerAssemblyId);
  });

  it("hinge ignores pre-placed blocks and creates assembly with no panels", () => {
    const dim = makeMockDimension();

    placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
    const hingeBlock = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "north", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none",
    });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(hingeBlock, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.ok(assembly);
    assert.equal(assembly.panelPositions.length, 0);
    assert.equal(assembly.doorSide, "");

    const cobble = dim.getBlock({ x: 1, y: 0, z: 0 });
    assert.equal(cobble.typeId, "minecraft:cobblestone");
  });

  it("hinge with no adjacent materials creates assembly with no panels", () => {
    const dim = makeMockDimension();
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 }, {
      "bigdoors:facing": "north", "bigdoors:mode": "horizontal", "bigdoors:door_side": "none",
    });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.ok(assembly);
    assert.equal(assembly.panelPositions.length, 0);
    assert.equal(assembly.doorSide, "");
  });
});
