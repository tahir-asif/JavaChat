package com.chat.auth;

import com.chat.auth.config.MongoTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration")
class AuthServiceApplicationTests extends MongoTestBase {

	@Test
	void contextLoads() {
	}
}
