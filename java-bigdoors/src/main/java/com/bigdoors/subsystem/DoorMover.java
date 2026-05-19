package com.bigdoors.subsystem;

import com.bigdoors.DoorManager;
import com.bigdoors.block.DoorPanelBlock;
import com.bigdoors.block.ModBlocks;
import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.domain.MaterialRegistry;
import com.bigdoors.domain.ObstructionChecker;
import com.bigdoors.domain.PanelRotation;
import com.bigdoors.domain.RotationMath;
import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import com.bigdoors.block.HingeBlock;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.function.Function;

public final class DoorMover {

    private DoorMover() {}

    public static void tryOpen(DoorManager manager, DoorAssembly assembly,
                               Player player, Level level) {
        List<DoorAssembly.PanelEntry> panels = assembly.getPanelPositions();
        if (panels.isEmpty()) return;

        BlockPos3 hingePos = assembly.getPrimaryHingePos();
        List<BlockPos3> panelPositions = assembly.getAllCurrentPositions();

        String preferred = preferredDirection(panelPositions, hingePos, player, assembly.getMode());
        String fallback = "cw".equals(preferred) ? "ccw" : "cw";

        String openedDir = null;
        if (attemptOpen(manager, assembly, panelPositions, hingePos, preferred, level)) {
            openedDir = preferred;
        } else if (attemptOpen(manager, assembly, panelPositions, hingePos, fallback, level)) {
            openedDir = fallback;
        }

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

    public static void tryClose(DoorManager manager, DoorAssembly assembly, Level level) {
        closeAssembly(manager, assembly, level);

        if (assembly.getPartnerAssemblyId() != null) {
            DoorAssembly partner = manager.getAssembly(assembly.getPartnerAssemblyId());
            if (partner != null && partner.isOpen()) {
                closeAssembly(manager, partner, level);
            }
        }
    }

    public static boolean attemptOpen(DoorManager manager, DoorAssembly assembly,
                                      List<BlockPos3> panelPositions, BlockPos3 hingePos,
                                      String direction, Level level) {
        Function<BlockPos3, String> blockQueryFn = pos ->
                BuiltInRegistries.BLOCK.getKey(
                        level.getBlockState(new BlockPos(pos.x(), pos.y(), pos.z())).getBlock()
                ).toString();

        ObstructionChecker.PathCheckResult result =
                ObstructionChecker.checkPath(panelPositions, hingePos, direction, blockQueryFn,
                        assembly.getMode(), assembly.getFacing());

        if (!result.canOpen()) return false;

        BiFunction<BlockPos3, BlockPos3, BlockPos3> rotateFn =
                RotationMath.getRotateFn(assembly.getMode(), assembly.getFacing(), direction);

        List<BlockPos3> destinations = new ArrayList<>(panelPositions.size());
        for (BlockPos3 pos : panelPositions) {
            destinations.add(rotateFn.apply(pos, hingePos));
        }

        for (BlockPos3 pos : result.softBlocks()) {
            level.setBlock(new BlockPos(pos.x(), pos.y(), pos.z()),
                    Blocks.AIR.defaultBlockState(), Block.UPDATE_ALL);
        }
        for (BlockPos3 pos : result.passableBlocks()) {
            level.destroyBlock(new BlockPos(pos.x(), pos.y(), pos.z()), true);
        }

        EntitySweeper.sweep(level, destinations, panelPositions, hingePos);

        List<DoorAssembly.PanelEntry> panels = assembly.getPanelPositions();

        // Phase 1: Clear source positions
        for (BlockPos3 pos : panelPositions) {
            BlockPos mcPos = new BlockPos(pos.x(), pos.y(), pos.z());
            manager.startConversion(mcPos);
            try {
                level.setBlock(mcPos, Blocks.AIR.defaultBlockState(), Block.UPDATE_ALL);
            } finally {
                manager.endConversion(mcPos);
            }
        }

        // Phase 2: Place panels at destinations with correct block type and states
        for (int i = 0; i < destinations.size(); i++) {
            BlockPos3 dest = destinations.get(i);
            DoorAssembly.PanelEntry panel = panels.get(i);
            BlockPos mcPos = new BlockPos(dest.x(), dest.y(), dest.z());
            manager.startConversion(mcPos);
            try {
                BlockState panelState = buildPanelState(panel, assembly, direction, true);
                level.setBlockAndUpdate(mcPos, panelState);
            } finally {
                manager.endConversion(mcPos);
            }
        }

        manager.openDoor(assembly.getId(), direction, destinations);
        return true;
    }

    public static void closeAssembly(DoorManager manager, DoorAssembly assembly, Level level) {
        List<DoorAssembly.PanelEntry> panels = assembly.getPanelPositions();
        if (panels.isEmpty()) return;

        List<BlockPos3> currentPositions = assembly.getAllCurrentPositions();
        List<BlockPos3> closedPositions = new ArrayList<>(panels.size());
        for (DoorAssembly.PanelEntry panel : panels) {
            closedPositions.add(panel.closedPos());
        }

        // Close obstruction check
        Set<String> currentKeys = new HashSet<>();
        for (BlockPos3 pos : currentPositions) {
            currentKeys.add(pos.toKey());
        }

        Function<BlockPos3, String> blockQueryFn = pos ->
                BuiltInRegistries.BLOCK.getKey(
                        level.getBlockState(new BlockPos(pos.x(), pos.y(), pos.z())).getBlock()
                ).toString();

        ObstructionChecker.CloseCheckResult closeResult =
                ObstructionChecker.checkClose(closedPositions, currentKeys, blockQueryFn);

        if (!closeResult.canClose()) return;

        for (BlockPos3 pos : closeResult.softBlocks()) {
            level.setBlock(new BlockPos(pos.x(), pos.y(), pos.z()),
                    Blocks.AIR.defaultBlockState(), Block.UPDATE_ALL);
        }
        for (BlockPos3 pos : closeResult.passableBlocks()) {
            level.destroyBlock(new BlockPos(pos.x(), pos.y(), pos.z()), true);
        }

        // Phase 1: Clear current positions
        for (BlockPos3 pos : currentPositions) {
            BlockPos mcPos = new BlockPos(pos.x(), pos.y(), pos.z());
            manager.startConversion(mcPos);
            try {
                level.setBlock(mcPos, Blocks.AIR.defaultBlockState(), Block.UPDATE_ALL);
            } finally {
                manager.endConversion(mcPos);
            }
        }

        // Phase 2: Place at closed positions with correct block type
        for (int i = 0; i < closedPositions.size(); i++) {
            BlockPos3 dest = closedPositions.get(i);
            DoorAssembly.PanelEntry panel = panels.get(i);
            BlockPos mcPos = new BlockPos(dest.x(), dest.y(), dest.z());
            manager.startConversion(mcPos);
            try {
                BlockState panelState = buildPanelState(panel, assembly, null, false);
                level.setBlockAndUpdate(mcPos, panelState);
            } finally {
                manager.endConversion(mcPos);
            }
        }

        manager.closeDoor(assembly.getId());
    }

    private static BlockState buildPanelState(DoorAssembly.PanelEntry panel,
                                               DoorAssembly assembly,
                                               String direction, boolean isOpen) {
        int matIdx = panel.materialIndex();
        int geoClass = MaterialRegistry.geometryClassForMaterial(matIdx);
        Block panelBlock = ModBlocks.panelBlockForGeoClass(geoClass);

        BlockState state = DoorPanelBlock.applyMaterialIndex(panelBlock.defaultBlockState(), matIdx);

        int rotation;
        if (isOpen) {
            rotation = PanelRotation.openRotation(assembly.getMode(),
                    assembly.getDoorSide(), assembly.getFacing(), direction, geoClass);
        } else {
            rotation = PanelRotation.closedRotation(assembly.getDoorSide(),
                    assembly.getFacing(), geoClass);
        }
        state = state.setValue(DoorPanelBlock.PANEL_ROTATION, rotation);
        state = state.setValue(DoorPanelBlock.OVERLAY, panel.overlay());
        state = HingeBlock.applyGeometryVariant(state, panel.geometryId());

        return state;
    }

    public static void openWithRedstone(DoorManager manager, DoorAssembly assembly, Level level, BlockPos sourcePos) {
        if (assembly.getPanelPositions().isEmpty()) return;

        BlockPos3 hingePos = assembly.getPrimaryHingePos();
        List<BlockPos3> panelPositions = assembly.getAllCurrentPositions();

        String preferred = preferredDirectionFromSource(panelPositions, hingePos, sourcePos, assembly.getMode());
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
                                                       BlockPos3 hingePos, BlockPos sourcePos,
                                                       String mode) {
        BiFunction<BlockPos3, BlockPos3, BlockPos3> cwFn =
                RotationMath.getRotateFn(mode, "", "cw");
        BiFunction<BlockPos3, BlockPos3, BlockPos3> ccwFn =
                RotationMath.getRotateFn(mode, "", "ccw");

        long cwTotalDist = 0;
        long ccwTotalDist = 0;

        for (BlockPos3 pos : panelPositions) {
            BlockPos3 cwDest = cwFn.apply(pos, hingePos);
            BlockPos3 ccwDest = ccwFn.apply(pos, hingePos);

            cwTotalDist += Math.abs(cwDest.x() + 0.5 - sourcePos.getX())
                         + Math.abs(cwDest.y() + 0.5 - sourcePos.getY())
                         + Math.abs(cwDest.z() + 0.5 - sourcePos.getZ());
            ccwTotalDist += Math.abs(ccwDest.x() + 0.5 - sourcePos.getX())
                          + Math.abs(ccwDest.y() + 0.5 - sourcePos.getY())
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

    public static String preferredDirection(List<BlockPos3> panelPositions,
                                            BlockPos3 hingePos, Player player, String mode) {
        if (player == null) return "cw";

        BiFunction<BlockPos3, BlockPos3, BlockPos3> cwFn =
                RotationMath.getRotateFn(mode, "", "cw");
        BiFunction<BlockPos3, BlockPos3, BlockPos3> ccwFn =
                RotationMath.getRotateFn(mode, "", "ccw");

        double px = player.getX();
        double py = player.getY();
        double pz = player.getZ();

        long cwTotalDist = 0;
        long ccwTotalDist = 0;

        for (BlockPos3 pos : panelPositions) {
            BlockPos3 cwDest = cwFn.apply(pos, hingePos);
            BlockPos3 ccwDest = ccwFn.apply(pos, hingePos);

            cwTotalDist += (long)(Math.abs(cwDest.x() + 0.5 - px)
                         + Math.abs(cwDest.y() + 0.5 - py)
                         + Math.abs(cwDest.z() + 0.5 - pz));
            ccwTotalDist += (long)(Math.abs(ccwDest.x() + 0.5 - px)
                          + Math.abs(ccwDest.y() + 0.5 - py)
                          + Math.abs(ccwDest.z() + 0.5 - pz));
        }

        return cwTotalDist >= ccwTotalDist ? "cw" : "ccw";
    }
}
