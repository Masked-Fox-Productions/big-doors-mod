#!/usr/bin/env node

/**
 * Optional setup script — replaces buildable defaults with your mod's values.
 *
 * Usage:
 *   node scripts/setup.js --name "Big Doors" --id bigdoors --group com.bigdoors --author "Your Name"
 *
 * This script replaces file CONTENTS only — it does NOT rename directories.
 * See SETUP.md section 3 for manual directory renames.
 *
 * Delete this script after running it.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { argv, exit } from "node:process";

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) result.name = args[++i];
    else if (args[i] === "--id" && args[i + 1]) result.id = args[++i];
    else if (args[i] === "--group" && args[i + 1]) result.group = args[++i];
    else if (args[i] === "--author" && args[i + 1]) result.author = args[++i];
    else if (args[i] === "--help" || args[i] === "-h") {
      printUsage();
      exit(0);
    }
  }
  return result;
}

function printUsage() {
  console.log(`
Usage: node scripts/setup.js --name "Big Doors" --id bigdoors --group com.bigdoors --author "Your Name"

Options:
  --name    Display name for the mod (e.g., "Big Doors")
  --id      Mod identifier, lowercase, no spaces (e.g., "bigdoors")
  --group   Maven group for Java edition (e.g., "com.bigdoors")
  --author  Author name for manifests
  --help    Show this help

This replaces file contents only. See SETUP.md section 3 for directory renames.
  `.trim());
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const root = resolve(import.meta.dirname, "..");
const opts = parseArgs(argv.slice(2));

if (!opts.id || !opts.name) {
  console.error("Error: --name and --id are required.\n");
  printUsage();
  exit(1);
}

const modId = opts.id;
const modName = opts.name;
const group = opts.group || `com.${modId}`;
const author = opts.author || "Your Name";
const className = capitalize(modId) + "Mod";
const clientClassName = capitalize(modId) + "ModClient";

const defaultUuids = [
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "d4e5f6a7-b8c9-0123-defa-234567890123",
  "e5f6a7b8-c9d0-1234-efab-345678901234",
];

const newUuids = defaultUuids.map(() => randomUUID());

// BP header UUID is used as RP dependency — track the cross-reference
const bpHeaderUuid = newUuids[0];

const filesToProcess = [
  "package.json",
  "CLAUDE.md",
  ".gitignore",
  "mymod_bp/manifest.json",
  "mymod_bp/scripts/main.js",
  "mymod_bp/scripts/util/Constants.js",
  "mymod_bp/scripts/domain/Example.js",
  "mymod_rp/manifest.json",
  "mymod_rp/texts/en_US.lang",
  "java-mymod/gradle.properties",
  "java-mymod/settings.gradle",
  "java-mymod/build.gradle",
  "java-mymod/src/main/resources/fabric.mod.json",
  "java-mymod/src/main/resources/mymod.mixins.json",
  "java-mymod/src/main/java/com/mymod/MymodMod.java",
  "java-mymod/src/main/java/com/mymod/client/MymodModClient.java",
  "java-mymod/src/main/java/com/mymod/block/ModBlocks.java",
  "java-mymod/src/main/java/com/mymod/domain/Example.java",
  "java-mymod/src/test/java/com/mymod/domain/ExampleTest.java",
  "tests/Example.test.mjs",
  ".github/workflows/test-java.yml",
];

let filesModified = 0;
let replacementsMade = 0;

for (const relPath of filesToProcess) {
  const absPath = join(root, relPath);
  if (!existsSync(absPath)) {
    console.warn(`  skip: ${relPath} (not found)`);
    continue;
  }

  let content = readFileSync(absPath, "utf-8");
  const original = content;

  // Replace UUIDs first (most specific)
  for (let i = 0; i < defaultUuids.length; i++) {
    content = content.replaceAll(defaultUuids[i], newUuids[i]);
  }

  // Replace class names before general ID replacement
  content = content.replaceAll("MymodModClient", clientClassName);
  content = content.replaceAll("MymodMod", className);
  content = content.replaceAll("com.mymod", group);
  content = content.replaceAll("My Mod Resources", `${modName} Resources`);
  content = content.replaceAll("My Mod", modName);
  content = content.replaceAll("Your Name", author);

  // Replace mod ID (careful: after class names and group to avoid partial matches)
  content = content.replaceAll("mymod", modId);

  if (content !== original) {
    writeFileSync(absPath, content, "utf-8");
    filesModified++;
    console.log(`  updated: ${relPath}`);
  }
}

console.log(`\nDone! Modified ${filesModified} files.`);
console.log(`\nGenerated UUIDs:`);
console.log(`  BP header:  ${newUuids[0]}`);
console.log(`  BP data:    ${newUuids[1]}`);
console.log(`  BP script:  ${newUuids[2]}`);
console.log(`  RP header:  ${newUuids[3]}`);
console.log(`  RP module:  ${newUuids[4]}`);
console.log(`\nRP dependency UUID is set to BP header UUID: ${bpHeaderUuid}`);
console.log(`\nNext steps:`);
console.log(`  1. Rename directories (see SETUP.md section 3)`);
console.log(`  2. Run 'npm test' and 'cd java-${modId} && ./gradlew test' to verify`);
console.log(`  3. Delete this script (scripts/setup.js)`);
