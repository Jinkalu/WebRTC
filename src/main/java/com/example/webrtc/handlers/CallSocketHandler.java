package com.example.webrtc.handlers;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class CallSocketHandler extends TextWebSocketHandler {

    // Store WebSocket sessions for each user (for call signaling only)
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String userId = getParam(session, "user");

        if (userId != null) {
            sessions.put(userId, session);
            log.info("User {} connected to call handler", userId);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload = new ObjectMapper().readValue(message.getPayload(), Map.class);
        log.info("Call handler received message: {}", payload);

        String type = payload.get("type").toString();

        // Handle only WebRTC signaling messages
        switch (type) {
            case "offer":
                handleOffer(session, payload);
                break;
            case "answer":
                handleAnswer(session, payload);
                break;
            case "candidate":
                handleCandidate(session, payload);
                break;
            case "endCall":
                handleEndCall(session, payload);
                break;
            default:
                log.warn("Unknown message type in call handler: {}", type);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String userId = getParam(session, "user");
        if (userId != null) {
            sessions.remove(userId);
            log.info("User {} disconnected from call handler", userId);
        }
    }

    private void handleOffer(WebSocketSession session, Map<String, Object> message) {
        String toUser = (String) message.get("toUser");
        String fromUser = (String) message.get("fromUser");
        Object offer = message.get("offer");

        WebSocketSession toUserSession = sessions.get(toUser);
        if (toUserSession != null && toUserSession.isOpen()) {
            Map<String, Object> offerMessage = new HashMap<>();
            offerMessage.put("type", "offer");
            offerMessage.put("fromUser", fromUser);
            offerMessage.put("offer", offer);

            sendMessage(toUserSession, offerMessage);
            log.info("WebRTC offer sent from {} to {}", fromUser, toUser);
        } else {
            log.error("User {} not found for WebRTC offer", toUser);
        }
    }

    private void handleAnswer(WebSocketSession session, Map<String, Object> message) {
        String toUser = (String) message.get("toUser");
        String fromUser = (String) message.get("fromUser");
        Object answer = message.get("answer");

        WebSocketSession toUserSession = sessions.get(toUser);
        if (toUserSession != null && toUserSession.isOpen()) {
            Map<String, Object> answerMessage = new HashMap<>();
            answerMessage.put("type", "answer");
            answerMessage.put("fromUser", fromUser);
            answerMessage.put("answer", answer);

            sendMessage(toUserSession, answerMessage);
            log.info("WebRTC answer sent from {} to {}", fromUser, toUser);
        } else {
            log.error("User {} not found for WebRTC answer", toUser);
        }
    }

    private void handleCandidate(WebSocketSession session, Map<String, Object> message) {
        String toUser = (String) message.get("toUser");
        String fromUser = (String) message.get("fromUser");
        Object candidate = message.get("candidate");

        WebSocketSession toUserSession = sessions.get(toUser);
        if (toUserSession != null && toUserSession.isOpen()) {
            Map<String, Object> candidateMessage = new HashMap<>();
            candidateMessage.put("type", "candidate");
            candidateMessage.put("fromUser", fromUser);
            candidateMessage.put("candidate", candidate);

            sendMessage(toUserSession, candidateMessage);
            log.info("ICE candidate sent from {} to {}", fromUser, toUser);
        } else {
            log.error("User {} not found for ICE candidate", toUser);
        }
    }

    private void handleEndCall(WebSocketSession session, Map<String, Object> message) {
        String toUser = (String) message.get("toUser");
        String fromUser = (String) message.get("fromUser");

        WebSocketSession toUserSession = sessions.get(toUser);
        if (toUserSession != null && toUserSession.isOpen()) {
            Map<String, Object> endCallMessage = new HashMap<>();
            endCallMessage.put("type", "endCall");
            endCallMessage.put("fromUser", fromUser);

            sendMessage(toUserSession, endCallMessage);
            log.info("End call message sent from {} to {}", fromUser, toUser);
        } else {
            log.error("User {} not found for end call", toUser);
        }
    }

    private void sendMessage(WebSocketSession session, Map<String, Object> message) {
        try {
            String messagePayload = new ObjectMapper().writeValueAsString(message);
            session.sendMessage(new TextMessage(messagePayload));
        } catch (Exception e) {
            log.error("Failed to send message: {}", e.getMessage());
        }
    }

    public static String getParam(WebSocketSession session, String key) {
        return UriComponentsBuilder
                .fromUri(Objects.requireNonNull(session.getUri()))
                .build()
                .getQueryParams()
                .getFirst(key);
    }
}