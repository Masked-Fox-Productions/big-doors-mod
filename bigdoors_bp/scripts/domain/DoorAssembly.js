/**
 * Domain object representing one door assembly.
 *
 * Domain layer — no @minecraft/server imports.
 */

import { UNMATCHED_MATERIAL_INDEX } from "../util/Constants.js";
import { posKey } from "../util/posKey.js";

let _nextId = 1;

export class DoorAssembly {
  /**
   * @param {string} id                  Unique assembly identifier
   * @param {{x:number,y:number,z:number}} primaryHingePos  Lowest hinge position
   * @param {string} facing              'north'|'south'|'east'|'west'
   * @param {string} mode                'horizontal'|'vertical'
   * @param {string} [hingeType]         'hinge'|'hidden'|'winch'|'hidden_winch'
   */
  constructor(id, primaryHingePos, facing, mode, hingeType = "hinge") {
    this.id = id ?? `assembly_${_nextId++}`;
    this.primaryHingePos = { ...primaryHingePos };
    this.hingePositions = [{ ...primaryHingePos, type: hingeType, materialIndex: UNMATCHED_MATERIAL_INDEX }];
    /** @type {Array<{materialIndex:number, closedPos:{x:number,y:number,z:number}, currentPos:{x:number,y:number,z:number}}>} */
    this.panelPositions = [];
    /** @type {Array<{materialIndex:number, closedPos:{x:number,y:number,z:number}, currentPos:{x:number,y:number,z:number}}>} */
    this.boundaryPanels = [];
    this.facing = facing;
    this.doorSide = "";      // direction of the door side (n/s/e/w), empty until set
    this.mode = mode;        // 'horizontal' or 'vertical'
    this.isOpen = false;
    this.openDirection = "";  // 'cw' or 'ccw', set when opened
    this.partnerAssemblyId = null;
    /** @type {{x:number,y:number,z:number}|null} */
    this.redstoneSource = null;
  }

  /**
   * The type of the primary (first-placed) hinge determines assembly overlay behavior.
   */
  get hingeType() {
    return this.hingePositions[0]?.type ?? "hinge";
  }

  /**
   * Add a hinge position to this assembly.
   */
  addHinge(pos, type = "hinge") {
    this.hingePositions.push({ ...pos, type, materialIndex: UNMATCHED_MATERIAL_INDEX });
  }

  addHingeRecord(record) {
    this.hingePositions.push({ x: record.x, y: record.y, z: record.z, type: record.type, materialIndex: record.materialIndex });
  }

  removeHinge(pos) {
    const idx = this.hingePositions.findIndex(
      (h) => h.x === pos.x && h.y === pos.y && h.z === pos.z
    );
    if (idx !== -1) this.hingePositions.splice(idx, 1);
    return idx !== -1;
  }

  /**
   * Add a panel to this assembly.
   */
  addPanel(pos, materialIndex, geometryId, overlay = 0) {
    const panel = {
      materialIndex,
      overlay,
      closedPos: { ...pos },
      currentPos: { ...pos },
    };
    if (geometryId !== undefined) panel.geometryId = geometryId;
    this.panelPositions.push(panel);
  }

  /**
   * Remove a panel at the given position (matches currentPos).
   * Returns true if a panel was removed.
   */
  removePanel(pos) {
    const key = posKey(pos);
    const idx = this.panelPositions.findIndex(
      (p) => posKey(p.currentPos) === key
    );
    if (idx === -1) {
      const idx2 = this.panelPositions.findIndex(
        (p) => posKey(p.closedPos) === key
      );
      if (idx2 !== -1) {
        this.panelPositions.splice(idx2, 1);
        return true;
      }
      return this.removeBoundaryPanel(pos);
    }
    this.panelPositions.splice(idx, 1);
    return true;
  }

  removeBoundaryPanel(pos) {
    const key = posKey(pos);
    const idx = this.boundaryPanels.findIndex(
      (p) => posKey(p.currentPos) === key || posKey(p.closedPos) === key
    );
    if (idx === -1) return false;
    this.boundaryPanels.splice(idx, 1);
    return true;
  }

  /**
   * Update the currentPos for all panels to the provided new positions.
   * @param {Array<{x:number,y:number,z:number}>} newPositions — same length as panelPositions
   */
  updatePanelPositions(newPositions) {
    for (let i = 0; i < this.panelPositions.length; i++) {
      this.panelPositions[i].currentPos = { ...newPositions[i] };
    }
  }

  /**
   * Return all current panel positions (rotated if open, closed otherwise).
   */
  getAllCurrentPositions() {
    return this.panelPositions.map((p) => ({ ...p.currentPos }));
  }

  /**
   * Serialize to a plain JSON-safe object.
   */
  toJSON() {
    return {
      id: this.id,
      primaryHingePos: this.primaryHingePos,
      hingePositions: this.hingePositions.map((h) => ({
        x: h.x, y: h.y, z: h.z,
        type: h.type,
        materialIndex: h.materialIndex,
      })),
      panelPositions: this.panelPositions.map((p) => {
        const obj = { materialIndex: p.materialIndex, overlay: p.overlay ?? 0, closedPos: p.closedPos, currentPos: p.currentPos };
        if (p.geometryId !== undefined) obj.geometryId = p.geometryId;
        return obj;
      }),
      boundaryPanels: this.boundaryPanels.map((p) => ({
        materialIndex: p.materialIndex,
        overlay: p.overlay ?? 0,
        closedPos: p.closedPos,
        currentPos: p.currentPos,
      })),
      facing: this.facing,
      doorSide: this.doorSide,
      mode: this.mode,
      isOpen: this.isOpen,
      openDirection: this.openDirection,
      partnerAssemblyId: this.partnerAssemblyId,
      ...(this.redstoneSource ? { redstoneSource: this.redstoneSource } : {}),
    };
  }

  /**
   * Reconstruct a DoorAssembly from a plain JSON object.
   */
  static fromJSON(json) {
    const primaryType = json.hingePositions?.[0]?.type ?? "hinge";
    const assembly = new DoorAssembly(
      json.id,
      json.primaryHingePos,
      json.facing,
      json.mode,
      primaryType
    );
    assembly.hingePositions = json.hingePositions.map((p) => ({
      x: p.x, y: p.y, z: p.z,
      type: p.type ?? "hinge",
      materialIndex: p.materialIndex ?? UNMATCHED_MATERIAL_INDEX,
    }));
    assembly.panelPositions = (json.panelPositions || []).map((p) => {
      const panel = {
        materialIndex: p.materialIndex,
        overlay: p.overlay ?? 0,
        closedPos: { ...p.closedPos },
        currentPos: { ...p.currentPos },
      };
      if (p.geometryId !== undefined) panel.geometryId = p.geometryId;
      return panel;
    });
    assembly.boundaryPanels = (json.boundaryPanels || []).map((p) => ({
      materialIndex: p.materialIndex,
      overlay: p.overlay ?? 0,
      closedPos: { ...p.closedPos },
      currentPos: { ...p.currentPos },
    }));
    assembly.doorSide = json.doorSide || "";
    assembly.isOpen = json.isOpen ?? false;
    assembly.openDirection = json.openDirection || "";
    assembly.partnerAssemblyId = json.partnerAssemblyId ?? null;
    assembly.redstoneSource = json.redstoneSource ? { ...json.redstoneSource } : null;
    return assembly;
  }
}
