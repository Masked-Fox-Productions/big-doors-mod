import { world, system } from "@minecraft/server";
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
      console.warn("[bigdoors] hinge place stub");
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
