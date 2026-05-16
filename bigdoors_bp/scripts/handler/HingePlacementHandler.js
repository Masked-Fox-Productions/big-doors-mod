import { world, BlockPermutation } from "@minecraft/server";
import {
  HINGE_BLOCK_ID,
  PANEL_BLOCK_ID,
  DIR_OFFSETS,
  DIRECTIONS,
  OPPOSITE_DIR,
} from "../util/Constants.js";

const HORIZONTAL_DIRS = [
  DIRECTIONS.NORTH,
  DIRECTIONS.SOUTH,
  DIRECTIONS.EAST,
  DIRECTIONS.WEST,
];

function posAdd(pos, offset) {
  return { x: pos.x + offset.x, y: pos.y + offset.y, z: pos.z + offset.z };
}

function facingFromViewDirection(viewDir) {
  if (Math.abs(viewDir.x) > Math.abs(viewDir.z)) {
    return viewDir.x > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
  }
  return viewDir.z > 0 ? DIRECTIONS.SOUTH : DIRECTIONS.NORTH;
}

export class HingePlacementHandler {
  constructor(manager) {
    this._manager = manager;
  }

  register() {
    world.afterEvents.playerPlaceBlock.subscribe((event) => {
      if (event.block.typeId !== HINGE_BLOCK_ID) return;
      this.onPlace(event.block, event.player, event.block.dimension);
    });
  }

  onPlace(block, player, dimension) {
    const pos = block.location;
    const viewDir = player.getViewDirection();
    const facing = facingFromViewDirection(viewDir);

    block.setPermutation(
      BlockPermutation.resolve(HINGE_BLOCK_ID, {
        "bigdoors:facing": facing,
        "bigdoors:mode": "horizontal",
        "bigdoors:door_side": "none",
      })
    );

    let assembly = this._mergeWithAdjacentHinge(pos, dimension);
    if (!assembly) {
      assembly = this._manager.createAssembly(pos, facing, "horizontal");
    }

    const doubleDoorResult = this._detectDoubleDoor(assembly, pos, dimension);
    if (doubleDoorResult) {
      const { otherAssembly, doorSide } = doubleDoorResult;
      this._manager.setDoorSide(assembly.id, doorSide);

      block.setPermutation(
        BlockPermutation.resolve(HINGE_BLOCK_ID, {
          "bigdoors:facing": facing,
          "bigdoors:mode": "horizontal",
          "bigdoors:door_side": doorSide,
        })
      );

      this._manager.pairAndSplitAssemblies(assembly.id, otherAssembly.id);
    }
  }

  _mergeWithAdjacentHinge(pos, dimension) {
    for (const dy of [1, -1]) {
      const neighborPos = { x: pos.x, y: pos.y + dy, z: pos.z };
      const neighborBlock = dimension.getBlock(neighborPos);
      if (neighborBlock && neighborBlock.typeId === HINGE_BLOCK_ID) {
        const existing = this._manager.findByPosition(neighborPos);
        if (existing) {
          this._manager.addHingeToAssembly(existing.id, pos);
          return existing;
        }
      }
    }
    return null;
  }

  _detectDoubleDoor(newAssembly, hingePos, dimension) {
    for (const dir of HORIZONTAL_DIRS) {
      const offset = DIR_OFFSETS[dir];
      const neighborPos = posAdd(hingePos, offset);
      const neighborBlock = dimension.getBlock(neighborPos);
      if (!neighborBlock || neighborBlock.typeId !== PANEL_BLOCK_ID) continue;

      const otherAssembly = this._manager.findByPosition(neighborPos);
      if (!otherAssembly || otherAssembly.id === newAssembly.id) continue;
      if (otherAssembly.partnerAssemblyId) continue;
      if (!otherAssembly.doorSide) continue;
      if (otherAssembly.doorSide !== OPPOSITE_DIR[dir]) continue;

      return { otherAssembly, doorSide: dir };
    }
    return null;
  }

}
