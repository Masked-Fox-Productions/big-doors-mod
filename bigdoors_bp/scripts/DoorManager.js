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
    this._loaded = false;
    this._nextId = 1;
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
