export type VoiceBargeIn = {
  acceptBinary: () => boolean;
  onUserStarted: () => boolean;
  onAgentAudioDone: () => void;
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
    onUserStarted() {
      if (!agentAudioOpen) {
        return false;
      }
      dropping = true;
      return true;
    },
    onAgentAudioDone() {
      agentAudioOpen = false;
      dropping = false;
    },
  };
}
