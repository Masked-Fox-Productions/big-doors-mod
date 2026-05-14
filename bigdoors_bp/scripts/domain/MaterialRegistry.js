/**
 * Bidirectional mapping between material index (integer) and vanilla typeId.
 *
 * Domain layer — no @minecraft/server imports.
 */

import { MATERIAL_INDEX } from "../util/Constants.js";

/** @type {Map<string, number>} typeId → index */
const _typeIdToIndex = new Map();
MATERIAL_INDEX.forEach((typeId, index) => {
  _typeIdToIndex.set(typeId, index);
});

/**
 * Return the integer index for a vanilla block typeId,
 * or -1 if the material is not supported.
 */
export function indexForTypeId(typeId) {
  const idx = _typeIdToIndex.get(typeId);
  return idx !== undefined ? idx : -1;
}

/**
 * Return the vanilla typeId for a given material index,
 * or undefined if the index is out of range.
 */
export function typeIdForIndex(index) {
  return MATERIAL_INDEX[index];
}
