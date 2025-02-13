const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCallBtn = document.getElementById("endCallBtn");

let localStream;
let remoteStream;
let localPeer;
let stompClient;
let localID = localStorage.getItem("username");
let remoteID = localStorage.getItem("callUser");
let isCaller = localStorage.getItem("isCaller") === "true";

console.log("Video chat initialized:", {
    localID,
    remoteID,
    isCaller
});

if (!localID || !remoteID) {
    window.location.href = "/chat";
}

// ICE Server Configuration
const iceServers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

// Initialize WebRTC Peer Connection
localPeer = new RTCPeerConnection(iceServers);

// Set up media stream first
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        console.log("Got local media stream");
        localStream = stream;
        localVideo.srcObject = stream;

        // Add tracks to peer connection
        localStream.getTracks().forEach(track => {
            console.log("Adding track to peer connection:", track.kind);
            localPeer.addTrack(track, localStream);
        });

        // Connect to WebSocket after media setup
        setupWebSocket();
    })
    .catch(error => {
        console.error("Error accessing media devices:", error);
        alert("Failed to access camera/microphone: " + error.message);
    });

function setupWebSocket() {
    console.log("Setting up WebSocket connection");
    var socket = new SockJS('/websocket');
    stompClient = Stomp.over(socket);

    stompClient.connect({}, frame => {
        console.log("Connected to WebSocket:", frame);

        // Handle Incoming Offer (for Receiver)
        stompClient.subscribe('/user/' + localID + "/topic/offer", async (message) => {
            console.log("Received offer");
            try {
                const offerData = JSON.parse(message.body);
                const offer = offerData.offer;

                console.log("Setting remote description (offer)");
                await localPeer.setRemoteDescription(new RTCSessionDescription(offer));

                console.log("Creating answer");
                const answer = await localPeer.createAnswer();

                console.log("Setting local description (answer)");
                await localPeer.setLocalDescription(answer);

                console.log("Sending answer");
                stompClient.send("/app/answer", {}, JSON.stringify({
                    toUser: remoteID,
                    fromUser: localID,
                    answer: answer
                }));
            } catch (error) {
                console.error("Error handling offer:", error);
            }
        });

        // Handle Incoming Answer (for Caller)
        stompClient.subscribe('/user/' + localID + "/topic/answer", async (message) => {
            console.log("Received answer");
            try {
                const answerData = JSON.parse(message.body);
                const answer = answerData.answer;

                if (!localPeer.currentRemoteDescription) {
                    console.log("Setting remote description (answer)");
                    await localPeer.setRemoteDescription(new RTCSessionDescription(answer));
                }
            } catch (error) {
                console.error("Error handling answer:", error);
            }
        });

        // Handle ICE Candidate Exchange
        stompClient.subscribe('/user/' + localID + "/topic/candidate", async (message) => {
            console.log("Received ICE candidate");
            try {
                const candidateData = JSON.parse(message.body);
                const candidate = candidateData.candidate;

                if (candidate) {
                    const iceCandidate = new RTCIceCandidate({
                        sdpMLineIndex: candidate.label,
                        candidate: candidate.id
                    });

                    await localPeer.addIceCandidate(iceCandidate);
                    console.log("Added ICE candidate successfully");
                }
            } catch (error) {
                console.error("Error handling ICE candidate:", error);
            }
        });

        // Handle Call End
        stompClient.subscribe('/user/' + localID + "/topic/endCall", () => {
            console.log("Call ended by remote user");
            alert("Call has ended");
            endCurrentCall();
        });

        // If this is the caller, create and send the offer
        if (isCaller) {
            console.log("Creating offer as caller");
            localPeer.createOffer()
                .then(offer => {
                    console.log("Setting local description (offer)");
                    return localPeer.setLocalDescription(offer)
                        .then(() => {
                            console.log("Sending offer to:", remoteID);
                            stompClient.send("/app/offer", {}, JSON.stringify({
                                toUser: remoteID,
                                fromUser: localID,
                                offer: offer
                            }));
                        });
                })
                .catch(error => console.error("Error creating/sending offer:", error));
        }
    });
}

// Handle Remote Stream
localPeer.ontrack = (event) => {
    console.log("Received remote track:", event.track.kind);
    if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;
    }
    remoteStream.addTrack(event.track);
};

// Handle ICE Candidate Generation
localPeer.onicecandidate = (event) => {
    if (event.candidate) {
        console.log("Generated ICE candidate");
        const candidate = {
            type: "candidate",
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.candidate
        };

        stompClient.send("/app/candidate", {}, JSON.stringify({
            toUser: remoteID,
            fromUser: localID,
            candidate: candidate
        }));
    }
};

// Connection State Changes
localPeer.onconnectionstatechange = () => {
    console.log("Connection state changed:", localPeer.connectionState);
    if (localPeer.connectionState === 'connected') {
        console.log("Peer connection established successfully");
    }
};

localPeer.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", localPeer.iceConnectionState);
    if (localPeer.iceConnectionState === 'disconnected') {
        console.log("ICE connection disconnected");
        endCurrentCall();
    }
};

// End Call Button
endCallBtn.onclick = () => {
    console.log("Ending call");
    stompClient.send("/app/endCall", {}, JSON.stringify({
        toUser: remoteID,
        fromUser: localID
    }));
    endCurrentCall();
};

function endCurrentCall() {
    console.log("Cleaning up call...");

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
        localPeer.onicecandidate = null;
        localPeer.ontrack = null;
        localPeer.close();
    }

    localStorage.removeItem("callUser");
    localStorage.removeItem("isCaller");

    setTimeout(() => {
        window.location.href = "/chat";
    }, 1000);
}