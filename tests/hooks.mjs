/**
 * Loader hooks: redirect `@minecraft/server` to a local stub for tests.
 *
 * The stub provides just enough surface for the modules under test to import
 * cleanly. Tests that need to assert behaviour against the world/system
 * objects swap in their own fakes through the stub's `__setWorld` /
 * `__setSystem` helpers.
 */
import { pathToFileURL } from "node:url";
import { resolve as pathResolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const stubUrl = pathToFileURL(pathResolve(here, "stubs/minecraft-server.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@minecraft/server") {
    return { url: stubUrl, shortCircuit: true, format: "module" };
  }
  return nextResolve(specifier, context);
}
