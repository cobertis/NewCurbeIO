# Campaign Orchestrator Blueprint

**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** 2026-01-10  

---

## A) Vision and Objectives

### Vision
The Campaign Orchestrator is a multi-channel outreach automation system that intelligently sequences communications across SMS, iMessage, WhatsApp, Voice, Voicemail, and RVM (Ringless Voicemail) to maximize engagement while respecting compliance rules, carrier limits, and customer preferences.

### Core Principles

1. **Policy Engine First**: A deterministic policy engine enforces all hard rules (opt-outs, caps, quiet hours) before any action is taken. AI may recommend, but policy decides.

2. **Channel Agnostic**: The system treats all channels uniformly through a normalized event model, allowing seamless orchestration across SMS, iMessage, WhatsApp, Voice, Voicemail, and RVM.

3. **Compliance by Design**: Stop rules, opt-out handling, and TCPA/carrier compliance are non-negotiable hard constraints, not suggestions.

4. **Audit Everything**: Every decision, state change, and action is logged for compliance review and debugging.

5. **Cost Awareness**: Each action carries a cost estimate, enabling budget-aware campaign optimization.

### Objectives

| Objective | Success Metric |
|-----------|----------------|
| Increase contact engagement rate | 25% improvement over manual outreach |
| Reduce compliance incidents | Zero opt-out violations |
| Optimize channel selection | 15% cost reduction through smart routing |
| Minimize human intervention | 80% of contacts handled autonomously |
| Enable multi-timezone campaigns | Support for all US timezones with local quiet hours |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Campaign Orchestrator                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Scheduler  │  │ Policy Engine│  │   AI Recommender     │  │
│  │   (Worker)   │──│ (Deterministic)│──│   (Suggestions)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                 │                      │              │
│         ▼                 ▼                      ▼              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Channel Router                        │   │
│  │  ┌─────┐ ┌────────┐ ┌────────┐ ┌─────┐ ┌────┐ ┌─────┐  │   │
│  │  │ SMS │ │iMessage│ │WhatsApp│ │Voice│ │ VM │ │ RVM │  │   │
│  │  └─────┘ └────────┘ └────────┘ └─────┘ └────┘ └─────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Event Processor                       │   │
│  │         (Webhook handlers, status updates)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Audit Logger                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## B) Contact States

Each contact in a campaign has exactly one state at any time. State transitions are triggered by normalized events.

| State | Description | Allowed Transitions |
|-------|-------------|---------------------|
| `NEW` | Contact added to campaign, not yet attempted | → ATTEMPTING |
| `ATTEMPTING` | Active outreach in progress | → ENGAGED, UNREACHABLE, STOPPED, DO_NOT_CONTACT |
| `ENGAGED` | Contact has responded (reply, answered call) | → QUALIFIED, NOT_INTERESTED, STOPPED, DO_NOT_CONTACT |
| `QUALIFIED` | Contact shows interest, ready for handoff | → BOOKED, NOT_INTERESTED, STOPPED |
| `BOOKED` | Appointment scheduled or goal achieved | Terminal (success) |
| `NOT_INTERESTED` | Explicit decline without opt-out | Terminal |
| `STOPPED` | Campaign stopped for this contact (manual or max attempts) | Terminal |
| `UNREACHABLE` | All channels exhausted, no response | Terminal |
| `DO_NOT_CONTACT` | Opt-out received, compliance block | Terminal (hard block) |

### State Transition Diagram

```
                    ┌─────────────────────────────────┐
                    │              NEW                │
                    └─────────────┬───────────────────┘
                                  │ first_action
                                  ▼
                    ┌─────────────────────────────────┐
           ┌───────│          ATTEMPTING              │───────┐
           │       └─────────────┬───────────────────┘        │
           │                     │ reply/answer               │
           │                     ▼                            │
           │       ┌─────────────────────────────────┐        │
           │       │           ENGAGED               │        │
           │       └─────────────┬───────────────────┘        │
           │                     │                            │
           │         ┌───────────┴───────────┐                │
           │         ▼                       ▼                │
           │  ┌──────────────┐      ┌────────────────┐        │
           │  │  QUALIFIED   │      │ NOT_INTERESTED │        │
           │  └──────┬───────┘      └────────────────┘        │
           │         │                                        │
           │         ▼                                        │
           │  ┌──────────────┐                                │
           │  │    BOOKED    │                                │
           │  └──────────────┘                                │
           │                                                  │
           │  max_attempts                          opt_out   │
           ▼                                                  ▼
    ┌──────────────┐                              ┌───────────────────┐
    │ UNREACHABLE  │                              │  DO_NOT_CONTACT   │
    └──────────────┘                              └───────────────────┘
           ▲                                              ▲
           │                      manual_stop             │
           │                          │                   │
           │       ┌──────────────────┴───────────────┐   │
           └───────│            STOPPED               │───┘
                   └──────────────────────────────────┘
```

