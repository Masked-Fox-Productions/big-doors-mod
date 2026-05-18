import { world, system } from "@minecraft/server";
import { CLIMB_INTERVAL_TICKS, ROPE_CLIMB_SPEED, LADDER_CLIMB_SPEED } from "../util/RopeConstants.js";

const SLOW_FALLING_DURATION = 4;
const SLOW_FALLING_ID = "slow_falling";

export class ClimbableSubsystem {
  constructor(ropeManager) {
    this._manager = ropeManager;
    this._climbingState = new Map();
  }

  register() {
    system.runInterval(() => this._tick(), CLIMB_INTERVAL_TICKS);
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
      try {
        isJumping = player.isJumping;
      } catch { /* player may be invalid */ }
      try {
        isSneaking = player.isSneaking;
      } catch { /* player may be invalid */ }

      if (chain.type === "rope_ladder") {
        if (isJumping) {
          try {
            player.applyKnockback(0, 0, 0, LADDER_CLIMB_SPEED);
          } catch { /* player may be invalid */ }
        }
      } else {
        if (!state.effectApplied) {
          try {
            player.addEffect(SLOW_FALLING_ID, SLOW_FALLING_DURATION, { amplifier: 0, showParticles: false });
            state.effectApplied = true;
          } catch { /* effect may fail */ }
        }

        if (isJumping) {
          try {
            player.applyKnockback(0, 0, 0, ROPE_CLIMB_SPEED);
          } catch { /* player may be invalid */ }
        } else if (isSneaking) {
          try {
            player.removeEffect(SLOW_FALLING_ID);
            state.effectApplied = false;
          } catch { /* effect may fail */ }
        } else {
          try {
            player.addEffect(SLOW_FALLING_ID, SLOW_FALLING_DURATION, { amplifier: 0, showParticles: false });
            state.effectApplied = true;
          } catch { /* effect may fail */ }
        }
      }

      this._climbingState.set(player.id, state);
    } else if (state.inRope) {
      if (state.effectApplied) {
        try {
          player.removeEffect(SLOW_FALLING_ID);
        } catch { /* effect may fail */ }
      }
      this._climbingState.delete(player.id);
    }
  }
}
