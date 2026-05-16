package com.bigdoors.util;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BlockPos3Test {

    @Test
    void toKey_returnsCommaSeparatedFormat() {
        assertEquals("1,2,3", new BlockPos3(1, 2, 3).toKey());
    }

    @Test
    void recordEquality_works() {
        BlockPos3 a = new BlockPos3(5, 10, 15);
        BlockPos3 b = new BlockPos3(5, 10, 15);
        assertEquals(a, b);
    }

    @Test
    void negativeCoordinates_workInToKey() {
        assertEquals("-1,-2,-3", new BlockPos3(-1, -2, -3).toKey());
    }
}