---

## C) Normalized Events

All channel-specific events are mapped to these normalized event types for uniform processing.

| Event | Source Channels | Description | State Impact |
|-------|-----------------|-------------|--------------|
| `MESSAGE_SENT` | SMS, iMessage, WhatsApp | Message dispatched to carrier/provider | None (pending) |
| `MESSAGE_DELIVERED` | SMS, iMessage, WhatsApp | Delivery confirmation received | None |
| `MESSAGE_FAILED` | SMS, iMessage, WhatsApp | Permanent delivery failure | Increment fail_count |
| `MESSAGE_REPLIED` | SMS, iMessage, WhatsApp | Inbound reply from contact | → ENGAGED |
| `CALL_PLACED` | Voice | Outbound call initiated | None (pending) |
| `CALL_ANSWERED` | Voice | Contact answered call | → ENGAGED |
| `CALL_NO_ANSWER` | Voice | Call rang but not answered | Increment attempt_count |
| `CALL_BUSY` | Voice | Line busy | Increment attempt_count |
| `CALL_FAILED` | Voice | Call could not be placed | Increment fail_count |
| `VOICEMAIL_DROPPED` | Voicemail | Live voicemail left | Increment attempt_count |
| `RVM_DROPPED` | RVM | Ringless voicemail delivered | Increment attempt_count |
| `RVM_FAILED` | RVM | RVM delivery failed | Increment fail_count |
| `OPT_OUT` | All | STOP/unsubscribe detected | → DO_NOT_CONTACT |
| `COMPLAINT` | All | Spam report or carrier complaint | → DO_NOT_CONTACT + flag |
| `MANUAL_STOP` | System | Agent manually stopped contact | → STOPPED |
| `TIMEOUT` | System | No action/response within window | Varies |

### Event Payload Schema

```json
{
  "event_id": "uuid",
  "event_type": "MESSAGE_REPLIED",
  "campaign_id": "uuid",
  "campaign_contact_id": "uuid",
  "contact_id": "uuid",
  "channel": "sms",
  "timestamp": "2026-01-10T15:30:00Z",
  "payload": {
    "message_id": "twilio_sid_xxx",
    "direction": "inbound",
    "body": "Yes, I'm interested",
    "from": "+15551234567",
    "to": "+15559876543"
  },
  "metadata": {
    "provider": "twilio",
    "raw_status": "received"
  }
}
```

---

## D) Stop Rules (Hard Rules)

These rules are **non-negotiable** and enforced by the Policy Engine before any action.

### 1. Opt-Out Detection

**Trigger:** Inbound message matches opt-out keywords  
**Keywords:** `STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`, `OPTOUT`, `OPT-OUT`  
**Action:**
1. Immediately set state → `DO_NOT_CONTACT`
2. Cancel all pending scheduled actions
3. Add to suppression list (company-wide)
4. Send compliance confirmation if required by channel

```json
{
  "rule": "opt_out",
  "trigger": "keyword_match",
  "action": "block_all",
  "state_transition": "DO_NOT_CONTACT",
  "notification": "compliance_team"
}
```

### 2. Complaint Handling

**Trigger:** Carrier spam report or complaint webhook  
**Action:**
1. Immediately set state → `DO_NOT_CONTACT`
2. Flag contact as `high_risk`
3. Log for compliance review
4. Pause campaign if complaint rate > 0.1%

```json
{
  "rule": "complaint",
  "trigger": "webhook_complaint",
  "action": "block_all_and_flag",
  "state_transition": "DO_NOT_CONTACT",
  "risk_level": "high",
  "escalate": true
}
```

### 3. Maximum Attempts per Contact

**Per Campaign Contact Limits:**
- `max_total_attempts`: 12 (default)
- `max_attempts_per_channel`: 4
- `max_attempts_per_day`: 3

**Action when exceeded:**
1. Set state → `UNREACHABLE` or `STOPPED`
2. Log exhaustion reason
3. No further actions scheduled

```json
{
  "rule": "max_attempts",
  "limits": {
    "total": 12,
    "per_channel": 4,
    "per_day": 3
  },
  "on_exceed": {
    "state_transition": "UNREACHABLE",
    "action": "stop_campaign_contact"
  }
}
```

### 4. Rate Caps (24-Hour Rolling Window)

**Per Number Limits (sending number):**
- SMS: 200/day, 1/second
- MMS: 100/day
- Voice: 100 calls/day
- RVM: 500/day

**Per Contact Limits:**
- All channels combined: 3 touches/day
- Same channel: 2 touches/day
- Minimum gap between touches: 4 hours

