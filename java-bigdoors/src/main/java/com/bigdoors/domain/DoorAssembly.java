package com.bigdoors.domain;

import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Represents a single door assembly: its hinges, panels, facing, and open/close state.
 * Pure domain class — no Minecraft imports allowed.
 */
public class DoorAssembly {

    private static final AtomicInteger ID_COUNTER = new AtomicInteger(0);

    private final String id;
    private BlockPos3 primaryHingePos;
    private final List<HingeRecord> hingePositions;
    private final List<PanelEntry> panelPositions;
    private final List<PanelEntry> boundaryPanels;
    private String facing;
    private String doorSide;
    private String mode;
    private boolean isOpen;
    private String openDirection;
    private String partnerAssemblyId;

    public record HingeRecord(BlockPos3 pos, String type, int materialIndex) {}

    public record PanelEntry(int materialIndex, BlockPos3 closedPos, BlockPos3 currentPos,
                             Integer geometryId, int overlay) {
        public PanelEntry(int materialIndex, BlockPos3 closedPos, BlockPos3 currentPos) {
            this(materialIndex, closedPos, currentPos, null, 0);
        }

        public PanelEntry withCurrentPos(BlockPos3 newCurrentPos) {
            return new PanelEntry(materialIndex, closedPos, newCurrentPos, geometryId, overlay);
        }
    }

    public DoorAssembly(String id, BlockPos3 primaryHingePos, String facing, String mode) {
        this(id, primaryHingePos, facing, mode, "hinge", Constants.UNMATCHED_MATERIAL_INDEX);
    }

    public DoorAssembly(String id, BlockPos3 primaryHingePos, String facing, String mode,
                        String hingeType, int hingeMaterialIndex) {
        this.id = (id != null) ? id : "assembly_" + ID_COUNTER.getAndIncrement();
        this.primaryHingePos = primaryHingePos;
        this.hingePositions = new ArrayList<>();
        this.hingePositions.add(new HingeRecord(primaryHingePos, hingeType, hingeMaterialIndex));
        this.panelPositions = new ArrayList<>();
        this.boundaryPanels = new ArrayList<>();
        this.facing = facing;
        this.doorSide = null;
        this.mode = mode;
        this.isOpen = false;
        this.openDirection = null;
        this.partnerAssemblyId = null;
    }

    // --- Mutators ---

    public void addHinge(BlockPos3 pos) {
        hingePositions.add(new HingeRecord(pos, "hinge", Constants.UNMATCHED_MATERIAL_INDEX));
    }

    public void addHingeRecord(BlockPos3 pos, String type, int materialIndex) {
        hingePositions.add(new HingeRecord(pos, type, materialIndex));
    }

    public boolean removeHinge(BlockPos3 pos) {
        return hingePositions.removeIf(h -> h.pos().equals(pos));
    }

    public void addPanel(BlockPos3 pos, int materialIndex) {
        panelPositions.add(new PanelEntry(materialIndex, pos, pos));
    }

    public void addPanel(BlockPos3 pos, int materialIndex, Integer geometryId, int overlay) {
        panelPositions.add(new PanelEntry(materialIndex, pos, pos, geometryId, overlay));
    }

    public boolean removePanel(BlockPos3 pos) {
        return panelPositions.removeIf(p ->
                p.currentPos().equals(pos) || p.closedPos().equals(pos));
    }

    public void addBoundaryPanel(BlockPos3 pos, int materialIndex, Integer geometryId, int overlay) {
        boundaryPanels.add(new PanelEntry(materialIndex, pos, pos, geometryId, overlay));
    }

    public boolean removeBoundaryPanel(BlockPos3 pos) {
        return boundaryPanels.removeIf(p ->
                p.currentPos().equals(pos) || p.closedPos().equals(pos));
    }

    public void updatePanelPositions(List<BlockPos3> newPositions) {
        if (newPositions.size() != panelPositions.size()) {
            throw new IllegalArgumentException(
                    "Position list size " + newPositions.size() +
                    " does not match panel count " + panelPositions.size());
        }
        for (int i = 0; i < panelPositions.size(); i++) {
            panelPositions.set(i, panelPositions.get(i).withCurrentPos(newPositions.get(i)));
        }
    }

    public void setPrimaryHingePos(BlockPos3 pos) {
        this.primaryHingePos = pos;
    }

    // --- Queries ---

    public List<BlockPos3> getAllCurrentPositions() {
        List<BlockPos3> result = new ArrayList<>(panelPositions.size());
        for (PanelEntry p : panelPositions) {
            result.add(p.currentPos());
        }
        return result;
    }

    public List<BlockPos3> getHingeBlockPositions() {
        List<BlockPos3> result = new ArrayList<>(hingePositions.size());
        for (HingeRecord h : hingePositions) {
            result.add(h.pos());
        }
        return result;
    }

    public String getHingeType() {
        if (hingePositions.isEmpty()) return "hinge";
        return hingePositions.get(0).type();
    }

    // --- Getters / Setters ---

