package com.bigdoors.block;

import java.util.List;
import java.util.Map;

import com.bigdoors.BigdoorsMod;
import com.bigdoors.DoorManager;
import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.domain.MaterialRegistry;
import com.bigdoors.domain.PanelRotation;
import com.bigdoors.subsystem.DoorMover;
import com.bigdoors.subsystem.RedstoneHandler;
import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.block.state.properties.IntegerProperty;
import net.minecraft.world.level.redstone.Orientation;
import net.minecraft.world.level.storage.loot.LootParams;
import net.minecraft.world.phys.BlockHitResult;
import org.jspecify.annotations.Nullable;

public class DoorPanelBlock extends Block {

    public static final IntegerProperty MATERIAL_GROUP = IntegerProperty.create("material_group", 0, 12);
    public static final IntegerProperty MATERIAL_ID = IntegerProperty.create("material_id", 0, 15);
    public static final IntegerProperty PANEL_ROTATION = IntegerProperty.create("panel_rotation", 0, 7);
    public static final IntegerProperty OVERLAY = IntegerProperty.create("overlay", 0, 1);
    public static final BooleanProperty POWERED = BlockStateProperties.POWERED;

    public DoorPanelBlock(BlockBehaviour.Properties properties) {
        super(properties);
        registerDefaultState(stateDefinition.any()
                .setValue(MATERIAL_GROUP, 0)
                .setValue(MATERIAL_ID, 0)
                .setValue(PANEL_ROTATION, 0)
                .setValue(OVERLAY, 0)
                .setValue(POWERED, false));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(MATERIAL_GROUP, MATERIAL_ID, PANEL_ROTATION, OVERLAY, POWERED);
    }

    @Override
    protected List<ItemStack> getDrops(BlockState state, LootParams.Builder params) {
        return List.of();
    }

    public static int getFlatIndex(BlockState state) {
        return MaterialRegistry.flatIndexFromGroupAndId(
                state.getValue(MATERIAL_GROUP), state.getValue(MATERIAL_ID));
    }

    public static BlockState applyMaterialIndex(BlockState state, int flatIndex) {
        return state.setValue(MATERIAL_GROUP, MaterialRegistry.materialGroupForIndex(flatIndex))
                    .setValue(MATERIAL_ID, MaterialRegistry.materialIdForIndex(flatIndex));
    }

    // --- Interaction: open / close door ---

