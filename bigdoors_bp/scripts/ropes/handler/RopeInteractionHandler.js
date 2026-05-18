import { BlockPermutation } from "@minecraft/server";
import { ROPE_BLOCK_ID, ROPE_LADDER_BLOCK_ID } from "../util/RopeConstants.js";
import { DIR_OFFSETS } from "../../util/Constants.js";

const CARDINAL_ORDER = ["north", "east", "south", "west"];

function blockIdForChainType(type) {
  return type === "rope_ladder" ? ROPE_LADDER_BLOCK_ID : ROPE_BLOCK_ID;
}

function stateForChainType(type) {
  return type === "rope_ladder" ? "ropes:ladder_state" : "ropes:rope_state";
}

function faceStateForChainType(type) {
  return "ropes:face";
}

function yawToCardinal(yaw) {
  const normalized = ((yaw % 360) + 360) % 360;
  if (normalized >= 315 || normalized < 45) return "south";
  if (normalized >= 45 && normalized < 135) return "west";
  if (normalized >= 135 && normalized < 225) return "north";
  return "east";
}

function clockwiseFrom(facing) {
  const idx = CARDINAL_ORDER.indexOf(facing);
  if (idx < 0) return CARDINAL_ORDER;
  const result = [];
  for (let i = 0; i < 4; i++) {
    result.push(CARDINAL_ORDER[(idx + i) % 4]);
  }
  return result;
}

export class RopeInteractionHandler {
  constructor(ropeManager) {
    this._manager = ropeManager;
  }

  handleInteract(block, player, dimension) {
    const pos = block.location;
    const dimId = dimension.id;
    const chain = this._manager.getChainAtPosition(dimId, pos);
    if (!chain) return;

    if (chain.isWhipDeployed) return;

    const isHoldingRopeItem = this._isHoldingMatchingItem(player, chain.type);
    const info = chain.getDropForPosition(pos);
    if (!info) return;

    if (chain.isAnchor(pos) && (chain.drops[0].segments.length > 0 || chain.drops.length > 1)) {
      this._fullRecoil(chain, dimension);
    } else if (info.isCoil) {
      if (isHoldingRopeItem) {
        this._addSegmentFromItem(chain, info.dropIndex, player);
      } else if (info.drop.remaining > 0) {
        this._uncoil(chain, info.dropIndex, player, dimension);
      }
    } else {
      if (!isHoldingRopeItem) {
        this._retractOne(chain, dimension);
      }
    }
  }

  _isHoldingMatchingItem(player, chainType) {
    try {
      const container = player.getComponent("inventory")?.container;
      if (!container) return false;
      const selected = container.getItem(player.selectedSlotIndex);
      if (!selected) return false;
      const matchId = chainType === "rope_ladder" ? ROPE_LADDER_BLOCK_ID : ROPE_BLOCK_ID;
      return selected.typeId === matchId;
    } catch {
      return false;
    }
  }

  _addSegmentFromItem(chain, dropIndex, player) {
    const added = chain.addSegments(1, dropIndex);
    if (added <= 0) return;
    try {
      const container = player.getComponent("inventory")?.container;
      if (!container) return;
      const slot = player.selectedSlotIndex;
      const item = container.getItem(slot);
      if (item && item.amount > 1) {
        item.amount--;
        container.setItem(slot, item);
      } else {
        container.setItem(slot, undefined);
      }
    } catch { /* inventory operations may fail */ }
    this._manager.save();
  }

