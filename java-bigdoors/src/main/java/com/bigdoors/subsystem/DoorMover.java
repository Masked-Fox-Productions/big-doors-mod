package com.bigdoors.subsystem;

import com.bigdoors.DoorManager;
import com.bigdoors.block.DoorPanelBlock;
import com.bigdoors.block.ModBlocks;
import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.domain.MaterialRegistry;
import com.bigdoors.domain.ObstructionChecker;
import com.bigdoors.domain.RotationMath;
import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/**
 * Encapsulates the open/close block movement algorithm for doors.
 * All static methods — no instance state.
 */
public final class DoorMover {

    private DoorMover() {}

    /**
     * Try to open a door interactively. Determines preferred direction based on
     * the player's position, tries that direction first, then falls back to the
     * opposite. Also opens partner doors for double-door assemblies.
     */
    public static void tryOpen(DoorManager manager, DoorAssembly assembly,
                               Player player, Level level) {
        List<DoorAssembly.PanelEntry> panels = assembly.getPanelPositions();
        if (panels.isEmpty()) return;

        BlockPos3 hingePos = assembly.getPrimaryHingePos();
        List<BlockPos3> panelPositions = assembly.getAllCurrentPositions();

        String preferred = preferredDirection(panelPositions, hingePos, player);
        String fallback = "cw".equals(preferred) ? "ccw" : "cw";

        String openedDir = null;
        if (attemptOpen(manager, assembly, panelPositions, hingePos, preferred, level)) {
            openedDir = preferred;
        } else if (attemptOpen(manager, assembly, panelPositions, hingePos, fallback, level)) {
            openedDir = fallback;
        }

        // Open partner door in the mirror direction
        if (openedDir != null && assembly.getPartnerAssemblyId() != null) {
            String mirrorDir = "cw".equals(openedDir) ? "ccw" : "cw";
            DoorAssembly partner = manager.getAssembly(assembly.getPartnerAssemblyId());
            if (partner != null && !partner.isOpen()) {
                List<BlockPos3> partnerPositions = partner.getAllCurrentPositions();
                BlockPos3 partnerHinge = partner.getPrimaryHingePos();
                attemptOpen(manager, partner, partnerPositions, partnerHinge, mirrorDir, level);
            }
        }
    }

    /**
     * Try to close a door interactively. Also closes partner door if open.
     */
    public static void tryClose(DoorManager manager, DoorAssembly assembly, Level level) {
        closeAssembly(manager, assembly, level);

        if (assembly.getPartnerAssemblyId() != null) {
            DoorAssembly partner = manager.getAssembly(assembly.getPartnerAssemblyId());
            if (partner != null && partner.isOpen()) {
                closeAssembly(manager, partner, level);
            }
        }
    }

