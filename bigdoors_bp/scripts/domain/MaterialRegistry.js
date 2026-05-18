import {
  MATERIAL_INDEX,
  MATERIAL_GEOMETRY_CLASS,
  GEOMETRY_CLASS_FENCE,
  GEOMETRY_CLASS_BARS,
  GEOMETRY_CLASS_PANE,
  DIR_OFFSETS,
  panelBlockIdForGeoClass,
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

export function panelBlockIdForMaterial(flatIndex) {
  return panelBlockIdForGeoClass(geometryClassForMaterial(flatIndex));
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

  if (geoClass === GEOMETRY_CLASS_FENCE) {
    if (hasNeighborBefore && hasNeighborAfter) return 4;
    if (hasNeighborBefore) return 2;
    if (hasNeighborAfter) return 3;
    return 1;
  }

  if (geoClass === GEOMETRY_CLASS_BARS) {
    if (hasNeighborBefore && hasNeighborAfter) return 5;
    if (hasNeighborBefore) return 10;
    if (hasNeighborAfter) return 11;
    return 9;
  }

  if (geoClass === GEOMETRY_CLASS_PANE) {
    if (hasNeighborBefore && hasNeighborAfter) return 7;
    if (hasNeighborBefore) return 13;
    if (hasNeighborAfter) return 14;
    return 12;
  }

  return geoClass;
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
export function panelBlockStates(matIdx, geoId, rotation, overlay = 0) {
  return {
    "bigdoors:material_group": Math.floor(matIdx / 16),
    "bigdoors:material_id": matIdx % 16,
    "bigdoors:geometry_id": geoId,
    "bigdoors:panel_rotation": rotation,
    "bigdoors:overlay": overlay,
  };
}

export function hasAssemblyBlockAtClosed(assembly, pos) {
  for (const p of assembly.panelPositions) {
    const cp = p.closedPos ?? p;
    if (cp.x === pos.x && cp.y === pos.y && cp.z === pos.z) return true;
  }
  for (const hp of assembly.hingePositions ?? []) {
    if (hp.x === pos.x && hp.y === pos.y && hp.z === pos.z) return true;
  }
  return false;
}

export function resolveVerticalGeometryId(assembly, panelIndex) {
  const panel = assembly.panelPositions[panelIndex];
  const matIdx = panel.materialIndex;
  const pos = panel.closedPos ?? panel;
  const facing = assembly.facing;

  let beforeDir, afterDir;
  if (facing === "north" || facing === "south") {
    beforeDir = "west";
    afterDir = "east";
  } else {
    beforeDir = "north";
    afterDir = "south";
  }

  const bOff = DIR_OFFSETS[beforeDir];
  const aOff = DIR_OFFSETS[afterDir];
  const beforePos = { x: pos.x + bOff.x, y: pos.y + bOff.y, z: pos.z + bOff.z };
  const afterPos = { x: pos.x + aOff.x, y: pos.y + aOff.y, z: pos.z + aOff.z };

  const hasNeighborBefore = hasAssemblyBlockAtClosed(assembly, beforePos);
  const hasNeighborAfter = hasAssemblyBlockAtClosed(assembly, afterPos);
  return resolveGeometryId(matIdx, hasNeighborBefore, hasNeighborAfter);
}
