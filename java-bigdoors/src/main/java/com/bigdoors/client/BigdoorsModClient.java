package com.bigdoors.client; // SETUP: Replace with your package

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;

// SETUP: Rename this class to match your mod (e.g., BigdoorsModClient)
@Environment(EnvType.CLIENT)
public class BigdoorsModClient implements ClientModInitializer {

    @Override
    public void onInitializeClient() {
        // SETUP: Register client-side renderers and event handlers here
    }
}
