package com.example.webrtc.handlers;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class ListSocketHandler extends TextWebSocketHandler {

    // Store WebSocket sessions for each user
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String userId = getParam(session, "user");

        if (userId != null) {
            sessions.put(userId, session);
            log.info("User {} connected to list handler", userId);

            // Send user list to new user after connecting
            sendUserListToAll();
        }
    }

    private void sendUserListToAll() throws IOException {
        Set<String> users = new HashSet<>(sessions.keySet());
        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("type", "userList");
        responseMap.put("users", users);

        ObjectMapper mapper = new ObjectMapper();
        String userListMessage = mapper.writeValueAsString(responseMap);

        // Send user list to all connected users
        for (Map.Entry<String, WebSocketSession> entry : sessions.entrySet()) {
            WebSocketSession userSession = entry.getValue();
            if (userSession.isOpen()) {
                try {
                    userSession.sendMessage(new TextMessage(userListMessage));
                } catch (IOException e) {
                    log.error("Failed to send user list to {}: {}", entry.getKey(), e.getMessage());
                }
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload = new ObjectMapper().readValue(message.getPayload(), Map.class);
        log.info("List handler received message: {}", payload);

        String type = payload.get("type").toString();

        // Handle different types of messages
        switch (type) {
            case "addUser":
                handleAddUser(session, payload);
                break;
            case "chat":
                handleChat(session, payload);
                break;
            case "callRequest":
                handleCallRequest(session, payload);
                break;
            case "callAccepted":
                handleCallAccepted(session, payload);
                break;
            case "callRejected":
                handleCallRejected(session, payload);
                break;
            default:
                log.warn("Unknown message type in list handler: {}", type);
        }
    }

    private void handleAddUser(WebSocketSession session, Map<String, Object> message) {
        String userId = (String) message.get("userId");
        if (userId != null) {
            sessions.put(userId, session);
            log.info("User {} added to list", userId);
            try {
                sendUserListToAll();
            } catch (IOException e) {
                log.error("Failed to send user list after adding user", e);
            }
        }
    }

    private void handleChat(WebSocketSession session, Map<String, Object> message) {
        String toUser = (String) message.get("toUser");
        String fromUser = (String) message.get("fromUser");
        String messageText = (String) message.get("message");

        WebSocketSession toUserSession = sessions.get(toUser);
        if (toUserSession != null && toUserSession.isOpen()) {
            Map<String, Object> chatMessage = new HashMap<>();
            chatMessage.put("type", "chat");
            chatMessage.put("fromUser", fromUser);
            chatMessage.put("message", messageText);

            sendMessage(toUserSession, chatMessage);
            log.info("Chat message sent from {} to {}", fromUser, toUser);
        } else {
            log.error("User {} not found or not connected for chat", toUser);
        }
    }

    private void handleCallRequest(WebSocketSession session, Map<String, Object> message) {
        String toUser = (String) message.get("callTo");
        String fromUser = (String) message.get("callFrom");

        WebSocketSession toUserSession = sessions.get(toUser);
        if (toUserSession != null && toUserSession.isOpen()) {
            Map<String, Object> callMessage = new HashMap<>();
            callMessage.put("type", "incomingCall");
            callMessage.put("callFrom", fromUser);
            callMessage.put("caller", fromUser); // for backward compatibility

            sendMessage(toUserSession, callMessage);
            log.info("Call request sent from {} to {}", fromUser, toUser);
        } else {
            log.error("User {} not found for call request", toUser);
        }
    }

    private void handleCallAccepted(WebSocketSession session, Map<String, Object> message) {
        String toUser = (String) message.get("toUser");
        String fromUser = (String) message.get("fromUser");

        WebSocketSession toUserSession = sessions.get(toUser);
        if (toUserSession != null && toUserSession.isOpen()) {
            Map<String, Object> acceptMessage = new HashMap<>();
            acceptMessage.put("type", "callAccepted");
            acceptMessage.put("fromUser", fromUser);

            sendMessage(toUserSession, acceptMessage);
            log.info("Call acceptance sent from {} to {}", fromUser, toUser);
        } else {
            log.error("User {} not found for call acceptance", toUser);
        }
    }

    private void handleCallRejected(WebSocketSession session, Map<String, Object> message) {
        String toUser = (String) message.get("toUser");
        String fromUser = (String) message.get("fromUser");

        WebSocketSession toUserSession = sessions.get(toUser);
        if (toUserSession != null && toUserSession.isOpen()) {
            Map<String, Object> rejectMessage = new HashMap<>();
            rejectMessage.put("type", "callRejected");
            rejectMessage.put("fromUser", fromUser);

            sendMessage(toUserSession, rejectMessage);
            log.info("Call rejection sent from {} to {}", fromUser, toUser);
        } else {
            log.error("User {} not found for call rejection", toUser);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String userId = getParam(session, "user");
        if (userId != null) {
            sessions.remove(userId);
            log.info("User {} disconnected from list handler", userId);

            try {
                sendUserListToAll();
            } catch (IOException e) {
                log.error("Failed to send user list after user disconnection", e);
            }
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