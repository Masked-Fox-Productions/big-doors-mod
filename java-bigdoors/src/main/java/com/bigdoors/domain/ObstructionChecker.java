package com.bigdoors.domain;

import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

/**
 * Checks whether a door's swing path is obstructed.
 * Pure domain class — no Minecraft imports allowed.
 */
public final class ObstructionChecker {

    private ObstructionChecker() {}

    /** Classification of a block in the swing path. */
    public enum BlockClassification {
        AIR, SOFT, PASSABLE, SOLID
    }

    /** Result of checking a door's swing path. */
    public record PathCheckResult(
            boolean canOpen,
            List<BlockPos3> obstructedPositions,
            List<BlockPos3> softBlocks,
            List<BlockPos3> passableBlocks
    ) {}

    /**
     * Classify a block type ID.
     */
    public static BlockClassification classifyBlock(String typeId) {
        if (typeId == null || Constants.AIR_BLOCKS.contains(typeId)) {
            return BlockClassification.AIR;
        }
        if (Constants.SOFT_BLOCKS.contains(typeId)) {
            return BlockClassification.SOFT;
        }
        if (Constants.PASSABLE_BLOCKS.contains(typeId)) {
            return BlockClassification.PASSABLE;
        }
        return BlockClassification.SOLID;
    }

    /**
     * Check whether panels can swing in the given direction without hitting solid blocks.
     *
     * @param panelPositions current positions of all panels
     * @param hingePos       the hinge to rotate around
     * @param direction      "cw" or "ccw"
     * @param blockQueryFn   function that returns the typeId at a given position
     * @return result with canOpen flag and categorized block lists
     */
    public static PathCheckResult checkPath(
            List<BlockPos3> panelPositions,
            BlockPos3 hingePos,
            String direction,
            Function<BlockPos3, String> blockQueryFn
    ) {
        // Build a set of current panel position keys so we can skip them
        Set<String> currentPosKeys = new HashSet<>();
        for (BlockPos3 pos : panelPositions) {
            currentPosKeys.add(pos.toKey());
        }

        List<BlockPos3> obstructed = new ArrayList<>();
        List<BlockPos3> soft = new ArrayList<>();
        List<BlockPos3> passable = new ArrayList<>();
        boolean canOpen = true;

        for (BlockPos3 pos : panelPositions) {
            BlockPos3 dest = "cw".equals(direction)
                    ? RotationMath.rotateCW(pos, hingePos)
                    : RotationMath.rotateCCW(pos, hingePos);

            // Skip destinations occupied by current panels (they'll be vacated)
            if (currentPosKeys.contains(dest.toKey())) {
                continue;
            }

            String typeId = blockQueryFn.apply(dest);
            BlockClassification classification = classifyBlock(typeId);

            switch (classification) {
                case SOLID -> {
                    obstructed.add(dest);
                    canOpen = false;
                }
                case SOFT -> soft.add(dest);
                case PASSABLE -> passable.add(dest);
                case AIR -> { /* nothing to track */ }
            }
        }

        return new PathCheckResult(canOpen, obstructed, soft, passable);
    }
}
