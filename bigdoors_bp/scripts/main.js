import { world, system } from "@minecraft/server";
import { DoorManager } from "./DoorManager.js";
import { HingePlacementHandler } from "./handler/HingePlacementHandler.js";
import { PanelPlacementHandler } from "./handler/PanelPlacementHandler.js";

console.warn("[bigdoors] === Mod initializing ===");

let manager;

system.beforeEvents.startup.subscribe((ev) => {
  ev.blockComponentRegistry.registerCustomComponent("bigdoors:hinge_component", {
    onPlayerInteract(e) {
      console.warn("[bigdoors] hinge interact stub");
    },
    onPlayerDestroy(e) {
      console.warn("[bigdoors] hinge destroy stub");
    },
    beforeOnPlayerPlace(e) {
      console.warn("[bigdoors] hinge place stub");
    },
  });

  ev.blockComponentRegistry.registerCustomComponent("bigdoors:panel_component", {
    onPlayerInteract(e) {
      console.warn("[bigdoors] panel interact stub");
    },
    onPlayerDestroy(e) {
      console.warn("[bigdoors] panel destroy stub");
    },
  });
});

manager = new DoorManager();

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
