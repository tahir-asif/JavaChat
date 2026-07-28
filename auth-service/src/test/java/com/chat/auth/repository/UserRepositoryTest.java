package com.chat.auth.repository;

import com.chat.auth.config.MongoTestBase;
import com.chat.auth.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@DataMongoTest
class UserRepositoryTest extends MongoTestBase {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void cleanUp() {
        userRepository.deleteAll();

        // Explicitly create the unique index on "username" for the test
        IndexOperations indexOps = mongoTemplate.indexOps(User.class);
        Index uniqueIndex = new Index().on("username", Sort.Direction.ASC).unique();
        indexOps.ensureIndex(uniqueIndex);
    }

    @Test
    void shouldSaveAndFindUserByUsername() {
        User user = new User(null, "alice", "hashedPassword", false);
        userRepository.save(user);

        Optional<User> found = userRepository.findByUsername("alice");
        assertTrue(found.isPresent());
        assertEquals("alice", found.get().getUsername());
        assertEquals("hashedPassword", found.get().getPasswordHash());
        assertNotNull(found.get().getId()); // ID was auto‑generated
    }

    @Test
    void shouldFindByUsernameContainingIgnoreCase() {
        userRepository.save(new User(null, "Alice", "hash", false));
        userRepository.save(new User(null, "Bob", "hash", false));
        userRepository.save(new User(null, "alicia", "hash", false));

        var results = userRepository.findByUsernameContainingIgnoreCase("ali");
        assertEquals(2, results.size()); // Alice and alicia
    }

    @Test
    void shouldEnforceUniqueUsername() {
        userRepository.save(new User(null, "charlie", "hash", false));

        assertThrows(DuplicateKeyException.class, () -> {
            User duplicate = new User(null, "charlie", "anotherHash", false);
            userRepository.save(duplicate);
        });
    }

    @Test
    void shouldReturnEmptyForUnknownUsername() {
        Optional<User> found = userRepository.findByUsername("nobody");
        assertTrue(found.isEmpty());
    }
}
