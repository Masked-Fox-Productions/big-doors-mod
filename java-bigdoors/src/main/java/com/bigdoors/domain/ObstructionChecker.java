package com.bigdoors.domain;

import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.function.Function;

/**
 * Checks whether a door's swing path is obstructed.
 * Pure domain class — no Minecraft imports allowed.
 */
public final class ObstructionChecker {

    private ObstructionChecker() {}

    public enum BlockClassification {
        AIR, SOFT, PASSABLE, SOLID
    }

    public record PathCheckResult(
            boolean canOpen,
            List<BlockPos3> obstructedPositions,
            List<BlockPos3> softBlocks,
            List<BlockPos3> passableBlocks
    ) {}

    public record CloseCheckResult(
            boolean canClose,
            List<BlockPos3> obstructedPositions,
            List<BlockPos3> softBlocks,
            List<BlockPos3> passableBlocks
    ) {}

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
     * Backward-compatible overload defaulting to horizontal mode.
     */
    public static PathCheckResult checkPath(
            List<BlockPos3> panelPositions,
            BlockPos3 hingePos,
            String direction,
            Function<BlockPos3, String> blockQueryFn
    ) {
        return checkPath(panelPositions, hingePos, direction, blockQueryFn, "horizontal", "");
    }

    /**
     * Mode-aware path checking for door rotation.
     */
    public static PathCheckResult checkPath(
            List<BlockPos3> panelPositions,
            BlockPos3 hingePos,
            String direction,
            Function<BlockPos3, String> blockQueryFn,
            String mode,
            String facing
    ) {
        BiFunction<BlockPos3, BlockPos3, BlockPos3> rotateFn =
                RotationMath.getRotateFn(mode, facing, direction);

        Set<String> currentPosKeys = new HashSet<>();
        for (BlockPos3 pos : panelPositions) {
            currentPosKeys.add(pos.toKey());
        }

        List<BlockPos3> obstructed = new ArrayList<>();
        List<BlockPos3> soft = new ArrayList<>();
        List<BlockPos3> passable = new ArrayList<>();

        for (BlockPos3 pos : panelPositions) {
            BlockPos3 dest = rotateFn.apply(pos, hingePos);

            if (currentPosKeys.contains(dest.toKey())) {
                continue;
            }

            String typeId = blockQueryFn.apply(dest);
            BlockClassification classification = classifyBlock(typeId);

            switch (classification) {
                case SOLID -> obstructed.add(dest);
                case SOFT -> soft.add(dest);
                case PASSABLE -> passable.add(dest);
                case AIR -> { /* nothing */ }
            }
        }

        return new PathCheckResult(obstructed.isEmpty(), obstructed, soft, passable);
    }

    /**
     * Check whether a door can close without hitting solid blocks at its closed positions.
     *
     * @param closedPositions    the positions panels will return to
     * @param currentPositionKeys keys of positions currently occupied by panels (being vacated)
     * @param blockQueryFn       function returning typeId at a position
     */
    public static CloseCheckResult checkClose(
            List<BlockPos3> closedPositions,
            Set<String> currentPositionKeys,
            Function<BlockPos3, String> blockQueryFn
    ) {
        List<BlockPos3> obstructed = new ArrayList<>();
        List<BlockPos3> soft = new ArrayList<>();
        List<BlockPos3> passable = new ArrayList<>();

        for (BlockPos3 dest : closedPositions) {
            if (currentPositionKeys.contains(dest.toKey())) {
                continue;
            }

            String typeId = blockQueryFn.apply(dest);
            BlockClassification classification = classifyBlock(typeId);

            switch (classification) {
                case SOLID -> obstructed.add(dest);
                case SOFT -> soft.add(dest);
                case PASSABLE -> passable.add(dest);
                case AIR -> { /* nothing */ }
            }
        }

        return new CloseCheckResult(obstructed.isEmpty(), obstructed, soft, passable);
    }
}
