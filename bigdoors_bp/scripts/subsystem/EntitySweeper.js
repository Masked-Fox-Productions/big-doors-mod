import { system } from "@minecraft/server";
import { computeArcPositions } from "../domain/RotationMath.js";
import { computeDisplacements } from "../domain/DoorDisplacement.js";
import { resolveCrush } from "../domain/CrushResolver.js";
import { posKey } from "../util/posKey.js";

const DEBUG_ENTITY_SWEEP = true;

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
    for (const pos of computeLinearPathPositions(src, destinations[i], shiftAxis)) {
      s.add(posKey(pos));
    }
    return s;
  });

  const allPositions = [...sources, ...destinations];
  const rawEntities = queryEntities(dimension, allPositions);
  if (!rawEntities.length) {
    logSweepSummary("linear", sources, destinations, 0, 0, { shiftAxis, shiftSign });
    return;
  }

  const domainEntities = rawEntities.map(toDomainEntity);
  const hingePos = sources[0];

  const displacements = computeDisplacements(
    domainEntities, sources, destinations, sweptByPanel,
    hingePos, "linear", "", shiftAxis, shiftSign
  );

  logSweepSummary("linear", sources, destinations, rawEntities.length, displacements.length, { shiftAxis, shiftSign });

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
    s.add(posKey(src));
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
  if (!rawEntities.length) {
    logSweepSummary("rotating", sources, destinations, 0, 0, { direction, mode, facing });
    return;
  }

  const domainEntities = rawEntities.map(toDomainEntity);

  const displacements = computeDisplacements(
    domainEntities, sources, destinations, sweptByPanel,
    hingePos, "rotating", facing, "", 1, mode
  );

  logSweepSummary("rotating", sources, destinations, rawEntities.length, displacements.length, { direction, mode, facing });

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

function computeLinearPathPositions(source, destination, axis) {
  const positions = [];
  const start = source[axis];
  const end = destination[axis];
  const step = Math.sign(end - start) || 1;

  for (let value = start; step > 0 ? value <= end : value >= end; value += step) {
    const pos = { x: source.x, y: source.y, z: source.z };
    pos[axis] = value;
    positions.push(pos);
  }

  return positions;
}

function logSweepSummary(kind, sources, destinations, rawCount, displacementCount, details) {
  if (!DEBUG_ENTITY_SWEEP) return;

  const sourceRange = axisRange(sources, "y");
  const destRange = axisRange(destinations, "y");
  console.warn(
    `[bigdoors] EntitySweeper sweep kind=${kind} details=${JSON.stringify(details)} ` +
    `panels=${sources.length} entities=${rawCount} displacements=${displacementCount} ` +
    `sourceY=${sourceRange.min}..${sourceRange.max} destY=${destRange.min}..${destRange.max}`
  );
}

function axisRange(positions, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const pos of positions) {
    min = Math.min(min, pos[axis]);
    max = Math.max(max, pos[axis]);
  }
  if (!positions.length) return { min: "none", max: "none" };
  return { min, max };
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
    const impulse = d.impulseVector;

    try {
      if (d.damage > 0) {
        entity.applyDamage(d.damage, { cause: "entityAttack" });
      }
    } catch (err) {
      console.warn(`[bigdoors] EntitySweeper damage failed for ${entity.id ?? "unknown"}: ${err?.message ?? err}`);
    }

    try {
      if (DEBUG_ENTITY_SWEEP) {
        console.warn(
          `[bigdoors] EntitySweeper displacement entity=${entity.id ?? "unknown"} ` +
          `from=${formatPos(d.entity.originalPos)} target=${formatPos(d.teleportTarget)} ` +
          `resolved=${formatPos(resolved)} impulse=${formatPos(impulse)} damage=${d.damage}`
        );
      }
      entity.teleport({
        x: resolved.x + 0.5,
        y: resolved.y,
        z: resolved.z + 0.5,
      });
    } catch (err) {
      console.warn(`[bigdoors] EntitySweeper teleport failed for ${entity.id ?? "unknown"}: ${err?.message ?? err}`);
    }

    applyEntityMotion(entity, impulse);
  }
}

