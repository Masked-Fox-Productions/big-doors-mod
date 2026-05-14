/**
 * Registers the @minecraft/server stub resolver before any test module loads.
 *
 * Invoked via `node --import ./tests/register-hooks.mjs ...` so that the
 * loader hooks are in place by the time the test files (which transitively
 * import production code that imports @minecraft/server) are evaluated.
 */
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
