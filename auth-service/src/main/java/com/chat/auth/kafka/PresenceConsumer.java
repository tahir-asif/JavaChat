package com.chat.auth.kafka;

import com.chat.auth.model.User;
import com.chat.auth.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

@Component
public class PresenceConsumer {

    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public PresenceConsumer(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @KafkaListener(topics = "user-presence", groupId = "auth-service")
    public void handlePresence(String json) {
        try {
            // Parse the raw JSON into a Map
            Map<String, Object> event = objectMapper.readValue(json, Map.class);
            String username = (String) event.get("username");
            Boolean online = (Boolean) event.get("online");

            if (username != null && online != null) {
                Optional<User> userOpt = userRepository.findByUsername(username);
                if (userOpt.isPresent()) {
                    User user = userOpt.get();
                    user.setOnline(online);
                    userRepository.save(user);
                }
            }
        } catch (JsonProcessingException e) {
            // Log the malformed message and skip it
            System.err.println("Failed to parse presence event: " + json);
        }
    }
}
