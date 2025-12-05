import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import type { WASocket, ConnectionState, BaileysEventEmitter } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import { usePostgresAuthState } from "./postgres-auth";
import type {
  WhatsAppV2Session,
  WhatsAppV2ConnectionStatus,
  WhatsAppV2StorageInterface,
  WhatsAppV2ServiceConfig,
} from "./types";

const logger = pino({ level: "warn" });

const sessions: Map<string, WhatsAppV2Session> = new Map();

export async function initializeClient(
  storage: WhatsAppV2StorageInterface,
  config: WhatsAppV2ServiceConfig
): Promise<WASocket> {
  const { companyId, onQRCode, onConnectionUpdate, onNewMessage } = config;

  const existingSession = sessions.get(companyId);
  if (existingSession?.socket && existingSession.connectionState?.connection === "open") {
    return existingSession.socket;
  }

  const session: WhatsAppV2Session = {
    companyId,
    socket: null,
    connectionState: { connection: "close" },
    qrCode: null,
    isConnecting: true,
    lastError: null,
  };
  sessions.set(companyId, session);

  try {
    const { state, saveCreds } = await usePostgresAuthState(storage, companyId);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    session.socket = socket;

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          session.qrCode = qrDataUrl;
          onQRCode?.(qrDataUrl);
        } catch (err) {
          console.error("Failed to generate QR code:", err);
        }
      }

      if (connection) {
        session.connectionState = { connection } as ConnectionState;
        session.isConnecting = connection === "connecting";

        if (connection === "open") {
          session.qrCode = null;
          session.lastError = null;
        }

        const status = getConnectionStatus(companyId);
        onConnectionUpdate?.(status);
      }

      if (connection === "close") {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;

        if (reason === DisconnectReason.loggedOut) {
          await storage.clearAllAuthSessions(companyId);
          session.lastError = "Logged out from WhatsApp";
        } else {
          session.lastError = lastDisconnect?.error?.message || "Connection closed";
        }

        if (shouldReconnect) {
          setTimeout(() => {
            initializeClient(storage, config).catch(console.error);
          }, 3000);
        } else {
          sessions.delete(companyId);
        }
      }
    });

    return socket;
  } catch (error) {
    session.isConnecting = false;
    session.lastError = error instanceof Error ? error.message : "Unknown error";
    throw error;
  }
}

export function getSession(companyId: string): WhatsAppV2Session | null {
  return sessions.get(companyId) || null;
}

export function getSocket(companyId: string): WASocket | null {
  const session = sessions.get(companyId);
  return session?.socket || null;
}

export function getConnectionStatus(companyId: string): WhatsAppV2ConnectionStatus {
  const session = sessions.get(companyId);
  
  if (!session) {
    return {
      companyId,
      isConnected: false,
      connectionState: "close",
      qrCode: null,
      lastError: null,
      phoneNumber: null,
    };
  }

  const socket = session.socket;
  const phoneNumber = socket?.user?.id?.split(":")[0] || null;

  return {
    companyId,
    isConnected: session.connectionState?.connection === "open",
    connectionState: (session.connectionState?.connection as "close" | "connecting" | "open") || "close",
    qrCode: session.qrCode,
    lastError: session.lastError,
    phoneNumber,
  };
}

export async function disconnectClient(companyId: string): Promise<void> {
  const session = sessions.get(companyId);
  if (session?.socket) {
    session.socket.end(undefined);
    sessions.delete(companyId);
  }
}

export async function logoutClient(
  storage: WhatsAppV2StorageInterface,
  companyId: string
): Promise<void> {
  const session = sessions.get(companyId);
  if (session?.socket) {
    await session.socket.logout();
    sessions.delete(companyId);
  }
  await storage.clearAllAuthSessions(companyId);
}

export function getEventEmitter(companyId: string): BaileysEventEmitter | null {
  const socket = getSocket(companyId);
  return socket?.ev || null;
}

export function isSessionActive(companyId: string): boolean {
  const session = sessions.get(companyId);
  return session?.connectionState?.connection === "open";
}