```json
{
  "rule": "rate_caps",
  "per_sending_number": {
    "sms": { "daily": 200, "per_second": 1 },
    "mms": { "daily": 100 },
    "voice": { "daily": 100 },
    "rvm": { "daily": 500 }
  },
  "per_contact": {
    "all_channels_daily": 3,
    "same_channel_daily": 2,
    "min_gap_hours": 4
  }
}
```

### 5. DNC (Do Not Call) Registry

**Check Required:** Before voice/RVM actions  
**Action:** Skip voice channels if on DNC list

### 6. Consent Model (Explicit)

Consent is tracked **per channel per contact** and is distinct from suppression status.

#### Consent vs Suppression Status

| Field | Scope | Purpose | Values |
|-------|-------|---------|--------|
| `consent` | Per channel | Explicit permission to contact via this channel | `opt_in`, `opt_out`, `unknown` |
| `suppression_status` | Global | Compliance block from opt-out/complaint/DNC | `none`, `opted_out`, `complaint`, `dnc` |

**Key difference:** A contact may have `consent.sms = opt_in` but `suppression_status = opted_out` if they later sent STOP. Suppression always wins.

#### Consent Schema

```json
{
  "consent": {
    "sms": "opt_in",
    "voice": "unknown",
    "whatsapp": "opt_out",
    "imessage": "unknown",
    "rvm": "opt_in"
  },
  "consent_sources": {
    "sms": { "source": "web_form", "timestamp": "2026-01-05T10:00:00Z", "ip": "192.168.1.1" },
    "rvm": { "source": "verbal_recorded", "timestamp": "2026-01-06T14:30:00Z", "call_id": "call_123" }
  }
}
```

#### Default Rules When consent=unknown (Conservative)

| Channel | Default Behavior | Rationale |
|---------|------------------|-----------|
| SMS | **BLOCK** | TCPA requires express consent for marketing SMS |
| Voice | **ALLOW** (with DNC check) | Cold calling allowed if not on DNC |
| Voicemail | **ALLOW** (with DNC check) | Same as voice |
| RVM | **BLOCK** | FCC treats as pre-recorded call, requires consent |
| WhatsApp | **BLOCK** | Meta requires opt-in template messages |
| iMessage | **BLOCK** | Treat as SMS equivalent |

#### Policy Engine Consent Check

Added to evaluation order (after suppression, before channel availability):

```
3. **Consent Check** - Does contact have explicit consent for this channel?
   - If consent = opt_out → BLOCK
   - If consent = unknown → Apply default rule per channel (table above)
   - If consent = opt_in → PASS
```

#### Updated AllowedAction Example (with consent)

```json
{
  "action_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "channel": "sms",
  "target": { "type": "phone", "value": "+15551234567" },
  "allowed": true,
  "reason": "All policy checks passed",
  "constraints_applied": [
    { "rule": "suppression", "status": "passed", "detail": "suppression_status=none" },
    { "rule": "consent", "status": "passed", "detail": "consent.sms=opt_in via web_form" },
    { "rule": "quiet_hours", "status": "passed", "detail": "Within 9AM-8PM EST" },
    { "rule": "daily_cap", "status": "passed", "detail": "1 of 3 daily touches used" }
  ]
}
```

#### Updated PolicyEngineInput (with consent)

```typescript
interface PolicyEngineInput {
  // ... existing fields ...
  contact: {
    id: string;
    phone_numbers: Array<{ number: string; type: string; timezone?: string }>;
    consent: Record<ChannelType, 'opt_in' | 'opt_out' | 'unknown'>;
    suppression_status: 'none' | 'opted_out' | 'complaint' | 'dnc';
    // ...
  };
}
```

---

## E) Quiet Hours

All outreach must respect local quiet hours based on the contact's timezone.

### Default Configuration

| Day Type | Start (Local) | End (Local) |
|----------|---------------|-------------|
| Weekday | 9:00 AM | 8:00 PM |
| Saturday | 10:00 AM | 6:00 PM |
| Sunday | 12:00 PM | 5:00 PM |
| Holiday | No outreach | No outreach |

### Timezone Handling

1. Contact timezone determined by:
   - Explicit timezone field
   - Phone number area code lookup
   - Default to company timezone

2. All scheduled actions converted to contact's local time

3. Actions outside quiet hours are **queued**, not dropped

```json
{
  "quiet_hours": {
    "weekday": { "start": "09:00", "end": "20:00" },
    "saturday": { "start": "10:00", "end": "18:00" },
    "sunday": { "start": "12:00", "end": "17:00" },
    "holidays": "blocked"
  },
  "timezone_source": ["contact.timezone", "area_code_lookup", "company.timezone"],
  "behavior_outside_hours": "queue_for_next_window"
}
```

