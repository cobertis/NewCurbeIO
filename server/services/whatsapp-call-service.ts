import { WebSocket } from 'ws';
import { db } from '../db';
import { channelConnections } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { decryptToken } from '../crypto';

interface PendingCall {
  callId: string;
  from: string;
  to: string;
  fromName?: string;
  phoneNumberId: string;
  companyId: string;
  sdpOffer: string;
  timestamp: Date;
  status: 'ringing' | 'answered' | 'ended' | 'missed';
  direction: string;
}

interface ConnectedAgent {
  ws: WebSocket;
  userId: string;
  companyId: string;
}

class WhatsAppCallService {
  private pendingCalls: Map<string, PendingCall> = new Map();
  private connectedAgents: Map<string, ConnectedAgent[]> = new Map();

  registerAgent(ws: WebSocket, userId: string, companyId: string) {
    const agents = this.connectedAgents.get(companyId) || [];
    agents.push({ ws, userId, companyId });
    this.connectedAgents.set(companyId, agents);
    console.log(`[WhatsApp Call] Agent ${userId} registered for company ${companyId}`);
    
    ws.on('close', () => {
      this.unregisterAgent(userId, companyId);
    });
  }

  unregisterAgent(userId: string, companyId: string) {
    const agents = this.connectedAgents.get(companyId) || [];
    const filtered = agents.filter(a => a.userId !== userId);
    this.connectedAgents.set(companyId, filtered);
    console.log(`[WhatsApp Call] Agent ${userId} unregistered from company ${companyId}`);
  }

  async handleIncomingCall(
    callId: string,
    from: string,
    to: string,
    fromName: string | undefined,
    phoneNumberId: string,
    companyId: string,
    sdpOffer: string,
    direction: string
  ) {
    const pendingCall: PendingCall = {
      callId,
      from,
      to,
      fromName,
      phoneNumberId,
      companyId,
      sdpOffer,
      timestamp: new Date(),
      status: 'ringing',
      direction
    };

    this.pendingCalls.set(callId, pendingCall);
    console.log(`[WhatsApp Call] Incoming call ${callId} from ${from} to ${to}`);

    this.notifyAgents(companyId, {
      type: 'whatsapp_incoming_call',
      call: {
        callId,
        from,
        to,
        fromName: fromName || from,
        timestamp: pendingCall.timestamp.toISOString(),
        status: 'ringing',
        sdpOffer: sdpOffer
      }
    });

    setTimeout(() => {
      const call = this.pendingCalls.get(callId);
      if (call && call.status === 'ringing') {
        call.status = 'missed';
        this.pendingCalls.delete(callId);
        this.notifyAgents(companyId, {
          type: 'whatsapp_call_missed',
          callId
        });
        console.log(`[WhatsApp Call] Call ${callId} missed (timeout)`);
      }
    }, 60000);

    return pendingCall;
  }

  private notifyAgents(companyId: string, message: any) {
    const agents = this.connectedAgents.get(companyId) || [];
    const payload = JSON.stringify(message);
    
    for (const agent of agents) {
      if (agent.ws.readyState === WebSocket.OPEN) {
        agent.ws.send(payload);
      }
    }
    console.log(`[WhatsApp Call] Notified ${agents.length} agents in company ${companyId}`);
  }

  async answerCall(callId: string, userId: string, sdpAnswer: string): Promise<{ success: boolean; error?: string }> {
    const call = this.pendingCalls.get(callId);
    if (!call) {
      return { success: false, error: 'Call not found or already ended' };
    }

    // Race prevention: check if call is still ringing before answering
    if (call.status !== 'ringing') {
      return { success: false, error: `Call already ${call.status} by another agent` };
    }

    // Mark as answering immediately to prevent race conditions
    call.status = 'answered';

    try {
      const connection = await db.query.channelConnections.findFirst({
        where: and(
          eq(channelConnections.companyId, call.companyId),
          eq(channelConnections.phoneNumberId, call.phoneNumberId)
        )
      });

      if (!connection || !connection.accessTokenEnc) {
        return { success: false, error: 'WhatsApp connection not found' };
      }

      const accessToken = decryptToken(connection.accessTokenEnc);
      let modifiedSdp = sdpAnswer.replace(/a=setup:actpass/g, 'a=setup:active');

      // Meta WhatsApp Calling API: POST /{phone_number_id}/calls with command in body
      const callsEndpoint = `https://graph.facebook.com/v21.0/${call.phoneNumberId}/calls`;

      console.log(`[WhatsApp Call] Sending pre_accept for call ${callId}`);
      const preAcceptPayload = {
        messaging_product: 'whatsapp',
        call_id: callId,
        action: 'pre_accept',
        session: {
          sdp_type: 'answer',
          sdp: modifiedSdp
        }
      };
      console.log(`[WhatsApp Call] pre_accept payload:`, JSON.stringify(preAcceptPayload, null, 2));
      
      const preAcceptResponse = await fetch(callsEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preAcceptPayload)
      });

      if (!preAcceptResponse.ok) {
        const errorData = await preAcceptResponse.json();
        console.error('[WhatsApp Call] pre_accept failed:', errorData);
        return { success: false, error: `pre_accept failed: ${JSON.stringify(errorData)}` };
      }

