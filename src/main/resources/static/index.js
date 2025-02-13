const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const localIdInp = document.getElementById("localId");
const connectBtn = document.getElementById("connectBtn");
const remoteIdInp = document.getElementById("remoteId");
const callBtn = document.getElementById("callBtn");
const answerBtn = document.getElementById("answerBtn");
const rejectBtn = document.getElementById("rejectBtn");
const endCallBtn = document.getElementById("endCallBtn");
const testConnection = document.getElementById("testConnection");

const messageList = document.getElementById("messageList");
const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const userList = document.getElementById("userList");

let localStream;
let remoteStream;
let localPeer;
let stompClient;
let localID;
let selectedUserID;

// ICE Server Configurations
const iceServers = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

// Initialize WebRTC Peer Connection
localPeer = new RTCPeerConnection(iceServers);

// Get User Media (Webcam & Audio)
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
    })
    .catch(error => {
        console.log("Error accessing media devices: ", error);
    });

// Connect to WebSocket Server
function connectToServer(userId) {
    var socket = new SockJS('/websocket', { debug: false });
    stompClient = Stomp.over(socket);
    localID = userId;
    console.log("My ID: " + localID);

    stompClient.connect({}, frame => {
        console.log("Connected to WebSocket: ", frame);

        // Subscribe to chat messages
        stompClient.subscribe('/user/' + localID + "/topic/chat", (message) => {
            let chatData = JSON.parse(message.body);
            displayMessage(chatData["fromUser"], chatData["message"]);
        });

        // Subscribe to online users list
        stompClient.subscribe('/topic/users', (message) => {
            let users = JSON.parse(message.body);
            updateUserList(users);
        });

        // Add user to server
        stompClient.send("/app/addUser", {}, localID);
    });
}

// Send Message Function
sendMessageBtn.onclick = () => {
    let messageText = messageInput.value;
    if (!messageText || !selectedUserID) return;

    stompClient.send("/app/chat", {}, JSON.stringify({
        "toUser": selectedUserID,
        "fromUser": localID,
        "message": messageText
    }));

    displayMessage("Me", messageText);
    messageInput.value = "";
};

// Display Messages in Chat
function displayMessage(user, message) {
    let messageElement = document.createElement("div");
    messageElement.innerHTML = `<strong>${user}:</strong> ${message}`;
    messageList.appendChild(messageElement);
}

// Update User List and Add Video Call Button
function updateUserList(users) {
    userList.innerHTML = "";
    users.forEach(user => {
        if (user !== localID) {
            let userItem = document.createElement("li");
            userItem.innerHTML = `${user} <button onclick="startVideoCall('${user}')">📞</button>`;
            userList.appendChild(userItem);
        }
    });
}

// Start Video Call
function startVideoCall(userID) {
    selectedUserID = userID;
    console.log("Starting call with: " + selectedUserID);

    stompClient.send("/app/call", {}, JSON.stringify({
        "callTo": selectedUserID,
        "callFrom": localID
    }));

    alert("Calling " + selectedUserID + "...");
}
