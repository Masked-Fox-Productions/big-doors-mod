import { world, system } from "@minecraft/server";
import { DoorManager } from "./DoorManager.js";
import { HingePlacementHandler } from "./handler/HingePlacementHandler.js";
import { PanelPlacementHandler } from "./handler/PanelPlacementHandler.js";
import { InteractionHandler } from "./handler/InteractionHandler.js";
import { BreakHandler } from "./handler/BreakHandler.js";

console.warn("[bigdoors] === Mod initializing ===");

let manager;
let interaction;
let breakHandler;

system.beforeEvents.startup.subscribe((ev) => {
  ev.blockComponentRegistry.registerCustomComponent("bigdoors:hinge_component", {
    onPlayerInteract(e) {
      interaction.handleInteract(e.block, e.player, e.block.dimension);
    },
    onPlayerDestroy(e) {
      breakHandler.handleHingeBreak(e);
    },
    beforeOnPlayerPlace(e) {
      console.warn("[bigdoors] hinge place stub");
    },
  });

  ev.blockComponentRegistry.registerCustomComponent("bigdoors:panel_component", {
    onPlayerInteract(e) {
      interaction.handleInteract(e.block, e.player, e.block.dimension);
    },
    onPlayerDestroy(e) {
      breakHandler.handlePanelBreak(e);
    },
  });
});

manager = new DoorManager();
interaction = new InteractionHandler(manager);
breakHandler = new BreakHandler(manager);

world.afterEvents.worldInitialize.subscribe(() => {
  console.warn("[bigdoors] worldInitialize fired — loading persistence");
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