function applyEntityMotion(entity, impulse) {
  if (shouldDelayMotion(entity)) {
    try {
      system.runTimeout(() => applyMotionNow(entity, impulse, true, true), 1);
      system.runTimeout(() => applyHorizontalCarry(entity, impulse), 2);
      if (DEBUG_ENTITY_SWEEP) {
        console.warn(`[bigdoors] EntitySweeper delayed player knockback entity=${entity.id ?? "unknown"}`);
      }
      return;
    } catch (err) {
      console.warn(`[bigdoors] EntitySweeper motion scheduling failed for ${entity.id ?? "unknown"}: ${err?.message ?? err}`);
    }
  }

  applyMotionNow(entity, impulse, false, false);
}

function shouldDelayMotion(entity) {
  return entity.typeId === "minecraft:player" || Number(entity.id) < 0;
}

function applyMotionNow(entity, impulse, preferKnockback, clearExistingVelocity) {
  if (clearExistingVelocity && typeof entity.clearVelocity === "function") {
    try {
      entity.clearVelocity();
    } catch (err) {
      console.warn(`[bigdoors] EntitySweeper clearVelocity failed for ${entity.id ?? "unknown"}: ${err?.message ?? err}`);
    }
  }

  if (preferKnockback) {
    try {
      applyKnockback(entity, impulse);
      if (DEBUG_ENTITY_SWEEP) {
        console.warn(
          `[bigdoors] EntitySweeper applied knockback entity=${entity.id ?? "unknown"} ` +
          `horizontal=${round(impulse.x)},${round(impulse.z)} vertical=${round(Math.max(0, impulse.y))}`
        );
      }
      return;
    } catch (err) {
      console.warn(`[bigdoors] EntitySweeper applyKnockback failed for ${entity.id ?? "unknown"}: ${err?.message ?? err}`);
    }
  }

  try {
    entity.applyImpulse(impulse);
    if (DEBUG_ENTITY_SWEEP) {
      console.warn(`[bigdoors] EntitySweeper applied impulse entity=${entity.id ?? "unknown"} impulse=${formatPos(impulse)}`);
    }
  } catch (err) {
    console.warn(`[bigdoors] EntitySweeper applyImpulse failed for ${entity.id ?? "unknown"}: ${err?.message ?? err}`);
    try {
      applyKnockback(entity, impulse);
    } catch (fallbackErr) {
      console.warn(`[bigdoors] EntitySweeper applyKnockback failed for ${entity.id ?? "unknown"}: ${fallbackErr?.message ?? fallbackErr}`);
    }
  }
}

function applyHorizontalCarry(entity, impulse) {
  const horizontal = { x: impulse.x, y: 0, z: impulse.z };
  if (horizontal.x === 0 && horizontal.z === 0) return;

  try {
    entity.applyImpulse(horizontal);
    if (DEBUG_ENTITY_SWEEP) {
      console.warn(`[bigdoors] EntitySweeper applied carry impulse entity=${entity.id ?? "unknown"} impulse=${formatPos(horizontal)}`);
    }
  } catch (err) {
    console.warn(`[bigdoors] EntitySweeper carry impulse failed for ${entity.id ?? "unknown"}: ${err?.message ?? err}`);
  }
}

function applyKnockback(entity, impulse) {
  const vertical = Math.max(0, impulse.y);
  const horizontal = Math.sqrt(impulse.x ** 2 + impulse.z ** 2);

  if (entity.applyKnockback.length >= 4) {
    const dir = horizontal > 0
      ? { x: impulse.x / horizontal, z: impulse.z / horizontal }
      : { x: 0, z: 0 };
    entity.applyKnockback(dir.x, dir.z, horizontal, vertical);
    return;
  }

  entity.applyKnockback({ x: impulse.x, z: impulse.z }, vertical);
}

function formatPos(pos) {
  return `${round(pos.x)},${round(pos.y)},${round(pos.z)}`;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

