package com.bigdoors;

import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.util.BlockPos3;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DoorManagerTest {

    private DoorManager manager;

    @BeforeEach
    void setUp() {
        manager = new DoorManager();
    }

    @Test
    void createAssembly_isRetrievableByFindByPosition() {
        BlockPos3 hingePos = new BlockPos3(0, 0, 0);
        DoorAssembly assembly = manager.createAssembly(hingePos, "north", "horizontal");

        assertNotNull(assembly);
        assertNotNull(assembly.getId());
        assertSame(assembly, manager.findByPosition(hingePos));
    }

    @Test
    void addPanelToAssembly_makesPanelPositionFindable() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        BlockPos3 panelPos = new BlockPos3(1, 0, 0);
        manager.addPanelToAssembly(assembly.getId(), panelPos, 5);

        assertSame(assembly, manager.findByPosition(panelPos));
        assertEquals(1, assembly.getPanelPositions().size());
        assertEquals(5, assembly.getPanelPositions().get(0).materialIndex());
    }

    @Test
    void removePanelFromAssembly_removesPositionFromIndex() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        BlockPos3 panelPos = new BlockPos3(1, 0, 0);
        manager.addPanelToAssembly(assembly.getId(), panelPos, 0);
        // Add a second panel so removing the first doesn't dissolve
        manager.addPanelToAssembly(assembly.getId(), new BlockPos3(2, 0, 0), 0);

        manager.removePanelFromAssembly(assembly.getId(), panelPos);

        assertNull(manager.findByPosition(panelPos));
        assertEquals(1, assembly.getPanelPositions().size());
    }

    @Test
    void removePanelFromAssembly_lastPanel_resetsAssembly() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        BlockPos3 panelPos = new BlockPos3(1, 0, 0);
        manager.addPanelToAssembly(assembly.getId(), panelPos, 0);
        String id = assembly.getId();

        manager.removePanelFromAssembly(id, panelPos);

        assertNotNull(manager.getAssembly(id));
        assertTrue(assembly.getPanelPositions().isEmpty());
        assertNotNull(manager.findByPosition(new BlockPos3(0, 0, 0)));
        assertNull(manager.findByPosition(panelPos));
    }

    @Test
    void openDoor_updatesIsOpenAndPositionIndex() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        BlockPos3 closedPos = new BlockPos3(1, 0, 0);
        manager.addPanelToAssembly(assembly.getId(), closedPos, 0);

        BlockPos3 openPos = new BlockPos3(0, 0, 1);
        manager.openDoor(assembly.getId(), "cw", List.of(openPos));

        assertTrue(assembly.isOpen());
        assertEquals("cw", assembly.getOpenDirection());
        assertSame(assembly, manager.findByPosition(openPos));
    }

    @Test
    void openDoor_closedPositionNoLongerFound() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        BlockPos3 closedPos = new BlockPos3(1, 0, 0);
        manager.addPanelToAssembly(assembly.getId(), closedPos, 0);

        BlockPos3 openPos = new BlockPos3(0, 0, 1);
        manager.openDoor(assembly.getId(), "cw", List.of(openPos));

        assertNull(manager.findByPosition(closedPos));
    }

    @Test
    void closeDoor_resetsPositionsBackToClosedPos() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        BlockPos3 closedPos = new BlockPos3(1, 0, 0);
        manager.addPanelToAssembly(assembly.getId(), closedPos, 0);

        BlockPos3 openPos = new BlockPos3(0, 0, 1);
        manager.openDoor(assembly.getId(), "cw", List.of(openPos));
        manager.closeDoor(assembly.getId());

        assertFalse(assembly.isOpen());
        assertNull(assembly.getOpenDirection());
        assertSame(assembly, manager.findByPosition(closedPos));
        assertNull(manager.findByPosition(openPos));
    }

    @Test
    void dissolveAssembly_removesAllPositionsFromIndex() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.addPanelToAssembly(assembly.getId(), new BlockPos3(1, 0, 0), 0);
        manager.addPanelToAssembly(assembly.getId(), new BlockPos3(2, 0, 0), 1);
        String id = assembly.getId();

        manager.dissolveAssembly(id);

        assertNull(manager.getAssembly(id));
        assertNull(manager.findByPosition(new BlockPos3(0, 0, 0)));
        assertNull(manager.findByPosition(new BlockPos3(1, 0, 0)));
        assertNull(manager.findByPosition(new BlockPos3(2, 0, 0)));
    }

    @Test
    void pairAndSplitAssemblies_pairsAndSplitsPanels() {
        // Two hinges on the X axis at x=0 and x=5
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        DoorAssembly b = manager.createAssembly(new BlockPos3(5, 0, 0), "north", "horizontal");

        // Add panels between the hinges on assembly A
        manager.addPanelToAssembly(a.getId(), new BlockPos3(1, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(2, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(3, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(4, 0, 0), 0);

        manager.pairAndSplitAssemblies(a.getId(), b.getId());

        assertEquals(b.getId(), a.getPartnerAssemblyId());
        assertEquals(a.getId(), b.getPartnerAssemblyId());
        // A (hinge at x=0, min side) should get panels x=1,2; B (x=5, max) gets x=3,4
        assertEquals(2, a.getPanelPositions().size());
        assertEquals(2, b.getPanelPositions().size());
    }

    @Test
    void serializeAndLoad_roundTrip_preservesAllAssemblies() {
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.addPanelToAssembly(a.getId(), new BlockPos3(1, 0, 0), 5);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(2, 0, 0), 12);
        manager.setDoorSide(a.getId(), "left");

        DoorAssembly b = manager.createAssembly(new BlockPos3(10, 0, 0), "south", "horizontal");
        manager.addPanelToAssembly(b.getId(), new BlockPos3(11, 0, 0), 3);

        String json = manager.serialize();

        // Load into a fresh manager
        DoorManager restored = new DoorManager();
        restored.load(json);

        DoorAssembly ra = restored.getAssembly(a.getId());
        assertNotNull(ra);
        assertEquals("north", ra.getFacing());
        assertEquals("left", ra.getDoorSide());
        assertEquals(2, ra.getPanelPositions().size());
        assertNotNull(restored.findByPosition(new BlockPos3(1, 0, 0)));

        DoorAssembly rb = restored.getAssembly(b.getId());
        assertNotNull(rb);
        assertEquals("south", rb.getFacing());
        assertEquals(1, rb.getPanelPositions().size());
    }

    @Test
    void unpairAssembly_clearsPartnerOnBothSides() {
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        DoorAssembly b = manager.createAssembly(new BlockPos3(5, 0, 0), "north", "horizontal");
        manager.pairAssemblies(a.getId(), b.getId());

        assertEquals(b.getId(), a.getPartnerAssemblyId());
        assertEquals(a.getId(), b.getPartnerAssemblyId());

        manager.unpairAssembly(a.getId());

        assertNull(a.getPartnerAssemblyId());
        assertNull(b.getPartnerAssemblyId());
    }

    @Test
    void getAssembly_returnsNullForUnknownId() {
        assertNull(manager.getAssembly("nonexistent"));
    }

    @Test
    void findByPosition_returnsNullForUnknownPosition() {
        assertNull(manager.findByPosition(new BlockPos3(99, 99, 99)));
    }

    @Test
    void saveCallback_isInvokedOnMutation() {
        int[] callCount = {0};
        manager.setSaveCallback(() -> callCount[0]++);

        manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        assertTrue(callCount[0] > 0, "Save callback should have been invoked");
    }

    @Test
    void load_updatesNextId_soNewAssembliesDontCollide() {
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.addPanelToAssembly(a.getId(), new BlockPos3(1, 0, 0), 0);
        String json = manager.serialize();

        DoorManager restored = new DoorManager();
        restored.load(json);
        DoorAssembly newAssembly = restored.createAssembly(new BlockPos3(20, 0, 0), "south", "horizontal");

        assertNotEquals(a.getId(), newAssembly.getId());
    }

    // --- Unit 6: New method tests ---

    @Test
    void createAssembly_withHingeType_setsType() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal", "hidden");
        assertEquals("hidden", assembly.getHingeType());
    }

    @Test
    void addHingeToAssembly_withTypeAndMaterial_addsHingeRecord() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.addHingeToAssembly(assembly.getId(), new BlockPos3(0, 1, 0), "hidden", 42);

        assertEquals(2, assembly.getHingePositions().size());
        assertEquals("hidden", assembly.getHingePositions().get(1).type());
        assertEquals(42, assembly.getHingePositions().get(1).materialIndex());
        assertNotNull(manager.findByPosition(new BlockPos3(0, 1, 0)));
    }

    @Test
    void setMode_changesAssemblyMode() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        assertEquals("horizontal", assembly.getMode());

        manager.setMode(assembly.getId(), "vertical");
        assertEquals("vertical", assembly.getMode());
    }

    @Test
    void addPanelToAssembly_withGeometryIdAndOverlay() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.addPanelToAssembly(assembly.getId(), new BlockPos3(1, 0, 0), 5, 4, 1);

        DoorAssembly.PanelEntry panel = assembly.getPanelPositions().get(0);
        assertEquals(5, panel.materialIndex());
        assertEquals(Integer.valueOf(4), panel.geometryId());
        assertEquals(1, panel.overlay());
    }

    @Test
    void mergeAssemblies_combinesAllPanelsAndHinges() {
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.addPanelToAssembly(a.getId(), new BlockPos3(1, 0, 0), 0);

        DoorAssembly b = manager.createAssembly(new BlockPos3(0, 2, 0), "north", "horizontal");
        manager.addPanelToAssembly(b.getId(), new BlockPos3(1, 2, 0), 1);

        String bId = b.getId();
        manager.mergeAssemblies(a.getId(), bId);

        assertEquals(2, a.getPanelPositions().size());
        assertEquals(2, a.getHingePositions().size());
        assertNull(manager.getAssembly(bId));
        assertSame(a, manager.findByPosition(new BlockPos3(1, 2, 0)));
        assertSame(a, manager.findByPosition(new BlockPos3(0, 2, 0)));
    }

    @Test
    void removeHingeFromAssembly_middleHinge_returnsDisconnected() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.addHingeToAssembly(assembly.getId(), new BlockPos3(0, 1, 0));
        manager.addHingeToAssembly(assembly.getId(), new BlockPos3(0, 2, 0));
        manager.addPanelToAssembly(assembly.getId(), new BlockPos3(1, 0, 0), 0);
        manager.addPanelToAssembly(assembly.getId(), new BlockPos3(1, 1, 0), 0);
        manager.addPanelToAssembly(assembly.getId(), new BlockPos3(1, 2, 0), 0);

        DoorManager.RemoveHingeResult result = manager.removeHingeFromAssembly(
                assembly.getId(), new BlockPos3(0, 1, 0));

        assertEquals("dissolve_required", result.status());
        assertNull(manager.findByPosition(new BlockPos3(0, 1, 0)));
    }

    @Test
    void removeHingeFromAssembly_endHinge_remainsKept() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.addHingeToAssembly(assembly.getId(), new BlockPos3(0, 1, 0));
        manager.addPanelToAssembly(assembly.getId(), new BlockPos3(1, 0, 0), 0);

        DoorManager.RemoveHingeResult result = manager.removeHingeFromAssembly(
                assembly.getId(), new BlockPos3(0, 1, 0));

        assertEquals("kept", result.status());
        assertEquals(1, assembly.getHingePositions().size());
    }

    @Test
    void removeHingeFromAssembly_lastHinge_requiresDissolve() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.addPanelToAssembly(assembly.getId(), new BlockPos3(1, 0, 0), 0);
        String id = assembly.getId();

        DoorManager.RemoveHingeResult result = manager.removeHingeFromAssembly(id, new BlockPos3(0, 0, 0));

        assertEquals("dissolve_required", result.status());
    }

    @Test
    void resetAssembly_clearsPanelsAndResetsMeta() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.addPanelToAssembly(assembly.getId(), new BlockPos3(1, 0, 0), 5);
        assembly.setDoorSide("east");
        assembly.setOpen(true);
        assembly.setOpenDirection("cw");

        manager.resetAssembly(assembly.getId());

        assertTrue(assembly.getPanelPositions().isEmpty());
        assertNull(assembly.getDoorSide());
        assertFalse(assembly.isOpen());
        assertNull(assembly.getOpenDirection());
        assertNotNull(manager.getAssembly(assembly.getId()));
    }

    @Test
    void resetAssembly_resetsHingeMaterialIndices() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.setHingeMaterialIndex(assembly.getId(), 42);

        manager.resetAssembly(assembly.getId());

        assertEquals(com.bigdoors.util.Constants.UNMATCHED_MATERIAL_INDEX,
                assembly.getHingePositions().get(0).materialIndex());
    }

    @Test
    void setHingeMaterialIndex_updatesAllHinges() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        manager.addHingeToAssembly(assembly.getId(), new BlockPos3(0, 1, 0));

        manager.setHingeMaterialIndex(assembly.getId(), 10);

        for (DoorAssembly.HingeRecord hinge : assembly.getHingePositions()) {
            assertEquals(10, hinge.materialIndex());
        }
    }

    @Test
    void pairAndSplitAssemblies_createsBoundaryPanels() {
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        DoorAssembly b = manager.createAssembly(new BlockPos3(6, 0, 0), "north", "horizontal");

        manager.addPanelToAssembly(a.getId(), new BlockPos3(1, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(2, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(3, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(4, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(5, 0, 0), 0);

        manager.pairAndSplitAssemblies(a.getId(), b.getId());

        int totalBoundary = a.getBoundaryPanels().size() + b.getBoundaryPanels().size();
        int totalPanels = a.getPanelPositions().size() + b.getPanelPositions().size();
        assertEquals(5, totalPanels + totalBoundary);
    }

    @Test
    void unpairAssembly_reabsorbsBoundaryPanels() {
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        DoorAssembly b = manager.createAssembly(new BlockPos3(4, 0, 0), "north", "horizontal");

        manager.addPanelToAssembly(a.getId(), new BlockPos3(1, 0, 0), 5);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(2, 0, 0), 5);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(3, 0, 0), 5);

        manager.pairAndSplitAssemblies(a.getId(), b.getId());
        int boundaryBefore = a.getBoundaryPanels().size() + b.getBoundaryPanels().size();

        manager.unpairAssembly(a.getId());

        assertEquals(0, a.getBoundaryPanels().size());
        assertEquals(0, b.getBoundaryPanels().size());
        int totalAfter = a.getPanelPositions().size() + b.getPanelPositions().size();
        assertTrue(totalAfter > 0);
    }

    @Test
    void resplitAssemblies_redistributesPanels() {
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        DoorAssembly b = manager.createAssembly(new BlockPos3(5, 0, 0), "north", "horizontal");
        manager.addPanelToAssembly(a.getId(), new BlockPos3(1, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(2, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(3, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(4, 0, 0), 0);
        manager.pairAndSplitAssemblies(a.getId(), b.getId());

        int aPanelsBefore = a.getPanelPositions().size();

        manager.addPanelToAssembly(a.getId(), new BlockPos3(1, 1, 0), 0);
        manager.resplitAssemblies(a.getId(), b.getId());

        int totalAfter = a.getPanelPositions().size() + b.getPanelPositions().size()
                + a.getBoundaryPanels().size() + b.getBoundaryPanels().size();
        assertEquals(5, totalAfter);
    }

    @Test
    void load_indexesBoundaryPanels() {
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        DoorAssembly b = manager.createAssembly(new BlockPos3(4, 0, 0), "north", "horizontal");
        manager.addPanelToAssembly(a.getId(), new BlockPos3(1, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(2, 0, 0), 0);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(3, 0, 0), 0);
        manager.pairAndSplitAssemblies(a.getId(), b.getId());

        String json = manager.serialize();
        DoorManager restored = new DoorManager();
        restored.load(json);

        for (DoorAssembly assembly : List.of(
                restored.getAssembly(a.getId()), restored.getAssembly(b.getId()))) {
            if (assembly == null) continue;
            for (DoorAssembly.PanelEntry bp : assembly.getBoundaryPanels()) {
                assertNotNull(restored.findByPosition(bp.currentPos()));
            }
        }
    }

    @Test
    void dissolveAssembly_clearsBoundaryPanelIndex() {
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "horizontal");
        a.addBoundaryPanel(new BlockPos3(3, 0, 0), 0, null, 0);
        manager.dissolveAssembly(a.getId());

        assertNull(manager.findByPosition(new BlockPos3(3, 0, 0)));
    }
}
