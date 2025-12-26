# Chat Widget QA Test Harness

## Overview

This document provides the 7 mandatory tests that must pass before merging any chat widget changes. Tests cover Intercom-style invariants for reliable widget behavior.

---

## Test Environment Setup

1. Navigate to `/integrations/chat-widgets` in the admin dashboard
2. Click "Preview" on any widget to open the test preview page
3. Use the "Copy Debug Info" button to capture state at any point
4. Open browser DevTools for console logs and network inspection

---

## Mandatory Tests (7 Tests)

### Test 1: Reload - Same ConversationId

**Goal**: Verify that page reload returns to the same conversation

**Steps**:
1. Open widget preview
2. Start a new chat, send a message
3. Note the `conversationId` from "Copy Debug Info"
4. Reload the page (F5 or Ctrl+R)
5. Open the widget again
6. Click "Copy Debug Info" and compare `conversationId`

**Expected**: `conversationId` should be identical after reload

**Why it works**:
- `deviceId` is persisted in localStorage per company
- On reload, bootstrap fetches existing open conversation for this device
- Same `deviceId` + same company = same conversation returned

**Logs to check**:
```
[ChatWidget] action=bootstrap ... deviceId=xxx conversationId=yyy
```

---

### Test 2: Double-Click Start Chat - Only 1 Conversation

**Goal**: Verify rapid clicks don't create duplicate conversations

**Steps**:
1. Open widget preview
2. Enable Network throttling to "Slow 3G" in DevTools
3. Type a message in the chat input
4. Rapidly click the Send button 3-5 times
5. Check the database for duplicate conversations

**Expected**: Only 1 conversation should exist for this device

**Database Verification**:
```sql
SELECT id, device_id, status, created_at 
FROM telnyx_conversations 
WHERE device_id = '{deviceId}' 
  AND channel = 'live_chat'
ORDER BY created_at DESC;
-- Should return 1 open/waiting conversation
```

**Why it works**:
- Database has partial unique index `telnyx_conversations_device_open_livechat_unique`
- Backend checks for existing open conversation before creating new
- Unique constraint violations are caught and existing record is returned

---

### Test 3: Two Tabs - No Duplicates, Consistent Unread

**Goal**: Verify multi-tab behavior uses same conversation

**Steps**:
1. Open widget preview in Tab 1
2. Send a message, note the `sessionId`
3. Open widget preview in a NEW Tab 2 (same browser)
4. Check if Tab 2 shows the same conversation
5. Send a message from Tab 2
6. Check Tab 1 - message should appear via WebSocket

**Expected**:
- Both tabs share the same `deviceId` (from localStorage)
- Both tabs show the same `conversationId`
- Messages sent in one appear in both
- No duplicate messages in the conversation

**Why it works**:
- `deviceId` is stored in localStorage (shared across tabs)
- Same `deviceId` = same conversation for both tabs
- WebSocket broadcasts to all connections for a session
- Client deduplicates by message ID

---

### Test 4: WS Disconnect 10s - Resync No Lost Messages

**Goal**: Verify WebSocket reconnection recovers missed messages

**Steps**:
1. Open widget preview, start a conversation
2. In DevTools Network tab, right-click and "Block WebSocket connections"
3. Wait 10 seconds
4. From admin inbox (another tab), send a message TO this conversation
5. Unblock WebSocket connections
6. Wait for automatic reconnection

**Expected**:
- WebSocket reconnects automatically
- Missed message appears after reconnection
- No duplicate messages
- Console shows: `[LiveChat WS] Resync complete, missed messages: X`

**Console Logs to verify**:
```
[LiveChat WS] Disconnected, code: 1006
[LiveChat WS] Reconnecting in 1000ms (attempt 1/5)
[LiveChat WS] Connected successfully
[LiveChat WS] Sending resync request with lastSeenMessageId: xxx
[LiveChat WS] Resync complete, missed messages: 1
```

**Why it works**:
- Client tracks `lastSeenMessageId` for all received messages
- On reconnect, client sends `{ type: 'resync', lastSeenMessageId }`
- Server queries messages after that ID and returns them
- Client merges missed messages, deduplicating by ID

---

### Test 5: Survey - No New Conversation, Doesn't Block History

**Goal**: Verify satisfaction survey doesn't create new conversation or break reopening

**Steps**:
1. Open widget, send a message to create conversation
2. Have an agent accept and solve the conversation
3. Submit the satisfaction survey (if enabled)
4. Close the widget
5. Reopen the widget
6. Click on the solved conversation in Messages tab

**Expected**:
- Survey submission doesn't create a new conversation
- Solved conversation is still visible in Messages tab
- Clicking on it shows the full message history
- Sending a new message reopens the same conversation (status: waiting)

**Database Verification**:
```sql
SELECT id, status, satisfaction_rating, satisfaction_submitted_at
FROM telnyx_conversations 
WHERE device_id = '{deviceId}' 
ORDER BY created_at DESC;
-- Should show 1 conversation with rating data
```

**Why it works**:
- Survey is a PATCH on existing conversation, not POST creating new
- `pending_` session check prevents survey on non-existent conversations
- Reopen logic in message endpoint changes status to "waiting"

---

### Test 6: Cross-Domain Same Company - Same Conversation

**Goal**: Verify device identity is per-company, not per-domain

**Steps**:
1. Open widget on Domain A (e.g., localhost:5000)
2. Send a message, note the `deviceId` and `conversationId`
3. Open widget on Domain B (same company, e.g., different page)
4. Check the `deviceId` and `conversationId`

**Expected**:
- `deviceId` is identical across both domains (same company)
- `conversationId` is identical (same open conversation)

