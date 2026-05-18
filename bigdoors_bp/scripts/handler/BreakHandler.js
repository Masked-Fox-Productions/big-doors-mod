import { BlockPermutation, ItemStack } from "@minecraft/server";
import { typeIdForIndex, blockStatesToMaterial } from "../domain/MaterialRegistry.js";
import { HINGE_BLOCK_ID, HIDDEN_HINGE_BLOCK_ID, UNMATCHED_MATERIAL_INDEX } from "../util/Constants.js";

export class BreakHandler {
  constructor(manager) {
    this._manager = manager;
  }

  handlePanelBreak(event) {
    const pos = event.block.location;
    const dimension = event.block.dimension;
    const creative = event.player?.getGameMode() === "Creative";
    const group = event.brokenBlockPermutation.getState("bigdoors:material_group");
    const id = event.brokenBlockPermutation.getState("bigdoors:material_id");
    const materialIndex = blockStatesToMaterial(group, id);

    const assembly = this._manager.findByPosition(pos);
    if (!assembly) return;

    this._manager.removePanelFromAssembly(assembly.id, pos);

    if (assembly.panelPositions.length === 0) {
      for (const hinge of assembly.hingePositions) {
        const hBlock = dimension.getBlock(hinge);
        if (hBlock) {
          const blockId = hinge.type === "hidden" ? HIDDEN_HINGE_BLOCK_ID : HINGE_BLOCK_ID;
          hBlock.setPermutation(
            BlockPermutation.resolve(blockId, {
              "bigdoors:facing": assembly.facing,
              "bigdoors:mode": "",
              "bigdoors:door_side": "none",
              "bigdoors:material_group": Math.floor(UNMATCHED_MATERIAL_INDEX / 16),
              "bigdoors:material_id": UNMATCHED_MATERIAL_INDEX % 16,
            })
          );
        }
      }
    }

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
    const creative = event.player?.getGameMode() === "Creative";

    const assembly = this._manager.findByPosition(hingePos);
    if (!assembly) return;

    const hingeEntry = assembly.hingePositions.find(
      (h) => h.x === hingePos.x && h.y === hingePos.y && h.z === hingePos.z
    );
    const dropId = hingeEntry?.type === "hidden" ? HIDDEN_HINGE_BLOCK_ID : HINGE_BLOCK_ID;

    const result = this._manager.removeHingeFromAssembly(assembly.id, hingePos);

    if (result.status === "dissolve_required") {
      this._dissolveAssembly(result.assembly, dimension);
      this._manager.dissolveAssembly(assembly.id);
    }

    if (!creative) {
      dimension.spawnItem(new ItemStack(dropId, 1), hingePos);
    }
  }


  _dissolveAssembly(assembly, dimension) {
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
  }
}
