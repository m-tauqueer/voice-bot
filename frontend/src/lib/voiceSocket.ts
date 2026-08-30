import type { VoiceClientConfig } from "./voiceConfig";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export type VoiceReady = {
  sessionId: string;
  requestId: string | null;
};

export type VoiceSocket = {
  sendBinary: (frame: ArrayBuffer) => void;
  close: () => void;
};

export function openVoiceSocket(
  config: VoiceClientConfig,
  handlers: {
    onReady: (ready: VoiceReady) => void;
    onBinary: (bytes: ArrayBuffer) => void;
    onError: (message: string) => void;
    onClose: () => void;
  },
): VoiceSocket {
  const socket = new WebSocket(config.wsUrl);
  socket.binaryType = "arraybuffer";
  let opened = false;

  const fail = (message: string) => {
    handlers.onError(message);
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  };

  socket.addEventListener("open", () => {
    opened = true;
  });

  socket.addEventListener("message", (event) => {
    if (event.data instanceof ArrayBuffer) {
      handlers.onBinary(event.data);
      return;
    }
    if (event.data instanceof Blob) {
      void event.data.arrayBuffer().then((bytes) => {
        handlers.onBinary(bytes);
      });
      return;
    }
    if (typeof event.data !== "string") {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data) as unknown;
    } catch {
      return;
    }
    const message = asRecord(parsed);
    if (!message || typeof message.type !== "string") {
      return;
    }
    if (message.type === config.readyType) {
      const sessionId =
        typeof message.session_id === "string" ? message.session_id : null;
      if (!sessionId) {
        fail("voice ready missing session_id");
        return;
      }
      handlers.onReady({
        sessionId,
        requestId:
          typeof message.request_id === "string" ? message.request_id : null,
      });
      return;
    }
    if (message.type === config.errorType) {
      const error =
        typeof message.error === "string"
          ? message.error
          : "voice session failed";
      fail(error);
    }
  });

  socket.addEventListener("error", () => {
    if (!opened) {
      fail("voice socket failed to connect");
    }
  });

  socket.addEventListener("close", () => {
    handlers.onClose();
  });

  return {
    sendBinary(frame: ArrayBuffer) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(frame);
      }
    },
    close() {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    },
  };
}
