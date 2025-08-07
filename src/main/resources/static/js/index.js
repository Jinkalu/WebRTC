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
let socket;
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
    socket = new WebSocket('ws://localhost:8443/websocket');  // Use your WebSocket server URL
    localID = userId;
    console.log("My ID: " + localID);

    socket.onopen = () => {
        console.log("Connected to WebSocket");

        // Send the user ID to the server upon connection
        socket.send(JSON.stringify({ type: "addUser", userId: localID }));
    };

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === "chat") {
            displayMessage(message.fromUser, message.message);
        } else if (message.type === "userList") {
            updateUserList(message.users);
        } else if (message.type === "offer") {
            handleOffer(message);
        } else if (message.type === "answer") {
            handleAnswer(message);
        } else if (message.type === "candidate") {
            handleCandidate(message);
        } else if (message.type === "endCall") {
            handleEndCall();
        }
    };

    socket.onerror = (error) => {
        console.log("WebSocket Error: ", error);
    };

    socket.onclose = () => {
        console.log("WebSocket connection closed");
    };
}

// Send Message Function
sendMessageBtn.onclick = () => {
    let messageText = messageInput.value;
    if (!messageText || !selectedUserID) return;

    socket.send(JSON.stringify({
        type: "chat",
        toUser: selectedUserID,
        fromUser: localID,
        message: messageText
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

    socket.send(JSON.stringify({
        type: "call",
        callTo: selectedUserID,
        callFrom: localID
    }));

    alert("Calling " + selectedUserID + "...");
}

// Handle Offer
function handleOffer(message) {
    console.log("Received offer from " + message.fromUser);

    // Set remote description with the received offer
    localPeer.setRemoteDescription(new RTCSessionDescription(message.offer))
        .then(() => {
            return localPeer.createAnswer();
        })
        .then((answer) => {
            return localPeer.setLocalDescription(answer);
        })
        .then(() => {
            socket.send(JSON.stringify({
                type: "answer",
                toUser: message.fromUser,
                fromUser: localID,
                answer: localPeer.localDescription
            }));
        })
        .catch((error) => {
            console.error("Error handling offer: ", error);
        });
}

// Handle Answer
function handleAnswer(message) {
    console.log("Received answer from " + message.fromUser);

    // Set remote description with the received answer
    localPeer.setRemoteDescription(new RTCSessionDescription(message.answer))
        .catch((error) => {
            console.error("Error handling answer: ", error);
        });
}

// Handle ICE Candidate
function handleCandidate(message) {
    console.log("Received ICE candidate from " + message.fromUser);

    const candidate = new RTCIceCandidate(message.candidate);
    localPeer.addIceCandidate(candidate)
        .catch((error) => {
            console.error("Error adding ICE candidate: ", error);
        });
}

// Handle End Call
function handleEndCall() {
    console.log("Call ended by remote user.");
    alert("Call has ended.");
    endCurrentCall();
}

// End Current Call
endCallBtn.onclick = () => {
    console.log("Ending call");
    socket.send(JSON.stringify({
        type: "endCall",
        toUser: selectedUserID,
        fromUser: localID
    }));
    endCurrentCall();
};

function endCurrentCall() {
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => {
            track.stop();
            remoteStream.removeTrack(track);
        });
        remoteVideo.srcObject = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
        localVideo.srcObject = null;
    }

    if (localPeer) {
        localPeer.close();
    }

    selectedUserID = null;
    alert("You have ended the call.");
}
