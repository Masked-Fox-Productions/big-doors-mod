package com.bigdoors;

import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;
import com.google.gson.JsonArray;
import com.google.gson.JsonParser;
import net.minecraft.core.BlockPos;

import java.util.*;

/**
 * Server-scoped state manager tracking all door assemblies and a position index.
 * World-agnostic — never performs world block mutations. All world block changes
 * are the caller's responsibility (BreakHandler, DoorMover, etc.).
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

            for (BlockPos3 hPos : assembly.getHingeBlockPositions()) {
                positionIndex.put(hPos.toKey(), assembly.getId());
            }
            for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
                positionIndex.put(panel.currentPos().toKey(), assembly.getId());
            }
            for (DoorAssembly.PanelEntry bp : assembly.getBoundaryPanels()) {
                positionIndex.put(bp.currentPos().toKey(), assembly.getId());
            }

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
        return createAssembly(hingePos, facing, mode, "hinge");
    }

    public DoorAssembly createAssembly(BlockPos3 hingePos, String facing, String mode, String hingeType) {
        String id = "door_" + nextId++;
        DoorAssembly assembly = new DoorAssembly(id, hingePos, facing, mode,
                hingeType, Constants.UNMATCHED_MATERIAL_INDEX);
        assemblies.put(id, assembly);
        positionIndex.put(hingePos.toKey(), id);
        save();
        return assembly;
    }

    public void addHingeToAssembly(String assemblyId, BlockPos3 hingePos) {
        addHingeToAssembly(assemblyId, hingePos, "hinge", Constants.UNMATCHED_MATERIAL_INDEX);
    }

    public void addHingeToAssembly(String assemblyId, BlockPos3 hingePos,
                                    String hingeType, int materialIndex) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;
        assembly.addHingeRecord(hingePos, hingeType, materialIndex);
        positionIndex.put(hingePos.toKey(), assemblyId);
        save();
    }

    public void setDoorSide(String assemblyId, String doorSide) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;
        assembly.setDoorSide(doorSide);
        save();
    }

    public void setMode(String assemblyId, String mode) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;
        assembly.setMode(mode);
        save();
    }

    public void addPanelToAssembly(String assemblyId, BlockPos3 panelPos, int materialIndex) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;
        assembly.addPanel(panelPos, materialIndex);
        positionIndex.put(panelPos.toKey(), assemblyId);
        save();
    }

    public void addPanelToAssembly(String assemblyId, BlockPos3 panelPos, int materialIndex,
                                    Integer geometryId, int overlay) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;
        assembly.addPanel(panelPos, materialIndex, geometryId, overlay);
        positionIndex.put(panelPos.toKey(), assemblyId);
        save();
    }

    public void removePanelFromAssembly(String assemblyId, BlockPos3 panelPos) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;
        assembly.removePanel(panelPos);
        positionIndex.remove(panelPos.toKey());

        if (assembly.getPanelPositions().isEmpty()) {
            resetAssembly(assemblyId);
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

        for (BlockPos3 hPos : assembly.getHingeBlockPositions()) {
            positionIndex.remove(hPos.toKey());
        }
        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            positionIndex.remove(panel.currentPos().toKey());
        }
        for (DoorAssembly.PanelEntry bp : assembly.getBoundaryPanels()) {
            positionIndex.remove(bp.currentPos().toKey());
        }

        assemblies.remove(assemblyId);
        save();
    }

    // --- Assembly management operations ---

    public void mergeAssemblies(String canonicalId, String... otherIds) {
        DoorAssembly canonical = assemblies.get(canonicalId);
        if (canonical == null) return;

        for (String otherId : otherIds) {
            DoorAssembly absorbed = assemblies.get(otherId);
            if (absorbed == null) continue;

            // Transfer partner relationship
            if (absorbed.getPartnerAssemblyId() != null) {
                if (canonical.getPartnerAssemblyId() != null
                        && !canonical.getPartnerAssemblyId().equals(absorbed.getPartnerAssemblyId())) {
                    unpairAssembly(otherId);
                } else if (canonical.getPartnerAssemblyId() == null) {
                    DoorAssembly partner = assemblies.get(absorbed.getPartnerAssemblyId());
                    if (partner != null) partner.setPartnerAssemblyId(canonicalId);
                    canonical.setPartnerAssemblyId(absorbed.getPartnerAssemblyId());
                    absorbed.setPartnerAssemblyId(null);
                }
            }

            for (DoorAssembly.HingeRecord hinge : absorbed.getHingePositions()) {
                canonical.getHingePositions().add(hinge);
                positionIndex.put(hinge.pos().toKey(), canonicalId);
            }

            for (DoorAssembly.PanelEntry panel : absorbed.getPanelPositions()) {
                canonical.getPanelPositions().add(panel);
                positionIndex.put(panel.currentPos().toKey(), canonicalId);
            }

            for (DoorAssembly.PanelEntry bp : absorbed.getBoundaryPanels()) {
                canonical.getBoundaryPanels().add(bp);
                positionIndex.put(bp.currentPos().toKey(), canonicalId);
            }

            assemblies.remove(otherId);
        }

        // Update primaryHingePos to lowest hinge on the appropriate axis
        updatePrimaryHingePos(canonical);
        save();
    }

    public record RemoveHingeResult(String status, DoorAssembly assembly) {}

    public RemoveHingeResult removeHingeFromAssembly(String assemblyId, BlockPos3 hingePos) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return new RemoveHingeResult("kept", null);

        assembly.removeHinge(hingePos);
        positionIndex.remove(hingePos.toKey());

        if (assembly.getHingePositions().isEmpty()) {
            if (assembly.getPartnerAssemblyId() != null) unpairAssembly(assemblyId);
            return new RemoveHingeResult("dissolve_required", assembly);
        }

        // Check contiguity on the correct axis
        String axis = getHingeAxis(assembly);
        List<Integer> sorted = new ArrayList<>();
        for (DoorAssembly.HingeRecord h : assembly.getHingePositions()) {
            sorted.add(getAxisValue(h.pos(), axis));
        }
        Collections.sort(sorted);

        boolean contiguous = true;
        for (int i = 1; i < sorted.size(); i++) {
            if (sorted.get(i) - sorted.get(i - 1) != 1) {
                contiguous = false;
                break;
            }
        }

        if (!contiguous) {
            if (assembly.getPartnerAssemblyId() != null) unpairAssembly(assemblyId);
            return new RemoveHingeResult("dissolve_required", assembly);
        }

        updatePrimaryHingePos(assembly);
        save();
        return new RemoveHingeResult("kept", assembly);
    }

    public void resetAssembly(String assemblyId) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;

        if (assembly.getPartnerAssemblyId() != null) {
            unpairAssembly(assemblyId);
        }

        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            positionIndex.remove(panel.currentPos().toKey());
        }
        for (DoorAssembly.PanelEntry bp : assembly.getBoundaryPanels()) {
            positionIndex.remove(bp.currentPos().toKey());
        }

        assembly.getPanelPositions().clear();
        assembly.getBoundaryPanels().clear();
        assembly.setDoorSide(null);
        assembly.setMode("horizontal");
        assembly.setOpen(false);
        assembly.setOpenDirection(null);

        for (DoorAssembly.HingeRecord hinge : assembly.getHingePositions()) {
            // Reset material index on all hinges — need to replace since records are immutable
            int idx = assembly.getHingePositions().indexOf(hinge);
            assembly.getHingePositions().set(idx,
                    new DoorAssembly.HingeRecord(hinge.pos(), hinge.type(), Constants.UNMATCHED_MATERIAL_INDEX));
        }

        save();
    }

    public void setHingeMaterialIndex(String assemblyId, int materialIndex) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;
        List<DoorAssembly.HingeRecord> hinges = assembly.getHingePositions();
        for (int i = 0; i < hinges.size(); i++) {
            DoorAssembly.HingeRecord h = hinges.get(i);
            hinges.set(i, new DoorAssembly.HingeRecord(h.pos(), h.type(), materialIndex));
        }
        save();
    }

    public void resplitAssemblies(String assemblyIdA, String assemblyIdB) {
        DoorAssembly a = assemblies.get(assemblyIdA);
        DoorAssembly b = assemblies.get(assemblyIdB);
        if (a == null || b == null) return;

        splitPanelsBetween(a, b, assemblyIdA, assemblyIdB, true);
        save();
    }

    // --- Open / Close ---

    public void openDoor(String assemblyId, String direction, List<BlockPos3> newPositions) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;

        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            positionIndex.remove(panel.currentPos().toKey());
        }

        assembly.updatePanelPositions(newPositions);
        assembly.setOpen(true);
        assembly.setOpenDirection(direction);

        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            positionIndex.put(panel.currentPos().toKey(), assemblyId);
        }

        save();
    }

    public void closeDoor(String assemblyId) {
        DoorAssembly assembly = assemblies.get(assemblyId);
        if (assembly == null) return;

        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            positionIndex.remove(panel.currentPos().toKey());
        }

        List<BlockPos3> closedPositions = new ArrayList<>();
        for (DoorAssembly.PanelEntry panel : assembly.getPanelPositions()) {
            closedPositions.add(panel.closedPos());
        }
        assembly.updatePanelPositions(closedPositions);
        assembly.setOpen(false);
        assembly.setOpenDirection(null);

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

        // Reabsorb boundary panels back into regular panels
        reabsorbBoundaryPanels(assembly, assemblyId);
        if (partner != null) {
            reabsorbBoundaryPanels(partner, assembly.getPartnerAssemblyId());
            partner.setPartnerAssemblyId(null);
        }
        assembly.setPartnerAssemblyId(null);
        save();
    }

    private void reabsorbBoundaryPanels(DoorAssembly assembly, String assemblyId) {
        if (assembly.getBoundaryPanels().isEmpty()) return;
        for (DoorAssembly.PanelEntry bp : assembly.getBoundaryPanels()) {
            assembly.getPanelPositions().add(bp);
            positionIndex.put(bp.currentPos().toKey(), assemblyId);
        }
        assembly.getBoundaryPanels().clear();
    }

    public void pairAndSplitAssemblies(String assemblyIdA, String assemblyIdB) {
        DoorAssembly a = assemblies.get(assemblyIdA);
        DoorAssembly b = assemblies.get(assemblyIdB);
        if (a == null || b == null) return;

        a.setPartnerAssemblyId(assemblyIdB);
        b.setPartnerAssemblyId(assemblyIdA);

        splitPanelsBetween(a, b, assemblyIdA, assemblyIdB, false);
        save();
    }

    private void splitPanelsBetween(DoorAssembly a, DoorAssembly b,
                                     String assemblyIdA, String assemblyIdB,
                                     boolean includeBoundaryPanels) {
        BlockPos3 hingeA = a.getPrimaryHingePos();
        BlockPos3 hingeB = b.getPrimaryHingePos();
        boolean useX = hingeA.x() != hingeB.x();

        int minVal = useX ? Math.min(hingeA.x(), hingeB.x()) : Math.min(hingeA.z(), hingeB.z());
        int maxVal = useX ? Math.max(hingeA.x(), hingeB.x()) : Math.max(hingeA.z(), hingeB.z());
        double midpoint = (minVal + maxVal) / 2.0;

        List<DoorAssembly.PanelEntry> allPanels = new ArrayList<>();
        allPanels.addAll(a.getPanelPositions());
        allPanels.addAll(b.getPanelPositions());
        if (includeBoundaryPanels) {
            allPanels.addAll(a.getBoundaryPanels());
            allPanels.addAll(b.getBoundaryPanels());
        }

        Set<String> seen = new HashSet<>();
        List<DoorAssembly.PanelEntry> unique = new ArrayList<>();
        for (DoorAssembly.PanelEntry p : allPanels) {
            String key = p.closedPos().toKey();
            if (seen.add(key)) {
                unique.add(p);
            }
        }

        for (DoorAssembly.PanelEntry p : allPanels) {
            positionIndex.remove(p.currentPos().toKey());
        }

        List<DoorAssembly.PanelEntry> panelsMin = new ArrayList<>();
        List<DoorAssembly.PanelEntry> panelsMax = new ArrayList<>();
        List<DoorAssembly.PanelEntry> boundaryPanels = new ArrayList<>();
        for (DoorAssembly.PanelEntry p : unique) {
            int v = useX ? p.closedPos().x() : p.closedPos().z();
            if (v <= minVal || v >= maxVal) {
                boundaryPanels.add(p);
                continue;
            }
            if (v < midpoint) panelsMin.add(p);
            else if (v > midpoint) panelsMax.add(p);
            else boundaryPanels.add(p);
        }

        boolean aIsMin = useX ? hingeA.x() < hingeB.x() : hingeA.z() < hingeB.z();
        a.getPanelPositions().clear();
        a.getPanelPositions().addAll(aIsMin ? panelsMin : panelsMax);
        b.getPanelPositions().clear();
        b.getPanelPositions().addAll(aIsMin ? panelsMax : panelsMin);

        for (DoorAssembly.PanelEntry p : a.getPanelPositions()) {
            positionIndex.put(p.currentPos().toKey(), assemblyIdA);
        }
        for (DoorAssembly.PanelEntry p : b.getPanelPositions()) {
            positionIndex.put(p.currentPos().toKey(), assemblyIdB);
        }

        // Clear overlay on boundary panels
        List<DoorAssembly.PanelEntry> processedBoundary = new ArrayList<>();
        for (DoorAssembly.PanelEntry p : boundaryPanels) {
            processedBoundary.add(new DoorAssembly.PanelEntry(
                    p.materialIndex(), p.closedPos(), p.currentPos(), p.geometryId(), 0));
        }
        a.getBoundaryPanels().clear();
        a.getBoundaryPanels().addAll(processedBoundary);
        b.getBoundaryPanels().clear();
        for (DoorAssembly.PanelEntry p : processedBoundary) {
            positionIndex.put(p.currentPos().toKey(), assemblyIdA);
        }
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

    // --- Helpers ---

    private String getHingeAxis(DoorAssembly assembly) {
        if ("horizontal".equals(assembly.getMode())) return "y";
        String facing = assembly.getFacing();
        if ("north".equals(facing) || "south".equals(facing)) return "x";
        return "z";
    }

    private int getAxisValue(BlockPos3 pos, String axis) {
        return switch (axis) {
            case "x" -> pos.x();
            case "z" -> pos.z();
            default -> pos.y();
        };
    }

    private void updatePrimaryHingePos(DoorAssembly assembly) {
        String axis = getHingeAxis(assembly);
        DoorAssembly.HingeRecord min = assembly.getHingePositions().get(0);
        for (DoorAssembly.HingeRecord h : assembly.getHingePositions()) {
            if (getAxisValue(h.pos(), axis) < getAxisValue(min.pos(), axis)) {
                min = h;
            }
        }
        assembly.setPrimaryHingePos(min.pos());
    }
}
