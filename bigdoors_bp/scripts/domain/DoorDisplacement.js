/**
 * Per-panel entity displacement calculator.
 *
 * Domain layer — no @minecraft/server imports.
 */

import { IMPULSE_SCALE, BASE_IMPULSE, MAX_IMPULSE, DOOR_DAMAGE_THRESHOLD } from "../util/Constants.js";

/**
 * Compute displacement results for entities caught in a door's swing.
 *
 * @param {Array<{id:string, blockPos:{x:number,y:number,z:number}, originalPos:{x:number,y:number,z:number}}>} entities
 * @param {Array<{x:number,y:number,z:number}>} sources - current panel positions (pre-move)
 * @param {Array<{x:number,y:number,z:number}>} destinations - destination panel positions
 * @param {Array<Set<string>>} sweptPositionsByPanel - posKey Sets each panel sweeps through (arc midpoints + destination)
 * @param {{x:number,y:number,z:number}} hingePos - hinge center
 * @param {'rotating'|'linear'} mode - door movement type
 * @param {string} [facing=''] - hinge facing direction for vertical-mode outward blending
 * @param {string} [shiftAxis=''] - axis for linear doors ('x','y','z')
 * @param {number} [shiftSign=1] - direction sign for linear doors
 * @param {string} [rotationMode='horizontal'] - 'horizontal' or 'vertical'
 * @returns {Array<{entity:object, teleportTarget:{x:number,y:number,z:number}, impulseVector:{x:number,y:number,z:number}, damage:number, preferredDirection:{x:number,y:number,z:number}}>}
 */
export function computeDisplacements(
  entities, sources, destinations, sweptPositionsByPanel,
  hingePos, mode, facing = "", shiftAxis = "", shiftSign = 1, rotationMode = "horizontal"
) {
  const results = [];

  // Winch doors only knock back entities the panels collide with *after* the
  // trigger. An entity already touching a panel's source position when the door
  // is activated (e.g. standing on a lowered portcullis as it opens upward) was
  // collided with before the trigger, so the door moves out from under it
  // instead of knocking it back. Closing back into those blocks counts as an
  // after-trigger collision, so the entity is no longer at a source position.
  const sourceKeys = mode === "linear"
    ? new Set(sources.map((s) => `${s.x},${s.y},${s.z}`))
    : null;

  for (const entity of entities) {
    const entityKeys = [
      `${entity.blockPos.x},${entity.blockPos.y},${entity.blockPos.z}`,
      `${entity.blockPos.x},${entity.blockPos.y - 1},${entity.blockPos.z}`,
    ];

    if (sourceKeys && entityKeys.some((key) => sourceKeys.has(key))) continue;

    const panelIndex = matchPanel(entityKeys, sweptPositionsByPanel, destinations, entity.blockPos);
    if (panelIndex === -1) continue;

    const source = sources[panelIndex];
    const dest = destinations[panelIndex];
    const distance = euclidean(source, dest);

    let outward;
    let teleportTarget;
    let impulseSource = source;
    let impulseDest = dest;
    if (mode === "linear") {
      outward = { x: 0, y: 0, z: 0 };
      outward[shiftAxis] = shiftSign;
      teleportTarget = computeLinearEscapeTarget(dest, destinations, shiftAxis, shiftSign);
      const travel = maxLinearTravel(sources, destinations, shiftAxis);
      impulseSource = { x: 0, y: 0, z: 0 };
      impulseDest = {
        x: outward.x * travel,
        y: outward.y * travel,
        z: outward.z * travel,
      };
    } else {
      outward = computeRotatingOutward(dest, hingePos, facing, rotationMode);
      teleportTarget = {
        x: dest.x + outward.x,
        y: dest.y + outward.y,
        z: dest.z + outward.z,
      };
    }

    const damage = Math.max(0, Math.floor(distance - DOOR_DAMAGE_THRESHOLD));

    const motionDelta = {
      x: impulseDest.x - impulseSource.x,
      y: impulseDest.y - impulseSource.y,
      z: impulseDest.z - impulseSource.z,
    };
    const motionLen = Math.sqrt(motionDelta.x ** 2 + motionDelta.y ** 2 + motionDelta.z ** 2) || 1;
    const impulseMag = Math.min(MAX_IMPULSE, BASE_IMPULSE + distance * IMPULSE_SCALE);
    const impulseVector = {
      x: (motionDelta.x / motionLen) * impulseMag,
      y: (motionDelta.y / motionLen) * impulseMag,
      z: (motionDelta.z / motionLen) * impulseMag,
    };

    results.push({
      entity,
      teleportTarget,
      impulseVector,
      damage,
      preferredDirection: outward,
    });
  }

  return results;
}

