import type { WASocket, BaileysEventMap, proto } from "@whiskeysockets/baileys";
import type {
  WhatsAppV2StorageInterface,
  InsertWhatsappV2Contact,
  InsertWhatsappV2Chat,
  InsertWhatsappV2Message,
  SelectWhatsappV2Message,
} from "./types";
import {
  extractPhoneFromJid,
  isGroupJid,
  getMessageType,
  extractTextContent,
  MESSAGE_STATUS,
} from "./types";

export function setupEventHandlers(
  socket: WASocket,
  storage: WhatsAppV2StorageInterface,
  companyId: string,
  onNewMessage?: (message: SelectWhatsappV2Message) => void
): void {
  socket.ev.on("chats.set", async ({ chats: chatList }) => {
    console.log(`[WhatsApp] Syncing ${chatList.length} chats for company ${companyId}`);
    
    for (const chatItem of chatList) {
      if (!chatItem.id) continue;

      try {
        const existingChat = await storage.getChat(companyId, chatItem.id);
        if (existingChat) continue;

        const isGroup = isGroupJid(chatItem.id);
        const phone = extractPhoneFromJid(chatItem.id);

        let contact = await storage.getContact(companyId, chatItem.id);
        if (!contact && !isGroup && phone) {
          const contactData: InsertWhatsappV2Contact = {
            companyId,
            jid: chatItem.id,
            name: chatItem.name || phone,
            businessName: null,
            avatarUrl: null,
            isBusiness: false,
            phone,
          };
          contact = await storage.upsertContact(contactData);
        }

        const chatData: InsertWhatsappV2Chat = {
          companyId,
          jid: chatItem.id,
          contactId: contact?.id || null,
          title: isGroup ? (chatItem.name || chatItem.id) : null,
          isGroup,
          unreadCount: chatItem.unreadCount || 0,
          lastMessageId: null,
          lastMessageTs: chatItem.conversationTimestamp 
            ? typeof chatItem.conversationTimestamp === 'number' 
              ? chatItem.conversationTimestamp 
              : Number(chatItem.conversationTimestamp)
            : null,
          archived: chatItem.archived || false,
          mutedUntil: null,
        };

        await storage.upsertChat(chatData);
      } catch (error) {
        console.error("Failed to sync chat:", error);
      }
    }
    
    console.log(`[WhatsApp] Chat sync complete for company ${companyId}`);
  });

  socket.ev.on("messaging-history.set", async ({ chats: historyChats, messages: historyMessages, isLatest }) => {
    console.log(`[WhatsApp] History sync: ${historyChats?.length || 0} chats, ${historyMessages?.length || 0} messages, isLatest: ${isLatest}`);
    
    if (historyChats) {
      for (const chatItem of historyChats) {
        if (!chatItem.id) continue;

        try {
          const existingChat = await storage.getChat(companyId, chatItem.id);
          if (existingChat) continue;

          const isGroup = isGroupJid(chatItem.id);
          const phone = extractPhoneFromJid(chatItem.id);

          let contact = await storage.getContact(companyId, chatItem.id);
          if (!contact && !isGroup && phone) {
            const contactData: InsertWhatsappV2Contact = {
              companyId,
              jid: chatItem.id,
              name: chatItem.name || phone,
              businessName: null,
              avatarUrl: null,
              isBusiness: false,
              phone,
            };
            contact = await storage.upsertContact(contactData);
          }

          const chatData: InsertWhatsappV2Chat = {
            companyId,
            jid: chatItem.id,
            contactId: contact?.id || null,
            title: isGroup ? (chatItem.name || chatItem.id) : null,
            isGroup,
            unreadCount: chatItem.unreadCount || 0,
            lastMessageId: null,
            lastMessageTs: chatItem.conversationTimestamp 
              ? typeof chatItem.conversationTimestamp === 'number' 
                ? chatItem.conversationTimestamp 
                : Number(chatItem.conversationTimestamp)
              : null,
            archived: chatItem.archived || false,
            mutedUntil: null,
          };

          await storage.upsertChat(chatData);
        } catch (error) {
          console.error("Failed to sync history chat:", error);
        }
      }
    }

    if (historyMessages) {
      for (const msg of historyMessages) {
        if (!msg.key || !msg.key.remoteJid || !msg.message) continue;

        const remoteJid = msg.key.remoteJid;
        const messageKey = msg.key.id || "";
        const fromMe = msg.key.fromMe || false;
        const timestamp = msg.messageTimestamp
          ? typeof msg.messageTimestamp === "number"
            ? msg.messageTimestamp
            : Number(msg.messageTimestamp)
          : Math.floor(Date.now() / 1000);

        try {
          const existingMessage = await storage.getMessage(companyId, messageKey);
          if (existingMessage) continue;

          let chat = await storage.getChat(companyId, remoteJid);
          if (!chat) {
            const isGroup = isGroupJid(remoteJid);
            const phone = extractPhoneFromJid(remoteJid);

            let contact = await storage.getContact(companyId, remoteJid);
            if (!contact && !isGroup && phone) {
              const contactData: InsertWhatsappV2Contact = {
                companyId,
                jid: remoteJid,
                name: msg.pushName || phone,
                businessName: null,
                avatarUrl: null,
                isBusiness: false,
                phone,
              };
              contact = await storage.upsertContact(contactData);
            }

            const chatData: InsertWhatsappV2Chat = {
              companyId,
              jid: remoteJid,
              contactId: contact?.id || null,
              title: isGroup ? remoteJid : null,
              isGroup,
              unreadCount: fromMe ? 0 : 1,
              lastMessageId: null,
              lastMessageTs: timestamp,
              archived: false,
              mutedUntil: null,
            };

            chat = await storage.upsertChat(chatData);
          }

          const messageType = getMessageType(msg.message);
          const textContent = extractTextContent(msg.message);

          const messageData: InsertWhatsappV2Message = {
            companyId,
            chatId: chat.id,
            messageKey,
            remoteJid,
            fromMe,
            content: textContent,
            messageData: msg as unknown as Record<string, unknown>,
            messageType,
            status: fromMe ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.DELIVERED,
            mediaUrl: null,
            mediaMimeType: null,
            timestamp,
          };

          const savedMessage = await storage.insertMessage(messageData);
          await storage.updateChatLastMessage(chat.id, savedMessage.id, timestamp);
        } catch (error) {
          console.error("Failed to sync history message:", error);
        }
      }
    }
  });

  socket.ev.on("chats.upsert", async (chats) => {
    console.log(`[WhatsApp] chats.upsert: ${chats.length} chats for company ${companyId}`);
    
    for (const chatItem of chats) {
      if (!chatItem.id) continue;

      try {
        const existingChat = await storage.getChat(companyId, chatItem.id);
        if (existingChat) continue;

        const isGroup = isGroupJid(chatItem.id);
        const phone = extractPhoneFromJid(chatItem.id);

        let contact = await storage.getContact(companyId, chatItem.id);
        if (!contact && !isGroup && phone) {
          const contactData: InsertWhatsappV2Contact = {
            companyId,
            jid: chatItem.id,
            name: chatItem.name || phone,
            businessName: null,
            avatarUrl: null,
            isBusiness: false,
            phone,
          };
          contact = await storage.upsertContact(contactData);
        }

        const chatData: InsertWhatsappV2Chat = {
          companyId,
          jid: chatItem.id,
          contactId: contact?.id || null,
          title: isGroup ? (chatItem.name || chatItem.id) : null,
          isGroup,
          unreadCount: chatItem.unreadCount || 0,
          lastMessageId: null,
          lastMessageTs: chatItem.conversationTimestamp 
            ? typeof chatItem.conversationTimestamp === 'number' 
              ? chatItem.conversationTimestamp 
              : Number(chatItem.conversationTimestamp)
            : null,
          archived: chatItem.archived || false,
          mutedUntil: null,
        };

        await storage.upsertChat(chatData);
        console.log(`[WhatsApp] Created chat from upsert: ${chatItem.id}`);
      } catch (error) {
        console.error("Failed to create chat from upsert:", error);
      }
    }
  });

  socket.ev.on("contacts.upsert", async (contacts) => {
    for (const contact of contacts) {
      if (!contact.id) continue;

      const phone = extractPhoneFromJid(contact.id);
      if (!phone) continue;

      const contactData: InsertWhatsappV2Contact = {
        companyId,
        jid: contact.id,
        name: contact.name || contact.notify || phone,
        businessName: null,
        avatarUrl: null,
        isBusiness: false,
        phone,
      };

      try {
        await storage.upsertContact(contactData);
      } catch (error) {
        console.error("Failed to upsert contact:", error);
      }
    }
  });

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;

    for (const msg of messages) {
      if (!msg.key || !msg.key.remoteJid || !msg.message) continue;

      const remoteJid = msg.key.remoteJid;
      const messageKey = msg.key.id || "";
      const fromMe = msg.key.fromMe || false;
      const timestamp = msg.messageTimestamp
        ? typeof msg.messageTimestamp === "number"
          ? msg.messageTimestamp
          : Number(msg.messageTimestamp)
        : Math.floor(Date.now() / 1000);

      try {
        let chat = await storage.getChat(companyId, remoteJid);
        
        if (!chat) {
          const isGroup = isGroupJid(remoteJid);
          const phone = extractPhoneFromJid(remoteJid);

          let contact = await storage.getContact(companyId, remoteJid);
          if (!contact && !isGroup) {
            const contactData: InsertWhatsappV2Contact = {
              companyId,
              jid: remoteJid,
              name: msg.pushName || phone,
              businessName: null,
              avatarUrl: null,
              isBusiness: false,
              phone,
            };
            contact = await storage.upsertContact(contactData);
          }

          const chatData: InsertWhatsappV2Chat = {
            companyId,
            jid: remoteJid,
            contactId: contact?.id || null,
            title: isGroup ? (msg.key.remoteJid || null) : null,
            isGroup,
            unreadCount: fromMe ? 0 : 1,
            lastMessageId: null,
            lastMessageTs: timestamp,
            archived: false,
            mutedUntil: null,
          };

          chat = await storage.upsertChat(chatData);
        }

        const existingMessage = await storage.getMessage(companyId, messageKey);
        if (existingMessage) continue;

        const messageType = getMessageType(msg.message);
        const textContent = extractTextContent(msg.message);

        const messageData: InsertWhatsappV2Message = {
          companyId,
          chatId: chat.id,
          messageKey,
          remoteJid,
          fromMe,
          content: textContent,
          messageData: msg as unknown as Record<string, unknown>,
          messageType,
          status: fromMe ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.DELIVERED,
          mediaUrl: null,
          mediaMimeType: null,
          timestamp,
        };

        const savedMessage = await storage.insertMessage(messageData);

        await storage.updateChatLastMessage(chat.id, savedMessage.id, timestamp);

        if (!fromMe) {
          await storage.updateChatUnreadCount(chat.id, (chat.unreadCount || 0) + 1);
        }

        onNewMessage?.(savedMessage);
      } catch (error) {
        console.error("Failed to process message:", error);
      }
    }
  });

  socket.ev.on("messages.update", async (updates) => {
    for (const update of updates) {
      if (!update.key?.id || !update.update) continue;

      const messageKey = update.key.id;
      const statusUpdate = update.update.status;

      if (statusUpdate !== undefined) {
        let status: string = "sent";
        switch (statusUpdate) {
          case 2:
            status = "sent";
            break;
          case 3:
            status = "delivered";
            break;
          case 4:
            status = "read";
            break;
          case 5:
            status = "failed";
            break;
        }

        try {
          await storage.updateMessageStatus(companyId, messageKey, status);
        } catch (error) {
          console.error("Failed to update message status:", error);
        }
      }
    }
  });

  socket.ev.on("chats.update", async (chats) => {
    for (const chatUpdate of chats) {
      if (!chatUpdate.id) continue;

      try {
        const chat = await storage.getChat(companyId, chatUpdate.id);
        if (!chat) continue;

        if (chatUpdate.unreadCount !== undefined && chatUpdate.unreadCount !== null) {
          await storage.updateChatUnreadCount(chat.id, chatUpdate.unreadCount);
        }
      } catch (error) {
        console.error("Failed to update chat:", error);
      }
    }
  });
}

