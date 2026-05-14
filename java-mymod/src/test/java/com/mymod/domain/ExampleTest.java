package com.mymod.domain; // SETUP: Replace with your package

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ExampleTest {

    @Test
    void initializesWithNameAndZeroValue() {
        Example ex = new Example("test");
        assertEquals("test", ex.getName());
        assertEquals(0, ex.getValue());
    }

    @Test
    void incrementsByOneByDefault() {
        Example ex = new Example("counter");
        int result = ex.increment();
        assertEquals(1, result);
        assertEquals(1, ex.getValue());
    }

    @Test
    void incrementsByCustomAmount() {
        Example ex = new Example("counter");
        ex.increment(5);
        assertEquals(5, ex.getValue());
    }
}
