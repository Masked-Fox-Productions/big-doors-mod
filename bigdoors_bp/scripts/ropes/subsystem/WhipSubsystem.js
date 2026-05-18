import { world, BlockPermutation, ItemStack } from "@minecraft/server";
import { WHIP_ITEM_ID, ROPE_BLOCK_ID, WHIP_RANGE, WHIP_DEPLOY_SEGMENTS } from "../util/RopeConstants.js";

export class WhipSubsystem {
  constructor(ropeManager) {
    this._manager = ropeManager;
  }

  register() {
    world.afterEvents.itemUse.subscribe((event) => {
      if (event.itemStack?.typeId !== WHIP_ITEM_ID) return;
      this._handleWhipUse(event.source);
    });
  }

  _handleWhipUse(player) {
    try {
      const entities = player.getEntitiesFromViewDirection({ maxDistance: WHIP_RANGE });
      const blockHit = player.getBlockFromViewDirection({ maxDistance: WHIP_RANGE });
      if (!blockHit) return;

      if (entities.length > 0) {
        const entityDist = entities[0].distance;
        const blockDist = blockHit.distance;
        if (entityDist < blockDist) return;
      }

      this._deploy(player, blockHit.block, blockHit.face);
    } catch { /* raycast may fail */ }
  }

  _deploy(player, targetBlock, face) {
    const dimension = targetBlock.dimension;
    const dimId = dimension.id;
    const faceOffsets = {
      Up: { x: 0, y: 1, z: 0 },
      Down: { x: 0, y: -1, z: 0 },
      North: { x: 0, y: 0, z: -1 },
      South: { x: 0, y: 0, z: 1 },
      East: { x: 1, y: 0, z: 0 },
      West: { x: -1, y: 0, z: 0 },
    };
    const off = faceOffsets[face] ?? { x: 0, y: 1, z: 0 };
    const startPos = {
      x: targetBlock.location.x + off.x,
      y: targetBlock.location.y + off.y,
      z: targetBlock.location.z + off.z,
    };

    const positions = [];
    for (let i = 0; i < WHIP_DEPLOY_SEGMENTS; i++) {
      const pos = { x: startPos.x, y: startPos.y - i, z: startPos.z };
      try {
        const b = dimension.getBlock(pos);
        if (!b) break;
        const isAir = b.typeId === "minecraft:air" || b.typeId === "minecraft:cave_air" || b.typeId === "minecraft:void_air";
        if (!isAir) break;
      } catch { break; }
      positions.push(pos);
    }

    if (positions.length === 0) return;

    const faceLower = (face ?? "up").toLowerCase();
    const chain = this._manager.createChain("rope", dimId, positions[0], faceLower, 0);
    chain.isWhipDeployed = true;
    chain.deployerName = player.name;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const isHandle = i === positions.length - 1;
      try {
        const b = dimension.getBlock(pos);
        if (!b) continue;
        const states = {
          "ropes:rope_state": isHandle ? "whip_handle" : "segment",
          "ropes:face": faceLower,
        };
        b.setPermutation(BlockPermutation.resolve(ROPE_BLOCK_ID, states));
      } catch { /* block in unloaded chunk */ }

      if (i > 0) {
        this._manager.addSegmentPosition(chain.id, dimId, pos);
      }
      chain.drops[0].segments.push({ ...pos });
    }

    try {
      const container = player.getComponent("inventory")?.container;
      if (container) {
        const slot = player.selectedSlotIndex;
        const item = container.getItem(slot);
        if (item && item.typeId === WHIP_ITEM_ID) {
          container.setItem(slot, undefined);
        }
      }
    } catch { /* inventory operation may fail */ }

    this._manager.save();
  }
}
