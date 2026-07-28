package com.chat.auth.controller;

import com.chat.auth.config.SecurityConfig;
import com.chat.auth.model.User;
import com.chat.auth.repository.UserRepository;
import com.chat.auth.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    private final String testPassword = "secret123";
    private final String hashedPassword = "$2a$10$abcdefghijklmnopqrstuv";
    private final String username = "alice";

    @TestConfiguration
    static class TestConfig {
        @Bean
        public JwtUtil jwtUtil() {
            return new JwtUtil("test-secret-long-enough-at-least-32-characters-!");
        }
    }

    @BeforeEach
    void setUp() {
        // Default: user not found
        when(userRepository.findByUsername(username)).thenReturn(Optional.empty());
        // Password encoder behaviour
        when(passwordEncoder.encode(anyString())).thenReturn(hashedPassword);
        when(passwordEncoder.matches(testPassword, hashedPassword)).thenReturn(true);
    }

    @Test
    void shouldRegisterNewUser() throws Exception {
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        String requestBody = """
                {"username": "%s", "password": "%s"}
                """.formatted(username, testPassword);

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void shouldRejectDuplicateRegistration() throws Exception {
        User existingUser = new User("id1", username, hashedPassword, false);
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(existingUser));

        String requestBody = """
                {"username": "%s", "password": "%s"}
                """.formatted(username, testPassword);

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Username already taken"));
    }

    @Test
    void shouldLoginWithValidCredentials() throws Exception {
        User user = new User("id1", username, hashedPassword, false);
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));

        String requestBody = """
                {"username": "%s", "password": "%s"}
                """.formatted(username, testPassword);

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void shouldRejectInvalidPassword() throws Exception {
        User user = new User("id1", username, hashedPassword, false);
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", hashedPassword)).thenReturn(false);

        String requestBody = """
                {"username": "%s", "password": "wrong"}
                """.formatted(username);

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid credentials"));
    }

    @Test
    void shouldSearchUsersWithValidToken() throws Exception {
        when(userRepository.findByUsernameContainingIgnoreCase("ali"))
                .thenReturn(List.of(
                        new User("id1", "alice", hashedPassword, false),
                        new User("id2", "alicia", hashedPassword, false)));

        String token = jwtUtil.generateToken("alice");

        mockMvc.perform(get("/api/auth/users/search")
                .param("q", "ali")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("alice"))
                .andExpect(jsonPath("$[1]").value("alicia"));
    }

    @Test
    void shouldRejectSearchWithoutToken() throws Exception {
        mockMvc.perform(get("/api/auth/users/search")
                .param("q", "ali"))
                .andExpect(status().isForbidden());
    }
}
