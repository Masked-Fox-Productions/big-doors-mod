package com.bigdoors.block;

import com.bigdoors.BigdoorsMod;
import com.bigdoors.DoorManager;
import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.domain.MaterialRegistry;
import com.bigdoors.util.BlockPos3;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.block.state.properties.IntegerProperty;
import org.jspecify.annotations.Nullable;

public class HiddenHingeBlock extends HingeBlock {

    public static final IntegerProperty MATERIAL_GROUP = DoorPanelBlock.MATERIAL_GROUP;
    public static final IntegerProperty MATERIAL_ID = DoorPanelBlock.MATERIAL_ID;
    public static final BooleanProperty MATCHED = BooleanProperty.create("matched");

    public HiddenHingeBlock(BlockBehaviour.Properties properties) {
        super(properties);
        registerDefaultState(defaultBlockState()
                .setValue(MATERIAL_GROUP, 0)
                .setValue(MATERIAL_ID, 0)
                .setValue(MATCHED, false));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        super.createBlockStateDefinition(builder);
        builder.add(MATERIAL_GROUP, MATERIAL_ID, MATCHED);
    }

    @Override
    protected String getHingeType() {
        return "hidden";
    }

    public static BlockState applyMaterial(BlockState state, int flatIndex) {
        return state.setValue(MATERIAL_GROUP, MaterialRegistry.materialGroupForIndex(flatIndex))
                    .setValue(MATERIAL_ID, MaterialRegistry.materialIdForIndex(flatIndex))
                    .setValue(MATCHED, true);
    }
}
