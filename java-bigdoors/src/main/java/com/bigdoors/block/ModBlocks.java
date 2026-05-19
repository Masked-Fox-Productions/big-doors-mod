package com.bigdoors.block;

import java.util.function.Function;

import com.bigdoors.BigdoorsMod;
import com.bigdoors.util.Constants;
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
            panelProperties());

    public static final Block DOOR_PANEL_FENCE_BLOCK = registerBlock("door_panel_fence",
            DoorPanelFenceBlock::new,
            panelProperties().noOcclusion());

    public static final Block DOOR_PANEL_BARS_BLOCK = registerBlock("door_panel_bars",
            DoorPanelBarsBlock::new,
            panelProperties().noOcclusion());

    public static final Block DOOR_PANEL_PANE_BLOCK = registerBlock("door_panel_pane",
            DoorPanelPaneBlock::new,
            panelProperties().noOcclusion());

    public static final Block DOOR_PANEL_SLAB_BLOCK = registerBlock("door_panel_slab",
            DoorPanelSlabBlock::new,
            panelProperties());

    public static Block panelBlockForGeoClass(int geoClass) {
        return switch (geoClass) {
            case Constants.GEOMETRY_CLASS_FENCE -> DOOR_PANEL_FENCE_BLOCK;
            case Constants.GEOMETRY_CLASS_BARS -> DOOR_PANEL_BARS_BLOCK;
            case Constants.GEOMETRY_CLASS_PANE -> DOOR_PANEL_PANE_BLOCK;
            case Constants.GEOMETRY_CLASS_SLAB -> DOOR_PANEL_SLAB_BLOCK;
            default -> DOOR_PANEL_BLOCK;
        };
    }

    public static void initialize() {
        CreativeModeTabEvents.modifyOutputEvent(CreativeModeTabs.FUNCTIONAL_BLOCKS).register(output -> {
            output.accept(HINGE_BLOCK);
            output.accept(DOOR_PANEL_BLOCK);
            output.accept(DOOR_PANEL_FENCE_BLOCK);
            output.accept(DOOR_PANEL_BARS_BLOCK);
            output.accept(DOOR_PANEL_PANE_BLOCK);
            output.accept(DOOR_PANEL_SLAB_BLOCK);
        });
    }

    private static BlockBehaviour.Properties panelProperties() {
        return BlockBehaviour.Properties.of()
                .destroyTime(2.0f)
                .explosionResistance(6.0f)
                .sound(SoundType.STONE);
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