    @Override
    protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos,
                                               Player player, BlockHitResult hitResult) {
        if (level.isClientSide()) return InteractionResult.SUCCESS;
        DoorManager manager = BigdoorsMod.getManager();
        if (manager == null) return InteractionResult.PASS;

        BlockPos3 bp = new BlockPos3(pos.getX(), pos.getY(), pos.getZ());
        DoorAssembly assembly = manager.findByPosition(bp);
        if (assembly == null) return InteractionResult.PASS;
        if (assembly.getPanelPositions().isEmpty()) return InteractionResult.PASS;

        long tick = level.getGameTime();
        manager.setRedstoneDebounce(assembly.getId(), tick + Constants.REDSTONE_DEBOUNCE_TICKS);
        if (assembly.getPartnerAssemblyId() != null) {
            manager.setRedstoneDebounce(assembly.getPartnerAssemblyId(), tick + Constants.REDSTONE_DEBOUNCE_TICKS);
        }

        if (!assembly.isOpen()) {
            DoorMover.tryOpen(manager, assembly, player, level);
        } else {
            DoorMover.tryClose(manager, assembly, level);
        }
        return InteractionResult.SUCCESS;
    }

    // --- Neighbor update: panel expansion ---

    @Override
    protected void neighborChanged(BlockState state, Level level, BlockPos pos, Block block,
                                   @Nullable Orientation orientation, boolean movedByPiston) {
        if (level.isClientSide()) return;
        DoorManager manager = BigdoorsMod.getManager();
        if (manager == null) return;
        if (manager.isConversionInProgress(pos)) return;

        BlockPos3 bp = new BlockPos3(pos.getX(), pos.getY(), pos.getZ());
        DoorAssembly assembly = manager.findByPosition(bp);
        if (assembly == null) return;
        if (assembly.getDoorSide() == null) return;

        String wallSide = Constants.OPPOSITE_DIR.get(assembly.getDoorSide());

        for (Map.Entry<String, BlockPos3> entry : Constants.DIR_OFFSETS.entrySet()) {
            String dir = entry.getKey();
            BlockPos3 offset = entry.getValue();

            if (dir.equals(wallSide)) continue;

            BlockPos neighborPos = new BlockPos(
                    pos.getX() + offset.x(), pos.getY() + offset.y(), pos.getZ() + offset.z());

            if (manager.isConversionInProgress(neighborPos)) continue;

            BlockState neighborState = level.getBlockState(neighborPos);
            Block neighborBlock = neighborState.getBlock();
            if (neighborBlock instanceof HingeBlock || neighborBlock instanceof DoorPanelBlock) continue;

            String typeId = BuiltInRegistries.BLOCK.getKey(neighborBlock).toString();
            int matIdx = MaterialRegistry.indexForTypeId(typeId);
            if (matIdx < 0) continue;

            BlockPos3 neighborBp = new BlockPos3(neighborPos.getX(), neighborPos.getY(), neighborPos.getZ());
            if (isOnWallSideOfAnyHinge(assembly, neighborBp, wallSide)) continue;

            manager.startConversion(neighborPos);
            try {
                int geoClass = MaterialRegistry.geometryClassForMaterial(matIdx);
                int overlay = "hidden".equals(assembly.getHingeType()) ? 0 : 1;
                int rotation = PanelRotation.closedRotation(assembly.getDoorSide(),
                        assembly.getFacing(), geoClass);
                Integer geoId = HingeBlock.resolveGeometryId(matIdx, geoClass, null, null);

                Block panelBlock = ModBlocks.panelBlockForGeoClass(geoClass);
                BlockState panelState = applyMaterialIndex(panelBlock.defaultBlockState(), matIdx)
                        .setValue(PANEL_ROTATION, rotation)
                        .setValue(OVERLAY, overlay);
                panelState = HingeBlock.applyGeometryVariant(panelState, geoId);
                level.setBlockAndUpdate(neighborPos, panelState);
                manager.addPanelToAssembly(assembly.getId(), neighborBp, matIdx,
                        geoId, overlay);
            } finally {
                manager.endConversion(neighborPos);
            }
        }

        RedstoneHandler.handlePanelRedstone(state, level, pos, manager, assembly);
    }

    private static boolean isOnWallSideOfAnyHinge(DoorAssembly assembly, BlockPos3 pos, String wallSide) {
        BlockPos3 wallOffset = Constants.DIR_OFFSETS.get(wallSide);
        if (wallOffset == null) return false;

        for (BlockPos3 hingePos : assembly.getHingeBlockPositions()) {
            int dx = pos.x() - hingePos.x();
            int dz = pos.z() - hingePos.z();

            for (Map.Entry<String, BlockPos3> dirEntry : Constants.DIR_OFFSETS.entrySet()) {
                String dirName = dirEntry.getKey();
                BlockPos3 dirOffset = dirEntry.getValue();

                if (dirOffset.x() != 0 && dx != 0 && dz == 0) {
                    if ((dx > 0 && dirOffset.x() > 0) || (dx < 0 && dirOffset.x() < 0)) {
                        if (dirName.equals(wallSide)) return true;
                    }
                } else if (dirOffset.z() != 0 && dz != 0 && dx == 0) {
                    if ((dz > 0 && dirOffset.z() > 0) || (dz < 0 && dirOffset.z() < 0)) {
                        if (dirName.equals(wallSide)) return true;
                    }
                }
            }
        }
        return false;
    }
}
