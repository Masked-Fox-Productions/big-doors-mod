package com.bigdoors.util;

/**
 * Lightweight position record used by domain classes instead of MC's BlockPos.
 * No Minecraft imports allowed.
 */
public record BlockPos3(int x, int y, int z) {

    /**
     * Returns a string key in "x,y,z" format suitable for map lookups.
     */
    public String toKey() {
        return x + "," + y + "," + z;
    }
}
