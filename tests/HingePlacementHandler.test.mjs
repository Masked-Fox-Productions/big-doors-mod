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

  it("hinge ignores pre-placed blocks and creates assembly with no panels", () => {
    const dim = makeMockDimension();

    placeBlock(dim, "minecraft:cobblestone", { x: 1, y: 0, z: 0 });
    const hingeBlock = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
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
    const block = placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    const player = makeMockPlayer({ x: 0, y: 0, z: -1 });

    handler.onPlace(block, player, dim);

    const assembly = manager.findByPosition({ x: 0, y: 0, z: 0 });
    assert.ok(assembly);
    assert.equal(assembly.panelPositions.length, 0);
    assert.equal(assembly.doorSide, "");
  });
});
