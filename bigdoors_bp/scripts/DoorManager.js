import { world } from "@minecraft/server";
import { DoorAssembly } from "./domain/DoorAssembly.js";
import { PERSISTENCE_KEY } from "./util/Constants.js";

function posKey(pos) {
  return `${pos.x},${pos.y},${pos.z}`;
}

export class DoorManager {
  constructor() {
    this._assemblies = new Map();
    this._positionIndex = new Map();
    this._redstoneDebounce = new Map();
    this._loaded = false;
    this._nextId = 1;
  }

  setRedstoneDebounce(assemblyId, untilTick) {
    this._redstoneDebounce.set(assemblyId, untilTick);
  }

  isRedstoneDebounced(assemblyId, currentTick) {
    const expiry = this._redstoneDebounce.get(assemblyId) ?? 0;
    return currentTick < expiry;
  }

  load() {
    if (this._loaded) return;

    const raw = world.getDynamicProperty(PERSISTENCE_KEY);
    if (raw == null) {
      this._loaded = true;
      return;
    }

    const data = JSON.parse(raw);
    for (const entry of data) {
      const assembly = DoorAssembly.fromJSON(entry);
      this._assemblies.set(assembly.id, assembly);

      for (const hPos of assembly.hingePositions) {
        this._positionIndex.set(posKey(hPos), assembly.id);
      }
      for (const panel of assembly.panelPositions) {
        this._positionIndex.set(posKey(panel.currentPos), assembly.id);
      }

      const numPart = parseInt(assembly.id.replace("door_", ""), 10);
      if (!isNaN(numPart) && numPart >= this._nextId) {
        this._nextId = numPart + 1;
      }
    }

    this._loaded = true;
  }

  save() {
    try {
      const data = [];
      for (const assembly of this._assemblies.values()) {
        data.push(assembly.toJSON());
      }
      world.setDynamicProperty(PERSISTENCE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn(`[bigdoors] Failed to save state: ${err.message}`);
    }
  }

  createAssembly(hingePos, facing, mode) {
    const id = `door_${this._nextId++}`;
    const assembly = new DoorAssembly(id, hingePos, facing, mode);
    this._assemblies.set(id, assembly);
    this._positionIndex.set(posKey(hingePos), id);
    this.save();
    return assembly;
  }

  addHingeToAssembly(assemblyId, hingePos) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    assembly.addHinge(hingePos);
    this._positionIndex.set(posKey(hingePos), assemblyId);
    this.save();
  }

  setDoorSide(assemblyId, doorSide) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    assembly.doorSide = doorSide;
    this.save();
  }

  addPanelToAssembly(assemblyId, panelPos, materialIndex) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    assembly.addPanel(panelPos, materialIndex);
    this._positionIndex.set(posKey(panelPos), assemblyId);
    this.save();
  }

  removePanelFromAssembly(assemblyId, panelPos) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    assembly.removePanel(panelPos);
    this._positionIndex.delete(posKey(panelPos));

    if (assembly.panelPositions.length === 0) {
      this.dissolveAssembly(assemblyId);
    } else {
      this.save();
    }
  }

  findByPosition(pos) {
    const id = this._positionIndex.get(posKey(pos));
    if (id == null) return null;
    return this._assemblies.get(id) ?? null;
  }

  dissolveAssembly(assemblyId) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;

    for (const hPos of assembly.hingePositions) {
      this._positionIndex.delete(posKey(hPos));
    }
    for (const panel of assembly.panelPositions) {
      this._positionIndex.delete(posKey(panel.currentPos));
    }

    this._assemblies.delete(assemblyId);
    this.save();
  }

  getAssembly(assemblyId) {
    return this._assemblies.get(assemblyId) ?? null;
  }

  openDoor(assemblyId, direction, newPositions) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;

    for (const panel of assembly.panelPositions) {
      this._positionIndex.delete(posKey(panel.currentPos));
    }

    assembly.updatePanelPositions(newPositions);
    assembly.isOpen = true;
    assembly.openDirection = direction;

    for (const panel of assembly.panelPositions) {
      this._positionIndex.set(posKey(panel.currentPos), assemblyId);
    }

    this.save();
  }

  pairAssemblies(assemblyIdA, assemblyIdB) {
    const a = this._assemblies.get(assemblyIdA);
    const b = this._assemblies.get(assemblyIdB);
    if (!a || !b) return;
    a.partnerAssemblyId = assemblyIdB;
    b.partnerAssemblyId = assemblyIdA;
    this.save();
  }

  unpairAssembly(assemblyId) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly || !assembly.partnerAssemblyId) return;
    const partner = this._assemblies.get(assembly.partnerAssemblyId);
    if (partner) partner.partnerAssemblyId = null;
    assembly.partnerAssemblyId = null;
    this.save();
  }

  pairAndSplitAssemblies(assemblyIdA, assemblyIdB) {
    const a = this._assemblies.get(assemblyIdA);
    const b = this._assemblies.get(assemblyIdB);
    if (!a || !b) return;

    a.partnerAssemblyId = assemblyIdB;
    b.partnerAssemblyId = assemblyIdA;

    const hingeA = a.primaryHingePos;
    const hingeB = b.primaryHingePos;
    const axis = hingeA.x !== hingeB.x ? "x" : "z";
    const minVal = Math.min(hingeA[axis], hingeB[axis]);
    const maxVal = Math.max(hingeA[axis], hingeB[axis]);
    const midpoint = (minVal + maxVal) / 2;

    const allPanels = [...a.panelPositions, ...b.panelPositions];
    const seen = new Set();
    const unique = [];
    for (const p of allPanels) {
      const key = posKey(p.closedPos);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    }

    for (const p of allPanels) {
      this._positionIndex.delete(posKey(p.currentPos));
    }

    const panelsA = [];
    const panelsB = [];
    for (const p of unique) {
      const v = p.closedPos[axis];
      if (v <= minVal || v >= maxVal) continue;
      if (v < midpoint) panelsA.push(p);
      else if (v > midpoint) panelsB.push(p);
    }

    const aIsMin = hingeA[axis] < hingeB[axis];
    a.panelPositions = aIsMin ? panelsA : panelsB;
    b.panelPositions = aIsMin ? panelsB : panelsA;

    for (const p of a.panelPositions) {
      this._positionIndex.set(posKey(p.currentPos), assemblyIdA);
    }
    for (const p of b.panelPositions) {
      this._positionIndex.set(posKey(p.currentPos), assemblyIdB);
    }

    this.save();
  }

  closeDoor(assemblyId) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;

    for (const panel of assembly.panelPositions) {
      this._positionIndex.delete(posKey(panel.currentPos));
    }

    assembly.updatePanelPositions(
      assembly.panelPositions.map((p) => p.closedPos)
    );
    assembly.isOpen = false;
    assembly.openDirection = "";

    for (const panel of assembly.panelPositions) {
      this._positionIndex.set(posKey(panel.currentPos), assemblyId);
    }

    this.save();
  }
}