    /**
     * Attempt to open a single assembly in the given direction.
     *
     * @return true if the door was successfully opened
     */
    public static boolean attemptOpen(DoorManager manager, DoorAssembly assembly,
                                      List<BlockPos3> panelPositions, BlockPos3 hingePos,
                                      String direction, Level level) {
        // Build world query function
        Function<BlockPos3, String> blockQueryFn = pos ->
                BuiltInRegistries.BLOCK.getKey(
                        level.getBlockState(new BlockPos(pos.x(), pos.y(), pos.z())).getBlock()
                ).toString();

        // Check for obstructions
        ObstructionChecker.PathCheckResult result =
                ObstructionChecker.checkPath(panelPositions, hingePos, direction, blockQueryFn);

        if (!result.canOpen()) return false;

        // Compute destinations
        List<BlockPos3> destinations = new ArrayList<>(panelPositions.size());
        for (BlockPos3 pos : panelPositions) {
            BlockPos3 dest = "cw".equals(direction)
                    ? RotationMath.rotateCW(pos, hingePos)
                    : RotationMath.rotateCCW(pos, hingePos);
            destinations.add(dest);
        }

        // Destroy soft blocks (set to air, no drops)
        for (BlockPos3 pos : result.softBlocks()) {
            level.setBlock(new BlockPos(pos.x(), pos.y(), pos.z()),
                    Blocks.AIR.defaultBlockState(),
                    net.minecraft.world.level.block.Block.UPDATE_ALL);
        }

        // Destroy passable blocks (with item drops)
        for (BlockPos3 pos : result.passableBlocks()) {
            level.destroyBlock(new BlockPos(pos.x(), pos.y(), pos.z()), true);
        }

        // Sweep entities
        EntitySweeper.sweep(level, destinations, panelPositions, hingePos);

        // Collect material indices before clearing
        List<DoorAssembly.PanelEntry> panels = assembly.getPanelPositions();

        // Phase 1: Clear all source positions with conversion guard
        for (BlockPos3 pos : panelPositions) {
            BlockPos mcPos = new BlockPos(pos.x(), pos.y(), pos.z());
            manager.startConversion(mcPos);
            try {
                level.setBlock(mcPos, Blocks.AIR.defaultBlockState(),
                        net.minecraft.world.level.block.Block.UPDATE_ALL);
            } finally {
                manager.endConversion(mcPos);
            }
        }

        // Phase 2: Place door panels at destination positions
        for (int i = 0; i < destinations.size(); i++) {
            BlockPos3 dest = destinations.get(i);
            int matIdx = panels.get(i).materialIndex();
            BlockPos mcPos = new BlockPos(dest.x(), dest.y(), dest.z());
            manager.startConversion(mcPos);
            try {
                BlockState panelState = ModBlocks.DOOR_PANEL_BLOCK.defaultBlockState()
                        .setValue(DoorPanelBlock.MATERIAL_INDEX, matIdx);
                level.setBlockAndUpdate(mcPos, panelState);
            } finally {
                manager.endConversion(mcPos);
            }
        }

        // Phase 3: Update manager state
        manager.openDoor(assembly.getId(), direction, destinations);

        return true;
    }

    /**
     * Close a single assembly, moving panels back to their closed positions.
     */
    public static void closeAssembly(DoorManager manager, DoorAssembly assembly, Level level) {
        List<DoorAssembly.PanelEntry> panels = assembly.getPanelPositions();
        if (panels.isEmpty()) return;

        List<BlockPos3> currentPositions = assembly.getAllCurrentPositions();
        List<BlockPos3> closedPositions = new ArrayList<>(panels.size());
        for (DoorAssembly.PanelEntry panel : panels) {
            closedPositions.add(panel.closedPos());
        }

        // Phase 1: Clear all current positions with conversion guard
        for (BlockPos3 pos : currentPositions) {
            BlockPos mcPos = new BlockPos(pos.x(), pos.y(), pos.z());
            manager.startConversion(mcPos);
            try {
                level.setBlock(mcPos, Blocks.AIR.defaultBlockState(),
                        net.minecraft.world.level.block.Block.UPDATE_ALL);
            } finally {
                manager.endConversion(mcPos);
            }
        }

        // Phase 2: Place panels at closed positions
        for (int i = 0; i < closedPositions.size(); i++) {
            BlockPos3 dest = closedPositions.get(i);
            int matIdx = panels.get(i).materialIndex();
            BlockPos mcPos = new BlockPos(dest.x(), dest.y(), dest.z());
            manager.startConversion(mcPos);
            try {
                BlockState panelState = ModBlocks.DOOR_PANEL_BLOCK.defaultBlockState()
                        .setValue(DoorPanelBlock.MATERIAL_INDEX, matIdx);
                level.setBlockAndUpdate(mcPos, panelState);
            } finally {
                manager.endConversion(mcPos);
            }
        }

        // Phase 3: Update manager state
        manager.closeDoor(assembly.getId());
    }

