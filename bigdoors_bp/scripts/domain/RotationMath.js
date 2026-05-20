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
 * The rotation axis is perpendicular to the facing direction:
 * - Facing north/south: axis runs E/W → rotate in Y/Z plane (Y and Z change, X unchanged).
 * - Facing east/west: axis runs N/S → rotate in Y/X plane (Y and X change, Z unchanged).
 *
 * @param {string} facing 'north'|'south'|'east'|'west'
 */
export function rotateVerticalCW(pos, hingePos, facing) {
  if (facing === "north" || facing === "south") {
    const dz = pos.z - hingePos.z;
    const dy = pos.y - hingePos.y;
    return {
      x: pos.x,
      y: Math.round(hingePos.y - dz),
      z: Math.round(hingePos.z + dy),
    };
  }
  // east or west — rotate in Y/X plane
  const dx = pos.x - hingePos.x;
  const dy = pos.y - hingePos.y;
  return {
    x: Math.round(hingePos.x + dy),
    y: Math.round(hingePos.y - dx),
    z: pos.z,
  };
}

/**
 * Rotate a position 90 degrees counter-clockwise in vertical mode.
 */
export function rotateVerticalCCW(pos, hingePos, facing) {
  if (facing === "north" || facing === "south") {
    const dz = pos.z - hingePos.z;
    const dy = pos.y - hingePos.y;
    return {
      x: pos.x,
      y: Math.round(hingePos.y + dz),
      z: Math.round(hingePos.z - dy),
    };
  }
  const dx = pos.x - hingePos.x;
  const dy = pos.y - hingePos.y;
  return {
    x: Math.round(hingePos.x - dy),
    y: Math.round(hingePos.y + dx),
    z: pos.z,
  };
}

/**
 * Returns the appropriate rotation function for the given mode/facing/direction.
 * The returned function has signature (pos, hingePos) => pos.
 */
export function getRotateFn(mode, facing, direction) {
  if (mode === "vertical") {
    const vertFn = direction === "cw" ? rotateVerticalCW : rotateVerticalCCW;
    return (pos, hingePos) => vertFn(pos, hingePos, facing);
  }
  return direction === "cw" ? rotateCW : rotateCCW;
}

/**
 * Compute intermediate arc positions between current and rotated position
 * for entity sweep purposes. Returns an array of {x,y,z} positions the
 * panel passes through during the 90-degree sweep.
 *
 * @param {{x:number,y:number,z:number}} pos - panel position
 * @param {{x:number,y:number,z:number}} hingePos - hinge center
 * @param {'cw'|'ccw'} [direction='cw'] - rotation direction
 * @param {string} [mode='horizontal'] - 'horizontal' or 'vertical'
 * @param {string} [facing=''] - hinge facing for vertical mode
 */
export function computeArcPositions(pos, hingePos, direction = "cw", mode = "horizontal", facing = "") {
  const cos45 = Math.SQRT1_2;
  const sin45 = Math.SQRT1_2;
  const sign = direction === "ccw" ? -1 : 1;

  if (mode === "vertical") {
    if (facing === "north" || facing === "south") {
      const dz = pos.z - hingePos.z;
      const dy = pos.y - hingePos.y;
      return [{
        x: pos.x,
        y: Math.round(hingePos.y + dy * cos45 - sign * dz * sin45),
        z: Math.round(hingePos.z + sign * dy * sin45 + dz * cos45),
      }];
    }
    const dx = pos.x - hingePos.x;
    const dy = pos.y - hingePos.y;
    return [{
      x: Math.round(hingePos.x + dx * cos45 + sign * dy * sin45),
      y: Math.round(hingePos.y - sign * dx * sin45 + dy * cos45),
      z: pos.z,
    }];
  }

  const dx = pos.x - hingePos.x;
  const dz = pos.z - hingePos.z;
  const midX = Math.round(hingePos.x + dx * cos45 - sign * dz * sin45);
  const midZ = Math.round(hingePos.z + sign * dx * sin45 + dz * cos45);
  return [{ x: midX, y: pos.y, z: midZ }];
}
