package com.bigdoors.handler;

import com.bigdoors.BigdoorsMod;
import com.bigdoors.DoorManager;
import com.bigdoors.block.DoorPanelBlock;
import com.bigdoors.block.HingeBlock;
import com.bigdoors.block.ModBlocks;
import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.domain.MaterialRegistry;
import com.bigdoors.util.BlockPos3;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;

/**
 * Handles block break events for door panels and hinges.
 * <p>
 * When a panel is broken, it is removed from its assembly and the original
 * vanilla material is dropped as an item.
 * <p>
 * When a hinge is broken, the door is closed (if open), all panels are
 * reverted to their original vanilla blocks at their closed positions,
 * and the assembly is dissolved.
 */
public final class BreakHandler {

    private BreakHandler() {}

    /**
     * Registered as a {@code PlayerBlockBreakEvents.AFTER} listener.
     * The {@code oldState} parameter is the block state before the break occurred.
     */
    public static void onBlockBroken(Level level, Player player, BlockPos pos,
                                     BlockState oldState, @Nullable BlockEntity blockEntity) {
        if (level.isClientSide()) return;
        DoorManager manager = BigdoorsMod.getManager();
        if (manager == null) return;

        Block brokenBlock = oldState.getBlock();

        if (brokenBlock instanceof DoorPanelBlock) {
            handlePanelBreak(manager, level, pos, oldState);
        } else if (brokenBlock instanceof HingeBlock) {
            handleHingeBreak(manager, level, pos);
        }
    }

    private static void handlePanelBreak(DoorManager manager, Level level,
                                         BlockPos pos, BlockState oldState) {
        int materialIndex = oldState.getValue(DoorPanelBlock.MATERIAL_INDEX);
        BlockPos3 bp = new BlockPos3(pos.getX(), pos.getY(), pos.getZ());
        DoorAssembly assembly = manager.findByPosition(bp);

        if (assembly != null) {
            manager.removePanelFromAssembly(assembly.getId(), bp);
        }

        // Drop the original vanilla material
        String typeId = MaterialRegistry.typeIdForIndex(materialIndex);
        if (typeId != null) {
            Block vanillaBlock = BuiltInRegistries.BLOCK.getValue(Identifier.parse(typeId));
            ItemStack stack = new ItemStack(vanillaBlock.asItem());
            ItemEntity itemEntity = new ItemEntity(level,
                    pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5, stack);
            level.addFreshEntity(itemEntity);
        }
    }

    private static void handleHingeBreak(DoorManager manager, Level level, BlockPos pos) {
        BlockPos3 bp = new BlockPos3(pos.getX(), pos.getY(), pos.getZ());
        DoorAssembly assembly = manager.findByPosition(bp);
        if (assembly == null) return;

        List<DoorAssembly.PanelEntry> panels = assembly.getPanelPositions();
        boolean isOpen = assembly.isOpen();

        // Step 1: Add ALL panel closedPos positions to conversion guard
        List<BlockPos> guardedPositions = new ArrayList<>(panels.size());
        for (DoorAssembly.PanelEntry panel : panels) {
            BlockPos closedMcPos = new BlockPos(
                    panel.closedPos().x(), panel.closedPos().y(), panel.closedPos().z());
            manager.startConversion(closedMcPos);
            guardedPositions.add(closedMcPos);
        }

        try {
            // Step 2: If open, clear current positions (set to air)
            if (isOpen) {
                for (DoorAssembly.PanelEntry panel : panels) {
                    BlockPos currentMcPos = new BlockPos(
                            panel.currentPos().x(), panel.currentPos().y(), panel.currentPos().z());
                    manager.startConversion(currentMcPos);
                    try {
                        level.setBlockAndUpdate(currentMcPos,
                                net.minecraft.world.level.block.Blocks.AIR.defaultBlockState());
                    } finally {
                        manager.endConversion(currentMcPos);
                    }
                }
            }

            // Step 3: Place vanilla blocks at closedPos
            for (DoorAssembly.PanelEntry panel : panels) {
                String typeId = MaterialRegistry.typeIdForIndex(panel.materialIndex());
                if (typeId == null) continue;

                BlockPos closedMcPos = new BlockPos(
                        panel.closedPos().x(), panel.closedPos().y(), panel.closedPos().z());
                Block vanillaBlock = BuiltInRegistries.BLOCK.getValue(Identifier.parse(typeId));
                level.setBlockAndUpdate(closedMcPos, vanillaBlock.defaultBlockState());
            }
        } finally {
            // Step 4: Remove ALL panel closedPos positions from conversion guard
            for (BlockPos guardedPos : guardedPositions) {
                manager.endConversion(guardedPos);
            }
        }

        // Step 5: Dissolve assembly
        manager.dissolveAssembly(assembly.getId());

        // Drop a hinge item at the break position
        ItemStack hingeStack = new ItemStack(ModBlocks.HINGE_BLOCK.asItem());
        ItemEntity hingeEntity = new ItemEntity(level,
                pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5, hingeStack);
        level.addFreshEntity(hingeEntity);
    }
}
