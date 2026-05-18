import { RopePlacementHandler } from "./handler/RopePlacementHandler.js";

export function initRopes(ropeManager) {
  const placement = new RopePlacementHandler(ropeManager);
  placement.register();

  console.warn("[ropes] Rope subsystems initialized");
}
