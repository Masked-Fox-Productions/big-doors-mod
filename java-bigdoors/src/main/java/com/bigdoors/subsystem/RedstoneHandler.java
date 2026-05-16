package com.bigdoors.subsystem;

import com.bigdoors.BigdoorsMod;
import com.bigdoors.DoorManager;
import com.bigdoors.block.DoorPanelBlock;
import com.bigdoors.block.HingeBlock;
import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;

import java.util.List;

public final class RedstoneHandler {

    private RedstoneHandler() {}

    public static void handleRedstone(BlockState state, Level level, BlockPos pos,
                                      DoorManager manager, DoorAssembly assembly) {
        if (!(level instanceof ServerLevel serverLevel)) return;

        boolean isPowered = level.getBestNeighborSignal(pos) > 0;
        boolean wasPowered = state.getValue(HingeBlock.POWERED);

        if (isPowered == wasPowered) return;

        level.setBlock(pos, state.setValue(HingeBlock.POWERED, isPowered), Block.UPDATE_CLIENTS);

        long currentTick = level.getGameTime();
        if (manager.isRedstoneDebounced(assembly.getId(), currentTick)) return;

        if (isPowered && !assembly.isOpen()) {
            manager.setRedstoneDebounce(assembly.getId(), currentTick + Constants.REDSTONE_DEBOUNCE_TICKS);
            BlockPos sourcePos = findPowerSource(level, pos);
            DoorMover.openWithRedstone(manager, assembly, level, sourcePos);
        } else if (!isPowered && assembly.isOpen()) {
            scheduleCloseCheck(serverLevel, manager, assembly);
        }
    }

    public static void handlePanelRedstone(BlockState state, Level level, BlockPos pos,
                                           DoorManager manager, DoorAssembly assembly) {
        if (!(level instanceof ServerLevel serverLevel)) return;

        boolean isPowered = level.getBestNeighborSignal(pos) > 0;
        boolean wasPowered = state.getValue(DoorPanelBlock.POWERED);

        if (isPowered == wasPowered) return;

        level.setBlock(pos, state.setValue(DoorPanelBlock.POWERED, isPowered), Block.UPDATE_CLIENTS);

        long currentTick = level.getGameTime();
        if (manager.isRedstoneDebounced(assembly.getId(), currentTick)) return;

        if (isPowered && !assembly.isOpen()) {
            manager.setRedstoneDebounce(assembly.getId(), currentTick + Constants.REDSTONE_DEBOUNCE_TICKS);
            BlockPos sourcePos = findPowerSource(level, pos);
            DoorMover.openWithRedstone(manager, assembly, level, sourcePos);
        } else if (!isPowered && assembly.isOpen()) {
            scheduleCloseCheck(serverLevel, manager, assembly);
        }
    }

    private static void scheduleCloseCheck(ServerLevel level, DoorManager manager, DoorAssembly assembly) {
        long currentTick = level.getGameTime();
        if (manager.isRedstoneDebounced(assembly.getId(), currentTick)) return;

        manager.setRedstoneDebounce(assembly.getId(), currentTick + Constants.REDSTONE_DEBOUNCE_TICKS);
        String assemblyId = assembly.getId();
        long targetTick = currentTick + Constants.REDSTONE_DEBOUNCE_TICKS;

        level.getServer().execute(() -> {
            // Re-check after execution — if we haven't reached the target tick yet, reschedule
            if (level.getGameTime() < targetTick) {
                level.getServer().execute(() -> executeCloseCheck(level, assemblyId));
            } else {
                executeCloseCheck(level, assemblyId);
            }
        });
    }

    private static void executeCloseCheck(ServerLevel level, String assemblyId) {
        DoorManager mgr = BigdoorsMod.getManager();
        if (mgr == null) return;
        DoorAssembly asm = mgr.getAssembly(assemblyId);
        if (asm == null || !asm.isOpen()) return;

        boolean stillPowered = false;
        for (BlockPos3 hingePos : asm.getHingePositions()) {
            BlockPos bp = new BlockPos(hingePos.x(), hingePos.y(), hingePos.z());
            if (level.getBestNeighborSignal(bp) > 0) {
                stillPowered = true;
                break;
            }
        }
        if (!stillPowered) {
            for (BlockPos3 panelPos : asm.getAllCurrentPositions()) {
                BlockPos bp = new BlockPos(panelPos.x(), panelPos.y(), panelPos.z());
                if (level.getBestNeighborSignal(bp) > 0) {
                    stillPowered = true;
                    break;
                }
            }
        }

        if (!stillPowered) {
            mgr.setRedstoneDebounce(assemblyId, level.getGameTime() + Constants.REDSTONE_DEBOUNCE_TICKS);
            DoorMover.closeWithRedstone(mgr, asm, level);
        }
    }

    private static BlockPos findPowerSource(Level level, BlockPos pos) {
        for (Direction dir : Direction.values()) {
            BlockPos neighborPos = pos.relative(dir);
            BlockState neighborState = level.getBlockState(neighborPos);
            Block neighborBlock = neighborState.getBlock();
            if (neighborBlock instanceof HingeBlock || neighborBlock instanceof DoorPanelBlock) continue;
            if (level.getSignal(neighborPos, dir) > 0) {
                return neighborPos;
            }
        }
        return pos;
    }
}
