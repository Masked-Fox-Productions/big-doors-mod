import { BlockPermutation, ItemStack } from "@minecraft/server";
import { PANEL_BLOCK_ID } from "../util/Constants.js";
import { checkPath } from "../domain/ObstructionChecker.js";
import { rotateCW, rotateCCW } from "../domain/RotationMath.js";
import { sweep } from "./EntitySweeper.js";

export class RedstoneSubsystem {
  constructor(manager) {
    this._manager = manager;
  }

  handleRedstoneUpdate(event) {
    const { block, powerLevel } = event;
    const assembly = this._manager.findByPosition(block.location);
    if (!assembly) return;

    if (powerLevel > 0 && !assembly.isOpen) {
      this._openWithRedstone(assembly, block.dimension);
    } else if (powerLevel === 0 && assembly.isOpen) {
      this._closeWithRedstone(assembly, block.dimension);
    }
  }

  _openWithRedstone(assembly, dimension) {
    const panelPositions = assembly.getAllCurrentPositions();
    const hingePos = assembly.primaryHingePos;

    const blockQueryFn = (pos) => {
      const b = dimension.getBlock(pos);
      return b?.typeId ?? null;
    };

    let result = checkPath(panelPositions, hingePos, "cw", blockQueryFn);
    let direction = "cw";

    if (!result.canOpen) {
      result = checkPath(panelPositions, hingePos, "ccw", blockQueryFn);
      direction = "ccw";
    }

    if (!result.canOpen) return;

    this._executeOpen(assembly, panelPositions, hingePos, direction, result, dimension);

    if (assembly.partnerAssemblyId) {
      const partner = this._manager.getAssembly(assembly.partnerAssemblyId);
      if (partner && !partner.isOpen) {
        const mirrorDir = direction === "cw" ? "ccw" : "cw";
        this._openSingleAssembly(partner, mirrorDir, dimension);
      }
    }
  }

  _openSingleAssembly(assembly, direction, dimension) {
    const panelPositions = assembly.getAllCurrentPositions();
    const hingePos = assembly.primaryHingePos;
    const blockQueryFn = (pos) => dimension.getBlock(pos)?.typeId ?? null;

    const result = checkPath(panelPositions, hingePos, direction, blockQueryFn);
    if (!result.canOpen) return;

    this._executeOpen(assembly, panelPositions, hingePos, direction, result, dimension);
  }

  _executeOpen(assembly, panelPositions, hingePos, direction, result, dimension) {
    const rotateFn = direction === "cw" ? rotateCW : rotateCCW;
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
          BlockPermutation.resolve(PANEL_BLOCK_ID, { "bigdoors:material": t.materialIndex })
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
          BlockPermutation.resolve(PANEL_BLOCK_ID, { "bigdoors:material": t.materialIndex })
        );
      }
    }

    this._manager.closeDoor(assembly.id);
  }
}
