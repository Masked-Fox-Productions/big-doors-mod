import { ItemStack } from "@minecraft/server";
import { typeIdForIndex, blockStatesToMaterial } from "../domain/MaterialRegistry.js";
import { HINGE_BLOCK_ID, PANEL_BLOCK_ID } from "../util/Constants.js";

function isCreativeMode(player) {
  try {
    return player?.getGameMode() === "creative";
  } catch {
    return false;
  }
}

export class BreakHandler {
  constructor(manager) {
    this._manager = manager;
  }

  handlePanelBreak(event) {
    const pos = event.block.location;
    const dimension = event.block.dimension;
    const group = event.brokenBlockPermutation.getState("bigdoors:material_group");
    const id = event.brokenBlockPermutation.getState("bigdoors:material_id");
    const materialIndex = blockStatesToMaterial(group, id);
    const creative = isCreativeMode(event.player);

    const assembly = this._manager.findByPosition(pos);
    if (!assembly) return;

    this._manager.removePanelFromAssembly(assembly.id, pos);

    if (!creative) {
      const vanillaTypeId = typeIdForIndex(materialIndex);
      if (vanillaTypeId) {
        dimension.spawnItem(new ItemStack(vanillaTypeId, 1), pos);
      }
    }
  }

  handleHingeBreak(event) {
    const hingePos = event.block.location;
    const dimension = event.block.dimension;
    const creative = isCreativeMode(event.player);

    const assembly = this._manager.findByPosition(hingePos);
    if (!assembly) return;

    if (assembly.isOpen) {
      for (const panel of assembly.panelPositions) {
        const b = dimension.getBlock(panel.currentPos);
        if (b) b.setType("minecraft:air");
      }
    }

    for (const panel of assembly.panelPositions) {
      const targetPos = panel.closedPos;
      const vanillaTypeId = typeIdForIndex(panel.materialIndex);
      if (vanillaTypeId) {
        const b = dimension.getBlock(targetPos);
        if (b) b.setType(vanillaTypeId);
      }
    }

    for (const panel of assembly.boundaryPanels) {
      const vanillaTypeId = typeIdForIndex(panel.materialIndex);
      if (vanillaTypeId) {
        const b = dimension.getBlock(panel.closedPos);
        if (b) b.setType(vanillaTypeId);
      }
    }

    this._manager.dissolveAssembly(assembly.id);

    if (!creative) {
      dimension.spawnItem(new ItemStack(HINGE_BLOCK_ID, 1), hingePos);
    }
  }
}
