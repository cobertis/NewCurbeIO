import { db } from "../db";
import { pbxExtensions, users } from "@shared/schema";
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

class ExtensionCallService {
  private connectedClients: Map<string, ExtensionClient> = new Map();
  private activeCalls: Map<string, ActiveCall> = new Map();

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
      this.connectedClients.delete(extensionId);
      console.log(`[ExtensionCall] Extension ${client.extension} unregistered`);

      Array.from(this.activeCalls.entries()).forEach(([callId, call]) => {
        if (call.callerExtensionId === extensionId || call.calleeExtensionId === extensionId) {
          this.endCall(callId, "disconnect");
        }
      });
    }
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
  ): Promise<{ success: boolean; callId?: string; error?: string }> {
    const caller = this.connectedClients.get(callerExtensionId);
    if (!caller) {
      return { success: false, error: "Caller not registered" };
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
}

export const extensionCallService = new ExtensionCallService();
