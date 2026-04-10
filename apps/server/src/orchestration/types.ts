export type OrchestrationParticipantKind = "user" | "agent" | "system"

export interface RoomParticipant {
  id: string
  kind: OrchestrationParticipantKind
  name: string
}

export interface RoomConfig {
  roomId: string
  participants: RoomParticipant[]
}

export interface Utterance {
  roomId: string
  speakerId: string
  utteranceId: string
  text: string
}

export interface StreamingUtteranceUpdate extends Utterance {
  seq: number
  isFinal: boolean
}

export type ResolutionTarget = string | "*"

export interface ResolutionResult {
  utteranceId: string
  targets: ResolutionTarget[]
}

interface BaseAction {
  roomId: string
  actorId: string
  action: "CALL" | "CLAIM" | "DROP"
}

export interface CallAction extends BaseAction {
  action: "CALL"
  target: ResolutionTarget
  strength?: number
}

export interface ClaimAction extends BaseAction {
  action: "CLAIM"
  strength?: number
}

export interface DropAction extends BaseAction {
  action: "DROP"
}

export type OrchestrationAction = CallAction | ClaimAction | DropAction

export interface OrchestrationDerivation {
  room: RoomConfig
  utterance: Utterance
  resolution: ResolutionResult
  actions: OrchestrationAction[]
}
