# TypeScript Orchestration Module Design

> Version: 0.1
> Last Updated: 2026-04-10

---

## 1. Goal

This document defines the recommended TypeScript module shape for the Starter Project 2 orchestration MVP.

The goal is:

- keep the product iteration loop fast
- avoid introducing an extra runtime service too early
- keep the module boundary clean enough to migrate to Go later

This module should live inside the existing server application for now, but it should be designed as an isolated runtime boundary.

---

## 2. Product Position

Starter Project 2 should validate:

- a signed-in user can enter a starter experience
- the room has a stable participant model
- utterances can be interpreted into explicit orchestration actions
- the orchestration behavior feels useful enough to continue investing in

That means the primary goal is **product validation**, not final runtime architecture.

For this reason, the best MVP shape is:

- keep the UI and product shell in the existing full-stack TypeScript app
- keep orchestration logic in `apps/server`
- keep orchestration code in its own module tree
- avoid tight coupling to page logic, route logic, and transport details

---

## 3. Recommended Module Boundary

The TypeScript orchestration module should live under:

```text
apps/server/src/orchestration/
```

Recommended internal structure:

```text
apps/server/src/orchestration/
  index.ts
  types.ts
  resolver.ts
  runtime.ts
  adapters/
    realtime.ts
```

Responsibilities:

- `types.ts`
  - protocol-aligned room, utterance, resolution, and action types
- `resolver.ts`
  - minimal rule-based resolver for MVP
- `runtime.ts`
  - orchestration pipeline helpers and derivation logic
- `adapters/realtime.ts`
  - mapping between current realtime server structures and orchestration room/utterance inputs
- `index.ts`
  - stable exports for use by the rest of the server

This keeps the orchestration layer isolated from:

- Fastify routes
- WebSocket message shapes
- raw transport details
- current conversation backend implementation details

---

## 4. Why This Should Stay in TypeScript for MVP

For the MVP, TypeScript is not meaningfully worse than Go for this layer.

Reasons:

- protocol design is still evolving quickly
- the room / utterance / resolution boundary is still being refined
- product iteration speed matters more than runtime purity
- the existing server already hosts realtime and conversation pipeline logic
- colocating the module reduces debugging and deployment cost

The right tradeoff is:

- **logical separation now**
- **physical separation later if needed**

---

## 5. Migration Rule for Future Go Runtime

The TypeScript implementation should be treated as a reference runtime, not as a forever-binding implementation.

To keep Go migration easy later, the TS module should follow these rules:

### 5.1 Stable input and output types

Inputs:

- `RoomConfig`
- `Utterance`
- optional streaming utterance update

Outputs:

- `ResolutionResult`
- `OrchestrationAction[]`

### 5.2 No transport coupling

The orchestration module should not depend on:

- Fastify request objects
- WebSocket objects
- SQL storage details
- browser-specific message shapes

### 5.3 Use adapters at the edges

Current server runtime objects should be converted into orchestration types through adapter helpers.

This allows future Go migration to replace only the adapter boundary.

### 5.4 Keep rule-based MVP logic replaceable

The first resolver may be a simple rule-based resolver.

Later it can be replaced by:

- richer heuristics
- attention graph logic
- model-based resolution
- a separate Go runtime

without changing the action contract.

---

## 6. MVP Integration Path

The first implementation should integrate into the existing realtime utterance pipeline.

Recommended flow:

```text
realtime input
-> transcript resolved
-> build RoomConfig for current channel
-> build Utterance
-> resolve targets
-> derive orchestration actions
-> log or expose actions
-> continue existing conversation backend flow
```

This gives immediate value because it allows:

- instrumentation
- debugging
- product observation
- later behavior hooks

without requiring a full rewrite of the current conversation runtime.

---

## 7. MVP Scope

The first TS module implementation only needs to support:

- static room config derived from the current channel runtime
- minimal utterance objects
- simple rule-based mention resolution
- broadcast detection
- multi-target `CALL` fan-out
- optional action logging

It does **not** need to support yet:

- dynamic room membership sync
- provisional action rollback
- separate orchestration persistence
- full attention engine execution
- separate deployment process

---

## 8. Recommended First Implementation

### 8.1 Inputs

- current client session
- current realtime channel snapshot
- final transcript text

### 8.2 Derived room model

- current user as one participant
- connected bots as agent participants

### 8.3 Resolver behavior

The MVP resolver should recognize:

- direct name mentions
- simple group address patterns such as `all`, `everyone`, `you all`
- multiple explicit targets in one utterance

### 8.4 Action derivation behavior

The MVP action layer should derive:

- `CALL` for explicit or resolved targets
- zero actions when no explicit target exists
- future hooks for `CLAIM` and `DROP`

At this stage, `CLAIM` and `DROP` may be protocol-defined but not yet deeply exercised by server runtime automation.

---

## 9. Suggested Adoption Sequence

1. Add the orchestration module under `apps/server/src/orchestration`
2. Add protocol-aligned TS types
3. Add rule-based resolution
4. Add action derivation
5. Integrate into `realtime-utterance-pipeline`
6. Log derived actions for observation
7. Add product-facing APIs or runtime effects only after the logs confirm the behavior is useful

---

## 10. Final Recommendation

For Starter Project 2, the best tradeoff is:

- keep the product in the current full-stack TypeScript system
- implement orchestration as an isolated server module
- avoid premature Go service extraction
- keep all module inputs and outputs protocol-aligned so future Go migration is straightforward

In short:

> build the boundary now, not the extra service now
