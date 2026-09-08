import { describe, expect, it } from "vitest";
import { testConfig } from "../test/config.js";
import { readListenMessage } from "./listen.js";

describe("readListenMessage", () => {
  const config = testConfig();

  it("reads speech started and utterance end from configured types", () => {
    expect(
      readListenMessage(
        { type: config.DEEPGRAM_LISTEN_MSG_SPEECH_STARTED },
        config,
      ),
    ).toEqual({ kind: "speech_started" });
    expect(
      readListenMessage(
        { type: config.DEEPGRAM_LISTEN_MSG_UTTERANCE_END },
        config,
      ),
    ).toEqual({ kind: "utterance_end" });
  });

  it("reads interim and final transcripts from Results", () => {
    expect(
      readListenMessage(
        {
          type: config.DEEPGRAM_LISTEN_MSG_RESULTS,
          is_final: false,
          channel: { alternatives: [{ transcript: "hello" }] },
        },
        config,
      ),
    ).toEqual({ kind: "interim", text: "hello" });
    expect(
      readListenMessage(
        {
          type: config.DEEPGRAM_LISTEN_MSG_RESULTS,
          is_final: true,
          speech_final: false,
          channel: { alternatives: [{ transcript: "hello there" }] },
        },
        config,
      ),
    ).toEqual({ kind: "final_part", text: "hello there" });
    expect(
      readListenMessage(
        {
          type: config.DEEPGRAM_LISTEN_MSG_RESULTS,
          is_final: true,
          speech_final: true,
          channel: { alternatives: [{ transcript: "done" }] },
        },
        config,
      ),
    ).toEqual({ kind: "speech_final", text: "done" });
  });
});
