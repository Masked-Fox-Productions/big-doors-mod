import { world, BlockPermutation } from "@minecraft/server";
import {
  HINGE_BLOCK_ID,
  HIDDEN_HINGE_BLOCK_ID,
  PANEL_BLOCK_ID,
  DIR_OFFSETS,
  DIRECTIONS,
  OPPOSITE_DIR,
  GEOMETRY_CLASS_FENCE,
  GEOMETRY_CLASS_SLAB,
  GEOMETRY_CLASS_BARS,
  GEOMETRY_CLASS_PANE,
  GEOMETRY_ID_SLAB_TOP,
  UNMATCHED_MATERIAL_INDEX,
} from "../util/Constants.js";
import {
  indexForTypeId,
  materialToBlockStates,
  panelBlockStates,
  resolveGeometryId,
  geometryClassForMaterial,
} from "../domain/MaterialRegistry.js";
import { closedRotation } from "../domain/PanelRotation.js";

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
        event.block.typeId === HIDDEN_HINGE_BLOCK_ID ||
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

      if (this._isHingeBlock(neighborBlock.typeId)) {
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

  _isHingeBlock(typeId) {
    return typeId === HINGE_BLOCK_ID || typeId === HIDDEN_HINGE_BLOCK_ID;
  }

  _matchesAssemblyMaterial(assembly, matIdx) {
    if (assembly.panelPositions.length === 0) return true;
    return assembly.panelPositions[0].materialIndex === matIdx;
  }

  _isCoplanar(assembly, pos) {
    const hinge = assembly.primaryHingePos;
    const side = assembly.doorSide;
    if (side === "east" || side === "west") return pos.z === hinge.z;
    if (side === "north" || side === "south") return pos.x === hinge.x;
    if (side === "up" || side === "down") {
      const facing = assembly.facing;
      if (facing === "north" || facing === "south") return pos.z === hinge.z;
      return pos.x === hinge.x;
    }
    return true;
  }

  _handleHingeNeighbor(block, pos, matIdx, hingeBlock, hingePos, dimension) {
    const assembly = this._manager.findByPosition(hingePos);
    if (!assembly) return false;

    const placedDir = directionFromTo(hingePos, pos);
    if (!placedDir) return false;

    if (assembly.doorSide) {
      if (assembly.mode === "vertical" && !VERTICAL_DIRS.has(placedDir)) return false;
      if (assembly.mode === "horizontal" && VERTICAL_DIRS.has(placedDir)) return false;
      if (!this._isCoplanar(assembly, pos)) return false;

      const wallSide = OPPOSITE_DIR[assembly.doorSide];
      if (placedDir === wallSide) return false;
    } else {
      const mode = VERTICAL_DIRS.has(placedDir) ? "vertical" : "horizontal";
      this._manager.setDoorSide(assembly.id, placedDir);
      this._manager.setMode(assembly.id, mode);

      hingeBlock.setPermutation(
        BlockPermutation.resolve(hingeBlock.typeId, {
          "bigdoors:facing": assembly.facing,
          "bigdoors:mode": mode,
          "bigdoors:door_side": placedDir,
          "bigdoors:material_group": Math.floor(UNMATCHED_MATERIAL_INDEX / 16),
          "bigdoors:material_id": UNMATCHED_MATERIAL_INDEX % 16,
        })
      );
    }

    if (placedDir !== assembly.doorSide) return false;
    if (!this._matchesAssemblyMaterial(assembly, matIdx)) return false;

    this._placePanel(block, pos, matIdx, assembly, dimension);
    if (assembly.partnerAssemblyId) {
      this._resplitPairedAssembly(assembly, dimension);
    } else {
      this._checkDoubleDoor(assembly, dimension);
    }
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

    if (!this._matchesAssemblyMaterial(assembly, matIdx)) return false;

    this._placePanel(block, pos, matIdx, assembly, dimension);
    if (assembly.partnerAssemblyId) {
      this._resplitPairedAssembly(assembly, dimension);
    } else {
      this._checkDoubleDoor(assembly, dimension);
    }
    return true;
  }

  _placePanel(block, pos, matIdx, assembly, dimension) {
    const geoClass = geometryClassForMaterial(matIdx);
    const { beforeOffset, afterOffset } = this._neighborAxes(assembly, geoClass);

    const hasNeighborBefore = this._hasAssemblyBlockAt(dimension, posAdd(pos, beforeOffset), assembly);
    const hasNeighborAfter = this._hasAssemblyBlockAt(dimension, posAdd(pos, afterOffset), assembly);

    let geoId = resolveGeometryId(matIdx, hasNeighborBefore, hasNeighborAfter);
    let storedGeoId;
    if (geoClass === GEOMETRY_CLASS_SLAB) {
      const verticalHalf = block.permutation.getState("minecraft:vertical_half");
      if (verticalHalf === "top") {
        geoId = GEOMETRY_ID_SLAB_TOP;
      }
      storedGeoId = geoId;
    }

    const overlay = assembly.hingeType === "hinge" ? 1 : 0;
    const rotation = closedRotation(assembly.doorSide, assembly.facing, geoClass);
    block.setPermutation(
      BlockPermutation.resolve(PANEL_BLOCK_ID, panelBlockStates(matIdx, geoId, rotation, overlay))
    );
    this._manager.addPanelToAssembly(assembly.id, pos, matIdx, storedGeoId, overlay);

    if (assembly.hingePositions[0].materialIndex === UNMATCHED_MATERIAL_INDEX) {
      this._manager.setHingeMaterialIndex(assembly.id, matIdx);
      this._updateHingeBlocks(assembly, dimension);
    }

    if (geoClass > 0) {
      this._updateNeighborGeometry(dimension, posAdd(pos, beforeOffset), assembly);
      this._updateNeighborGeometry(dimension, posAdd(pos, afterOffset), assembly);
    }
  }

  _updateHingeBlocks(assembly, dimension) {
    for (const hinge of assembly.hingePositions) {
      const hingeBlock = dimension.getBlock(hinge);
      if (!hingeBlock) continue;
      const blockId = hinge.type === "hidden" ? HIDDEN_HINGE_BLOCK_ID : HINGE_BLOCK_ID;
      hingeBlock.setPermutation(
        BlockPermutation.resolve(blockId, {
          "bigdoors:facing": assembly.facing,
          "bigdoors:mode": assembly.mode,
          "bigdoors:door_side": assembly.doorSide || "none",
          "bigdoors:material_group": Math.floor(hinge.materialIndex / 16),
          "bigdoors:material_id": hinge.materialIndex % 16,
        })
      );
    }
  }

  _hasAssemblyBlockAt(dimension, pos, assembly) {
    const block = dimension.getBlock(pos);
    if (!block) return false;
    if (block.typeId === PANEL_BLOCK_ID || this._isHingeBlock(block.typeId)) {
      const found = this._manager.findByPosition(pos);
      if (!found || found.id !== assembly.id) return false;
      if (found.boundaryPanels) {
        const isBoundary = found.boundaryPanels.some(
          (bp) => bp.currentPos.x === pos.x && bp.currentPos.y === pos.y && bp.currentPos.z === pos.z
        );
        if (isBoundary) return false;
      }
      return true;
    }
    return false;
  }

  _neighborAxes(assembly, geoClass) {
    const doorSide = assembly.doorSide;
    const isVertical = doorSide === "up" || doorSide === "down";

    if (isVertical && (geoClass === GEOMETRY_CLASS_FENCE || geoClass === GEOMETRY_CLASS_BARS || geoClass === GEOMETRY_CLASS_PANE)) {
      const facing = assembly.facing;
      if (facing === "north" || facing === "south") {
        return { beforeOffset: DIR_OFFSETS["west"], afterOffset: DIR_OFFSETS["east"] };
      }
      return { beforeOffset: DIR_OFFSETS["north"], afterOffset: DIR_OFFSETS["south"] };
    }

    return {
      beforeOffset: DIR_OFFSETS[OPPOSITE_DIR[doorSide]],
      afterOffset: DIR_OFFSETS[doorSide],
    };
  }


  _updateNeighborGeometry(dimension, pos, assembly) {
    const block = dimension.getBlock(pos);
    if (!block || block.typeId !== PANEL_BLOCK_ID) return;
    const found = this._manager.findByPosition(pos);
    if (!found || found.id !== assembly.id) return;

    const panel = found.panelPositions.find(
      (p) => p.currentPos.x === pos.x && p.currentPos.y === pos.y && p.currentPos.z === pos.z
    );
    if (!panel) return;

    const neighborMatIdx = panel.materialIndex;
    const neighborGeoClass = geometryClassForMaterial(neighborMatIdx);
    if (neighborGeoClass === 0) return;

    const { beforeOffset, afterOffset } = this._neighborAxes(assembly, neighborGeoClass);

    const hasBefore = this._hasAssemblyBlockAt(dimension, posAdd(pos, beforeOffset), assembly);
    const hasAfter = this._hasAssemblyBlockAt(dimension, posAdd(pos, afterOffset), assembly);

    const newGeoId = resolveGeometryId(neighborMatIdx, hasBefore, hasAfter);
    const rotation = closedRotation(assembly.doorSide, assembly.facing, neighborGeoClass);
    const overlay = panel.overlay ?? 0;
    block.setPermutation(
      BlockPermutation.resolve(PANEL_BLOCK_ID, panelBlockStates(neighborMatIdx, newGeoId, rotation, overlay))
    );
  }

  _resplitPairedAssembly(assembly, dimension) {
    const partner = this._manager.getAssembly(assembly.partnerAssemblyId);
    if (!partner) return;
    this._manager.resplitAssemblies(assembly.id, partner.id);
    this._clearBoundaryOverlays(assembly, dimension);
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

      if (this._isHingeBlock(block.typeId)) {
        const other = this._manager.findByPosition(scanPos);
        if (!other || other.id === assembly.id) break;
        if (other.partnerAssemblyId) break;
        if (other.doorSide !== OPPOSITE_DIR[assembly.doorSide]) break;

        this._manager.pairAndSplitAssemblies(assembly.id, other.id);
        this._clearBoundaryOverlays(assembly, dimension);
        return;
      }

      if (block.typeId !== PANEL_BLOCK_ID) break;
    }
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
