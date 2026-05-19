package com.bigdoors.domain;

import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DoorAssemblyTest {

    @Test
    void roundTrip_toJsonFromJson_preservesAllFields() {
        DoorAssembly original = new DoorAssembly("test_1", new BlockPos3(1, 2, 3), "north", "horizontal");
        original.addHingeRecord(new BlockPos3(1, 3, 3), "hidden", 42);
        original.addPanel(new BlockPos3(2, 2, 3), 5, 4, 1);
        original.addPanel(new BlockPos3(3, 2, 3), 12);
        original.addBoundaryPanel(new BlockPos3(4, 2, 3), 7, null, 0);
        original.setDoorSide("east");
        original.setOpen(true);
        original.setOpenDirection("cw");
        original.setPartnerAssemblyId("partner_1");

        JsonObject json = original.toJson();
        DoorAssembly restored = DoorAssembly.fromJson(json);

        assertEquals("test_1", restored.getId());
        assertEquals(new BlockPos3(1, 2, 3), restored.getPrimaryHingePos());
        assertEquals("north", restored.getFacing());
        assertEquals("horizontal", restored.getMode());
        assertTrue(restored.isOpen());
        assertEquals("east", restored.getDoorSide());
        assertEquals("cw", restored.getOpenDirection());
        assertEquals("partner_1", restored.getPartnerAssemblyId());

        // Hinges
        assertEquals(2, restored.getHingePositions().size());
        assertEquals("hinge", restored.getHingePositions().get(0).type());
        assertEquals(Constants.UNMATCHED_MATERIAL_INDEX, restored.getHingePositions().get(0).materialIndex());
        assertEquals("hidden", restored.getHingePositions().get(1).type());
        assertEquals(42, restored.getHingePositions().get(1).materialIndex());

        // Panels
        assertEquals(2, restored.getPanelPositions().size());
        assertEquals(5, restored.getPanelPositions().get(0).materialIndex());
        assertEquals(Integer.valueOf(4), restored.getPanelPositions().get(0).geometryId());
        assertEquals(1, restored.getPanelPositions().get(0).overlay());
        assertEquals(12, restored.getPanelPositions().get(1).materialIndex());
        assertNull(restored.getPanelPositions().get(1).geometryId());
        assertEquals(0, restored.getPanelPositions().get(1).overlay());

        // Boundary panels
        assertEquals(1, restored.getBoundaryPanels().size());
        assertEquals(7, restored.getBoundaryPanels().get(0).materialIndex());
    }

    @Test
    void fromJson_oldFormatHingePositions_deserializesAsHingeRecords() {
        // Build old-format JSON with plain BlockPos3 hinge positions
        JsonObject obj = new JsonObject();
        obj.addProperty("id", "old_1");
        JsonObject hingePos = new JsonObject();
        hingePos.addProperty("x", 1);
        hingePos.addProperty("y", 2);
        hingePos.addProperty("z", 3);
        obj.add("primaryHingePos", hingePos);
        obj.addProperty("facing", "north");
        obj.addProperty("mode", "horizontal");
        obj.addProperty("isOpen", false);

        JsonArray hinges = new JsonArray();
        JsonObject h1 = new JsonObject();
        h1.addProperty("x", 1);
        h1.addProperty("y", 2);
        h1.addProperty("z", 3);
        hinges.add(h1);
        obj.add("hingePositions", hinges);

        JsonArray panels = new JsonArray();
        obj.add("panelPositions", panels);

        DoorAssembly assembly = DoorAssembly.fromJson(obj);

        assertEquals(1, assembly.getHingePositions().size());
        DoorAssembly.HingeRecord hr = assembly.getHingePositions().get(0);
        assertEquals(new BlockPos3(1, 2, 3), hr.pos());
        assertEquals("hinge", hr.type());
        assertEquals(Constants.UNMATCHED_MATERIAL_INDEX, hr.materialIndex());
    }

    @Test
    void addHingeRecord_addsWithTypeAndMaterial() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addHingeRecord(new BlockPos3(0, 1, 0), "hidden", 5);
        assertEquals(2, assembly.getHingePositions().size());
        assertEquals("hidden", assembly.getHingePositions().get(1).type());
        assertEquals(5, assembly.getHingePositions().get(1).materialIndex());
    }

    @Test
    void removeHinge_removesByPosition() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addHinge(new BlockPos3(0, 1, 0));
        assertEquals(2, assembly.getHingePositions().size());
        assertTrue(assembly.removeHinge(new BlockPos3(0, 1, 0)));
        assertEquals(1, assembly.getHingePositions().size());
    }

    @Test
    void getHingeType_returnsFirstHingeType() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal",
                "hidden", Constants.UNMATCHED_MATERIAL_INDEX);
        assertEquals("hidden", assembly.getHingeType());
    }

    @Test
    void getHingeBlockPositions_extractsPositions() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addHinge(new BlockPos3(0, 1, 0));
        List<BlockPos3> positions = assembly.getHingeBlockPositions();
        assertEquals(2, positions.size());
        assertEquals(new BlockPos3(0, 0, 0), positions.get(0));
        assertEquals(new BlockPos3(0, 1, 0), positions.get(1));
    }

    @Test
    void addPanel_withGeometryId_storesValue() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addPanel(new BlockPos3(1, 0, 0), 80, 4, 1);
        DoorAssembly.PanelEntry panel = assembly.getPanelPositions().get(0);
        assertEquals(Integer.valueOf(4), panel.geometryId());
        assertEquals(1, panel.overlay());
    }

    @Test
    void addPanel_withoutGeometryId_defaultsToNull() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addPanel(new BlockPos3(1, 0, 0), 0);
        DoorAssembly.PanelEntry panel = assembly.getPanelPositions().get(0);
        assertNull(panel.geometryId());
        assertEquals(0, panel.overlay());
    }

    @Test
    void boundaryPanels_serializedAndDeserialized() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addBoundaryPanel(new BlockPos3(3, 0, 0), 5, null, 0);
        assembly.addBoundaryPanel(new BlockPos3(4, 0, 0), 12, 6, 1);

        JsonObject json = assembly.toJson();
        DoorAssembly restored = DoorAssembly.fromJson(json);

        assertEquals(2, restored.getBoundaryPanels().size());
        assertEquals(5, restored.getBoundaryPanels().get(0).materialIndex());
        assertEquals(12, restored.getBoundaryPanels().get(1).materialIndex());
        assertEquals(Integer.valueOf(6), restored.getBoundaryPanels().get(1).geometryId());
        assertEquals(1, restored.getBoundaryPanels().get(1).overlay());
    }

    @Test
    void fromJson_missingGeometryId_resultsInNull() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addPanel(new BlockPos3(1, 0, 0), 0);
        JsonObject json = assembly.toJson();
        DoorAssembly restored = DoorAssembly.fromJson(json);
        assertNull(restored.getPanelPositions().get(0).geometryId());
    }

    @Test
    void addPanel_increasesPanelCount() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assertEquals(0, assembly.getPanelPositions().size());
        assembly.addPanel(new BlockPos3(1, 0, 0), 0);
        assertEquals(1, assembly.getPanelPositions().size());
        assembly.addPanel(new BlockPos3(2, 0, 0), 1);
        assertEquals(2, assembly.getPanelPositions().size());
    }

    @Test
    void removePanel_byCurrentPos_works() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addPanel(new BlockPos3(1, 0, 0), 0);
        assembly.updatePanelPositions(List.of(new BlockPos3(0, 0, 1)));
        assertTrue(assembly.removePanel(new BlockPos3(0, 0, 1)));
        assertEquals(0, assembly.getPanelPositions().size());
    }

    @Test
    void removePanel_byClosedPos_works() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addPanel(new BlockPos3(1, 0, 0), 0);
        assembly.updatePanelPositions(List.of(new BlockPos3(0, 0, 1)));
        assertTrue(assembly.removePanel(new BlockPos3(1, 0, 0)));
        assertEquals(0, assembly.getPanelPositions().size());
    }

    @Test
    void removePanel_returnsFalse_forUnknownPosition() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addPanel(new BlockPos3(1, 0, 0), 0);
        assertFalse(assembly.removePanel(new BlockPos3(99, 99, 99)));
    }

    @Test
    void updatePanelPositions_changesCurrentPos() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addPanel(new BlockPos3(1, 0, 0), 0);
        assembly.addPanel(new BlockPos3(2, 0, 0), 1);

        BlockPos3 newPos1 = new BlockPos3(0, 0, 1);
        BlockPos3 newPos2 = new BlockPos3(0, 0, 2);
        assembly.updatePanelPositions(List.of(newPos1, newPos2));

        List<BlockPos3> current = assembly.getAllCurrentPositions();
        assertEquals(newPos1, current.get(0));
        assertEquals(newPos2, current.get(1));
    }

    @Test
    void autoGeneratedIds_areUnique() {
        DoorAssembly a = new DoorAssembly(null, new BlockPos3(0, 0, 0), "north", "horizontal");
        DoorAssembly b = new DoorAssembly(null, new BlockPos3(0, 0, 0), "north", "horizontal");
        assertNotEquals(a.getId(), b.getId());
    }

    @Test
    void removeBoundaryPanel_works() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addBoundaryPanel(new BlockPos3(3, 0, 0), 5, null, 0);
        assertEquals(1, assembly.getBoundaryPanels().size());
        assertTrue(assembly.removeBoundaryPanel(new BlockPos3(3, 0, 0)));
        assertEquals(0, assembly.getBoundaryPanels().size());
    }

    @Test
    void toJson_fromJson_roundTrip_overlayOnPanelsAndBoundaryPanels() {
        DoorAssembly assembly = new DoorAssembly("a", new BlockPos3(0, 0, 0), "north", "horizontal");
        assembly.addPanel(new BlockPos3(1, 0, 0), 5, null, 1);
        assembly.addBoundaryPanel(new BlockPos3(2, 0, 0), 12, 6, 1);

        JsonObject json = assembly.toJson();
        DoorAssembly restored = DoorAssembly.fromJson(json);

        assertEquals(1, restored.getPanelPositions().get(0).overlay());
        assertEquals(1, restored.getBoundaryPanels().get(0).overlay());
    }
}
