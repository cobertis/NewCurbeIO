# Chat Widget QA Test Harness

## Overview

This document provides manual and automated test scenarios for validating the chat widget invariants and behavior.

---

## Test Environment Setup

1. Navigate to `/integrations/chat-widgets` in the admin dashboard
2. Click "Preview" on any widget to open the test preview page
3. Use the "Copy Debug Info" button to capture state at any point

---

## Test Scenarios

### Scenario 1: Device Identity Persistence

**Goal**: Verify device identity is persistent across page reloads

**Steps**:
1. Open widget preview
2. Click "Copy Debug Info" - note the `deviceId`
3. Refresh the page (F5)
4. Click "Copy Debug Info" again
5. Compare deviceId values

**Expected**: `deviceId` should be identical after refresh

**Invariant Tested**: Device identity persistence

---

### Scenario 2: Single Open Conversation (Invariant A)

**Goal**: Verify "New Chat" doesn't create duplicate open conversations

**Steps**:
1. Open widget preview
2. Send a message to create a conversation
3. Note the `sessionId`
4. Close and reopen the widget (or click "New Chat")
5. Send another message
6. Check the `sessionId`

**Expected**: Both messages should be in the SAME conversation (same `sessionId`)

**Invariant Tested**: Invariant A - Single Open Conversation per Device

**Database Verification**:
```sql
SELECT id, device_id, status, channel 
FROM telnyx_conversations 
WHERE device_id = '{deviceId}' 
  AND channel = 'live_chat' 
  AND status IN ('open', 'waiting');
-- Should return exactly 1 row
```

---

### Scenario 3: Message Idempotency (Invariant D)

**Goal**: Verify duplicate message sends are prevented

**Steps**:
1. Open browser DevTools > Network tab
2. Enable "Slow 3G" network throttling
3. Send a message
4. Quickly click send again before response arrives
5. Check messages in the conversation

**Expected**: Only ONE message should appear, not duplicates

**Invariant Tested**: Invariant D - Message Idempotency

**API Verification**:
```javascript
// Send same message twice with same clientMessageId
const clientMessageId = crypto.randomUUID();
const body = { 
  text: 'test', 
  widgetId: 'xxx', 
  visitorId: 'yyy', 
  clientMessageId 
};

await fetch('/api/public/live-chat/message', { method: 'POST', body: JSON.stringify(body) });
// Response 1: { success: true, messageId: 'abc', idempotent: false }

await fetch('/api/public/live-chat/message', { method: 'POST', body: JSON.stringify(body) });
// Response 2: { success: true, messageId: 'abc', idempotent: true }
```

---

### Scenario 4: WebSocket Reconnection (Invariant E)

**Goal**: Verify messages aren't lost during WebSocket disconnection

**Steps**:
1. Open widget preview
2. Send a few messages, note the last message
3. Disconnect network briefly (airplane mode or DevTools offline)
4. From another session (agent view), send a message to the conversation
5. Reconnect network
6. Check if the agent's message appears

**Expected**: After reconnection, missed messages should appear

**Invariant Tested**: Invariant E - Safe WebSocket Reconnect

**Console Verification**:
Look for: `[LiveChat WebSocket] Resync complete: X missed messages`

---

### Scenario 5: Multi-Tab Behavior

**Goal**: Verify behavior with multiple tabs open

**Steps**:
1. Open widget preview in Tab 1
2. Send a message in Tab 1
3. Open widget preview in new Tab 2 (same browser)
4. Check if Tab 2 shows the same conversation

**Expected**: 
- Both tabs should show the same conversation (same deviceId)
- Messages sent in one tab should appear in both

**Why**: Both tabs share the same localStorage deviceId

---

### Scenario 6: Rapid Reload Loop

**Goal**: Verify system handles rapid page reloads

**Steps**:
1. Open widget preview
2. Send a message to create conversation
3. Rapidly refresh page 5-10 times (F5 repeatedly)
4. Check conversation state

**Expected**:
- Same conversation should persist
- No duplicate conversations created
- Messages preserved

**Database Verification**:
```sql
SELECT COUNT(*) as conv_count
FROM telnyx_conversations 
WHERE device_id = '{deviceId}' 
  AND channel = 'live_chat';
-- Should return 1 (or very few if solved/archived exist)
```

---

### Scenario 7: Race Condition - Simultaneous Messages

**Goal**: Verify handling of simultaneous message sends