### Holiday Calendar

Configurable per company. Default includes:
- New Year's Day
- Memorial Day
- Independence Day
- Labor Day
- Thanksgiving
- Christmas Day

---

## F) AllowedAction Schema

The Policy Engine evaluates all possible actions and returns a list of `AllowedAction` objects representing what the orchestrator MAY do.

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AllowedAction",
  "type": "object",
  "required": ["action_id", "channel", "target", "allowed", "constraints_applied"],
  "properties": {
    "action_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique identifier for this allowed action"
    },
    "channel": {
      "type": "string",
      "enum": ["sms", "mms", "imessage", "whatsapp", "voice", "voicemail", "rvm"],
      "description": "Communication channel"
    },
    "target": {
      "type": "object",
      "properties": {
        "type": { "enum": ["phone", "email", "handle"] },
        "value": { "type": "string" }
      },
      "required": ["type", "value"]
    },
    "allowed": {
      "type": "boolean",
      "description": "Whether this action is permitted by policy"
    },
    "reason": {
      "type": "string",
      "description": "Why this action is allowed or blocked"
    },
    "cost_estimate": {
      "type": "object",
      "properties": {
        "amount": { "type": "number" },
        "currency": { "type": "string", "default": "USD" }
      }
    },
    "constraints_applied": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "rule": { "type": "string" },
          "status": { "enum": ["passed", "blocked", "warning"] },
          "detail": { "type": "string" }
        }
      },
      "description": "List of policy rules evaluated"
    },
    "available_templates": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "template_id": { "type": "string" },
          "name": { "type": "string" },
          "preview": { "type": "string" }
        }
      },
      "description": "Message templates available for this channel"
    },
    "next_available_at": {
      "type": "string",
      "format": "date-time",
      "description": "If blocked by timing, when this action becomes available"
    }
  }
}
```

### Example AllowedAction

```json
{
  "action_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "channel": "sms",
  "target": {
    "type": "phone",
    "value": "+15551234567"
  },
  "allowed": true,
  "reason": "All policy checks passed",
  "cost_estimate": {
    "amount": 0.0075,
    "currency": "USD"
  },
  "constraints_applied": [
    { "rule": "opt_out_check", "status": "passed", "detail": "Not on suppression list" },
    { "rule": "quiet_hours", "status": "passed", "detail": "Within 9AM-8PM EST" },
    { "rule": "daily_cap", "status": "passed", "detail": "1 of 3 daily touches used" },
    { "rule": "channel_cap", "status": "passed", "detail": "1 of 2 SMS today" },
    { "rule": "min_gap", "status": "passed", "detail": "Last touch 6 hours ago" }
  ],
  "available_templates": [
    { "template_id": "tpl_001", "name": "Initial Outreach", "preview": "Hi {first_name}, this is..." },
    { "template_id": "tpl_002", "name": "Follow Up", "preview": "Just following up on..." }
  ]
}
```

### Example Blocked AllowedAction

```json
{
  "action_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "channel": "voice",
  "target": {
    "type": "phone",
    "value": "+15551234567"
  },
  "allowed": false,
  "reason": "Blocked by quiet hours - outside 9AM-8PM local time",
  "constraints_applied": [
    { "rule": "opt_out_check", "status": "passed", "detail": "Not on suppression list" },
    { "rule": "quiet_hours", "status": "blocked", "detail": "Current time 8:45PM EST, cutoff 8:00PM" },
    { "rule": "dnc_check", "status": "passed", "detail": "Not on DNC registry" }
  ],
  "next_available_at": "2026-01-11T09:00:00-05:00"
}
```

---

## G) NextAction Schema

The `NextAction` represents the chosen action to execute, selected from allowed actions by the orchestrator (potentially with AI input).

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NextAction",
  "type": "object",
  "required": ["action_id", "chosen_action", "execute_at"],
  "properties": {
    "action_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique ID for tracking this action"
    },
    "campaign_contact_id": {
      "type": "string",
      "format": "uuid"
    },
    "chosen_action": {
      "type": "object",
      "properties": {
        "channel": { "enum": ["sms", "mms", "imessage", "whatsapp", "voice", "voicemail", "rvm"] },
        "target": {
          "type": "object",
          "properties": {
            "type": { "enum": ["phone", "email", "handle"] },
            "value": { "type": "string" }
          }
        },
        "from_number": { "type": "string", "description": "Sending number" }
      },
      "required": ["channel", "target"]
    },
    "message_template_id": {
      "type": "string",
      "description": "Template to use (mutually exclusive with message_body)"
    },
    "message_body": {
      "type": "string",
      "description": "Raw message content (mutually exclusive with template)"
    },
    "message_variables": {
      "type": "object",
      "additionalProperties": { "type": "string" },
      "description": "Variables to substitute in template"
    },
    "execute_at": {
      "type": "string",
      "format": "date-time",
      "description": "When to execute (immediate if now, future for scheduled)"
    },
    "wait_seconds": {
      "type": "integer",
      "minimum": 0,
      "description": "Delay before execution (alternative to execute_at)"
    },
    "priority": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10,
      "default": 5,
      "description": "Execution priority (1=highest)"
    },
    "explanation": {
      "type": "string",
      "description": "Why this action was chosen (for audit)"
    },
    "ai_confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "AI confidence score if AI-recommended"
    },
    "fallback_action": {
      "$ref": "#",
      "description": "Alternative action if primary fails"
    }
  }
}
```

