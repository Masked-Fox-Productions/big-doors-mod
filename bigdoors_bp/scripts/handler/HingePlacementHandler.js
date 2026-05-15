import { world, BlockPermutation } from "@minecraft/server";
import {
  HINGE_BLOCK_ID,
  PANEL_BLOCK_ID,
  MAX_DOOR_SCAN_RADIUS,
  DIR_OFFSETS,
  DIRECTIONS,
  OPPOSITE_DIR,
} from "../util/Constants.js";
import { indexForTypeId, materialToBlockStates } from "../domain/MaterialRegistry.js";

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

function perpendicularDirs(dir) {
  if (dir === DIRECTIONS.NORTH || dir === DIRECTIONS.SOUTH) {
    return [DIRECTIONS.EAST, DIRECTIONS.WEST];
  }
  return [DIRECTIONS.NORTH, DIRECTIONS.SOUTH];
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

      this._manager.pairAssemblies(assembly.id, otherAssembly.id);
      this._splitPanelsBetween(assembly, otherAssembly);
      return;
    }

    const materialSides = this._detectMaterialSides(pos, dimension);

    if (materialSides.length === 1) {
      const doorSide = materialSides[0];
      this._manager.setDoorSide(assembly.id, doorSide);

      block.setPermutation(
        BlockPermutation.resolve(HINGE_BLOCK_ID, {
          "bigdoors:facing": facing,
          "bigdoors:mode": "horizontal",
          "bigdoors:door_side": doorSide,
        })
      );

      this._scanAndConvertFace(assembly, pos, doorSide, facing, dimension);
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

  _detectMaterialSides(pos, dimension) {
    const sides = [];
    for (const dir of HORIZONTAL_DIRS) {
      const offset = DIR_OFFSETS[dir];
      const neighborPos = posAdd(pos, offset);
      const neighborBlock = dimension.getBlock(neighborPos);
      if (neighborBlock && indexForTypeId(neighborBlock.typeId) >= 0) {
        sides.push(dir);
      }
    }
    return sides;
  }

  _scanAndConvertFace(assembly, hingePos, doorSide, facing, dimension) {
    const sideOffset = DIR_OFFSETS[doorSide];
    const [perpA, perpB] = perpendicularDirs(doorSide);
    const perpOffsetA = DIR_OFFSETS[perpA];
    const perpOffsetB = DIR_OFFSETS[perpB];

    for (let dy = 0; dy < MAX_DOOR_SCAN_RADIUS; dy++) {
      const columnBase = {
        x: hingePos.x + sideOffset.x,
        y: hingePos.y + dy,
        z: hingePos.z + sideOffset.z,
      };

      let columnHasBlocks = false;

      columnHasBlocks = this._convertIfMaterial(columnBase, assembly, dimension) || columnHasBlocks;

      for (const perpOffset of [perpOffsetA, perpOffsetB]) {
        for (let dist = 1; dist < MAX_DOOR_SCAN_RADIUS; dist++) {
          const scanPos = {
            x: columnBase.x + perpOffset.x * dist,
            y: columnBase.y,
            z: columnBase.z + perpOffset.z * dist,
          };
          if (!this._convertIfMaterial(scanPos, assembly, dimension)) break;
          columnHasBlocks = true;
        }
      }

      if (dy > 0 && !columnHasBlocks) break;
    }

    for (let dy = -1; dy > -MAX_DOOR_SCAN_RADIUS; dy--) {
      const columnBase = {
        x: hingePos.x + sideOffset.x,
        y: hingePos.y + dy,
        z: hingePos.z + sideOffset.z,
      };

      let columnHasBlocks = false;

      columnHasBlocks = this._convertIfMaterial(columnBase, assembly, dimension) || columnHasBlocks;

      for (const perpOffset of [perpOffsetA, perpOffsetB]) {
        for (let dist = 1; dist < MAX_DOOR_SCAN_RADIUS; dist++) {
          const scanPos = {
            x: columnBase.x + perpOffset.x * dist,
            y: columnBase.y,
            z: columnBase.z + perpOffset.z * dist,
          };
          if (!this._convertIfMaterial(scanPos, assembly, dimension)) break;
          columnHasBlocks = true;
        }
      }

      if (!columnHasBlocks) break;
    }
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

  _splitPanelsBetween(assemblyA, assemblyB) {
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
    }

    const isACloserToMin = hingeA[axis] < hingeB[axis];
    assemblyA.panelPositions = isACloserToMin ? panelsA : panelsB;
    assemblyB.panelPositions = isACloserToMin ? panelsB : panelsA;
    this._manager.save();
  }

  _convertIfMaterial(pos, assembly, dimension) {
    const block = dimension.getBlock(pos);
    if (!block) return false;

    const matIdx = indexForTypeId(block.typeId);
    if (matIdx < 0) return false;

    block.setPermutation(
      BlockPermutation.resolve(PANEL_BLOCK_ID, materialToBlockStates(matIdx))
    );
    this._manager.addPanelToAssembly(assembly.id, pos, matIdx);
    return true;
  }
}