**Why it works**:
- `deviceId` storage key is `curbe_device_id:{companyId}` not per-widget/domain
- Same company = same localStorage key = same device identity
- Bootstrap returns existing open conversation for this device

**Console Log**:
```
[Device Identity] Created new deviceId for company: {companyId}
```

---

### Test 7: Cross-Company - Never Mix Conversations

**Goal**: Verify conversations are isolated between companies

**Steps**:
1. Set up 2 widgets from different companies
2. Open Widget A (Company A), send a message
3. Note the `companyId`, `deviceId`, `conversationId`
4. Open Widget B (Company B)
5. Check the `companyId`, `deviceId`, `conversationId`

**Expected**:
- `companyId` is different for each widget
- `deviceId` is different (scoped per company)
- `conversationId` is different (company A's conversation not visible in B)
- Messages from Company A never appear in Company B

**Why it works**:
- `deviceId` key is `curbe_device_id:{companyId}` (company-scoped)
- All database queries include `company_id` filter
- Unique index includes `device_id` (which is per-company)

**Database Verification**:
```sql
SELECT c.id, c.company_id, c.device_id
FROM telnyx_conversations c
WHERE c.device_id IN ('{deviceIdA}', '{deviceIdB}')
-- Should show different companies for different device IDs
```

---

## Automated Test Script

Save as `test-chat-widget.js` and run with Node.js:

```javascript
const BASE_URL = 'https://your-app.replit.dev';

async function runTests() {
  console.log('=== Chat Widget 7 Mandatory Tests ===\n');
  
  const widgetId = 'YOUR_WIDGET_ID';
  const deviceId = crypto.randomUUID();
  const visitorId = crypto.randomUUID();
  
  // Test 1: Create conversation and verify reload returns same
  console.log('Test 1: Reload - Same ConversationId');
  const res1 = await fetch(`${BASE_URL}/api/public/live-chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Hello',
      widgetId,
      visitorId,
      deviceId,
      clientMessageId: crypto.randomUUID()
    })
  });
  const data1 = await res1.json();
  const conversationId = data1.sessionId;
  console.log('  Created conversationId:', conversationId);
  
  // Simulate reload: bootstrap should return same conversation
  const bootstrapRes = await fetch(`${BASE_URL}/api/messenger/bootstrap?widgetId=${widgetId}&deviceId=${deviceId}`);
  const bootstrapData = await bootstrapRes.json();
  const restoredId = bootstrapData.conversations?.[0]?.id;
  
  if (restoredId === conversationId) {
    console.log('  PASS: Same conversationId after reload\n');
  } else {
    console.log('  FAIL: Different conversationId', restoredId, '\n');
  }
  
  // Test 2: Double-click protection (message idempotency)
  console.log('Test 2: Double-click - Only 1 message');
  const clientMsgId = crypto.randomUUID();
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(fetch(`${BASE_URL}/api/public/live-chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Duplicate test',
        widgetId,
        visitorId,
        deviceId,
        sessionId: conversationId,
        clientMessageId: clientMsgId
      })
    }).then(r => r.json()));
  }
  const results = await Promise.all(promises);
  const uniqueMessageIds = new Set(results.map(r => r.messageId));
  
  if (uniqueMessageIds.size === 1 && results.some(r => r.idempotent)) {
    console.log('  PASS: All 3 requests returned same messageId, idempotent detected\n');
  } else {
    console.log('  FAIL: Created multiple messages\n');
  }
  
  // Test 3: Two "tabs" using same deviceId
  console.log('Test 3: Two tabs - Same conversation');
  const tab2Res = await fetch(`${BASE_URL}/api/public/live-chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'From tab 2',
      widgetId,
      visitorId: crypto.randomUUID(), // Different visitorId
      deviceId, // Same deviceId
      clientMessageId: crypto.randomUUID()
    })
  });
  const tab2Data = await tab2Res.json();
  
  if (tab2Data.sessionId === conversationId) {
    console.log('  PASS: Same conversation for same deviceId\n');
  } else {
    console.log('  FAIL: Different conversation created\n');
  }
  
  // Test 7: Cross-company isolation
  console.log('Test 7: Cross-company - Never mix');
  const deviceIdCompanyB = crypto.randomUUID();
  // This would require a different widgetId from a different company
  console.log('  Manual test required - need widget from different company\n');
  
  console.log('=== Tests Complete ===');
  console.log('Note: Tests 4-6 require manual testing with browser DevTools');
}

runTests().catch(console.error);
```

---

## Invariants Reference

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| A | Single open conversation per device | Partial unique index + backend check |
| B-C | No duplicate conversations | Check + create pattern |
| D | Message idempotency | `clientMessageId` + unique index |
| E | Safe WebSocket resync | `lastSeenMessageId` + server query |

---

## Debug Checklist

When issues occur:

1. **Console logs**: Look for `[ChatWidget]`, `[LiveChat]`, `[Device Identity]` prefixes
2. **Network tab**: Check `/api/public/live-chat/*` requests/responses
3. **localStorage**: Check `curbe_device_id:{companyId}` key
4. **Copy Debug Info**: Use button to get full state snapshot
5. **Database**: Query `telnyx_conversations` and `telnyx_messages`

---

## Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Different conversation after reload | deviceId not persisted | Check localStorage key |
| Duplicate messages on retry | Missing clientMessageId | Ensure client sends UUID |
| Messages lost on WS disconnect | Resync not working | Check lastSeenMessageId tracking |
| Wrong company's messages | Widget/company mismatch | Verify widgetId matches companyId |
| Survey creates new conversation | Sending to pending session | Check sessionId is not "pending_" |