### Example NextAction (Template-based)

```json
{
  "action_id": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "campaign_contact_id": "d4e5f6a7-b8c9-0123-def4-567890123456",
  "chosen_action": {
    "channel": "sms",
    "target": {
      "type": "phone",
      "value": "+15551234567"
    },
    "from_number": "+15559876543"
  },
  "message_template_id": "tpl_001",
  "message_variables": {
    "first_name": "John",
    "company_name": "Acme Insurance",
    "agent_name": "Sarah"
  },
  "execute_at": "2026-01-10T14:30:00Z",
  "priority": 5,
  "explanation": "Day 1 initial outreach via SMS. Contact has mobile number, SMS preferred based on campaign settings.",
  "ai_confidence": 0.85
}
```

### Example NextAction (Voice with fallback)

```json
{
  "action_id": "e5f6a7b8-c9d0-1234-ef56-789012345678",
  "campaign_contact_id": "d4e5f6a7-b8c9-0123-def4-567890123456",
  "chosen_action": {
    "channel": "voice",
    "target": {
      "type": "phone",
      "value": "+15551234567"
    },
    "from_number": "+15559876543"
  },
  "execute_at": "2026-01-10T15:00:00Z",
  "wait_seconds": 0,
  "priority": 3,
  "explanation": "Contact engaged via SMS, escalating to voice call for qualification. Previous 2 SMS got read receipts but no reply.",
  "ai_confidence": 0.72,
  "fallback_action": {
    "action_id": "f6a7b8c9-d0e1-2345-f678-901234567890",
    "chosen_action": {
      "channel": "voicemail",
      "target": {
        "type": "phone",
        "value": "+15551234567"
      }
    },
    "message_template_id": "vm_followup_001",
    "execute_at": "2026-01-10T15:01:00Z",
    "explanation": "Leave voicemail if call goes unanswered"
  }
}
```

---

## H) Policy Engine

The Policy Engine is the **deterministic** gatekeeper that evaluates all rules before any action is permitted.

### Interface Contract

```typescript
interface PolicyEngineInput {
  campaign_id: string;
  campaign_contact_id: string;
  contact: {
    id: string;
    phone_numbers: Array<{ number: string; type: string; timezone?: string }>;
    email?: string;
    timezone: string;
    suppression_status: 'none' | 'opted_out' | 'complaint' | 'dnc';
  };
  campaign_settings: {
    allowed_channels: string[];
    quiet_hours: QuietHoursConfig;
    max_attempts: AttemptLimits;
    rate_caps: RateCaps;
  };
  contact_history: {
    total_attempts: number;
    attempts_by_channel: Record<string, number>;
    attempts_today: number;
    last_attempt_at: string | null;
    current_state: ContactState;
    events: NormalizedEvent[];
  };
  requested_actions: Array<{
    channel: string;
    target: string;
  }>;
  current_time: string; // ISO timestamp
}

interface PolicyEngineOutput {
  evaluation_id: string;
  evaluated_at: string;
  allowed_actions: AllowedAction[];
  blocked_actions: AllowedAction[]; // allowed=false
  global_blocks: Array<{
    rule: string;
    reason: string;
  }>;
  warnings: string[];
}
```

### Evaluation Order

The Policy Engine evaluates rules in this strict order (fail-fast):

1. **Suppression Check** - Is contact on any suppression list?
2. **State Check** - Is contact in a terminal state?
3. **Channel Availability** - Is the channel enabled for this campaign?
4. **Attempt Limits** - Has max attempts been reached?
5. **Rate Caps** - Are we within daily/hourly limits?
6. **Quiet Hours** - Is it within allowed contact hours?
7. **DNC Check** - (Voice only) Is contact on Do Not Call registry?
8. **Carrier/Provider Limits** - Are we within carrier rate limits?

### Example Policy Engine Request/Response

