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
        DoorAssembly assembly = manager.createAssembly(hingePos, "north", "hinge");

        assertNotNull(assembly);
        assertNotNull(assembly.getId());
        assertSame(assembly, manager.findByPosition(hingePos));
    }

    @Test
    void addPanelToAssembly_makesPanelPositionFindable() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
        BlockPos3 panelPos = new BlockPos3(1, 0, 0);
        manager.addPanelToAssembly(assembly.getId(), panelPos, 5);

        assertSame(assembly, manager.findByPosition(panelPos));
        assertEquals(1, assembly.getPanelPositions().size());
        assertEquals(5, assembly.getPanelPositions().get(0).materialIndex());
    }

    @Test
    void removePanelFromAssembly_removesPositionFromIndex() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
        BlockPos3 panelPos = new BlockPos3(1, 0, 0);
        manager.addPanelToAssembly(assembly.getId(), panelPos, 0);
        // Add a second panel so removing the first doesn't dissolve
        manager.addPanelToAssembly(assembly.getId(), new BlockPos3(2, 0, 0), 0);

        manager.removePanelFromAssembly(assembly.getId(), panelPos);

        assertNull(manager.findByPosition(panelPos));
        assertEquals(1, assembly.getPanelPositions().size());
    }

    @Test
    void removePanelFromAssembly_lastPanel_dissolvesAssembly() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
        BlockPos3 panelPos = new BlockPos3(1, 0, 0);
        manager.addPanelToAssembly(assembly.getId(), panelPos, 0);
        String id = assembly.getId();

        manager.removePanelFromAssembly(id, panelPos);

        assertNull(manager.getAssembly(id));
        assertNull(manager.findByPosition(new BlockPos3(0, 0, 0)));
        assertNull(manager.findByPosition(panelPos));
    }

    @Test
    void openDoor_updatesIsOpenAndPositionIndex() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
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
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
        BlockPos3 closedPos = new BlockPos3(1, 0, 0);
        manager.addPanelToAssembly(assembly.getId(), closedPos, 0);

        BlockPos3 openPos = new BlockPos3(0, 0, 1);
        manager.openDoor(assembly.getId(), "cw", List.of(openPos));

        assertNull(manager.findByPosition(closedPos));
    }

    @Test
    void closeDoor_resetsPositionsBackToClosedPos() {
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
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
        DoorAssembly assembly = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
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
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
        DoorAssembly b = manager.createAssembly(new BlockPos3(5, 0, 0), "north", "hinge");

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
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
        manager.addPanelToAssembly(a.getId(), new BlockPos3(1, 0, 0), 5);
        manager.addPanelToAssembly(a.getId(), new BlockPos3(2, 0, 0), 12);
        manager.setDoorSide(a.getId(), "left");

        DoorAssembly b = manager.createAssembly(new BlockPos3(10, 0, 0), "south", "hinge");
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
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
        DoorAssembly b = manager.createAssembly(new BlockPos3(5, 0, 0), "north", "hinge");
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

        manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
        assertTrue(callCount[0] > 0, "Save callback should have been invoked");
    }

    @Test
    void load_updatesNextId_soNewAssembliesDontCollide() {
        DoorAssembly a = manager.createAssembly(new BlockPos3(0, 0, 0), "north", "hinge");
        manager.addPanelToAssembly(a.getId(), new BlockPos3(1, 0, 0), 0);
        String json = manager.serialize();

        DoorManager restored = new DoorManager();
        restored.load(json);
        DoorAssembly newAssembly = restored.createAssembly(new BlockPos3(20, 0, 0), "south", "hinge");

        assertNotEquals(a.getId(), newAssembly.getId());
    }
}
