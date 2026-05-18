package com.bigdoors.domain;

import com.bigdoors.util.BlockPos3;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;

/**
 * Pure rotation math for door panel positions around a hinge.
 * No Minecraft imports allowed.
 */
public final class RotationMath {

    private RotationMath() {}

    /**
     * Rotate 90 degrees clockwise (looking down, Y-axis).
     * CW: newX = hinge.x - (oldZ - hinge.z), newZ = hinge.z + (oldX - hinge.x)
     */
    public static BlockPos3 rotateCW(BlockPos3 pos, BlockPos3 hingePos) {
        int dx = pos.x() - hingePos.x();
        int dz = pos.z() - hingePos.z();
        return new BlockPos3(
                hingePos.x() - dz,
                pos.y(),
                hingePos.z() + dx
        );
    }

    /**
     * Rotate 90 degrees counter-clockwise (looking down, Y-axis).
     * CCW: newX = hinge.x + (oldZ - hinge.z), newZ = hinge.z - (oldX - hinge.x)
     */
    public static BlockPos3 rotateCCW(BlockPos3 pos, BlockPos3 hingePos) {
        int dx = pos.x() - hingePos.x();
        int dz = pos.z() - hingePos.z();
        return new BlockPos3(
                hingePos.x() + dz,
                pos.y(),
                hingePos.z() - dx
        );
    }

    /**
     * Rotate 90 degrees clockwise in the vertical plane defined by facing direction.
     */
    public static BlockPos3 rotateVerticalCW(BlockPos3 pos, BlockPos3 hingePos, String facing) {
        if ("north".equals(facing) || "south".equals(facing)) {
            int dx = pos.x() - hingePos.x();
            int dy = pos.y() - hingePos.y();
            return new BlockPos3(
                    hingePos.x() + dy,
                    hingePos.y() - dx,
                    pos.z()
            );
        } else {
            // east or west
            int dz = pos.z() - hingePos.z();
            int dy = pos.y() - hingePos.y();
            return new BlockPos3(
                    pos.x(),
                    hingePos.y() - dz,
                    hingePos.z() + dy
            );
        }
    }

    /**
     * Rotate 90 degrees counter-clockwise in the vertical plane defined by facing direction.
     */
    public static BlockPos3 rotateVerticalCCW(BlockPos3 pos, BlockPos3 hingePos, String facing) {
        if ("north".equals(facing) || "south".equals(facing)) {
            int dx = pos.x() - hingePos.x();
            int dy = pos.y() - hingePos.y();
            return new BlockPos3(
                    hingePos.x() - dy,
                    hingePos.y() + dx,
                    pos.z()
            );
        } else {
            // east or west
            int dz = pos.z() - hingePos.z();
            int dy = pos.y() - hingePos.y();
            return new BlockPos3(
                    pos.x(),
                    hingePos.y() + dz,
                    hingePos.z() - dy
            );
        }
    }

    /**
     * Returns the appropriate rotation function for the given mode, facing, and direction.
     */
    public static BiFunction<BlockPos3, BlockPos3, BlockPos3> getRotateFn(String mode, String facing, String direction) {
        if ("vertical".equals(mode)) {
            if ("cw".equals(direction)) {
                return (pos, hinge) -> rotateVerticalCW(pos, hinge, facing);
            } else {
                return (pos, hinge) -> rotateVerticalCCW(pos, hinge, facing);
            }
        }
        if ("cw".equals(direction)) {
            return RotationMath::rotateCW;
        }
        return RotationMath::rotateCCW;
    }

    /**
     * Compute the arc positions for a 90-degree CW rotation: the 45-degree midpoint
     * and the final 90-degree destination.
     */
    public static List<BlockPos3> computeArcPositions(BlockPos3 pos, BlockPos3 hingePos) {
        double dx = pos.x() - hingePos.x();
        double dz = pos.z() - hingePos.z();
        double cos45 = Math.sqrt(0.5); // ≈ 0.7071

        // 45-degree midpoint
        double midX = hingePos.x() + dx * cos45 - dz * cos45;
        double midZ = hingePos.z() + dx * cos45 + dz * cos45;
        BlockPos3 midpoint = new BlockPos3(
                (int) Math.round(midX),
                pos.y(),
                (int) Math.round(midZ)
        );

        // 90-degree destination (same as rotateCW)
        BlockPos3 destination = rotateCW(pos, hingePos);

        List<BlockPos3> result = new ArrayList<>(2);
        result.add(midpoint);
        result.add(destination);
        return result;
    }
}