**Request:**
```json
{
  "campaign_id": "camp_001",
  "campaign_contact_id": "cc_001",
  "contact": {
    "id": "cont_001",
    "phone_numbers": [
      { "number": "+15551234567", "type": "mobile", "timezone": "America/New_York" }
    ],
    "timezone": "America/New_York",
    "suppression_status": "none"
  },
  "campaign_settings": {
    "allowed_channels": ["sms", "voice", "voicemail"],
    "quiet_hours": {
      "weekday": { "start": "09:00", "end": "20:00" }
    },
    "max_attempts": { "total": 12, "per_channel": 4, "per_day": 3 },
    "rate_caps": { "sms_daily": 200, "voice_daily": 100 }
  },
  "contact_history": {
    "total_attempts": 2,
    "attempts_by_channel": { "sms": 2 },
    "attempts_today": 1,
    "last_attempt_at": "2026-01-10T10:00:00-05:00",
    "current_state": "ATTEMPTING",
    "events": []
  },
  "requested_actions": [
    { "channel": "sms", "target": "+15551234567" },
    { "channel": "voice", "target": "+15551234567" }
  ],
  "current_time": "2026-01-10T14:30:00-05:00"
}
```

**Response:**
```json
{
  "evaluation_id": "eval_abc123",
  "evaluated_at": "2026-01-10T14:30:00-05:00",
  "allowed_actions": [
    {
      "action_id": "act_001",
      "channel": "sms",
      "target": { "type": "phone", "value": "+15551234567" },
      "allowed": true,
      "reason": "All checks passed",
      "cost_estimate": { "amount": 0.0075, "currency": "USD" },
      "constraints_applied": [
        { "rule": "suppression", "status": "passed" },
        { "rule": "state", "status": "passed" },
        { "rule": "channel_enabled", "status": "passed" },
        { "rule": "attempt_limit", "status": "passed", "detail": "2/12 total, 2/4 sms" },
        { "rule": "rate_cap", "status": "passed", "detail": "1/3 today" },
        { "rule": "quiet_hours", "status": "passed", "detail": "2:30PM within 9AM-8PM" },
        { "rule": "min_gap", "status": "passed", "detail": "4.5 hours since last" }
      ]
    },
    {
      "action_id": "act_002",
      "channel": "voice",
      "target": { "type": "phone", "value": "+15551234567" },
      "allowed": true,
      "reason": "All checks passed",
      "cost_estimate": { "amount": 0.02, "currency": "USD" },
      "constraints_applied": [
        { "rule": "suppression", "status": "passed" },
        { "rule": "dnc_check", "status": "passed" },
        { "rule": "quiet_hours", "status": "passed" }
      ]
    }
  ],
  "blocked_actions": [],
  "global_blocks": [],
  "warnings": []
}
```

---

## I) Orchestrator Loop (Worker)

The Orchestrator Worker is a background process that continuously processes campaign contacts.

### Pseudocode

```
FUNCTION orchestrator_loop():
    WHILE running:
        # 1. Fetch batch of actionable campaign_contacts
        contacts = fetch_actionable_contacts(
            states = [NEW, ATTEMPTING, ENGAGED, QUALIFIED],
            next_action_due <= NOW,
            limit = 100
        )
        
        IF contacts is empty:
            sleep(5 seconds)
            CONTINUE
        
        FOR each contact IN contacts:
            TRY:
                process_contact(contact)
            CATCH error:
                log_error(contact, error)
                mark_contact_for_retry(contact)
        
        # Rate limit the loop
        sleep(100 milliseconds)

FUNCTION process_contact(campaign_contact):
    # 1. Load full context
    context = load_contact_context(campaign_contact)
    
    # 2. Check for pending events to process first
    pending_events = get_unprocessed_events(campaign_contact)
    FOR each event IN pending_events:
        apply_state_transition(campaign_contact, event)
        mark_event_processed(event)
    
    # 3. Check if contact is in terminal state
    IF campaign_contact.state IN [BOOKED, NOT_INTERESTED, STOPPED, UNREACHABLE, DO_NOT_CONTACT]:
        RETURN  # Nothing to do
    
    # 4. Get allowed actions from Policy Engine
    policy_input = build_policy_input(context)
    policy_result = policy_engine.evaluate(policy_input)
    
    IF policy_result.allowed_actions is empty:
        IF policy_result.global_blocks:
            handle_global_block(campaign_contact, policy_result.global_blocks)
        ELSE:
            # All actions blocked temporarily (quiet hours, rate limits)
            schedule_next_check(campaign_contact, next_available_time(policy_result))
        RETURN
    
    # 5. Get AI recommendation (optional)
    IF campaign.ai_enabled:
        ai_recommendation = ai_recommender.suggest(
            allowed_actions = policy_result.allowed_actions,
            contact_context = context,
            campaign_goals = campaign.goals
        )
        chosen_action = ai_recommendation.next_action
    ELSE:
        # Use rule-based selection
        chosen_action = select_next_action_by_rules(
            allowed_actions = policy_result.allowed_actions,
            campaign_sequence = campaign.sequence
        )
    
    # 6. Execute the action via Channel Router
    execution_result = channel_router.execute(chosen_action)
    
    # 7. Log the action
    log_action(campaign_contact, chosen_action, execution_result)
    
    # 8. Schedule next check
    schedule_next_check(campaign_contact, chosen_action.wait_seconds OR default_wait)

FUNCTION select_next_action_by_rules(allowed_actions, sequence):
    # Get current step in sequence
    current_step = get_current_sequence_step(campaign_contact)
    
    # Find matching allowed action for current step
    FOR each step IN sequence starting from current_step:
        matching_action = find_allowed_action(allowed_actions, step.channel, step.target)
        IF matching_action:
            RETURN build_next_action(
                action = matching_action,
                template = step.template_id,
                wait = step.wait_after
            )
    
    # No matching action found - wait for next opportunity
    RETURN null

FUNCTION handle_global_block(campaign_contact, blocks):
    FOR each block IN blocks:
        IF block.rule == "opt_out" OR block.rule == "complaint":
            transition_state(campaign_contact, DO_NOT_CONTACT)
        ELSE IF block.rule == "max_attempts":
            transition_state(campaign_contact, UNREACHABLE)
```