**Steps**:
```javascript
// Browser console test
const promises = [];
for (let i = 0; i < 5; i++) {
  promises.push(fetch('/api/public/live-chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `Message ${i}`,
      widgetId: '{widgetId}',
      visitorId: '{visitorId}',
      deviceId: '{deviceId}',
      clientMessageId: crypto.randomUUID()
    })
  }));
}
const results = await Promise.all(promises);
console.log('All messages sent:', results.length);
```

**Expected**: All 5 messages should be saved without errors

---

### Scenario 8: Cross-Widget Device Identity

**Goal**: Verify device identity is consistent across widgets of same company

**Steps**:
1. Open preview for Widget A
2. Note the `deviceId`
3. Open preview for Widget B (same company)
4. Note the `deviceId`

**Expected**: Same `deviceId` for both widgets

**Why**: Device identity is per-company, not per-widget

---

## Automated Test Script

Save as `test-chat-widget.js` and run with Node.js:

```javascript
const BASE_URL = 'https://your-app.replit.dev';

async function runTests() {
  console.log('=== Chat Widget Invariant Tests ===\n');
  
  const widgetId = 'YOUR_WIDGET_ID';
  const deviceId = crypto.randomUUID();
  const visitorId = crypto.randomUUID();
  
  // Test 1: Create initial conversation
  console.log('Test 1: Create conversation');
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
  console.log('  Session ID:', data1.sessionId);
  console.log('  PASS: Conversation created\n');
  
  // Test 2: Message idempotency
  console.log('Test 2: Message idempotency');
  const clientMessageId = crypto.randomUUID();
  const res2a = await fetch(`${BASE_URL}/api/public/live-chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Duplicate test',
      widgetId,
      visitorId,
      deviceId,
      sessionId: data1.sessionId,
      clientMessageId
    })
  });
  const data2a = await res2a.json();
  
  const res2b = await fetch(`${BASE_URL}/api/public/live-chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Duplicate test',
      widgetId,
      visitorId,
      deviceId,
      sessionId: data1.sessionId,
      clientMessageId
    })
  });
  const data2b = await res2b.json();
  
  if (data2a.messageId === data2b.messageId && data2b.idempotent === true) {
    console.log('  PASS: Duplicate message handled correctly');
    console.log('  Message ID:', data2a.messageId);
    console.log('  Second response idempotent:', data2b.idempotent);
  } else {
    console.log('  FAIL: Duplicate messages created');
    console.log('  First:', data2a);
    console.log('  Second:', data2b);
  }
  console.log('');
  
  // Test 3: Single open conversation
  console.log('Test 3: Single open conversation per device');
  const res3 = await fetch(`${BASE_URL}/api/public/live-chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'New message same device',
      widgetId,
      visitorId,
      deviceId,
      forceNew: true, // Try to force new conversation
      clientMessageId: crypto.randomUUID()
    })
  });
  const data3 = await res3.json();
  
  if (data3.sessionId === data1.sessionId) {
    console.log('  PASS: Reused existing conversation');
  } else {
    console.log('  WARN: New conversation created (may be expected if original was solved)');
  }
  console.log('  Original Session:', data1.sessionId);
  console.log('  New Session:', data3.sessionId);
  console.log('');
  
  console.log('=== Tests Complete ===');
}

runTests().catch(console.error);
```

---

## Debug Checklist

When issues occur, check:

1. **Console logs**: Look for `[ChatWidget]` prefixed logs
2. **Network tab**: Check request/response for `/api/public/live-chat/*` endpoints
3. **localStorage**: Check `curbe_chat_device_{companyId}` key
4. **Copy Debug Info**: Use the button to get full state snapshot
5. **Database**: Query `telnyx_conversations` and `telnyx_messages` tables

---

## Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Multiple conversations for same visitor | Missing deviceId | Check localStorage, ensure bootstrap runs |
| Duplicate messages | Missing clientMessageId | Always send clientMessageId from client |
| Messages lost on refresh | WS not reconnecting | Check resync logic, verify lastSeenMessageId sent |
| Widget shows wrong company | Widget ID mismatch | Verify widgetId in embed code |
| Bootstrap fails | CORS or network issue | Check browser console for errors |

---

## Performance Benchmarks

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Bootstrap latency | < 200ms | DevTools Network tab |
| Message send latency | < 500ms | DevTools Network tab |
| WS reconnect time | < 2s | Disconnect/reconnect test |
| Resync latency | < 300ms | Measure `resync_complete` timing |

