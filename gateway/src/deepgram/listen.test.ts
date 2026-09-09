import { describe, expect, it } from "vitest";
import { testConfig } from "../test/config.js";
import { applyListenCue, emptyListenTurn, readListenMessage } from "./listen.js";

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

describe("applyListenCue", () => {
  it("commits once when speech_final and utterance_end both fire", () => {
    let turn = emptyListenTurn();
    turn = applyListenCue(turn, { kind: "speech_started" }).turn;
    turn = applyListenCue(turn, { kind: "final_part", text: "Hello?" }).turn;
    const first = applyListenCue(turn, { kind: "speech_final", text: "Hello?" });
    expect(first.transcript).toBe("Hello?");
    const second = applyListenCue(first.turn, { kind: "utterance_end" });
    expect(second.transcript).toBeNull();
  });

  it("does not duplicate a speech_final after utterance_end already committed", () => {
    let turn = emptyListenTurn();
    turn = applyListenCue(turn, { kind: "final_part", text: "Hey." }).turn;
    const first = applyListenCue(turn, { kind: "utterance_end" });
    expect(first.transcript).toBe("Hey.");
    const second = applyListenCue(first.turn, {
      kind: "speech_final",
      text: "Hey.",
    });
    expect(second.transcript).toBeNull();
  });
});

