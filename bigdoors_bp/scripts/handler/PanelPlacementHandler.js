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
    this._checkDoubleDoor(assembly, dimension);
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
    this._checkDoubleDoor(assembly, dimension);
    return true;
  }

  _checkDoubleDoor(assembly, dimension) {
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

        this._manager.pairAssemblies(assembly.id, other.id);
        this._splitPanels(assembly, other);
        return;
      }

      if (block.typeId !== PANEL_BLOCK_ID) break;
    }
  }

  _splitPanels(assemblyA, assemblyB) {
    const hingeA = assemblyA.primaryHingePos;
    const hingeB = assemblyB.primaryHingePos;

    const allPanels = [...assemblyA.panelPositions, ...assemblyB.panelPositions];
    const seen = new Set();
    const unique = [];
    for (const p of allPanels) {
      const key = `${p.closedPos.x},${p.closedPos.y},${p.closedPos.z}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    }

    const axis = hingeA.x !== hingeB.x ? "x" : "z";
    const minVal = Math.min(hingeA[axis], hingeB[axis]);
    const maxVal = Math.max(hingeA[axis], hingeB[axis]);

    const between = unique.filter((p) => {
      const v = p.closedPos[axis];
      return v > minVal && v < maxVal;
    });

    between.sort((a, b) => a.closedPos[axis] - b.closedPos[axis]);

    const midpoint = (minVal + maxVal) / 2;

    const panelsA = [];
    const panelsB = [];

    for (const p of between) {
      const v = p.closedPos[axis];
      if (v < midpoint) panelsA.push(p);
      else if (v > midpoint) panelsB.push(p);
      // Center panel (v === midpoint) belongs to neither — remove from both
    }

    assemblyA.panelPositions = panelsA;
    assemblyB.panelPositions = panelsB;
    this._manager.save();
  }
}
