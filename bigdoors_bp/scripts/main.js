import { world, system } from "@minecraft/server";

// SETUP: Replace "bigdoors" with your mod ID throughout this file
// SETUP: Import your own manager, subsystems, and handlers below

/**
 * Big Doors — Entry Point
 *
 * Startup order matters: the manager must exist before any subsystem
 * so its reference can be shared. Subsystems register their own
 * Bedrock event hooks via .register().
 *
 * Architecture:
 *   1. Manager (data layer — must exist first)
 *   2. Subsystems (each owns one event subscription or interval)
 *   3. Block handlers (thin glue between Bedrock events and domain)
 */

console.warn("[bigdoors] === Mod initializing ==="); // SETUP: Replace "bigdoors"

// --- Manager ---
// SETUP: Create your manager instance here
// const manager = new MyManager();

// --- Persistence: load on worldInitialize ---
world.afterEvents.worldInitialize.subscribe(() => {
  console.warn("[bigdoors] worldInitialize fired — loading persistence"); // SETUP: Replace "bigdoors"
  // manager.load();
});

// --- Subsystems ---
// SETUP: Create and register your subsystems here
// const mySub = new MySubsystem(manager);
// mySub.register();

// --- Block handlers ---
// SETUP: Create and register your block handlers here
// const myHandler = new MyHandler(manager);
// myHandler.register();

// --- Fallback load ---
// Some Bedrock builds don't fire worldInitialize on script reload.
// This one-shot fallback ensures persistence is hydrated.
system.run(() => {
  console.warn("[bigdoors] Fallback load triggered"); // SETUP: Replace "bigdoors"
  // manager.load();
});

console.warn("[bigdoors] === Initialization complete ==="); // SETUP: Replace "bigdoors"
