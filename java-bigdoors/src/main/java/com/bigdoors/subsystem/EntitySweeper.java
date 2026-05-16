package com.bigdoors.subsystem;

import com.bigdoors.domain.RotationMath;
import com.bigdoors.util.BlockPos3;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.AABB;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Pushes entities out of the way during door movement.
 * Queries all living entities in the swept area and teleports
 * any overlapping ones radially away from the hinge.
 */
public final class EntitySweeper {

    private EntitySweeper() {}

    private static final double PUSH_DISTANCE = 1.5;
    private static final int AABB_MARGIN = 2;

    /**
     * Sweep entities out of the door's swing path.
     *
     * @param level        the server level
     * @param destinations final destination positions of all panels
     * @param sources      original source positions of all panels
     * @param hingePos     the hinge position panels rotate around
     */
    public static void sweep(Level level, List<BlockPos3> destinations,
                             List<BlockPos3> sources, BlockPos3 hingePos) {
        // Collect all swept positions: arc midpoints + destinations
        Set<String> sweptKeys = new HashSet<>();
        for (BlockPos3 src : sources) {
            List<BlockPos3> arcPositions = RotationMath.computeArcPositions(src, hingePos);
            for (BlockPos3 arcPos : arcPositions) {
                sweptKeys.add(arcPos.toKey());
            }
        }
        for (BlockPos3 dest : destinations) {
            sweptKeys.add(dest.toKey());
        }

        // Compute bounding box around all swept positions
        int minX = Integer.MAX_VALUE, minY = Integer.MAX_VALUE, minZ = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE, maxY = Integer.MIN_VALUE, maxZ = Integer.MIN_VALUE;

        for (BlockPos3 dest : destinations) {
            minX = Math.min(minX, dest.x());
            minY = Math.min(minY, dest.y());
            minZ = Math.min(minZ, dest.z());
            maxX = Math.max(maxX, dest.x());
            maxY = Math.max(maxY, dest.y());
            maxZ = Math.max(maxZ, dest.z());
        }
        for (BlockPos3 src : sources) {
            List<BlockPos3> arcPositions = RotationMath.computeArcPositions(src, hingePos);
            for (BlockPos3 arcPos : arcPositions) {
                minX = Math.min(minX, arcPos.x());
                minY = Math.min(minY, arcPos.y());
                minZ = Math.min(minZ, arcPos.z());
                maxX = Math.max(maxX, arcPos.x());
                maxY = Math.max(maxY, arcPos.y());
                maxZ = Math.max(maxZ, arcPos.z());
            }
        }

        AABB aabb = new AABB(
                minX - AABB_MARGIN, minY - AABB_MARGIN, minZ - AABB_MARGIN,
                maxX + 1 + AABB_MARGIN, maxY + 1 + AABB_MARGIN, maxZ + 1 + AABB_MARGIN
        );

        List<LivingEntity> entities = level.getEntitiesOfClass(LivingEntity.class, aabb);

        for (LivingEntity entity : entities) {
            int ex = (int) Math.floor(entity.getX());
            int ey = (int) Math.floor(entity.getY());
            int ez = (int) Math.floor(entity.getZ());
            String entityKey = ex + "," + ey + "," + ez;

            if (sweptKeys.contains(entityKey)) {
                // Push radially away from hinge
                double dx = entity.getX() - (hingePos.x() + 0.5);
                double dz = entity.getZ() - (hingePos.z() + 0.5);
                double dist = Math.sqrt(dx * dx + dz * dz);

                double newX, newZ;
                if (dist < 0.001) {
                    // Entity is right on the hinge — push in an arbitrary direction
                    newX = entity.getX() + PUSH_DISTANCE;
                    newZ = entity.getZ();
                } else {
                    double nx = dx / dist;
                    double nz = dz / dist;
                    newX = entity.getX() + nx * PUSH_DISTANCE;
                    newZ = entity.getZ() + nz * PUSH_DISTANCE;
                }

                entity.teleportTo(newX, entity.getY(), newZ);
            }
        }
    }
}
