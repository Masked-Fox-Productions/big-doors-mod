import { computeArcPositions } from "../domain/RotationMath.js";
import { computeDisplacements } from "../domain/DoorDisplacement.js";
import { resolveCrush } from "../domain/CrushResolver.js";
import { posKey } from "../util/posKey.js";

/**
 * Sweep entities out of the path of a linear (winch) door with physics displacement.
 *
 * @param {object} dimension - Bedrock dimension object
 * @param {Array<{x:number,y:number,z:number}>} destinations - final panel positions
 * @param {Array<{x:number,y:number,z:number}>} sources - current panel positions (pre-move)
 * @param {string} shiftAxis - 'x', 'y', or 'z'
 * @param {number} shiftSign - +1 or -1
 */
export function sweepLinear(dimension, destinations, sources, shiftAxis, shiftSign) {
  if (destinations.length === 0) return;

  const sweptByPanel = sources.map((src, i) => {
    const s = new Set();
    s.add(posKey(src));
    s.add(posKey(destinations[i]));
    return s;
  });

  const allPositions = [...sources, ...destinations];
  const rawEntities = queryEntities(dimension, allPositions);
  if (!rawEntities.length) return;

  const domainEntities = rawEntities.map(toDomainEntity);
  const hingePos = sources[0];

  const displacements = computeDisplacements(
    domainEntities, sources, destinations, sweptByPanel,
    hingePos, "linear", "", shiftAxis, shiftSign
  );

  const blockQueryFn = (pos) => {
    try {
      const b = dimension.getBlock(pos);
      return b?.typeId ?? null;
    } catch { return null; }
  };

  applyDisplacements(dimension, rawEntities, displacements, blockQueryFn);
}

/**
 * Sweep entities out of the path of a rotating door with physics displacement.
 *
 * @param {object} dimension - Bedrock dimension object
 * @param {Array<{x:number,y:number,z:number}>} destinations - final panel positions
 * @param {Array<{x:number,y:number,z:number}>} sources - current panel positions
 * @param {{x:number,y:number,z:number}} hingePos - hinge center
 * @param {string} [direction='cw'] - rotation direction
 * @param {string} [mode='horizontal'] - 'horizontal' or 'vertical'
 * @param {string} [facing=''] - hinge facing direction
 */
export function sweep(dimension, destinations, sources, hingePos, direction = "cw", mode = "horizontal", facing = "") {
  const sweptByPanel = sources.map((src, i) => {
    const s = new Set();
    const arcMids = computeArcPositions(src, hingePos, direction, mode, facing);
    for (const mid of arcMids) s.add(posKey(mid));
    s.add(posKey(destinations[i]));
    return s;
  });

  const allPositions = [];
  for (const set of sweptByPanel) {
    for (const key of set) {
      const [x, y, z] = key.split(",").map(Number);
      allPositions.push({ x, y, z });
    }
  }
  if (allPositions.length === 0) return;

  const rawEntities = queryEntities(dimension, allPositions);
  if (!rawEntities.length) return;

  const domainEntities = rawEntities.map(toDomainEntity);

  const displacements = computeDisplacements(
    domainEntities, sources, destinations, sweptByPanel,
    hingePos, "rotating", facing, "", 1, mode
  );

  const blockQueryFn = (pos) => {
    try {
      const b = dimension.getBlock(pos);
      return b?.typeId ?? null;
    } catch { return null; }
  };

  applyDisplacements(dimension, rawEntities, displacements, blockQueryFn);
}

function queryEntities(dimension, positions) {
  if (positions.length === 0) return [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of positions) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  const center = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2 + 0.5,
    z: (minZ + maxZ) / 2,
  };
  const maxDist = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2 + 2;

  try {
    return dimension.getEntities({ location: center, maxDistance: maxDist });
  } catch {
    return [];
  }
}

function toDomainEntity(entity) {
  return {
    id: entity.id,
    blockPos: {
      x: Math.floor(entity.location.x),
      y: Math.floor(entity.location.y),
      z: Math.floor(entity.location.z),
    },
    originalPos: { ...entity.location },
  };
}

function applyDisplacements(dimension, rawEntities, displacements, blockQueryFn) {
  const entityById = new Map();
  for (const e of rawEntities) {
    if (e.id != null) entityById.set(e.id, e);
  }

  for (const d of displacements) {
    const entity = entityById.get(d.entity.id);
    if (!entity) continue;

    const resolved = resolveCrush(d.teleportTarget, d.preferredDirection, blockQueryFn);
    const impulse = recomputeImpulseIfResolved(d, resolved);

    try {
      if (d.damage > 0) {
        entity.applyDamage(d.damage, { cause: "entityAttack" });
      }
    } catch { /* entity may not support damage */ }

    try {
      entity.teleport({
        x: resolved.x + 0.5,
        y: resolved.y,
        z: resolved.z + 0.5,
      });
    } catch { /* entity may have been removed */ }

    try {
      entity.applyImpulse(impulse);
    } catch {
      try {
        entity.applyKnockback({ x: impulse.x, z: impulse.z }, impulse.y);
      } catch { /* some entities don't support knockback */ }
    }
  }
}

function recomputeImpulseIfResolved(displacement, resolved) {
  const t = displacement.teleportTarget;
  if (resolved.x === t.x && resolved.y === t.y && resolved.z === t.z) {
    return displacement.impulseVector;
  }

  const dx = resolved.x - displacement.entity.originalPos.x;
  const dy = resolved.y - displacement.entity.originalPos.y;
  const dz = resolved.z - displacement.entity.originalPos.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const mag = Math.sqrt(
    displacement.impulseVector.x ** 2 +
    displacement.impulseVector.y ** 2 +
    displacement.impulseVector.z ** 2
  );
  return { x: (dx / len) * mag, y: (dy / len) * mag, z: (dz / len) * mag };
}
