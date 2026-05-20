/**
 * Crush resolution for entity displacement.
 *
 * Domain layer — no @minecraft/server imports.
 * Block queries are injected via callback so the domain stays Bedrock-free.
 */

import { classifyBlock } from "./ObstructionChecker.js";

const CARDINAL_OFFSETS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
];

/**
 * Resolve a teleport target that might be inside a solid block.
 *
 * @param {{x:number,y:number,z:number}} target - intended teleport position
 * @param {{x:number,y:number,z:number}} preferredDirection - unit vector the door pushed toward
 * @param {function({x:number,y:number,z:number}): string|null} blockQueryFn - returns typeId at position
 * @returns {{x:number,y:number,z:number}} safe position
 */
export function resolveCrush(target, preferredDirection, blockQueryFn) {
  if (isOpen(target, blockQueryFn)) return target;

  const prefOff = {
    x: Math.round(preferredDirection.x),
    y: Math.round(preferredDirection.y),
    z: Math.round(preferredDirection.z),
  };

  const preferred = { x: target.x + prefOff.x, y: target.y + prefOff.y, z: target.z + prefOff.z };
  if (isOpen(preferred, blockQueryFn)) return preferred;

  const up = { x: target.x, y: target.y + 1, z: target.z };
  if (isOpen(up, blockQueryFn)) return up;

  // Try lateral cardinals, but skip the "behind the door" direction (opposite of preferred)
  const behindOff = { x: -prefOff.x, y: -prefOff.y, z: -prefOff.z };

  for (const off of CARDINAL_OFFSETS) {
    if (off.x === prefOff.x && off.y === prefOff.y && off.z === prefOff.z) continue;
    if (off.x === 0 && off.y === 1 && off.z === 0) continue;
    if (off.x === behindOff.x && off.y === behindOff.y && off.z === behindOff.z) continue;
    const candidate = { x: target.x + off.x, y: target.y + off.y, z: target.z + off.z };
    if (isOpen(candidate, blockQueryFn)) return candidate;
  }

  // Last resort before absolute fallback: try behind the door
  const behind = { x: target.x + behindOff.x, y: target.y + behindOff.y, z: target.z + behindOff.z };
  if (isOpen(behind, blockQueryFn)) return behind;

  return { x: target.x, y: target.y + 1, z: target.z };
}

function isOpen(pos, blockQueryFn) {
  const typeId = blockQueryFn(pos);
  return classifyBlock(typeId) !== "solid";
}
