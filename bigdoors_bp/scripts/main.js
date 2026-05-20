import { world, system, BlockPermutation } from "@minecraft/server";
import { HINGE_BLOCK_ID, HIDDEN_HINGE_BLOCK_ID, WINCH_BLOCK_ID, HIDDEN_WINCH_BLOCK_ID, UNMATCHED_MATERIAL_INDEX } from "./util/Constants.js";
import { DoorManager } from "./DoorManager.js";
import { HingePlacementHandler } from "./handler/HingePlacementHandler.js";
import { PanelPlacementHandler } from "./handler/PanelPlacementHandler.js";
import { InteractionHandler } from "./handler/InteractionHandler.js";
import { BreakHandler } from "./handler/BreakHandler.js";
import { RedstoneSubsystem } from "./subsystem/RedstoneSubsystem.js";

console.log("[bigdoors] === Mod initializing ===");

let manager;
let interaction;
let breakHandler;
let redstone;

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

  ev.blockComponentRegistry.registerCustomComponent("bigdoors:winch_component", {
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
      e.permutationToPlace = BlockPermutation.resolve(WINCH_BLOCK_ID, {
        "bigdoors:facing": facing,
        "bigdoors:mode": "vertical",
        "bigdoors:door_side": "none",
        "bigdoors:material_group": Math.floor(UNMATCHED_MATERIAL_INDEX / 16),
        "bigdoors:material_id": UNMATCHED_MATERIAL_INDEX % 16,
      });
    },
    onRedstoneUpdate(e) {
      redstone.handleRedstoneUpdate(e);
    },
  });

  ev.blockComponentRegistry.registerCustomComponent("bigdoors:hidden_winch_component", {
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
      e.permutationToPlace = BlockPermutation.resolve(HIDDEN_WINCH_BLOCK_ID, {
        "bigdoors:facing": facing,
        "bigdoors:mode": "vertical",
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
});

manager = new DoorManager();
interaction = new InteractionHandler(manager);
breakHandler = new BreakHandler(manager);
redstone = new RedstoneSubsystem(manager);

world.afterEvents.worldLoad.subscribe(() => {
  console.log("[bigdoors] worldLoad fired — loading persistence");
  manager.load();
  redstone.restoreMonitors(world.getDimension("overworld"));
});

system.run(() => {
  console.log("[bigdoors] Fallback load triggered");
  manager.load();
  redstone.restoreMonitors(world.getDimension("overworld"));
});

const hingePlacement = new HingePlacementHandler(manager);
hingePlacement.register();

const panelPlacement = new PanelPlacementHandler(manager);
panelPlacement.register();

console.log("[bigdoors] === Initialization complete ===");

export { manager };
