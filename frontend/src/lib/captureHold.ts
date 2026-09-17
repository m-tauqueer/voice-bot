export type CaptureHold = {
  until: number;
};

export function emptyCaptureHold(): CaptureHold {
  return { until: 0 };
}

export function captureHoldGapMs(frameSamples: number, sampleRate: number): number {
  if (!Number.isInteger(frameSamples) || frameSamples <= 0 || sampleRate <= 0) {
    throw new Error("capture hold gap requires a positive frame size and sample rate");
  }
  return Math.max(1, Math.ceil((2000 * frameSamples) / sampleRate));
}

export function playbackHoldActive(input: {
  stopped: boolean;
  sourceCount: number;
  queued: boolean;
  lastAudioEnd: number;
  now: number;
  padSec: number;
}): boolean {
  if (input.stopped || !input.queued) {
    return false;
  }
  if (input.sourceCount > 0) {
    return true;
  }
  return input.now < input.lastAudioEnd + input.padSec;
}

export function noteCaptureHold(
  hold: CaptureHold,
  active: boolean,
  now: number,
  afterMs: number,
): CaptureHold {
  if (!active) {
    return hold;
  }
  return { until: Math.max(hold.until, now + afterMs) };
}

export function captureHeld(hold: CaptureHold, now: number): boolean {
  return now < hold.until;
}
