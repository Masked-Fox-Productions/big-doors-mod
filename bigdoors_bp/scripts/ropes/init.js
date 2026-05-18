import { RopePlacementHandler } from "./handler/RopePlacementHandler.js";
import { RopeInteractionHandler } from "./handler/RopeInteractionHandler.js";

export function initRopes(ropeManager) {
  const placement = new RopePlacementHandler(ropeManager);
  placement.register();

  const interaction = new RopeInteractionHandler(ropeManager);

  console.warn("[ropes] Rope subsystems initialized");
  return { interaction };
}
