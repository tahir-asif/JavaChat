package com.chat.chat.security;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;

public class AuthChannelInterceptor implements ChannelInterceptor {

    private final JwtUtil jwtUtil;

    public AuthChannelInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        // Only intercept CONNECT frames
        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            // Get the JWT from the STOMP headers (client sends "Authorization" header)
            String authHeader = accessor.getFirstNativeHeader("Authorization");

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);

                if (jwtUtil.validateToken(token)) {
                    String username = jwtUtil.getUsernameFromToken(token);
                    // Store the authenticated username in the session attributes
                    accessor.setUser(() -> username);
                    accessor.getSessionAttributes().put("username", username);
                } else {
                    throw new IllegalArgumentException("Invalid JWT");
                }
            } else {
                throw new IllegalArgumentException("Missing or malformed Authorization header");
            }
        }
        return message;
    }
}
