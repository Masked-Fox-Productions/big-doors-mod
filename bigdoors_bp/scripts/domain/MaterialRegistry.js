import { MATERIAL_INDEX } from "../util/Constants.js";

/** @type {Map<string, number>} typeId → index */
const _typeIdToIndex = new Map();
MATERIAL_INDEX.forEach((typeId, index) => {
  _typeIdToIndex.set(typeId, index);
});

export function indexForTypeId(typeId) {
  const idx = _typeIdToIndex.get(typeId);
  return idx !== undefined ? idx : -1;
}

export function typeIdForIndex(index) {
  return MATERIAL_INDEX[index];
}

export function materialToBlockStates(flatIndex) {
  return {
    "bigdoors:material_group": Math.floor(flatIndex / 16),
    "bigdoors:material_id": flatIndex % 16,
  };
}

export function blockStatesToMaterial(group, id) {
  return group * 16 + id;
}
