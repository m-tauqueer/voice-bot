export type VoiceBargeIn = {
  acceptBinary: () => boolean;
  onUserStarted: (flush: () => void) => void;
  onAgentAudioDone: () => void;
  dispose: () => void;
};

export function createVoiceBargeIn(): VoiceBargeIn {
  let agentAudioOpen = false;
  let dropping = false;

  return {
    acceptBinary() {
      if (dropping) {
        return false;
      }
      agentAudioOpen = true;
      return true;
    },
    onUserStarted(flush) {
      if (!agentAudioOpen) {
        return;
      }
      flush();
      dropping = true;
    },
    onAgentAudioDone() {
      agentAudioOpen = false;
      dropping = false;
    },
    dispose() {
      agentAudioOpen = false;
      dropping = false;
    },
  };
}