### Worker Configuration

```json
{
  "worker": {
    "batch_size": 100,
    "poll_interval_ms": 5000,
    "max_concurrent_executions": 50,
    "retry_delays": [60, 300, 900, 3600],
    "dead_letter_after_retries": 5
  },
  "scheduling": {
    "default_wait_seconds": 3600,
    "jitter_percent": 10
  }
}
```

---

## J) Channel Router

The Channel Router abstracts communication channels behind a unified interface.

### Adapter Interface

```typescript
interface ChannelAdapter {
  channel: ChannelType;
  
  // Check if channel is available for this contact
  canReach(target: Target): Promise<boolean>;
  
  // Execute the action
  execute(action: NextAction): Promise<ExecutionResult>;
  
  // Get current status of a sent message/call
  getStatus(externalId: string): Promise<MessageStatus>;
  
  // Estimated cost for this action
  estimateCost(action: NextAction): CostEstimate;
}

type ChannelType = 'sms' | 'mms' | 'imessage' | 'whatsapp' | 'voice' | 'voicemail' | 'rvm';

interface Target {
  type: 'phone' | 'email' | 'handle';
  value: string;
}

interface ExecutionResult {
  success: boolean;
  external_id?: string;  // Provider's message/call ID
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  cost_actual?: CostEstimate;
  metadata?: Record<string, any>;
}

interface CostEstimate {
  amount: number;
  currency: string;
  breakdown?: {
    base: number;
    segments?: number;
    per_segment?: number;
  };
}
```

### Standard Outcomes

All adapters must map provider-specific statuses to these standard outcomes:

| Outcome | Description | Event Generated |
|---------|-------------|-----------------|
| `queued` | Accepted by provider, pending | `MESSAGE_SENT` |
| `sent` | Sent to carrier/network | `MESSAGE_SENT` |
| `delivered` | Confirmed delivered | `MESSAGE_DELIVERED` |
| `failed` | Permanent failure | `MESSAGE_FAILED` |
| `undeliverable` | Number invalid/unreachable | `MESSAGE_FAILED` |
| `answered` | Call answered (voice) | `CALL_ANSWERED` |
| `no_answer` | Call not answered | `CALL_NO_ANSWER` |
| `busy` | Line busy | `CALL_BUSY` |
| `voicemail` | Reached voicemail | `VOICEMAIL_DROPPED` |

### Channel Adapter Implementations

| Channel | Provider | Notes |
|---------|----------|-------|
| SMS/MMS | Twilio, Telnyx | Company's Telnyx managed account |
| iMessage | BlueBubbles | Requires macOS server |
| WhatsApp | Meta Cloud API | 24-hour window, templates required |
| Voice | Telnyx | WebRTC or SIP |
| Voicemail | Telnyx | Live voicemail drop |
| RVM | Slybroadcast, Drop Cowboy | Ringless voicemail |

### Router Configuration

```json
{
  "channel_router": {
    "adapters": {
      "sms": {
        "primary": "telnyx",
        "fallback": "twilio",
        "retry_on_failure": true
      },
      "voice": {
        "primary": "telnyx",
        "fallback": null,
        "retry_on_failure": false
      },
      "imessage": {
        "primary": "bluebubbles",
        "fallback": "sms",
        "retry_on_failure": true
      }
    },
    "default_timeout_ms": 30000,
    "max_retries": 3
  }
}
```

