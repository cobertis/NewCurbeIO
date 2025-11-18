import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { IncomingMessage } from 'http';
import signature from 'cookie-signature';

// Session data structure
interface SessionData {
  user?: {
    id: string;
    companyId: string | null;
    role: string;
  };
  passport?: any;
}

if (!process.env.SESSION_SECRET) {
  throw new Error('CRITICAL: SESSION_SECRET environment variable must be set for production security');
}

const SESSION_SECRET = process.env.SESSION_SECRET;

// Parse cookies from request headers
function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {} as Record<string, string>);
}

// Extract and verify session ID from cookies
function getSessionIdFromRequest(req: IncomingMessage): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const signedCookie = cookies['connect.sid'];
  
  if (!signedCookie) {
    return null;
  }

  // Reject cookies without 's:' prefix (unsigned/tampered cookies)
  if (!signedCookie.startsWith('s:')) {
    console.log('[WebSocket] Rejecting cookie without signature prefix');
    return null;
  }

  // Verify HMAC signature and extract session ID
  // express-session signs cookies with 's:' prefix followed by signature
  const unsignedValue = signature.unsign(signedCookie.substring(2), SESSION_SECRET);
  
  if (unsignedValue === false) {
    console.log('[WebSocket] Invalid cookie signature');
    return null;
  }

  return unsignedValue as string;
}

// Extended WebSocket type to include tenant information
interface AuthenticatedWebSocket extends WebSocket {
  companyId?: string | null;
  userId?: string;
  role?: string;
  isAuthenticated: boolean;
}

let wss: WebSocketServer | null = null;
let sessionStore: any = null;

export function setupWebSocket(server: Server, pgSessionStore?: any) {
  sessionStore = pgSessionStore;
  
  // Use noServer mode and manual upgrade handling to filter by path
  wss = new WebSocketServer({ noServer: true });
  
  // Handle HTTP upgrade events manually - only for our specific paths
  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url || '';
    
    // Only handle our specific WebSocket paths
    if (!pathname.startsWith('/ws/sip') && !pathname.startsWith('/ws/chat')) {
      // Let other handlers (Vite HMR, etc.) handle this upgrade
      // Don't touch it - just return and let Express/Vite handle it
      return;
    }
    
    // Validate session for our paths
    const sessionId = getSessionIdFromRequest(request);
    
    if (!sessionId || !sessionStore) {
      console.log('[WebSocket] Rejecting upgrade without valid session');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    
    sessionStore.get(sessionId, (err: any, session: SessionData) => {
      if (err || !session || !session.user?.id) {
        console.log('[WebSocket] Rejecting upgrade with invalid/expired session');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      
      // Session is valid - handle the upgrade
      console.log('[WebSocket] Accepting authenticated connection for path:', pathname);
      
      if (wss) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          // Route to appropriate handler based on path
          if (pathname.startsWith('/ws/sip')) {
            handleSipConnection(ws as AuthenticatedWebSocket, request);
          } else if (pathname.startsWith('/ws/chat')) {
            handleChatConnection(ws as AuthenticatedWebSocket, request);
          }
        });
      }
    });
  });
}

