package com.bigdoors; // SETUP: Replace with your package

import com.bigdoors.block.ModBlocks; // SETUP: Replace package
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

// SETUP: Rename this class to match your mod (e.g., BigdoorsMod)
public class BigdoorsMod implements ModInitializer {

    public static final String MOD_ID = "bigdoors"; // SETUP: Replace with your mod ID
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        ModBlocks.initialize();

        // SETUP: Register your subsystems and event handlers here

        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            // SETUP: Load persistence here
            LOGGER.info("{} mod loaded", MOD_ID);
        });

        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            // SETUP: Shutdown cleanup here
        });

        LOGGER.info("{} mod initialized", MOD_ID);
    }
}
