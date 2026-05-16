package com.bigdoors;

import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.util.BlockPos3;
import com.google.gson.JsonArray;
import com.google.gson.JsonParser;
import net.minecraft.core.BlockPos;

import java.util.*;

/**
 * Server-scoped state manager tracking all door assemblies and a position index.
 * Uses domain BlockPos3 throughout, except conversionInProgress which uses MC BlockPos.
 */
public class DoorManager {

    private final Map<String, DoorAssembly> assemblies = new LinkedHashMap<>();
    private final Map<String, String> positionIndex = new HashMap<>();
    private final Set<BlockPos> conversionInProgress = new HashSet<>();
    private final Map<String, Long> redstoneDebounce = new HashMap<>();
    private int nextId = 1;
    private Runnable saveCallback;

    public void setSaveCallback(Runnable callback) {
        this.saveCallback = callback;
    }

    // --- Persistence ---

    public void load(String jsonString) {
        assemblies.clear();
        positionIndex.clear();

        JsonArray data = JsonParser.parseString(jsonString).getAsJsonArray();
        for (int i = 0; i < data.size(); i++) {
            DoorAssembly assembly = DoorAssembly.fromJson(data.get(i).getAsJsonObject());
            assemblies.put(assembly.getId(), assembly);

            for (BlockPos3 hPos : assembly.getHingePositions()) {
                positionIndex.put(hPos.toKey(), assembly.getId());
            }
            for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
                positionIndex.put(panel.currentPos().toKey(), assembly.getId());
            }

            // Update nextId based on "door_N" pattern
            String id = assembly.getId();
            if (id.startsWith("door_")) {
                try {
                    int numPart = Integer.parseInt(id.substring(5));
                    if (numPart >= nextId) {
                        nextId = numPart + 1;
                    }
                } catch (NumberFormatException ignored) {}
            }
        }
    }

    public String serialize() {
        JsonArray data = new JsonArray();
        for (DoorAssembly assembly : assemblies.values()) {
            data.add(assembly.toJson());
        }
        return data.toString();
    }

    public void save() {
        if (saveCallback != null) {
            saveCallback.run();
        }
    }

    // --- Assembly CRUD ---

    public DoorAssembly createAssembly(BlockPos3 hingePos, String facing, String mode) {
        String id = "door_" + nextId++;
        DoorAssembly assembly = new DoorAssembly(id, hingePos, facing, mode);
        assemblies.put(id, assembly);
        positionIndex.put(hingePos.toKey(), id);
        save();
        return assembly;
    }

    public void addHingeToAssembly(String assemblyId, BlockPos3 hingePos) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;
        assembly.addHinge(hingePos);
        positionIndex.put(hingePos.toKey(), assemblyId);
        save();
    }

    public void setDoorSide(String assemblyId, String doorSide) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;
        assembly.setDoorSide(doorSide);
        save();
    }

    public void addPanelToAssembly(String assemblyId, BlockPos3 panelPos, int materialIndex) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;
        assembly.addPanel(panelPos, materialIndex);
        positionIndex.put(panelPos.toKey(), assemblyId);
        save();
    }

    public void removePanelFromAssembly(String assemblyId, BlockPos3 panelPos) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;
        assembly.removePanel(panelPos);
        positionIndex.remove(panelPos.toKey());

        if (assembly.getPanelPositions().isEmpty()) {
            dissolveAssembly(assemblyId);
        } else {
            save();
        }
    }

    public DoorAssembly findByPosition(BlockPos3 pos) {
        String id = positionIndex.get(pos.toKey());
        if (id == null) return null;
        return assemblies.getOrDefault(id, null);
    }

    public DoorAssembly getAssembly(String assemblyId) {
        return assemblies.getOrDefault(assemblyId, null);
    }

    public void dissolveAssembly(String assemblyId) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;

        for (BlockPos3 hPos : assembly.getHingePositions()) {
            positionIndex.remove(hPos.toKey());
        }
        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            positionIndex.remove(panel.currentPos().toKey());
        }

        assemblies.remove(assemblyId);
        save();
    }

    // --- Open / Close ---

    public void openDoor(String assemblyId, String direction, List<BlockPos3> newPositions) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;

        // Remove old positions from index
        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            positionIndex.remove(panel.currentPos().toKey());
        }

        assembly.updatePanelPositions(newPositions);
        assembly.setOpen(true);
        assembly.setOpenDirection(direction);

        // Add new positions to index
        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            positionIndex.put(panel.currentPos().toKey(), assemblyId);
        }

        save();
    }

    public void closeDoor(String assemblyId) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;

        // Remove current positions from index
        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            positionIndex.remove(panel.currentPos().toKey());
        }

        // Reset to closed positions
        List<BlockPos3> closedPositions = new ArrayList<>();
        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            closedPositions.add(panel.closedPos());
        }
        assembly.updatePanelPositions(closedPositions);
        assembly.setOpen(false);
        assembly.setOpenDirection(null);

        // Re-index closed positions
        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            positionIndex.put(panel.currentPos().toKey(), assemblyId);
        }

        save();
    }

    // --- Pairing ---

    public void pairAssemblies(String assemblyIdA, String assemblyIdB) {
        DoorAssembly a = assemblies.get(assemblyIdA);
        DoorAssembly b = assemblies.get(assemblyIdB);
        if (a == null || b == null) return;
        a.setPartnerAssemblyId(assemblyIdB);
        b.setPartnerAssemblyId(assemblyIdA);
        save();
    }

    public void unpairAssembly(String assemblyId) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null || assembly.getPartnerAssemblyId() == null) return;
        DoorAssembly partner = assemblies.get(assembly.getPartnerAssemblyId());
        if (partner != null) partner.setPartnerAssemblyId(null);
        assembly.setPartnerAssemblyId(null);
        save();
    }

    public void pairAndSplitAssemblies(String assemblyIdA, String assemblyIdB) {
        DoorAssembly a = assemblies.get(assemblyIdA);
        DoorAssembly b = assemblies.get(assemblyIdB);
        if (a == null || b == null) return;

        a.setPartnerAssemblyId(assemblyIdB);
        b.setPartnerAssemblyId(assemblyIdA);

        BlockPos3 hingeA = a.getPrimaryHingePos();
        BlockPos3 hingeB = b.getPrimaryHingePos();
        boolean useX = hingeA.x() != hingeB.x();

        int minVal = useX ? Math.min(hingeA.x(), hingeB.x()) : Math.min(hingeA.z(), hingeB.z());
        int maxVal = useX ? Math.max(hingeA.x(), hingeB.x()) : Math.max(hingeA.z(), hingeB.z());
        double midpoint = (minVal + maxVal) / 2.0;

        // Collect all panels, deduplicate by closedPos
        List<DoorAssembly.PanelEntry> allPanels = new ArrayList<>();
        allPanels.addAll(a.getPanelPositions());
        allPanels.addAll(b.getPanelPositions());

        Set<String> seen = new HashSet<>();
        List<DoorAssembly.PanelEntry> unique = new ArrayList<>();
        for (DoorAssembly.PanelEntry p : allPanels) {
            String key = p.closedPos().toKey();
            if (seen.add(key)) {
                unique.add(p);
            }
        }

        // Remove all old panel positions from index
        for (DoorAssembly.PanelEntry p : allPanels) {
            positionIndex.remove(p.currentPos().toKey());
        }

        List<DoorAssembly.PanelEntry> panelsMin = new ArrayList<>();
        List<DoorAssembly.PanelEntry> panelsMax = new ArrayList<>();
        for (DoorAssembly.PanelEntry p : unique) {
            int v = useX ? p.closedPos().x() : p.closedPos().z();
            if (v <= minVal || v >= maxVal) continue;
            if (v < midpoint) panelsMin.add(p);
            else if (v > midpoint) panelsMax.add(p);
        }

        boolean aIsMin = useX ? hingeA.x() < hingeB.x() : hingeA.z() < hingeB.z();
        // Replace panel lists
        a.getPanelPositions().clear();
        a.getPanelPositions().addAll(aIsMin ? panelsMin : panelsMax);
        b.getPanelPositions().clear();
        b.getPanelPositions().addAll(aIsMin ? panelsMax : panelsMin);

        // Re-index
        for (DoorAssembly.PanelEntry p : a.getPanelPositions()) {
            positionIndex.put(p.currentPos().toKey(), assemblyIdA);
        }
        for (DoorAssembly.PanelEntry p : b.getPanelPositions()) {
            positionIndex.put(p.currentPos().toKey(), assemblyIdB);
        }

        save();
    }

    // --- Redstone debounce ---

    public void setRedstoneDebounce(String assemblyId, long untilTick) {
        redstoneDebounce.put(assemblyId, untilTick);
    }

    public boolean isRedstoneDebounced(String assemblyId, long currentTick) {
        Long expiry = redstoneDebounce.get(assemblyId);
        return expiry != null && currentTick < expiry;
    }

    // --- Conversion guard (uses MC BlockPos) ---

    public boolean isConversionInProgress(BlockPos pos) {
        return conversionInProgress.contains(pos);
    }

    public void startConversion(BlockPos pos) {
        conversionInProgress.add(pos);
    }

    public void endConversion(BlockPos pos) {
        conversionInProgress.remove(pos);
    }
}
