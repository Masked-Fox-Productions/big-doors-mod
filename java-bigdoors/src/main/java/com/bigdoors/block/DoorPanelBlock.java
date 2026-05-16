package com.bigdoors.block;

import java.util.List;
import java.util.Map;

import com.bigdoors.BigdoorsMod;
import com.bigdoors.DoorManager;
import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.domain.MaterialRegistry;
import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.IntegerProperty;
import net.minecraft.world.level.redstone.Orientation;
import net.minecraft.world.level.storage.loot.LootParams;
import org.jspecify.annotations.Nullable;

/**
 * A door panel block whose appearance is determined by a material index (0-63).
 * Each index maps to a different vanilla texture, allowing doors to match
 * the surrounding build style. On neighbor updates, expands the door by
 * converting adjacent supported vanilla blocks into additional panels.
 */
public class DoorPanelBlock extends Block {

    public static final IntegerProperty MATERIAL_INDEX = IntegerProperty.create("material_index", 0, 63);

    public DoorPanelBlock(BlockBehaviour.Properties properties) {
        super(properties);
        registerDefaultState(stateDefinition.any()
                .setValue(MATERIAL_INDEX, 0));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(MATERIAL_INDEX);
    }

    @Override
    protected List<ItemStack> getDrops(BlockState state, LootParams.Builder params) {
        return List.of();
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

            // Don't convert on the wall side
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

            // Check that neighbor isn't on the wall side relative to ANY hinge in the assembly
            BlockPos3 neighborBp = new BlockPos3(neighborPos.getX(), neighborPos.getY(), neighborPos.getZ());
            if (isOnWallSideOfAnyHinge(assembly, neighborBp, wallSide)) continue;

            manager.startConversion(neighborPos);
            try {
                BlockState panelState = ModBlocks.DOOR_PANEL_BLOCK.defaultBlockState()
                        .setValue(MATERIAL_INDEX, matIdx);
                level.setBlockAndUpdate(neighborPos, panelState);
                manager.addPanelToAssembly(assembly.getId(), neighborBp, matIdx);
            } finally {
                manager.endConversion(neighborPos);
            }
        }
    }

    /**
     * Checks whether the given position is on the wall side relative to any hinge
     * in the assembly. This prevents panels from wrapping around the hinge.
     */
    private static boolean isOnWallSideOfAnyHinge(DoorAssembly assembly, BlockPos3 pos, String wallSide) {
        BlockPos3 wallOffset = Constants.DIR_OFFSETS.get(wallSide);
        if (wallOffset == null) return false;

        for (BlockPos3 hingePos : assembly.getHingePositions()) {
            // Direction from hinge to the candidate position
            int dx = pos.x() - hingePos.x();
            int dz = pos.z() - hingePos.z();

            // Check each direction to see if the candidate is on the wall side of this hinge
            for (Map.Entry<String, BlockPos3> dirEntry : Constants.DIR_OFFSETS.entrySet()) {
                String dirName = dirEntry.getKey();
                BlockPos3 dirOffset = dirEntry.getValue();

                // Check if the position is along this direction from the hinge
                // (i.e., the delta is a positive multiple of the direction offset)
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
