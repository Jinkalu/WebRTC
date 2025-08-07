const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCallBtn = document.getElementById("endCallBtn");

let localStream;
let remoteStream;
let localPeer;
let socket;
let localID = localStorage.getItem("username");
let remoteID = localStorage.getItem("callUser");
let isCaller = localStorage.getItem("isCaller") === "true";
let iceCandidateQueue = []; // Queue for ICE candidates received before remote description

console.log("Video chat initialized:", {
    localID,
    remoteID,
    isCaller
});

if (!localID || !remoteID) {
    console.error("Missing required data, redirecting to chat");
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

        // Connect to Call WebSocket after media setup
        setupCallWebSocket();
    })
    .catch(error => {
        console.error("Error accessing media devices:", error);
        alert("Failed to access camera/microphone: " + error.message);
        // Redirect back to chat on media error
        setTimeout(() => {
            window.location.href = "/chat";
        }, 2000);
    });

function setupCallWebSocket() {
    console.log("Setting up Call WebSocket connection");
    // Connect to Call WebSocket (for WebRTC signaling only)
    socket = new WebSocket(`wss://localhost:8443/call?user=${localID}`);

    socket.onopen = () => {
        console.log("Call WebSocket connection established");

        // If this is the caller, create and send the offer after WebSocket is ready
        if (isCaller) {
            console.log("Creating offer as caller");
            createAndSendOffer();
        }
    };

    socket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        console.log("Received message in video:", message);

        // Handle Incoming Offer (for Receiver)
        if (message.type === 'offer') {
            await handleIncomingOffer(message);
        }

        // Handle Incoming Answer (for Caller)
        if (message.type === 'answer') {
            await handleIncomingAnswer(message);
        }

        // Handle ICE Candidate Exchange
        if (message.type === 'candidate') {
            await handleIncomingCandidate(message);
        }

        // Handle Call End
        if (message.type === 'endCall') {
            console.log("Call ended by remote user");
            alert("Call has ended");
            endCurrentCall();
        }
    };

    socket.onerror = (error) => {
        console.error("Call WebSocket Error:", error);
    };

    socket.onclose = () => {
        console.log("Call WebSocket connection closed");
    };
}

async function createAndSendOffer() {
    try {
        console.log("Creating offer...");
        const offer = await localPeer.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });

        console.log("Setting local description (offer)");
        await localPeer.setLocalDescription(offer);

        console.log("Sending offer to:", remoteID);
        socket.send(JSON.stringify({
            type: 'offer',
            toUser: remoteID,
            fromUser: localID,
            offer: offer
        }));
    } catch (error) {
        console.error("Error creating/sending offer:", error);
    }
}

async function handleIncomingOffer(message) {
    try {
        console.log("Handling incoming offer from:", message.fromUser);
        await localPeer.setRemoteDescription(new RTCSessionDescription(message.offer));

        // Process queued ICE candidates after setting remote description
        console.log("Processing", iceCandidateQueue.length, "queued ICE candidates");
        for (const candidate of iceCandidateQueue) {
            try {
                await localPeer.addIceCandidate(candidate);
                console.log("Added queued ICE candidate");
            } catch (error) {
                console.error("Error adding queued ICE candidate:", error);
            }
        }
        iceCandidateQueue = []; // Clear the queue

        console.log("Creating answer");
        const answer = await localPeer.createAnswer();

        console.log("Setting local description (answer)");
        await localPeer.setLocalDescription(answer);

        console.log("Sending answer");
        socket.send(JSON.stringify({
            type: 'answer',
            toUser: remoteID,
            fromUser: localID,
            answer: answer
        }));
    } catch (error) {
        console.error("Error handling offer:", error);
    }
}

