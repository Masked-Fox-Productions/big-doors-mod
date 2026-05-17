/**
 * Domain object representing one door assembly.
 *
 * Domain layer — no @minecraft/server imports.
 */

let _nextId = 1;

/**
 * Generate a position key string for map lookups.
 */
function posKey(pos) {
  return `${pos.x},${pos.y},${pos.z}`;
}

export class DoorAssembly {
  /**
   * @param {string} id                  Unique assembly identifier
   * @param {{x:number,y:number,z:number}} primaryHingePos  Lowest hinge position
   * @param {string} facing              'north'|'south'|'east'|'west'
   * @param {string} mode                'horizontal'|'vertical'
   */
  constructor(id, primaryHingePos, facing, mode) {
    this.id = id ?? `assembly_${_nextId++}`;
    this.primaryHingePos = { ...primaryHingePos };
    this.hingePositions = [{ ...primaryHingePos }];
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
   * Add a hinge position to this assembly.
   */
  addHinge(pos) {
    this.hingePositions.push({ ...pos });
  }

  /**
   * Add a panel to this assembly.
   */
  addPanel(pos, materialIndex, geometryId) {
    const panel = {
      materialIndex,
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
      hingePositions: this.hingePositions,
      panelPositions: this.panelPositions.map((p) => {
        const obj = { materialIndex: p.materialIndex, closedPos: p.closedPos, currentPos: p.currentPos };
        if (p.geometryId !== undefined) obj.geometryId = p.geometryId;
        return obj;
      }),
      boundaryPanels: this.boundaryPanels.map((p) => ({
        materialIndex: p.materialIndex,
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
    const assembly = new DoorAssembly(
      json.id,
      json.primaryHingePos,
      json.facing,
      json.mode
    );
    assembly.hingePositions = json.hingePositions.map((p) => ({ ...p }));
    assembly.panelPositions = (json.panelPositions || []).map((p) => {
      const panel = {
        materialIndex: p.materialIndex,
        closedPos: { ...p.closedPos },
        currentPos: { ...p.currentPos },
      };
      if (p.geometryId !== undefined) panel.geometryId = p.geometryId;
      return panel;
    });
    assembly.boundaryPanels = (json.boundaryPanels || []).map((p) => ({
      materialIndex: p.materialIndex,
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
