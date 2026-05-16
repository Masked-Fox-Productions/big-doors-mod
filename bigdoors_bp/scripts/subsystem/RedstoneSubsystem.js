import { BlockPermutation, ItemStack, system } from "@minecraft/server";
import { PANEL_BLOCK_ID, HINGE_BLOCK_ID, REDSTONE_DEBOUNCE_TICKS } from "../util/Constants.js";
import { materialToBlockStates } from "../domain/MaterialRegistry.js";
import { checkPath } from "../domain/ObstructionChecker.js";
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

    console.warn(`[redstone] event: typeId=${block.typeId} pos=(${loc.x},${loc.y},${loc.z}) power=${powerLevel} assembly=${assembly.id} isOpen=${assembly.isOpen}`);

    if (powerLevel > 0 && !assembly.isOpen) {
      console.warn(`[redstone]   -> OPENING door`);
      this._manager.setRedstoneDebounce(assembly.id, now + REDSTONE_DEBOUNCE_TICKS);
      this._openWithRedstone(assembly, block.dimension, block);
    } else if (powerLevel === 0 && assembly.isOpen) {
      this._scheduleCloseCheck(assembly, block.dimension);
    }
  }

  _scheduleCloseCheck(assembly, dimension) {
    const now = system.currentTick;
    if (this._manager.isRedstoneDebounced(assembly.id, now)) return;

    this._manager.setRedstoneDebounce(assembly.id, now + REDSTONE_DEBOUNCE_TICKS);
    const assemblyId = assembly.id;

    system.runTimeout(() => {
      const asm = this._manager.getAssembly(assemblyId);
      if (!asm || !asm.isOpen) return;

      // Check if ANY block in the assembly (hinges + current panel positions) still has power
      const allPositions = [...asm.hingePositions, ...asm.getAllCurrentPositions()];
      let stillPowered = false;
      for (const pos of allPositions) {
        const b = dimension.getBlock(pos);
        const power = b?.getRedstonePower();
        if (power != null && power > 0) {
          stillPowered = true;
          break;
        }
      }

      console.warn(`[redstone] deferred close check: assembly=${assemblyId} stillPowered=${stillPowered}`);
      if (!stillPowered) {
        console.warn(`[redstone]   -> CLOSING door (confirmed no power)`);
        this._manager.setRedstoneDebounce(assemblyId, system.currentTick + REDSTONE_DEBOUNCE_TICKS);
        this._closeWithRedstone(asm, dimension);
      }
    }, REDSTONE_DEBOUNCE_TICKS);
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

    if (assembly.partnerAssemblyId) {
      const partner = this._manager.getAssembly(assembly.partnerAssemblyId);
      if (partner && !partner.isOpen) {
        this._manager.setRedstoneDebounce(partner.id, system.currentTick + REDSTONE_DEBOUNCE_TICKS);
        const mirrorDir = direction === "cw" ? "ccw" : "cw";
        this._openSingleAssembly(partner, mirrorDir, dimension);
      }
    }
  }

  _preferredDirectionFromSignal(assembly, panelPositions, hingePos, signalBlock, dimension) {
    const loc = signalBlock.location;
    let sourcePos = loc;

    for (const off of NEIGHBOR_OFFSETS) {
      const neighborPos = { x: loc.x + off.x, y: loc.y + off.y, z: loc.z + off.z };
      const nb = dimension.getBlock(neighborPos);
      if (!nb) continue;
      if (nb.typeId === HINGE_BLOCK_ID || nb.typeId === PANEL_BLOCK_ID) continue;
      const power = nb.getRedstonePower();
      if (power != null && power > 0) {
        sourcePos = neighborPos;
        break;
      }
    }

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
      materialIndex: panel.materialIndex,
    }));

    for (const t of tuples) {
      const b = dimension.getBlock(t.source);
      if (b) b.setType("minecraft:air");
    }
    for (const t of tuples) {
      const b = dimension.getBlock(t.dest);
      if (b) {
        b.setPermutation(
          BlockPermutation.resolve(PANEL_BLOCK_ID, materialToBlockStates(t.materialIndex))
        );
      }
    }

    this._manager.openDoor(assembly.id, direction, newPositions);
  }

  _closeWithRedstone(assembly, dimension) {
    this._closeSingleAssembly(assembly, dimension);

    if (assembly.partnerAssemblyId) {
      const partner = this._manager.getAssembly(assembly.partnerAssemblyId);
      if (partner && partner.isOpen) {
        this._manager.setRedstoneDebounce(partner.id, system.currentTick + REDSTONE_DEBOUNCE_TICKS);
        this._closeSingleAssembly(partner, dimension);
      }
    }
  }

  _closeSingleAssembly(assembly, dimension) {
    const tuples = assembly.panelPositions.map(panel => ({
      source: panel.currentPos,
      dest: panel.closedPos,
      materialIndex: panel.materialIndex,
    }));

    for (const t of tuples) {
      const b = dimension.getBlock(t.source);
      if (b) b.setType("minecraft:air");
    }
    for (const t of tuples) {
      const b = dimension.getBlock(t.dest);
      if (b) {
        b.setPermutation(
          BlockPermutation.resolve(PANEL_BLOCK_ID, materialToBlockStates(t.materialIndex))
        );
      }
    }

    this._manager.closeDoor(assembly.id);
  }
}
