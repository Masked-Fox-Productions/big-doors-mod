/**
 * Stub for @minecraft/server used by the node:test harness.
 *
 * Production code reaches for `world` and `system` at module load time
 * (to subscribe to events / schedule intervals). This stub provides minimal,
 * inert implementations so the import resolves cleanly.
 *
 * Tests that need to observe interactions can swap in a fake via the
 * exported `__setWorld` / `__setSystem` helpers BEFORE importing the module
 * under test.
 *
 * ## Adding events
 *
 * To add a new event your mod subscribes to:
 * 1. Add it to the appropriate `afterEvents` or `beforeEvents` object in
 *    `makeDefaultWorld()` or `makeDefaultSystem()` below.
 * 2. Use `makeNoopSubscribable()` as the value — it provides inert
 *    `subscribe` and `unsubscribe` methods.
 */

function makeNoopSubscribable() {
  return {
    subscribe(_fn) { /* no-op */ },
    unsubscribe(_fn) { /* no-op */ }
  };
}

function makeDefaultWorld() {
  const props = new Map();
  return {
    afterEvents: {
      playerPlaceBlock: makeNoopSubscribable(),
      playerBreakBlock: makeNoopSubscribable(),
      entitySpawn: makeNoopSubscribable(),
      worldInitialize: makeNoopSubscribable(),
      itemUse: makeNoopSubscribable(),
    },
    beforeEvents: {
      entitySpawn: makeNoopSubscribable(),
      playerBreakBlock: makeNoopSubscribable(),
    },
    getDynamicProperty(key) { return props.get(key); },
    setDynamicProperty(key, value) { props.set(key, value); },
    getDimension(_id) {
      return {
        getBlock() { return null; },
        getEntities() { return []; },
        spawnEntity() { return { addTag() {}, getTags() { return []; } }; },
        spawnItem() {},
      };
    },
    getPlayers() { return []; },
    getAllPlayers() { return []; },
  };
}

function makeDefaultSystem() {
  let nextHandle = 1;
  const sys = {
    currentTick: 0,
    _scheduled: [],
    _intervals: new Map(),
    runInterval(fn, ticks) {
      const id = nextHandle++;
      sys._intervals.set(id, { fn, interval: ticks, nextFire: sys.currentTick + ticks });
      return id;
    },
    runTimeout(fn, ticks) {
      const id = nextHandle++;
      sys._scheduled.push({ fn, fireAt: sys.currentTick + ticks, id });
      return id;
    },
    run(fn) {
      const id = nextHandle++;
      sys._scheduled.push({ fn, fireAt: sys.currentTick, id });
      return id;
    },
    runJob(_gen) { return nextHandle++; },
    clearRun(id) {
      sys._intervals.delete(id);
      sys._scheduled = sys._scheduled.filter(s => s.id !== id);
    },
    advanceTicks(n) {
      sys.currentTick += n;
      const ready = sys._scheduled.filter(s => s.fireAt <= sys.currentTick);
      sys._scheduled = sys._scheduled.filter(s => s.fireAt > sys.currentTick);
      for (const s of ready) s.fn();

      for (const [id, entry] of sys._intervals) {
        while (entry.nextFire <= sys.currentTick) {
          entry.fn();
          if (!sys._intervals.has(id)) break;
          entry.nextFire += entry.interval;
        }
      }
    },
    afterEvents: {
      scriptEventReceive: makeNoopSubscribable(),
    },
    beforeEvents: {
      startup: makeNoopSubscribable(),
    },
  };
  return sys;
}

export let world = makeDefaultWorld();
export let system = makeDefaultSystem();

export class MolangVariableMap {
  constructor() { this._vars = {}; }
  setColorRGBA(name, color) { this._vars[name] = color; }
}

export class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId;
    this.amount = amount;
  }
}

export class BlockPermutation {
  constructor(typeId, states = {}) {
    this.type = { id: typeId };
    this._states = { ...states };
  }
  getState(name) { return this._states[name]; }
  getAllStates() { return { ...this._states }; }
  static resolve(typeId, states = {}) {
    return new BlockPermutation(typeId, states);
  }
}

export const InputButton = {
  Jump: "Jump",
  Sneak: "Sneak",
};


export const EntityInitializationCause = {
  Born: "Born",
  Event: "Event",
  Loaded: "Loaded",
  Spawned: "Spawned",
  Transformed: "Transformed"
};


/** Test-only: replace the exported `world` object. */
export function __setWorld(w) { world = w; }

/** Test-only: replace the exported `system` object. */
export function __setSystem(s) { system = s; }

/** Test-only: reset both to fresh defaults. */
export function __reset() {
  world = makeDefaultWorld();
  system = makeDefaultSystem();
}
