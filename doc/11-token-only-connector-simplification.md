# Token-Only Connector Simplification Scope

> Version: 0.1 (Draft)
> Last Updated: 2026-04-05

---

## 1. Goal

Define the scope for the next VoicyClaw plugin productization step:

- make the OpenClaw plugin configuration **token-only** for the hosted path
- remove the need for users to manually copy `channelId` into local config
- move room and bot assignment toward a **server-driven binding model**
- keep the first implementation small enough to ship as a focused PR

This document is intentionally about **scope**, not full implementation.

---

## 2. Problem Statement

The current hosted plugin path is already better than the original local-dev
shape, but it still asks the user to configure:

```json
{
  "channels": {
    "voicyclaw": {
      "token": "vcs_xxx",
      "channelId": "sayhello-demo"
    }
  }
}
```

That is still heavier than the desired product mental model.

Current drawbacks:

- the hosted connector token is not enough by itself
- room selection still lives in local plugin config
- the plugin implicitly acts like one connector equals one room equals one bot
- changing room or bot identity still requires local config edits and a restart
- the control plane is split between VoicyClaw UI and OpenClaw local config

The simplest product experience should be:

```bash
openclaw plugins install @voicyclaw/voicyclaw
```

```json
{
  "channels": {
    "voicyclaw": {
      "token": "vcs_xxx"
    }
  }
}
```

```bash
openclaw gateway restart
```

After that, VoicyClaw should decide which room and bot binding this connector
serves.

---

## 3. Product Thesis

The hosted connector token should identify a **connector registration**, not a
single room.

Recommended conceptual model:

| Concept | Meaning |
|---|---|
| workspace | top-level tenant scope |
| connector | one OpenClaw node / one installed plugin instance |
| bot | one assistant persona exposed in VoicyClaw |
| room | one voice conversation surface in VoicyClaw |
| binding | one assignment of a bot to a room through a connector |

With this model:

- the user installs and authenticates a connector once
- VoicyClaw decides which room or bot assignments are active
- local plugin config stops being the place where hosted room routing lives

---

## 4. Recommended Scope For The Next PR

The next PR should implement **token-only connector registration with a single
server-assigned primary binding**.

In scope:

1. the hosted plugin config only requires `channels.voicyclaw.token`
2. the plugin handshake changes from room-first to connector-first
3. VoicyClaw server validates the token and resolves connector identity
4. VoicyClaw server returns one primary room/bot binding for the connector
5. the plugin routes inbound turns using that binding instead of local
   `channelId`
6. the hosted onboarding snippet becomes truly token-only
7. the plugin removes local `channelId` and `botId` selection entirely

This keeps the next PR focused while unlocking the correct product direction.

---

## 5. Explicitly Out Of Scope

The next PR should **not** try to solve every future conversation topology.

Out of scope for the token-only PR:

- multiple simultaneous room bindings per connector
- multiple bot personas speaking in one room
- free-form bot-to-bot group chat
- orchestrator bot logic
- mention routing rules
- shared room memory between multiple bots
- full hosted UI for editing room/bot bindings
- rotating connector credentials
- offline queue replay for missed final replies

Those should come later once connector registration is stable.

---

## 6. Why This Scope Is The Right Cut

This cut gives us the best ratio of product gain to implementation risk.

Product gain:

- users copy less config
- hosted onboarding becomes more credible
- room assignment moves into the hosted control plane
- future multi-room and multi-bot features become possible

Contained risk:

- only one active primary binding needs to work
- no complex scheduler or policy engine is required yet
- no need to redesign all room semantics up front

---

## 7. Proposed Protocol Direction

### 7.1 Current hosted handshake

Today the plugin effectively connects with:

```json
{
  "type": "HELLO",
  "api_key": "vcs_xxx",
  "bot_id": "openclaw-voicyclaw",
  "channel_id": "sayhello-demo",
  "protocol_version": "0.1"
}
```

That makes the plugin responsible for selecting the room.

### 7.2 Proposed connector-first handshake

The next protocol step should look more like:

```json
{
  "v": 1,
  "type": "connector_hello",
  "payload": {
    "token": "vcs_xxx",
    "connectorName": "Lyshen MacBook Air",
    "pluginVersion": "0.1.0"
  }
}
```

