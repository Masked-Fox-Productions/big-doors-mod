import { world, BlockPermutation } from "@minecraft/server";
import {
  HINGE_BLOCK_ID,
  HIDDEN_HINGE_BLOCK_ID,
  PANEL_BLOCK_ID,
  DIR_OFFSETS,
  DIRECTIONS,
  OPPOSITE_DIR,
  UNMATCHED_MATERIAL_INDEX,
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

export class HingePlacementHandler {
  constructor(manager) {
    this._manager = manager;
  }

  register() {
    world.afterEvents.playerPlaceBlock.subscribe((event) => {
      if (event.block.typeId !== HINGE_BLOCK_ID && event.block.typeId !== HIDDEN_HINGE_BLOCK_ID) return;
      this.onPlace(event.block, event.player, event.block.dimension);
    });
  }

  _hingeTypeFromBlockId(typeId) {
    return typeId === HIDDEN_HINGE_BLOCK_ID ? "hidden" : "hinge";
  }

  _blockIdForHingeType(type) {
    return type === "hidden" ? HIDDEN_HINGE_BLOCK_ID : HINGE_BLOCK_ID;
  }

  onPlace(block, player, dimension) {
    const pos = block.location;
    const facing = block.permutation.getState("bigdoors:facing");
    const mode = block.permutation.getState("bigdoors:mode");
    const hingeType = this._hingeTypeFromBlockId(block.typeId);

    let assembly = this._mergeWithAdjacentHinge(pos, dimension, hingeType);
    if (assembly) {
      block.setPermutation(
        BlockPermutation.resolve(block.typeId, {
          "bigdoors:facing": assembly.facing,
          "bigdoors:mode": assembly.mode,
          "bigdoors:door_side": assembly.doorSide || "none",
          "bigdoors:material_group": Math.floor(UNMATCHED_MATERIAL_INDEX / 16),
          "bigdoors:material_id": UNMATCHED_MATERIAL_INDEX % 16,
        })
      );
    } else {
      assembly = this._manager.createAssembly(pos, facing, mode, hingeType);
    }

    const doubleDoorResult = this._detectDoubleDoor(assembly, pos, dimension);
    if (doubleDoorResult) {
      const { otherAssembly, doorSide } = doubleDoorResult;
      this._manager.setDoorSide(assembly.id, doorSide);

      block.setPermutation(
        BlockPermutation.resolve(block.typeId, {
          "bigdoors:facing": assembly.facing,
          "bigdoors:mode": assembly.mode,
          "bigdoors:door_side": doorSide,
          "bigdoors:material_group": Math.floor(UNMATCHED_MATERIAL_INDEX / 16),
          "bigdoors:material_id": UNMATCHED_MATERIAL_INDEX % 16,
        })
      );

      this._manager.pairAndSplitAssemblies(assembly.id, otherAssembly.id);
      this._clearBoundaryOverlays(assembly, dimension);
    }
  }

  _isHingeBlock(typeId) {
    return typeId === HINGE_BLOCK_ID || typeId === HIDDEN_HINGE_BLOCK_ID;
  }

  _mergeWithAdjacentHinge(pos, dimension, hingeType) {
    const adjacent = new Map();

    for (const dy of [1, -1]) {
      const neighborPos = { x: pos.x, y: pos.y + dy, z: pos.z };
      const neighborBlock = dimension.getBlock(neighborPos);
      if (neighborBlock && this._isHingeBlock(neighborBlock.typeId)) {
        const existing = this._manager.findByPosition(neighborPos);
        if (existing) adjacent.set(existing.id, existing);
      }
    }
    for (const dir of HORIZONTAL_DIRS) {
      const offset = DIR_OFFSETS[dir];
      const neighborPos = posAdd(pos, offset);
      const neighborBlock = dimension.getBlock(neighborPos);
      if (neighborBlock && this._isHingeBlock(neighborBlock.typeId)) {
        const existing = this._manager.findByPosition(neighborPos);
        if (existing && existing.mode === "vertical") {
          adjacent.set(existing.id, existing);
        }
      }
    }

    if (adjacent.size === 0) return null;

    const sorted = [...adjacent.values()].sort((a, b) => {
      const numA = parseInt(a.id.replace("door_", ""), 10);
      const numB = parseInt(b.id.replace("door_", ""), 10);
      return numA - numB;
    });

    const canonical = sorted[0];
    this._manager.addHingeToAssembly(canonical.id, pos, hingeType);

    if (sorted.length > 1) {
      this._manager.mergeAssemblies(canonical.id, ...sorted.slice(1).map(a => a.id));
    }

    return canonical;
  }

  _detectDoubleDoor(newAssembly, hingePos, dimension) {
    for (const dir of HORIZONTAL_DIRS) {
      const offset = DIR_OFFSETS[dir];
      const neighborPos = posAdd(hingePos, offset);
      const neighborBlock = dimension.getBlock(neighborPos);
      if (!neighborBlock || neighborBlock.typeId !== PANEL_BLOCK_ID) continue;

      const otherAssembly = this._manager.findByPosition(neighborPos);
      if (!otherAssembly || otherAssembly.id === newAssembly.id) continue;
      if (otherAssembly.mode !== newAssembly.mode) continue;
      if (otherAssembly.partnerAssemblyId) continue;
      if (!otherAssembly.doorSide) continue;
      if (otherAssembly.doorSide !== OPPOSITE_DIR[dir]) continue;

      return { otherAssembly, doorSide: dir };
    }
    return null;
  }

  _clearBoundaryOverlays(assembly, dimension) {
    for (const bp of assembly.boundaryPanels) {
      const block = dimension.getBlock(bp.currentPos);
      if (!block || block.typeId !== PANEL_BLOCK_ID) continue;
      const perm = block.permutation;
      block.setPermutation(
        BlockPermutation.resolve(PANEL_BLOCK_ID, {
          "bigdoors:material_group": perm.getState("bigdoors:material_group"),
          "bigdoors:material_id": perm.getState("bigdoors:material_id"),
          "bigdoors:geometry_id": perm.getState("bigdoors:geometry_id"),
          "bigdoors:panel_rotation": perm.getState("bigdoors:panel_rotation"),
          "bigdoors:overlay": 0,
        })
      );
    }
  }

}