---

## K) Audit Logging

Every decision and action is logged for compliance review and debugging.

### Event Audit Log

Logged for every normalized event received:

```json
{
  "log_type": "event",
  "log_id": "uuid",
  "timestamp": "2026-01-10T15:30:00Z",
  "company_id": "uuid",
  "campaign_id": "uuid",
  "campaign_contact_id": "uuid",
  "contact_id": "uuid",
  "event": {
    "type": "MESSAGE_REPLIED",
    "channel": "sms",
    "external_id": "twilio_sid_xxx",
    "payload_hash": "sha256_xxx"
  },
  "state_before": "ATTEMPTING",
  "state_after": "ENGAGED",
  "processing_time_ms": 45
}
```

### Decision Audit Log

Logged for every orchestrator decision:

```json
{
  "log_type": "decision",
  "log_id": "uuid",
  "timestamp": "2026-01-10T15:30:00Z",
  "company_id": "uuid",
  "campaign_id": "uuid",
  "campaign_contact_id": "uuid",
  "policy_evaluation": {
    "evaluation_id": "eval_abc123",
    "allowed_count": 2,
    "blocked_count": 1,
    "global_blocks": []
  },
  "ai_recommendation": {
    "used": true,
    "confidence": 0.85,
    "chosen_channel": "sms"
  },
  "final_decision": {
    "action_id": "act_001",
    "channel": "sms",
    "template_id": "tpl_001",
    "scheduled_at": "2026-01-10T15:35:00Z"
  },
  "reasoning": "AI recommended SMS based on contact preference history. Voice blocked by quiet hours."
}
```

### Action Execution Log

Logged for every action executed:

```json
{
  "log_type": "execution",
  "log_id": "uuid",
  "timestamp": "2026-01-10T15:35:00Z",
  "company_id": "uuid",
  "campaign_id": "uuid",
  "campaign_contact_id": "uuid",
  "action_id": "act_001",
  "channel": "sms",
  "adapter": "telnyx",
  "target": "+15551234567",
  "from": "+15559876543",
  "result": {
    "success": true,
    "external_id": "telnyx_msg_xxx",
    "outcome": "queued"
  },
  "cost": {
    "amount": 0.0075,
    "currency": "USD"
  },
  "latency_ms": 234
}
```

### Compliance Audit Log

Logged for opt-outs, complaints, and compliance events:

```json
{
  "log_type": "compliance",
  "log_id": "uuid",
  "timestamp": "2026-01-10T15:40:00Z",
  "company_id": "uuid",
  "contact_id": "uuid",
  "event_type": "OPT_OUT",
  "channel": "sms",
  "trigger": {
    "keyword": "STOP",
    "message_id": "msg_xxx",
    "inbound_text": "STOP"
  },
  "actions_taken": [
    "state_transition_to_DO_NOT_CONTACT",
    "cancelled_3_pending_actions",
    "added_to_suppression_list",
    "sent_opt_out_confirmation"
  ],
  "affected_campaigns": ["camp_001", "camp_002"]
}
```

### Retention Policy

| Log Type | Retention | Storage |
|----------|-----------|---------|
| Event | 90 days | Hot storage |
| Decision | 90 days | Hot storage |
| Execution | 1 year | Cold storage after 90 days |
| Compliance | 7 years | Immutable cold storage |

---

## Appendix: API Endpoint Contracts (Future)

These endpoints will be implemented in subsequent tickets.

### Internal Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/campaigns/:id/contacts` | GET | List campaign contacts with state |
| `/api/campaigns/:id/contacts/:contactId/actions` | GET | Get allowed actions |
| `/api/campaigns/:id/contacts/:contactId/next` | POST | Schedule next action |
| `/api/campaigns/:id/start` | POST | Start campaign |
| `/api/campaigns/:id/pause` | POST | Pause campaign |
| `/api/orchestrator/health` | GET | Worker health check |

### Webhook Endpoints

| Endpoint | Source | Description |
|----------|--------|-------------|
| `/webhooks/sms/status` | Twilio/Telnyx | Message status updates |
| `/webhooks/voice/status` | Telnyx | Call status updates |
| `/webhooks/whatsapp/status` | Meta | WhatsApp delivery receipts |

---

## Appendix: Database Schema (Reference)

Key tables for orchestrator (to be created in implementation phase):

- `campaigns` - Campaign configuration
- `campaign_contacts` - Contact enrollment with state
- `campaign_contact_events` - Normalized events
- `campaign_actions` - Scheduled/executed actions
- `campaign_audit_logs` - All audit logs
- `suppression_list` - Opt-outs and blocks

---

*Document End*
