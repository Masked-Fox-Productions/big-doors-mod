import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { DoorManager } from "../bigdoors_bp/scripts/DoorManager.js";
import { InteractionHandler } from "../bigdoors_bp/scripts/handler/InteractionHandler.js";
import { PanelPlacementHandler } from "../bigdoors_bp/scripts/handler/PanelPlacementHandler.js";
import { makeMockDimension, placeBlock } from "./helpers/mock-dimension.mjs";
import {
  PANEL_BLOCK_ID,
  HINGE_BLOCK_ID,
} from "../bigdoors_bp/scripts/util/Constants.js";

function posKey(pos) {
  return `${pos.x},${pos.y},${pos.z}`;
}

function fillAir(dim, minX, maxX, minZ, maxZ, y = 0) {
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      const key = posKey({ x, y, z });
      if (!dim._blocks.has(key)) {
        placeBlock(dim, "minecraft:air", { x, y, z });
      }
    }
  }
}

function setupDoubleDoor(manager) {
  const assemblyA = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
  manager.setDoorSide(assemblyA.id, "east");
  manager.addPanelToAssembly(assemblyA.id, { x: 1, y: 0, z: 0 }, 0);
  manager.addPanelToAssembly(assemblyA.id, { x: 2, y: 0, z: 0 }, 0);

  const assemblyB = manager.createAssembly({ x: 5, y: 0, z: 0 }, "north", "horizontal");
  manager.setDoorSide(assemblyB.id, "west");
  manager.addPanelToAssembly(assemblyB.id, { x: 3, y: 0, z: 0 }, 0);
  manager.addPanelToAssembly(assemblyB.id, { x: 4, y: 0, z: 0 }, 0);

  manager.pairAssemblies(assemblyA.id, assemblyB.id);

  return { assemblyA, assemblyB };
}

function buildDoubleDoorDimension(assemblyA, assemblyB) {
  const dim = makeMockDimension(new Map());
  placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
  placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, { "bigdoors:material": 0 });
  placeBlock(dim, PANEL_BLOCK_ID, { x: 2, y: 0, z: 0 }, { "bigdoors:material": 0 });
  placeBlock(dim, PANEL_BLOCK_ID, { x: 3, y: 0, z: 0 }, { "bigdoors:material": 0 });
  placeBlock(dim, PANEL_BLOCK_ID, { x: 4, y: 0, z: 0 }, { "bigdoors:material": 0 });
  placeBlock(dim, HINGE_BLOCK_ID, { x: 5, y: 0, z: 0 });
  fillAir(dim, -2, 7, -3, 3, 0);
  return dim;
}

