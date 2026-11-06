package com.chat.chat.repository;

import com.chat.chat.model.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MessageRepository extends MongoRepository<Message, String> {

    // Find all messages between two users, newest first (for pagination).
    // The _id tiebreaker keeps page boundaries stable when timestamps are equal.
    List<Message> findBySenderIdAndReceiverIdOrReceiverIdAndSenderIdOrderByTimestampDescIdDesc(
            String sender1, String receiver1,
            String sender2, String receiver2,
            Pageable pageable);
}
