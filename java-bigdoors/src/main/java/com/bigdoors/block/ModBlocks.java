package com.bigdoors.block;

import java.util.function.Function;

import com.bigdoors.BigdoorsMod;
import net.fabricmc.fabric.api.creativetab.v1.CreativeModeTabEvents;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.state.BlockBehaviour;

public class ModBlocks {

    public static final Block HINGE_BLOCK = registerBlock("hinge",
            HingeBlock::new,
            BlockBehaviour.Properties.of()
                    .destroyTime(3.0f)
                    .explosionResistance(6.0f)
                    .sound(SoundType.STONE)
                    .requiresCorrectToolForDrops());

    public static final Block DOOR_PANEL_BLOCK = registerBlock("door_panel",
            DoorPanelBlock::new,
            BlockBehaviour.Properties.of()
                    .destroyTime(2.0f)
                    .explosionResistance(6.0f)
                    .sound(SoundType.STONE));

    public static void initialize() {
        CreativeModeTabEvents.modifyOutputEvent(CreativeModeTabs.FUNCTIONAL_BLOCKS).register(output -> {
            output.accept(HINGE_BLOCK);
            output.accept(DOOR_PANEL_BLOCK);
        });
    }

    private static Block registerBlock(String name, Function<BlockBehaviour.Properties, Block> factory, BlockBehaviour.Properties properties) {
        Identifier id = Identifier.fromNamespaceAndPath(BigdoorsMod.MOD_ID, name);
        ResourceKey<Block> blockKey = ResourceKey.create(Registries.BLOCK, id);
        Block block = factory.apply(properties.setId(blockKey));
        Block registered = Registry.register(BuiltInRegistries.BLOCK, blockKey, block);

        ResourceKey<Item> itemKey = ResourceKey.create(Registries.ITEM, id);
        Item.Properties itemProps = new Item.Properties().setId(itemKey).useBlockDescriptionPrefix();
        BlockItem blockItem = new BlockItem(registered, itemProps);
        blockItem.registerBlocks(Item.BY_BLOCK, blockItem);
        Registry.register(BuiltInRegistries.ITEM, itemKey, blockItem);

        return registered;
    }
}
