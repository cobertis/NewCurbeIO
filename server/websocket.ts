import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ 
    server,
    path: '/ws/chat'
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    ws.on('error', console.error);

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'connected' }));
  });

  wss.on('error', console.error);

  console.log('WebSocket server initialized on path /ws/chat');
}

// Broadcast new message to all connected clients
export function broadcastNewMessage(phoneNumber: string, messageData: any) {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'new_message',
    phoneNumber,
    data: messageData
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast conversation update to all connected clients
export function broadcastConversationUpdate() {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'conversation_update'
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast notification update to all connected clients
export function broadcastNotificationUpdate() {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'notification_update'
  });

  console.log('Broadcasting notification update to', wss.clients.size, 'clients');

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      console.log('Sent notification_update to client');
    }
  });
}

// Broadcast subscription update to all connected clients
export function broadcastSubscriptionUpdate(companyId: string) {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'subscription_update',
    companyId
  });

  console.log('Broadcasting subscription update for company:', companyId, 'to', wss.clients.size, 'clients');

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
