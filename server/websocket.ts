import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { IncomingMessage } from 'http';
import signature from 'cookie-signature';
import { extensionCallService } from './services/extension-call-service';
import { whatsappCallService } from './services/whatsapp-call-service';
import { db } from './db';
import { telnyxMessages } from '@shared/schema';
import { eq, gt, and } from 'drizzle-orm';

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
    
    // Only handle our specific authenticated WebSocket paths
    if (!pathname.startsWith('/ws/sip') && !pathname.startsWith('/ws/chat') && !pathname.startsWith('/ws/pbx') && !pathname.startsWith('/ws/whatsapp-call')) {
      // Let other handlers (Vite HMR, etc.) handle this upgrade
      // Don't touch it - just return and let Express/Vite handle it
      return;
    }
    
    // Validate session for authenticated paths
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
          } else if (pathname.startsWith('/ws/pbx')) {
            handlePbxConnection(ws as AuthenticatedWebSocket, request);
          } else if (pathname.startsWith('/ws/whatsapp-call')) {
            handleWhatsAppCallConnection(ws as AuthenticatedWebSocket, request);
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
  
  // Buffer messages from client until PBX connection is ready
  const messageBuffer: any[] = [];
  let pbxWs: WebSocket | null = null;
  let isReady = false;
  
  // CRITICAL: Set up client message listener IMMEDIATELY before any async operations
  clientWs.on('message', (data) => {
    console.log('[SIP WebSocket] 📩 Message from client, buffering until PBX ready');
    if (isReady && pbxWs && pbxWs.readyState === WebSocket.OPEN) {
      console.log('[SIP WebSocket] ✅ Forwarding message to PBX');
      pbxWs.send(data);
    } else {
      console.log('[SIP WebSocket] 📦 Buffering message (PBX not ready)');
      messageBuffer.push(data);
    }
  });
  
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
        pbxWs = new WebSocket(pbxServer, ['sip'], {
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
        
        // Handle PBX connection open - flush buffer
        pbxWs.on('open', () => {
          console.log('[SIP WebSocket] ✅ Connected to PBX server successfully');
          isReady = true;
          
          // Flush buffered messages
          if (messageBuffer.length > 0) {
            console.log(`[SIP WebSocket] 📤 Flushing ${messageBuffer.length} buffered messages to PBX`);
            messageBuffer.forEach((data) => {
              if (pbxWs && pbxWs.readyState === WebSocket.OPEN) {
                pbxWs.send(data);
              }
            });
            messageBuffer.length = 0;
          }
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
            // Sanitize close code - must be a valid number in range (1000-4999)
            const codeNum = typeof code === 'number' ? code : 1006;
            const safeCode = (codeNum >= 1000 && codeNum <= 4999) ? codeNum : 1011;
            // Trim reason to max 123 bytes
            const safeReason = reason ? reason.toString().slice(0, 123) : '';
            clientWs.close(safeCode, safeReason);
          }
        });
        
        // Handle client disconnect
        clientWs.on('close', () => {
          console.log('[SIP WebSocket] Client disconnected - closing PBX connection');
          if (pbxWs && (pbxWs.readyState === WebSocket.OPEN || pbxWs.readyState === WebSocket.CONNECTING)) {
            pbxWs.close();
          }
        });
      } catch (error: any) {
        console.error('[SIP WebSocket] Error setting up proxy:', error.message);
        clientWs.close(1011, 'Proxy setup error');
      }
    });
}

