import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset, system } from "./stubs/minecraft-server.mjs";
import { DoorManager } from "../bigdoors_bp/scripts/DoorManager.js";
import { RedstoneSubsystem } from "../bigdoors_bp/scripts/subsystem/RedstoneSubsystem.js";
import { makeMockDimension, placeBlock } from "./helpers/mock-dimension.mjs";
import { PANEL_BLOCK_ID, HINGE_BLOCK_ID, WINCH_BLOCK_ID, REDSTONE_DEBOUNCE_TICKS, REDSTONE_SOURCE_POLL_TICKS } from "../bigdoors_bp/scripts/util/Constants.js";

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

  it("closes an open door when tracked source depowers", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    // Place a powered source neighbor (pressure plate south of hinge)
    const sourceBlock = placeBlock(dim, "minecraft:wooden_pressure_plate", { x: 0, y: 0, z: 1 });
    sourceBlock.getRedstonePower = () => 15;

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    assert.deepEqual(updated.redstoneSource, { x: 0, y: 0, z: 1 });

    // Ensure closed position is available for close
    placeBlock(dim, "minecraft:air", { x: 1, y: 0, z: 0 });

    // Advance past debounce
    system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);

    // Source depowers
    sourceBlock.getRedstonePower = () => 0;

    // Advance ticks to trigger the source monitor poll
    system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);

    const closed = manager.getAssembly(assembly.id);
    assert.equal(closed.isOpen, false);
    assert.deepEqual(closed.panelPositions[0].currentPos, { x: 1, y: 0, z: 0 });
    assert.equal(closed.redstoneSource, null);
  });

  it("door stays open while source remains powered even when panels lose contact", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    // Powered source east of hinge at (1,0,0) — but that's the panel position
    // Put source south: (0,0,1)  — wait, that's where panel rotates to
    // Put source at (-1,0,0) west of hinge
    const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
    sourceBlock.getRedstonePower = () => 15;

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    assert.deepEqual(updated.redstoneSource, { x: -1, y: 0, z: 0 });

    // Advance past debounce — source still powered — door stays open
    system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS * 3);

    const stillOpen = manager.getAssembly(assembly.id);
    assert.equal(stillOpen.isOpen, true);
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

  it("adopts a source when a manually-opened door receives redstone", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    // Manually open the door
    manager.openDoor(assembly.id, "cw", [{ x: 0, y: 0, z: 1 }]);
    assert.equal(manager.getAssembly(assembly.id).redstoneSource, null);

    // Place a powered source west of hinge
    const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
    sourceBlock.getRedstonePower = () => 15;

    // Advance past debounce from openDoor
    system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);

    // Signal arrives on hinge with power
    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });

    const updated = manager.getAssembly(assembly.id);
    assert.equal(updated.isOpen, true);
    assert.deepEqual(updated.redstoneSource, { x: -1, y: 0, z: 0 });
  });

  it("does not override an existing tracked source on adoption attempt", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    // Powered source west of hinge
    const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
    sourceBlock.getRedstonePower = () => 15;

    // Open with redstone — sets source
    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
    assert.deepEqual(manager.getAssembly(assembly.id).redstoneSource, { x: -1, y: 0, z: 0 });

    // Another power event while open — should NOT override
    system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);

    const southBlock = placeBlock(dim, "minecraft:lever", { x: 0, y: 0, z: -1 });
    southBlock.getRedstonePower = () => 15;
    const panelBlock = dim.getBlock({ x: 0, y: 0, z: 1 });
    panelBlock.dimension = dim;

    subsystem.handleRedstoneUpdate({ block: panelBlock, powerLevel: 15 });
    assert.deepEqual(manager.getAssembly(assembly.id).redstoneSource, { x: -1, y: 0, z: 0 });
  });

  it("adopted source closing works correctly", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    // Manually open
    manager.openDoor(assembly.id, "cw", [{ x: 0, y: 0, z: 1 }]);
    placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: 0, z: 1 });
    placeBlock(dim, "minecraft:air", { x: 1, y: 0, z: 0 });

    // Place powered source
    const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
    sourceBlock.getRedstonePower = () => 15;

    system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);

    // Adopt
    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
    assert.deepEqual(manager.getAssembly(assembly.id).redstoneSource, { x: -1, y: 0, z: 0 });

    // Depower source
    sourceBlock.getRedstonePower = () => 0;
    system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);
    system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);

    const closed = manager.getAssembly(assembly.id);
    assert.equal(closed.isOpen, false);
    assert.equal(closed.redstoneSource, null);
  });

  it("monitor self-cleans when source is cleared externally (manual close)", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
    sourceBlock.getRedstonePower = () => 15;

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
    assert.equal(manager.getAssembly(assembly.id).isOpen, true);

    // Simulate manual close clearing the source
    manager.clearRedstoneSource(assembly.id);

    // Advance past poll — monitor should self-terminate without closing (already handled externally)
    system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS * 2);

    // Monitor should be gone
    assert.equal(subsystem._sourceMonitors.has(assembly.id), false);
  });

  it("restoreMonitors starts monitors for open doors with sources after reload", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();

    // Simulate persisted state: door is open with a source
    manager.openDoor(assembly.id, "cw", [{ x: 0, y: 0, z: 1 }]);
    manager.setRedstoneSource(assembly.id, { x: -1, y: 0, z: 0 });

    // Source is powered
    const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
    sourceBlock.getRedstonePower = () => 15;

    // Restore monitors (simulates world load)
    subsystem.restoreMonitors(dim);
    assert.equal(subsystem._sourceMonitors.has(assembly.id), true);

    // Source depowers
    sourceBlock.getRedstonePower = () => 0;
    placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: 0, z: 1 });
    placeBlock(dim, "minecraft:air", { x: 1, y: 0, z: 0 });

    system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);

    const closed = manager.getAssembly(assembly.id);
    assert.equal(closed.isOpen, false);
  });

  describe("close obstruction check", () => {
    it("door stays open when obstructed but signal is consumed (source cleared, monitor stopped)", () => {
      const assembly = setupDoor(manager);
      const dim = buildDimension();
      const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
      hingeBlock.dimension = dim;

      // Source west of hinge
      const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;

      subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
      assert.equal(manager.getAssembly(assembly.id).isOpen, true);

      // Place solid block at closed position (1,0,0)
      placeBlock(dim, "minecraft:stone", { x: 1, y: 0, z: 0 });

      // Depower source
      sourceBlock.getRedstonePower = () => 0;
      system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);
      system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);

      const result = manager.getAssembly(assembly.id);
      assert.equal(result.isOpen, true, "Door should stay open when obstructed");
      assert.equal(result.redstoneSource, null, "Signal consumed — source cleared");
      assert.equal(subsystem._sourceMonitors.has(assembly.id), false, "Monitor stopped after signal consumed");
    });

    it("new signal after blocked close re-adopts source for retry", () => {
      const assembly = setupDoor(manager);
      const dim = buildDimension();
      const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
      hingeBlock.dimension = dim;

      const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;

      subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
      assert.equal(manager.getAssembly(assembly.id).isOpen, true);

      // Obstruct and depower — signal consumed
      placeBlock(dim, "minecraft:stone", { x: 1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 0;
      system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);
      system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);
      assert.equal(manager.getAssembly(assembly.id).isOpen, true);
      assert.equal(manager.getAssembly(assembly.id).redstoneSource, null);

      // Remove obstruction, send new signal (re-power source)
      placeBlock(dim, "minecraft:air", { x: 1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;
      system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);

      // New signal on open door with no source → adopts
      subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
      assert.deepEqual(manager.getAssembly(assembly.id).redstoneSource, { x: -1, y: 0, z: 0 });

      // Depower again — this time close succeeds
      sourceBlock.getRedstonePower = () => 0;
      system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);
      system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);

      const result = manager.getAssembly(assembly.id);
      assert.equal(result.isOpen, false, "Door closes on retry via new signal");
    });

    it("soft+solid in closed footprint — no movement, no soft destruction", () => {
      const assemblyObj = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "horizontal");
      manager.setDoorSide(assemblyObj.id, "east");
      manager.addPanelToAssembly(assemblyObj.id, { x: 1, y: 0, z: 0 }, 12);
      manager.addPanelToAssembly(assemblyObj.id, { x: 2, y: 0, z: 0 }, 12);

      const dim = makeMockDimension(new Map());
      dim.spawnItem = () => {};
      dim.getEntities = () => [];
      for (let x = -2; x <= 4; x++) {
        for (let z = -2; z <= 2; z++) {
          placeBlock(dim, "minecraft:air", { x, y: 0, z });
        }
      }
      placeBlock(dim, HINGE_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: 0, z: 0 }, { "bigdoors:material": 12 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 2, y: 0, z: 0 }, { "bigdoors:material": 12 });

      const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;

      const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
      hingeBlock.dimension = dim;

      subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
      const opened = manager.getAssembly(assemblyObj.id);
      assert.equal(opened.isOpen, true);

      // Place soft at closed pos 1 and solid at closed pos 2
      placeBlock(dim, "minecraft:short_grass", { x: 1, y: 0, z: 0 });
      placeBlock(dim, "minecraft:stone", { x: 2, y: 0, z: 0 });

      sourceBlock.getRedstonePower = () => 0;
      system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);
      system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);

      const result = manager.getAssembly(assemblyObj.id);
      assert.equal(result.isOpen, true, "Door stays open");
      // Soft block should NOT be destroyed
      const grassBlock = dim.getBlock({ x: 1, y: 0, z: 0 });
      assert.equal(grassBlock.typeId, "minecraft:short_grass", "Soft block preserved");
    });

    it("close aborts when closed position is unloaded, signal still consumed", () => {
      const assembly = setupDoor(manager);
      const dim = buildDimension();
      const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
      hingeBlock.dimension = dim;

      const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;

      subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
      assert.equal(manager.getAssembly(assembly.id).isOpen, true);

      // Remove closed position to simulate unloaded chunk
      dim._blocks.delete(posKey({ x: 1, y: 0, z: 0 }));

      sourceBlock.getRedstonePower = () => 0;
      system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);
      system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);

      const result = manager.getAssembly(assembly.id);
      assert.equal(result.isOpen, true, "Door stays open when unloaded");
      assert.equal(result.redstoneSource, null, "Signal consumed");
      assert.equal(subsystem._sourceMonitors.has(assembly.id), false, "Monitor stopped");
    });

    it("double door: obstructed partner stays open, both signals consumed", () => {
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

      const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;

      const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
      hingeBlock.dimension = dim;

      subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
      assert.equal(manager.getAssembly(assemblyA.id).isOpen, true);
      assert.equal(manager.getAssembly(assemblyB.id).isOpen, true);

      // Obstruct partner B's closed position (2,0,0)
      placeBlock(dim, "minecraft:stone", { x: 2, y: 0, z: 0 });
      // Keep A's closed position (1,0,0) clear
      placeBlock(dim, "minecraft:air", { x: 1, y: 0, z: 0 });

      sourceBlock.getRedstonePower = () => 0;
      system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);
      system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);

      const a = manager.getAssembly(assemblyA.id);
      const b = manager.getAssembly(assemblyB.id);
      assert.equal(a.isOpen, false, "Primary should close (unobstructed)");
      assert.equal(a.redstoneSource, null, "Primary source cleared");
      assert.equal(b.isOpen, true, "Partner stays open (obstructed)");
      assert.equal(b.redstoneSource, null, "Partner signal consumed too");
    });
  });

  it("no monitor started for manually-opened door on restore", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();

    // Door is open but no source (manual open)
    manager.openDoor(assembly.id, "cw", [{ x: 0, y: 0, z: 1 }]);

    subsystem.restoreMonitors(dim);
    assert.equal(subsystem._sourceMonitors.has(assembly.id), false);
  });

  it("source block destroyed (air) causes door to close", () => {
    const assembly = setupDoor(manager);
    const dim = buildDimension();
    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    const sourceBlock = placeBlock(dim, "minecraft:wooden_pressure_plate", { x: -1, y: 0, z: 0 });
    sourceBlock.getRedstonePower = () => 15;

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });
    assert.equal(manager.getAssembly(assembly.id).isOpen, true);

    // Source block replaced with air (destroyed)
    const airBlock = placeBlock(dim, "minecraft:air", { x: -1, y: 0, z: 0 });
    airBlock.getRedstonePower = () => undefined;
    placeBlock(dim, "minecraft:air", { x: 1, y: 0, z: 0 });

    system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);
    system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);

    const closed = manager.getAssembly(assembly.id);
    assert.equal(closed.isOpen, false);
  });

  it("partner door also stores source and closes together", () => {
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

    // Source west of hinge A
    const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
    sourceBlock.getRedstonePower = () => 15;

    const hingeBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
    hingeBlock.dimension = dim;

    subsystem.handleRedstoneUpdate({ block: hingeBlock, powerLevel: 15 });

    const a = manager.getAssembly(assemblyA.id);
    const b = manager.getAssembly(assemblyB.id);
    assert.equal(a.isOpen, true);
    assert.equal(b.isOpen, true);
    assert.deepEqual(a.redstoneSource, { x: -1, y: 0, z: 0 });
    assert.deepEqual(b.redstoneSource, { x: -1, y: 0, z: 0 });

    // Depower source
    sourceBlock.getRedstonePower = () => 0;
    system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);
    system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);

    assert.equal(manager.getAssembly(assemblyA.id).isOpen, false);
    assert.equal(manager.getAssembly(assemblyB.id).isOpen, false);
  });

  describe("winch redstone", () => {
    function setupWinchDoor(manager) {
      const assembly = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "vertical", "winch");
      manager.setDoorSide(assembly.id, "down");
      manager.addPanelToAssembly(assembly.id, { x: 0, y: -1, z: 0 }, 12);
      return assembly;
    }

    function buildWinchDimension() {
      const dim = makeMockDimension(new Map());
      dim.spawnItem = () => {};
      dim.getEntities = () => [];
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

    it("redstone signal opens winch assembly with linear shift", () => {
      const assembly = setupWinchDoor(manager);
      const dim = buildWinchDimension();

      const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: 1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;

      const winchBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
      winchBlock.dimension = dim;

      subsystem.handleRedstoneUpdate({ block: winchBlock, powerLevel: 15 });

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, true);
      assert.deepEqual(updated.panelPositions[0].currentPos, { x: 0, y: 1, z: 0 });
    });

    it("redstone power-off closes winch assembly back to closedPos", () => {
      const assembly = setupWinchDoor(manager);
      const dim = buildWinchDimension();

      const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: 1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;

      const winchBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
      winchBlock.dimension = dim;

      subsystem.handleRedstoneUpdate({ block: winchBlock, powerLevel: 15 });
      assert.equal(manager.getAssembly(assembly.id).isOpen, true);

      // Ensure closed position is available
      placeBlock(dim, "minecraft:air", { x: 0, y: -1, z: 0 });

      sourceBlock.getRedstonePower = () => 0;
      system.advanceTicks(REDSTONE_DEBOUNCE_TICKS + 1);
      system.advanceTicks(REDSTONE_SOURCE_POLL_TICKS);

      const closed = manager.getAssembly(assembly.id);
      assert.equal(closed.isOpen, false);
      assert.deepEqual(closed.panelPositions[0].currentPos, { x: 0, y: -1, z: 0 });
    });

    it("winch open is blocked when destination has solid block", () => {
      const assembly = setupWinchDoor(manager);
      const dim = buildWinchDimension();
      placeBlock(dim, "minecraft:stone", { x: 0, y: 1, z: 0 });

      const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: 1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;

      const winchBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
      winchBlock.dimension = dim;

      subsystem.handleRedstoneUpdate({ block: winchBlock, powerLevel: 15 });

      assert.equal(manager.getAssembly(assembly.id).isOpen, false);
    });

    it("_findSourceNeighbor skips winch blocks", () => {
      const assembly = setupWinchDoor(manager);
      const dim = buildWinchDimension();

      // Place a winch block as neighbor on a non-destination position
      placeBlock(dim, WINCH_BLOCK_ID, { x: 0, y: 0, z: 1 });
      const winchNeighbor = dim.getBlock({ x: 0, y: 0, z: 1 });
      winchNeighbor.getRedstonePower = () => 15;

      // Place actual source on the other side
      const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: 1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;

      const winchBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
      winchBlock.dimension = dim;

      subsystem.handleRedstoneUpdate({ block: winchBlock, powerLevel: 15 });

      const updated = manager.getAssembly(assembly.id);
      assert.equal(updated.isOpen, true);
      assert.deepEqual(updated.redstoneSource, { x: 1, y: 0, z: 0 });
    });

    it("winch open uses canonical 'cw' direction", () => {
      const assembly = setupWinchDoor(manager);
      const dim = buildWinchDimension();

      const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: 1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;

      const winchBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
      winchBlock.dimension = dim;

      subsystem.handleRedstoneUpdate({ block: winchBlock, powerLevel: 15 });

      assert.equal(manager.getAssembly(assembly.id).openDirection, "cw");
    });

    it("redstone double-door with winch — both open independently", () => {
      const primary = manager.createAssembly({ x: 0, y: 0, z: 0 }, "north", "vertical", "winch");
      manager.setDoorSide(primary.id, "down");
      manager.addPanelToAssembly(primary.id, { x: 0, y: -1, z: 0 }, 12);

      const partner = manager.createAssembly({ x: 1, y: 0, z: 0 }, "north", "vertical", "winch");
      manager.setDoorSide(partner.id, "down");
      manager.addPanelToAssembly(partner.id, { x: 1, y: -1, z: 0 }, 12);
      manager.pairAssemblies(primary.id, partner.id);

      const dim = makeMockDimension(new Map());
      dim.spawnItem = () => {};
      dim.getEntities = () => [];
      placeBlock(dim, WINCH_BLOCK_ID, { x: 0, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 0, y: -1, z: 0 });
      placeBlock(dim, WINCH_BLOCK_ID, { x: 1, y: 0, z: 0 });
      placeBlock(dim, PANEL_BLOCK_ID, { x: 1, y: -1, z: 0 });
      for (let x = -1; x <= 2; x++) {
        for (let y = -3; y <= 3; y++) {
          for (let z = -1; z <= 1; z++) {
            const key = posKey({ x, y, z });
            if (!dim._blocks.has(key)) {
              placeBlock(dim, "minecraft:air", { x, y, z });
            }
          }
        }
      }

      const sourceBlock = placeBlock(dim, "minecraft:repeater", { x: -1, y: 0, z: 0 });
      sourceBlock.getRedstonePower = () => 15;

      const winchBlock = dim.getBlock({ x: 0, y: 0, z: 0 });
      winchBlock.dimension = dim;

      subsystem.handleRedstoneUpdate({ block: winchBlock, powerLevel: 15 });

      const updatedPrimary = manager.getAssembly(primary.id);
      const updatedPartner = manager.getAssembly(partner.id);
      assert.equal(updatedPrimary.isOpen, true);
      assert.equal(updatedPartner.isOpen, true);
      assert.deepEqual(updatedPrimary.panelPositions[0].currentPos, { x: 0, y: 1, z: 0 });
      assert.deepEqual(updatedPartner.panelPositions[0].currentPos, { x: 1, y: 1, z: 0 });
    });
  });
});
