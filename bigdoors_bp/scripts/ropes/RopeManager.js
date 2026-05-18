import { world } from "@minecraft/server";
import { RopeChain } from "./domain/RopeChain.js";
import { ROPES_PERSISTENCE_KEY } from "./util/RopeConstants.js";
import { ropePosKey } from "./util/ropePosKey.js";

export class RopeManager {
  constructor() {
    this._chains = new Map();
    this._positionIndex = new Map();
    this._supportIndex = new Map();
    this._loaded = false;
    this._nextId = 1;
  }

  load() {
    if (this._loaded) return;

    const raw = world.getDynamicProperty(ROPES_PERSISTENCE_KEY);
    if (raw == null) {
      this._loaded = true;
      return;
    }

    const data = JSON.parse(raw);
    for (const entry of data) {
      const chain = RopeChain.fromJSON(entry);
      this._chains.set(chain.id, chain);

      for (const pos of chain.getAllPositions()) {
        this._positionIndex.set(ropePosKey(chain.dimensionId, pos), chain.id);
      }

      this._indexSupport(chain);

      const numPart = parseInt(chain.id.replace("rope_", ""), 10);
      if (!isNaN(numPart) && numPart >= this._nextId) {
        this._nextId = numPart + 1;
      }
    }

    this._loaded = true;
  }

  save() {
    try {
      const data = [];
      for (const chain of this._chains.values()) {
        data.push(chain.toJSON());
      }
      world.setDynamicProperty(ROPES_PERSISTENCE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn(`[ropes] Failed to save state: ${err.message}`);
    }
  }

  createChain(type, dimensionId, anchorPos, anchorFace, initialSegments = 0) {
    const id = `rope_${this._nextId++}`;
    const chain = new RopeChain(id, type, dimensionId, anchorPos, anchorFace, initialSegments);
    this._chains.set(id, chain);
    this._positionIndex.set(ropePosKey(dimensionId, anchorPos), id);
    this._indexSupport(chain);
    this.save();
    return chain;
  }

  removeChain(chainId) {
    const chain = this._chains.get(chainId);
    if (!chain) return;

    for (const pos of chain.getAllPositions()) {
      this._positionIndex.delete(ropePosKey(chain.dimensionId, pos));
    }
    this._removeSupport(chain);
    this._chains.delete(chainId);
    this.save();
  }

  getChainAtPosition(dimensionId, pos) {
    const key = ropePosKey(dimensionId, pos);
    const id = this._positionIndex.get(key);
    if (id == null) return null;
    return this._chains.get(id) ?? null;
  }

  getChain(chainId) {
    return this._chains.get(chainId) ?? null;
  }

  getAllChains() {
    return this._chains.values();
  }

  addSegmentPosition(chainId, dimensionId, pos) {
    this._positionIndex.set(ropePosKey(dimensionId, pos), chainId);
  }

  removeSegmentPosition(dimensionId, pos) {
    this._positionIndex.delete(ropePosKey(dimensionId, pos));
  }

  addSupportBlock(dimensionId, supportPos, chainId) {
    const key = ropePosKey(dimensionId, supportPos);
    let set = this._supportIndex.get(key);
    if (!set) {
      set = new Set();
      this._supportIndex.set(key, set);
    }
    set.add(chainId);
  }

  removeSupportBlock(dimensionId, supportPos, chainId) {
    const key = ropePosKey(dimensionId, supportPos);
    const set = this._supportIndex.get(key);
    if (!set) return;
    set.delete(chainId);
    if (set.size === 0) {
      this._supportIndex.delete(key);
    }
  }

  getChainsForSupportBlock(dimensionId, pos) {
    const key = ropePosKey(dimensionId, pos);
    return this._supportIndex.get(key) ?? null;
  }

  _indexSupport(chain) {
    const face = chain.anchorFace;
    const anchor = chain.anchorPos;
    const offsets = {
      up: { x: 0, y: 1, z: 0 },
      down: { x: 0, y: -1, z: 0 },
      north: { x: 0, y: 0, z: -1 },
      south: { x: 0, y: 0, z: 1 },
      east: { x: 1, y: 0, z: 0 },
      west: { x: -1, y: 0, z: 0 },
    };
    const off = offsets[face];
    if (!off) return;
    const supportPos = { x: anchor.x + off.x, y: anchor.y + off.y, z: anchor.z + off.z };
    this.addSupportBlock(chain.dimensionId, supportPos, chain.id);
  }

  _removeSupport(chain) {
    const face = chain.anchorFace;
    const anchor = chain.anchorPos;
    const offsets = {
      up: { x: 0, y: 1, z: 0 },
      down: { x: 0, y: -1, z: 0 },
      north: { x: 0, y: 0, z: -1 },
      south: { x: 0, y: 0, z: 1 },
      east: { x: 1, y: 0, z: 0 },
      west: { x: -1, y: 0, z: 0 },
    };
    const off = offsets[face];
    if (!off) return;
    const supportPos = { x: anchor.x + off.x, y: anchor.y + off.y, z: anchor.z + off.z };
    this.removeSupportBlock(chain.dimensionId, supportPos, chain.id);
  }
}