// WhatsApp Call WebSocket Handler
function handleWhatsAppCallConnection(ws: AuthenticatedWebSocket, req: IncomingMessage) {
  const sessionId = getSessionIdFromRequest(req);
  
  if (!sessionId || !sessionStore) {
    ws.close(1008, 'Unauthorized');
    return;
  }
  
  sessionStore.get(sessionId, async (err: any, session: SessionData) => {
    if (err || !session || !session.user?.id) {
      ws.close(1008, 'Unauthorized');
      return;
    }
    
    const userId = session.user.id;
    const companyId = session.user.companyId;
    
    if (!companyId) {
      ws.close(1008, 'No company');
      return;
    }
    
    ws.userId = userId;
    ws.companyId = companyId;
    ws.isAuthenticated = true;
    
    whatsappCallService.registerAgent(ws, userId, companyId);
    
    ws.send(JSON.stringify({ 
      type: 'registered',
      userId,
      companyId
    }));
    
    // Send any pending calls for this company (including SDP offer)
    const pendingCalls = whatsappCallService.getPendingCallsForCompany(companyId);
    if (pendingCalls.length > 0) {
      for (const call of pendingCalls) {
        ws.send(JSON.stringify({
          type: 'whatsapp_incoming_call',
          call: {
            callId: call.callId,
            from: call.from,
            to: call.to,
            fromName: call.fromName || call.from,
            timestamp: call.timestamp.toISOString(),
            status: call.status,
            sdpOffer: call.sdpOffer
          }
        }));
      }
    }
    
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log('[WhatsApp Call WS] Received message:', msg.type);
        
        switch (msg.type) {
          case 'answer':
            const answerResult = await whatsappCallService.answerCall(msg.callId, userId, msg.sdpAnswer);
            ws.send(JSON.stringify({ type: 'answer_result', callId: msg.callId, ...answerResult }));
            break;
            
          case 'decline':
            const declineResult = await whatsappCallService.declineCall(msg.callId);
            ws.send(JSON.stringify({ type: 'decline_result', callId: msg.callId, ...declineResult }));
            break;
            
          case 'terminate':
            const terminateResult = await whatsappCallService.terminateCall(msg.callId, companyId);
            ws.send(JSON.stringify({ type: 'terminate_result', callId: msg.callId, ...terminateResult }));
            break;
            
          case 'get_pending':
            const calls = whatsappCallService.getPendingCallsForCompany(companyId);
            ws.send(JSON.stringify({ type: 'pending_calls', calls }));
            break;
        }
      } catch (error: any) {
        console.error('[WhatsApp Call WS] Error processing message:', error);
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    });
    
    ws.on('close', () => {
      console.log(`[WhatsApp Call WS] Agent ${userId} disconnected`);
    });
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

// PBX Extension-to-Extension Call Handler
async function handlePbxConnection(ws: AuthenticatedWebSocket, req: IncomingMessage) {
  const sessionId = getSessionIdFromRequest(req);
  
  if (!sessionId || !sessionStore) {
    ws.close(1008, 'Unauthorized');
    return;
  }
  
  sessionStore.get(sessionId, async (err: any, session: SessionData) => {
    if (err || !session || !session.user?.id) {
      ws.close(1008, 'Unauthorized');
      return;
    }
    
    const userId = session.user.id;
    const companyId = session.user.companyId;
    
    if (!companyId) {
      ws.close(1008, 'No company');
      return;
    }
    
    const client = await extensionCallService.registerExtension(ws, userId, companyId);
    
    if (!client) {
      ws.send(JSON.stringify({ type: 'error', message: 'No extension assigned' }));
      ws.close(1008, 'No extension');
      return;
    }
    
    ws.send(JSON.stringify({ 
      type: 'registered', 
      extensionId: client.extensionId,
      extension: client.extension,
      displayName: client.displayName
    }));
    
    // Broadcast updated online extensions list to ALL clients in this company
    // This ensures existing clients learn about the newly registered extension
    await extensionCallService.broadcastOnlineExtensions(companyId);
    
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        switch (msg.type) {
          case 'call':
            const result = await extensionCallService.initiateCall(
              client.extensionId,
              msg.toExtension,
              msg.sdpOffer
            );
            ws.send(JSON.stringify({ type: 'call_result', ...result }));
            break;
            
          case 'answer':
            await extensionCallService.answerCall(msg.callId, client.extensionId, msg.sdpAnswer);
            break;
            
          case 'reject':
            await extensionCallService.rejectCall(msg.callId, client.extensionId);
            break;
            
          case 'ice_candidate':
            extensionCallService.relayIceCandidate(msg.callId, client.extensionId, msg.candidate);
            break;
            
          case 'hangup':
            extensionCallService.endCall(msg.callId, 'hangup');
            break;
            
          case 'get_online':
            const extensions = await extensionCallService.getOnlineExtensions(companyId);
            ws.send(JSON.stringify({ type: 'online_extensions', extensions }));
            break;
            
          case 'accept_queue_call':
            // Agent accepts an incoming queue call
            if (msg.callControlId) {
              const { callControlWebhookService } = await import('./services/call-control-webhook-service');
              const acceptResult = await callControlWebhookService.handleAgentAcceptQueueCall(
                msg.callControlId,
                client.extensionId,
                companyId
              );
              ws.send(JSON.stringify({ 
                type: 'accept_queue_call_result', 
                callControlId: msg.callControlId,
                ...acceptResult 
              }));
            }
            break;
            
          case 'reject_queue_call':
            // Agent rejects/declines an incoming queue call
            if (msg.callControlId) {
              const { callControlWebhookService } = await import('./services/call-control-webhook-service');
              const rejectResult = await callControlWebhookService.handleAgentRejectQueueCall(
                msg.callControlId,
                client.extensionId,
                companyId
              );
              ws.send(JSON.stringify({ 
                type: 'reject_queue_call_result', 
                callControlId: msg.callControlId,
                ...rejectResult 
              }));
            }
            break;
        }
      } catch (e) {
        console.error('[PBX WebSocket] Message error:', e);
      }
    });
    
    ws.on('close', () => {
      extensionCallService.unregisterExtension(client.extensionId);
    });
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

// Broadcast Telnyx phone number assignment to a specific user
export function broadcastTelnyxNumberAssigned(userId: string, phoneNumber: string, telnyxPhoneNumberId: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'telnyx_number_assigned',
    phoneNumber,
    telnyxPhoneNumberId,
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    if (authClient.userId === userId) {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting telnyx_number_assigned to user ${userId} (${sentCount} active sessions)`);
}

// Broadcast Telnyx phone number unassignment to the previous user so they disconnect WebRTC
export function broadcastTelnyxNumberUnassigned(userId: string, phoneNumber: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'telnyx_number_unassigned',
    phoneNumber,
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    if (authClient.userId === userId) {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting telnyx_number_unassigned to user ${userId} (${sentCount} active sessions)`);
}

// Broadcast new voicemail notification to a specific user
export function broadcastNewVoicemailToUser(userId: string, fromNumber: string, callerName: string | null) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'new_voicemail',
    fromNumber,
    callerName,
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    if (authClient.userId === userId) {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting new_voicemail to user ${userId} (${sentCount} active sessions)`);
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

// Broadcast inbox message update for real-time inbox refresh
export function broadcastInboxMessage(companyId: string, conversationId: string) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: 'telnyx_message',
    conversationId,
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
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcasting telnyx_message for inbox conversation ${conversationId} to ${sentCount} clients (company: ${companyId})`);
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

// ==================== WHATSAPP WEBSOCKET HANDLERS ====================

export type WhatsAppEventType = 
  | 'whatsapp:message'
  | 'whatsapp:message_status'
  | 'whatsapp:chat_update'
  | 'whatsapp:connection'
  | 'whatsapp:qr_code';

export interface WhatsAppEvent {
  type: WhatsAppEventType;
  companyId: string;
  data: {
    remoteJid?: string;
    messageId?: string;
    status?: string;
    qrCode?: string;
    connected?: boolean;
    fromMe?: boolean;
  };
}

export function broadcastWhatsAppEvent(companyId: string, event: WhatsAppEvent) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify(event);

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    if (authClient.companyId === companyId || authClient.role === 'superadmin') {
      client.send(payload);
      sentCount++;
    }
  });
  
  console.log(`[WebSocket] Broadcast ${event.type} to ${sentCount} client(s) for company ${companyId}`);
}

