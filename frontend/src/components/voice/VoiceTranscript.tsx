import { useEffect, useRef } from "react";
import {
  labelForTranscriptRole,
  type TranscriptLine,
} from "../../lib/voiceTranscript";

export function VoiceTranscript({
  title,
  empty,
  lines,
  userRole,
  assistantRole,
  userLabel,
  assistantLabel,
}: {
  title: string;
  empty: string;
  lines: readonly TranscriptLine[];
  userRole: string;
  assistantRole: string;
  userLabel: string;
  assistantLabel: string;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [lines]);

  return (
    <aside className="voice-sit__transcript" aria-label={title}>
      <h2 className="voice-sit__transcript-title">{title}</h2>
      <div className="voice-sit__transcript-list">
        {lines.length === 0 ? (
          <p className="voice-sit__transcript-empty">{empty}</p>
        ) : (
          lines.map((line) => (
            <div
              key={line.id}
              className={
                line.interim
                  ? "voice-sit__line voice-sit__line--interim"
                  : "voice-sit__line"
              }
            >
              <span className="voice-sit__line-role">
                {labelForTranscriptRole(
                  line.role,
                  userRole,
                  assistantRole,
                  userLabel,
                  assistantLabel,
                )}
              </span>
              <p className="voice-sit__line-text">{line.text}</p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </aside>
  );
}
