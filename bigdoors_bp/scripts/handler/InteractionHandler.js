import { BlockPermutation, ItemStack, system } from "@minecraft/server";
import { getRotateFn } from "../domain/RotationMath.js";
import { checkPath, checkClose } from "../domain/ObstructionChecker.js";
import { sweep } from "../subsystem/EntitySweeper.js";
import { REDSTONE_DEBOUNCE_TICKS, DIR_OFFSETS, OPPOSITE_DIR, GEOMETRY_CLASS_FENCE, GEOMETRY_CLASS_SLAB, GEOMETRY_CLASS_BARS, GEOMETRY_CLASS_PANE } from "../util/Constants.js";
import {
  materialToBlockStates,
  panelBlockStates,
  resolveGeometryId,
  geometryClassForMaterial,
  resolveVerticalGeometryId,
  panelBlockIdForMaterial,
} from "../domain/MaterialRegistry.js";
import { closedRotation, openRotation } from "../domain/PanelRotation.js";

function posAdd(pos, offset) {
  return { x: pos.x + offset.x, y: pos.y + offset.y, z: pos.z + offset.z };
}

export class InteractionHandler {
  constructor(manager) {
    this._manager = manager;
  }

  handleInteract(block, player, dimension) {
    const assembly = this._manager.findByPosition(block.location);
    if (!assembly) return;
    if (assembly.panelPositions.length === 0) return;

    const now = system.currentTick;
    this._manager.setRedstoneDebounce(assembly.id, now + REDSTONE_DEBOUNCE_TICKS);
    if (assembly.partnerAssemblyId) {
      this._manager.setRedstoneDebounce(assembly.partnerAssemblyId, now + REDSTONE_DEBOUNCE_TICKS);
    }

    if (!assembly.isOpen) {
      this._tryOpen(assembly, player, dimension);
      this._tryOpenPartner(assembly, dimension);
    } else {
      this._close(assembly, dimension);
      this._tryClosePartner(assembly, dimension);
    }
  }

  _tryOpenPartner(assembly, dimension) {
    if (!assembly.isOpen || !assembly.partnerAssemblyId) return;
    const partner = this._manager.getAssembly(assembly.partnerAssemblyId);
    if (!partner || partner.isOpen || partner.panelPositions.length === 0) return;

    const mirrorDir = assembly.openDirection === "cw" ? "ccw" : "cw";
    const hingePos = partner.primaryHingePos;
    const panelPositions = partner.getAllCurrentPositions();

    this._attemptOpen(partner, panelPositions, hingePos, mirrorDir, dimension);
  }

  _tryClosePartner(assembly, dimension) {
    if (!assembly.partnerAssemblyId) return;
    const partner = this._manager.getAssembly(assembly.partnerAssemblyId);
    if (!partner || !partner.isOpen) return;

    this._close(partner, dimension);
  }

  _tryOpen(assembly, player, dimension) {
    const hingePos = assembly.primaryHingePos;
    const panelPositions = assembly.getAllCurrentPositions();

    const preferred = this._preferredDirection(assembly, panelPositions, hingePos, player);
    const fallback = preferred === "cw" ? "ccw" : "cw";

    const result = this._attemptOpen(assembly, panelPositions, hingePos, preferred, dimension);
    if (result) return;

    this._attemptOpen(assembly, panelPositions, hingePos, fallback, dimension);
  }

  _preferredDirection(assembly, panelPositions, hingePos, player) {
    if (!player || !player.location) return "cw";

    const cwFn = getRotateFn(assembly.mode, assembly.facing, "cw");
    const ccwFn = getRotateFn(assembly.mode, assembly.facing, "ccw");
    const cwDests = panelPositions.map((p) => cwFn(p, hingePos));
    const ccwDests = panelPositions.map((p) => ccwFn(p, hingePos));

    const playerPos = player.location;
    let cwDist = 0;
    let ccwDist = 0;

    for (const d of cwDests) {
      cwDist += Math.abs(d.x - playerPos.x) + Math.abs(d.y - playerPos.y) + Math.abs(d.z - playerPos.z);
    }
    for (const d of ccwDests) {
      ccwDist += Math.abs(d.x - playerPos.x) + Math.abs(d.y - playerPos.y) + Math.abs(d.z - playerPos.z);
    }

    return cwDist >= ccwDist ? "cw" : "ccw";
  }

