import {
  MATERIAL_INDEX,
  MATERIAL_GEOMETRY_CLASS,
  GEOMETRY_CLASS_FENCE,
} from "../util/Constants.js";

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

export function geometryClassForMaterial(flatIndex) {
  return MATERIAL_GEOMETRY_CLASS.get(flatIndex) ?? 0;
}

/**
 * Resolves the specific geometry_id for a material given its neighbor context.
 * For fence-class materials: centered post unless neighbors on both sides.
 * @param {number} flatIndex - material index
 * @param {boolean} hasNeighborBefore - assembly block on the hinge side
 * @param {boolean} hasNeighborAfter - assembly block on the extension side
 */
export function resolveGeometryId(flatIndex, hasNeighborBefore, hasNeighborAfter) {
  const geoClass = MATERIAL_GEOMETRY_CLASS.get(flatIndex) ?? 0;
  if (geoClass === 0) return 0;
  if (geoClass !== GEOMETRY_CLASS_FENCE) return geoClass;

  if (hasNeighborBefore && hasNeighborAfter) return 4;  // fence_both (post + rails both ways)
  if (hasNeighborBefore) return 2;                       // fence_before (post + rails toward hinge)
  if (hasNeighborAfter) return 3;                        // fence_after (post + rails toward extension)
  return 1;                                              // fence_solo (post only)
}

export function materialToBlockStates(flatIndex, geometryId) {
  return {
    "bigdoors:material_group": Math.floor(flatIndex / 16),
    "bigdoors:material_id": flatIndex % 16,
    "bigdoors:geometry_id": geometryId ?? (MATERIAL_GEOMETRY_CLASS.get(flatIndex) ?? 0),
  };
}

export function blockStatesToMaterial(group, id) {
  return group * 16 + id;
}

/**
 * Compute the full block states for a panel including geometry and rotation.
 * @param {number} matIdx - material index
 * @param {number} geoId - resolved geometry_id
 * @param {number} rotation - panel_rotation (0-3, representing 0/90/180/270 Y degrees)
 */
export function panelBlockStates(matIdx, geoId, rotation) {
  return {
    "bigdoors:material_group": Math.floor(matIdx / 16),
    "bigdoors:material_id": matIdx % 16,
    "bigdoors:geometry_id": geoId,
    "bigdoors:panel_rotation": rotation,
  };
}
