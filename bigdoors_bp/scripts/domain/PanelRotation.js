import {
  GEOMETRY_CLASS_FENCE,
  GEOMETRY_CLASS_SLAB,
  GEOMETRY_CLASS_BARS,
  GEOMETRY_CLASS_PANE,
} from "../util/Constants.js";

export function closedRotation(doorSide, facing, geoClass) {
  if (doorSide === "up" || doorSide === "down") {
    if (geoClass === GEOMETRY_CLASS_FENCE || geoClass === GEOMETRY_CLASS_SLAB || geoClass === GEOMETRY_CLASS_BARS || geoClass === GEOMETRY_CLASS_PANE) {
      if (facing === "north" || facing === "south") return 2;
      return 1;
    }
    if (facing === "north" || facing === "south") return 5;
    return 4;
  }
  if (doorSide === "east") return 2;
  if (doorSide === "south") return 1;
  if (doorSide === "west") return 0;
  return 3;
}

export function openRotation(mode, doorSide, facing, direction, geoClass) {
  if (mode === "vertical") {
    if (geoClass === GEOMETRY_CLASS_FENCE || geoClass === GEOMETRY_CLASS_SLAB || geoClass === GEOMETRY_CLASS_BARS || geoClass === GEOMETRY_CLASS_PANE) {
      if (facing === "north" || facing === "south") return 6;
      return 5;
    }
    if (facing === "north" || facing === "south") return 1;
    return 0;
  }
  const closed = closedRotation(doorSide, facing, geoClass);
  return direction === "cw" ? (closed + 3) % 4 : (closed + 1) % 4;
}
