package com.bigdoors.domain;

import com.bigdoors.util.BlockPos3;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RotationMathTest {

    @Test
    void rotateCW_pointEastOfHinge_movesSouth() {
        // Point at (5,0,3), hinge at (3,0,3) → point is 2 east
        // After CW: newX = 3 - (3-3) = 3, newZ = 3 + (5-3) = 5
        assertEquals(new BlockPos3(3, 0, 5), RotationMath.rotateCW(new BlockPos3(5, 0, 3), new BlockPos3(3, 0, 3)));
    }

    @Test
    void rotateCCW_pointEastOfHinge_movesNorth() {
        // After CCW: newX = 3 + (3-3) = 3, newZ = 3 - (5-3) = 1
        assertEquals(new BlockPos3(3, 0, 1), RotationMath.rotateCCW(new BlockPos3(5, 0, 3), new BlockPos3(3, 0, 3)));
    }

    @Test
    void rotateCCW_reverses_rotateCW() {
        BlockPos3 pos = new BlockPos3(5, 0, 3);
        BlockPos3 hinge = new BlockPos3(3, 0, 3);
        BlockPos3 cwResult = RotationMath.rotateCW(pos, hinge);
        BlockPos3 roundTrip = RotationMath.rotateCCW(cwResult, hinge);
        assertEquals(pos, roundTrip);
    }

    @Test
    void rotateAtHinge_returnsHingeUnchanged() {
        BlockPos3 hinge = new BlockPos3(3, 5, 3);
        assertEquals(hinge, RotationMath.rotateCW(hinge, hinge));
        assertEquals(hinge, RotationMath.rotateCCW(hinge, hinge));
    }

    @Test
    void rotateFarFromHinge_producesValidResult() {
        BlockPos3 pos = new BlockPos3(23, 0, 3);
        BlockPos3 hinge = new BlockPos3(3, 0, 3);
        BlockPos3 result = RotationMath.rotateCW(pos, hinge);
        assertEquals(new BlockPos3(3, 0, 23), result);
    }

    @Test
    void fourCWRotations_returnToOriginal() {
        BlockPos3 pos = new BlockPos3(5, 2, 3);
        BlockPos3 hinge = new BlockPos3(3, 2, 3);
        BlockPos3 current = pos;
        for (int i = 0; i < 4; i++) {
            current = RotationMath.rotateCW(current, hinge);
        }
        assertEquals(pos, current);
    }

    @Test
    void rotateVerticalCW_northSouthFacing() {
        // Panel above hinge by 1, same x/z
        BlockPos3 pos = new BlockPos3(3, 6, 3);
        BlockPos3 hinge = new BlockPos3(3, 5, 3);
        // dx=0, dy=1 → newX = 3+1=4, newY = 5-0=5
        BlockPos3 result = RotationMath.rotateVerticalCW(pos, hinge, "north");
        assertEquals(new BlockPos3(4, 5, 3), result);
    }

    @Test
    void rotateVerticalCCW_northSouthFacing() {
        BlockPos3 pos = new BlockPos3(3, 6, 3);
        BlockPos3 hinge = new BlockPos3(3, 5, 3);
        // dx=0, dy=1 → newX = 3-1=2, newY = 5+0=5
        BlockPos3 result = RotationMath.rotateVerticalCCW(pos, hinge, "north");
        assertEquals(new BlockPos3(2, 5, 3), result);
    }

    @Test
    void rotateVerticalCW_eastWestFacing() {
        BlockPos3 pos = new BlockPos3(3, 6, 3);
        BlockPos3 hinge = new BlockPos3(3, 5, 3);
        // dz=0, dy=1 → newY = 5-0=5, newZ = 3+1=4
        BlockPos3 result = RotationMath.rotateVerticalCW(pos, hinge, "east");
        assertEquals(new BlockPos3(3, 5, 4), result);
    }

    @Test
    void rotateVerticalCCW_eastWestFacing() {
        BlockPos3 pos = new BlockPos3(3, 6, 3);
        BlockPos3 hinge = new BlockPos3(3, 5, 3);
        // dz=0, dy=1 → newY = 5+0=5, newZ = 3-1=2
        BlockPos3 result = RotationMath.rotateVerticalCCW(pos, hinge, "east");
        assertEquals(new BlockPos3(3, 5, 2), result);
    }

    @Test
    void computeArcPositions_returnsMidpointAndDestination() {
        BlockPos3 pos = new BlockPos3(5, 0, 3);
        BlockPos3 hinge = new BlockPos3(3, 0, 3);
        List<BlockPos3> arc = RotationMath.computeArcPositions(pos, hinge);
        assertEquals(2, arc.size());
        // Midpoint: dx=2, dz=0, cos45≈0.7071
        // midX = 3 + 2*0.7071 - 0 = 4.414 → 4
        // midZ = 3 + 2*0.7071 + 0 = 4.414 → 4
        assertEquals(new BlockPos3(4, 0, 4), arc.get(0));
        // Destination is same as rotateCW
        assertEquals(new BlockPos3(3, 0, 5), arc.get(1));
    }
}
