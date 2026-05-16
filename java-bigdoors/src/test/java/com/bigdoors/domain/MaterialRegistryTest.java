package com.bigdoors.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MaterialRegistryTest {

    @Test
    void indexForTypeId_cobblestone_returns12() {
        assertEquals(12, MaterialRegistry.indexForTypeId("minecraft:cobblestone"));
    }

    @Test
    void typeIdForIndex_0_returnsOakPlanks() {
        assertEquals("minecraft:oak_planks", MaterialRegistry.typeIdForIndex(0));
    }

    @Test
    void indexForTypeId_unsupportedBlock_returnsNegativeOne() {
        assertEquals(-1, MaterialRegistry.indexForTypeId("minecraft:dirt"));
    }

    @Test
    void typeIdForIndex_negativeOne_returnsNull() {
        assertNull(MaterialRegistry.typeIdForIndex(-1));
    }

    @Test
    void typeIdForIndex_64_returnsNull() {
        assertNull(MaterialRegistry.typeIdForIndex(64));
    }

    @Test
    void isSupportedMaterial_cobblestone_returnsTrue() {
        assertTrue(MaterialRegistry.isSupportedMaterial("minecraft:cobblestone"));
    }

    @Test
    void isSupportedMaterial_dirt_returnsFalse() {
        assertFalse(MaterialRegistry.isSupportedMaterial("minecraft:dirt"));
    }

    @Test
    void allEntries_roundTrip() {
        for (int i = 0; i < 64; i++) {
            String typeId = MaterialRegistry.typeIdForIndex(i);
            assertNotNull(typeId, "typeIdForIndex(" + i + ") should not be null");
            assertEquals(i, MaterialRegistry.indexForTypeId(typeId),
                    "indexForTypeId(typeIdForIndex(" + i + ")) should return " + i);
        }
    }
}
