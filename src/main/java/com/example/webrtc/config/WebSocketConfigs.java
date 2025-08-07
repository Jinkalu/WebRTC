package com.example.webrtc.config;

import com.example.webrtc.handlers.CallSocketHandler;
import com.example.webrtc.handlers.ListSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Slf4j
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfigs implements WebSocketConfigurer {

    private final ListSocketHandler listocketHandler;
    private final CallSocketHandler callSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(listocketHandler, "/list")
                .setAllowedOriginPatterns("*")
                .addInterceptors(new org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor());
        registry.addHandler(callSocketHandler, "/call")
                .setAllowedOriginPatterns("*")
                .addInterceptors(new org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor());
    }

}