// SIP WebSocket Proxy Handler
function handleSipConnection(clientWs: WebSocket, req: IncomingMessage) {
  console.log('[SIP WebSocket] ⚡ SIP CONNECTION HANDLER TRIGGERED');
  const sessionId = getSessionIdFromRequest(req);
  
  if (!sessionId || !sessionStore) {
    console.log('[SIP WebSocket] Connection without session - closing');
    clientWs.close(1008, 'Unauthorized');
    return;
  }
  
  console.log('[SIP WebSocket] Validating session...');
  
  sessionStore.get(sessionId, async (err: any, session: SessionData) => {
      if (err) {
        console.error('[SIP WebSocket] Session store error:', err);
        clientWs.close(1008, 'Session error');
        return;
      }
      
      if (!session || !session.user?.id) {
        console.log('[SIP WebSocket] Invalid session - closing');
        clientWs.close(1008, 'Unauthorized');
        return;
      }
      
      console.log(`[SIP WebSocket] Session valid for user: ${session.user.id}`);
      
      try {
        // Get user's SIP server configuration
        const { storage } = await import('./storage');
        const user = await storage.getUser(session.user.id);
        
        console.log('[SIP WebSocket] User config:', {
          hasUser: !!user,
          sipEnabled: user?.sipEnabled,
          hasSipServer: !!user?.sipServer,
          sipServer: user?.sipServer
        });
        
        if (!user || !user.sipEnabled || !user.sipServer) {
          console.log('[SIP WebSocket] User has no SIP configuration - closing');
          clientWs.close(1008, 'No SIP configuration');
          return;
        }
        
        const pbxServer = user.sipServer;
        console.log(`[SIP WebSocket] ✅ Connecting to PBX: ${pbxServer}`);
        
        // Create WebSocket connection to actual PBX server with SIP subprotocol
        const pbxWs = new WebSocket(pbxServer, 'sip', {
          headers: {
            'Origin': req.headers.origin || 'https://proxy.curbe.io'
          }
        });
        
        // Relay messages from PBX to client
        pbxWs.on('message', (data) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data);
          }
        });
        
        // Relay messages from client to PBX
        clientWs.on('message', (data) => {
          if (pbxWs.readyState === WebSocket.OPEN) {
            pbxWs.send(data);
          }
        });
        
        // Handle PBX connection open
        pbxWs.on('open', () => {
          console.log('[SIP WebSocket] ✅ Connected to PBX server successfully');
        });
        
        // Handle PBX errors
        pbxWs.on('error', (error) => {
          console.error('[SIP WebSocket] ❌ PBX connection error:', error.message);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(1011, 'PBX connection error');
          }
        });
        
        // Handle PBX disconnect - sanitize close codes
        pbxWs.on('close', (code, reason) => {
          console.log(`[SIP WebSocket] PBX disconnected (${code}): ${reason}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            // Sanitize close code - must be in valid range (1000-4999)
            const safeCode = (code >= 1000 && code <= 4999) ? code : 1011;
            // Trim reason to max 123 bytes
            const safeReason = reason.toString().slice(0, 123);
            clientWs.close(safeCode, safeReason);
          }
        });
        
        // Handle client disconnect
        clientWs.on('close', () => {
          console.log('[SIP WebSocket] Client disconnected - closing PBX connection');
          if (pbxWs.readyState === WebSocket.OPEN || pbxWs.readyState === WebSocket.CONNECTING) {
            pbxWs.close();
          }
        });
      } catch (error: any) {
        console.error('[SIP WebSocket] Error setting up proxy:', error.message);
        clientWs.close(1011, 'Proxy setup error');
      }
    });
}

// Chat WebSocket Handler
function handleChatConnection(ws: AuthenticatedWebSocket, req: IncomingMessage) {
  ws.isAuthenticated = false;
  
  // Extract session and authenticate the WebSocket
  const sessionId = getSessionIdFromRequest(req);
  
  // This handler should only be called if verifyClient passed, but defense in depth
  if (!sessionId || !sessionStore) {
    console.log('[WebSocket] Connection without session - closing immediately');
    ws.close(1008, 'Unauthorized');
    return;
  }
  
  sessionStore.get(sessionId, async (err: any, session: SessionData) => {
    if (err || !session || !session.user?.id) {
      console.log('[WebSocket] Invalid session in connection handler - closing');
      ws.close(1008, 'Unauthorized');
      return;
    }
    
    // Get user from storage to get full user data
    const { storage } = await import('./storage');
    const user = await storage.getUser(session.user.id);
    
    if (!user) {
      console.log('[WebSocket] User not found for session - closing');
      ws.close(1008, 'Unauthorized');
      return;
    }
    
    // Authenticate the WebSocket
    ws.companyId = user.companyId || null;
    ws.userId = user.id;
    ws.role = user.role;
    ws.isAuthenticated = true;
    
    console.log(`[WebSocket] Authenticated: userId=${ws.userId}, companyId=${ws.companyId}, role=${ws.role}`);
    ws.send(JSON.stringify({ type: 'authenticated', user: {
      id: user.id,
      companyId: user.companyId,
      role: user.role
    }}));
  });

  ws.on('error', console.error);

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
  });
}

// Broadcast new message to tenant-scoped clients only
// NOTE: companyId should be passed based on the conversation/phone number owner
export function broadcastNewMessage(phoneNumber: string, messageData: any, companyId?: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'new_message',
    phoneNumber,
    data: messageData,
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    // CRITICAL: Always verify authentication first to prevent leaks
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // If companyId specified, only send to that company or superadmins
    // If no companyId, send to all authenticated clients (backward compatibility)
    const shouldSend = !companyId || 
                      authClient.companyId === companyId || 
                      authClient.role === 'superadmin';
    
    if (shouldSend) {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting new_message to ${sentCount} authenticated clients${companyId ? ` (company: ${companyId})` : ''}`);
}

// Broadcast conversation update to tenant-scoped clients only
export function broadcastConversationUpdate(companyId?: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'conversation_update',
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    // CRITICAL: Always verify authentication first to prevent leaks
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // If companyId specified, only send to that company or superadmins
    // If no companyId, send to all authenticated clients (backward compatibility)
    const shouldSend = !companyId || 
                      authClient.companyId === companyId || 
                      authClient.role === 'superadmin';
    
    if (shouldSend) {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting conversation_update to ${sentCount} authenticated clients${companyId ? ` (company: ${companyId})` : ''}`);
}

// Broadcast notification update to tenant-scoped clients only
export function broadcastNotificationUpdate(companyId?: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'notification_update',
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    // CRITICAL: Always verify authentication first to prevent leaks
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // If companyId specified, only send to that company or superadmins
    // If no companyId, send to all authenticated clients (backward compatibility)
    const shouldSend = !companyId || 
                      authClient.companyId === companyId || 
                      authClient.role === 'superadmin';
    
    if (shouldSend) {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting notification_update to ${sentCount} authenticated clients${companyId ? ` (company: ${companyId})` : ''}`);
}

// Broadcast notification update to a specific user
export function broadcastNotificationUpdateToUser(userId: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'notification_update',
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    // CRITICAL: Always verify authentication first to prevent leaks
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Only send to the specific user
    if (authClient.userId === userId) {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting notification_update to user ${userId} (${sentCount} active sessions)`);
}

// Broadcast subscription update to tenant-scoped clients only
export function broadcastSubscriptionUpdate(companyId: string) {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'subscription_update',
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    // CRITICAL: Always verify authentication first to prevent leaks
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Only send to clients in the same company or superadmins
    if (authClient.companyId === companyId || authClient.role === 'superadmin') {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting subscription_update for company: ${companyId} to ${sentCount} authenticated clients`);
}

// Broadcast company data update to tenant-scoped clients only
export function broadcastCompanyUpdate(companyId: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'company_update',
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    // CRITICAL: Always verify authentication first to prevent leaks
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Only send to clients in the same company or superadmins
    if (authClient.companyId === companyId || authClient.role === 'superadmin') {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting company_update for company: ${companyId} to ${sentCount} authenticated clients`);
}

// Broadcast user data update to tenant-scoped clients only
export function broadcastUserUpdate(userId: string, companyId: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'user_update',
    userId,
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    // CRITICAL: Always verify authentication first to prevent leaks
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Only send to clients in the same company or superadmins
    if (authClient.companyId === companyId || authClient.role === 'superadmin') {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting user_update for user: ${userId}, company: ${companyId} to ${sentCount} authenticated clients`);
}

// Generic data invalidation broadcast to tenant-scoped clients
export function broadcastDataInvalidation(queryKeys: string[], companyId?: string) {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'data_invalidation',
    queryKeys,
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    // CRITICAL: Always verify authentication first to prevent leaks
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // If companyId specified, only send to that company or superadmins
    // If no companyId, send to all authenticated clients
    const shouldSend = !companyId || 
                      authClient.companyId === companyId || 
                      authClient.role === 'superadmin';
    
    if (shouldSend) {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting data_invalidation for queries: ${queryKeys.join(', ')} to ${sentCount} authenticated clients${companyId ? ` (company: ${companyId})` : ''}`);
}

// Broadcast new BulkVS message
export function broadcastBulkvsMessage(threadId: string, message: any, userId: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify({
    type: 'bulkvs_message',
    threadId,
    message,
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Only send to the message owner
    if (authClient.userId === userId) {
      client.send(payload);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting bulkvs_message to ${sentCount} clients`);
}

// Broadcast thread update (new thread, pin, archive, labels, etc)
export function broadcastBulkvsThreadUpdate(userId: string, thread: any) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify({
    type: 'bulkvs_thread_update',
    thread,
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    if (authClient.userId === userId) {
      client.send(payload);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting bulkvs_thread_update to ${sentCount} clients`);
}

// Broadcast message status update (sent, delivered, read)
export function broadcastBulkvsMessageStatus(messageId: string, status: string, userId: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify({
    type: 'bulkvs_message_status',
    messageId,
    status,
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    if (authClient.userId === userId) {
      client.send(payload);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting bulkvs_message_status to ${sentCount} clients`);
}

// ==================== iMESSAGE WEBSOCKET HANDLERS ====================

// Broadcast iMessage update to all clients in the same company
export function broadcastImessageUpdate(companyId: string, data: any) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'imessage_update',
    ...data,
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    // CRITICAL: Always verify authentication first to prevent leaks
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Only send to clients in the same company or superadmins
    if (authClient.companyId === companyId || authClient.role === 'superadmin') {
      client.send(message);
      sentCount++;
    }
  });
  
  console.log(`[WebSocket] Broadcast iMessage update to ${sentCount} client(s)`);
}

