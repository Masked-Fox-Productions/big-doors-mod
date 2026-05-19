import { RopePlacementHandler } from "./handler/RopePlacementHandler.js";
import { RopeInteractionHandler } from "./handler/RopeInteractionHandler.js";
import { RopeBreakHandler } from "./handler/RopeBreakHandler.js";
import { WhipSubsystem } from "./subsystem/WhipSubsystem.js";
import { ClimbableSubsystem } from "./subsystem/ClimbableSubsystem.js";

export function initRopes(ropeManager) {
  const placement = new RopePlacementHandler(ropeManager);
  placement.register();

  const interaction = new RopeInteractionHandler(ropeManager);

  const breakHandler = new RopeBreakHandler(ropeManager);
  breakHandler.register();

  const whip = new WhipSubsystem(ropeManager);
  whip.register();

  const climbable = new ClimbableSubsystem(ropeManager);
  climbable.register();

  console.log("[ropes] Rope subsystems initialized");
  return { interaction, breakHandler };
}
