package com.example.webrtc.controller;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.ArrayList;

@Controller
public class MainController02 {

    ArrayList<String> users = new ArrayList<String>();

    @Autowired
    SimpMessagingTemplate simpMessagingTemplate;


/*    @RequestMapping(value = "/",method =  RequestMethod.GET)
    public String Index(){
        return "index";
    }*/

    @MessageMapping("/testServer")
    @SendTo("/topic/testServer")
    public String testServer(String Test){
        System.out.println("Testing Server");
        return Test;
    }

/*    @MessageMapping("/addUser")
    public void addUser(String user){
        System.out.println("Adding User");
        users.add(user);
        for (String u :users) {
            System.out.println(u);
        }
        System.out.println("User Added Successfully");
    }*/

/*    @MessageMapping("/call")
    public void Call(String call){
        JSONObject jsonObject = new JSONObject(call);
        System.out.println("Calling to: " + jsonObject.get("callTo") + " from: " + jsonObject.get("callFrom"));

        // Send a message to the remote user to show Answer & Reject buttons
        JSONObject response = new JSONObject();
        response.put("caller", jsonObject.getString("callFrom"));
        response.put("message", "Incoming call");

        simpMessagingTemplate.convertAndSendToUser(jsonObject.getString("callTo"), "/topic/call", response.toString());
    }*/

    @MessageMapping("/call")
    public void Call(String call) {
        JSONObject jsonObject = new JSONObject(call);
        JSONObject response = new JSONObject();
        response.put("caller", jsonObject.getString("callFrom"));

        simpMessagingTemplate.convertAndSendToUser(jsonObject.getString("callTo"), "/topic/incomingCall", response.toString());
    }


    @MessageMapping("/offer")
    public void Offer(String offer){

        System.out.println("Offer Came");
        JSONObject jsonObject = new JSONObject(offer);
        System.out.println(jsonObject.get("offer"));
        System.out.println(jsonObject.get("toUser"));
        System.out.println(jsonObject.get("fromUser"));
        simpMessagingTemplate.convertAndSendToUser(jsonObject.getString("toUser"),"/topic/offer",offer);
        System.out.println("Offer Sent");
    }


    @MessageMapping("/reject")
    public void Reject(String reject) {
        JSONObject jsonObject = new JSONObject(reject);
        simpMessagingTemplate.convertAndSendToUser(jsonObject.getString("toUser"), "/topic/reject", reject);
    }

    @MessageMapping("/endCall")
    public void EndCall(String endCall) {
        System.out.println("Ending call");
        JSONObject jsonObject = new JSONObject(endCall);

        // Notify both users to end the call
        simpMessagingTemplate.convertAndSendToUser(jsonObject.getString("toUser"), "/topic/endCall", endCall);
        simpMessagingTemplate.convertAndSendToUser(jsonObject.getString("fromUser"), "/topic/endCall", endCall);

        System.out.println("End Call Sent to Both Users");
    }




    @MessageMapping("/answer")
    public void Answer(String answer) {
        System.out.println("Answer received");
        JSONObject jsonObject = new JSONObject(answer);

        // Send answer to the caller
        simpMessagingTemplate.convertAndSendToUser(jsonObject.getString("toUser"), "/topic/answer", answer);

        // Send callAccepted notification directly after sending answer
        JSONObject callAcceptedNotification = new JSONObject();
        callAcceptedNotification.put("fromUser", jsonObject.getString("fromUser"));
        callAcceptedNotification.put("toUser", jsonObject.getString("toUser"));

        simpMessagingTemplate.convertAndSendToUser(
                jsonObject.getString("toUser"),
                "/topic/callAccepted",
                callAcceptedNotification.toString()
        );

        System.out.println("Answer and CallAccepted notifications sent");
    }





    @MessageMapping("/candidate")
    public void Candidate(String candidate){
        System.out.println("Candidate came");
        JSONObject jsonObject = new JSONObject(candidate);
        System.out.println(jsonObject.get("toUser"));
        System.out.println(jsonObject.get("fromUser"));
        System.out.println(jsonObject.get("candidate"));
        simpMessagingTemplate.convertAndSendToUser(jsonObject.getString("toUser"),"/topic/candidate",candidate);
        System.out.println("Candidate Sent");


    }

/*    @MessageMapping("/chat")
    public void chatMessage(String message) {
        JSONObject jsonObject = new JSONObject(message);
        System.out.println("Message from: " + jsonObject.getString("fromUser") + " to: " + jsonObject.getString("toUser"));

        simpMessagingTemplate.convertAndSendToUser(jsonObject.getString("toUser"), "/topic/chat", message);
    }*/



}