async function handleIncomingAnswer(message) {
    try {
        console.log("Handling incoming answer from:", message.fromUser);
        await localPeer.setRemoteDescription(new RTCSessionDescription(message.answer));

        // Process queued ICE candidates after setting remote description
        console.log("Processing", iceCandidateQueue.length, "queued ICE candidates");
        for (const candidate of iceCandidateQueue) {
            try {
                await localPeer.addIceCandidate(candidate);
                console.log("Added queued ICE candidate");
            } catch (error) {
                console.error("Error adding queued ICE candidate:", error);
            }
        }
        iceCandidateQueue = []; // Clear the queue
    } catch (error) {
        console.error("Error handling answer:", error);
    }
}

async function handleIncomingCandidate(message) {
    try {
        console.log("Handling incoming ICE candidate");
        const candidate = new RTCIceCandidate({
            candidate: message.candidate.id,
            sdpMLineIndex: message.candidate.label,
            sdpMid: null
        });

        // Check if remote description is set
        if (localPeer.remoteDescription && localPeer.remoteDescription.type) {
            // Remote description is set, add candidate immediately
            await localPeer.addIceCandidate(candidate);
            console.log("Added ICE candidate successfully");
        } else {
            // Remote description not set yet, queue the candidate
            console.log("Remote description not set, queuing ICE candidate");
            iceCandidateQueue.push(candidate);
        }
    } catch (error) {
        console.error("Error handling ICE candidate:", error);
    }
}

// Handle Remote Stream
localPeer.ontrack = (event) => {
    console.log("Received remote track:", event.track.kind);
    if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;
    }

    // Add track to remote stream
    remoteStream.addTrack(event.track);

    // Alternative approach - directly set the stream from event
    if (event.streams && event.streams.length > 0) {
        remoteVideo.srcObject = event.streams[0];
    }
};

// Handle ICE Candidate Generation
localPeer.onicecandidate = (event) => {
    if (event.candidate) {
        console.log("Generated ICE candidate");
        socket.send(JSON.stringify({
            type: 'candidate',
            toUser: remoteID,
            fromUser: localID,
            candidate: {
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.candidate
            }
        }));
    }
};

// Connection State Changes
localPeer.onconnectionstatechange = () => {
    console.log("Connection state changed:", localPeer.connectionState);
    if (localPeer.connectionState === 'connected') {
        console.log("Peer connection established successfully");
    } else if (localPeer.connectionState === 'failed' || localPeer.connectionState === 'disconnected') {
        console.log("Peer connection failed or disconnected");
    }
};

localPeer.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", localPeer.iceConnectionState);
    if (localPeer.iceConnectionState === 'failed' || localPeer.iceConnectionState === 'disconnected') {
        console.log("ICE connection failed/disconnected");
        // Give some time to reconnect before ending call
        setTimeout(() => {
            if (localPeer.iceConnectionState === 'failed' || localPeer.iceConnectionState === 'disconnected') {
                console.log("Connection still failed after timeout, ending call");
                endCurrentCall();
            }
        }, 10000); // Wait 10 seconds before giving up
    }
};

// Handle ICE gathering state
localPeer.onicegatheringstatechange = () => {
    console.log("ICE gathering state:", localPeer.iceGatheringState);
};

// End Call Button
endCallBtn.onclick = () => {
    console.log("Ending call manually");
    socket.send(JSON.stringify({
        type: 'endCall',
        toUser: remoteID,
        fromUser: localID
    }));
    endCurrentCall();
};

function endCurrentCall() {
    console.log("Cleaning up call...");

    // Clear ICE candidate queue
    iceCandidateQueue = [];

    // Stop remote stream
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => {
            track.stop();
        });
        remoteVideo.srcObject = null;
    }

    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
        localVideo.srcObject = null;
    }

    // Close peer connection
    if (localPeer) {
        localPeer.onicecandidate = null;
        localPeer.ontrack = null;
        localPeer.onconnectionstatechange = null;
        localPeer.oniceconnectionstatechange = null;
        localPeer.close();
        localPeer = null;
    }

    // Close WebSocket
    if (socket) {
        socket.close();
    }

    // Clear localStorage
    localStorage.removeItem("callUser");
    localStorage.removeItem("isCaller");

    // Redirect back to chat
    setTimeout(() => {
        window.location.href = "/chat";
    }, 1000);
}