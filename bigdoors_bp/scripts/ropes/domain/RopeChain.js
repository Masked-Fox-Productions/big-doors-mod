import { MAX_CHAIN_LENGTH } from "../util/RopeConstants.js";

export class RopeChain {
  constructor(id, type, dimensionId, anchorPos, anchorFace, initialSegments = 0) {
    this.id = id;
    this.type = type;
    this.dimensionId = dimensionId;
    this.anchorPos = { ...anchorPos };
    this.anchorFace = anchorFace;
    this.isWhipDeployed = false;
    this.deployerName = null;
    this.drops = [
      {
        coilPos: { ...anchorPos },
        remaining: initialSegments,
        segments: [],
      },
    ];
  }

  get totalSegments() {
    let total = 0;
    for (const drop of this.drops) {
      total += drop.remaining + drop.segments.length;
    }
    return total;
  }

  getDrop(index) {
    return this.drops[index] ?? null;
  }

  getDropForPosition(pos) {
    for (let i = 0; i < this.drops.length; i++) {
      const drop = this.drops[i];
      if (drop.coilPos.x === pos.x && drop.coilPos.y === pos.y && drop.coilPos.z === pos.z) {
        return { drop, dropIndex: i, isCoil: true };
      }
      for (let s = 0; s < drop.segments.length; s++) {
        const seg = drop.segments[s];
        if (seg.x === pos.x && seg.y === pos.y && seg.z === pos.z) {
          return { drop, dropIndex: i, isCoil: false, segmentIndex: s };
        }
      }
    }
    return null;
  }

  isAnchor(pos) {
    return this.anchorPos.x === pos.x && this.anchorPos.y === pos.y && this.anchorPos.z === pos.z;
  }

  isCoilPosition(pos) {
    for (const drop of this.drops) {
      if (drop.coilPos.x === pos.x && drop.coilPos.y === pos.y && drop.coilPos.z === pos.z) {
        return true;
      }
    }
    return false;
  }

  addSegments(count, dropIndex = 0) {
    const drop = this.drops[dropIndex];
    if (!drop) return 0;
    const space = MAX_CHAIN_LENGTH - this.totalSegments;
    const added = Math.min(count, space);
    drop.remaining += added;
    return added;
  }

  extendDrop(dropIndex, positions) {
    const drop = this.drops[dropIndex];
    if (!drop) return { extended: 0, remaining: 0 };
    const toExtend = Math.min(positions.length, drop.remaining);
    for (let i = 0; i < toExtend; i++) {
      drop.segments.push({ ...positions[i] });
      drop.remaining--;
    }
    return { extended: toExtend, remaining: drop.remaining };
  }

  createLedgeCoil(dropIndex, coilPos) {
    const parentDrop = this.drops[dropIndex];
    if (!parentDrop || parentDrop.remaining <= 0) return null;
    const newDrop = {
      coilPos: { ...coilPos },
      remaining: parentDrop.remaining,
      segments: [],
    };
    parentDrop.remaining = 0;
    this.drops.splice(dropIndex + 1, 0, newDrop);
    return newDrop;
  }

  retractOneFromBottom() {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (drop.segments.length > 0) {
        const removed = drop.segments.pop();
        drop.remaining++;
        if (drop.segments.length === 0 && i > 0) {
          const parent = this.drops[i - 1];
          parent.remaining += drop.remaining;
          this.drops.splice(i, 1);
          return { removed, ledgeCoilRemoved: drop.coilPos };
        }
        return { removed, ledgeCoilRemoved: null };
      }
    }
    return null;
  }

  fullRecoil() {
    const removedPositions = [];
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      for (const seg of drop.segments) {
        removedPositions.push({ ...seg });
      }
      if (i > 0) {
        removedPositions.push({ ...drop.coilPos });
      }
    }
    const total = this.totalSegments;
    this.drops = [{
      coilPos: { ...this.anchorPos },
      remaining: total,
      segments: [],
    }];
    return removedPositions;
  }

  breakAtSegment(dropIndex, segmentIndex) {
    const brokenPositions = [];
    const drop = this.drops[dropIndex];

    for (let s = segmentIndex; s < drop.segments.length; s++) {
      brokenPositions.push({ ...drop.segments[s] });
    }
    drop.segments.length = segmentIndex;

    for (let i = this.drops.length - 1; i > dropIndex; i--) {
      const d = this.drops[i];
      for (const seg of d.segments) {
        brokenPositions.push({ ...seg });
      }
      brokenPositions.push({ ...d.coilPos });
    }
    this.drops.length = dropIndex + 1;

    return brokenPositions;
  }

  breakAll() {
    const positions = [];
    for (const drop of this.drops) {
      for (const seg of drop.segments) {
        positions.push({ ...seg });
      }
      if (drop.coilPos.x !== this.anchorPos.x ||
          drop.coilPos.y !== this.anchorPos.y ||
          drop.coilPos.z !== this.anchorPos.z) {
        positions.push({ ...drop.coilPos });
      }
    }
    positions.push({ ...this.anchorPos });
    return positions;
  }

  getAllPositions() {
    const positions = [{ ...this.anchorPos }];
    for (const drop of this.drops) {
      if (drop.coilPos.x !== this.anchorPos.x ||
          drop.coilPos.y !== this.anchorPos.y ||
          drop.coilPos.z !== this.anchorPos.z) {
        positions.push({ ...drop.coilPos });
      }
      for (const seg of drop.segments) {
        positions.push({ ...seg });
      }
    }
    return positions;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      dimensionId: this.dimensionId,
      anchorPos: this.anchorPos,
      anchorFace: this.anchorFace,
      isWhipDeployed: this.isWhipDeployed,
      deployerName: this.deployerName,
      drops: this.drops.map(d => ({
        coilPos: d.coilPos,
        remaining: d.remaining,
        segments: d.segments.map(s => ({ x: s.x, y: s.y, z: s.z })),
      })),
    };
  }

  static fromJSON(json) {
    const chain = new RopeChain(
      json.id,
      json.type,
      json.dimensionId,
      json.anchorPos,
      json.anchorFace,
      0,
    );
    chain.isWhipDeployed = json.isWhipDeployed ?? false;
    chain.deployerName = json.deployerName ?? null;
    chain.drops = json.drops.map(d => ({
      coilPos: { ...d.coilPos },
      remaining: d.remaining,
      segments: d.segments.map(s => ({ x: s.x, y: s.y, z: s.z })),
    }));
    return chain;
  }
}
