package com.bigdoors.domain;

import com.bigdoors.util.Constants;

import java.util.HashMap;
import java.util.Map;

/**
 * Maps between material type IDs and their integer indices.
 * Pure domain class — no Minecraft imports allowed.
 */
public final class MaterialRegistry {

    private MaterialRegistry() {}

    private static final Map<String, Integer> TYPE_TO_INDEX;

    static {
        TYPE_TO_INDEX = new HashMap<>();
        for (int i = 0; i < Constants.MATERIAL_INDEX.length; i++) {
            TYPE_TO_INDEX.put(Constants.MATERIAL_INDEX[i], i);
        }
    }

    /**
     * Returns the index for the given type ID, or -1 if not a supported material.
     */
    public static int indexForTypeId(String typeId) {
        Integer idx = TYPE_TO_INDEX.get(typeId);
        return idx != null ? idx : -1;
    }

    /**
     * Returns the type ID for the given index, or null if out of range.
     */
    public static String typeIdForIndex(int index) {
        if (index < 0 || index >= Constants.MATERIAL_INDEX.length) {
            return null;
        }
        return Constants.MATERIAL_INDEX[index];
    }

    /**
     * Returns true if the given type ID is a supported door panel material.
     */
    public static boolean isSupportedMaterial(String typeId) {
        return indexForTypeId(typeId) >= 0;
    }
}
