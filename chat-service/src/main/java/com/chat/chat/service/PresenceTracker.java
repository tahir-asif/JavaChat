package com.chat.chat.service;

import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PresenceTracker {

    private final Map<String, Integer> sessions = new ConcurrentHashMap<>();

    // Returns true when the user transitions from offline to online
    // (first open session), false if they already had another session open.
    public boolean connect(String username) {
        return sessions.merge(username, 1, Integer::sum) == 1;
    }

    // Returns true when the user transitions to fully offline (last session
    // closed), false if other sessions remain open.
    public boolean disconnect(String username) {
        final boolean[] nowOffline = { false };
        sessions.computeIfPresent(username, (k, v) -> {
            int next = v - 1;
            if (next <= 0) {
                nowOffline[0] = true;
                return null;
            }
            return next;
        });
        return nowOffline[0];
    }

    public Set<String> onlineUsers() {
        return new HashSet<>(sessions.keySet());
    }
}
