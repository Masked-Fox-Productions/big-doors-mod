package com.bigdoors.domain;

import com.bigdoors.util.BlockPos3;
import com.bigdoors.domain.ObstructionChecker.BlockClassification;
import com.bigdoors.domain.ObstructionChecker.PathCheckResult;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ObstructionCheckerTest {

    @Test
    void classifyBlock_softGrass_returnsSoft() {
        assertEquals(BlockClassification.SOFT, ObstructionChecker.classifyBlock("minecraft:short_grass"));
    }

    @Test
    void classifyBlock_torch_returnsPassable() {
        assertEquals(BlockClassification.PASSABLE, ObstructionChecker.classifyBlock("minecraft:torch"));
    }

    @Test
    void classifyBlock_stone_returnsSolid() {
        assertEquals(BlockClassification.SOLID, ObstructionChecker.classifyBlock("minecraft:stone"));
    }

    @Test
    void classifyBlock_null_returnsAir() {
        assertEquals(BlockClassification.AIR, ObstructionChecker.classifyBlock(null));
    }

    @Test
    void classifyBlock_air_returnsAir() {
        assertEquals(BlockClassification.AIR, ObstructionChecker.classifyBlock("minecraft:air"));
    }

    @Test
    void checkPath_allAir_canOpen() {
        BlockPos3 hinge = new BlockPos3(0, 0, 0);
        List<BlockPos3> panels = List.of(new BlockPos3(1, 0, 0), new BlockPos3(2, 0, 0));

        PathCheckResult result = ObstructionChecker.checkPath(panels, hinge, "cw", pos -> null);

        assertTrue(result.canOpen());
        assertTrue(result.obstructedPositions().isEmpty());
    }

    @Test
    void checkPath_solidDestination_cannotOpen() {
        BlockPos3 hinge = new BlockPos3(0, 0, 0);
        List<BlockPos3> panels = List.of(new BlockPos3(1, 0, 0));

        PathCheckResult result = ObstructionChecker.checkPath(panels, hinge, "cw",
                pos -> "minecraft:stone");

        assertFalse(result.canOpen());
        assertEquals(1, result.obstructedPositions().size());
    }

    @Test
    void checkPath_mixedDestinations_populatesSoftAndPassableLists() {
        BlockPos3 hinge = new BlockPos3(0, 0, 0);
        List<BlockPos3> panels = List.of(
                new BlockPos3(1, 0, 0),
                new BlockPos3(2, 0, 0),
                new BlockPos3(3, 0, 0)
        );

        PathCheckResult result = ObstructionChecker.checkPath(panels, hinge, "cw", pos -> {
            // Panel at (1,0,0) rotates CW → (0,0,1)
            if (pos.equals(new BlockPos3(0, 0, 1))) return "minecraft:short_grass";
            // Panel at (2,0,0) rotates CW → (0,0,2)
            if (pos.equals(new BlockPos3(0, 0, 2))) return "minecraft:torch";
            // Panel at (3,0,0) rotates CW → (0,0,3)
            return null; // air
        });

        assertTrue(result.canOpen());
        assertEquals(1, result.softBlocks().size());
        assertEquals(1, result.passableBlocks().size());
        assertTrue(result.obstructedPositions().isEmpty());
    }

    @Test
    void checkPath_skipsCurrentPanelPositions() {
        BlockPos3 hinge = new BlockPos3(0, 0, 0);
        // Panel at (0,0,1) — its CW destination is (-1,0,0)
        // Panel at (-1,0,0) — this IS a current panel position, so when (0,0,1) rotates to it, skip
        // Actually let's think more carefully:
        // (0,0,1) CW → hinge.x - (1-0) = -1, hinge.z + (0-0) = 0 → (-1,0,0)
        // (-1,0,0) CW → hinge.x - (0-0) = 0, hinge.z + (-1-0) = -1 → (0,0,-1)
        List<BlockPos3> panels = List.of(new BlockPos3(0, 0, 1), new BlockPos3(-1, 0, 0));

        // If we query (-1,0,0) it would be "stone" but it's a current panel position so should be skipped
        PathCheckResult result = ObstructionChecker.checkPath(panels, hinge, "cw", pos -> {
            if (pos.equals(new BlockPos3(-1, 0, 0))) return "minecraft:stone";
            if (pos.equals(new BlockPos3(0, 0, -1))) return null; // air
            return "minecraft:stone"; // everything else solid
        });

        assertTrue(result.canOpen());
    }
}
