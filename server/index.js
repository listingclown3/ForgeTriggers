const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
console.log('WebSocket server is running on ws://localhost:8080');

// Store all connected clients
const clients = new Set();

// Optional: Assign unique IDs to clients for better logging/sender ID
let nextClientId = 1;

wss.on('connection', (ws) => {
  // Assign an ID for logging purposes (optional)
  ws.clientId = `client_${nextClientId++}`;
  console.log(`New client connected: ${ws.clientId}`);
  clients.add(ws);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    sender: 'server',
    content: `Welcome ${ws.clientId} to the WebSocket server`
  }));

  ws.on('message', (message) => {
    const textMessage = message.toString();
    console.log(`Raw message received from ${ws.clientId}:`, textMessage);

    try {
      const parsedMessage = JSON.parse(textMessage);

      // Assign sender if not provided by client message (use our assigned ID)
      // Note: ChatTriggers now sends "sender":"ChatTriggers" for GOTO
      parsedMessage.sender = parsedMessage.sender || ws.clientId;

      // Add server timestamp
      parsedMessage.timestamp = Date.now();

      let messageToSend = null; // The JSON string to be sent/broadcast
      let broadcast = true; // Default to broadcasting
      let logSpecific = true; // Flag to avoid double logging

      // --- Specific Message Type Handling ---
      if (parsedMessage.type === 'action' && parsedMessage.action === 'GOTO') {
          console.log(`>>> Received GOTO command from ${parsedMessage.sender} for X:${parsedMessage.data?.x} Y:${parsedMessage.data?.y} Z:${parsedMessage.data?.z}`);
          // Decide handling: Here we broadcast it so any listening client (like a bot) can react.
          messageToSend = JSON.stringify(parsedMessage);
          broadcast = true; // Ensure it's broadcast
          logSpecific = false; // Already logged details

      } else if (parsedMessage.type === 'doorLocations') {
          const doorCount = Array.isArray(parsedMessage.doors) ? parsedMessage.doors.length : 0;
          console.log(`>>> Received doorLocations update from ${parsedMessage.sender} (${doorCount} doors)`);
          // Decide handling: Broadcast so other clients might see the locations?
          messageToSend = JSON.stringify(parsedMessage);
          broadcast = true; // Ensure it's broadcast
          logSpecific = false; // Already logged details

      } else {
          // Handle other standard messages (chat, status, etc.)
          broadcast = true; // Broadcast these by default
          messageToSend = JSON.stringify(parsedMessage);
      }
      // --- End Specific Handling ---


      // Log the processed message if not already logged specifically
      if(logSpecific) {
        console.log(`Processing message from ${parsedMessage.sender}:`, parsedMessage);
      }

      // Broadcast the message if needed
      if (broadcast && messageToSend) {
        // console.log(`Broadcasting message type: ${parsedMessage.type}`); // Debug log
        for (const client of clients) {
          // Optional: Don't send back to sender? (Usually you do for confirmation/sync)
          // if (client !== ws && client.readyState === WebSocket.OPEN) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(messageToSend);
          }
        }
      }

    } catch (e) {
      console.error(`Invalid JSON received from ${ws.clientId}:`, textMessage, e);
      ws.send(JSON.stringify({
        type: 'error',
        sender: 'server',
        content: 'Invalid JSON message format received.'
      }));
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${ws.clientId}`);
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${ws.clientId}:`, error);
    clients.delete(ws); // Remove client on error
  });
});