// Broadcast new iMessage to all clients in the same company
export function broadcastImessageMessage(companyId: string, conversationId: string, message: any) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify({
    type: 'imessage_message',
    conversationId,
    message,
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Only send to clients in the same company or superadmins
    if (authClient.companyId === companyId || authClient.role === 'superadmin') {
      client.send(payload);
      sentCount++;
    }
  });
  
  console.log(`[WebSocket] Broadcast iMessage message to ${sentCount} client(s)`);
}

// Broadcast typing indicator
export function broadcastImessageTyping(companyId: string, conversationId: string, userId: string, isTyping: boolean) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify({
    type: 'imessage_typing',
    conversationId,
    userId,
    isTyping,
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Only send to clients in the same company (excluding the typing user)
    if (authClient.companyId === companyId && authClient.userId !== userId) {
      client.send(payload);
      sentCount++;
    }
  });
  
  console.log(`[WebSocket] Broadcast iMessage typing to ${sentCount} client(s)`);
}

// Broadcast reaction update
export function broadcastImessageReaction(companyId: string, messageId: string, userId: string, reaction: string, action: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify({
    type: 'imessage_reaction',
    messageId,
    userId,
    reaction,
    action,
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Only send to clients in the same company or superadmins
    if (authClient.companyId === companyId || authClient.role === 'superadmin') {
      client.send(payload);
      sentCount++;
    }
  });
  
  console.log(`[WebSocket] Broadcast iMessage reaction to ${sentCount} client(s)`);
}

// Broadcast read receipt update
export function broadcastImessageReadReceipt(companyId: string, conversationId: string, messageGuids: string[]) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify({
    type: 'imessage_read_receipt',
    conversationId,
    messageGuids,
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Only send to clients in the same company or superadmins
    if (authClient.companyId === companyId || authClient.role === 'superadmin') {
      client.send(payload);
      sentCount++;
    }
  });
  
  console.log(`[WebSocket] Broadcast iMessage read receipt to ${sentCount} client(s)`);
}
