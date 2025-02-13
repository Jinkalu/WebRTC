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

let localStream;
let remoteStream;
let localPeer;
let remoteID;
let localID;
let stompClient;

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
connectBtn.onclick = () => {
    var socket = new SockJS('/websocket', { debug: false });
    stompClient = Stomp.over(socket);
    localID = localIdInp.value;
    console.log("My ID: " + localID);

    stompClient.connect({}, frame => {
        console.log("Connected to WebSocket: ", frame);

        // Subscribe to incoming call topic
        stompClient.subscribe('/user/' + localIdInp.value + "/topic/call", (call) => {
            let callData = JSON.parse(call.body);
            remoteID = callData["caller"];
            console.log("Incoming Call From: " + remoteID);

            // Show Answer & Reject buttons
            answerBtn.style.display = "block";
            rejectBtn.style.display = "block";

            alert("Incoming call from " + remoteID + ". Click Answer to accept or Reject to decline.");
        });

        // Handle Offer
        stompClient.subscribe('/user/' + localIdInp.value + "/topic/offer", (offer) => {
            console.log("Offer received");
            var o = JSON.parse(offer.body)["offer"];
            localPeer.setRemoteDescription(new RTCSessionDescription(o));

            localPeer.ontrack = (event) => {
                remoteStream = event.streams[0];
                remoteVideo.srcObject = remoteStream;
            };

            localPeer.onicecandidate = (event) => {
                if (event.candidate) {
                    var candidate = {
                        type: "candidate",
                        label: event.candidate.sdpMLineIndex,
                        id: event.candidate.candidate,
                    };
                    console.log("Sending Candidate");
                    stompClient.send("/app/candidate", {}, JSON.stringify({
                        "toUser": remoteID,
                        "fromUser": localID,
                        "candidate": candidate
                    }));
                }
            };

            localStream.getTracks().forEach(track => {
                localPeer.addTrack(track, localStream);
            });

            localPeer.createAnswer().then(description => {
                localPeer.setLocalDescription(description);
                console.log("Sending Answer");
                stompClient.send("/app/answer", {}, JSON.stringify({
                    "toUser": remoteID,
                    "fromUser": localID,
                    "answer": description
                }));
            });
        });

        // Handle Answer (For Receiver)
        stompClient.subscribe('/user/' + localIdInp.value + "/topic/answer", (answer) => {
            console.log("Answer received");
            var o = JSON.parse(answer.body)["answer"];
            localPeer.setRemoteDescription(new RTCSessionDescription(o));

            // Show End Call button for both users
            endCallBtn.style.display = "block";
        });

        // Handle Call Acceptance (For Caller)
        stompClient.subscribe('/user/' + localIdInp.value + "/topic/callAccepted", () => {
            console.log("Call has been answered. Showing End Call button.");
            endCallBtn.style.display = "block";  // Now the caller also sees the button
        });

        // Handle ICE Candidate
        stompClient.subscribe('/user/' + localIdInp.value + "/topic/candidate", (message) => {
            console.log("ICE Candidate received");
            var o = JSON.parse(message.body)["candidate"];
            var iceCandidate = new RTCIceCandidate({
                sdpMLineIndex: o["label"],
                candidate: o["id"],
            });
            localPeer.addIceCandidate(iceCandidate);
        });

        // Handle Call Rejection
        stompClient.subscribe('/user/' + localIdInp.value + "/topic/reject", (reject) => {
            let rejectData = JSON.parse(reject.body);
            console.log("Call rejected by: " + rejectData["fromUser"]);
            alert("Call rejected by " + rejectData["fromUser"]);
        });

        // Handle Call End
        stompClient.subscribe('/user/' + localIdInp.value + "/topic/endCall", (endCall) => {
            let callData = JSON.parse(endCall.body);
            console.log("Call ended by: " + callData["fromUser"]);
            alert("Call ended by " + callData["fromUser"]);

            endCurrentCall();
        });

        // Add user to server
        stompClient.send("/app/addUser", {}, localIdInp.value);
    });
};

// Call Button - Initiates Call
callBtn.onclick = () => {
    remoteID = remoteIdInp.value;
    console.log("Calling: " + remoteID);

    stompClient.send("/app/call", {}, JSON.stringify({
        "callTo": remoteID,
        "callFrom": localID
    }));

    alert("Calling " + remoteID + "...");
};

// Answer Button - Accepts Call
answerBtn.onclick = () => {
    if (!remoteID) {
        console.log("No incoming call to answer.");
        return;
    }

    console.log("Answering call from: " + remoteID);

    // Hide Answer & Reject buttons
    answerBtn.style.display = "none";
    rejectBtn.style.display = "none";

    // Show End Call button for both users
    endCallBtn.style.display = "block";

    localPeer = new RTCPeerConnection(iceServers);

    localPeer.ontrack = (event) => {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
    };

    localPeer.onicecandidate = (event) => {
        if (event.candidate) {
            var candidate = {
                type: "candidate",
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.candidate,
            };
            console.log("Sending Candidate");
            stompClient.send("/app/candidate", {}, JSON.stringify({
                "toUser": remoteID,
                "fromUser": localID,
                "candidate": candidate
            }));
        }
    };

    localStream.getTracks().forEach(track => {
        localPeer.addTrack(track, localStream);
    });

    localPeer.createOffer().then(description => {
        localPeer.setLocalDescription(description);
        stompClient.send("/app/offer", {}, JSON.stringify({
            "toUser": remoteID,
            "fromUser": localID,
            "offer": description
        }));
    });

    // Notify Caller That Answer Has Been Accepted
    stompClient.send("/app/callAccepted", {}, JSON.stringify({
        "toUser": remoteID,
        "fromUser": localID
    }));
};

// End Call Button - Ends Active Call
endCallBtn.onclick = () => {
    console.log("Ending call with: " + remoteID);

    stompClient.send("/app/endCall", {}, JSON.stringify({
        "toUser": remoteID,
        "fromUser": localID
    }));
};

// Handle Call End from Server
stompClient.subscribe('/user/' + localIdInp.value + "/topic/endCall", (endCall) => {
    console.log("Call ended by other user.");
    alert("Call has ended.");

    endCurrentCall();
});

function endCurrentCall() {
    console.log("Cleaning up call...");

    // Stop remote video stream
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }

    // Close WebRTC peer connection
    if (localPeer) {
        localPeer.onicecandidate = null;
        localPeer.ontrack = null;
        localPeer.close();
    }

    // Reset WebRTC connection
    localPeer = new RTCPeerConnection(iceServers);

    // Reset UI
    remoteID = null;
    endCallBtn.style.display = "none";

    console.log("Call cleanup complete.");
}