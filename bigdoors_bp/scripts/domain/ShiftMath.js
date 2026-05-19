/**
 * Linear shift math for winch door panels.
 *
 * Domain layer — no @minecraft/server imports.
 */

const DOOR_SIDE_AXIS = {
  down: "y",
  up: "y",
  north: "z",
  south: "z",
  east: "x",
  west: "x",
};

export function axisForDoorSide(doorSide) {
  return DOOR_SIDE_AXIS[doorSide] ?? "y";
}

export function getShiftFn(hingePositions, doorSide) {
  const axis = axisForDoorSide(doorSide);
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (const h of hingePositions) {
    const v = h[axis];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  const sum = minVal + maxVal;
  return (panelPos) => {
    const dest = { x: panelPos.x, y: panelPos.y, z: panelPos.z };
    dest[axis] = sum - panelPos[axis];
    return dest;
  };
}
