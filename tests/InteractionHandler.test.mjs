import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { DoorManager } from "../bigdoors_bp/scripts/DoorManager.js";
import { InteractionHandler } from "../bigdoors_bp/scripts/handler/InteractionHandler.js";
import { makeMockDimension, placeBlock } from "./helpers/mock-dimension.mjs";
import { PANEL_BLOCK_ID, HINGE_BLOCK_ID } from "../bigdoors_bp/scripts/util/Constants.js";

function posKey(pos) {
  return `${pos.x},${pos.y},${pos.z}`;
}

function setupDoor(manager) {
  const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
  manager.setDoorSide(assembly.id, "east");
  manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12);
  return assembly;
}

function buildDimension(assembly) {
  const dim = makeMockDimension(new Map());
  placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
  placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, { "bigdoors:material": 12 });
  // Fill air around — destinations and paths
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

describe("InteractionHandler", () => {
  let manager, handler;

  beforeEach(() => {
    __reset();
    manager = new DoorManager();
    handler = new InteractionHandler(manager);
  });

  it("opens a closed door - panels move to rotated positions", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension(assembly);
    const player = { location: { x: 1, y: 0, z: -2 } };
    const block = dim.getBlock({ x: 1, y: 0, z: 0 });

    handler.handleInteract(block, player, dim);

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    // Panel at (1,0,0) rotated CW around (0,0,0) -> (0,0,1)
    // or CCW -> (0,0,-1) depending on player position
    const panelPos = updated.panelPositions[0].currentPos;
    assert.ok(
      (panelPos.x === 0 && panelPos.z === 1) || (panelPos.x === 0 && panelPos.z === -1),
      `Panel should have rotated, got (${panelPos.x},${panelPos.z})`
    );
  });

  it("closes an open door - panels return to original positions", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension(assembly);
    const player = { location: { x: 1, y: 0, z: -2 } };
    const block = dim.getBlock({ x: 1, y: 0, z: 0 });

    // Open it first
    handler.handleInteract(block, player, dim);
    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);

    // Now close by interacting with the panel at its new position
    const newPos = updated.panelPositions[0].currentPos;
    const panelBlock = dim.getBlock(newPos);
    handler.handleInteract(panelBlock, player, dim);

    const closed = manager.getAssembly(assembly.id);
    assert.equal(closed.isOpen, false);
    assert.deepEqual(closed.panelPositions[0].currentPos, { x: 1, y: 0, z: 0 });
  });

  it("door opens away from the player side", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension(assembly);
    // Player is to the south (positive Z) of hinge
    const player = { location: { x: 0, y: 0, z: 2 } };
    const block = dim.getBlock({ x: 0, y: 0, z: 0 });

    handler.handleInteract(block, player, dim);

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    // Panel should move AWAY from player (to negative Z)
    const panelPos = updated.panelPositions[0].currentPos;
    assert.equal(panelPos.z, -1, "Panel should open away from player (negative Z)");
  });

  it("door opens opposite direction when preferred is blocked", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension(assembly);
    // Player south -> preferred opens to -Z (CCW). Block that path with stone.
    const player = { location: { x: 0, y: 0, z: 2 } };

    // Block the CCW destination (0,0,-1) with stone
    placeBlock(dim, "minecraft:stone", { x: 0, y: 0, z: -1 });

    const block = dim.getBlock({ x: 0, y: 0, z: 0 });
    handler.handleInteract(block, player, dim);

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    // Should open CW instead (to +Z)
    const panelPos = updated.panelPositions[0].currentPos;
    assert.equal(panelPos.z, 1, "Panel should open in fallback direction");
  });

  it("door does not move when both directions are blocked", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension(assembly);
    const player = { location: { x: 0, y: 0, z: 2 } };

    // Block both CW (0,0,1) and CCW (0,0,-1)
    placeBlock(dim, "minecraft:stone", { x: 0, y: 0, z: 1 });
    placeBlock(dim, "minecraft:stone", { x: 0, y: 0, z: -1 });

    const block = dim.getBlock({ x: 0, y: 0, z: 0 });
    handler.handleInteract(block, player, dim);

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, false);
  });

  it("soft blocks in the path are destroyed without drops", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension(assembly);
    const player = { location: { x: 0, y: 0, z: 2 } };

    // Place grass at CCW destination - but CCW is preferred for this player pos
    // Player south, panel at (1,0,0): CCW dest is (0,0,-1)
    placeBlock(dim, "minecraft:short_grass", { x: 0, y: 0, z: -1 });

    let spawnCalled = false;
    dim.spawnItem = () => { spawnCalled = true; };

    const block = dim.getBlock({ x: 0, y: 0, z: 0 });
    handler.handleInteract(block, player, dim);

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    assert.equal(spawnCalled, false, "Soft blocks should not spawn item drops");
    // The grass block should now be air (replaced by panel)
  });

  it("passable blocks in the path are destroyed with item drops", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension(assembly);
    const player = { location: { x: 0, y: 0, z: 2 } };

    placeBlock(dim, "minecraft:torch", { x: 0, y: 0, z: -1 });

    let spawnedItems = [];
    dim.spawnItem = (item, pos) => { spawnedItems.push({ item, pos }); };

    const block = dim.getBlock({ x: 0, y: 0, z: 0 });
    handler.handleInteract(block, player, dim);

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    assert.equal(spawnedItems.length, 1, "Passable block should spawn an item drop");
    assert.equal(spawnedItems[0].item.typeId, "minecraft:torch");
  });

  it("solid block prevents opening in that direction", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension(assembly);
    const player = { location: { x: 0, y: 0, z: -2 } };

    // Player north -> preferred opens to +Z (CW). Block CW destination.
    placeBlock(dim, "minecraft:stone", { x: 0, y: 0, z: 1 });

    const block = dim.getBlock({ x: 0, y: 0, z: 0 });
    handler.handleInteract(block, player, dim);

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    // Should have opened CCW instead
    assert.equal(updated.openDirection, "ccw");
  });

  it("aborts if destination is in an unloaded chunk (null block)", () => {
    const assembly = setupDoor(manager);
    const dim = makeMockDimension(new Map());
    placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
    placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, { "bigdoors:material": 12 });
    // Do NOT place blocks at destinations — getBlock returns null (unloaded)

    const player = { location: { x: 0, y: 0, z: 2 } };
    const block = dim.getBlock({ x: 0, y: 0, z: 0 });
    handler.handleInteract(block, player, dim);

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, false, "Door should not open when chunks are unloaded");
  });

  it("opening a door updates assembly isOpen state", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension(assembly);
    const player = { location: { x: 0, y: 0, z: 2 } };
    const block = dim.getBlock({ x: 0, y: 0, z: 0 });

    assert.equal(assembly.isOpen, false);
    handler.handleInteract(block, player, dim);

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    assert.ok(
      updated.openDirection === "cw" || updated.openDirection === "ccw",
      "openDirection should be set"
    );
  });

  it("does nothing when assembly has no panels", () => {
    manager.createAssembly({ x: 5, y: 0, z: 5 }, "north", "horizontal");
    const dim = makeMockDimension(new Map());
    placeBlock(dim, HINGE_BLOCK_ID, { x: 5, y: 0, z: 5 });
    const player = { location: { x: 5, y: 0, z: 3 } };
    const block = dim.getBlock({ x: 5, y: 0, z: 5 });

    handler.handleInteract(block, player, dim);
    // Should not throw, just return early
  });

  it("does nothing when block is not part of an assembly", () => {
    const dim = makeMockDimension(new Map());
    placeBlock(dim, "minecraft:stone", { x: 10, y: 0, z: 10 });
    const player = { location: { x: 10, y: 0, z: 8 } };
    const block = dim.getBlock({ x: 10, y: 0, z: 10 });

    handler.handleInteract(block, player, dim);
    // Should not throw
  });
});
