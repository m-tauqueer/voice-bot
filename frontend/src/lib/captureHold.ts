export type CaptureHold = {
  until: number;
};

export function emptyCaptureHold(): CaptureHold {
  return { until: 0 };
}

export function playbackIsActive(
  sourceCount: number,
  nextTime: number,
  now: number,
): boolean {
  return sourceCount > 0 || nextTime > now;
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
