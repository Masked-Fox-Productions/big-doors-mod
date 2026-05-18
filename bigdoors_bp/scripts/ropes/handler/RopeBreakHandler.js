import { world, system, ItemStack } from "@minecraft/server";
import { ROPE_BLOCK_ID, ROPE_LADDER_BLOCK_ID, WHIP_ITEM_ID, BREAK_BATCH_THRESHOLD } from "../util/RopeConstants.js";

export class RopeBreakHandler {
  constructor(ropeManager) {
    this._manager = ropeManager;
  }

  register() {
    world.afterEvents.playerBreakBlock.subscribe((event) => {
      const pos = event.block.location;
      const dimId = event.block.dimension.id;
      const chainIds = this._manager.getChainsForSupportBlock(dimId, pos);
      if (!chainIds) return;
      const creative = event.player?.getGameMode?.() === "Creative";
      for (const chainId of [...chainIds]) {
        const chain = this._manager.getChain(chainId);
        if (!chain) continue;
        this._breakEntireChain(chain, event.block.dimension, creative);
      }
    });

    world.beforeEvents.playerBreakBlock.subscribe((event) => {
      const typeId = event.block.typeId;
      if (typeId !== ROPE_BLOCK_ID && typeId !== ROPE_LADDER_BLOCK_ID) return;
      const chain = this._manager.getChainAtPosition(event.block.dimension.id, event.block.location);
      if (!chain || !chain.isWhipDeployed) return;
      event.cancel = true;
      const dim = event.block.dimension;
      const creative = event.player?.getGameMode?.() === "Creative";
      system.run(() => {
        this._breakEntireChain(chain, dim, creative);
      });
    });
  }

  handleBreak(event) {
    const pos = event.block.location;
    const dimension = event.block.dimension;
    const dimId = dimension.id;

    const chain = this._manager.getChainAtPosition(dimId, pos);
    if (!chain) return;

    if (chain.isWhipDeployed) return;

    const creative = event.player?.getGameMode?.() === "Creative";

    if (chain.isAnchor(pos)) {
      this._breakEntireChain(chain, dimension, creative);
    } else {
      this._breakAtPosition(chain, pos, dimension, creative);
    }
  }

  _breakEntireChain(chain, dimension, creative) {
    const positions = chain.breakAll();
    const blockId = chain.type === "rope_ladder" ? ROPE_LADDER_BLOCK_ID : ROPE_BLOCK_ID;
    const isWhip = chain.isWhipDeployed;
    const totalStored = chain.totalSegments;

    if (positions.length > BREAK_BATCH_THRESHOLD) {
      this._batchedBreak(positions, blockId, isWhip, creative, totalStored, chain, dimension);
    } else {
      this._immediateBreak(positions, blockId, isWhip, creative, totalStored, chain, dimension);
    }
  }

  _immediateBreak(positions, blockId, isWhip, creative, totalStored, chain, dimension) {
    for (const pos of positions) {
      try {
        const b = dimension.getBlock(pos);
        if (b && b.typeId !== "minecraft:air") b.setType("minecraft:air");
      } catch { /* unloaded chunk */ }
    }

    if (!isWhip && !creative) {
      const dropCount = positions.length + totalStored;
      try {
        dimension.spawnItem(new ItemStack(blockId, dropCount), chain.anchorPos);
      } catch { /* spawn may fail */ }
    }

    if (isWhip) {
      this._returnWhip(chain, dimension);
    }

    this._manager.removeChain(chain.id);
  }

  _batchedBreak(positions, blockId, isWhip, creative, totalStored, chain, dimension) {
    const mgr = this._manager;
    const self = this;

    function* breakGenerator() {
      for (const pos of positions) {
        try {
          const b = dimension.getBlock(pos);
          if (b && b.typeId !== "minecraft:air") b.setType("minecraft:air");
        } catch { /* unloaded chunk */ }
        yield;
      }

      if (!isWhip && !creative) {
        const dropCount = positions.length + totalStored;
        try {
          dimension.spawnItem(new ItemStack(blockId, dropCount), chain.anchorPos);
        } catch { /* spawn may fail */ }
      }

      if (isWhip) {
        self._returnWhip(chain, dimension);
      }

      mgr.removeChain(chain.id);
    }

    system.runJob(breakGenerator());
  }

  _breakAtPosition(chain, pos, dimension, creative) {
    const info = chain.getDropForPosition(pos);
    if (!info) return;

    let lostRemaining = 0;
    for (let i = info.dropIndex + 1; i < chain.drops.length; i++) {
      lostRemaining += chain.drops[i].remaining;
    }

    if (info.isCoil && !chain.isAnchor(pos)) {
      lostRemaining += chain.drops[info.dropIndex].remaining;
      chain.drops[info.dropIndex].remaining = 0;
    }

    const broken = chain.breakAtSegment(
      info.dropIndex,
      info.isCoil ? 0 : info.segmentIndex,
    );

    if (info.isCoil && !chain.isAnchor(pos) && info.dropIndex > 0) {
      const drop = chain.drops[info.dropIndex];
      if (drop.segments.length === 0 && drop.remaining === 0) {
        chain.drops.splice(info.dropIndex, 1);
      }
    }

    const blockId = chain.type === "rope_ladder" ? ROPE_LADDER_BLOCK_ID : ROPE_BLOCK_ID;

    for (const bp of broken) {
      try {
        const b = dimension.getBlock(bp);
        if (b && b.typeId !== "minecraft:air") b.setType("minecraft:air");
      } catch { /* unloaded chunk */ }
    }

    if (!creative) {
      const dropCount = broken.length + lostRemaining - 1;
      if (dropCount > 0) {
        try {
          dimension.spawnItem(new ItemStack(blockId, dropCount), pos);
        } catch { /* spawn may fail */ }
      }
    }

    for (const bp of broken) {
      this._manager.removeSegmentPosition(chain.dimensionId, bp);
    }
    this._manager.removeSegmentPosition(chain.dimensionId, pos);

    this._manager.save();
  }

  _returnWhip(chain, dimension) {
    if (!chain.deployerName) return;

    try {
      const players = world.getAllPlayers();
      const deployer = players.find(p => p.name === chain.deployerName);

      if (deployer && deployer.dimension.id === chain.dimensionId) {
        const inv = deployer.getComponent("inventory")?.container;
        if (inv) {
          for (let i = 0; i < inv.size; i++) {
            if (!inv.getItem(i)) {
              inv.setItem(i, new ItemStack(WHIP_ITEM_ID, 1));
              return;
            }
          }
        }
        dimension.spawnItem(new ItemStack(WHIP_ITEM_ID, 1), deployer.location);
        return;
      }
    } catch { /* player lookup may fail */ }

    try {
      dimension.spawnItem(new ItemStack(WHIP_ITEM_ID, 1), chain.anchorPos);
    } catch { /* spawn may fail */ }
  }
}
