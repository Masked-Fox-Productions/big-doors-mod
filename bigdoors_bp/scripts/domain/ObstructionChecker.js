/**
 * Obstruction classification and path checking for door rotation.
 *
 * Domain layer — no @minecraft/server imports.
 * Block queries are injected via callback so the domain stays Bedrock-free.
 */

import { SOFT_BLOCKS, PASSABLE_BLOCKS, AIR_BLOCKS } from "../util/Constants.js";
import { getRotateFn } from "./RotationMath.js";

/**
 * Classify a block typeId into one of three tiers.
 * @param {string} typeId — e.g. "minecraft:stone"
 * @returns {'air'|'soft'|'passable'|'solid'}
 */
export function classifyBlock(typeId) {
  if (!typeId || AIR_BLOCKS.has(typeId)) return "air";
  if (SOFT_BLOCKS.has(typeId)) return "soft";
  if (PASSABLE_BLOCKS.has(typeId)) return "passable";
  return "solid";
}

/**
 * Check whether a door can swing in the given direction without hitting solids.
 *
 * @param {Array<{x:number,y:number,z:number}>} panelPositions — current positions of all panels
 * @param {{x:number,y:number,z:number}} hingePos — the hinge to rotate around
 * @param {'cw'|'ccw'} direction — rotation direction
 * @param {function({x:number,y:number,z:number}): string|null} blockQueryFn
 *        Called with a position, returns the typeId of the block there (or null/undefined for air).
 * @param {string} [mode="horizontal"] — rotation mode
 * @param {string} [facing=""] — hinge facing (required for vertical mode)
 * @returns {{canOpen:boolean, obstructedPositions:Array, softBlocks:Array, passableBlocks:Array}}
 */
export function checkPath(panelPositions, hingePos, direction, blockQueryFn, mode = "horizontal", facing = "") {
  const rotateFn = getRotateFn(mode, facing, direction);
  const obstructedPositions = [];
  const softBlocks = [];
  const passableBlocks = [];

  // Also track current panel positions so we don't flag them as obstructions
  const currentPosSet = new Set(
    panelPositions.map((p) => `${p.x},${p.y},${p.z}`)
  );

  for (const pos of panelPositions) {
    const dest = rotateFn(pos, hingePos);
    const destKey = `${dest.x},${dest.y},${dest.z}`;

    // If the destination is a current panel position, it will be vacated — not an obstruction
    if (currentPosSet.has(destKey)) continue;

    const typeId = blockQueryFn(dest);
    const classification = classifyBlock(typeId);

    if (classification === "solid") {
      obstructedPositions.push(dest);
    } else if (classification === "soft") {
      softBlocks.push(dest);
    } else if (classification === "passable") {
      passableBlocks.push(dest);
    }
    // 'air' — no action needed
  }

  return {
    canOpen: obstructedPositions.length === 0,
    obstructedPositions,
    softBlocks,
    passableBlocks,
  };
}

export function checkClose(closedPositions, currentPositionSet, blockQueryFn) {
  const obstructedPositions = [];
  const softBlocks = [];
  const passableBlocks = [];

  for (const dest of closedPositions) {
    const destKey = `${dest.x},${dest.y},${dest.z}`;
    if (currentPositionSet.has(destKey)) continue;

    const typeId = blockQueryFn(dest);
    const classification = classifyBlock(typeId);

    if (classification === "solid") {
      obstructedPositions.push(dest);
    } else if (classification === "soft") {
      softBlocks.push(dest);
    } else if (classification === "passable") {
      passableBlocks.push(dest);
    }
  }

  return {
    canClose: obstructedPositions.length === 0,
    obstructedPositions,
    softBlocks,
    passableBlocks,
  };
}
