import { world, system, BlockPermutation } from "@minecraft/server";
import { HINGE_BLOCK_ID } from "./util/Constants.js";
import { DoorManager } from "./DoorManager.js";
import { HingePlacementHandler } from "./handler/HingePlacementHandler.js";
import { PanelPlacementHandler } from "./handler/PanelPlacementHandler.js";
import { InteractionHandler } from "./handler/InteractionHandler.js";
import { BreakHandler } from "./handler/BreakHandler.js";
import { RedstoneSubsystem } from "./subsystem/RedstoneSubsystem.js";

console.warn("[bigdoors] === Mod initializing ===");

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
      const face = e.face;
      const mode = (face === "Up" || face === "Down") ? "vertical" : "horizontal";
      const viewDir = e.player.getViewDirection();
      const facing = Math.abs(viewDir.x) > Math.abs(viewDir.z)
        ? (viewDir.x > 0 ? "east" : "west")
        : (viewDir.z > 0 ? "south" : "north");
      e.permutationToPlace = BlockPermutation.resolve(HINGE_BLOCK_ID, {
        "bigdoors:facing": facing,
        "bigdoors:mode": mode,
        "bigdoors:door_side": "none",
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
  console.warn("[bigdoors] worldLoad fired — loading persistence");
  manager.load();
});

system.run(() => {
  console.warn("[bigdoors] Fallback load triggered");
  manager.load();
});

const hingePlacement = new HingePlacementHandler(manager);
hingePlacement.register();

const panelPlacement = new PanelPlacementHandler(manager);
panelPlacement.register();

console.warn("[bigdoors] === Initialization complete ===");

export { manager };
