package com.bigdoors.domain;

import com.bigdoors.util.BlockPos3;
import com.google.gson.JsonArray;
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
    private final BlockPos3 primaryHingePos;
    private final List<BlockPos3> hingePositions;
    private final List<PanelEntry> panelPositions;
    private String facing;
    private String doorSide;
    private String mode;
    private boolean isOpen;
    private String openDirection;
    private String partnerAssemblyId;

    /**
     * A single door panel with its material index and positions.
     */
    public record PanelEntry(int materialIndex, BlockPos3 closedPos, BlockPos3 currentPos) {
        public PanelEntry withCurrentPos(BlockPos3 newCurrentPos) {
            return new PanelEntry(materialIndex, closedPos, newCurrentPos);
        }
    }

    public DoorAssembly(String id, BlockPos3 primaryHingePos, String facing, String mode) {
        this.id = (id != null) ? id : "assembly_" + ID_COUNTER.getAndIncrement();
        this.primaryHingePos = primaryHingePos;
        this.hingePositions = new ArrayList<>();
        this.hingePositions.add(primaryHingePos);
        this.panelPositions = new ArrayList<>();
        this.facing = facing;
        this.doorSide = null;
        this.mode = mode;
        this.isOpen = false;
        this.openDirection = null;
        this.partnerAssemblyId = null;
    }

    // --- Mutators ---

    public void addHinge(BlockPos3 pos) {
        hingePositions.add(pos);
    }

    public void addPanel(BlockPos3 pos, int materialIndex) {
        panelPositions.add(new PanelEntry(materialIndex, pos, pos));
    }

    public boolean removePanel(BlockPos3 pos) {
        return panelPositions.removeIf(p ->
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

    // --- Queries ---

    public List<BlockPos3> getAllCurrentPositions() {
        List<BlockPos3> result = new ArrayList<>(panelPositions.size());
        for (PanelEntry p : panelPositions) {
            result.add(p.currentPos());
        }
        return result;
    }

    // --- Getters / Setters ---

    public String getId() { return id; }
    public BlockPos3 getPrimaryHingePos() { return primaryHingePos; }
    public List<BlockPos3> getHingePositions() { return hingePositions; }
    public List<PanelEntry> getPanelPositions() { return panelPositions; }
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
        for (BlockPos3 h : hingePositions) {
            hinges.add(posToJson(h));
        }
        obj.add("hingePositions", hinges);

        JsonArray panels = new JsonArray();
        for (PanelEntry p : panelPositions) {
            JsonObject pe = new JsonObject();
            pe.addProperty("materialIndex", p.materialIndex());
            pe.add("closedPos", posToJson(p.closedPos()));
            pe.add("currentPos", posToJson(p.currentPos()));
            panels.add(pe);
        }
        obj.add("panelPositions", panels);
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
            assembly.hingePositions.add(posFromJson(hinges.get(i).getAsJsonObject()));
        }

        JsonArray panels = obj.getAsJsonArray("panelPositions");
        for (int i = 0; i < panels.size(); i++) {
            JsonObject pe = panels.get(i).getAsJsonObject();
            int matIdx = pe.get("materialIndex").getAsInt();
            BlockPos3 closedPos = posFromJson(pe.getAsJsonObject("closedPos"));
            BlockPos3 currentPos = posFromJson(pe.getAsJsonObject("currentPos"));
            assembly.panelPositions.add(new PanelEntry(matIdx, closedPos, currentPos));
        }

        return assembly;
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