function matchPanel(entityKeys, sweptPositionsByPanel, destinations, entityBlockPos) {
  const matches = [];
  for (let i = 0; i < sweptPositionsByPanel.length; i++) {
    if (entityKeys.some((key) => sweptPositionsByPanel[i].has(key))) {
      matches.push(i);
    }
  }
  if (matches.length === 0) return -1;
  if (matches.length === 1) return matches[0];

  let bestIdx = matches[0];
  let bestDist = Infinity;
  for (const i of matches) {
    const d = destinations[i];
    const dist = (d.x - entityBlockPos.x) ** 2 + (d.y - entityBlockPos.y) ** 2 + (d.z - entityBlockPos.z) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function computeLinearEscapeTarget(dest, destinations, axis, sign) {
  let edge = dest[axis];
  for (const d of destinations) {
    edge = sign > 0 ? Math.max(edge, d[axis]) : Math.min(edge, d[axis]);
  }

  const target = { ...dest };
  target[axis] = edge + sign;
  return target;
}

function maxLinearTravel(sources, destinations, axis) {
  let max = 0;
  for (let i = 0; i < sources.length; i++) {
    max = Math.max(max, Math.abs((destinations[i]?.[axis] ?? sources[i][axis]) - sources[i][axis]));
  }
  return max;
}

function computeRotatingOutward(dest, hingePos, facing, rotationMode) {
  if (rotationMode === "vertical") {
    return computeVerticalOutward(dest, hingePos, facing);
  }

  const dx = dest.x - hingePos.x;
  const dz = dest.z - hingePos.z;
  const radial = Math.sqrt(dx * dx + dz * dz);

  if (radial < 1) {
    return facingToUnitVector(facing);
  }

  return { x: Math.round(dx / radial), y: 0, z: Math.round(dz / radial) };
}

function computeVerticalOutward(dest, hingePos, facing) {
  const facingVec = facingToUnitVector(facing);

  if (facing === "north" || facing === "south") {
    const dz = dest.z - hingePos.z;
    const dy = dest.y - hingePos.y;
    const radial = Math.sqrt(dz * dz + dy * dy);
    if (radial < 1) return facingVec;
    const radialUnit = { x: 0, y: dy / radial, z: dz / radial };
    return {
      x: 0,
      y: Math.round(radialUnit.y + facingVec.y),
      z: Math.round(radialUnit.z + facingVec.z),
    };
  }

  const dx = dest.x - hingePos.x;
  const dy = dest.y - hingePos.y;
  const radial = Math.sqrt(dx * dx + dy * dy);
  if (radial < 1) return facingVec;
  const radialUnit = { x: dx / radial, y: dy / radial, z: 0 };
  return {
    x: Math.round(radialUnit.x + facingVec.x),
    y: Math.round(radialUnit.y + facingVec.y),
    z: 0,
  };
}

function facingToUnitVector(facing) {
  switch (facing) {
    case "north": return { x: 0, y: 0, z: -1 };
    case "south": return { x: 0, y: 0, z: 1 };
    case "east":  return { x: 1, y: 0, z: 0 };
    case "west":  return { x: -1, y: 0, z: 0 };
    default:      return { x: 0, y: 0, z: 1 };
  }
}

function euclidean(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}
