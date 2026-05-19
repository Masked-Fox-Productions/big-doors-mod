import { BlockPermutation } from "../stubs/minecraft-server.mjs";

function posKey(pos) {
  return `${pos.x},${pos.y},${pos.z}`;
}

export function makeMockBlock(typeId, location, states = {}) {
  let currentPermutation = new BlockPermutation(typeId, states);
  const block = {
    typeId,
    location: { ...location },
    dimension: null,
    get permutation() {
      return currentPermutation;
    },
    setPermutation(perm) {
      currentPermutation = perm;
      block.typeId = perm.type.id;
    },
    setType(newTypeId) {
      block.typeId = newTypeId;
    },
    getRedstonePower() {
      return undefined;
    },
  };
  return block;
}

export function makeMockDimension(blockMap = new Map()) {
  const dim = {
    _blocks: blockMap,
    getBlock(pos) {
      return blockMap.get(posKey(pos)) ?? null;
    },
    playSound(_soundId, _location) {},
    setBlock(pos, block) {
      block.location = { ...pos };
      block.dimension = dim;
      blockMap.set(posKey(pos), block);
    },
  };
  for (const block of blockMap.values()) {
    block.dimension = dim;
  }
  return dim;
}

export function makeMockPlayer(viewDirection = { x: 0, y: 0, z: -1 }) {
  return {
    getViewDirection() {
      return { ...viewDirection };
    },
  };
}

export function placeBlock(dim, typeId, pos, states = {}) {
  const block = makeMockBlock(typeId, pos, states);
  dim.setBlock(pos, block);
  return block;
}
