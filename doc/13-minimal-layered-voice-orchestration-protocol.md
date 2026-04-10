# Minimal Voice Orchestration Protocol

> Version: 0.3 (MVP Design)
> Last Updated: 2026-04-10

---

## 1. Purpose

This document defines a minimal protocol model for VoicyClaw multi-party voice interaction.

The target interaction space is:

- direct mention
- group addressing
- interruption
- overlap
- refusal
- silence
- re-entry after silence

The goal is to keep the system small, explicit, and implementable for an MVP.

---

## 2. Core Position

For the first useful version, the system should stay small in four steps:

1. **Room Config** — who exists in the room
2. **Utterance** — who said what
3. **Resolution Step** — who the utterance refers to
4. **Action Protocol** — what explicit action is emitted

The most important rule is:

> the execution layer should only consume already-resolved structure

That means:

- room membership should not start as a large real-time presence system
- utterance streaming should not immediately leak into action semantics
- resolution should absorb ambiguity before behavior is emitted
- the action protocol should remain extremely small

---

## 3. Why This Version Is Smaller

This design is smaller not because it uses only one message type, but because each layer has one job.

- **Room Config** defines valid participants
- **Utterance** records content facts
- **Resolution** turns ambiguous references into explicit targets
- **Action** drives orchestration

This avoids mixing together:

- room identity
- natural language content
- mention inference
- execution instructions

---

## 4. Layer 1: Room Config

This layer answers one question:

> who can be referred to in this room

For v1, this can be static configuration.

It does not need runtime `JOINED` / `LEFT` events yet.

### 4.1 Minimal room config

```json
{
  "room_id": "room_1",
  "participants": [
    { "id": "user_1", "kind": "user", "name": "You" },
    { "id": "agent_a", "kind": "agent", "name": "A" },
    { "id": "agent_b", "kind": "agent", "name": "B" },
    { "id": "rocky", "kind": "agent", "name": "Rocky" }
  ]
}
```

### 4.2 Minimal participant fields

| Field | Description |
|---|---|
| `id` | Stable system identifier |
| `kind` | `user`, `agent`, or `system` |
| `name` | Human-readable display name |

That is enough in v1 to support:

- mention grounding
- actor identification
- target addressing

### 4.3 Why no dynamic presence in v1

For the first MVP, the product model can be:

- one user
- a fixed set of agents
- all participants available from room start

That is sufficient for validating orchestration behavior.

---

## 5. Layer 2: Utterance

This layer answers one question:

> who said what

`Utterance` is a content fact, not a behavior action.

It exists because context-aware resolution cannot happen without some representation of spoken content.

### 5.1 Minimal final utterance model

```json
{
  "room_id": "room_1",
  "speaker_id": "user_1",
  "utterance_id": "utt_1",
  "text": "B, what do you think about this?"
}
```

| Field | Description |
|---|---|
| `room_id` | Which room this utterance belongs to |
| `speaker_id` | Who said it |
| `utterance_id` | Stable utterance identity |
| `text` | Current utterance text |

That is enough to support:

- transcript history
- context-aware mention resolution
- action derivation
- logging and replay

### 5.2 Minimal streaming event model

If the system internally handles streaming ASR updates, `is_final` alone is not enough.

`is_final` tells you whether the utterance is complete.

It does **not** tell you the order of intermediate transcript updates.

The smallest useful streaming event form is:

```json
{
  "room_id": "room_1",
  "speaker_id": "user_1",
  "utterance_id": "utt_1",
  "seq": 3,
  "text": "B, what do you think about this?",
  "is_final": false
}
```

| Field | Description |
|---|---|
| `seq` | Monotonic update number within one `utterance_id` |
| `is_final` | Whether this is the final update for this utterance |

Rule:

- same `utterance_id`
- higher `seq`
- replaces lower `seq`

### 5.3 MVP recommendation for streaming

For MVP, the system may internally support streaming utterance updates, but the orchestration pipeline should consume only stable utterances.

That means:

- audio input may be streaming
- ASR transcript updates may be streaming
- but `Resolution` and `Action` should initially run on final or stable utterance state

This keeps action behavior simple and avoids rollback semantics.

---

## 6. Layer 3: Resolution Step

This layer answers one question:

> given an utterance and current context, who is being referred to

This is a translation step from natural language ambiguity into explicit structure.

### 6.1 What it consumes

The resolution step may consume:

- the current utterance
- recent utterance history
- room config
- product rules
- future model or policy output

### 6.2 What it outputs

For v1, resolution should stay small.

It should output only:

- one concrete participant id
- multiple concrete participant ids
- broadcast to the room
- no target

Examples:

```text
"B, what do you think?" -> ["agent_b"]
"B and Rocky, what do you think?" -> ["agent_b", "rocky"]
"What do you all think?" -> ["*"]
"What do you think?" + context -> ["agent_b"]
```

### 6.3 Why this layer matters

Without this layer, the action protocol would be forced to carry unresolved concepts like:

- vague mention tokens
- alias strings
- candidate lists
- confidence values
- `AUTO`

That would make the action protocol larger and less stable.

### 6.4 Important clarification

This does **not** need to become a large standalone network protocol.

In many implementations, it is just an internal function:

```text
utterance -> resolve targets -> emit actions
```

Its value is separation of responsibility, not protocol ceremony.

---

## 7. Layer 4: Action Protocol

This is the behavioral protocol.

It contains only three actions:

- `CALL`
- `CLAIM`
- `DROP`

### 7.1 Shared fields

All actions share only these fields:

| Field | Description |
|---|---|
| `room_id` | Which room the action belongs to |
| `actor_id` | Which participant emits the action |
| `action` | `CALL`, `CLAIM`, or `DROP` |