  _uncoil(chain, dropIndex, player, dimension) {
    const drop = chain.getDrop(dropIndex);
    if (!drop || drop.remaining <= 0) return;

    const startPos = drop.segments.length > 0
      ? drop.segments[drop.segments.length - 1]
      : drop.coilPos;

    let currentY = startPos.y - 1;
    const positions = [];

    let baseX = startPos.x;
    let baseZ = startPos.z;

    const belowStart = { x: baseX, y: currentY, z: baseZ };
    let canGoStraightDown = false;
    try {
      const b = dimension.getBlock(belowStart);
      canGoStraightDown = b && (b.typeId === "minecraft:air" || b.typeId === "minecraft:cave_air" || b.typeId === "minecraft:void_air");
    } catch { return; }

    if (!canGoStraightDown && chain.type === "rope") {
      const edgePos = this._findEdge(drop.coilPos, player, dimension);
      if (!edgePos) return;
      baseX = edgePos.x;
      baseZ = edgePos.z;
      positions.push({ x: baseX, y: drop.coilPos.y, z: baseZ });
      currentY = drop.coilPos.y - 1;
    } else if (!canGoStraightDown) {
      return;
    }

    while (positions.length < drop.remaining) {
      const checkPos = { x: baseX, y: currentY, z: baseZ };
      try {
        const b = dimension.getBlock(checkPos);
        if (!b) break;
        const isAir = b.typeId === "minecraft:air" || b.typeId === "minecraft:cave_air" || b.typeId === "minecraft:void_air";
        if (!isAir) break;
      } catch { break; }
      positions.push({ x: baseX, y: currentY, z: baseZ });
      currentY--;
    }

    if (positions.length === 0) return;

    const blockId = blockIdForChainType(chain.type);
    const stateKey = stateForChainType(chain.type);
    const face = chain.anchorFace;

    const result = chain.extendDrop(dropIndex, positions);

    for (const pos of positions.slice(0, result.extended)) {
      try {
        const b = dimension.getBlock(pos);
        if (!b) continue;
        const states = { [stateKey]: "segment" };
        if (chain.type === "rope_ladder") {
          states["ropes:face"] = face;
        } else {
          states["ropes:face"] = face;
        }
        b.setPermutation(BlockPermutation.resolve(blockId, states));
        this._manager.addSegmentPosition(chain.id, chain.dimensionId, pos);
      } catch { /* block in unloaded chunk */ }
    }

    this._manager.save();
  }

  _findEdge(coilPos, player, dimension) {
    let facing = "south";
    try {
      facing = yawToCardinal(player.getRotation().y);
    } catch { /* fallback to south */ }

    const directions = clockwiseFrom(facing);
    for (const dir of directions) {
      const off = DIR_OFFSETS[dir];
      const adjPos = { x: coilPos.x + off.x, y: coilPos.y, z: coilPos.z + off.z };
      const belowAdj = { x: adjPos.x, y: adjPos.y - 1, z: adjPos.z };
      try {
        const adjBlock = dimension.getBlock(adjPos);
        const belowBlock = dimension.getBlock(belowAdj);
        if (!adjBlock || !belowBlock) continue;
        const adjAir = adjBlock.typeId === "minecraft:air" || adjBlock.typeId === "minecraft:cave_air" || adjBlock.typeId === "minecraft:void_air";
        const belowAir = belowBlock.typeId === "minecraft:air" || belowBlock.typeId === "minecraft:cave_air" || belowBlock.typeId === "minecraft:void_air";
        if (adjAir && belowAir) return adjPos;
      } catch { continue; }
    }
    return null;
  }

  _fullRecoil(chain, dimension) {
    const removed = chain.fullRecoil();
    for (const pos of removed) {
      try {
        const b = dimension.getBlock(pos);
        if (b) b.setType("minecraft:air");
      } catch { /* unloaded chunk */ }
      this._manager.removeSegmentPosition(chain.dimensionId, pos);
    }
    this._manager.save();
  }

  _retractOne(chain, dimension) {
    const result = chain.retractOneFromBottom();
    if (!result) return;

    try {
      const b = dimension.getBlock(result.removed);
      if (b) b.setType("minecraft:air");
    } catch { /* unloaded chunk */ }
    this._manager.removeSegmentPosition(chain.dimensionId, result.removed);

    if (result.ledgeCoilRemoved) {
      try {
        const b = dimension.getBlock(result.ledgeCoilRemoved);
        if (b) b.setType("minecraft:air");
      } catch { /* unloaded chunk */ }
      this._manager.removeSegmentPosition(chain.dimensionId, result.ledgeCoilRemoved);
    }

    this._manager.save();
  }
}
