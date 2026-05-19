package com.bigdoors.handler;

import com.bigdoors.BigdoorsMod;
import com.bigdoors.DoorManager;
import com.bigdoors.block.DoorPanelBlock;
import com.bigdoors.block.HiddenHingeBlock;
import com.bigdoors.block.HingeBlock;
import com.bigdoors.block.ModBlocks;
import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.domain.MaterialRegistry;
import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;

public final class BreakHandler {

    private BreakHandler() {}

    public static void onBlockBroken(Level level, Player player, BlockPos pos,
                                     BlockState oldState, @Nullable BlockEntity blockEntity) {
        if (level.isClientSide()) return;
        DoorManager manager = BigdoorsMod.getManager();
        if (manager == null) return;

        boolean creative = player.isCreative();
        Block brokenBlock = oldState.getBlock();

        if (brokenBlock instanceof DoorPanelBlock) {
            handlePanelBreak(manager, level, pos, oldState, creative);
        } else if (brokenBlock instanceof HingeBlock) {
            handleHingeBreak(manager, level, pos, oldState, creative);
        }
    }

    private static void handlePanelBreak(DoorManager manager, Level level,
                                         BlockPos pos, BlockState oldState, boolean creative) {
        int materialIndex = DoorPanelBlock.getFlatIndex(oldState);
        BlockPos3 bp = new BlockPos3(pos.getX(), pos.getY(), pos.getZ());
        DoorAssembly assembly = manager.findByPosition(bp);

        if (assembly != null) {
            boolean wasBoundary = assembly.removeBoundaryPanel(bp);
            if (!wasBoundary) {
                manager.removePanelFromAssembly(assembly.getId(), bp);
            }
        }

        if (!creative) {
            dropVanillaItem(level, pos, materialIndex);
        }
    }

    private static void handleHingeBreak(DoorManager manager, Level level,
                                          BlockPos pos, BlockState oldState, boolean creative) {
        BlockPos3 bp = new BlockPos3(pos.getX(), pos.getY(), pos.getZ());
        DoorAssembly assembly = manager.findByPosition(bp);
        if (assembly == null) return;

        List<DoorAssembly.PanelEntry> panels = assembly.getPanelPositions();
        List<DoorAssembly.PanelEntry> boundaryPanels = assembly.getBoundaryPanels();
        boolean isOpen = assembly.isOpen();

        List<DoorAssembly.PanelEntry> allPanels = new ArrayList<>(panels.size() + boundaryPanels.size());
        allPanels.addAll(panels);
        allPanels.addAll(boundaryPanels);

        List<BlockPos> guardedPositions = new ArrayList<>(allPanels.size());
        for (DoorAssembly.PanelEntry panel : allPanels) {
            BlockPos closedMcPos = new BlockPos(
                    panel.closedPos().x(), panel.closedPos().y(), panel.closedPos().z());
            manager.startConversion(closedMcPos);
            guardedPositions.add(closedMcPos);
        }

        try {
            if (isOpen) {
                for (DoorAssembly.PanelEntry panel : panels) {
                    BlockPos currentMcPos = new BlockPos(
                            panel.currentPos().x(), panel.currentPos().y(), panel.currentPos().z());
                    manager.startConversion(currentMcPos);
                    try {
                        level.setBlockAndUpdate(currentMcPos, Blocks.AIR.defaultBlockState());
                    } finally {
                        manager.endConversion(currentMcPos);
                    }
                }
            }

            for (DoorAssembly.PanelEntry panel : allPanels) {
                String typeId = MaterialRegistry.typeIdForIndex(panel.materialIndex());
                if (typeId == null) continue;

                BlockPos closedMcPos = new BlockPos(
                        panel.closedPos().x(), panel.closedPos().y(), panel.closedPos().z());
                Block vanillaBlock = BuiltInRegistries.BLOCK.getValue(Identifier.parse(typeId));
                level.setBlockAndUpdate(closedMcPos, vanillaBlock.defaultBlockState());
            }
        } finally {
            for (BlockPos guardedPos : guardedPositions) {
                manager.endConversion(guardedPos);
            }
        }

        manager.dissolveAssembly(assembly.getId());

        if (!creative) {
            if (oldState.getBlock() instanceof HiddenHingeBlock) {
                int hingeMat = assembly.getHingePositions().isEmpty()
                        ? Constants.UNMATCHED_MATERIAL_INDEX
                        : assembly.getHingePositions().get(0).materialIndex();
                if (hingeMat != Constants.UNMATCHED_MATERIAL_INDEX) {
                    dropVanillaItem(level, pos, hingeMat);
                } else {
                    dropItem(level, pos, ModBlocks.HIDDEN_HINGE_BLOCK);
                }
            } else {
                dropItem(level, pos, ModBlocks.HINGE_BLOCK);
            }
        }
    }

    private static void dropVanillaItem(Level level, BlockPos pos, int materialIndex) {
        String typeId = MaterialRegistry.typeIdForIndex(materialIndex);
        if (typeId != null) {
            Block vanillaBlock = BuiltInRegistries.BLOCK.getValue(Identifier.parse(typeId));
            ItemStack stack = new ItemStack(vanillaBlock.asItem());
            ItemEntity itemEntity = new ItemEntity(level,
                    pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5, stack);
            level.addFreshEntity(itemEntity);
        }
    }

    private static void dropItem(Level level, BlockPos pos, Block block) {
        ItemStack stack = new ItemStack(block.asItem());
        ItemEntity entity = new ItemEntity(level,
                pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5, stack);
        level.addFreshEntity(entity);
    }
}
