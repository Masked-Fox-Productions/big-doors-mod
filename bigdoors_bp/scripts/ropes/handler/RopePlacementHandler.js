import { world, BlockPermutation } from "@minecraft/server";
import { ROPE_BLOCK_ID, ROPE_LADDER_BLOCK_ID } from "../util/RopeConstants.js";

export class RopePlacementHandler {
  constructor(ropeManager) {
    this._manager = ropeManager;
  }

  register() {
    world.afterEvents.playerPlaceBlock.subscribe((event) => {
      const typeId = event.block.typeId;
      if (typeId !== ROPE_BLOCK_ID && typeId !== ROPE_LADDER_BLOCK_ID) return;
      this._onPlace(event.block, event.player, event.block.dimension);
    });
  }

  _onPlace(block, player, dimension) {
    const pos = block.location;
    const dimId = dimension.id;
    const type = block.typeId === ROPE_LADDER_BLOCK_ID ? "rope_ladder" : "rope";

    const above = { x: pos.x, y: pos.y + 1, z: pos.z };
    const chainAbove = this._manager.getChainAtPosition(dimId, above);
    if (chainAbove && chainAbove.type === type) {
      this._manager.addSegmentPosition(chainAbove.id, dimId, pos);
      const lastDrop = chainAbove.drops[chainAbove.drops.length - 1];
      lastDrop.segments.push({ ...pos });
      this._setSegmentState(block, type);
      this._manager.save();
      return;
    }

    const below = { x: pos.x, y: pos.y - 1, z: pos.z };
    const chainBelow = this._manager.getChainAtPosition(dimId, below);
    if (chainBelow && chainBelow.type === type) {
      this._manager.addSegmentPosition(chainBelow.id, dimId, pos);
      const lastDrop = chainBelow.drops[chainBelow.drops.length - 1];
      lastDrop.segments.push({ ...pos });
      this._setSegmentState(block, type);
      this._manager.save();
      return;
    }

    const face = block.permutation.getState("ropes:face") ??
                 block.permutation.getState("ropes:ladder_state") != null
                   ? (block.permutation.getState("ropes:face") ?? "up")
                   : "up";

    this._manager.createChain(type, dimId, pos, face, 0);
  }

  _setSegmentState(block, type) {
    const stateKey = type === "rope_ladder" ? "ropes:ladder_state" : "ropes:rope_state";
    const face = block.permutation.getState("ropes:face") ?? "up";
    block.setPermutation(BlockPermutation.resolve(block.typeId, {
      [stateKey]: "segment",
      "ropes:face": face,
    }));
  }
}
