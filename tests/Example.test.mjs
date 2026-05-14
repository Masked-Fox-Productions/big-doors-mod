import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __reset } from "@minecraft/server";
import { Example } from "../mymod_bp/scripts/domain/Example.js";

describe("Example", () => {
  beforeEach(() => {
    __reset();
  });

  it("initializes with a name and zero value", () => {
    const ex = new Example("test");
    assert.equal(ex.name, "test");
    assert.equal(ex.value, 0);
  });

  it("increments by 1 by default", () => {
    const ex = new Example("counter");
    const result = ex.increment();
    assert.equal(result, 1);
    assert.equal(ex.value, 1);
  });

  it("increments by a custom amount", () => {
    const ex = new Example("counter");
    ex.increment(5);
    assert.equal(ex.value, 5);
  });

  it("round-trips through JSON serialization", () => {
    const ex = new Example("persist");
    ex.increment(42);

    const json = ex.toJSON();
    const restored = Example.fromJSON(json);

    assert.equal(restored.name, "persist");
    assert.equal(restored.value, 42);
  });
});
