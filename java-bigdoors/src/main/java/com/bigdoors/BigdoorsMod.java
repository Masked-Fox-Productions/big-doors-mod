package com.bigdoors;

import com.bigdoors.block.ModBlocks;
import com.bigdoors.handler.BreakHandler;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class BigdoorsMod implements ModInitializer {

    public static final String MOD_ID = "bigdoors";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    private static DoorManager manager;

    public static DoorManager getManager() {
        return manager;
    }

    @Override
    public void onInitialize() {
        ModBlocks.initialize();

        PlayerBlockBreakEvents.AFTER.register((world, player, pos, state, entity) -> {
            BreakHandler.onBlockBroken(world, player, pos, state, entity);
        });

        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            BigDoorsState state = server.overworld().getDataStorage().computeIfAbsent(BigDoorsState.TYPE);
            manager = new DoorManager();
            manager.load(state.getAssembliesJson());
            manager.setSaveCallback(() -> {
                state.setAssembliesJson(manager.serialize());
            });
            LOGGER.info("{} mod loaded", MOD_ID);
        });

        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            if (manager != null) {
                manager.save();
                manager = null;
            }
        });

        LOGGER.info("{} mod initialized", MOD_ID);
    }
}
