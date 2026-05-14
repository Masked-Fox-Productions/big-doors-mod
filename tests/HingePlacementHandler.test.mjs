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
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.ok(assembly);
    assert.equal(assembly.facing, "north");
    assert.equal(assembly.mode, "horizontal");
  });

  it("facing is south when player looks toward positive Z", () => {
    const dim = makeMockDimension();
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: 1 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.facing, "south");
  });

  it("facing is west when player looks toward negative X", () => {
    const dim = makeMockDimension();
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: -1, y: 0, z: 0 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.facing, "west");
  });

  it("facing is east when player looks toward positive X", () => {
    const dim = makeMockDimension();
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 1, y: 0, z: 0 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.facing, "east");
  });

  it("second hinge above existing hinge merges into same assembly", () => {
    const dim = makeMockDimension();

    const block1 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });
    handler.onPlace(block1, player, dim);

    const block2 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 1, z: 0 });
    handler.onPlace(block2, player, dim);

    const assembly1 = manager.findByPosition({ x: 0, y: 0, z: 0 });
    const assembly2 = manager.findByPosition({ x: 0, y: 1, z: 0 });
    assert.equal(assembly1, assembly2);
    assert.equal(assembly1.hingePositions.length, 2);
  });

  it("second hinge below existing hinge merges into same assembly", () => {
    const dim = makeMockDimension();

    const block1 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 1, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });
    handler.onPlace(block1, player, dim);

    const block2 = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    handler.onPlace(block2, player, dim);

    const assembly1 = manager.findByPosition({ x: 0, y: 1, z: 0 });
    const assembly2 = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly1, assembly2);
    assert.equal(assembly1.hingePositions.length, 2);
  });

  it("hinge with one material side auto-sets door_side and converts blocks", () => {
    const dim = makeMockDimension();

    placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
    const hingeBlock = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(hingeBlock, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.doorSide, "east");
    assert.equal(assembly.panelPositions.length, 1);

    const convertedBlock = dim.getBlock({ x: 1, y: 0, z: 0 });
    assert.equal(convertedBlock.typeId, PANEL_BLOCK_ID);
  });

  it("hinge with material on multiple sides leaves door_side empty", () => {
    const dim = makeMockDimension();

    placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
    placeBlock(dim, "minecraft:cobblestone", { x: -1, y: 0, z: 0 });
    const hingeBlock = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(hingeBlock, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.doorSide, "");
    assert.equal(assembly.panelPositions.length, 0);
  });

  it("hinge next to 3-wide wall scans and converts all blocks", () => {
    const dim = makeMockDimension();

    placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
    placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: -1 });
    placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 1 });

    const hingeBlock = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(hingeBlock, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.panelPositions.length, 3);
  });

  it("hinge next to 3-wide 2-tall wall converts all 6 blocks", () => {
    const dim = makeMockDimension();

    for (let z = -1; z <= 1; z++) {
      for (let y = 0; y <= 1; y++) {
        placeBlock(dim, "minecraft:cobblestone", { x: 1, y, z });
      }
    }

    const hingeBlock = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(hingeBlock, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.panelPositions.length, 6);
  });

  it("scan stops at unsupported materials", () => {
    const dim = makeMockDimension();

    placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
    placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: -1 });
    placeBlock(dim, "minecraft:diamond_block", { x: 1, y: 0, z: -2 });
    placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 1 });

    const hingeBlock = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(hingeBlock, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.equal(assembly.panelPositions.length, 3);
  });

  it("scan stops at MAX_DOOR_SCAN_RADIUS", () => {
    const dim = makeMockDimension();

    for (let z = -20; z <= 20; z++) {
      placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z });
    }

    const hingeBlock = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(hingeBlock, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.ok(assembly.panelPositions.length <= 31);
    assert.ok(assembly.panelPositions.length > 0);
  });

  it("hinge with no adjacent materials creates assembly with no panels", () => {
    const dim = makeMockDimension();
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.ok(assembly);
    assert.equal(assembly.panelPositions.length, 0);
    assert.equal(assembly.doorSide, "");
  });
});
