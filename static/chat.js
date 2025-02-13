const messageList = document.getElementById("messageList");
const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const userList = document.getElementById("userList");
const chatHeader = document.getElementById("chatHeader");

const incomingCallAlert = document.getElementById("incomingCallAlert");
const incomingCallText = document.getElementById("incomingCallText");
const answerBtn = document.getElementById("answerBtn");
const rejectBtn = document.getElementById("rejectBtn");

let stompClient;
let localID = localStorage.getItem("username");
let selectedUserID;

if (!localID) {
    window.location.href = "/";
}

// Connect to WebSocket Server
var socket = new SockJS('/websocket');
stompClient = Stomp.over(socket);

stompClient.connect({}, frame => {
    console.log("Connected: " + frame);

    // Receive messages
    stompClient.subscribe('/user/' + localID + "/topic/chat", (message) => {
        let chatData = JSON.parse(message.body);
        displayMessage(chatData["fromUser"], chatData["message"]);
    });

    // Update Online Users List
    stompClient.subscribe('/topic/users', (message) => {
        let users = JSON.parse(message.body);
        updateUserList(users);
    });

    // Incoming Call Alert
    stompClient.subscribe('/user/' + localID + "/topic/incomingCall", (message) => {
        let callData = JSON.parse(message.body);
        let caller = callData["caller"];

        console.log("Incoming call from: " + caller);
        incomingCallAlert.style.display = "block";
        incomingCallText.innerText = `Incoming call from ${caller}`;

        // Answer Call
        answerBtn.onclick = () => {
            const caller = callData.caller;
            console.log("Accepting call from:", caller);

            localStorage.setItem("callUser", caller);
            localStorage.setItem("isCaller", "false");

            const answerMessage = {
                toUser: caller,
                fromUser: localID,
                answer: {} // Empty answer object for now
            };

            console.log("Sending answer message:", answerMessage);
            stompClient.send("/app/answer", {}, JSON.stringify(answerMessage));

            // Add small delay before redirect
            setTimeout(() => {
                window.location.href = "/video";
            }, 100);
        };

        // Reject Call
        rejectBtn.onclick = () => {
            stompClient.send("/app/reject", {}, JSON.stringify({
                "toUser": caller,
                "fromUser": localID
            }));

            incomingCallAlert.style.display = "none";
        };
    });
console.log("Setting up subscriptions for user:", localID);
    // Listen for when the receiver answers the call
    stompClient.subscribe('/user/' + localID + "/topic/callAccepted", (message) => {
    console.log("💡 CallAccepted subscription triggered");
    console.log("Received callAccepted notification:", message.body);

    try {
        let data = JSON.parse(message.body);
        console.log("Call accepted by:", data.fromUser);

        // Set localStorage values
        localStorage.setItem("callUser", data.fromUser);
        localStorage.setItem("isCaller", "true");

        // Add debug alert
        alert("Call accepted! Redirecting to video chat...");

        // Redirect to video page
        window.location.href = "/video";
    } catch (error) {
        console.error("Error processing callAccepted message:", error);
        console.log("Raw message body:", message.body);
    }
    });

    stompClient.send("/app/addUser", {}, localID);
});

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
    messageElement.style.padding = "5px";
    messageElement.style.borderBottom = "1px solid #ddd";
    messageList.appendChild(messageElement);
    messageList.scrollTop = messageList.scrollHeight;
}

// Start Video Call
function startVideoCall(userID) {
    localStorage.setItem("callUser", userID);
    localStorage.setItem("isCaller", "true");

    stompClient.send("/app/call", {}, JSON.stringify({
        "callTo": userID,
        "callFrom": localID
    }));

    console.log("Initiating call to: " + userID);
}