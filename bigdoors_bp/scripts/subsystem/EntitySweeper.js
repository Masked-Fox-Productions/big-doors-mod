import { computeArcPositions } from "../domain/RotationMath.js";
import { posKey } from "../util/posKey.js";

/**
 * Sweep entities out of the path of a rotating door.
 *
 * @param {object} dimension - Bedrock dimension object
 * @param {Array<{x:number,y:number,z:number}>} destinations - final panel positions
 * @param {Array<{x:number,y:number,z:number}>} sources - current panel positions
 * @param {{x:number,y:number,z:number}} hingePos - hinge center
 */
export function sweep(dimension, destinations, sources, hingePos) {
  const sweptPositions = new Set();

  for (let i = 0; i < sources.length; i++) {
    const arcMids = computeArcPositions(sources[i], hingePos);
    for (const mid of arcMids) {
      sweptPositions.add(posKey(mid));
    }
    sweptPositions.add(posKey(destinations[i]));
  }

  const allPositions = [...sweptPositions].map((k) => {
    const [x, y, z] = k.split(",").map(Number);
    return { x, y, z };
  });

  if (allPositions.length === 0) return;

  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  let yLevel = hingePos.y;
  for (const p of allPositions) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  const center = {
    x: (minX + maxX) / 2,
    y: yLevel + 0.5,
    z: (minZ + maxZ) / 2,
  };
  const radius = Math.max(maxX - minX, maxZ - minZ) / 2 + 2;

  let entities;
  try {
    entities = dimension.getEntities({ location: center, maxDistance: radius });
  } catch {
    return;
  }

  for (const entity of entities) {
    if (!entity.location) continue;
    const eKey = posKey({
      x: Math.floor(entity.location.x),
      y: Math.floor(entity.location.y),
      z: Math.floor(entity.location.z),
    });

    if (!sweptPositions.has(eKey)) continue;

    const dx = entity.location.x - hingePos.x;
    const dz = entity.location.z - hingePos.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const pushX = (dx / len) * 1.5;
    const pushZ = (dz / len) * 1.5;

    try {
      entity.teleport({
        x: entity.location.x + pushX,
        y: entity.location.y,
        z: entity.location.z + pushZ,
      });
    } catch {
      // Entity may have been removed
    }
  }
}
