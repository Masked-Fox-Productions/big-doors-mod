package com.bigdoors.domain;

import com.bigdoors.util.Constants;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PanelRotationTest {

    // --- closedRotation horizontal ---

    @Test
    void closedRotation_east_north_fullBlock_returns2() {
        assertEquals(2, PanelRotation.closedRotation("east", "north", 0));
    }

    @Test
    void closedRotation_south_north_fullBlock_returns1() {
        assertEquals(1, PanelRotation.closedRotation("south", "north", 0));
    }

    @Test
    void closedRotation_west_north_fullBlock_returns0() {
        assertEquals(0, PanelRotation.closedRotation("west", "north", 0));
    }

    @Test
    void closedRotation_north_north_fullBlock_returns3() {
        assertEquals(3, PanelRotation.closedRotation("north", "north", 0));
    }

    // --- closedRotation vertical ---

    @Test
    void closedRotation_up_north_fence_returns2() {
        assertEquals(2, PanelRotation.closedRotation("up", "north", Constants.GEOMETRY_CLASS_FENCE));
    }

    @Test
    void closedRotation_up_east_fence_returns1() {
        assertEquals(1, PanelRotation.closedRotation("up", "east", Constants.GEOMETRY_CLASS_FENCE));
    }

    @Test
    void closedRotation_up_north_fullBlock_returns5() {
        assertEquals(5, PanelRotation.closedRotation("up", "north", 0));
    }

    @Test
    void closedRotation_up_east_fullBlock_returns4() {
        assertEquals(4, PanelRotation.closedRotation("up", "east", 0));
    }

    @Test
    void closedRotation_down_south_slab_returns2() {
        assertEquals(2, PanelRotation.closedRotation("down", "south", Constants.GEOMETRY_CLASS_SLAB));
    }

    // --- openRotation horizontal ---

    @Test
    void openRotation_horizontal_east_north_cw_fullBlock() {
        // closed=2, cw → (2+3)%4 = 1
        assertEquals(1, PanelRotation.openRotation("horizontal", "east", "north", "cw", 0));
    }

    @Test
    void openRotation_horizontal_east_north_ccw_fullBlock() {
        // closed=2, ccw → (2+1)%4 = 3
        assertEquals(3, PanelRotation.openRotation("horizontal", "east", "north", "ccw", 0));
    }

    @Test
    void openRotation_horizontal_west_north_cw_fullBlock() {
        // closed=0, cw → (0+3)%4 = 3
        assertEquals(3, PanelRotation.openRotation("horizontal", "west", "north", "cw", 0));
    }

    // --- openRotation vertical ---

    @Test
    void openRotation_vertical_up_north_cw_fullBlock_returns1() {
        assertEquals(1, PanelRotation.openRotation("vertical", "up", "north", "cw", 0));
    }

    @Test
    void openRotation_vertical_up_east_fullBlock_returns0() {
        assertEquals(0, PanelRotation.openRotation("vertical", "up", "east", "cw", 0));
    }

    @Test
    void openRotation_vertical_up_east_fence_returns5() {
        assertEquals(5, PanelRotation.openRotation("vertical", "up", "east", "cw", Constants.GEOMETRY_CLASS_FENCE));
    }

    @Test
    void openRotation_vertical_up_north_fence_returns6() {
        assertEquals(6, PanelRotation.openRotation("vertical", "up", "north", "cw", Constants.GEOMETRY_CLASS_FENCE));
    }
}
