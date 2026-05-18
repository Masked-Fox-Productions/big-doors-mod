package com.bigdoors.domain;

import com.bigdoors.util.Constants;

import java.util.HashMap;
import java.util.Map;

/**
 * Maps between material type IDs and their integer indices.
 * Provides geometry class resolution for exotic panel block types.
 * Pure domain class — no Minecraft imports allowed.
 */
public final class MaterialRegistry {

    private MaterialRegistry() {}

    private static final Map<String, Integer> TYPE_TO_INDEX;

    static {
        TYPE_TO_INDEX = new HashMap<>();
        for (int i = 0; i < Constants.MATERIAL_INDEX.length; i++) {
            if (Constants.MATERIAL_INDEX[i] != null) {
                TYPE_TO_INDEX.put(Constants.MATERIAL_INDEX[i], i);
            }
        }
    }

    public static int indexForTypeId(String typeId) {
        if (typeId == null) return -1;
        Integer idx = TYPE_TO_INDEX.get(typeId);
        return idx != null ? idx : -1;
    }

    public static String typeIdForIndex(int index) {
        if (index < 0 || index >= Constants.MATERIAL_INDEX.length) {
            return null;
        }
        return Constants.MATERIAL_INDEX[index];
    }

    public static boolean isSupportedMaterial(String typeId) {
        if (typeId == null || typeId.isEmpty()) return false;
        return indexForTypeId(typeId) >= 0;
    }

    public static int materialGroupForIndex(int flatIndex) {
        return flatIndex / 16;
    }

    public static int materialIdForIndex(int flatIndex) {
        return flatIndex % 16;
    }

    public static int flatIndexFromGroupAndId(int group, int id) {
        return group * 16 + id;
    }

    public static int geometryClassForMaterial(int flatIndex) {
        return Constants.MATERIAL_GEOMETRY_CLASS.getOrDefault(flatIndex, 0);
    }

    public static String panelBlockIdForMaterial(int flatIndex) {
        return Constants.panelBlockIdForGeoClass(geometryClassForMaterial(flatIndex));
    }

    /**
     * Resolves the specific geometry_id for a material given its neighbor context.
     * Fence-class: solo/before/after/both variants.
     * Bars-class: full/solo/before/after variants.
     * Pane-class: full/solo/before/after variants.
     * Slab-class: returns the geometry class directly (no neighbor variants).
     * Full block: returns 0.
     */
    public static int resolveGeometryId(int flatIndex, boolean hasNeighborBefore, boolean hasNeighborAfter) {
        int geoClass = geometryClassForMaterial(flatIndex);
        if (geoClass == 0) return 0;

        if (geoClass == Constants.GEOMETRY_CLASS_FENCE) {
            if (hasNeighborBefore && hasNeighborAfter) return 4;
            if (hasNeighborBefore) return 2;
            if (hasNeighborAfter) return 3;
            return 1;
        }

        if (geoClass == Constants.GEOMETRY_CLASS_BARS) {
            if (hasNeighborBefore && hasNeighborAfter) return 5;
            if (hasNeighborBefore) return 10;
            if (hasNeighborAfter) return 11;
            return 9;
        }

        if (geoClass == Constants.GEOMETRY_CLASS_PANE) {
            if (hasNeighborBefore && hasNeighborAfter) return 7;
            if (hasNeighborBefore) return 13;
            if (hasNeighborAfter) return 14;
            return 12;
        }

        // Slab and any other class: return the class directly
        return geoClass;
    }

    /**
     * Compute the full block states map for a panel.
     */
    public static Map<String, Integer> panelBlockStates(int matIdx, int geoId, int rotation, int overlay) {
        Map<String, Integer> states = new HashMap<>();
        states.put("bigdoors:material_group", materialGroupForIndex(matIdx));
        states.put("bigdoors:material_id", materialIdForIndex(matIdx));
        states.put("bigdoors:geometry_id", geoId);
        states.put("bigdoors:panel_rotation", rotation);
        states.put("bigdoors:overlay", overlay);
        return states;
    }
}
