import { world, BlockPermutation } from "@minecraft/server";
import {
  HINGE_BLOCK_ID,
  PANEL_BLOCK_ID,
  DIR_OFFSETS,
  DIRECTIONS,
  OPPOSITE_DIR,
} from "../util/Constants.js";
import { indexForTypeId, materialToBlockStates, typeIdForIndex } from "../domain/MaterialRegistry.js";

const HORIZONTAL_DIRS = [
  DIRECTIONS.NORTH,
  DIRECTIONS.SOUTH,
  DIRECTIONS.EAST,
  DIRECTIONS.WEST,
];

const ALL_DIRS = [...HORIZONTAL_DIRS, "up", "down"];

const VERTICAL_DIRS = new Set(["up", "down"]);

function posAdd(pos, offset) {
  return { x: pos.x + offset.x, y: pos.y + offset.y, z: pos.z + offset.z };
}

function directionFromTo(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  if (dx === 1) return DIRECTIONS.EAST;
  if (dx === -1) return DIRECTIONS.WEST;
  if (dz === 1) return DIRECTIONS.SOUTH;
  if (dz === -1) return DIRECTIONS.NORTH;
  if (dy === 1) return "up";
  if (dy === -1) return "down";
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

    for (const dir of ALL_DIRS) {
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

  _isCoplanar(assembly, pos) {
    const hinge = assembly.primaryHingePos;
    const side = assembly.doorSide;
    if (side === "east" || side === "west") return pos.z === hinge.z;
    if (side === "north" || side === "south") return pos.x === hinge.x;
    if (side === "up" || side === "down") return pos.x === hinge.x && pos.z === hinge.z;
    return true;
  }

  _handleHingeNeighbor(block, pos, matIdx, hingeBlock, hingePos, dimension) {
    const assembly = this._manager.findByPosition(hingePos);
    if (!assembly) return false;

    const placedDir = directionFromTo(hingePos, pos);
    if (!placedDir) return false;

    if (assembly.mode === "vertical" && !VERTICAL_DIRS.has(placedDir)) return false;
    if (assembly.mode === "horizontal" && VERTICAL_DIRS.has(placedDir)) return false;

    if (assembly.doorSide && !this._isCoplanar(assembly, pos)) return false;

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
      BlockPermutation.resolve(PANEL_BLOCK_ID, materialToBlockStates(matIdx))
    );
    this._manager.addPanelToAssembly(assembly.id, pos, matIdx);
    this._checkDoubleDoor(assembly, dimension);
    return true;
  }

  _handlePanelNeighbor(block, pos, matIdx, panelPos, dimension) {
    const assembly = this._manager.findByPosition(panelPos);
    if (!assembly) return false;

    if (!assembly.doorSide) return false;

    if (!this._isCoplanar(assembly, pos)) return false;

    const dirFromPanel = directionFromTo(panelPos, pos);
    if (assembly.mode === "vertical" && !VERTICAL_DIRS.has(dirFromPanel)) return false;
    if (assembly.mode === "horizontal" && VERTICAL_DIRS.has(dirFromPanel)) return false;

    const wallSide = OPPOSITE_DIR[assembly.doorSide];
    for (const hingePos of assembly.hingePositions) {
      const dirFromHinge = directionFromTo(hingePos, pos);
      if (dirFromHinge === wallSide) return false;
    }

    block.setPermutation(
      BlockPermutation.resolve(PANEL_BLOCK_ID, materialToBlockStates(matIdx))
    );
    this._manager.addPanelToAssembly(assembly.id, pos, matIdx);
    this._checkDoubleDoor(assembly, dimension);
    return true;
  }

  _checkDoubleDoor(assembly, dimension) {
    if (assembly.mode === "vertical") return;
    if (!assembly.doorSide || assembly.partnerAssemblyId) return;

    const doorSideOffset = DIR_OFFSETS[assembly.doorSide];
    const hingePos = assembly.primaryHingePos;

    for (let dist = 1; dist <= 16; dist++) {
      const scanPos = {
        x: hingePos.x + doorSideOffset.x * dist,
        y: hingePos.y,
        z: hingePos.z + doorSideOffset.z * dist,
      };
      const block = dimension.getBlock(scanPos);
      if (!block) break;

      if (block.typeId === HINGE_BLOCK_ID) {
        const other = this._manager.findByPosition(scanPos);
        if (!other || other.id === assembly.id) break;
        if (other.partnerAssemblyId) break;
        if (other.doorSide !== OPPOSITE_DIR[assembly.doorSide]) break;

        this._manager.pairAndSplitAssemblies(assembly.id, other.id, (pos, materialIndex) => {
          const b = dimension.getBlock(pos);
          if (!b) return;
          const vanillaId = typeIdForIndex(materialIndex);
          b.setType(vanillaId || "minecraft:air");
        });
        return;
      }

      if (block.typeId !== PANEL_BLOCK_ID) break;
    }
  }

}
