package com.bigdoors.domain;

import com.bigdoors.util.Constants;

/**
 * Computes rotation state values for panel blocks based on door configuration.
 * Pure domain class — no Minecraft imports allowed.
 */
public final class PanelRotation {

    private PanelRotation() {}

    /**
     * Returns the panel_rotation value (0-7) for a closed panel.
     *
     * @param doorSide direction from hinge to panel (e.g. "east", "up")
     * @param facing   assembly facing direction
     * @param geoClass geometry class (0=full block, or GEOMETRY_CLASS_FENCE/BARS/SLAB/PANE)
     */
    public static int closedRotation(String doorSide, String facing, int geoClass) {
        if ("up".equals(doorSide) || "down".equals(doorSide)) {
            boolean isExotic = geoClass == Constants.GEOMETRY_CLASS_FENCE
                    || geoClass == Constants.GEOMETRY_CLASS_SLAB
                    || geoClass == Constants.GEOMETRY_CLASS_BARS
                    || geoClass == Constants.GEOMETRY_CLASS_PANE;
            if (isExotic) {
                if ("north".equals(facing) || "south".equals(facing)) return 2;
                return 1;
            }
            if ("north".equals(facing) || "south".equals(facing)) return 5;
            return 4;
        }
        return switch (doorSide) {
            case "east" -> 2;
            case "south" -> 1;
            case "west" -> 0;
            default -> 3; // north
        };
    }

    /**
     * Returns the panel_rotation value (0-7) for an open panel.
     *
     * @param mode      "horizontal" or "vertical"
     * @param doorSide  direction from hinge to panel
     * @param facing    assembly facing direction
     * @param direction "cw" or "ccw"
     * @param geoClass  geometry class
     */
    public static int openRotation(String mode, String doorSide, String facing, String direction, int geoClass) {
        if ("vertical".equals(mode)) {
            boolean isExotic = geoClass == Constants.GEOMETRY_CLASS_FENCE
                    || geoClass == Constants.GEOMETRY_CLASS_SLAB
                    || geoClass == Constants.GEOMETRY_CLASS_BARS
                    || geoClass == Constants.GEOMETRY_CLASS_PANE;
            if (isExotic) {
                if ("north".equals(facing) || "south".equals(facing)) return 6;
                return 5;
            }
            if ("north".equals(facing) || "south".equals(facing)) return 1;
            return 0;
        }
        int closed = closedRotation(doorSide, facing, geoClass);
        return "cw".equals(direction) ? (closed + 3) % 4 : (closed + 1) % 4;
    }
}