    public String getId() { return id; }
    public BlockPos3 getPrimaryHingePos() { return primaryHingePos; }
    public List<HingeRecord> getHingePositions() { return hingePositions; }
    public List<PanelEntry> getPanelPositions() { return panelPositions; }
    public List<PanelEntry> getBoundaryPanels() { return boundaryPanels; }
    public String getFacing() { return facing; }
    public void setFacing(String facing) { this.facing = facing; }
    public String getDoorSide() { return doorSide; }
    public void setDoorSide(String doorSide) { this.doorSide = doorSide; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public boolean isOpen() { return isOpen; }
    public void setOpen(boolean open) { isOpen = open; }
    public String getOpenDirection() { return openDirection; }
    public void setOpenDirection(String openDirection) { this.openDirection = openDirection; }
    public String getPartnerAssemblyId() { return partnerAssemblyId; }
    public void setPartnerAssemblyId(String partnerAssemblyId) { this.partnerAssemblyId = partnerAssemblyId; }

    // --- JSON serialization ---

    public JsonObject toJson() {
        JsonObject obj = new JsonObject();
        toJson(obj);
        return obj;
    }

    public void toJson(JsonObject obj) {
        obj.addProperty("id", id);
        obj.add("primaryHingePos", posToJson(primaryHingePos));
        obj.addProperty("facing", facing);
        obj.addProperty("mode", mode);
        obj.addProperty("isOpen", isOpen);

        if (doorSide != null) obj.addProperty("doorSide", doorSide);
        if (openDirection != null) obj.addProperty("openDirection", openDirection);
        if (partnerAssemblyId != null) obj.addProperty("partnerAssemblyId", partnerAssemblyId);

        JsonArray hinges = new JsonArray();
        for (HingeRecord h : hingePositions) {
            JsonObject hr = new JsonObject();
            hr.add("pos", posToJson(h.pos()));
            hr.addProperty("type", h.type());
            hr.addProperty("materialIndex", h.materialIndex());
            hinges.add(hr);
        }
        obj.add("hingePositions", hinges);

        obj.add("panelPositions", panelListToJson(panelPositions));

        if (!boundaryPanels.isEmpty()) {
            obj.add("boundaryPanels", panelListToJson(boundaryPanels));
        }
    }

    private static JsonArray panelListToJson(List<PanelEntry> panels) {
        JsonArray arr = new JsonArray();
        for (PanelEntry p : panels) {
            JsonObject pe = new JsonObject();
            pe.addProperty("materialIndex", p.materialIndex());
            pe.add("closedPos", posToJson(p.closedPos()));
            pe.add("currentPos", posToJson(p.currentPos()));
            if (p.geometryId() != null) {
                pe.addProperty("geometryId", p.geometryId());
            }
            if (p.overlay() != 0) {
                pe.addProperty("overlay", p.overlay());
            }
            arr.add(pe);
        }
        return arr;
    }

    public static DoorAssembly fromJson(JsonObject obj) {
        String id = obj.get("id").getAsString();
        BlockPos3 primaryHinge = posFromJson(obj.getAsJsonObject("primaryHingePos"));
        String facing = obj.get("facing").getAsString();
        String mode = obj.get("mode").getAsString();

        DoorAssembly assembly = new DoorAssembly(id, primaryHinge, facing, mode);
        assembly.isOpen = obj.get("isOpen").getAsBoolean();

        if (obj.has("doorSide")) assembly.doorSide = obj.get("doorSide").getAsString();
        if (obj.has("openDirection")) assembly.openDirection = obj.get("openDirection").getAsString();
        if (obj.has("partnerAssemblyId")) assembly.partnerAssemblyId = obj.get("partnerAssemblyId").getAsString();

        // Clear the default primary hinge added by constructor, reload from JSON
        assembly.hingePositions.clear();
        JsonArray hinges = obj.getAsJsonArray("hingePositions");
        for (int i = 0; i < hinges.size(); i++) {
            JsonElement elem = hinges.get(i);
            if (elem.isJsonObject() && elem.getAsJsonObject().has("pos")) {
                // New format: HingeRecord with pos, type, materialIndex
                JsonObject hr = elem.getAsJsonObject();
                BlockPos3 pos = posFromJson(hr.getAsJsonObject("pos"));
                String type = hr.has("type") ? hr.get("type").getAsString() : "hinge";
                int materialIndex = hr.has("materialIndex") ? hr.get("materialIndex").getAsInt() : Constants.UNMATCHED_MATERIAL_INDEX;
                assembly.hingePositions.add(new HingeRecord(pos, type, materialIndex));
            } else {
                // Old format: plain BlockPos3
                BlockPos3 pos = posFromJson(elem.getAsJsonObject());
                assembly.hingePositions.add(new HingeRecord(pos, "hinge", Constants.UNMATCHED_MATERIAL_INDEX));
            }
        }

        JsonArray panels = obj.getAsJsonArray("panelPositions");
        for (int i = 0; i < panels.size(); i++) {
            assembly.panelPositions.add(panelEntryFromJson(panels.get(i).getAsJsonObject()));
        }

        if (obj.has("boundaryPanels")) {
            JsonArray bp = obj.getAsJsonArray("boundaryPanels");
            for (int i = 0; i < bp.size(); i++) {
                assembly.boundaryPanels.add(panelEntryFromJson(bp.get(i).getAsJsonObject()));
            }
        }

        return assembly;
    }

    private static PanelEntry panelEntryFromJson(JsonObject pe) {
        int matIdx = pe.get("materialIndex").getAsInt();
        BlockPos3 closedPos = posFromJson(pe.getAsJsonObject("closedPos"));
        BlockPos3 currentPos = posFromJson(pe.getAsJsonObject("currentPos"));
        Integer geometryId = pe.has("geometryId") ? pe.get("geometryId").getAsInt() : null;
        int overlay = pe.has("overlay") ? pe.get("overlay").getAsInt() : 0;
        return new PanelEntry(matIdx, closedPos, currentPos, geometryId, overlay);
    }

    // --- Helpers ---

    private static JsonObject posToJson(BlockPos3 pos) {
        JsonObject obj = new JsonObject();
        obj.addProperty("x", pos.x());
        obj.addProperty("y", pos.y());
        obj.addProperty("z", pos.z());
        return obj;
    }

    private static BlockPos3 posFromJson(JsonObject obj) {
        return new BlockPos3(
                obj.get("x").getAsInt(),
                obj.get("y").getAsInt(),
                obj.get("z").getAsInt()
        );
    }
}