Server response:

```json
{
  "v": 1,
  "type": "hello_ok",
  "payload": {
    "connectorId": "conn_123",
    "workspaceId": "ws_123",
    "binding": {
      "bindingId": "bind_primary",
      "roomId": "sayhello-demo",
      "botId": "openclaw-demo",
      "displayName": "SayHello Connector"
    }
  }
}
```

This keeps the first server-driven binding tiny:

- one connector
- one primary binding
- one room
- one bot

That is enough to remove local `channelId` from the hosted path.

---

## 8. Runtime Model For The First Binding

The plugin should keep one resolved `primaryBinding` in memory:

```ts
type PrimaryBinding = {
  bindingId: string
  roomId: string
  botId: string
  displayName: string
}
```

Inbound flow:

1. connector authenticates with token
2. server returns primary binding
3. server sends room turns tagged to that binding
4. plugin dispatches those turns into OpenClaw
5. plugin returns assistant preview/final messages tagged with the same binding

This already prepares the codebase for future `bindings: Binding[]`, but avoids
implementing multi-binding behavior now.

---

## 9. Config Model After This PR

### 9.1 Hosted default

```json
{
  "channels": {
    "voicyclaw": {
      "token": "vcs_xxx"
    }
  }
}
```

### 9.2 Self-hosted

```json
{
  "channels": {
    "voicyclaw": {
      "url": "https://voice.example.com",
      "token": "vcs_xxx"
    }
  }
}
```

Rule:

- hosted path should only require `token`
- self-hosted path should use `url + token`
- room and bot binding should come from the server-side token in both cases

---

## 10. Server Responsibilities Added By This PR

The VoicyClaw server will need a small connector registry that can:

- resolve connector token to workspace and connector identity
- resolve one primary room/bot binding for that connector
- include that binding in the connector handshake response
- route user turns through the resolved binding

This does **not** require the full future connector hub yet.

The smallest server-side addition is:

- one connector record
- one primary binding lookup
- one handshake response shape that includes binding metadata

---

## 11. OpenClaw Plugin Responsibilities Added By This PR

The plugin will need to:

- connect using token-only hosted config
- accept connector-first welcome data
- cache the resolved primary binding
- stop treating local `channelId` as mandatory on the hosted path
- include binding identity when sending preview/final assistant messages

The plugin should still remain a thin transport adapter, not a control plane.

---

## 12. Migration Strategy

We should preserve a low-risk path during rollout.

Recommended rollout:

1. server supports both old and new handshake paths
2. hosted onboarding starts generating token-only config
3. plugin prefers connector-first handshake when supported
4. old `token + channelId` path remains temporarily for compatibility
5. after stabilization, de-emphasize local `channelId` further in docs

This lets us ship the simplification without breaking current connectors.

---

## 13. Follow-Up Phases After The Token-Only PR

### Phase 2: multiple bindings per connector

- one connector can serve multiple rooms
- server sends `bind_room` / `unbind_room`
- plugin keeps a binding map instead of one primary binding

### Phase 3: multiple bots in one room

- support several bot bindings for one room
- add trigger policy such as `primary`, `mention`, or `orchestrated`

### Phase 4: richer control plane

- hosted UI to assign connectors
- choose default room and bot
- add health, presence, and reconnect surfaces

---

## 14. Recommended PR Title

```text
feat(plugin): add token-only hosted connector registration
```

---

## 15. Recommended Acceptance Criteria

The token-only PR is complete when:

1. hosted onboarding shows a plugin config with only `token`
2. the plugin can connect successfully without local `channelId`
3. VoicyClaw server resolves the room/bot binding from the token
4. a user can talk in the hosted starter room and receive bot replies
5. existing compatibility flows are either preserved or intentionally gated
6. docs and tests reflect the token-only hosted path

---

## 16. Summary

The next step should not try to solve the full multi-room, multi-bot future in
one PR.

The right scope is:

- token-only hosted config
- connector-first authentication
- one server-assigned primary room/bot binding
- compatibility preserved where needed

That is the smallest change set that materially improves the product while
opening the door to future room and bot binding features.
