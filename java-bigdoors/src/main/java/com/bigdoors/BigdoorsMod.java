package com.bigdoors;

import com.bigdoors.block.ModBlocks;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
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
