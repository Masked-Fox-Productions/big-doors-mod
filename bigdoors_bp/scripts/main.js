import { world, system, BlockPermutation } from "@minecraft/server";
import { HINGE_BLOCK_ID, HIDDEN_HINGE_BLOCK_ID, UNMATCHED_MATERIAL_INDEX } from "./util/Constants.js";
import { ROPE_BLOCK_ID, ROPE_LADDER_BLOCK_ID } from "./ropes/util/RopeConstants.js";
import { DoorManager } from "./DoorManager.js";
import { HingePlacementHandler } from "./handler/HingePlacementHandler.js";
import { PanelPlacementHandler } from "./handler/PanelPlacementHandler.js";
import { InteractionHandler } from "./handler/InteractionHandler.js";
import { BreakHandler } from "./handler/BreakHandler.js";
import { RedstoneSubsystem } from "./subsystem/RedstoneSubsystem.js";
import { RopeManager } from "./ropes/RopeManager.js";
import { initRopes } from "./ropes/init.js";

console.warn("[bigdoors] === Mod initializing ===");

let manager;
let interaction;
let breakHandler;
let redstone;
let ropeManager;
let ropeInteraction;
let ropeBreak;

system.beforeEvents.startup.subscribe((ev) => {
  ev.blockComponentRegistry.registerCustomComponent("bigdoors:hinge_component", {
    onPlayerInteract(e) {
      interaction.handleInteract(e.block, e.player, e.block.dimension);
    },
    onPlayerBreak(e) {
      breakHandler.handleHingeBreak(e);
    },
    beforeOnPlayerPlace(e) {
      const viewDir = e.player.getViewDirection();
      const facing = Math.abs(viewDir.x) > Math.abs(viewDir.z)
        ? (viewDir.x > 0 ? "east" : "west")
        : (viewDir.z > 0 ? "south" : "north");
      e.permutationToPlace = BlockPermutation.resolve(HINGE_BLOCK_ID, {
        "bigdoors:facing": facing,
        "bigdoors:mode": "horizontal",
        "bigdoors:door_side": "none",
        "bigdoors:material_group": Math.floor(UNMATCHED_MATERIAL_INDEX / 16),
        "bigdoors:material_id": UNMATCHED_MATERIAL_INDEX % 16,
      });
    },
    onRedstoneUpdate(e) {
      redstone.handleRedstoneUpdate(e);
    },
  });

  ev.blockComponentRegistry.registerCustomComponent("bigdoors:hidden_hinge_component", {
    onPlayerInteract(e) {
      interaction.handleInteract(e.block, e.player, e.block.dimension);
    },
    onPlayerBreak(e) {
      breakHandler.handleHingeBreak(e);
    },
    beforeOnPlayerPlace(e) {
      const viewDir = e.player.getViewDirection();
      const facing = Math.abs(viewDir.x) > Math.abs(viewDir.z)
        ? (viewDir.x > 0 ? "east" : "west")
        : (viewDir.z > 0 ? "south" : "north");
      e.permutationToPlace = BlockPermutation.resolve(HIDDEN_HINGE_BLOCK_ID, {
        "bigdoors:facing": facing,
        "bigdoors:mode": "horizontal",
        "bigdoors:door_side": "none",
        "bigdoors:material_group": Math.floor(UNMATCHED_MATERIAL_INDEX / 16),
        "bigdoors:material_id": UNMATCHED_MATERIAL_INDEX % 16,
      });
    },
    onRedstoneUpdate(e) {
      redstone.handleRedstoneUpdate(e);
    },
  });

  ev.blockComponentRegistry.registerCustomComponent("bigdoors:panel_component", {
    onPlayerInteract(e) {
      interaction.handleInteract(e.block, e.player, e.block.dimension);
    },
    onPlayerBreak(e) {
      breakHandler.handlePanelBreak(e);
    },
    onRedstoneUpdate(e) {
      redstone.handleRedstoneUpdate(e);
    },
  });

  ev.blockComponentRegistry.registerCustomComponent("ropes:rope_component", {
    onPlayerInteract(e) {
      if (ropeInteraction) ropeInteraction.handleInteract(e.block, e.player, e.block.dimension);
    },
    onPlayerBreak(e) {
      if (ropeBreak) ropeBreak.handleBreak(e);
    },
    beforeOnPlayerPlace(e) {
      const face = e.face ?? "up";
      e.permutationToPlace = BlockPermutation.resolve(ROPE_BLOCK_ID, {
        "ropes:rope_state": "coiled",
        "ropes:face": face,
      });
    },
  });

  ev.blockComponentRegistry.registerCustomComponent("ropes:rope_ladder_component", {
    onPlayerInteract(e) {
      if (ropeInteraction) ropeInteraction.handleInteract(e.block, e.player, e.block.dimension);
    },
    onPlayerBreak(e) {
      if (ropeBreak) ropeBreak.handleBreak(e);
    },
    beforeOnPlayerPlace(e) {
      const face = e.face ?? "north";
      const wallFaces = new Set(["north", "south", "east", "west"]);
      if (!wallFaces.has(face)) {
        e.cancel = true;
        return;
      }
      e.permutationToPlace = BlockPermutation.resolve(ROPE_LADDER_BLOCK_ID, {
        "ropes:ladder_state": "coiled",
        "ropes:face": face,
      });
    },
  });
});

manager = new DoorManager();
interaction = new InteractionHandler(manager);
breakHandler = new BreakHandler(manager);
redstone = new RedstoneSubsystem(manager);

ropeManager = new RopeManager();

world.afterEvents.worldLoad.subscribe(() => {
  console.warn("[bigdoors] worldLoad fired — loading persistence");
  manager.load();
  ropeManager.load();
  redstone.restoreMonitors(world.getDimension("overworld"));
});

system.run(() => {
  console.warn("[bigdoors] Fallback load triggered");
  manager.load();
  ropeManager.load();
  redstone.restoreMonitors(world.getDimension("overworld"));
});

const hingePlacement = new HingePlacementHandler(manager);
hingePlacement.register();

const panelPlacement = new PanelPlacementHandler(manager);
panelPlacement.register();

const ropeHandlers = initRopes(ropeManager);
ropeInteraction = ropeHandlers.interaction;
ropeBreak = ropeHandlers.breakHandler;

console.warn("[bigdoors] === Initialization complete ===");

export { manager, ropeManager };
