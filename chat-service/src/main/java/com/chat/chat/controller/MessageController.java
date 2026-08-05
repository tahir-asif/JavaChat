package com.chat.chat.controller;

import com.chat.chat.model.Message;
import com.chat.chat.repository.MessageRepository;
import com.chat.chat.service.PresenceTracker;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageRepository messageRepository;
    private final PresenceTracker presenceTracker;

    public MessageController(MessageRepository messageRepository, PresenceTracker presenceTracker) {
        this.messageRepository = messageRepository;
        this.presenceTracker = presenceTracker;
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }

    @GetMapping("/online")
    public ResponseEntity<Set<String>> onlineUsers() {
        return ResponseEntity.ok(presenceTracker.onlineUsers());
    }

    @GetMapping("/{otherUser}")
    public ResponseEntity<List<Message>> getChatHistory(
            @PathVariable String otherUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            Principal principal) {

        String currentUser = principal.getName(); // from JWT
        Pageable pageable = PageRequest.of(page, size);

        // Fetch messages between currentUser and otherUser, newest first
        List<Message> messages = messageRepository
                .findBySenderIdAndReceiverIdOrReceiverIdAndSenderIdOrderByTimestampDesc(
                        currentUser, otherUser, // sender=currentUser, receiver=otherUser
                        currentUser, otherUser, // receiver=currentUser, sender=otherUser ← param3=receiverId,
                                                // param4=senderId
                        pageable);

        return ResponseEntity.ok(messages);
    }
}
