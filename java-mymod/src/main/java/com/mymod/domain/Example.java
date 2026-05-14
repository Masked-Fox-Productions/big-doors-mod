package com.mymod.domain; // SETUP: Replace with your package

/**
 * Example domain class — pure Java, no Minecraft imports.
 * Domain classes are testable with plain JUnit, no game server needed.
 *
 * SETUP: Replace this with your own domain classes.
 */
public class Example {

    private final String name;
    private int value;

    public Example(String name) {
        this.name = name;
        this.value = 0;
    }

    public String getName() {
        return name;
    }

    public int getValue() {
        return value;
    }

    public int increment(int amount) {
        value += amount;
        return value;
    }

    public int increment() {
        return increment(1);
    }
}
