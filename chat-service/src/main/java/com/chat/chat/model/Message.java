package com.chat.chat.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @Id
    private String id;

    private String senderId; // username of the sender
    private String receiverId; // username of the receiver
    private String content;
    private Instant timestamp;
    private String status; // "sent", "delivered", "read"
}
