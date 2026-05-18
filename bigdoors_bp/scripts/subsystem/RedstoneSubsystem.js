import { BlockPermutation, ItemStack, system } from "@minecraft/server";
import { HINGE_BLOCK_ID, HIDDEN_HINGE_BLOCK_ID, PANEL_BLOCK_IDS, REDSTONE_DEBOUNCE_TICKS, REDSTONE_SOURCE_POLL_TICKS, DIR_OFFSETS, GEOMETRY_CLASS_FENCE, GEOMETRY_CLASS_SLAB, GEOMETRY_CLASS_BARS, GEOMETRY_CLASS_PANE } from "../util/Constants.js";
import {
  panelBlockStates,
  resolveGeometryId,
  geometryClassForMaterial,
  resolveVerticalGeometryId,
  panelBlockIdForMaterial,
} from "../domain/MaterialRegistry.js";
import { closedRotation, openRotation } from "../domain/PanelRotation.js";
import { checkPath, checkClose } from "../domain/ObstructionChecker.js";
import { getRotateFn } from "../domain/RotationMath.js";
import { sweep } from "./EntitySweeper.js";

const NEIGHBOR_OFFSETS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
];

export class RedstoneSubsystem {
  constructor(manager) {
    this._manager = manager;
    this._sourceMonitors = new Map();
  }

  handleRedstoneUpdate(event) {
    const { block, powerLevel } = event;
    const loc = block.location;
    const assembly = this._manager.findByPosition(loc);
    if (!assembly) return;

    const now = system.currentTick;
    if (this._manager.isRedstoneDebounced(assembly.id, now)) {
      return;
    }

    if (powerLevel > 0 && !assembly.isOpen) {
      this._manager.setRedstoneDebounce(assembly.id, now + REDSTONE_DEBOUNCE_TICKS);
      this._openWithRedstone(assembly, block.dimension, block);
    } else if (powerLevel > 0 && assembly.isOpen && !assembly.redstoneSource) {
      this._tryAdopt(assembly, block, block.dimension);
    }
    // powerLevel === 0 events are ignored — close is handled by the source monitor
  }

  _startSourceMonitor(assemblyId, sourcePos, dimension) {
    this._stopSourceMonitor(assemblyId);
    const handle = system.runInterval(() => {
      const asm = this._manager.getAssembly(assemblyId);
      if (!asm || !asm.redstoneSource) {
        this._stopSourceMonitor(assemblyId);
        return;
      }

      let power;
      try {
        const b = dimension.getBlock(sourcePos);
        power = b ? b.getRedstonePower() : null;
      } catch {
        return;
      }

      if (!(power != null && power > 0)) {
        const now = system.currentTick;
        if (this._manager.isRedstoneDebounced(assemblyId, now)) return;
        this._manager.setRedstoneDebounce(assemblyId, now + REDSTONE_DEBOUNCE_TICKS);

        this._closeSingleAssembly(asm, dimension);
        this._manager.clearRedstoneSource(assemblyId);
        this._stopSourceMonitor(assemblyId);

        if (asm.partnerAssemblyId) {
          const partner = this._manager.getAssembly(asm.partnerAssemblyId);
          if (partner && partner.isOpen) {
            this._manager.setRedstoneDebounce(partner.id, now + REDSTONE_DEBOUNCE_TICKS);
            this._closeSingleAssembly(partner, dimension);
            this._manager.clearRedstoneSource(partner.id);
            this._stopSourceMonitor(partner.id);
          }
        }
      }
    }, REDSTONE_SOURCE_POLL_TICKS);
    this._sourceMonitors.set(assemblyId, handle);
  }

  _stopSourceMonitor(assemblyId) {
    const handle = this._sourceMonitors.get(assemblyId);
    if (handle != null) {
      system.clearRun(handle);
      this._sourceMonitors.delete(assemblyId);
    }
  }

  _tryAdopt(assembly, signalBlock, dimension) {
    const sourcePos = this._findSourceNeighbor(signalBlock, dimension);
    if (!sourcePos) return;

    this._manager.setRedstoneSource(assembly.id, sourcePos);
    this._startSourceMonitor(assembly.id, sourcePos, dimension);

    if (assembly.partnerAssemblyId) {
      const partner = this._manager.getAssembly(assembly.partnerAssemblyId);
      if (partner && partner.isOpen) {
        this._manager.setRedstoneSource(partner.id, sourcePos);
        this._startSourceMonitor(partner.id, sourcePos, dimension);
      }
    }
  }

