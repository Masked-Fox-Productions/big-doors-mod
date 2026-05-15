import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { DoorManager } from "../bigdoors_bp/scripts/DoorManager.js";
import { BreakHandler } from "../bigdoors_bp/scripts/handler/BreakHandler.js";
import { HINGE_BLOCK_ID, PANEL_BLOCK_ID } from "../bigdoors_bp/scripts/util/Constants.js";
import { makeMockDimension, placeBlock } from "./helpers/mock-dimension.mjs";

function makePanelBreakEvent(location, materialIndex, dimension) {
  const group = Math.floor(materialIndex / 16);
  const id = materialIndex % 16;
  return {
    block: { location, dimension },
    brokenBlockPermutation: {
      type: { id: PANEL_BLOCK_ID },
      getState(name) {
        if (name === "bigdoors:material_group") return group;
        if (name === "bigdoors:material_id") return id;
        return undefined;
      },
      getAllStates() { return { "bigdoors:material_group": group, "bigdoors:material_id": id }; },
    },
    player: { name: "TestPlayer" },
  };
}

function makeHingeBreakEvent(location, dimension) {
  return {
    block: { location, dimension },
    brokenBlockPermutation: {
      type: { id: HINGE_BLOCK_ID },
      getState() { return undefined; },
      getAllStates() { return {}; },
    },
    player: { name: "TestPlayer" },
  };
}

describe("BreakHandler", () => {
  let manager;
  let handler;
  let dim;
  let spawnedItems;

  beforeEach(() => {
    __reset();
    manager = new DoorManager();
    manager._loaded = true;
    handler = new BreakHandler(manager);
    spawnedItems = [];
    dim = makeMockDimension(new Map());
    dim.spawnItem = (itemStack, pos) => {
      spawnedItems.push({ typeId: itemStack.typeId, amount: itemStack.amount, pos: { ...pos } });
    };
  });

  describe("handlePanelBreak", () => {
    it("removes panel from assembly and drops vanilla block", () => {
      const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12);
      manager.addPanelToAssembly(assembly.id, { x: 2, y: 0, z: 0 }, 0);

      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, { "bigdoors:material": 12 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 2, y: 0, z: 0 }, { "bigdoors:material": 0 });

      const event = makePanelBreakEvent({ x: 1, y: 0, z: 0 }, 12, dim);
      handler.handlePanelBreak(event);

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.panelPositions.length, 1);
      assert.deepEqual(updated.panelPositions[0].closedPos, { x: 2, y: 0, z: 0 });

      assert.equal(spawnedItems.length, 1);
      assert.equal(spawnedItems[0].typeId, "minecraft:cobblestone");
      assert.deepEqual(spawnedItems[0].pos, { x: 1, y: 0, z: 0 });
    });

    it("dissolves assembly when last panel is broken", () => {
      const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 0);

      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, { "bigdoors:material": 0 });

      const event = makePanelBreakEvent({ x: 1, y: 0, z: 0 }, 0, dim);
      handler.handlePanelBreak(event);

      assert.equal(manager.getAssembly(assembly.id), null);
      assert.equal(spawnedItems[0].typeId, "minecraft:oak_planks");
    });

    it("does nothing if panel position is not in any assembly", () => {
      const event = makePanelBreakEvent({ x: 99, y: 0, z: 99 }, 0, dim);
      handler.handlePanelBreak(event);

      assert.equal(spawnedItems.length, 0);
    });
  });

  describe("handleHingeBreak", () => {
    it("reverts closed-door panels to vanilla blocks and dissolves assembly", () => {
      const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 12);
      manager.addPanelToAssembly(assembly.id, { x: 2, y: 0, z: 0 }, 0);

      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, { "bigdoors:material": 12 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 2, y: 0, z: 0 }, { "bigdoors:material": 0 });

      const event = makeHingeBreakEvent({ x: 0, y: 0, z: 0 }, dim);
      handler.handleHingeBreak(event);

      assert.equal(manager.getAssembly(assembly.id), null);

      const block1 = dim.getBlock({ x: 1, y: 0, z: 0 });
      assert.equal(block1.typeId, "minecraft:cobblestone");
      const block2 = dim.getBlock({ x: 2, y: 0, z: 0 });
      assert.equal(block2.typeId, "minecraft:oak_planks");

      assert.equal(spawnedItems.length, 1);
      assert.equal(spawnedItems[0].typeId, HINGE_BLOCK_ID);
    });

    it("closes open door before dissolving assembly", () => {
      const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 11);

      // Simulate open state: panel moved from (1,0,0) to (0,0,-1)
      manager.openDoor(assembly.id, "cw", [{ x: 0, y: 0, z: -1 }]);

      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: 0, z: -1 }, { "bigdoors:material": 11 });
      placeBlock(dim, "minecraft:air", { x: 1, y: 0, z: 0 });

      const event = makeHingeBreakEvent({ x: 0, y: 0, z: 0 }, dim);
      handler.handleHingeBreak(event);

      // Open position should be cleared to air
      const openBlock = dim.getBlock({ x: 0, y: 0, z: -1 });
      assert.equal(openBlock.typeId, "minecraft:air");

      // Closed position should have vanilla block
      const closedBlock = dim.getBlock({ x: 1, y: 0, z: 0 });
      assert.equal(closedBlock.typeId, "minecraft:stone");

      assert.equal(manager.getAssembly(assembly.id), null);
    });

    it("does nothing if hinge position is not in any assembly", () => {
      const event = makeHingeBreakEvent({ x: 99, y: 99, z: 99 }, dim);
      handler.handleHingeBreak(event);

      assert.equal(spawnedItems.length, 0);
    });

    it("drops correct vanilla material for each panel", () => {
      const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.addPanelToAssembly(assembly.id, { x: 1, y: 0, z: 0 }, 14);

      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, { "bigdoors:material_group": 0, "bigdoors:material_id": 14 });

      const event = makeHingeBreakEvent({ x: 0, y: 0, z: 0 }, dim);
      handler.handleHingeBreak(event);

      const block = dim.getBlock({ x: 1, y: 0, z: 0 });
      assert.equal(block.typeId, "minecraft:bricks");
    });
  });
});
