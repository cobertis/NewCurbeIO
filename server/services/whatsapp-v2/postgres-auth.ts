import { BufferJSON, initAuthCreds, proto } from "@whiskeysockets/baileys";
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from "@whiskeysockets/baileys";
import type { WhatsAppV2StorageInterface } from "./types";

const CREDS_KEY = "creds";

export async function usePostgresAuthState(
  storage: WhatsAppV2StorageInterface,
  companyId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  
  const writeData = async (key: string, data: any): Promise<void> => {
    const serialized = JSON.stringify(data, BufferJSON.replacer);
    await storage.setAuthSession({
      companyId,
      sessionId: key,
      data: JSON.parse(serialized),
    });
  };

  const readData = async (key: string): Promise<any | null> => {
    const session = await storage.getAuthSession(companyId, key);
    if (!session) return null;
    return JSON.parse(JSON.stringify(session.data), BufferJSON.reviver);
  };

  const removeData = async (key: string): Promise<void> => {
    await storage.deleteAuthSession(companyId, key);
  };

  const creds: AuthenticationCreds = (await readData(CREDS_KEY)) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[]
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          await Promise.all(
            ids.map(async (id) => {
              const key = `${type}-${id}`;
              const value = await readData(key);
              if (value) {
                if (type === "app-state-sync-key" && value.keyData) {
                  data[id] = proto.Message.AppStateSyncKeyData.fromObject(value) as unknown as SignalDataTypeMap[T];
                } else {
                  data[id] = value;
                }
              }
            })
          );
          return data;
        },
        set: async (data: { [key: string]: { [id: string]: any } }): Promise<void> => {
          const tasks: Promise<void>[] = [];
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) {
              const key = `${type}-${id}`;
              if (value) {
                tasks.push(writeData(key, value));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async (): Promise<void> => {
      await writeData(CREDS_KEY, creds);
    },
  };
}