  restoreMonitors(dimension) {
    for (const [id] of this._sourceMonitors) {
      system.clearRun(this._sourceMonitors.get(id));
    }
    this._sourceMonitors.clear();

    for (const assembly of this._manager.getAllAssemblies()) {
      if (assembly.isOpen && assembly.redstoneSource) {
        this._startSourceMonitor(assembly.id, assembly.redstoneSource, dimension);
      }
    }
  }

  _openWithRedstone(assembly, dimension, signalBlock) {
    const panelPositions = assembly.getAllCurrentPositions();
    const hingePos = assembly.primaryHingePos;

    const blockQueryFn = (pos) => {
      const b = dimension.getBlock(pos);
      return b?.typeId ?? null;
    };

    const preferred = this._preferredDirectionFromSignal(assembly, panelPositions, hingePos, signalBlock, dimension);
    const fallback = preferred === "cw" ? "ccw" : "cw";

    let result = checkPath(panelPositions, hingePos, preferred, blockQueryFn, assembly.mode, assembly.facing);
    let direction = preferred;

    if (!result.canOpen) {
      result = checkPath(panelPositions, hingePos, fallback, blockQueryFn, assembly.mode, assembly.facing);
      direction = fallback;
    }

    if (!result.canOpen) return;

    this._executeOpen(assembly, panelPositions, hingePos, direction, result, dimension);

    const sourcePos = this._findSourceNeighbor(signalBlock, dimension);
    if (sourcePos) {
      this._manager.setRedstoneSource(assembly.id, sourcePos);
    }

    if (assembly.partnerAssemblyId) {
      const partner = this._manager.getAssembly(assembly.partnerAssemblyId);
      if (partner && !partner.isOpen) {
        this._manager.setRedstoneDebounce(partner.id, system.currentTick + REDSTONE_DEBOUNCE_TICKS);
        if (sourcePos) {
          this._manager.setRedstoneSource(partner.id, sourcePos);
        }
        const mirrorDir = direction === "cw" ? "ccw" : "cw";
        this._openSingleAssembly(partner, mirrorDir, dimension);
      }
    }

    if (sourcePos) {
      this._startSourceMonitor(assembly.id, sourcePos, dimension);
      if (assembly.partnerAssemblyId) {
        this._startSourceMonitor(assembly.partnerAssemblyId, sourcePos, dimension);
      }
    }
  }

  _findSourceNeighbor(signalBlock, dimension) {
    const loc = signalBlock.location;
    for (const off of NEIGHBOR_OFFSETS) {
      const neighborPos = { x: loc.x + off.x, y: loc.y + off.y, z: loc.z + off.z };
      const nb = dimension.getBlock(neighborPos);
      if (!nb) continue;
      if (nb.typeId === HINGE_BLOCK_ID || nb.typeId === HIDDEN_HINGE_BLOCK_ID || PANEL_BLOCK_IDS.has(nb.typeId)) continue;
      const power = nb.getRedstonePower();
      if (power != null && power > 0) {
        return neighborPos;
      }
    }
    return null;
  }

  _preferredDirectionFromSignal(assembly, panelPositions, hingePos, signalBlock, dimension) {
    const sourcePos = this._findSourceNeighbor(signalBlock, dimension) ?? signalBlock.location;

    const cwFn = getRotateFn(assembly.mode, assembly.facing, "cw");
    const ccwFn = getRotateFn(assembly.mode, assembly.facing, "ccw");
    const cwDests = panelPositions.map((p) => cwFn(p, hingePos));
    const ccwDests = panelPositions.map((p) => ccwFn(p, hingePos));

    let cwDist = 0;
    let ccwDist = 0;

    for (const d of cwDests) {
      cwDist += Math.abs(d.x - sourcePos.x) + Math.abs(d.y - sourcePos.y) + Math.abs(d.z - sourcePos.z);
    }
    for (const d of ccwDests) {
      ccwDist += Math.abs(d.x - sourcePos.x) + Math.abs(d.y - sourcePos.y) + Math.abs(d.z - sourcePos.z);
    }

    return cwDist >= ccwDist ? "cw" : "ccw";
  }

