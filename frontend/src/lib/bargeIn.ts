export type VoiceBargeIn = {
  acceptBinary: () => boolean;
  onUserStarted: (flush: () => void) => void;
  onAgentThinking: () => void;
  onAgentAudioDone: () => void;
  dispose: () => void;
};

/**
 * Mirrors the gateway: playback is flushed and dropped from the interruption
 * until that utterance ends, and a new agent turn always clears the drop.
 */
export function createVoiceBargeIn(): VoiceBargeIn {
  let agentAudioOpen = false;
  let dropping = false;

  const reset = () => {
    agentAudioOpen = false;
    dropping = false;
  };

  return {
    acceptBinary() {
      if (dropping) {
        return false;
      }
      agentAudioOpen = true;
      return true;
    },
    onUserStarted(flush) {
      if (!agentAudioOpen || dropping) {
        return;
      }
      flush();
      dropping = true;
    },
    onAgentThinking: reset,
    onAgentAudioDone: reset,
    dispose: reset,
  };
}
