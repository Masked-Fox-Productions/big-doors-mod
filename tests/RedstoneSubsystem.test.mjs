import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset, system } from "./stubs/minecraft-server.mjs";
import { DoorManager } from "../bigdoors_bp/scripts/DoorManager.js";
import { RedstoneSubsystem } from "../bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js";
import { makeMockDimension, placeBlock } from "./helpers/mock-dimension.mjs";
import { PANEL_BLOCK_ID, HINGE_BLOCK_ID, REDSTONE_DEBOUNCE_TICKS } from "../bigdoors_bp/scripts/util/Constants.js";

function posKey(pos) {
  return `${pos.x},${pos.y},${pos.z}`;
}

function setupDoor(manager) {
  const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
  manager.setDoorSide(assembly.id, "east");
  manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12);
  return assembly;
}

function buildDimension() {
  const dim = makeMockDimension(new Map());
  dim.spawnItem = () => {};
  dim.getEntities = () => [];
  placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
  placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, { "bigdoors:material": 12 });
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      const key = posKey({ x, y: 0, z });
      if (!dim._blocks.has(key)) {
        placeBlock(dim, "minecraft:air", { x, y: 0, z });
      }
    }
  }
  return dim;
}

describe("RedstoneSubsystem", () => {
  let manager, subsystem;

  beforeEach(() => {
    __reset();
    manager = new DoorManager();
    subsystem = new RedstoneSubsystem(manager);
  });

  it("opens a closed door when powered (CW default)", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    assert.equal(updated.openDirection, "cw");
    const panelPos = updated.panelPositions[0].currentPos;
    assert.deepEqual(panelPos, { x: 0, y: 0, z: 1 });
  });

  it("closes an open door when power removed", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    // Open it first
    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);

    // Place air at the open position so close can place there
    placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: 0, z: 1 });
    // Ensure closed position is available
    placeBlock(dim, "minecraft:air", { x: 1, y: 0, z: 0 });

    // Advance past open debounce so close event is accepted
    system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);

    // All blocks return 0 power (no redstone present)
    for (const [, b] of dim._blocks) {
      b.getRedstonePower = () => 0;
    }

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 0 });

    // Close is deferred — advance ticks to fire the scheduled check
    system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);

    const closed = manager.getAssembly(assembly.id);
    assert.equal(closed.isOpen, false);
    assert.deepEqual(closed.panelPositions[0].currentPos, { x: 1, y: 0, z: 0 });
  });

  it("does nothing if door is already open and powered", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
    const afterFirst = manager.getAssembly(assembly.id);
    const posAfterFirst = { ...afterFirst.panelPositions[0].currentPos };

    // Power again — should be no-op
    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 10 });
    const afterSecond = manager.getAssembly(assembly.id);
    assert.deepEqual(afterSecond.panelPositions[0].currentPos, posAfterFirst);
  });

  it("does nothing if door is already closed and unpowered", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 0 });

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, false);
    assert.deepEqual(updated.panelPositions[0].currentPos, { x: 1, y: 0, z: 0 });
  });

  it("does not open if path is obstructed in both directions", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    // Block both CW (0,0,1) and CCW (0,0,-1) destinations
    placeBlock(dim, "minecraft:stone", { x: 0, y: 0, z: 1 });
    placeBlock(dim, "minecraft:stone", { x: 0, y: 0, z: -1 });

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, false);
  });

  it("falls back to CCW if CW is obstructed", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    // Block CW destination (0,0,1)
    placeBlock(dim, "minecraft:stone", { x: 0, y: 0, z: 1 });

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    assert.equal(updated.openDirection, "ccw");
    assert.deepEqual(updated.panelPositions[0].currentPos, { x: 0, y: 0, z: -1 });
  });

  it("opens both halves of a double door", () => {
    const assemblyA = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    manager.setDoorSide(assemblyA.id, "east");
    manager.addPanelToAssembly(assemblyA.id, { x: 1, y: 0, z: 0 }, 12);

    const assemblyB = manager.createAssembly({ x: 3, y: 0, z: 0 }, "north", "horizontal");
    manager.setDoorSide(assemblyB.id, "west");
    manager.addPanelToAssembly(assemblyB.id, { x: 2, y: 0, z: 0 }, 12);

    manager.pairAssemblies(assemblyA.id, assemblyB.id);

    const dim = makeMockDimension(new Map());
    dim.spawnItem = () => {};
    dim.getEntities = () => [];
    for (let x = -2; x <= 5; x++) {
      for (let z = -2; z <= 2; z++) {
        placeBlock(dim, "minecraft:air", { x, y: 0, z });
      }
    }
    placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, { "bigdoors:material": 12 });
    placeBlock(dim, HINGE_BLOCK_ID, { x: 3, y: 0, z: 0 });
    placeBlock(dim, PANEL_BLOCK_ID, { x: 2, y: 0, z: 0 }, { "bigdoors:material": 12 });

    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });

    const a = manager.getAssembly(assemblyA.id);
    const b = manager.getAssembly(assemblyB.id);
    assert.equal(a.isOpen, true);
    assert.equal(b.isOpen, true);
    // A opens CW, partner B opens CCW (mirror)
    assert.equal(a.openDirection, "cw");
    assert.equal(b.openDirection, "ccw");
  });

  it("does nothing for a block with no assembly", () => {
    const dim = buildDimension();
    const block = { location: { x: 10, y: 10, z: 10 }, dimension: dim };

    // Should not throw
    subsystem.handleRedstoneUpdate({ block, powerLevel: 15 });
  });

  it("opens a vertical-mode door using vertical rotation", () => {
    const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "vertical");
    manager.setDoorSide(assembly.id, "up");
    manager.addPanelToAssembly(assembly.id, { x: 0, y: 1, z: 0 }, 12);

    const dim = makeMockDimension(new Map());
    dim.spawnItem = () => {};
    dim.getEntities = () => [];
    for (let x = -2; x <= 2; x++) {
      for (let y = -2; y <= 2; y++) {
        for (let z = -2; z <= 2; z++) {
          placeBlock(dim, "minecraft:air", { x, y, z });
        }
      }
    }
    placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: 1, z: 0 }, { "bigdoors:material": 12 });

    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    const panelPos = updated.panelPositions[0].currentPos;
    // Vertical north: panel at (0,1,0) rotates to either (0,0,1) CW or (0,0,-1) CCW
    assert.equal(panelPos.y, 0);
    assert.ok(panelPos.z === 1 || panelPos.z === -1);
  });

  it("horizontal doors still work after vertical mode addition (no regression)", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    assert.deepEqual(updated.panelPositions[0].currentPos, { x: 0, y: 0, z: 1 });
  });
});
