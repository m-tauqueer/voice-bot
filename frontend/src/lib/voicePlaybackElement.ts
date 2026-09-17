export const VOICE_PLAYBACK_CLASS = "voice-playback";

export type MediaPlayback = {
  start: () => Promise<void>;
  stop: () => void;
};

export function attachMediaPlayback(
  stream: MediaStream,
  doc: Document = document,
): MediaPlayback {
  const el = doc.createElement("audio");
  el.className = VOICE_PLAYBACK_CLASS;
  el.autoplay = true;
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.setAttribute("aria-hidden", "true");
  el.tabIndex = -1;
  el.srcObject = stream;
  doc.body.appendChild(el);
  return {
    async start() {
      await el.play();
    },
    stop() {
      el.pause();
      el.srcObject = null;
      el.remove();
    },
  };
}
