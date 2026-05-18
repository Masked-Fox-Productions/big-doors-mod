package com.bigdoors.domain;

import com.bigdoors.util.Constants;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MaterialRegistryTest {

    // --- Existing index lookup tests ---

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
        assertEquals(-1, MaterialRegistry.indexForTypeId("minecraft:bedrock"));
    }

    @Test
    void typeIdForIndex_negativeOne_returnsNull() {
        assertNull(MaterialRegistry.typeIdForIndex(-1));
    }

    @Test
    void typeIdForIndex_208_returnsNull() {
        assertNull(MaterialRegistry.typeIdForIndex(208));
    }

    @Test
    void isSupportedMaterial_cobblestone_returnsTrue() {
        assertTrue(MaterialRegistry.isSupportedMaterial("minecraft:cobblestone"));
    }

    @Test
    void isSupportedMaterial_unsupported_returnsFalse() {
        assertFalse(MaterialRegistry.isSupportedMaterial("minecraft:bedrock"));
    }

    @Test
    void indexForTypeId_null_returnsNegativeOne() {
        assertEquals(-1, MaterialRegistry.indexForTypeId(null));
    }

    @Test
    void isSupportedMaterial_empty_returnsFalse() {
        assertFalse(MaterialRegistry.isSupportedMaterial(""));
    }

    // --- Expanded material index tests (groups 4-12) ---

    @Test
    void indexForTypeId_oakLog_returns64() {
        assertEquals(64, MaterialRegistry.indexForTypeId("minecraft:oak_log"));
    }

    @Test
    void indexForTypeId_oakFence_returns80() {
        assertEquals(80, MaterialRegistry.indexForTypeId("minecraft:oak_fence"));
    }

    @Test
    void indexForTypeId_oakSlab_returns128() {
        assertEquals(128, MaterialRegistry.indexForTypeId("minecraft:oak_slab"));
    }

    @Test
    void indexForTypeId_glassPanes_returns144() {
        assertEquals(144, MaterialRegistry.indexForTypeId("minecraft:glass_pane"));
    }

    @Test
    void indexForTypeId_dirt_returns75() {
        assertEquals(75, MaterialRegistry.indexForTypeId("minecraft:dirt"));
    }

    @Test
    void materialIndex205_isNull() {
        assertNull(Constants.MATERIAL_INDEX[205]);
    }

    @Test
    void materialIndex206_isNull() {
        assertNull(Constants.MATERIAL_INDEX[206]);
    }

    @Test
    void materialIndex207_isNull() {
        assertNull(Constants.MATERIAL_INDEX[207]);
    }

    // --- Round-trip for all 208 entries ---

    @Test
    void allEntries_roundTrip() {
        for (int i = 0; i < 208; i++) {
            String typeId = MaterialRegistry.typeIdForIndex(i);
            if (typeId == null) {
                // Reserved slots (205-207)
                continue;
            }
            assertEquals(i, MaterialRegistry.indexForTypeId(typeId),
                    "indexForTypeId(typeIdForIndex(" + i + ")) should return " + i);
        }
    }

    // --- Group/ID conversion ---

    @Test
    void materialGroupForIndex_0_returns0() {
        assertEquals(0, MaterialRegistry.materialGroupForIndex(0));
    }

    @Test
    void materialGroupForIndex_64_returns4() {
        assertEquals(4, MaterialRegistry.materialGroupForIndex(64));
    }

    @Test
    void materialIdForIndex_64_returns0() {
        assertEquals(0, MaterialRegistry.materialIdForIndex(64));
    }

    @Test
    void materialIdForIndex_80_returns0() {
        assertEquals(0, MaterialRegistry.materialIdForIndex(80));
    }

    @Test
    void flatIndexFromGroupAndId_roundTrip() {
        for (int i = 0; i < 208; i++) {
            int group = MaterialRegistry.materialGroupForIndex(i);
            int id = MaterialRegistry.materialIdForIndex(i);
            assertEquals(i, MaterialRegistry.flatIndexFromGroupAndId(group, id));
        }
    }

    // --- Geometry class tests ---

    @Test
    void geometryClassForMaterial_oakFence_returnsFence() {
        assertEquals(Constants.GEOMETRY_CLASS_FENCE, MaterialRegistry.geometryClassForMaterial(80));
    }

    @Test
    void geometryClassForMaterial_ironBars_returnsBars() {
        assertEquals(Constants.GEOMETRY_CLASS_BARS, MaterialRegistry.geometryClassForMaterial(92));
    }

    @Test
    void geometryClassForMaterial_oakSlab_returnsSlab() {
        assertEquals(Constants.GEOMETRY_CLASS_SLAB, MaterialRegistry.geometryClassForMaterial(128));
    }

    @Test
    void geometryClassForMaterial_glassPanes_returnsPane() {
        assertEquals(Constants.GEOMETRY_CLASS_PANE, MaterialRegistry.geometryClassForMaterial(144));
    }

    @Test
    void geometryClassForMaterial_oakPlanks_returns0() {
        assertEquals(0, MaterialRegistry.geometryClassForMaterial(0));
    }

    // --- resolveGeometryId tests ---

    @Test
    void resolveGeometryId_fence_both_returns4() {
        assertEquals(4, MaterialRegistry.resolveGeometryId(80, true, true));
    }

    @Test
    void resolveGeometryId_fence_before_returns2() {
        assertEquals(2, MaterialRegistry.resolveGeometryId(80, true, false));
    }

    @Test
    void resolveGeometryId_fence_after_returns3() {
        assertEquals(3, MaterialRegistry.resolveGeometryId(80, false, true));
    }

    @Test
    void resolveGeometryId_fence_solo_returns1() {
        assertEquals(1, MaterialRegistry.resolveGeometryId(80, false, false));
    }

    @Test
    void resolveGeometryId_bars_both_returns5() {
        assertEquals(5, MaterialRegistry.resolveGeometryId(92, true, true));
    }

    @Test
    void resolveGeometryId_bars_before_returns10() {
        assertEquals(10, MaterialRegistry.resolveGeometryId(92, true, false));
    }

    @Test
    void resolveGeometryId_bars_after_returns11() {
        assertEquals(11, MaterialRegistry.resolveGeometryId(92, false, true));
    }

    @Test
    void resolveGeometryId_bars_solo_returns9() {
        assertEquals(9, MaterialRegistry.resolveGeometryId(92, false, false));
    }

    @Test
    void resolveGeometryId_slab_ignoresNeighbors() {
        assertEquals(Constants.GEOMETRY_CLASS_SLAB, MaterialRegistry.resolveGeometryId(128, true, true));
        assertEquals(Constants.GEOMETRY_CLASS_SLAB, MaterialRegistry.resolveGeometryId(128, false, false));
    }

    @Test
    void resolveGeometryId_pane_both_returns7() {
        assertEquals(7, MaterialRegistry.resolveGeometryId(144, true, true));
    }

    @Test
    void resolveGeometryId_pane_solo_returns12() {
        assertEquals(12, MaterialRegistry.resolveGeometryId(144, false, false));
    }

    @Test
    void resolveGeometryId_pane_before_returns13() {
        assertEquals(13, MaterialRegistry.resolveGeometryId(144, true, false));
    }

    @Test
    void resolveGeometryId_pane_after_returns14() {
        assertEquals(14, MaterialRegistry.resolveGeometryId(144, false, true));
    }

    @Test
    void resolveGeometryId_fullBlock_ignoresNeighbors() {
        assertEquals(0, MaterialRegistry.resolveGeometryId(0, true, true));
    }

    // --- isSlabGeometryId tests ---

    @Test
    void isSlabGeometryId_bottomSlab_returnsTrue() {
        assertTrue(Constants.isSlabGeometryId(6));
    }

    @Test
    void isSlabGeometryId_topSlab_returnsTrue() {
        assertTrue(Constants.isSlabGeometryId(8));
    }

    @Test
    void isSlabGeometryId_fullBlock_returnsFalse() {
        assertFalse(Constants.isSlabGeometryId(0));
    }

    // --- panelBlockIdForMaterial ---

    @Test
    void panelBlockIdForMaterial_fence_returnsFenceBlockId() {
        assertEquals(Constants.PANEL_FENCE_BLOCK_ID, MaterialRegistry.panelBlockIdForMaterial(80));
    }

    @Test
    void panelBlockIdForMaterial_fullBlock_returnsPanelBlockId() {
        assertEquals(Constants.PANEL_BLOCK_ID, MaterialRegistry.panelBlockIdForMaterial(0));
    }
}