      const preAcceptResult = await preAcceptResponse.json();
      console.log(`[WhatsApp Call] pre_accept succeeded:`, preAcceptResult);

      console.log(`[WhatsApp Call] Sending accept for call ${callId}`);
      const acceptPayload = {
        messaging_product: 'whatsapp',
        call_id: callId,
        action: 'accept',
        session: {
          sdp_type: 'answer',
          sdp: modifiedSdp
        }
      };
      
      const acceptResponse = await fetch(callsEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(acceptPayload)
      });

      if (!acceptResponse.ok) {
        const errorData = await acceptResponse.json();
        console.error('[WhatsApp Call] accept failed:', errorData);
        return { success: false, error: `accept failed: ${JSON.stringify(errorData)}` };
      }
      
      const acceptResult = await acceptResponse.json();
      console.log(`[WhatsApp Call] accept succeeded:`, acceptResult);

      call.status = 'answered';
      console.log(`[WhatsApp Call] Call ${callId} answered by user ${userId}`);

      this.notifyAgents(call.companyId, {
        type: 'whatsapp_call_answered',
        callId,
        answeredBy: userId
      });

      return { success: true };
    } catch (error: any) {
      console.error('[WhatsApp Call] Error answering call:', error);
      return { success: false, error: error.message };
    }
  }

  async declineCall(callId: string): Promise<{ success: boolean; error?: string }> {
    const call = this.pendingCalls.get(callId);
    if (!call) {
      return { success: false, error: 'Call not found' };
    }

    // Mark as ended immediately
    call.status = 'ended';
    this.pendingCalls.delete(callId);

    // Try to call Meta's terminate API (best effort)
    try {
      const connection = await db.query.channelConnections.findFirst({
        where: and(
          eq(channelConnections.companyId, call.companyId),
          eq(channelConnections.phoneNumberId, call.phoneNumberId)
        )
      });

      if (connection?.accessTokenEnc) {
        const accessToken = decryptToken(connection.accessTokenEnc);
        
        // Meta doesn't have a direct "decline" endpoint, but we can terminate the call
        // The call will end on Meta's side when we don't respond with accept
        console.log(`[WhatsApp Call] Call ${callId} declined - letting it timeout on Meta's side`);
      }
    } catch (error) {
      console.error(`[WhatsApp Call] Error during decline API call:`, error);
      // Continue anyway - the call is already marked as ended locally
    }

    this.notifyAgents(call.companyId, {
      type: 'whatsapp_call_declined',
      callId
    });

    console.log(`[WhatsApp Call] Call ${callId} declined`);
    return { success: true };
  }

  async terminateCall(callId: string, companyId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[WhatsApp Call] Terminating call ${callId} for company ${companyId}`);
      
      // First check if we have the call info in pending calls (has phoneNumberId)
      const pendingCall = this.pendingCalls.get(callId);
      
      const connection = await db.query.channelConnections.findFirst({
        where: and(
          eq(channelConnections.companyId, companyId),
          eq(channelConnections.channel, 'whatsapp'),
          eq(channelConnections.status, 'active')
        )
      });

      if (!connection || !connection.accessTokenEnc) {
        console.error(`[WhatsApp Call] No active WhatsApp connection found for company ${companyId}`);
        return { success: false, error: 'WhatsApp connection not found' };
      }

      const accessToken = decryptToken(connection.accessTokenEnc);
      // Use phoneNumberId from pending call if available, otherwise from connection
      const phoneNumberId = pendingCall?.phoneNumberId || connection.phoneNumberId;
      
      console.log(`[WhatsApp Call] Sending terminate to Meta API for call ${callId}, phoneNumberId: ${phoneNumberId}`);

      const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/calls`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          call_id: callId,
          action: 'terminate'
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error(`[WhatsApp Call] Meta API error for terminate ${callId}:`, result);
        // Still clean up locally even if Meta API fails
      } else {
        console.log(`[WhatsApp Call] terminate success for ${callId}:`, result);
      }

      // Clean up pending call if exists
      const call = this.pendingCalls.get(callId);
      if (call) {
        call.status = 'ended';
        this.pendingCalls.delete(callId);
      }

      // Notify all agents that call ended
      this.notifyAgents(companyId, {
        type: 'whatsapp_call_ended',
        callId
      });

      console.log(`[WhatsApp Call] Call ${callId} terminated`);
      return { success: true };
    } catch (error: any) {
      console.error('[WhatsApp Call] Error terminating call:', error);
      return { success: false, error: error.message };
    }
  }

  handleCallTerminate(callId: string) {
    const call = this.pendingCalls.get(callId);
    if (call) {
      call.status = 'ended';
      this.pendingCalls.delete(callId);
      this.notifyAgents(call.companyId, {
        type: 'whatsapp_call_ended',
        callId
      });
      console.log(`[WhatsApp Call] Call ${callId} terminated`);
    }
  }

  getPendingCall(callId: string): PendingCall | undefined {
    return this.pendingCalls.get(callId);
  }

  getPendingCallsForCompany(companyId: string): PendingCall[] {
    return Array.from(this.pendingCalls.values()).filter(c => c.companyId === companyId && c.status === 'ringing');
  }
}

export const whatsappCallService = new WhatsAppCallService();
