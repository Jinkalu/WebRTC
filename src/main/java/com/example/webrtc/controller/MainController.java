package com.example.webrtc.controller;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.HashSet;
import java.util.Set;

@Controller
public class MainController {

    @Autowired
    private SimpMessagingTemplate simpMessagingTemplate;

    private Set<String> onlineUsers = new HashSet<>();

    @GetMapping("/")
    public String loginPage() {
        return "login";
    }

    @GetMapping("/chat")
    public String chatPage() {
        return "chat";
    }

    @GetMapping("/video")
    public String videoPage() {
        return "video";
    }

    @MessageMapping("/chat")
    public void sendMessage(String message) {
        JSONObject jsonObject = new JSONObject(message);
        System.out.println("Message from: " + jsonObject.getString("fromUser") + " to: " + jsonObject.getString("toUser"));
        simpMessagingTemplate.convertAndSendToUser(jsonObject.getString("toUser"), "/topic/chat", message);
    }

    @MessageMapping("/addUser")
    public void addUser(String username) {
        onlineUsers.add(username);
        simpMessagingTemplate.convertAndSend("/topic/users", new JSONArray(onlineUsers).toString());
    }
}
