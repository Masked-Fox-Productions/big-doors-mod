# Setup Checklist

After creating a new repository from this template, follow these steps to customize it for your mod.

## 1. Choose Your Mod Identity

Decide on these values before starting:

| Value | Example | Used in |
|-------|---------|---------|
| **Mod ID** | `bigdoors` | Everywhere — file names, namespaces, block IDs |
| **Mod Name** | `Big Doors` | Display name in manifests and UI |
| **Mod Description** | `Multi-block doors for Minecraft` | Manifests |
| **Java Package** | `com.bigdoors` | Java source tree, gradle.properties |
| **Author** | `Your Name` | fabric.mod.json, LICENSE |

## 2. Placeholder Catalog

All template files use `mymod` / `com.mymod` / `My Mod` as buildable defaults. Replace them with your values.

### Root Files

| File | Field / Pattern | Default | Replace with |
|------|----------------|---------|-------------|
| `package.json` | `name` | `mymod` | Your mod ID |
| `package.json` | `description` | `Replace with your mod description` | Your description |
| `.gitignore` | `java-mymod/` paths | `java-mymod` | `java-yourmod` |
| `CLAUDE.md` | `mymod_bp/`, `mymod_rp/`, `java-mymod/` references | `mymod` | Your mod ID |
| `LICENSE` | `[year]`, `[your name]` | Placeholders | Your values (or replace entire license) |

### Bedrock Behavior Pack (`mymod_bp/`)

| File | Field / Pattern | Default | Replace with |
|------|----------------|---------|-------------|
| `manifest.json` | `header.name` | `My Mod` | Your mod name |
| `manifest.json` | `header.description` | `Replace with your mod description` | Your description |
| `manifest.json` | `header.uuid` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | Generate new UUID |
| `manifest.json` | `modules[0].uuid` (data) | `b2c3d4e5-f6a7-8901-bcde-f12345678901` | Generate new UUID |
| `manifest.json` | `modules[1].uuid` (script) | `c3d4e5f6-a7b8-9012-cdef-123456789012` | Generate new UUID |
| `scripts/main.js` | `[mymod]` log prefix | `mymod` | Your mod ID |
| `scripts/util/Constants.js` | `mymod:` namespace | `mymod` | Your mod ID |
| `scripts/domain/Example.js` | — | Example class | Replace with your domain classes |

### Bedrock Resource Pack (`mymod_rp/`)

| File | Field / Pattern | Default | Replace with |
|------|----------------|---------|-------------|
| `manifest.json` | `header.name` | `My Mod Resources` | `Your Mod Resources` |
| `manifest.json` | `header.description` | `Textures and strings for My Mod` | Your description |
| `manifest.json` | `header.uuid` | `d4e5f6a7-b8c9-0123-defa-234567890123` | Generate new UUID |
| `manifest.json` | `modules[0].uuid` (resources) | `e5f6a7b8-c9d0-1234-efab-345678901234` | Generate new UUID |
| `manifest.json` | `dependencies[0].uuid` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | **Must match** BP `header.uuid` |
| `texts/en_US.lang` | `mymod:` namespace | `mymod` | Your mod ID |

### Java/Fabric (`java-mymod/`)

| File | Field / Pattern | Default | Replace with |
|------|----------------|---------|-------------|
| `gradle.properties` | `maven_group` | `com.mymod` | Your Maven group |
| `gradle.properties` | `archives_base_name` | `mymod` | Your mod ID |
| `settings.gradle` | `rootProject.name` | `mymod` | Your mod ID |
| `build.gradle` | `deployToMods` path | `APPDATA` default | Adjust for your OS |
| `fabric.mod.json` | `id` | `mymod` | Your mod ID |
| `fabric.mod.json` | `name` | `My Mod` | Your mod name |
| `fabric.mod.json` | `description` | `Replace with your mod description` | Your description |
| `fabric.mod.json` | `authors` | `["Your Name"]` | Your name |
| `fabric.mod.json` | `license` | `MIT` | Your license |
| `fabric.mod.json` | `icon` | `assets/mymod/icon.png` | `assets/yourmod/icon.png` |
| `fabric.mod.json` | `entrypoints.main` | `com.mymod.MymodMod` | Your entrypoint class |
| `fabric.mod.json` | `entrypoints.client` | `com.mymod.client.MymodModClient` | Your client class |
| `fabric.mod.json` | `mixins` | `mymod.mixins.json` | `yourmod.mixins.json` |
| `mymod.mixins.json` | `package` | `com.mymod.mixin` | Your mixin package |
| `MymodMod.java` | `MOD_ID`, class name, package | `mymod`, `MymodMod`, `com.mymod` | Your values |
| `MymodModClient.java` | class name, package | `MymodModClient`, `com.mymod.client` | Your values |
| `ModBlocks.java` | package | `com.mymod.block` | Your package |
| `domain/Example.java` | — | Example class | Replace with your domain classes |
| `domain/ExampleTest.java` | — | Example test | Replace with your tests |

