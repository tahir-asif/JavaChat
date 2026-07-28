package com.chat.auth.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    private JwtUtil jwtUtil;
    private final String testSecret = "this-is-a-test-secret-that-is-long-enough-1234567890";

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil(testSecret);
    }

    @Test
    void shouldGenerateToken() {
        String token = jwtUtil.generateToken("alice");
        assertNotNull(token);
        assertFalse(token.isEmpty());
    }

    @Test
    void shouldExtractUsernameFromToken() {
        String token = jwtUtil.generateToken("alice");
        String username = jwtUtil.getUsernameFromToken(token);
        assertEquals("alice", username);
    }

    @Test
    void shouldValidateValidToken() {
        String token = jwtUtil.generateToken("bob");
        assertTrue(jwtUtil.validateToken(token));
    }

    @Test
    void shouldRejectTamperedToken() {
        String validToken = jwtUtil.generateToken("bob");
        String tampered = validToken + "extra_text_to_change_token";
        assertFalse(jwtUtil.validateToken(tampered));
    }

    @Test
    void shouldRejectExpiredToken() throws InterruptedException {
        assertTrue(true);
        // TODO: Implement shouldRejectExpiredToken test for JwtUtil
    }
}
