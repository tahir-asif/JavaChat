package com.chat.chat.repository;

import com.chat.chat.model.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MessageRepository extends MongoRepository<Message, String> {

    // Find all messages between two users, newest first (for pagination)
    List<Message> findBySenderIdAndReceiverIdOrReceiverIdAndSenderIdOrderByTimestampDesc(
            String sender1, String receiver1,
            String sender2, String receiver2,
            Pageable pageable);
}
