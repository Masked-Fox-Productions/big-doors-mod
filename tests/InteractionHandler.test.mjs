import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { DoorManager } from "../bigdoors_bp/scripts/DoorManager.js";
import { InteractionHandler } from "../bigdoors_bp/scripts/handler/InteractionHandler.js";
import { makeMockDimension, placeBlock } from "./helpers/mock-dimension.mjs";
import { PANEL_BLOCK_ID, HINGE_BLOCK_ID, WINCH_BLOCK_ID } from "../bigdoors_bp/scripts/util/Constants.js";

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

  describe("vertical mode", () => {
    function setupVerticalDoor(manager) {
      const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "vertical");
      manager.setDoorSide(assembly.id, "up");
      manager.addPanelToAssembly(assembly.id, { x: 0, y: 1, z: 0 }, 12);
      return assembly;
    }

    function buildVerticalDimension(assembly) {
      const dim = makeMockDimension(new Map());
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: 1, z: 0 }, { "bigdoors:material": 12 });
      for (let x = -2; x <= 2; x++) {
        for (let y = -2; y <= 2; y++) {
          for (let z = -2; z <= 2; z++) {
            const key = posKey({ x, y, z });
            if (!dim._blocks.has(key)) {
              placeBlock(dim, "minecraft:air", { x, y, z });
            }
          }
        }
      }
      return dim;
    }

    it("opens a vertical door using vertical rotation (panel moves in Y/Z plane)", () => {
      const assembly = setupVerticalDoor(manager);
      const dim = buildVerticalDimension(assembly);
      // Player to south — door should open away (toward -Z)
      const player = { location: { x: 0, y: 0, z: 2 } };
      const block = dim.getBlock({ x: 0, y: 1, z: 0 });

      handler.handleInteract(block, player, dim);

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, true);
      const panelPos = updated.panelPositions[0].currentPos;
      // Vertical north CW: panel at (0,1,0) -> dz=0,dy=1 -> newY=0-0=0, newZ=0+1=1 → (0,0,1)
      // Vertical north CCW: panel at (0,1,0) -> dz=0,dy=1 -> newY=0+0=0, newZ=0-1=-1 → (0,0,-1)
      assert.equal(panelPos.y, 0, "Panel Y should drop to hinge level");
      assert.ok(
        panelPos.z === 1 || panelPos.z === -1,
        `Panel should rotate toward/away from player, got z=${panelPos.z}`
      );
    });

    it("closes a vertical door - panels return to original positions", () => {
      const assembly = setupVerticalDoor(manager);
      const dim = buildVerticalDimension(assembly);
      const player = { location: { x: 0, y: 0, z: 2 } };
      const block = dim.getBlock({ x: 0, y: 1, z: 0 });

      handler.handleInteract(block, player, dim);
      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, true);

      const newPos = updated.panelPositions[0].currentPos;
      const panelBlock = dim.getBlock(newPos);
      handler.handleInteract(panelBlock, player, dim);

      const closed = manager.getAssembly(assembly.id);
      assert.equal(closed.isOpen, false);
      assert.deepEqual(closed.panelPositions[0].currentPos, { x: 0, y: 1, z: 0 });
    });

    it("vertical door blocked in one direction falls back to opposite", () => {
      const assembly = setupVerticalDoor(manager);
      const dim = buildVerticalDimension(assembly);
      const player = { location: { x: 0, y: 0, z: 2 } };

      // Block CW destination (0,0,1) for north-facing vertical
      placeBlock(dim, "minecraft:stone", { x: 0, y: 0, z: 1 });

      const block = dim.getBlock({ x: 0, y: 0, z: 0 });
      handler.handleInteract(block, player, dim);

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, true);
    });

    it("vertical door blocked in both directions does not move", () => {
      const assembly = setupVerticalDoor(manager);
      const dim = buildVerticalDimension(assembly);
      const player = { location: { x: 0, y: 0, z: 2 } };

      // Block both CW (0,0,1) and CCW (0,0,-1) for north-facing vertical
      placeBlock(dim, "minecraft:stone", { x: 0, y: 0, z: 1 });
      placeBlock(dim, "minecraft:stone", { x: 0, y: 0, z: -1 });

      const block = dim.getBlock({ x: 0, y: 0, z: 0 });
      handler.handleInteract(block, player, dim);

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, false);
    });
  });

  it("manual close clears redstoneSource", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension(assembly);
    const player = { location: { x: 0, y: 0, z: -2 } };
    const block = dim.getBlock({ x: 0, y: 0, z: 0 });

    // Open the door
    handler.handleInteract(block, player, dim);
    const opened = manager.getAssembly(assembly.id);
    assert.equal(opened.isOpen, true);

    // Simulate a redstone source being tracked
    manager.setRedstoneSource(assembly.id, { x: -1, y: 0, z: 0 });
    assert.deepEqual(manager.getAssembly(assembly.id).redstoneSource, { x: -1, y: 0, z: 0 });

    // Close via interaction
    const panelBlock = dim.getBlock(opened.panelPositions[0].currentPos);
    handler.handleInteract(panelBlock, player, dim);

    const closed = manager.getAssembly(assembly.id);
    assert.equal(closed.isOpen, false);
    assert.equal(closed.redstoneSource, null);
  });

  describe("close obstruction check", () => {
    it("door stays open when solid block occupies closed position", () => {
      const assembly = setupDoor(manager);
      const dim = buildDimension(assembly);
      const player = { location: { x: 0, y: 0, z: -2 } };
      const block = dim.getBlock({ x: 0, y: 0, z: 0 });

      // Open the door
      handler.handleInteract(block, player, dim);
      const opened = manager.getAssembly(assembly.id);
      assert.equal(opened.isOpen, true);

      // Place solid block at closed position (1,0,0)
      placeBlock(dim, "minecraft:stone", { x: 1, y: 0, z: 0 });

      // Try to close
      const panelBlock = dim.getBlock(opened.panelPositions[0].currentPos);
      handler.handleInteract(panelBlock, player, dim);

      const result = manager.getAssembly(assembly.id);
      assert.equal(result.isOpen, true, "Door should stay open when closed position is solidly obstructed");
    });

    it("door closes normally when closed position has soft block", () => {
      const assembly = setupDoor(manager);
      const dim = buildDimension(assembly);
      const player = { location: { x: 0, y: 0, z: -2 } };
      const block = dim.getBlock({ x: 0, y: 0, z: 0 });

      handler.handleInteract(block, player, dim);
      const opened = manager.getAssembly(assembly.id);
      assert.equal(opened.isOpen, true);

      // Place soft block at closed position
      placeBlock(dim, "minecraft:short_grass", { x: 1, y: 0, z: 0 });

      const panelBlock = dim.getBlock(opened.panelPositions[0].currentPos);
      handler.handleInteract(panelBlock, player, dim);

      const result = manager.getAssembly(assembly.id);
      assert.equal(result.isOpen, false, "Soft blocks should not prevent closing");
    });

    it("passable blocks drop items when door closes over them", () => {
      const assembly = setupDoor(manager);
      const dim = buildDimension(assembly);
      dim.spawnItem = dim.spawnItem || (() => {});
      const player = { location: { x: 0, y: 0, z: -2 } };
      const block = dim.getBlock({ x: 0, y: 0, z: 0 });

      handler.handleInteract(block, player, dim);
      const opened = manager.getAssembly(assembly.id);

      // Place passable block at closed position
      placeBlock(dim, "minecraft:torch", { x: 1, y: 0, z: 0 });

      let spawnedItems = [];
      dim.spawnItem = (item, pos) => { spawnedItems.push({ item, pos }); };

      const panelBlock = dim.getBlock(opened.panelPositions[0].currentPos);
      handler.handleInteract(panelBlock, player, dim);

      const result = manager.getAssembly(assembly.id);
      assert.equal(result.isOpen, false);
      assert.equal(spawnedItems.length, 1);
      assert.equal(spawnedItems[0].item.typeId, "minecraft:torch");
    });

    it("solid block prevents close — no soft blocks destroyed (solid wins)", () => {
      const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assembly.id, "east");
      manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12);
      manager.addPanelToAssembly(assembly.id, { x: 2, y: 0, z: 0 }, 12);

      const dim = makeMockDimension(new Map());
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, { "bigdoors:material": 12 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 2, y: 0, z: 0 }, { "bigdoors:material": 12 });
      for (let x = -2; x <= 3; x++) {
        for (let z = -2; z <= 2; z++) {
          const key = posKey({ x, y: 0, z });
          if (!dim._blocks.has(key)) placeBlock(dim, "minecraft:air", { x, y: 0, z });
        }
      }

      const player = { location: { x: 0, y: 0, z: -2 } };
      const block = dim.getBlock({ x: 0, y: 0, z: 0 });
      handler.handleInteract(block, player, dim);

      const opened = manager.getAssembly(assembly.id);
      assert.equal(opened.isOpen, true);

      // Place soft at closedPos(1,0,0) and solid at closedPos(2,0,0)
      placeBlock(dim, "minecraft:short_grass", { x: 1, y: 0, z: 0 });
      placeBlock(dim, "minecraft:stone", { x: 2, y: 0, z: 0 });

      const panelBlock = dim.getBlock(opened.panelPositions[0].currentPos);
      handler.handleInteract(panelBlock, player, dim);

      const result = manager.getAssembly(assembly.id);
      assert.equal(result.isOpen, true, "Solid obstruction prevents close");
      // Soft block should NOT have been destroyed
      const grassBlock = dim.getBlock({ x: 1, y: 0, z: 0 });
      assert.equal(grassBlock.typeId, "minecraft:short_grass", "Soft block preserved when solid prevents close");
    });

    it("close aborts when closed position is unloaded (null)", () => {
      const assembly = setupDoor(manager);
      const dim = buildDimension(assembly);
      const player = { location: { x: 0, y: 0, z: -2 } };
      const block = dim.getBlock({ x: 0, y: 0, z: 0 });

      handler.handleInteract(block, player, dim);
      const opened = manager.getAssembly(assembly.id);
      assert.equal(opened.isOpen, true);

      // Remove the closed position block to simulate unloaded chunk
      dim._blocks.delete(posKey({ x: 1, y: 0, z: 0 }));

      const panelBlock = dim.getBlock(opened.panelPositions[0].currentPos);
      handler.handleInteract(panelBlock, player, dim);

      const result = manager.getAssembly(assembly.id);
      assert.equal(result.isOpen, true, "Door should stay open when closed position is unloaded");
    });

    it("redstone source NOT cleared when close is blocked", () => {
      const assembly = setupDoor(manager);
      const dim = buildDimension(assembly);
      const player = { location: { x: 0, y: 0, z: -2 } };
      const block = dim.getBlock({ x: 0, y: 0, z: 0 });

      handler.handleInteract(block, player, dim);
      const opened = manager.getAssembly(assembly.id);

      // Set a redstone source
      manager.setRedstoneSource(assembly.id, { x: -1, y: 0, z: 0 });

      // Place solid block at closed position
      placeBlock(dim, "minecraft:stone", { x: 1, y: 0, z: 0 });

      const panelBlock = dim.getBlock(opened.panelPositions[0].currentPos);
      handler.handleInteract(panelBlock, player, dim);

      const result = manager.getAssembly(assembly.id);
      assert.equal(result.isOpen, true);
      assert.deepEqual(result.redstoneSource, { x: -1, y: 0, z: 0 }, "Redstone source should be preserved when close is blocked");
    });
  });

  it("preserves overlay=1 on panels when opening a strapped door", () => {
    const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
    manager.setDoorSide(assembly.id, "east");
    manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12, undefined, 1);

    const dim = buildDimension(assembly);
    const player = { location: { x: 1, y: 0, z: -2 } };
    const block = dim.getBlock({ x: 1, y: 0, z: 0 });

    handler.handleInteract(block, player, dim);

    const opened = manager.getAssembly(assembly.id);
    assert.equal(opened.isOpen, true);
    const destPos = opened.panelPositions[0].currentPos;
    const destBlock = dim.getBlock(destPos);
    assert.equal(destBlock.permutation.getState("bigdoors:overlay"), 1);
  });

  it("preserves overlay=0 on panels when opening a hidden-hinge door", () => {
    const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal", "hidden");
    manager.setDoorSide(assembly.id, "east");
    manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12, undefined, 0);

    const dim = buildDimension(assembly);
    const player = { location: { x: 1, y: 0, z: -2 } };
    const block = dim.getBlock({ x: 1, y: 0, z: 0 });

    handler.handleInteract(block, player, dim);

    const opened = manager.getAssembly(assembly.id);
    assert.equal(opened.isOpen, true);
    const destPos = opened.panelPositions[0].currentPos;
    const destBlock = dim.getBlock(destPos);
    assert.equal(destBlock.permutation.getState("bigdoors:overlay"), 0);
  });

  describe("winch mode", () => {
    function setupWinchDoor(manager, hingeType = "winch") {
      const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "vertical", hingeType);
      manager.setDoorSide(assembly.id, "down");
      manager.addPanelToAssembly(assembly.id, { x: 0, y: -1, z: 0 }, 12);
      return assembly;
    }

    function buildWinchDimension(assembly) {
      const dim = makeMockDimension(new Map());
      placeBlock(dim, WINCH_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: -1, z: 0 }, { "bigdoors:material": 12 });
      for (let x = -1; x <= 1; x++) {
        for (let y = -3; y <= 3; y++) {
          for (let z = -1; z <= 1; z++) {
            const key = posKey({ x, y, z });
            if (!dim._blocks.has(key)) {
              placeBlock(dim, "minecraft:air", { x, y, z });
            }
          }
        }
      }
      return dim;
    }

    it("winch assembly opens with linear shift — panel mirrors through winch", () => {
      const assembly = setupWinchDoor(manager);
      const dim = buildWinchDimension(assembly);
      const player = { location: { x: 0, y: -1, z: -2 } };
      const block = dim.getBlock({ x: 0, y: -1, z: 0 });

      handler.handleInteract(block, player, dim);

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, true);
      const panelPos = updated.panelPositions[0].currentPos;
      assert.equal(panelPos.y, 1, "Panel at y=-1 should mirror through winch y=0 to y=1");
      assert.equal(panelPos.x, 0, "X should be preserved");
      assert.equal(panelPos.z, 0, "Z should be preserved");
    });

    it("winch assembly closes back to closedPos", () => {
      const assembly = setupWinchDoor(manager);
      const dim = buildWinchDimension(assembly);
      const player = { location: { x: 0, y: -1, z: -2 } };
      const block = dim.getBlock({ x: 0, y: -1, z: 0 });

      handler.handleInteract(block, player, dim);
      const opened = manager.getAssembly(assembly.id);
      assert.equal(opened.isOpen, true);

      const newPos = opened.panelPositions[0].currentPos;
      const panelBlock = dim.getBlock(newPos);
      handler.handleInteract(panelBlock, player, dim);

      const closed = manager.getAssembly(assembly.id);
      assert.equal(closed.isOpen, false);
      assert.deepEqual(closed.panelPositions[0].currentPos, { x: 0, y: -1, z: 0 });
    });

    it("winch open uses canonical 'cw' direction", () => {
      const assembly = setupWinchDoor(manager);
      const dim = buildWinchDimension(assembly);
      const player = { location: { x: 0, y: -1, z: -2 } };
      const block = dim.getBlock({ x: 0, y: -1, z: 0 });

      handler.handleInteract(block, player, dim);

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.openDirection, "cw");
    });

    it("winch open is blocked when destination has solid block", () => {
      const assembly = setupWinchDoor(manager);
      const dim = buildWinchDimension(assembly);
      placeBlock(dim, "minecraft:stone", { x: 0, y: 1, z: 0 });
      const player = { location: { x: 0, y: -1, z: -2 } };
      const block = dim.getBlock({ x: 0, y: -1, z: 0 });

      handler.handleInteract(block, player, dim);

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, false, "Winch should not open when destination is blocked");
    });

    it("winch open destroys soft blocks at destination without drops", () => {
      const assembly = setupWinchDoor(manager);
      const dim = buildWinchDimension(assembly);
      placeBlock(dim, "minecraft:short_grass", { x: 0, y: 1, z: 0 });
      let spawnCalled = false;
      dim.spawnItem = () => { spawnCalled = true; };

      const player = { location: { x: 0, y: -1, z: -2 } };
      const block = dim.getBlock({ x: 0, y: -1, z: 0 });

      handler.handleInteract(block, player, dim);

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, true);
      assert.equal(spawnCalled, false, "Soft blocks should not spawn drops");
    });

    it("winch open destroys passable blocks at destination with drops", () => {
      const assembly = setupWinchDoor(manager);
      const dim = buildWinchDimension(assembly);
      placeBlock(dim, "minecraft:torch", { x: 0, y: 1, z: 0 });
      let spawnedItems = [];
      dim.spawnItem = (item, pos) => { spawnedItems.push({ item, pos }); };

      const player = { location: { x: 0, y: -1, z: -2 } };
      const block = dim.getBlock({ x: 0, y: -1, z: 0 });

      handler.handleInteract(block, player, dim);

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, true);
      assert.equal(spawnedItems.length, 1);
      assert.equal(spawnedItems[0].item.typeId, "minecraft:torch");
    });

    it("winch aborts when destination is in unloaded chunk", () => {
      const assembly = setupWinchDoor(manager);
      const dim = makeMockDimension(new Map());
      placeBlock(dim, WINCH_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: -1, z: 0 });

      const player = { location: { x: 0, y: -1, z: -2 } };
      const block = dim.getBlock({ x: 0, y: -1, z: 0 });

      handler.handleInteract(block, player, dim);

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, false, "Winch should not open when destination chunk is unloaded");
    });

    it("multi-panel winch portcullis mirrors all panels", () => {
      const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "vertical", "winch");
      manager.setDoorSide(assembly.id, "down");
      manager.addPanelToAssembly(assembly.id, { x: 0, y: -1, z: 0 }, 12);
      manager.addPanelToAssembly(assembly.id, { x: 0, y: -2, z: 0 }, 12);

      const dim = makeMockDimension(new Map());
      placeBlock(dim, WINCH_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: -1, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: -2, z: 0 });
      for (let y = -4; y <= 4; y++) {
        const key = posKey({ x: 0, y, z: 0 });
        if (!dim._blocks.has(key)) {
          placeBlock(dim, "minecraft:air", { x: 0, y, z: 0 });
        }
      }

      const player = { location: { x: 0, y: -1, z: -2 } };
      const block = dim.getBlock({ x: 0, y: -1, z: 0 });
      handler.handleInteract(block, player, dim);

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, true);
      const positions = updated.panelPositions.map(p => p.currentPos);
      assert.deepEqual(positions[0], { x: 0, y: 1, z: 0 });
      assert.deepEqual(positions[1], { x: 0, y: 2, z: 0 });
    });

    it("winch partner opens with mirror shift when primary opens", () => {
      const primary = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "vertical", "winch");
      manager.setDoorSide(primary.id, "down");
      manager.addPanelToAssembly(primary.id, { x: 0, y: -1, z: 0 }, 12);

      const partner = manager.createAssembly({ x: 1, y: 0, z: 0 }, "north", "vertical", "winch");
      manager.setDoorSide(partner.id, "down");
      manager.addPanelToAssembly(partner.id, { x: 1, y: -1, z: 0 }, 12);
      manager.pairAssemblies(primary.id, partner.id);

      const dim = makeMockDimension(new Map());
      placeBlock(dim, WINCH_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: -1, z: 0 });
      placeBlock(dim, WINCH_BLOCK_ID, { x: 1, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: -1, z: 0 });
      for (let x = 0; x <= 1; x++) {
        for (let y = -3; y <= 3; y++) {
          const key = posKey({ x, y, z: 0 });
          if (!dim._blocks.has(key)) {
            placeBlock(dim, "minecraft:air", { x, y, z: 0 });
          }
        }
      }

      const player = { location: { x: 0, y: -1, z: -2 } };
      const block = dim.getBlock({ x: 0, y: -1, z: 0 });
      handler.handleInteract(block, player, dim);

      const updatedPrimary = manager.getAssembly(primary.id);
      const updatedPartner = manager.getAssembly(partner.id);
      assert.equal(updatedPrimary.isOpen, true);
      assert.equal(updatedPartner.isOpen, true);
      assert.deepEqual(updatedPartner.panelPositions[0].currentPos, { x: 1, y: 1, z: 0 });
    });

    it("winch partner closes when primary closes", () => {
      const primary = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "vertical", "winch");
      manager.setDoorSide(primary.id, "down");
      manager.addPanelToAssembly(primary.id, { x: 0, y: -1, z: 0 }, 12);

      const partner = manager.createAssembly({ x: 1, y: 0, z: 0 }, "north", "vertical", "winch");
      manager.setDoorSide(partner.id, "down");
      manager.addPanelToAssembly(partner.id, { x: 1, y: -1, z: 0 }, 12);
      manager.pairAssemblies(primary.id, partner.id);

      const dim = makeMockDimension(new Map());
      placeBlock(dim, WINCH_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: -1, z: 0 });
      placeBlock(dim, WINCH_BLOCK_ID, { x: 1, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: -1, z: 0 });
      for (let x = 0; x <= 1; x++) {
        for (let y = -3; y <= 3; y++) {
          const key = posKey({ x, y, z: 0 });
          if (!dim._blocks.has(key)) {
            placeBlock(dim, "minecraft:air", { x, y, z: 0 });
          }
        }
      }

      const player = { location: { x: 0, y: -1, z: -2 } };
      const block = dim.getBlock({ x: 0, y: -1, z: 0 });
      handler.handleInteract(block, player, dim);

      const opened = manager.getAssembly(primary.id);
      const panelBlock = dim.getBlock(opened.panelPositions[0].currentPos);
      handler.handleInteract(panelBlock, player, dim);

      assert.equal(manager.getAssembly(primary.id).isOpen, false);
      assert.equal(manager.getAssembly(partner.id).isOpen, false);
    });
  });
});
