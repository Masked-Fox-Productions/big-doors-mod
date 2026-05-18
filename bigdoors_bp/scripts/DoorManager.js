import { world } from "@minecraft/server";
import { DoorAssembly } from "./domain/DoorAssembly.js";
import { PERSISTENCE_KEY, UNMATCHED_MATERIAL_INDEX } from "./util/Constants.js";
import { posKey } from "./util/posKey.js";

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
      for (const panel of assembly.boundaryPanels) {
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

  createAssembly(hingePos, facing, mode, hingeType = "hinge") {
    const id = `door_${this._nextId++}`;
    const assembly = new DoorAssembly(id, hingePos, facing, mode, hingeType);
    this._assemblies.set(id, assembly);
    this._positionIndex.set(posKey(hingePos), id);
    this.save();
    return assembly;
  }

  addHingeToAssembly(assemblyId, hingePos, hingeType = "hinge") {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    assembly.addHinge(hingePos, hingeType);
    this._positionIndex.set(posKey(hingePos), assemblyId);
    this.save();
  }

  setDoorSide(assemblyId, doorSide) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    assembly.doorSide = doorSide;
    this.save();
  }

  setMode(assemblyId, mode) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    assembly.mode = mode;
    this.save();
  }

  addPanelToAssembly(assemblyId, panelPos, materialIndex, geometryId, overlay = 0) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    assembly.addPanel(panelPos, materialIndex, geometryId, overlay);
    this._positionIndex.set(posKey(panelPos), assemblyId);
    this.save();
  }

  removePanelFromAssembly(assemblyId, panelPos) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    assembly.removePanel(panelPos);
    this._positionIndex.delete(posKey(panelPos));

    if (assembly.panelPositions.length === 0) {
      this.resetAssembly(assemblyId);
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
    for (const panel of assembly.boundaryPanels) {
      this._positionIndex.delete(posKey(panel.currentPos));
    }

    this._assemblies.delete(assemblyId);
    this.save();
  }

  mergeAssemblies(canonicalId, ...otherIds) {
    const canonical = this._assemblies.get(canonicalId);
    if (!canonical) return;

    for (const otherId of otherIds) {
      const absorbed = this._assemblies.get(otherId);
      if (!absorbed) continue;

      if (absorbed.partnerAssemblyId) {
        if (canonical.partnerAssemblyId && canonical.partnerAssemblyId !== absorbed.partnerAssemblyId) {
          this.unpairAssembly(otherId);
        } else if (!canonical.partnerAssemblyId) {
          const partner = this._assemblies.get(absorbed.partnerAssemblyId);
          if (partner) partner.partnerAssemblyId = canonicalId;
          canonical.partnerAssemblyId = absorbed.partnerAssemblyId;
          absorbed.partnerAssemblyId = null;
        }
      }

      for (const hinge of absorbed.hingePositions) {
        canonical.addHingeRecord(hinge);
        this._positionIndex.set(posKey(hinge), canonicalId);
      }

      for (const panel of absorbed.panelPositions) {
        canonical.panelPositions.push(panel);
        this._positionIndex.set(posKey(panel.currentPos), canonicalId);
      }

      for (const panel of absorbed.boundaryPanels) {
        canonical.boundaryPanels.push(panel);
        this._positionIndex.set(posKey(panel.currentPos), canonicalId);
      }

      this._assemblies.delete(otherId);
    }

    const axis = canonical.mode === "horizontal" ? "y" : (canonical.facing === "north" || canonical.facing === "south" ? "x" : "z");
    let min = canonical.hingePositions[0];
    for (const h of canonical.hingePositions) {
      if (h[axis] < min[axis]) min = h;
    }
    canonical.primaryHingePos = { x: min.x, y: min.y, z: min.z };

    this.save();
  }

  removeHingeFromAssembly(assemblyId, hingePos) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return { status: "kept", assembly: null };

    assembly.removeHinge(hingePos);
    this._positionIndex.delete(posKey(hingePos));

    if (assembly.hingePositions.length === 0) {
      if (assembly.partnerAssemblyId) this.unpairAssembly(assemblyId);
      return { status: "dissolve_required", assembly };
    }

    const axis = assembly.mode === "horizontal" ? "y" : (assembly.facing === "north" || assembly.facing === "south" ? "x" : "z");
    const sorted = assembly.hingePositions.map(h => h[axis]).sort((a, b) => a - b);
    let contiguous = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] !== 1) { contiguous = false; break; }
    }

    if (!contiguous) {
      if (assembly.partnerAssemblyId) this.unpairAssembly(assemblyId);
      return { status: "dissolve_required", assembly };
    }

    let min = assembly.hingePositions[0];
    for (const h of assembly.hingePositions) {
      if (h[axis] < min[axis]) min = h;
    }
    assembly.primaryHingePos = { x: min.x, y: min.y, z: min.z };

    this.save();
    return { status: "kept", assembly };
  }

  resetAssembly(assemblyId) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;

    if (assembly.partnerAssemblyId) {
      this.unpairAssembly(assemblyId);
    }

    for (const panel of assembly.panelPositions) {
      this._positionIndex.delete(posKey(panel.currentPos));
    }
    for (const panel of assembly.boundaryPanels) {
      this._positionIndex.delete(posKey(panel.currentPos));
    }

    assembly.panelPositions = [];
    assembly.boundaryPanels = [];
    assembly.doorSide = "";
    assembly.mode = "";
    assembly.isOpen = false;
    assembly.openDirection = "";
    assembly.redstoneSource = null;
    for (const hinge of assembly.hingePositions) {
      hinge.materialIndex = UNMATCHED_MATERIAL_INDEX;
    }

    this.save();
  }

  getAssembly(assemblyId) {
    return this._assemblies.get(assemblyId) ?? null;
  }

  getAllAssemblies() {
    return this._assemblies.values();
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

    if (assembly.boundaryPanels.length > 0) {
      for (const p of assembly.boundaryPanels) {
        assembly.panelPositions.push(p);
      }
      assembly.boundaryPanels = [];
    }
    if (partner && partner.boundaryPanels.length > 0) {
      for (const p of partner.boundaryPanels) {
        partner.panelPositions.push(p);
      }
      partner.boundaryPanels = [];
    }

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
    const droppedPanels = [];
    for (const p of unique) {
      const v = p.closedPos[axis];
      if (v <= minVal || v >= maxVal) {
        droppedPanels.push(p);
        continue;
      }
      if (v < midpoint) panelsA.push(p);
      else if (v > midpoint) panelsB.push(p);
      else droppedPanels.push(p);
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

    for (const p of droppedPanels) {
      p.overlay = 0;
    }
    a.boundaryPanels = droppedPanels;
    for (const p of droppedPanels) {
      this._positionIndex.set(posKey(p.currentPos), assemblyIdA);
    }

    this.save();
  }

  resplitAssemblies(assemblyIdA, assemblyIdB) {
    const a = this._assemblies.get(assemblyIdA);
    const b = this._assemblies.get(assemblyIdB);
    if (!a || !b) return;

    const hingeA = a.primaryHingePos;
    const hingeB = b.primaryHingePos;
    const axis = hingeA.x !== hingeB.x ? "x" : "z";
    const minVal = Math.min(hingeA[axis], hingeB[axis]);
    const maxVal = Math.max(hingeA[axis], hingeB[axis]);
    const midpoint = (minVal + maxVal) / 2;

    const allPanels = [...a.panelPositions, ...b.panelPositions, ...a.boundaryPanels, ...b.boundaryPanels];
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
    const droppedPanels = [];
    for (const p of unique) {
      const v = p.closedPos[axis];
      if (v <= minVal || v >= maxVal) {
        droppedPanels.push(p);
        continue;
      }
      if (v < midpoint) panelsA.push(p);
      else if (v > midpoint) panelsB.push(p);
      else droppedPanels.push(p);
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

    for (const p of droppedPanels) {
      p.overlay = 0;
    }
    a.boundaryPanels = droppedPanels;
    for (const p of droppedPanels) {
      this._positionIndex.set(posKey(p.currentPos), assemblyIdA);
    }

    this.save();
  }

  setHingeMaterialIndex(assemblyId, materialIndex) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    for (const hinge of assembly.hingePositions) {
      hinge.materialIndex = materialIndex;
    }
    this.save();
  }

  setRedstoneSource(assemblyId, pos) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    assembly.redstoneSource = pos ? { ...pos } : null;
    this.save();
  }

  clearRedstoneSource(assemblyId) {
    const assembly = this._assemblies.get(assemblyId);
    if (!assembly) return;
    assembly.redstoneSource = null;
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