  _attemptOpen(assembly, panelPositions, hingePos, direction, dimension) {
    const blockQueryFn = (pos) => {
      const b = dimension.getBlock(pos);
      return b?.typeId ?? null;
    };

    const result = checkPath(panelPositions, hingePos, direction, blockQueryFn, assembly.mode, assembly.facing);
    if (!result.canOpen) return false;

    const rotateFn = getRotateFn(assembly.mode, assembly.facing, direction);
    const destinations = panelPositions.map((p) => rotateFn(p, hingePos));

    // Validate all destinations are in loaded chunks
    for (const dest of destinations) {
      const b = dimension.getBlock(dest);
      if (b == null) return false;
    }

    // Destroy soft blocks (no drops)
    for (const pos of result.softBlocks) {
      const b = dimension.getBlock(pos);
      if (b) b.setType("minecraft:air");
    }

    // Destroy passable blocks (with drops)
    for (const pos of result.passableBlocks) {
      const b = dimension.getBlock(pos);
      if (b) {
        try {
          dimension.spawnItem(new ItemStack(b.typeId, 1), pos);
        } catch {
          // spawnItem may not be available in all contexts
        }
        b.setType("minecraft:air");
      }
    }

    // Sweep entities
    sweep(dimension, destinations, panelPositions, hingePos);

    // Three-phase block movement
    const tuples = [];
    for (let i = 0; i < panelPositions.length; i++) {
      const panel = assembly.panelPositions[i];
      const matIdx = panel.materialIndex;
      const geoClass = geometryClassForMaterial(matIdx);
      const geoId = this._resolveGeoForPanel(assembly, i, true);
      const rotation = openRotation(assembly.mode, assembly.doorSide, assembly.facing, direction, geoClass);
      tuples.push({
        source: panelPositions[i],
        dest: destinations[i],
        blockId: panelBlockIdForMaterial(matIdx),
        states: panelBlockStates(matIdx, geoId, rotation, panel.overlay ?? 0),
      });
    }

    // Phase 1: Clear sources
    for (const t of tuples) {
      const b = dimension.getBlock(t.source);
      if (b) b.setType("minecraft:air");
    }

    // Phase 2: Place destinations
    for (const t of tuples) {
      const b = dimension.getBlock(t.dest);
      if (b) {
        b.setPermutation(BlockPermutation.resolve(t.blockId, t.states));
      }
    }

    // Update manager state
    this._manager.openDoor(assembly.id, direction, destinations);
    return true;
  }

  _close(assembly, dimension) {
    const currentPositions = assembly.getAllCurrentPositions();
    const closedPositions = assembly.panelPositions.map((p) => p.closedPos);

    // Validate all closed positions are loaded
    for (const pos of closedPositions) {
      if (dimension.getBlock(pos) == null) return false;
    }

    // Build exclusion set from current (open) positions being vacated
    const currentPosSet = new Set(
      currentPositions.map((p) => `${p.x},${p.y},${p.z}`)
    );

    const blockQueryFn = (pos) => {
      const b = dimension.getBlock(pos);
      return b?.typeId ?? null;
    };

    const result = checkClose(closedPositions, currentPosSet, blockQueryFn);
    if (!result.canClose) return false;

    // Destroy soft blocks (no drops)
    for (const pos of result.softBlocks) {
      const b = dimension.getBlock(pos);
      if (b) b.setType("minecraft:air");
    }

    // Destroy passable blocks (with drops)
    for (const pos of result.passableBlocks) {
      const b = dimension.getBlock(pos);
      if (b) {
        try {
          dimension.spawnItem(new ItemStack(b.typeId, 1), pos);
        } catch {
          // spawnItem may not be available in all contexts
        }
        b.setType("minecraft:air");
      }
    }

    const tuples = [];
    for (let i = 0; i < currentPositions.length; i++) {
      const panel = assembly.panelPositions[i];
      const matIdx = panel.materialIndex;
      const geoClass = geometryClassForMaterial(matIdx);
      const geoId = this._resolveGeoForPanel(assembly, i, false);
      const rotation = closedRotation(assembly.doorSide, assembly.facing, geoClass);
      tuples.push({
        source: currentPositions[i],
        dest: closedPositions[i],
        blockId: panelBlockIdForMaterial(matIdx),
        states: panelBlockStates(matIdx, geoId, rotation, panel.overlay ?? 0),
      });
    }

    // Phase 1: Clear sources
    for (const t of tuples) {
      const b = dimension.getBlock(t.source);
      if (b) b.setType("minecraft:air");
    }

    // Phase 2: Place destinations
    for (const t of tuples) {
      const b = dimension.getBlock(t.dest);
      if (b) {
        b.setPermutation(BlockPermutation.resolve(t.blockId, t.states));
      }
    }

    this._manager.closeDoor(assembly.id);
    this._manager.clearRedstoneSource(assembly.id);
    return true;
  }

  _resolveGeoForPanel(assembly, panelIndex, isOpen) {
    const panel = assembly.panelPositions[panelIndex];
    const matIdx = panel.materialIndex;
    const geoClass = geometryClassForMaterial(matIdx);
    if (geoClass === 0) return 0;

    if (geoClass === GEOMETRY_CLASS_SLAB && panel.geometryId !== undefined) {
      return panel.geometryId;
    }

    if (assembly.mode === "vertical" && (geoClass === GEOMETRY_CLASS_FENCE || geoClass === GEOMETRY_CLASS_BARS || geoClass === GEOMETRY_CLASS_PANE)) {
      return resolveVerticalGeometryId(assembly, panelIndex);
    }

    const hasNeighborBefore = true;
    const hasNeighborAfter = panelIndex < assembly.panelPositions.length - 1;
    return resolveGeometryId(matIdx, hasNeighborBefore, hasNeighborAfter);
  }

}