describe("DoubleDoor", () => {
  let manager, handler, panelHandler;

  beforeEach(() => {
    __reset();
    manager = new DoorManager();
    handler = new InteractionHandler(manager);
    panelHandler = new PanelPlacementHandler(manager);
  });

  describe("detection via PanelPlacementHandler", () => {
    it("pairs two facing assemblies when panels connect them", () => {
      const assemblyA = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyA.id, "east");
      manager.addPanelToAssembly(assemblyA.id, { x: 1, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 2, y: 0, z: 0 }, 0);

      const assemblyB = manager.createAssembly({ x: 5, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyB.id, "west");
      manager.addPanelToAssembly(assemblyB.id, { x: 4, y: 0, z: 0 }, 0);

      const dim = makeMockDimension(new Map());
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 2, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 4, y: 0, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 5, y: 0, z: 0 });
      placeBlock(dim, "minecraft:oak_planks", { x: 3, y: 0, z: 0 });

      const block = dim.getBlock({ x: 3, y: 0, z: 0 });
      panelHandler._handleHingeNeighbor(
        block, { x: 3, y: 0, z: 0 }, 0,
        dim.getBlock({ x: 2, y: 0, z: 0 }), { x: 2, y: 0, z: 0 }, dim
      );

      // Actually let's use the higher-level approach: simulate the panel neighbor path
      // The _checkDoubleDoor is called after adding to assembly A
      // But assemblyA doesn't see hingeB because panel at x:3 is between them
      // Let's just directly trigger _checkDoubleDoor
      const updatedA = manager.getAssembly(assemblyA.id);
      const updatedB = manager.getAssembly(assemblyB.id);

      // At this point, the panel at x:3 was added to assemblyB (since hinge neighbor was panel at x:2
      // belonging to assemblyA). Actually let's simplify: use _checkDoubleDoor directly
      panelHandler._checkDoubleDoor(updatedA, dim);

      const finalA = manager.getAssembly(assemblyA.id);
      const finalB = manager.getAssembly(assemblyB.id);
      assert.equal(finalA.partnerAssemblyId, assemblyB.id);
      assert.equal(finalB.partnerAssemblyId, assemblyA.id);
    });

    it("splits panels evenly between two assemblies (4 panels, 2 each)", () => {
      const assemblyA = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyA.id, "east");
      manager.addPanelToAssembly(assemblyA.id, { x: 1, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 2, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 3, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 4, y: 0, z: 0 }, 0);

      const assemblyB = manager.createAssembly({ x: 5, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyB.id, "west");

      const dim = makeMockDimension(new Map());
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
      for (let x = 1; x <= 4; x++) {
        placeBlock(dim, PANEL_BLOCK_ID, { x, y: 0, z: 0 });
      }
      placeBlock(dim, HINGE_BLOCK_ID, { x: 5, y: 0, z: 0 });

      panelHandler._checkDoubleDoor(assemblyA, dim);

      const updatedA = manager.getAssembly(assemblyA.id);
      const updatedB = manager.getAssembly(assemblyB.id);

      assert.equal(updatedA.panelPositions.length, 2);
      assert.equal(updatedB.panelPositions.length, 2);
      assert.deepEqual(updatedA.panelPositions[0].closedPos, { x: 1, y: 0, z: 0 });
      assert.deepEqual(updatedA.panelPositions[1].closedPos, { x: 2, y: 0, z: 0 });
      assert.deepEqual(updatedB.panelPositions[0].closedPos, { x: 3, y: 0, z: 0 });
      assert.deepEqual(updatedB.panelPositions[1].closedPos, { x: 4, y: 0, z: 0 });
    });

    it("odd panel count - center panel belongs to neither assembly", () => {
      const assemblyA = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyA.id, "east");
      manager.addPanelToAssembly(assemblyA.id, { x: 1, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 2, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 3, y: 0, z: 0 }, 0);

      const assemblyB = manager.createAssembly({ x: 4, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyB.id, "west");

      const dim = makeMockDimension(new Map());
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
      for (let x = 1; x <= 3; x++) {
        placeBlock(dim, PANEL_BLOCK_ID, { x, y: 0, z: 0 });
      }
      placeBlock(dim, HINGE_BLOCK_ID, { x: 4, y: 0, z: 0 });

      panelHandler._checkDoubleDoor(assemblyA, dim);

      const updatedA = manager.getAssembly(assemblyA.id);
      const updatedB = manager.getAssembly(assemblyB.id);

      // Midpoint between 0 and 4 is 2. Panels at x:1 -> A, x:3 -> B, x:2 -> neither
      assert.equal(updatedA.panelPositions.length, 1);
      assert.equal(updatedB.panelPositions.length, 1);
      assert.deepEqual(updatedA.panelPositions[0].closedPos, { x: 1, y: 0, z: 0 });
      assert.deepEqual(updatedB.panelPositions[0].closedPos, { x: 3, y: 0, z: 0 });
    });
  });

  describe("symmetric opening", () => {
    it("clicking one half opens both halves symmetrically", () => {
      const { assemblyA, assemblyB } = setupDoubleDoor(manager);
      const dim = buildDoubleDoorDimension(assemblyA, assemblyB);
      const player = { location: { x: 2, y: 0, z: -2 } };

      const block = dim.getBlock({ x: 1, y: 0, z: 0 });
      handler.handleInteract(block, player, dim);

      const updatedA = manager.getAssembly(assemblyA.id);
      const updatedB = manager.getAssembly(assemblyB.id);

      assert.equal(updatedA.isOpen, true);
      assert.equal(updatedB.isOpen, true);

      // They should open in opposite directions
      assert.notEqual(updatedA.openDirection, updatedB.openDirection);
    });

    it("clicking the other half also opens both", () => {
      const { assemblyA, assemblyB } = setupDoubleDoor(manager);
      const dim = buildDoubleDoorDimension(assemblyA, assemblyB);
      const player = { location: { x: 3, y: 0, z: -2 } };

      const block = dim.getBlock({ x: 4, y: 0, z: 0 });
      handler.handleInteract(block, player, dim);

      const updatedA = manager.getAssembly(assemblyA.id);
      const updatedB = manager.getAssembly(assemblyB.id);

      assert.equal(updatedA.isOpen, true);
      assert.equal(updatedB.isOpen, true);
      assert.notEqual(updatedA.openDirection, updatedB.openDirection);
    });

    it("one side blocked opens only the unblocked side", () => {
      const { assemblyA, assemblyB } = setupDoubleDoor(manager);
      const dim = buildDoubleDoorDimension(assemblyA, assemblyB);

      // Block both CW and CCW destinations for assemblyB's panels
      // AssemblyB hinge at (5,0,0), panels at (3,0,0) and (4,0,0)
      // CW rotation around (5,0,0): (3,0,0) -> (5,0,-2), (4,0,0) -> (5,0,-1)
      // CCW rotation around (5,0,0): (3,0,0) -> (5,0,2), (4,0,0) -> (5,0,1)
      placeBlock(dim, "minecraft:stone", { x: 5, y: 0, z: -2 });
      placeBlock(dim, "minecraft:stone", { x: 5, y: 0, z: -1 });
      placeBlock(dim, "minecraft:stone", { x: 5, y: 0, z: 1 });
      placeBlock(dim, "minecraft:stone", { x: 5, y: 0, z: 2 });

      const player = { location: { x: 2, y: 0, z: -2 } };
      const block = dim.getBlock({ x: 1, y: 0, z: 0 });
      handler.handleInteract(block, player, dim);

      const updatedA = manager.getAssembly(assemblyA.id);
      const updatedB = manager.getAssembly(assemblyB.id);

      assert.equal(updatedA.isOpen, true);
      assert.equal(updatedB.isOpen, false);
    });

    it("closing a double door closes both halves", () => {
      const { assemblyA, assemblyB } = setupDoubleDoor(manager);
      const dim = buildDoubleDoorDimension(assemblyA, assemblyB);
      const player = { location: { x: 2, y: 0, z: -2 } };

      // Open both
      const block = dim.getBlock({ x: 1, y: 0, z: 0 });
      handler.handleInteract(block, player, dim);

      const openA = manager.getAssembly(assemblyA.id);
      assert.equal(openA.isOpen, true);

      // Close by clicking the moved panel
      const panelPos = openA.panelPositions[0].currentPos;
      const panelBlock = dim.getBlock(panelPos);
      handler.handleInteract(panelBlock, player, dim);

      const closedA = manager.getAssembly(assemblyA.id);
      const closedB = manager.getAssembly(assemblyB.id);
      assert.equal(closedA.isOpen, false);
      assert.equal(closedB.isOpen, false);
    });
  });

  describe("manager pairing", () => {
    it("pairAssemblies sets partnerAssemblyId on both", () => {
      const a = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      const b = manager.createAssembly({ x: 5, y: 0, z: 0 }, "north", "horizontal");

      manager.pairAssemblies(a.id, b.id);

      assert.equal(a.partnerAssemblyId, b.id);
      assert.equal(b.partnerAssemblyId, a.id);
    });

    it("unpairAssembly clears both sides", () => {
      const a = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      const b = manager.createAssembly({ x: 5, y: 0, z: 0 }, "north", "horizontal");

      manager.pairAssemblies(a.id, b.id);
      manager.unpairAssembly(a.id);

      assert.equal(a.partnerAssemblyId, null);
      assert.equal(b.partnerAssemblyId, null);
    });
  });

  describe("orphaned panel cleanup (revert callback)", () => {
    it("odd-column double door center panel reverted to vanilla via callback", () => {
      const assemblyA = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyA.id, "east");
      manager.addPanelToAssembly(assemblyA.id, { x: 1, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 2, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 3, y: 0, z: 0 }, 0);

      const assemblyB = manager.createAssembly({ x: 4, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyB.id, "west");

      const dim = makeMockDimension(new Map());
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 2, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 3, y: 0, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 4, y: 0, z: 0 });

      panelHandler._checkDoubleDoor(assemblyA, dim);

      const centerBlock = dim.getBlock({ x: 2, y: 0, z: 0 });
      assert.equal(centerBlock.typeId, "minecraft:oak_planks");
    });

    it("tall odd-column double door center column all reverted", () => {
      const assemblyA = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.addHingeToAssembly(assemblyA.id, { x: 0, y: 1, z: 0 });
      manager.setDoorSide(assemblyA.id, "east");

      for (let y = 0; y < 2; y++) {
        manager.addPanelToAssembly(assemblyA.id, { x: 1, y, z: 0 }, 0);
        manager.addPanelToAssembly(assemblyA.id, { x: 2, y, z: 0 }, 0);
        manager.addPanelToAssembly(assemblyA.id, { x: 3, y, z: 0 }, 0);
      }

      const assemblyB = manager.createAssembly({ x: 4, y: 0, z: 0 }, "north", "horizontal");
      manager.addHingeToAssembly(assemblyB.id, { x: 4, y: 1, z: 0 });
      manager.setDoorSide(assemblyB.id, "west");

      const dim = makeMockDimension(new Map());
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 1, z: 0 });
      for (let y = 0; y < 2; y++) {
        for (let x = 1; x <= 3; x++) {
          placeBlock(dim, PANEL_BLOCK_ID, { x, y, z: 0 });
        }
      }
      placeBlock(dim, HINGE_BLOCK_ID, { x: 4, y: 0, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 4, y: 1, z: 0 });

      panelHandler._checkDoubleDoor(assemblyA, dim);

      for (let y = 0; y < 2; y++) {
        const centerBlock = dim.getBlock({ x: 2, y, z: 0 });
        assert.equal(centerBlock.typeId, "minecraft:oak_planks",
          `center block at y=${y} should be reverted to vanilla`);
      }
    });

    it("even-column double door has no dropped panels", () => {
      const assemblyA = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyA.id, "east");
      manager.addPanelToAssembly(assemblyA.id, { x: 1, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 2, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 3, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 4, y: 0, z: 0 }, 0);

      const assemblyB = manager.createAssembly({ x: 5, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyB.id, "west");

      const dim = makeMockDimension(new Map());
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
      for (let x = 1; x <= 4; x++) {
        placeBlock(dim, PANEL_BLOCK_ID, { x, y: 0, z: 0 });
      }
      placeBlock(dim, HINGE_BLOCK_ID, { x: 5, y: 0, z: 0 });

      panelHandler._checkDoubleDoor(assemblyA, dim);

      const updatedA = manager.getAssembly(assemblyA.id);
      const updatedB = manager.getAssembly(assemblyB.id);

      assert.equal(updatedA.panelPositions.length, 2);
      assert.equal(updatedB.panelPositions.length, 2);

      for (let x = 1; x <= 4; x++) {
        const block = dim.getBlock({ x, y: 0, z: 0 });
        assert.equal(block.typeId, PANEL_BLOCK_ID,
          `panel at x=${x} should remain a door panel`);
      }
    });

    it("revert callback not provided (backward compat) does not throw", () => {
      const assemblyA = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyA.id, "east");
      manager.addPanelToAssembly(assemblyA.id, { x: 1, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 2, y: 0, z: 0 }, 0);
      manager.addPanelToAssembly(assemblyA.id, { x: 3, y: 0, z: 0 }, 0);

      const assemblyB = manager.createAssembly({ x: 4, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyB.id, "west");

      assert.doesNotThrow(() => {
        manager.pairAndSplitAssemblies(assemblyA.id, assemblyB.id);
      });

      const updatedA = manager.getAssembly(assemblyA.id);
      const updatedB = manager.getAssembly(assemblyB.id);
      assert.equal(updatedA.panelPositions.length, 1);
      assert.equal(updatedB.panelPositions.length, 1);
    });
  });

  describe("tall double-door", () => {
    it("3-tall double door with stacked hinges on both sides", () => {
      const assemblyA = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.addHingeToAssembly(assemblyA.id, { x: 0, y: 1, z: 0 });
      manager.addHingeToAssembly(assemblyA.id, { x: 0, y: 2, z: 0 });
      manager.setDoorSide(assemblyA.id, "east");

      for (let y = 0; y < 3; y++) {
        manager.addPanelToAssembly(assemblyA.id, { x: 1, y, z: 0 }, 0);
        manager.addPanelToAssembly(assemblyA.id, { x: 2, y, z: 0 }, 0);
      }

      const assemblyB = manager.createAssembly({ x: 5, y: 0, z: 0 }, "north", "horizontal");
      manager.addHingeToAssembly(assemblyB.id, { x: 5, y: 1, z: 0 });
      manager.addHingeToAssembly(assemblyB.id, { x: 5, y: 2, z: 0 });
      manager.setDoorSide(assemblyB.id, "west");

      for (let y = 0; y < 3; y++) {
        manager.addPanelToAssembly(assemblyB.id, { x: 3, y, z: 0 }, 0);
        manager.addPanelToAssembly(assemblyB.id, { x: 4, y, z: 0 }, 0);
      }

      const dim = makeMockDimension(new Map());
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 1, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 2, z: 0 });
      for (let y = 0; y < 3; y++) {
        for (let x = 1; x <= 4; x++) {
          placeBlock(dim, PANEL_BLOCK_ID, { x, y, z: 0 });
        }
      }
      placeBlock(dim, HINGE_BLOCK_ID, { x: 5, y: 0, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 5, y: 1, z: 0 });
      placeBlock(dim, HINGE_BLOCK_ID, { x: 5, y: 2, z: 0 });

      panelHandler._checkDoubleDoor(assemblyA, dim);

      const updatedA = manager.getAssembly(assemblyA.id);
      const updatedB = manager.getAssembly(assemblyB.id);

      assert.equal(updatedA.partnerAssemblyId, assemblyB.id);
      assert.equal(updatedB.partnerAssemblyId, assemblyA.id);

      // Panels split: A gets x:1,x:2; B gets x:3,x:4
      assert.equal(updatedA.panelPositions.length, 6); // 2 columns * 3 rows
      assert.equal(updatedB.panelPositions.length, 6);

      const aPanelXValues = updatedA.panelPositions.map((p) => p.closedPos.x);
      const bPanelXValues = updatedB.panelPositions.map((p) => p.closedPos.x);
      assert.ok(aPanelXValues.every((x) => x <= 2));
      assert.ok(bPanelXValues.every((x) => x >= 3));

      // Now open it - verify both sides open
      for (let y = 0; y < 3; y++) {
        fillAir(dim, -3, 8, -5, 5, y);
      }
      const player = { location: { x: 2, y: 0, z: -2 } };
      const block = dim.getBlock({ x: 1, y: 0, z: 0 });
      handler.handleInteract(block, player, dim);

      const finalA = manager.getAssembly(assemblyA.id);
      const finalB = manager.getAssembly(assemblyB.id);
      assert.equal(finalA.isOpen, true);
      assert.equal(finalB.isOpen, true);
      assert.notEqual(finalA.openDirection, finalB.openDirection);
    });
  });
});
