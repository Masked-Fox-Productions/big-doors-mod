package com.bigdoors.block;

import net.minecraft.util.StringRepresentable;

/**
 * Door hinge operating mode: horizontal (swing left/right) or vertical (swing up).
 */
public enum DoorMode implements StringRepresentable {
    HORIZONTAL("horizontal"),
    VERTICAL("vertical");

    private final String name;

    DoorMode(String name) {
        this.name = name;
    }

    @Override
    public String getSerializedName() {
        return name;
    }
}
