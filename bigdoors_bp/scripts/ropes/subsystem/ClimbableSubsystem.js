import { world, system, InputButton } from "@minecraft/server";
import { CLIMB_INTERVAL_TICKS, ROPE_CLIMB_SPEED, LADDER_CLIMB_SPEED, WHIP_CLIMB_SPEED } from "../util/RopeConstants.js";

const SLOW_FALLING_DURATION = 4;
const SLOW_FALLING_ID = "slow_falling";
const MOVEMENT_DEADZONE = 0.15;

function isPressed(state) {
  return state === "Pressed" || state === true;
}

export class ClimbableSubsystem {
  constructor(ropeManager) {
    this._manager = ropeManager;
    this._climbingState = new Map();
  }

  register() {
    system.runInterval(() => this._tick(), CLIMB_INTERVAL_TICKS);
    console.log("[ropes] ClimbableSubsystem registered, interval=" + CLIMB_INTERVAL_TICKS);
  }

  _tick() {
    let currentPlayers;
    try {
      currentPlayers = world.getAllPlayers();
    } catch { return; }

    const activeIds = new Set();
    for (const player of currentPlayers) {
      activeIds.add(player.id);
      this._processPlayer(player);
    }

    for (const [playerId, state] of this._climbingState) {
      if (!activeIds.has(playerId)) {
        this._climbingState.delete(playerId);
      }
    }
  }

  _processPlayer(player) {
    const pos = player.location;
    const feetPos = { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) };
    const headPos = { x: feetPos.x, y: feetPos.y + 1, z: feetPos.z };
    const dimId = player.dimension.id;

    const chainAtFeet = this._manager.getChainAtPosition(dimId, feetPos);
    const chainAtHead = this._manager.getChainAtPosition(dimId, headPos);
    const chain = chainAtFeet ?? chainAtHead;

    const state = this._climbingState.get(player.id) ?? { inRope: false, effectApplied: false };

    if (chain) {
      state.inRope = true;

      let isJumping = false;
      let isSneaking = false;
      let isMoving = false;
      try {
        isJumping = isPressed(player.inputInfo.getButtonState(InputButton.Jump));
      } catch (err) {
        console.warn(`[ropes] inputInfo.Jump failed: ${err}`);
        try { isJumping = player.isJumping; } catch {}
      }
      try {
        isSneaking = isPressed(player.inputInfo.getButtonState(InputButton.Sneak));
      } catch (err) {
        console.warn(`[ropes] inputInfo.Sneak failed: ${err}`);
        try { isSneaking = player.isSneaking; } catch {}
      }
      try {
        const movement = player.inputInfo.getMovementVector();
        isMoving = Math.abs(movement.x) > MOVEMENT_DEADZONE || Math.abs(movement.y) > MOVEMENT_DEADZONE;
      } catch {}

      if (chain.type === "rope_ladder") {
        if (isJumping || isMoving) {
          this._applyVerticalLift(player, LADDER_CLIMB_SPEED);
        }
      } else {
        const climbSpeed = chain.type === "whip" ? WHIP_CLIMB_SPEED : ROPE_CLIMB_SPEED;

        if (!state.effectApplied) {
          try {
            player.addEffect(SLOW_FALLING_ID, SLOW_FALLING_DURATION, { amplifier: 0, showParticles: false });
            state.effectApplied = true;
          } catch (err) { console.warn(`[ropes] addEffect failed: ${err}`); }
        }

        if (isJumping) {
          this._applyVerticalLift(player, climbSpeed);
        } else if (isSneaking) {
          try {
            player.removeEffect(SLOW_FALLING_ID);
            state.effectApplied = false;
          } catch {}
        } else {
          try {
            player.addEffect(SLOW_FALLING_ID, SLOW_FALLING_DURATION, { amplifier: 0, showParticles: false });
            state.effectApplied = true;
          } catch {}
        }
      }

      this._climbingState.set(player.id, state);
    } else if (state.inRope) {
      if (state.effectApplied) {
        try {
          player.removeEffect(SLOW_FALLING_ID);
        } catch {}
      }
      this._climbingState.delete(player.id);
    }
  }

  _applyVerticalLift(player, strength) {
    try {
      player.applyKnockback({ x: 0, z: 0 }, strength);
    } catch (err) {
      console.warn(`[ropes] knockback failed: ${err}`);
    }
  }
}
