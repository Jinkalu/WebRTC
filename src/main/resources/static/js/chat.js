const messageList = document.getElementById("messageList");
const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const userList = document.getElementById("userList");
const chatHeader = document.getElementById("chatHeader");

const incomingCallAlert = document.getElementById("incomingCallAlert");
const incomingCallText = document.getElementById("incomingCallText");
const answerBtn = document.getElementById("answerBtn");
const rejectBtn = document.getElementById("rejectBtn");

let socket;
let localID = localStorage.getItem("username");
let selectedUserID;

if (!localID) {
    window.location.href = "/";
}

// Connect to List WebSocket Server (only for user list and chat)
socket = new WebSocket(`wss://localhost:8443/list?user=${localID}`);

socket.onopen = () => {
    console.log("Connected to List WebSocket");
    // Send user ID after connection
    socket.send(JSON.stringify({ type: "addUser", userId: localID }));
};

socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log("Received message in chat:", message);

    if (message.type === "chat") {
        displayMessage(message.fromUser, message.message);
    } else if (message.type === "userList") {
        updateUserList(message.users);
    } else if (message.type === "incomingCall") {
        handleIncomingCall(message);
    } else if (message.type === "callAccepted") {
        handleCallAccepted(message);
    } else if (message.type === "callRejected") {
        handleCallRejected(message);
    }
};

socket.onerror = (error) => {
    console.error("WebSocket error:", error);
};

socket.onclose = () => {
    console.log("WebSocket connection closed");
};

// Handle Incoming Call
function handleIncomingCall(message) {
    const caller = message.callFrom || message.caller;
    console.log("Incoming call from: " + caller);
    incomingCallAlert.style.display = "block";
    incomingCallText.innerText = `Incoming call from ${caller}`;

    // Answer Call
    answerBtn.onclick = () => {
        console.log("Accepting call from:", caller);
        localStorage.setItem("callUser", caller);
        localStorage.setItem("isCaller", "false");

        // Send call acceptance through list socket
        const acceptMessage = {
            type: "callAccepted",
            toUser: caller,
            fromUser: localID
        };

        console.log("Sending call acceptance:", acceptMessage);
        socket.send(JSON.stringify(acceptMessage));

        incomingCallAlert.style.display = "none";

        // Navigate to video page
        setTimeout(() => {
            window.location.href = "/video";
        }, 100);
    };

    // Reject Call
    rejectBtn.onclick = () => {
        console.log("Rejecting call from:", caller);

        // Send call rejection through list socket
        const rejectMessage = {
            type: "callRejected",
            toUser: caller,
            fromUser: localID
        };

        console.log("Sending call rejection:", rejectMessage);
        socket.send(JSON.stringify(rejectMessage));

        incomingCallAlert.style.display = "none";
    };
}

// Handle Call Accepted (for caller)
function handleCallAccepted(message) {
    console.log("Call accepted by:", message.fromUser);
    localStorage.setItem("callUser", message.fromUser);
    localStorage.setItem("isCaller", "true");

    alert("Call accepted! Redirecting to video chat...");
    window.location.href = "/video";
}

// Handle Call Rejected (for caller)
function handleCallRejected(message) {
    console.log("Call rejected by:", message.fromUser);
    alert("Call was rejected by the other user.");
}

// Update User List with Chat & Video Call Buttons
function updateUserList(users) {
    userList.innerHTML = "";
    users.forEach(user => {
        if (user !== localID) {
            let userItem = document.createElement("li");
            userItem.innerHTML = `
                ${user}
                <button onclick="startChat('${user}')">💬 Chat</button>
                <button onclick="startVideoCall('${user}')">📞 Video</button>
            `;
            userList.appendChild(userItem);
        }
    });
}

// Start Chat with Selected User
function startChat(userID) {
    selectedUserID = userID;
    chatHeader.innerText = `Chat with ${userID}`;
}

// Send Message
sendMessageBtn.onclick = () => {
    let messageText = messageInput.value;
    if (!messageText || !selectedUserID) {
        alert("Select a user before sending a message.");
        return;
    }

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
    messageElement.style.padding = "5px";
    messageElement.style.borderBottom = "1px solid #ddd";
    messageList.appendChild(messageElement);
    messageList.scrollTop = messageList.scrollHeight;
}

// Start Video Call - This will send call request and then navigate to video page
function startVideoCall(userID) {
    console.log("Initiating call to:", userID);

    // Set localStorage for the caller
    localStorage.setItem("callUser", userID);
    localStorage.setItem("isCaller", "true");

    // Send call request through list socket
    socket.send(JSON.stringify({
        type: "callRequest",
        callTo: userID,
        callFrom: localID
    }));

    // Show indication that call is being initiated
    alert("Calling " + userID + "... Please wait for response.");

    console.log("Call request sent to: " + userID);
}