export async function sendTextMessage(
  socket: WASocket,
  storage: WhatsAppV2StorageInterface,
  companyId: string,
  jid: string,
  text: string
): Promise<SelectWhatsappV2Message> {
  const result = await socket.sendMessage(jid, { text });

  if (!result?.key?.id) {
    throw new Error("Failed to send message");
  }

  let chat = await storage.getChat(companyId, jid);
  if (!chat) {
    const isGroup = isGroupJid(jid);
    const phone = extractPhoneFromJid(jid);

    let contact = await storage.getContact(companyId, jid);
    if (!contact && !isGroup) {
      const contactData: InsertWhatsappV2Contact = {
        companyId,
        jid,
        name: phone,
        businessName: null,
        avatarUrl: null,
        isBusiness: false,
        phone,
      };
      contact = await storage.upsertContact(contactData);
    }

    const chatData: InsertWhatsappV2Chat = {
      companyId,
      jid,
      contactId: contact?.id || null,
      title: isGroup ? jid : null,
      isGroup,
      unreadCount: 0,
      lastMessageId: null,
      lastMessageTs: null,
      archived: false,
      mutedUntil: null,
    };

    chat = await storage.upsertChat(chatData);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const messageData: InsertWhatsappV2Message = {
    companyId,
    chatId: chat.id,
    messageKey: result.key.id,
    remoteJid: jid,
    fromMe: true,
    content: text,
    messageData: result as unknown as Record<string, unknown>,
    messageType: "text",
    status: MESSAGE_STATUS.SENT,
    mediaUrl: null,
    mediaMimeType: null,
    timestamp,
  };

  const savedMessage = await storage.insertMessage(messageData);
  await storage.updateChatLastMessage(chat.id, savedMessage.id, timestamp);

  return savedMessage;
}

export async function markChatAsRead(
  socket: WASocket,
  storage: WhatsAppV2StorageInterface,
  companyId: string,
  jid: string
): Promise<void> {
  const chat = await storage.getChat(companyId, jid);
  if (!chat) return;

  await socket.readMessages([{ remoteJid: jid, id: chat.lastMessageId || "" }]);
  await storage.updateChatUnreadCount(chat.id, 0);
}
