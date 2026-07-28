package com.chat.chat.config;

import com.chat.chat.security.JwtAuthFilter;
import com.chat.chat.security.JwtUtil;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtUtil jwtUtil;

    public SecurityConfig(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // Place JWT filter before the standard username/password filter
        http.addFilterBefore(new JwtAuthFilter(jwtUtil),
                UsernamePasswordAuthenticationFilter.class);

        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // WebSocket handshake (HTTP upgrade) must be publicly accessible.
                        // Real auth happens later via STOMP interceptor.
                        .requestMatchers("/ws/**").permitAll()
                        // All other endpoints (message history) require a valid JWT
                        .anyRequest().authenticated());

        return http.build();
    }
}