    public static void openWithRedstone(DoorManager manager, DoorAssembly assembly, Level level, BlockPos sourcePos) {
        if (assembly.getPanelPositions().isEmpty()) return;

        BlockPos3 hingePos = assembly.getPrimaryHingePos();
        List<BlockPos3> panelPositions = assembly.getAllCurrentPositions();

        String preferred = preferredDirectionFromSource(panelPositions, hingePos, sourcePos);
        String fallback = "cw".equals(preferred) ? "ccw" : "cw";

        String direction = preferred;
        boolean opened = attemptOpen(manager, assembly, panelPositions, hingePos, direction, level);
        if (!opened) {
            direction = fallback;
            opened = attemptOpen(manager, assembly, panelPositions, hingePos, direction, level);
        }
        if (!opened) return;

        if (assembly.getPartnerAssemblyId() != null) {
            DoorAssembly partner = manager.getAssembly(assembly.getPartnerAssemblyId());
            if (partner != null && !partner.isOpen() && !partner.getPanelPositions().isEmpty()) {
                manager.setRedstoneDebounce(partner.getId(), level.getGameTime() + Constants.REDSTONE_DEBOUNCE_TICKS);
                String mirrorDir = "cw".equals(direction) ? "ccw" : "cw";
                BlockPos3 partnerHinge = partner.getPrimaryHingePos();
                List<BlockPos3> partnerPanels = partner.getAllCurrentPositions();
                attemptOpen(manager, partner, partnerPanels, partnerHinge, mirrorDir, level);
            }
        }
    }

    private static String preferredDirectionFromSource(List<BlockPos3> panelPositions,
                                                       BlockPos3 hingePos, BlockPos sourcePos) {
        long cwTotalDist = 0;
        long ccwTotalDist = 0;

        for (BlockPos3 pos : panelPositions) {
            BlockPos3 cwDest = RotationMath.rotateCW(pos, hingePos);
            BlockPos3 ccwDest = RotationMath.rotateCCW(pos, hingePos);

            cwTotalDist += Math.abs(cwDest.x() + 0.5 - sourcePos.getX())
                         + Math.abs(cwDest.z() + 0.5 - sourcePos.getZ());
            ccwTotalDist += Math.abs(ccwDest.x() + 0.5 - sourcePos.getX())
                         + Math.abs(ccwDest.z() + 0.5 - sourcePos.getZ());
        }

        return cwTotalDist >= ccwTotalDist ? "cw" : "ccw";
    }

    public static void closeWithRedstone(DoorManager manager, DoorAssembly assembly, Level level) {
        closeAssembly(manager, assembly, level);

        if (assembly.getPartnerAssemblyId() != null) {
            DoorAssembly partner = manager.getAssembly(assembly.getPartnerAssemblyId());
            if (partner != null && partner.isOpen()) {
                manager.setRedstoneDebounce(partner.getId(), level.getGameTime() + Constants.REDSTONE_DEBOUNCE_TICKS);
                closeAssembly(manager, partner, level);
            }
        }
    }

    /**
     * Determine the preferred rotation direction to move panels away from the player.
     *
     * @return "cw" or "ccw"
     */
    public static String preferredDirection(List<BlockPos3> panelPositions,
                                            BlockPos3 hingePos, Player player) {
        if (player == null) return "cw";

        double px = player.getX();
        double pz = player.getZ();

        long cwTotalDist = 0;
        long ccwTotalDist = 0;

        for (BlockPos3 pos : panelPositions) {
            BlockPos3 cwDest = RotationMath.rotateCW(pos, hingePos);
            BlockPos3 ccwDest = RotationMath.rotateCCW(pos, hingePos);

            // Manhattan distance from player to each destination
            cwTotalDist += Math.abs(cwDest.x() + 0.5 - px) + Math.abs(cwDest.z() + 0.5 - pz);
            ccwTotalDist += Math.abs(ccwDest.x() + 0.5 - px) + Math.abs(ccwDest.z() + 0.5 - pz);
        }

        // Pick direction that moves panels AWAY from player (greater total distance)
        return cwTotalDist >= ccwTotalDist ? "cw" : "ccw";
    }
}
