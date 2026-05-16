package com.bigdoors;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import net.minecraft.resources.Identifier;
import net.minecraft.util.datafix.DataFixTypes;
import net.minecraft.world.level.saveddata.SavedData;
import net.minecraft.world.level.saveddata.SavedDataType;

/**
 * Codec-based SavedData wrapper that persists the DoorManager's serialized JSON.
 */
public class BigDoorsState extends SavedData {

    private String assembliesJson;

    public static final Codec<BigDoorsState> CODEC = RecordCodecBuilder.create(
        i -> i.group(
            Codec.STRING.optionalFieldOf("assemblies", "[]").forGetter(s -> s.assembliesJson)
        ).apply(i, BigDoorsState::new)
    );

    public static final SavedDataType<BigDoorsState> TYPE = new SavedDataType<>(
        Identifier.fromNamespaceAndPath("bigdoors", "state"),
        BigDoorsState::new,
        CODEC,
        DataFixTypes.SAVED_DATA_RANDOM_SEQUENCES
    );

    public BigDoorsState() {
        this.assembliesJson = "[]";
    }

    public BigDoorsState(String assembliesJson) {
        this.assembliesJson = assembliesJson;
    }

    public String getAssembliesJson() {
        return assembliesJson;
    }

    public void setAssembliesJson(String json) {
        this.assembliesJson = json;
        setDirty();
    }
}
