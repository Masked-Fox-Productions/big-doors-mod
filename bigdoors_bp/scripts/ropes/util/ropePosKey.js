export function ropePosKey(dimension, pos) {
  const dimId = typeof dimension === "string" ? dimension : dimension.id;
  return `${dimId}:${pos.x},${pos.y},${pos.z}`;
}