This is intentionally the smallest stable action envelope.

### 7.2 `CALL`

`CALL` means:

> direct attention toward a resolved target

Single target form:

```json
{
  "room_id": "room_1",
  "actor_id": "user_1",
  "action": "CALL",
  "target": "agent_b"
}
```

Broadcast form:

```json
{
  "room_id": "room_1",
  "actor_id": "user_1",
  "action": "CALL",
  "target": "*"
}
```

Optional stronger form:

```json
{
  "room_id": "room_1",
  "actor_id": "user_1",
  "action": "CALL",
  "target": "agent_b",
  "strength": 0.6
}
```

Rules:

- `target` is required for `CALL`
- `target` must already be resolved
- `strength` is optional
- if `strength` is absent, engine defaults apply

### 7.3 `CLAIM`

`CLAIM` means:

> take or contest the floor

```json
{
  "room_id": "room_1",
  "actor_id": "agent_b",
  "action": "CLAIM"
}
```

Optional stronger form:

```json
{
  "room_id": "room_1",
  "actor_id": "agent_b",
  "action": "CLAIM",
  "strength": 0.8
}
```

Rules:

- `CLAIM` has no target in v1
- interruption and normal reply both map to `CLAIM`
- it always means self-asserted floor acquisition

### 7.4 `DROP`

`DROP` means:

> release or refuse the floor

```json
{
  "room_id": "room_1",
  "actor_id": "agent_b",
  "action": "DROP"
}
```

Rules:

- `DROP` has no target
- `DROP` has no strength in v1
- it can mean “I am done” or “I will not take this turn”

---

## 8. Utterance, Resolution, and Action Relationship

The system should be understood as a pipeline, not as one giant message.

### 8.1 One utterance can produce multiple actions

A single utterance may resolve to:

- no explicit target
- one target
- multiple targets
- room broadcast

That means one utterance may produce:

- zero actions
- one action
- multiple actions

### 8.2 Example: one target

Utterance:

```json
{
  "room_id": "room_1",
  "speaker_id": "user_1",
  "utterance_id": "utt_1",
  "text": "B, what do you think?"
}
```

Resolution:

```json
{
  "utterance_id": "utt_1",
  "targets": ["agent_b"]
}
```

Action:

```json
{
  "room_id": "room_1",
  "actor_id": "user_1",
  "action": "CALL",
  "target": "agent_b"
}
```

### 8.3 Example: two explicit targets

Utterance:

```json
{
  "room_id": "room_1",
  "speaker_id": "user_1",
  "utterance_id": "utt_2",
  "text": "B and Rocky, what do you think?"
}
```

Resolution:

```json
{
  "utterance_id": "utt_2",
  "targets": ["agent_b", "rocky"]
}
```

Action fan-out:

```json
{
  "room_id": "room_1",
  "actor_id": "user_1",
  "action": "CALL",
  "target": "agent_b"
}
```

```json
{
  "room_id": "room_1",
  "actor_id": "user_1",
  "action": "CALL",
  "target": "rocky"
}
```

Rule:

- multiple concrete targets => multiple `CALL` actions
- broadcast => one `CALL` with `target = "*"`

This keeps action execution and logging clear.

---

## 9. Attention Engine Relationship

This protocol does not replace the attention model.

It feeds it.

The execution side may still be:

- a dynamic attention field
- a deterministic rule-driven system
- a future hybrid policy engine

The important architectural point is:

> no matter whether the implementation is rule-based, dynamic, or model-assisted, the action input should remain explicit and stable

---

## 10. Scenario Mapping

### 10.1 Direct mention

Utterance:

> “B, what do you think?”

Resolution:

```text
["agent_b"]
```

Action:

```json
{
  "room_id": "room_1",
  "actor_id": "user_1",
  "action": "CALL",
  "target": "agent_b"
}
```

### 10.2 Group question

Utterance:

> “What do you all think?”

Resolution:

```text
["*"]
```

Action:

```json
{
  "room_id": "room_1",
  "actor_id": "user_1",
  "action": "CALL",
  "target": "*"
}
```

### 10.3 Implicit contextual mention

Utterance:

> “What do you think?”

Resolver uses context and returns:

```text
["agent_b"]
```

The action layer still receives the same explicit `CALL`.

### 10.4 Interruption

A participant takes the floor:

```json
{
  "room_id": "room_1",
  "actor_id": "agent_b",
  "action": "CLAIM"
}
```

### 10.5 Refusal

```json
{
  "room_id": "room_1",
  "actor_id": "agent_b",
  "action": "DROP"
}
```

### 10.6 Silence recovery

Silence occurs when nobody claims and attention decays.

A participant re-enters with:

```json
{
  "room_id": "room_1",
  "actor_id": "rocky",
  "action": "CLAIM"
}
```

---

## 11. What Is Intentionally Excluded

The following are intentionally excluded from the MVP core:

- dynamic participant join/leave events
- explicit room presence streaming
- target candidate lists in the action layer
- generic metadata bags
- rendering style flags
- confidence fields in the action layer
- audio frame transport
- rollback semantics for provisional actions

These are excluded because they are not required for the first stable version.

---

## 12. Final Position

The MVP design is now:

- **Room Config** gives the system a stable identity map
- **Utterance** records content facts
- **Resolution Step** turns ambiguity into explicit targets
- **Action Protocol** emits only `CALL`, `CLAIM`, and `DROP`

This is sufficient for a first MVP because it defines:

- who exists
- what was said
- who the utterance refers to
- what explicit orchestration action should happen next

That is enough to build:

- mention-driven attention routing
- claim-based interruption
- explicit refusal via `DROP`
- group addressing
- silence and re-entry behavior

while keeping the protocol small enough to implement cleanly.