export function broadcastWhatsAppMessage(companyId: string, remoteJid: string, messageId?: string, fromMe?: boolean) {
  broadcastWhatsAppEvent(companyId, {
    type: 'whatsapp:message',
    companyId,
    data: { remoteJid, messageId, fromMe }
  });
}

export function broadcastWhatsAppMessageStatus(companyId: string, remoteJid: string, messageId: string, status: string) {
  broadcastWhatsAppEvent(companyId, {
    type: 'whatsapp:message_status',
    companyId,
    data: { remoteJid, messageId, status }
  });
}

export function broadcastWhatsAppChatUpdate(companyId: string) {
  broadcastWhatsAppEvent(companyId, {
    type: 'whatsapp:chat_update',
    companyId,
    data: {}
  });
}

export function broadcastWhatsAppConnection(companyId: string, connected: boolean, status?: string) {
  broadcastWhatsAppEvent(companyId, {
    type: 'whatsapp:connection',
    companyId,
    data: { connected, status }
  });
}

export function broadcastWhatsAppQrCode(companyId: string, qrCode?: string) {
  broadcastWhatsAppEvent(companyId, {
    type: 'whatsapp:qr_code',
    companyId,
    data: { qrCode }
  });
}

export function broadcastWhatsAppTyping(companyId: string, remoteJid: string, isTyping: boolean): void {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify({
    type: 'whatsapp_typing',
    remoteJid,
    isTyping,
    companyId
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    if (authClient.companyId === companyId || authClient.role === 'superadmin') {
      client.send(payload);
      sentCount++;
    }
  });
  
  console.log(`[WebSocket] Broadcast whatsapp_typing to ${sentCount} client(s) for company ${companyId}`);
}

