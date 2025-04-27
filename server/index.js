const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
console.log('WebSocket server is running on ws://localhost:8080');

// Store all connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    sender: 'server',
    content: 'Welcome to the WebSocket server'
  }));

  ws.on('message', (message) => {
    // Convert the message buffer to a string
    const textMessage = message.toString();
    console.log('Received:', textMessage);
    
    try {
      // Try to parse as JSON
      const parsedMessage = JSON.parse(textMessage);
      
      if (!parsedMessage.sender) {
        parsedMessage.sender = 'unknown';
      }

      // Add server timestamp
      parsedMessage.timestamp = Date.now();
      
      // Broadcast message to all clients
      const broadcastMessage = JSON.stringify(parsedMessage);
      
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(broadcastMessage);
        }
      }
    } catch (e) {
      // If not valid JSON, send error back to sender
      console.error('Invalid message format:', e);
      ws.send(JSON.stringify({
        type: 'error',
        sender: 'server',
        content: 'Invalid message format. Please send JSON with type, sender, and content fields.'
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});