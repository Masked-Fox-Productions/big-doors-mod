/**
 * Pure rotation math for door panels.
 *
 * Domain layer — no @minecraft/server imports.
 *
 * Minecraft Bedrock coordinates: +X east, +Z south, +Y up.
 * Visual clockwise from above: N → E → S → W.
 *
 * Formula A (visual CW from above):
 *   newX = hinge.x - (oldZ - hinge.z)
 *   newZ = hinge.z + (oldX - hinge.x)
 *
 * Formula B (visual CCW from above):
 *   newX = hinge.x + (oldZ - hinge.z)
 *   newZ = hinge.z - (oldX - hinge.x)
 */

/**
 * Rotate a position 90 degrees clockwise (viewed from above) around the hinge.
 * Horizontal mode: rotates in the X/Z plane, Y unchanged.
 */
export function rotateCW(pos, hingePos) {
  const dx = pos.x - hingePos.x;
  const dz = pos.z - hingePos.z;
  return {
    x: Math.round(hingePos.x - dz),
    y: pos.y,
    z: Math.round(hingePos.z + dx),
  };
}

/**
 * Rotate a position 90 degrees counter-clockwise (viewed from above) around the hinge.
 * Horizontal mode: rotates in the X/Z plane, Y unchanged.
 */
export function rotateCCW(pos, hingePos) {
  const dx = pos.x - hingePos.x;
  const dz = pos.z - hingePos.z;
  return {
    x: Math.round(hingePos.x + dz),
    y: pos.y,
    z: Math.round(hingePos.z - dx),
  };
}

/**
 * Rotate a position 90 degrees clockwise in vertical mode around a horizontal axis.
 * For a hinge facing north/south: rotate in the Y/X plane (X changes, Y changes, Z unchanged).
 * For a hinge facing east/west: rotate in the Y/Z plane (Z changes, Y changes, X unchanged).
 *
 * @param {string} facing 'north'|'south'|'east'|'west'
 */
export function rotateVerticalCW(pos, hingePos, facing) {
  if (facing === "north" || facing === "south") {
    // Rotate in Y/X plane: +X maps to +Y (like CW viewed from south)
    const dx = pos.x - hingePos.x;
    const dy = pos.y - hingePos.y;
    return {
      x: Math.round(hingePos.x + dy),
      y: Math.round(hingePos.y - dx),
      z: pos.z,
    };
  }
  // east or west — rotate in Y/Z plane
  const dz = pos.z - hingePos.z;
  const dy = pos.y - hingePos.y;
  return {
    x: pos.x,
    y: Math.round(hingePos.y - dz),
    z: Math.round(hingePos.z + dy),
  };
}

/**
 * Rotate a position 90 degrees counter-clockwise in vertical mode.
 */
export function rotateVerticalCCW(pos, hingePos, facing) {
  if (facing === "north" || facing === "south") {
    const dx = pos.x - hingePos.x;
    const dy = pos.y - hingePos.y;
    return {
      x: Math.round(hingePos.x - dy),
      y: Math.round(hingePos.y + dx),
      z: pos.z,
    };
  }
  const dz = pos.z - hingePos.z;
  const dy = pos.y - hingePos.y;
  return {
    x: pos.x,
    y: Math.round(hingePos.y + dz),
    z: Math.round(hingePos.z - dy),
  };
}

/**
 * Compute intermediate arc positions between current and rotated position
 * for entity sweep purposes. Returns an array of {x,y,z} positions the
 * panel passes through during the 90-degree sweep.
 *
 * For horizontal mode, we sample at 45 degrees (midpoint of the arc).
 */
export function computeArcPositions(pos, hingePos) {
  const dx = pos.x - hingePos.x;
  const dz = pos.z - hingePos.z;

  // 45-degree rotation: cos(45°) = sin(45°) ≈ 0.7071
  const cos45 = Math.SQRT1_2;
  const sin45 = Math.SQRT1_2;

  const midX = Math.round(hingePos.x + dx * cos45 - dz * sin45);
  const midZ = Math.round(hingePos.z + dx * sin45 + dz * cos45);

  return [{ x: midX, y: pos.y, z: midZ }];
}
