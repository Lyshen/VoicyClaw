import WebSocket from "ws";
import type { ResolvedVoicyClawAccount } from "./config.js";
import {
  createHelloMessage,
  createPreviewTextMessage,
  createTtsTextMessage,
  parseVoicyClawServerMessage,
  type VoicyClawServerMessage,
  type VoicyClawSttResultMessage,
  type VoicyClawWelcomeMessage,
} from "./protocol.js";

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug?: (message: string) => void;
};

export type VoicyClawSocketClientOptions = {
  account: ResolvedVoicyClawAccount;
  socketUrl: string;
  logger: Logger;
  onMessage?: (message: VoicyClawServerMessage) => Promise<void> | void;
  onTranscript?: (message: VoicyClawSttResultMessage) => Promise<void> | void;
};

export class VoicyClawSocketClient {
  private socket: WebSocket | null = null;
  private welcomeMessage: VoicyClawWelcomeMessage | null = null;
  private closePromise: Promise<void> | null = null;
  private resolveClose: (() => void) | null = null;
  private rejectClose: ((error: Error) => void) | null = null;

  constructor(private readonly options: VoicyClawSocketClientOptions) {}

  async connect() {
    const socket = new WebSocket(this.options.socketUrl);
    this.socket = socket;
    this.closePromise = new Promise<void>((resolve, reject) => {
      this.resolveClose = resolve;
      this.rejectClose = reject;
    });

    return await new Promise<VoicyClawWelcomeMessage>((resolve, reject) => {
      let settled = false;
      const timeout = globalThis.setTimeout(() => {
        const error = new Error(
          `Timed out after ${this.options.account.connectTimeoutMs}ms waiting for VoicyClaw welcome.`,
        );
        if (!settled) {
          settled = true;
          reject(error);
        }
        socket.close();
      }, this.options.account.connectTimeoutMs);

      const settleResolve = (message: VoicyClawWelcomeMessage) => {
        if (settled) {
          return;
        }

        settled = true;
        globalThis.clearTimeout(timeout);
        resolve(message);
      };

      const settleReject = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        globalThis.clearTimeout(timeout);
        reject(error);
      };

      socket.once("open", () => {
        socket.send(
          JSON.stringify(
            createHelloMessage({
              token: this.options.account.token ?? "",
            }),
          ),
        );
      });

      socket.on("message", async (raw, isBinary) => {
        void this.handleIncomingMessage({
          raw,
          isBinary,
          socket,
          settleResolve,
          settleReject,
        });
      });

      socket.once("error", (error) => {
        const failure =
          error instanceof Error ? error : new Error(String(error));
        settleReject(failure);
        this.rejectClose?.(failure);
      });

      socket.once("close", (code, reason) => {
        const detail = reason.toString("utf8").trim();
        const message = detail
          ? `VoicyClaw socket closed (${code}: ${detail})`
          : `VoicyClaw socket closed (${code})`;

        if (!settled && !this.welcomeMessage) {
          settleReject(new Error(message));
        }

        this.resolveClose?.();
      });
    });
  }

  async waitUntilClosed() {
    await this.closePromise;
  }

  sendPreview(utteranceId: string, text: string, isFinal = false) {
    const sessionId = this.getRequiredSessionId();
    this.getRequiredSocket().send(
      JSON.stringify(
        createPreviewTextMessage({
          sessionId,
          utteranceId,
          text,
          isFinal,
        }),
      ),
    );
  }

  sendText(utteranceId: string, text: string, isFinal = true) {
    const sessionId = this.getRequiredSessionId();
    this.getRequiredSocket().send(
      JSON.stringify(
        createTtsTextMessage({
          sessionId,
          utteranceId,
          text,
          isFinal,
        }),
      ),
    );
  }

  async close() {
    if (!this.socket) {
      return;
    }

    const socket = this.socket;
    this.socket = null;

    if (
      socket.readyState === WebSocket.CLOSING ||
      socket.readyState === WebSocket.CLOSED
    ) {
      return;
    }

    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
    });
  }

  private getRequiredSocket() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("VoicyClaw socket is not connected");
    }

    return this.socket;
  }

  private getRequiredSessionId() {
    const sessionId = this.welcomeMessage?.session_id;
    if (!sessionId) {
      throw new Error("VoicyClaw session is not ready");
    }

    return sessionId;
  }

  private async handleIncomingMessage(params: {
    raw: WebSocket.RawData;
    isBinary: boolean;
    socket: WebSocket;
    settleResolve: (message: VoicyClawWelcomeMessage) => void;
    settleReject: (error: Error) => void;
  }) {
    const { raw, isBinary, socket, settleResolve, settleReject } = params;
    if (isBinary) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      this.options.logger.warn(
        "[voicyclaw] ignoring non-JSON message from VoicyClaw server",
      );
      return;
    }

    const message = parseVoicyClawServerMessage(parsed);
    if (!message) {
      this.options.logger.warn(
        "[voicyclaw] ignoring unsupported VoicyClaw protocol message",
      );
      return;
    }

    try {
      await this.options.onMessage?.(message);
    } catch (error) {
      this.options.logger.error(
        `[voicyclaw] onMessage handler failed: ${stringifyError(error)}`,
      );
    }

    if (message.type === "WELCOME") {
      this.welcomeMessage = message;
      settleResolve(message);
      return;
    }

    if (message.type === "ERROR") {
      const error = new Error(
        `[voicyclaw] handshake rejected: ${message.code} ${message.message}`,
      );
      settleReject(error);
      socket.close();
      return;
    }

    if (message.type === "STT_RESULT") {
      try {
        await this.options.onTranscript?.(message);
      } catch (error) {
        this.options.logger.error(
          `[voicyclaw] onTranscript handler failed: ${stringifyError(error)}`,
        );
      }
      return;
    }

    if (message.type === "DISCONNECT") {
      this.options.logger.warn(
        `[voicyclaw] server requested disconnect: ${message.reason}`,
      );
      socket.close();
    }
  }
}

function stringifyError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
