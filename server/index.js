const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
console.log('WebSocket server is running on ws://localhost:8080');

// Store all connected clients
const clients = new Set();

let nextClientId = 1; // Used for temporary IDs

wss.on('connection', (ws) => {
    // Assign a temporary ID until the client identifies itself
    ws.clientId = `pending_${nextClientId++}`;
    ws.isIdentified = false;
    clients.add(ws);

    // Send a standard welcome message to the newly connected client
    ws.send(JSON.stringify({
        type: 'system',
        sender: 'server',
        content: 'Welcome! Please identify yourself.'
    }));

    ws.on('message', (message) => {
        const textMessage = message.toString();
        
        try {
            const parsedMessage = JSON.parse(textMessage);

            // --- Handle Identification ---
            if (parsedMessage.type === 'identification') {
                ws.clientId = parsedMessage.sender; // Set the permanent ID from the client's message
                ws.isIdentified = true;
                console.log(`${ws.clientId} has connected`);

                // Announce to everyone that this user has joined
                const joinMessage = JSON.stringify({
                    type: 'system',
                    sender: 'server',
                    content: `${ws.clientId} has connected.`
                });
                for (const client of clients) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(joinMessage);
                    }
                }
                return; // Stop processing this specific message
            }
            
            // --- Standard Message Processing for Identified Clients ---
            if (!ws.isIdentified) {
                console.log(`Ignoring message from unidentified client ${ws.clientId}`);
                return;
            }

            // Log the raw message from an identified client
            console.log(`Raw message received from ${ws.clientId}:`, textMessage);

            // Assign sender if not provided by the client (fallback)
            parsedMessage.sender = parsedMessage.sender || ws.clientId;
            parsedMessage.timestamp = Date.now();

            let messageToSend = null;
            let broadcast = true;
            let logSpecific = true;

            // --- Specific Message Type Handling ---
            if (parsedMessage.type === 'action' && parsedMessage.action === 'GOTO') {
                console.log(`>>> Received GOTO command from ${parsedMessage.sender} for X:${parsedMessage.data?.x} Y:${parsedMessage.data?.y} Z:${parsedMessage.data?.z}`);
                messageToSend = JSON.stringify(parsedMessage);
                logSpecific = false;

            } else if (parsedMessage.type === 'action_response' && parsedMessage.action === 'look') {
                console.log(`>>> Received LOOK action response from ${parsedMessage.sender}.`);
                console.log(`    Status: ${parsedMessage.status}, Looking At: ${parsedMessage.looking_at}`);
                messageToSend = JSON.stringify(parsedMessage);
                logSpecific = false;

            } else if (parsedMessage.type === 'action_response' && parsedMessage.action === 'look_manual') {
                console.log(`>>> Received LOOK_MANUAL action response from ${parsedMessage.sender}.`);
                console.log(`    Status: ${parsedMessage.status}, Looking At Coords: (Yaw: ${parsedMessage.looking_at_yaw}, Pitch: ${parsedMessage.looking_at_pitch})`);
                messageToSend = JSON.stringify(parsedMessage);
                logSpecific = false;

            } else if (parsedMessage.type === 'doorLocations') {
                const doorCount = Array.isArray(parsedMessage.doors) ? parsedMessage.doors.length : 0;
                console.log(`>>> Received doorLocations update from ${parsedMessage.sender} (${doorCount} doors)`);
                messageToSend = JSON.stringify(parsedMessage);
                logSpecific = false;

            } else {
                // Handle other standard messages (chat, system, etc.)
                messageToSend = JSON.stringify(parsedMessage);
            }

            if(logSpecific) {
                console.log(`Processing message from ${parsedMessage.sender}:`, parsedMessage);
            }

            if (broadcast && messageToSend) {
                for (const client of clients) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(messageToSend);
                    }
                }
            }

        } catch (e) {
            console.error(`Invalid JSON received from ${ws.clientId}:`, textMessage, e);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${ws.clientId}`);
        clients.delete(ws);
        
        // Announce disconnection to other clients if the client was identified
        if (ws.isIdentified) {
            const leaveMessage = JSON.stringify({
                type: 'system',
                sender: 'server',
                content: `${ws.clientId} has disconnected.`
            });
            for (const client of clients) {
                 if (client.readyState === WebSocket.OPEN) {
                     client.send(leaveMessage);
                 }
            }
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for ${ws.clientId}:`, error);
        clients.delete(ws);
    });
});
