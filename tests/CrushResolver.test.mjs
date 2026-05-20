import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "./stubs/minecraft-server.mjs";
import { resolveCrush } from "../bigdoors_bp/scripts/domain/CrushResolver.js";

function blockMap(solidPositions) {
  const set = new Set(solidPositions.map(p => `${p.x},${p.y},${p.z}`));
  return (pos) => set.has(`${pos.x},${pos.y},${pos.z}`) ? "minecraft:stone" : null;
}

describe("CrushResolver", () => {
  beforeEach(() => __reset());

  it("target is air → returns target unchanged", () => {
    const target = { x: 5, y: 0, z: 5 };
    const result = resolveCrush(target, { x: 1, y: 0, z: 0 }, () => null);
    assert.deepEqual(result, target);
  });

  it("target is solid, preferred direction neighbor is air → returns preferred", () => {
    const target = { x: 5, y: 0, z: 5 };
    const preferred = { x: 1, y: 0, z: 0 };
    const query = blockMap([target]);
    const result = resolveCrush(target, preferred, query);
    assert.deepEqual(result, { x: 6, y: 0, z: 5 });
  });

  it("target solid, preferred blocked, up is air → returns up", () => {
    const target = { x: 5, y: 0, z: 5 };
    const preferred = { x: 1, y: 0, z: 0 };
    const query = blockMap([target, { x: 6, y: 0, z: 5 }]);
    const result = resolveCrush(target, preferred, query);
    assert.deepEqual(result, { x: 5, y: 1, z: 5 });
  });

  it("all 6 cardinals solid → returns y+1 above destination", () => {
    const target = { x: 5, y: 0, z: 5 };
    const preferred = { x: 1, y: 0, z: 0 };
    const allSolid = [
      target,
      { x: 6, y: 0, z: 5 }, { x: 4, y: 0, z: 5 },
      { x: 5, y: 0, z: 6 }, { x: 5, y: 0, z: 4 },
      { x: 5, y: 1, z: 5 }, { x: 5, y: -1, z: 5 },
    ];
    const query = blockMap(allSolid);
    const result = resolveCrush(target, preferred, query);
    assert.deepEqual(result, { x: 5, y: 1, z: 5 });
  });

  it("target is a soft block (tall grass) → treated as open", () => {
    const target = { x: 5, y: 0, z: 5 };
    const query = () => "minecraft:short_grass";
    const result = resolveCrush(target, { x: 1, y: 0, z: 0 }, query);
    assert.deepEqual(result, target);
  });

  it("blockQueryFn returns null (unloaded) → treated as open", () => {
    const target = { x: 5, y: 0, z: 5 };
    const result = resolveCrush(target, { x: 1, y: 0, z: 0 }, () => null);
    assert.deepEqual(result, target);
  });

  it("prefers lateral over behind-the-door direction", () => {
    const target = { x: 5, y: 0, z: 5 };
    const preferred = { x: 1, y: 0, z: 0 };
    // Block target, preferred (+x), and up — leave lateral (+z) and behind (-x) open
    const query = blockMap([
      target,
      { x: 6, y: 0, z: 5 },
      { x: 5, y: 1, z: 5 },
    ]);
    const result = resolveCrush(target, preferred, query);
    // Should pick a lateral direction, NOT behind (-x = {4,0,5})
    assert.notDeepEqual(result, { x: 4, y: 0, z: 5 }, "should not pick behind-the-door");
    assert.ok(
      result.x !== 4 || result.y !== 0 || result.z !== 5,
      "should avoid behind direction"
    );
  });

  it("uses behind-the-door only when all other options are exhausted", () => {
    const target = { x: 5, y: 0, z: 5 };
    const preferred = { x: 1, y: 0, z: 0 };
    // Block everything except behind (-x)
    const query = blockMap([
      target,
      { x: 6, y: 0, z: 5 },  // preferred
      { x: 5, y: 1, z: 5 },  // up
      { x: 5, y: 0, z: 6 },  // +z
      { x: 5, y: 0, z: 4 },  // -z
      { x: 5, y: -1, z: 5 }, // down
    ]);
    const result = resolveCrush(target, preferred, query);
    assert.deepEqual(result, { x: 4, y: 0, z: 5 }, "behind is last resort before y+1 fallback");
  });
});
