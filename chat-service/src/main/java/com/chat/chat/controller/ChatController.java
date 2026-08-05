package com.chat.chat.controller;

import com.chat.chat.model.Message;
import com.chat.chat.repository.MessageRepository;
import com.chat.chat.service.PresenceTracker;
import lombok.Data;
import org.springframework.context.event.EventListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Instant;
import java.util.Map;

@Controller
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageRepository messageRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final PresenceTracker presenceTracker;

    public ChatController(SimpMessagingTemplate messagingTemplate,
            MessageRepository messageRepository,
            KafkaTemplate<String, Object> kafkaTemplate,
            PresenceTracker presenceTracker) {
        this.messagingTemplate = messagingTemplate;
        this.messageRepository = messageRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.presenceTracker = presenceTracker;
    }

    // ----- Private messaging -----
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessagePayload payload,
            Principal principal) {
        String sender = principal.getName(); // username from JWT

        // Build and save the message document
        Message message = new Message();
        message.setSenderId(sender);
        message.setReceiverId(payload.getReceiverId());
        message.setContent(payload.getContent());
        message.setTimestamp(Instant.now());
        message.setStatus("sent");

        messageRepository.save(message);

        // Send the message to the receiver's private queue
        messagingTemplate.convertAndSendToUser(
                payload.getReceiverId(),
                "/queue/messages",
                message);

        // Also send back to the sender's queue so their UI updates
        messagingTemplate.convertAndSendToUser(
                sender,
                "/queue/messages",
                message);

        // Produce a Kafka event for the chat‑messages topic (later consumed by
        // notifications)
        // kafkaTemplate.send("chat-messages", message);
    }

    // ----- Presence: user connected -----
    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        if (event.getUser() != null) {
            String username = event.getUser().getName();
            System.out.println(">>> PRESENCE: " + username + " online=true");

            // Broadcast only when this session is the first one open
            if (presenceTracker.connect(username)) {
                // kafkaTemplate.send("user-presence",
                // Map.of("username", username, "online", true));
                messagingTemplate.convertAndSend("/topic/presence",
                        Map.of("username", username, "online", true));
            }
        } else {
            System.out.println(">>> CONNECT EVENT: user is null");
        }
    }

    // ----- Presence: user disconnected -----
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        if (event.getUser() != null) {
            String username = event.getUser().getName();
            System.out.println(">>> PRESENCE: " + username + " online=false");

            // Broadcast only when the last session closed
            if (presenceTracker.disconnect(username)) {
                // kafkaTemplate.send("user-presence",
                // Map.of("username", username, "online", false));
                messagingTemplate.convertAndSend("/topic/presence",
                        Map.of("username", username, "online", false));
            }
        } else {
            System.out.println(">>> DISCONNECT EVENT: user is null");
        }
    }

    // DTO for incoming chat messages
    @Data
    public static class ChatMessagePayload {
        private String receiverId;
        private String content;
    }
}
