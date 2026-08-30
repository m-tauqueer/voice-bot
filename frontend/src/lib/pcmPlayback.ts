import { int16LeToFloat } from "./pcm";
import type { VoiceClientConfig } from "./voiceConfig";

export type PcmPlayback = {
  enqueue: (bytes: ArrayBuffer) => void;
  stop: () => Promise<void>;
};

export function createPcmPlayback(config: VoiceClientConfig): PcmPlayback {
  const context = new AudioContext({ sampleRate: config.outputSampleRate });
  const sources = new Set<AudioBufferSourceNode>();
  let nextTime = 0;
  let stopped = false;

  return {
    enqueue(bytes: ArrayBuffer) {
      if (stopped || bytes.byteLength < 2) {
        return;
      }
      const samples = int16LeToFloat(bytes);
      if (samples.length === 0) {
        return;
      }
      const buffer = context.createBuffer(
        config.channelCount,
        samples.length,
        config.outputSampleRate,
      );
      for (let channel = 0; channel < config.channelCount; channel += 1) {
        buffer.getChannelData(channel).set(samples);
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        sources.delete(source);
      };
      if (context.state === "suspended") {
        void context.resume();
      }
      const startAt = Math.max(nextTime, context.currentTime);
      source.start(startAt);
      nextTime = startAt + buffer.duration;
      sources.add(source);
    },
    async stop() {
      stopped = true;
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // already stopped
        }
        source.disconnect();
      }
      sources.clear();
      nextTime = 0;
      if (context.state !== "closed") {
        await context.close();
      }
    },
  };
}
