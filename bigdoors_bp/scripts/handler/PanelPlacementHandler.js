import { world, BlockPermutation } from "@minecraft/server";
import {
  HINGE_BLOCK_ID,
  PANEL_BLOCK_ID,
  DIR_OFFSETS,
  DIRECTIONS,
  OPPOSITE_DIR,
} from "../util/Constants.js";
import { indexForTypeId } from "../domain/MaterialRegistry.js";

const HORIZONTAL_DIRS = [
  DIRECTIONS.NORTH,
  DIRECTIONS.SOUTH,
  DIRECTIONS.EAST,
  DIRECTIONS.WEST,
];

function posAdd(pos, offset) {
  return { x: pos.x + offset.x, y: pos.y + offset.y, z: pos.z + offset.z };
}

function directionFromTo(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (dx === 1) return DIRECTIONS.EAST;
  if (dx === -1) return DIRECTIONS.WEST;
  if (dz === 1) return DIRECTIONS.SOUTH;
  if (dz === -1) return DIRECTIONS.NORTH;
  return null;
}

export class PanelPlacementHandler {
  constructor(manager) {
    this._manager = manager;
  }

  register() {
    world.afterEvents.playerPlaceBlock.subscribe((event) => {
      if (
        event.block.typeId === HINGE_BLOCK_ID ||
        event.block.typeId === PANEL_BLOCK_ID
      ) {
        return;
      }
      this.onPlace(event.block, event.block.dimension);
    });
  }

  onPlace(block, dimension) {
    const pos = block.location;
    const matIdx = indexForTypeId(block.typeId);
    if (matIdx < 0) return false;

    for (const dir of HORIZONTAL_DIRS) {
      const offset = DIR_OFFSETS[dir];
      const neighborPos = posAdd(pos, offset);
      const neighborBlock = dimension.getBlock(neighborPos);
      if (!neighborBlock) continue;

      if (neighborBlock.typeId === HINGE_BLOCK_ID) {
        const result = this._handleHingeNeighbor(
          block, pos, matIdx, neighborBlock, neighborPos, dimension
        );
        if (result) return true;
      }

      if (neighborBlock.typeId === PANEL_BLOCK_ID) {
        const result = this._handlePanelNeighbor(
          block, pos, matIdx, neighborPos, dimension
        );
        if (result) return true;
      }
    }

    return false;
  }

  _handleHingeNeighbor(block, pos, matIdx, hingeBlock, hingePos, dimension) {
    const assembly = this._manager.findByPosition(hingePos);
    if (!assembly) return false;

    const placedDir = directionFromTo(hingePos, pos);
    if (!placedDir) return false;

    const wallSide = OPPOSITE_DIR[assembly.doorSide];
    if (assembly.doorSide && placedDir === wallSide) return false;

    if (!assembly.doorSide) {
      this._manager.setDoorSide(assembly.id, placedDir);

      const facing = assembly.facing;
      hingeBlock.setPermutation(
        BlockPermutation.resolve(HINGE_BLOCK_ID, {
          "bigdoors:facing": facing,
          "bigdoors:mode": assembly.mode,
          "bigdoors:door_side": placedDir,
        })
      );
    }

    if (placedDir !== assembly.doorSide) return false;

    block.setPermutation(
      BlockPermutation.resolve(PANEL_BLOCK_ID, {
        "bigdoors:material": matIdx,
      })
    );
    this._manager.addPanelToAssembly(assembly.id, pos, matIdx);
    return true;
  }

  _handlePanelNeighbor(block, pos, matIdx, panelPos, dimension) {
    const assembly = this._manager.findByPosition(panelPos);
    if (!assembly) return false;

    if (!assembly.doorSide) return false;

    const wallSide = OPPOSITE_DIR[assembly.doorSide];
    for (const hingePos of assembly.hingePositions) {
      const dirFromHinge = directionFromTo(hingePos, pos);
      if (dirFromHinge === wallSide) return false;
    }

    block.setPermutation(
      BlockPermutation.resolve(PANEL_BLOCK_ID, {
        "bigdoors:material": matIdx,
      })
    );
    this._manager.addPanelToAssembly(assembly.id, pos, matIdx);
    return true;
  }
}
