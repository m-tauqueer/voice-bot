import { int16LeToFloat } from "./pcm";
import type { VoiceClientConfig } from "./voiceConfig";

export type PcmPlayback = {
  enqueue: (bytes: ArrayBuffer) => void;
  flush: () => boolean;
  stop: () => Promise<void>;
};

type ScheduledSource = {
  source: AudioBufferSourceNode;
  startAt: number;
};

export function createPcmPlayback(config: VoiceClientConfig): PcmPlayback {
  const context = new AudioContext({ sampleRate: config.outputSampleRate });
  const output = context.createGain();
  output.connect(context.destination);
  const sources = new Set<ScheduledSource>();
  let nextTime = 0;
  let stopped = false;

  function silenceAndDrop(): boolean {
    const now = context.currentTime;
    const hadAudio = sources.size > 0 || nextTime > now;
    output.gain.cancelScheduledValues(now);
    output.gain.setValueAtTime(0, now);
    for (const item of sources) {
      try {
        item.source.stop(item.startAt > now ? item.startAt : now);
      } catch {
        // already stopped
      }
      item.source.disconnect();
    }
    sources.clear();
    nextTime = now;
    return hadAudio;
  }

  return {
    enqueue(bytes: ArrayBuffer) {
      if (stopped || bytes.byteLength < 2) {
        return;
      }
      const samples = int16LeToFloat(bytes);
      if (samples.length === 0) {
        return;
      }
      if (context.state === "suspended") {
        void context.resume();
      }
      const now = context.currentTime;
      output.gain.cancelScheduledValues(now);
      output.gain.setValueAtTime(1, now);
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
      source.connect(output);
      const startAt = Math.max(nextTime, now);
      source.start(startAt);
      const item: ScheduledSource = { source, startAt };
      sources.add(item);
      source.onended = () => {
        sources.delete(item);
      };
      nextTime = startAt + buffer.duration;
    },
    flush() {
      if (stopped) {
        return false;
      }
      return silenceAndDrop();
    },
    async stop() {
      stopped = true;
      silenceAndDrop();
      if (context.state !== "closed") {
        await context.close();
      }
    },
  };
}