  _openSingleAssembly(assembly, direction, dimension) {
    const panelPositions = assembly.getAllCurrentPositions();
    const hingePos = assembly.primaryHingePos;
    const blockQueryFn = (pos) => dimension.getBlock(pos)?.typeId ?? null;

    const result = checkPath(panelPositions, hingePos, direction, blockQueryFn, assembly.mode, assembly.facing);
    if (!result.canOpen) return;

    this._executeOpen(assembly, panelPositions, hingePos, direction, result, dimension);
  }

  _executeOpen(assembly, panelPositions, hingePos, direction, result, dimension) {
    const rotateFn = getRotateFn(assembly.mode, assembly.facing, direction);
    const newPositions = panelPositions.map(pos => rotateFn(pos, hingePos));

    for (const dest of newPositions) {
      if (!dimension.getBlock(dest)) return;
    }

    for (const pos of result.softBlocks) {
      const b = dimension.getBlock(pos);
      if (b) b.setType("minecraft:air");
    }
    for (const pos of result.passableBlocks) {
      const b = dimension.getBlock(pos);
      if (b) {
        try {
          dimension.spawnItem(new ItemStack(b.typeId, 1), pos);
        } catch { /* may not be available */ }
        b.setType("minecraft:air");
      }
    }

    sweep(dimension, newPositions, panelPositions, hingePos);

    const tuples = assembly.panelPositions.map((panel, i) => ({
      source: panelPositions[i],
      dest: newPositions[i],
      blockId: panelBlockIdForMaterial(panel.materialIndex),
      states: this._panelStates(assembly, i, true, direction),
    }));

    for (const t of tuples) {
      const b = dimension.getBlock(t.source);
      if (b) b.setType("minecraft:air");
    }
    for (const t of tuples) {
      const b = dimension.getBlock(t.dest);
      if (b) {
        b.setPermutation(BlockPermutation.resolve(t.blockId, t.states));
      }
    }

    this._manager.openDoor(assembly.id, direction, newPositions);
  }

  _closeSingleAssembly(assembly, dimension) {
    const closedPositions = assembly.panelPositions.map((p) => p.closedPos);
    const currentPositions = assembly.panelPositions.map((p) => p.currentPos);

    // Validate all closed positions are loaded
    for (const pos of closedPositions) {
      if (dimension.getBlock(pos) == null) return false;
    }

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

    const tuples = assembly.panelPositions.map((panel, i) => ({
      source: panel.currentPos,
      dest: panel.closedPos,
      blockId: panelBlockIdForMaterial(panel.materialIndex),
      states: this._panelStates(assembly, i, false, null),
    }));

    for (const t of tuples) {
      const b = dimension.getBlock(t.source);
      if (b) b.setType("minecraft:air");
    }
    for (const t of tuples) {
      const b = dimension.getBlock(t.dest);
      if (b) {
        b.setPermutation(BlockPermutation.resolve(t.blockId, t.states));
      }
    }

    this._manager.closeDoor(assembly.id);
    return true;
  }

  _panelStates(assembly, panelIndex, isOpen, direction) {
    const panel = assembly.panelPositions[panelIndex];
    const matIdx = panel.materialIndex;
    const geoClass = geometryClassForMaterial(matIdx);

    let geoId;
    if (geoClass === 0) {
      geoId = 0;
    } else if (geoClass === GEOMETRY_CLASS_SLAB && panel.geometryId !== undefined) {
      geoId = panel.geometryId;
    } else if (assembly.mode === "vertical" && (geoClass === GEOMETRY_CLASS_FENCE || geoClass === GEOMETRY_CLASS_BARS || geoClass === GEOMETRY_CLASS_PANE)) {
      geoId = resolveVerticalGeometryId(assembly, panelIndex);
    } else {
      const hasNeighborBefore = true;
      const hasNeighborAfter = panelIndex < assembly.panelPositions.length - 1;
      geoId = resolveGeometryId(matIdx, hasNeighborBefore, hasNeighborAfter);
    }

    const rotation = isOpen
      ? openRotation(assembly.mode, assembly.doorSide, assembly.facing, direction, geoClass)
      : closedRotation(assembly.doorSide, assembly.facing, geoClass);
    return panelBlockStates(matIdx, geoId, rotation, panel.overlay ?? 0);
  }

}
