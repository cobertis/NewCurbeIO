import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { IncomingMessage } from 'http';
import type { SessionData } from './types';
import signature from 'cookie-signature';

const SESSION_SECRET = process.env.SESSION_SECRET || "curbe-admin-secret-key-2024";

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
  
  wss = new WebSocketServer({ 
    server,
    path: '/ws/chat',
    verifyClient: (info, callback) => {
      // Extract and validate session on connection upgrade
      const sessionId = getSessionIdFromRequest(info.req);
      
      if (!sessionId || !sessionStore) {
        // Reject unauthenticated connections immediately
        console.log('[WebSocket] Rejecting connection without valid session');
        callback(false, 401, 'Unauthorized');
        return;
      }

      // Validate session exists in store
      sessionStore.get(sessionId, (err: any, session: SessionData) => {
        if (err || !session || !session.passport?.user) {
          console.log('[WebSocket] Rejecting connection with invalid/expired session');
          callback(false, 401, 'Unauthorized');
          return;
        }

        // Session is valid - allow connection
        console.log('[WebSocket] Accepting authenticated connection');
        callback(true);
      });
    }
  });

  wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
    ws.isAuthenticated = false;
    
    // Extract session and authenticate the WebSocket
    const sessionId = getSessionIdFromRequest(req);
    
    // This handler should only be called if verifyClient passed, but defense in depth
    if (!sessionId || !sessionStore) {
      console.log('[WebSocket] Connection without session - closing immediately');
      ws.close(1008, 'Unauthorized');
      return;
    }
    
    sessionStore.get(sessionId, (err: any, session: SessionData) => {
      if (err || !session || !session.passport?.user) {
        console.log('[WebSocket] Invalid session in connection handler - closing');
        ws.close(1008, 'Unauthorized');
        return;
      }
      
      // Authenticate the WebSocket
      const user = session.passport.user;
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
  });

  wss.on('error', console.error);

  console.log('[WebSocket] Server initialized on path /ws/chat');
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