### CI Workflows (`.github/workflows/`)

| File | Field / Pattern | Default | Replace with |
|------|----------------|---------|-------------|
| `test-java.yml` | `java-mymod` directory | `java-mymod` | `java-yourmod` |

## 3. Rename Directories

Directory renames must be done manually (the setup script does not handle these):

```bash
# Rename Bedrock packs
mv mymod_bp yourmod_bp
mv mymod_rp yourmod_rp

# Rename Java project
mv java-mymod java-yourmod

# Rename Java packages (create new directory tree, move files, delete old)
cd java-yourmod/src/main/java
mkdir -p com/yourmod/block com/yourmod/client com/yourmod/domain com/yourmod/mixin
mv com/mymod/MymodMod.java com/yourmod/YourmodMod.java          # also rename the class inside
mv com/mymod/block/* com/yourmod/block/
mv com/mymod/client/* com/yourmod/client/                        # also rename the class inside
mv com/mymod/domain/* com/yourmod/domain/
rm -rf com/mymod

# Same for test tree
cd ../../test/java
mkdir -p com/yourmod/domain
mv com/mymod/domain/* com/yourmod/domain/
rm -rf com/mymod

# Rename mixins file
cd ../../main/resources
mv mymod.mixins.json yourmod.mixins.json
```

## 4. Generate UUIDs

Bedrock packs require unique UUIDs. Generate 5 fresh UUIDs:

```bash
# Using Node.js
node -e "for(let i=0;i<5;i++) console.log(crypto.randomUUID())"

# Or use any UUID v4 generator
```

Assign them as follows:

| UUID # | Goes in | Field |
|--------|---------|-------|
| 1 | `yourmod_bp/manifest.json` | `header.uuid` |
| 2 | `yourmod_bp/manifest.json` | `modules[0].uuid` (data) |
| 3 | `yourmod_bp/manifest.json` | `modules[1].uuid` (script) |
| 4 | `yourmod_rp/manifest.json` | `header.uuid` |
| 5 | `yourmod_rp/manifest.json` | `modules[0].uuid` (resources) |

**Critical:** Set `yourmod_rp/manifest.json` → `dependencies[0].uuid` to UUID #1 (the BP header UUID). This links the resource pack to the behavior pack.

## 5. Verify

After all replacements:

```bash
# Bedrock tests
npm test

# Java tests
cd java-yourmod && ./gradlew test

# Java build
cd java-yourmod && ./gradlew build
```

## 6. Clean Up

- Delete `scripts/setup.js` (if you used it)
- Replace `scripts/domain/Example.js` and `tests/Example.test.mjs` with your own domain classes
- Replace `java-yourmod/src/main/java/.../domain/Example.java` and its test with your own
- Update this `SETUP.md` or delete it — it's template documentation, not mod documentation

## Removing an Edition

### Bedrock-only (remove Java)

Delete:
- `java-mymod/` directory
- `.github/workflows/test-java.yml`
- Java references in `.gitignore`
- Java sections in `CLAUDE.md`

### Java-only (remove Bedrock)

Delete:
- `mymod_bp/` directory
- `mymod_rp/` directory
- `tests/` directory
- `.github/workflows/test-bedrock.yml`
- `package.json`
- Bedrock sections in `CLAUDE.md`

## Template Drift

This repo was created from a template. To pull in template improvements later:

```bash
# Add the template as a remote (one-time)
git remote add template https://github.com/YOUR_ORG/minecraft-mod-template.git

# Fetch and merge template updates
git fetch template
git merge template/main --allow-unrelated-histories
```

Resolve any conflicts (expected — your mod-specific changes will conflict with template defaults). This approach works well for 2-5 mod repos. If the number grows, consider [actions-template-sync](https://github.com/marketplace/actions/actions-template-sync).

## Version Tuple

This template was created with the following tested version combination:

| Component | Version |
|-----------|---------|
| Minecraft | 26.1.2 |
| Fabric Loader | 0.19.2 |
| Fabric API | 0.148.2+26.1.2 |
| Fabric Loom (Gradle plugin) | 1.16.1 |
| Java | 25 |
| Gradle | 9.5.1 |
| `@minecraft/server` (Bedrock) | 1.12.0 |
| Bedrock `min_engine_version` | 1.20.0 |

The `build.gradle` "No mappings" approach requires MC 1.20.5+ (intermediary-only / unobfuscated). If targeting older Minecraft versions, you'll need to add mappings to the Gradle dependencies.
