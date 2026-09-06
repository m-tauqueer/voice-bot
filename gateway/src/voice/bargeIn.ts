export type VoiceBargeIn = {
  acceptBinary: () => boolean;
  onUserStarted: () => boolean;
  onAgentThinking: () => void;
  onAgentAudioDone: () => void;
};

/**
 * Drops agent audio from the moment the user interrupts until that utterance
 * is over. A new agent turn always clears the drop, so an interrupted
 * utterance that never reports its end cannot mute the rest of the call.
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
    onUserStarted() {
      if (!agentAudioOpen || dropping) {
        return false;
      }
      dropping = true;
      return true;
    },
    onAgentThinking: reset,
    onAgentAudioDone: reset,
  };
}
