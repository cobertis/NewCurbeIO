# Chat Widget State Machine & Source of Truth

## Overview

This document describes the state machine, invariants, and source of truth for the Intercom-style live chat widget system.

---

## State Machine

### Conversation States

```
                                +-----------+
                                |   IDLE    | (no conversation)
                                +-----+-----+
                                      |
                           [visitor sends message]
                                      v
                                +-----------+
                                |  WAITING  | (awaiting agent)
                                +-----+-----+
                                      |
                              [agent accepts]
                                      v
                                +-----------+
                                |   OPEN    | (active chat)
                                +-----+-----+
                                     /|\
                                    / | \
          [agent solves]           /  |  \           [agent archives]
                v                 v   |   v                  v
          +-----------+    +-----------+   +-----------+
          |  SOLVED   |    |  SNOOZED  |   | ARCHIVED  |
          +-----------+    +-----------+   +-----------+
                |                |
                |   [visitor returns]
                +-------+--------+
                        |
                        v
                  +-----------+
                  |  WAITING  | (reopened)
                  +-----------+
```

### Conversation Status Transitions

| From State | To State   | Trigger                        |
|------------|------------|--------------------------------|
| IDLE       | WAITING    | Visitor sends first message    |
| WAITING    | OPEN       | Agent accepts conversation     |
| OPEN       | SOLVED     | Agent marks as solved          |
| OPEN       | SNOOZED    | Agent snoozes conversation     |
| OPEN       | ARCHIVED   | Agent archives conversation    |
| SOLVED     | WAITING    | Visitor sends new message      |
| ARCHIVED   | WAITING    | Visitor sends new message      |
| SNOOZED    | OPEN       | Snooze timer expires           |

### WebSocket Connection States

```
    +---------------+
    |  DISCONNECTED |
    +-------+-------+
            |
     [ws.connect()]
            v
    +---------------+
    |  CONNECTING   |
    +-------+-------+
            |
     [connected msg]
            v
    +---------------+
    |   CONNECTED   |<----+
    +-------+-------+     |
            |             |
     [connection lost]    |
            v             |
    +---------------+     |
    |  RECONNECTING |-----+
    +---------------+  [resync complete]
```

---

## Invariants

### Invariant A: Single Open Conversation per Device

**Rule**: Each device can only have ONE conversation with status "open" or "waiting" at any time.

**Enforcement**:
- Database: Partial unique index `telnyx_conversations_device_open_livechat_unique` on `(device_id, status, channel)` WHERE `status = 'open' AND channel = 'live_chat' AND device_id IS NOT NULL`
- Backend: Before creating a new conversation, checks for existing open/waiting conversation for the device

**Why**: Prevents "New Chat" button from creating duplicate conversations.

### Invariant B: No Duplicate Conversations

**Rule**: The same device should not create multiple conversations in rapid succession.

**Enforcement**:
- Backend: Returns existing open conversation instead of creating new one
- Backend: Catches unique constraint violations and fetches existing conversation

### Invariant C: Consistent Unread Count

**Rule**: `unreadCount` should be derived from actual unread messages, not incremented/decremented independently.

**Enforcement**:
- Backend: Uses `last_read_message_id` as source of truth when available
- Backend: `visitorLastReadAt` and `agentLastReadAt` timestamps track read status

### Invariant D: Message Idempotency

**Rule**: Sending the same message twice (network retry) should not create duplicate messages.

**Enforcement**:
- Database: Partial unique index `telnyx_messages_client_msg_conv_unique` on `(conversation_id, client_message_id)` WHERE `client_message_id IS NOT NULL`
- Backend: Checks for existing message with same `clientMessageId` before insert
- Response: Returns `{ idempotent: true }` flag when returning existing message

**Client Protocol**:
1. Generate UUID for each message: `clientMessageId = crypto.randomUUID()`
2. Include in POST request body
3. On network error, retry with SAME `clientMessageId`
4. If response has `idempotent: true`, message was already saved

### Invariant E: Safe WebSocket Reconnect

**Rule**: WebSocket reconnection should not lose messages or create duplicates.

**Enforcement**:
- Client: Tracks `lastSeenMessageId` locally
- Client: On reconnect, sends `{ type: 'resync', lastSeenMessageId }` message
- Server: Queries messages after `lastSeenMessageId` and sends `resync_complete` with missed messages
- Client: Deduplicates messages by ID before rendering

---

## Source of Truth Table

