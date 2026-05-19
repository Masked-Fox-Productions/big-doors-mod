import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HINGE_BLOCK_ID,
  HIDDEN_HINGE_BLOCK_ID,
  WINCH_BLOCK_ID,
  HIDDEN_WINCH_BLOCK_ID,
  isWinchType,
  isVisibleHingeType,
  blockIdForHingeType,
  hingeTypeFromBlockId,
  areTypesCompatible,
} from "../bigdoors_bp/scripts/util/Constants.js";

describe("isWinchType", () => {
  it("returns true for winch", () => assert.equal(isWinchType("winch"), true));
  it("returns true for hidden_winch", () => assert.equal(isWinchType("hidden_winch"), true));
  it("returns false for hinge", () => assert.equal(isWinchType("hinge"), false));
  it("returns false for hidden", () => assert.equal(isWinchType("hidden"), false));
  it("returns false for undefined", () => assert.equal(isWinchType(undefined), false));
});

describe("isVisibleHingeType", () => {
  it("returns true for hinge", () => assert.equal(isVisibleHingeType("hinge"), true));
  it("returns true for winch", () => assert.equal(isVisibleHingeType("winch"), true));
  it("returns false for hidden", () => assert.equal(isVisibleHingeType("hidden"), false));
  it("returns false for hidden_winch", () => assert.equal(isVisibleHingeType("hidden_winch"), false));
});

describe("blockIdForHingeType", () => {
  it("maps hinge", () => assert.equal(blockIdForHingeType("hinge"), HINGE_BLOCK_ID));
  it("maps hidden", () => assert.equal(blockIdForHingeType("hidden"), HIDDEN_HINGE_BLOCK_ID));
  it("maps winch", () => assert.equal(blockIdForHingeType("winch"), WINCH_BLOCK_ID));
  it("maps hidden_winch", () => assert.equal(blockIdForHingeType("hidden_winch"), HIDDEN_WINCH_BLOCK_ID));
  it("defaults to hinge for undefined", () => assert.equal(blockIdForHingeType(undefined), HINGE_BLOCK_ID));
});

describe("hingeTypeFromBlockId", () => {
  it("maps HINGE_BLOCK_ID", () => assert.equal(hingeTypeFromBlockId(HINGE_BLOCK_ID), "hinge"));
  it("maps HIDDEN_HINGE_BLOCK_ID", () => assert.equal(hingeTypeFromBlockId(HIDDEN_HINGE_BLOCK_ID), "hidden"));
  it("maps WINCH_BLOCK_ID", () => assert.equal(hingeTypeFromBlockId(WINCH_BLOCK_ID), "winch"));
  it("maps HIDDEN_WINCH_BLOCK_ID", () => assert.equal(hingeTypeFromBlockId(HIDDEN_WINCH_BLOCK_ID), "hidden_winch"));
  it("defaults to hinge for unknown", () => assert.equal(hingeTypeFromBlockId("unknown:block"), "hinge"));
});

describe("areTypesCompatible", () => {
  it("hinge + hidden = compatible", () => assert.equal(areTypesCompatible("hinge", "hidden"), true));
  it("winch + hidden_winch = compatible", () => assert.equal(areTypesCompatible("winch", "hidden_winch"), true));
  it("hinge + winch = incompatible", () => assert.equal(areTypesCompatible("hinge", "winch"), false));
  it("hidden + hidden_winch = incompatible", () => assert.equal(areTypesCompatible("hidden", "hidden_winch"), false));
});