// =====================================================
// WALLET/BILLING REAL-TIME UPDATES
// =====================================================

export interface WalletUpdateData {
  newBalance: string;
  lastCharge: string;
  chargeType: "CALL_COST" | "SMS_COST" | "DEPOSIT" | "REFUND";
  description?: string;
}

export interface CallLogData {
  id: string;
  fromNumber: string;
  toNumber: string;
  direction: "inbound" | "outbound";
  duration: number;
  cost: string;
  status: string;
  recordingUrl?: string;
}

export function broadcastWalletUpdate(companyId: string, data: WalletUpdateData): void {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify({
    type: 'wallet_updated',
    companyId,
    data
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    if (authClient.companyId === companyId) {
      client.send(payload);
      sentCount++;
    }
  });
  
  console.log(`[WebSocket] Broadcast wallet_updated to ${sentCount} client(s) for company ${companyId}`);
}

export function broadcastNewCallLog(companyId: string, callLog: CallLogData): void {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify({
    type: 'new_call_log',
    companyId,
    data: callLog
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    if (authClient.companyId === companyId) {
      client.send(payload);
      sentCount++;
    }
  });
  
  console.log(`[WebSocket] Broadcast new_call_log to ${sentCount} client(s) for company ${companyId}`);
}

// =====================================================
// WALLET ANALYTICS REAL-TIME UPDATES
// =====================================================

export interface WalletAnalyticsUpdateData {
  eventType: string;
  memberId?: string;
  passId?: string;
}

export function broadcastWalletAnalyticsUpdate(companyId: string, data: WalletAnalyticsUpdateData): void {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  const payload = JSON.stringify({
    type: 'wallet_analytics_updated',
    companyId,
    data
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (!authClient.isAuthenticated || client.readyState !== WebSocket.OPEN) {
      return;
    }
    
    if (authClient.companyId === companyId) {
      client.send(payload);
      sentCount++;
    }
  });
  
  if (sentCount > 0) {
    console.log(`[WebSocket] Broadcast wallet_analytics_updated (${data.eventType}) to ${sentCount} client(s) for company ${companyId}`);
  }
}