| Data                  | Source of Truth            | Location                                | Notes                                    |
|-----------------------|----------------------------|-----------------------------------------|------------------------------------------|
| Device Identity       | `deviceId` in localStorage | Key: `curbe_chat_device_{companyId}`    | Persistent per company                   |
| Conversation ID       | `sessionId` in state       | REST: `/api/messenger/bootstrap`        | Restored on page load                    |
| Conversation Status   | Database                   | `telnyx_conversations.status`           | open/waiting/solved/snoozed/archived     |
| Messages              | Database                   | `telnyx_messages` table                 | Fetched via REST/WS                      |
| Unread Count          | Database                   | `telnyx_conversations.unread_count`     | Derived from read timestamps             |
| Last Read (Visitor)   | Database                   | `telnyx_conversations.visitor_last_read_at` | Updated when visitor reads             |
| Last Read (Agent)     | Database                   | `telnyx_conversations.agent_last_read_at`   | Updated when agent reads               |
| WS Connection State   | Client Memory              | WebSocket.readyState                    | Ephemeral, not persisted                 |
| Agent Assignment      | Database                   | `telnyx_conversations.assigned_to`      | User ID of assigned agent                |
| Contact Info          | Database                   | `live_chat_devices` table               | Email, name, userId if identified        |

---

## Debug Info Schema (TraceContext)

When debugging, the "Copy Debug Info" button copies a JSON object with this schema:

```typescript
interface TraceContext {
  traceId: string;        // Unique ID for this trace event
  action: string;         // bootstrap | identify | create_session | finish_session | 
                          // list_messages | send_message | ws_connect | ws_disconnect | ws_resync
  companyId: string;      // Company UUID
  widgetId: string;       // Widget UUID
  deviceId: string;       // Device UUID (localStorage)
  contactId: string | null;      // Contact ID if identified
  conversationId: string | null; // Current session/conversation ID
  sessionId: string | null;      // Same as conversationId
  status: string | null;         // Conversation status
  lastMessageId: string | null;  // Last message ID seen
  unreadCount: number | null;    // Current unread count
  clientMessageId?: string;      // For send_message action
}
```

Log format: `[ChatWidget] action={action} traceId={traceId} companyId={companyId} ...`

---

## Sequence Diagrams

### New Visitor Flow

```
Visitor          Widget           Server              Database
   |                |                |                    |
   |  [page load]   |                |                    |
   |--------------->|                |                    |
   |                | GET /bootstrap |                    |
   |                |--------------->|                    |
   |                |                | query device       |
   |                |                |------------------->|
   |                |                |<-------------------|
   |                |<---------------|                    |
   |                | {deviceId, sessionId: null}         |
   |                |                |                    |
   |  [type msg]    |                |                    |
   |--------------->|                |                    |
   |                | POST /message  |                    |
   |                |--------------->|                    |
   |                |                | INSERT conversation|
   |                |                |------------------->|
   |                |                | INSERT message     |
   |                |                |------------------->|
   |                |<---------------|                    |
   |                | {sessionId, messageId}              |
   |  [shows chat]  |                |                    |
   |<---------------|                |                    |
```

### Reconnection with Resync

```
Visitor          Widget           WebSocket           Server
   |                |                |                   |
   |                | [connection lost]                  |
   |                |                X                   |
   |                |                                    |
   |                | [reconnect]    |                   |
   |                |--------------->|                   |
   |                |                | {connected}       |
   |                |<---------------|                   |
   |                |                |                   |
   |                | {resync, lastSeenMessageId}        |
   |                |--------------->|                   |
   |                |                | query messages    |
   |                |                |------------------>|
   |                |                |<------------------|
   |                | {resync_complete, missedMessages}  |
   |                |<---------------|                   |
   |  [show missed] |                |                   |
   |<---------------|                |                   |
```

---

## Error Handling

### Unique Constraint Violations

When a unique constraint is hit (e.g., duplicate conversation):

1. Server catches PostgreSQL error code `23505`
2. Server refetches the existing record
3. Server returns the existing record as if it was just created
4. Client receives success response (transparent retry)

### Network Errors

1. Client uses `clientMessageId` for all messages
2. On timeout/error, client retries with same `clientMessageId`
3. Server returns existing message if already saved
4. Response includes `idempotent: true` flag

---

## Database Indexes

| Index Name                                      | Columns                              | Type    | Purpose                          |
|-------------------------------------------------|--------------------------------------|---------|----------------------------------|
| `telnyx_conversations_device_open_livechat_unique` | `(device_id, status, channel)`      | Partial | Invariant A: single open conv   |
| `telnyx_messages_client_msg_conv_unique`        | `(conversation_id, client_message_id)` | Partial | Invariant D: message idempotency |
| `live_chat_devices_device_company_unique`       | `(device_id, company_id)`           | Unique  | Device identity per company      |
| `telnyx_conversations_device_id_idx`            | `(device_id)`                       | Index   | Fast device lookups              |

