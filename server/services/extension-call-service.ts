import { db } from "../db";
import { pbxExtensions, pbxSettings, pbxQueues, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import WebSocket from "ws";

interface ExtensionClient {
  ws: WebSocket;
  extensionId: string;
  extension: string;
  userId: string;
  companyId: string;
  displayName: string;
}

interface ActiveCall {
  id: string;
  callerExtensionId: string;
  calleeExtensionId: string;
  status: "ringing" | "connected" | "ended";
  startTime: Date;
  answerTime?: Date;
}

// Queue calls from external callers via IVR
interface QueueCall {
  id: string;
  callControlId: string;
  companyId: string;
  queueId: string;
  callerNumber: string;
  status: "ringing" | "answered" | "failed";
  notifiedAgents: string[]; // extensionIds that received notification
  answeredByExtensionId: string | null;
  ringTimeout: number;
  timeoutHandle: NodeJS.Timeout | null;
  startTime: Date;
}

class ExtensionCallService {
  private connectedClients: Map<string, ExtensionClient> = new Map();
  private activeCalls: Map<string, ActiveCall> = new Map();
  private queueCalls: Map<string, QueueCall> = new Map(); // keyed by callControlId

  async registerExtension(
    ws: WebSocket,
    userId: string,
    companyId: string
  ): Promise<ExtensionClient | null> {
    const extension = await db.query.pbxExtensions.findFirst({
      where: and(
        eq(pbxExtensions.userId, userId),
        eq(pbxExtensions.companyId, companyId),
        eq(pbxExtensions.isActive, true)
      ),
    });

    if (!extension) {
      console.log(`[ExtensionCall] No active extension found for user ${userId}`);
      return null;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const client: ExtensionClient = {
      ws,
      extensionId: extension.id,
      extension: extension.extension,
      userId,
      companyId,
      displayName: extension.displayName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || extension.extension,
    };

    this.connectedClients.set(extension.id, client);
    console.log(`[ExtensionCall] Extension ${extension.extension} registered for user ${userId}`);

    return client;
  }

  unregisterExtension(extensionId: string): void {
    const client = this.connectedClients.get(extensionId);
    if (client) {
      const companyId = client.companyId;
      this.connectedClients.delete(extensionId);
      console.log(`[ExtensionCall] Extension ${client.extension} unregistered`);

      Array.from(this.activeCalls.entries()).forEach(([callId, call]) => {
        if (call.callerExtensionId === extensionId || call.calleeExtensionId === extensionId) {
          this.endCall(callId, "disconnect");
        }
      });
      
      // Broadcast updated list to all remaining clients in the same company
      this.broadcastOnlineExtensions(companyId);
    }
  }

  /**
   * Broadcast updated online extensions list to all connected clients in a company
   * Called after register/unregister to keep all clients in sync
   */
  async broadcastOnlineExtensions(companyId: string): Promise<void> {
    const online = await this.getOnlineExtensions(companyId);
    const message = JSON.stringify({ type: 'online_extensions', extensions: online });
    
    let sentCount = 0;
    Array.from(this.connectedClients.values()).forEach((client) => {
      if (client.companyId === companyId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        sentCount++;
      }
    });
    
    console.log(`[ExtensionCall] Broadcast online_extensions to ${sentCount} clients in company ${companyId}`);
  }

  /**
   * Broadcast a message to all connected PBX clients in a company
   */
  broadcastToCompany(companyId: string, data: any): void {
    const message = JSON.stringify(data);
    
    let sentCount = 0;
    Array.from(this.connectedClients.values()).forEach((client) => {
      if (client.companyId === companyId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        sentCount++;
      }
    });
    
    console.log(`[ExtensionCall] Broadcast ${data.type || 'message'} to ${sentCount} PBX clients in company ${companyId}`);
  }

  async getOnlineExtensions(companyId: string): Promise<Array<{
    extensionId: string;
    extension: string;
    displayName: string;
    status: "available" | "busy";
  }>> {
    const online: Array<{
      extensionId: string;
      extension: string;
      displayName: string;
      status: "available" | "busy";
    }> = [];

    Array.from(this.connectedClients.entries()).forEach(([extensionId, client]) => {
      if (client.companyId === companyId) {
        const isBusy = Array.from(this.activeCalls.values()).some(
          (call) =>
            (call.callerExtensionId === extensionId || call.calleeExtensionId === extensionId) &&
            call.status !== "ended"
        );

        online.push({
          extensionId,
          extension: client.extension,
          displayName: client.displayName,
          status: isBusy ? "busy" : "available",
        });
      }
    });

    return online;
  }

  async initiateCall(
    callerExtensionId: string,
    calleeExtension: string,
    sdpOffer: string
  ): Promise<{ success: boolean; callId?: string; error?: string; specialExtension?: { type: "ivr" | "queue"; queueId?: string } }> {
    const caller = this.connectedClients.get(callerExtensionId);
    if (!caller) {
      return { success: false, error: "Caller not registered" };
    }

    // Check if dialing IVR extension
    const settings = await db.query.pbxSettings.findFirst({
      where: eq(pbxSettings.companyId, caller.companyId),
    });
    
    if (settings?.ivrEnabled && settings.ivrExtension === calleeExtension) {
      console.log(`[ExtensionCall] Caller ${caller.extension} dialing IVR extension ${calleeExtension}`);
      return { 
        success: true, 
        specialExtension: { type: "ivr" } 
      };
    }

    // Check if dialing a queue extension
    const queue = await db.query.pbxQueues.findFirst({
      where: and(
        eq(pbxQueues.companyId, caller.companyId),
        eq(pbxQueues.extension, calleeExtension),
        eq(pbxQueues.status, "active")
      ),
    });

    if (queue) {
      console.log(`[ExtensionCall] Caller ${caller.extension} dialing queue extension ${calleeExtension} (${queue.name})`);
      return { 
        success: true, 
        specialExtension: { type: "queue", queueId: queue.id } 
      };
    }

    const calleeExtensionRecord = await db.query.pbxExtensions.findFirst({
      where: and(
        eq(pbxExtensions.extension, calleeExtension),
        eq(pbxExtensions.companyId, caller.companyId),
        eq(pbxExtensions.isActive, true)
      ),
    });

    if (!calleeExtensionRecord) {
      return { success: false, error: "Extension not found" };
    }

    const callee = this.connectedClients.get(calleeExtensionRecord.id);
    if (!callee) {
      return { success: false, error: "Extension offline" };
    }

    const isCalleeBusy = Array.from(this.activeCalls.values()).some(
      (call) =>
        (call.callerExtensionId === calleeExtensionRecord.id ||
          call.calleeExtensionId === calleeExtensionRecord.id) &&
        call.status !== "ended"
    );

    if (isCalleeBusy) {
      return { success: false, error: "Extension is busy" };
    }

    const callId = crypto.randomUUID();
    const call: ActiveCall = {
      id: callId,
      callerExtensionId,
      calleeExtensionId: calleeExtensionRecord.id,
      status: "ringing",
      startTime: new Date(),
    };

    this.activeCalls.set(callId, call);

    this.sendToClient(callee.ws, {
      type: "incoming_call",
      callId,
      callerExtension: caller.extension,
      callerDisplayName: caller.displayName,
      sdpOffer,
    });

    console.log(`[ExtensionCall] Call ${callId} initiated: ${caller.extension} -> ${callee.extension}`);

    return { success: true, callId };
  }

  async answerCall(
    callId: string,
    calleeExtensionId: string,
    sdpAnswer: string
  ): Promise<{ success: boolean; error?: string }> {
    const call = this.activeCalls.get(callId);
    if (!call) {
      return { success: false, error: "Call not found" };
    }

    if (call.calleeExtensionId !== calleeExtensionId) {
      return { success: false, error: "Not authorized to answer this call" };
    }

    call.status = "connected";
    call.answerTime = new Date();

    const caller = this.connectedClients.get(call.callerExtensionId);
    if (caller) {
      this.sendToClient(caller.ws, {
        type: "call_answered",
        callId,
        sdpAnswer,
      });
    }

    console.log(`[ExtensionCall] Call ${callId} answered`);

    return { success: true };
  }

  async rejectCall(
    callId: string,
    extensionId: string
  ): Promise<{ success: boolean; error?: string }> {
    const call = this.activeCalls.get(callId);
    if (!call) {
      return { success: false, error: "Call not found" };
    }

    if (call.calleeExtensionId !== extensionId && call.callerExtensionId !== extensionId) {
      return { success: false, error: "Not authorized" };
    }

    this.endCall(callId, "rejected");

    return { success: true };
  }

  relayIceCandidate(
    callId: string,
    fromExtensionId: string,
    candidate: any
  ): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    const targetExtensionId =
      fromExtensionId === call.callerExtensionId
        ? call.calleeExtensionId
        : call.callerExtensionId;

    const target = this.connectedClients.get(targetExtensionId);
    if (target) {
      this.sendToClient(target.ws, {
        type: "ice_candidate",
        callId,
        candidate,
      });
    }
  }

  endCall(callId: string, reason: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    call.status = "ended";

    const caller = this.connectedClients.get(call.callerExtensionId);
    const callee = this.connectedClients.get(call.calleeExtensionId);

    const endMessage = {
      type: "call_ended",
      callId,
      reason,
    };

    if (caller) this.sendToClient(caller.ws, endMessage);
    if (callee) this.sendToClient(callee.ws, endMessage);

    this.activeCalls.delete(callId);
    console.log(`[ExtensionCall] Call ${callId} ended: ${reason}`);
  }

  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  getCallInfo(callId: string): ActiveCall | undefined {
    return this.activeCalls.get(callId);
  }

  getClientByExtensionId(extensionId: string): ExtensionClient | undefined {
    return this.connectedClients.get(extensionId);
  }

  // ===== QUEUE CALL HANDLING (for IVR/Queue routing) =====

  /**
   * Get available agents (online + not busy) for a company
   */
  getAvailableAgentsForCompany(companyId: string): ExtensionClient[] {
    const available: ExtensionClient[] = [];
    
    console.log(`[ExtensionCall] Looking for agents in company ${companyId}`);
    console.log(`[ExtensionCall] Total connected clients: ${this.connectedClients.size}`);
    
    Array.from(this.connectedClients.values()).forEach((client) => {
      console.log(`[ExtensionCall] Client ${client.extension}: companyId=${client.companyId}, wsOpen=${client.ws.readyState === WebSocket.OPEN}`);
      
      if (client.companyId === companyId && client.ws.readyState === WebSocket.OPEN) {
        // Check if agent is busy
        const isBusy = Array.from(this.activeCalls.values()).some(
          (call) =>
            (call.callerExtensionId === client.extensionId || 
             call.calleeExtensionId === client.extensionId) &&
            call.status !== "ended"
        ) || Array.from(this.queueCalls.values()).some(
          (qc) => qc.answeredByExtensionId === client.extensionId && qc.status === "answered"
        );
        
        console.log(`[ExtensionCall] Client ${client.extension}: isBusy=${isBusy}`);
        
        if (!isBusy) {
          available.push(client);
        }
      }
    });
    
    console.log(`[ExtensionCall] Found ${available.length} available agents for company ${companyId}`);
    return available;
  }

  /**
   * Start a queue call - notify all available agents via WebSocket
   * Returns the queue call ID for tracking
   */
  startQueueCall(
    callControlId: string,
    companyId: string,
    queueId: string,
    callerNumber: string,
    ringTimeout: number = 30
  ): { success: boolean; queueCallId?: string; notifiedCount: number; error?: string } {
    const availableAgents = this.getAvailableAgentsForCompany(companyId);
    
    if (availableAgents.length === 0) {
      console.log(`[ExtensionCall] No available agents for queue call ${callControlId}`);
      return { success: false, notifiedCount: 0, error: "No agents available" };
    }

    const queueCallId = crypto.randomUUID();
    
    // Create timeout handle
    const timeoutHandle = setTimeout(() => {
      this.handleQueueCallTimeout(callControlId);
    }, ringTimeout * 1000);

    const queueCall: QueueCall = {
      id: queueCallId,
      callControlId,
      companyId,
      queueId,
      callerNumber,
      status: "ringing",
      notifiedAgents: [],
      answeredByExtensionId: null,
      ringTimeout,
      timeoutHandle,
      startTime: new Date(),
    };

    this.queueCalls.set(callControlId, queueCall);

    // Notify all available agents
    for (const agent of availableAgents) {
      this.sendToClient(agent.ws, {
        type: "queue_call_offer",
        queueCallId,
        callControlId,
        queueId,
        callerNumber,
        extensionId: agent.extensionId,
      });
      queueCall.notifiedAgents.push(agent.extensionId);
      console.log(`[ExtensionCall] Notified agent ${agent.extension} (${agent.displayName}) about queue call`);
    }

    console.log(`[ExtensionCall] Queue call ${queueCallId} started, notified ${queueCall.notifiedAgents.length} agents`);
    
    return { success: true, queueCallId, notifiedCount: queueCall.notifiedAgents.length };
  }

  /**
   * Handle agent accepting a queue call
   */
  acceptQueueCall(
    callControlId: string,
    extensionId: string
  ): { success: boolean; error?: string } {
    const queueCall = this.queueCalls.get(callControlId);
    
    if (!queueCall) {
      return { success: false, error: "Queue call not found" };
    }

    if (queueCall.status !== "ringing") {
      return { success: false, error: "Queue call already answered or ended" };
    }

    if (!queueCall.notifiedAgents.includes(extensionId)) {
      return { success: false, error: "Agent was not offered this call" };
    }

    // Mark as answered
    queueCall.status = "answered";
    queueCall.answeredByExtensionId = extensionId;

    // Clear timeout
    if (queueCall.timeoutHandle) {
      clearTimeout(queueCall.timeoutHandle);
      queueCall.timeoutHandle = null;
    }

    // Notify other agents that call was taken
    for (const agentExtId of queueCall.notifiedAgents) {
      if (agentExtId !== extensionId) {
        const agent = this.connectedClients.get(agentExtId);
        if (agent) {
          this.sendToClient(agent.ws, {
            type: "queue_call_taken",
            callControlId,
            takenByExtensionId: extensionId,
          });
        }
      }
    }

    const answeringAgent = this.connectedClients.get(extensionId);
    console.log(`[ExtensionCall] Queue call ${callControlId} accepted by ${answeringAgent?.extension || extensionId}`);

    return { success: true };
  }

  /**
   * Handle agent rejecting/declining a queue call
   */
  rejectQueueCall(
    callControlId: string,
    extensionId: string
  ): { success: boolean; remainingAgents: number } {
    const queueCall = this.queueCalls.get(callControlId);
    
    if (!queueCall || queueCall.status !== "ringing") {
      return { success: false, remainingAgents: 0 };
    }

    // Remove this agent from notified list
    queueCall.notifiedAgents = queueCall.notifiedAgents.filter(id => id !== extensionId);
    
    console.log(`[ExtensionCall] Agent ${extensionId} rejected queue call, ${queueCall.notifiedAgents.length} agents remaining`);

    return { success: true, remainingAgents: queueCall.notifiedAgents.length };
  }

  /**
   * Handle queue call timeout - no one answered
   */
  private handleQueueCallTimeout(callControlId: string): void {
    const queueCall = this.queueCalls.get(callControlId);
    
    if (!queueCall || queueCall.status !== "ringing") {
      return;
    }

    console.log(`[ExtensionCall] Queue call ${callControlId} timed out`);
    
    queueCall.status = "failed";
    
    // Notify all agents that the call timed out
    for (const agentExtId of queueCall.notifiedAgents) {
      const agent = this.connectedClients.get(agentExtId);
      if (agent) {
        this.sendToClient(agent.ws, {
          type: "queue_call_ended",
          callControlId,
          reason: "timeout",
        });
      }
    }
  }

  /**
   * End a queue call (caller hung up, etc.)
   */
  endQueueCall(callControlId: string, reason: string): void {
    const queueCall = this.queueCalls.get(callControlId);
    
    if (!queueCall) {
      return;
    }

    // Clear timeout
    if (queueCall.timeoutHandle) {
      clearTimeout(queueCall.timeoutHandle);
      queueCall.timeoutHandle = null;
    }

    // Notify all notified agents
    for (const agentExtId of queueCall.notifiedAgents) {
      const agent = this.connectedClients.get(agentExtId);
      if (agent) {
        this.sendToClient(agent.ws, {
          type: "queue_call_ended",
          callControlId,
          reason,
        });
      }
    }

    this.queueCalls.delete(callControlId);
    console.log(`[ExtensionCall] Queue call ${callControlId} ended: ${reason}`);
  }

  /**
   * Get queue call info
   */
  getQueueCall(callControlId: string): QueueCall | undefined {
    return this.queueCalls.get(callControlId);
  }

  /**
   * Check if there are any pending queue calls for an extension
   */
  getPendingQueueCallsForExtension(extensionId: string): QueueCall[] {
    const pending: QueueCall[] = [];
    
    Array.from(this.queueCalls.values()).forEach((qc) => {
      if (qc.status === "ringing" && qc.notifiedAgents.includes(extensionId)) {
        pending.push(qc);
      }
    });
    
    return pending;
  }
}

export const extensionCallService = new ExtensionCallService();
