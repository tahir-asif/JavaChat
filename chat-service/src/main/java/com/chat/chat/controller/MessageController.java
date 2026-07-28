package com.chat.chat.controller;

import com.chat.chat.model.Message;
import com.chat.chat.repository.MessageRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageRepository messageRepository;

    public MessageController(MessageRepository messageRepository) {
        this.messageRepository = messageRepository;
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
