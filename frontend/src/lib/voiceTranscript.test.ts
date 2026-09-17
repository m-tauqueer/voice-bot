import { describe, expect, it } from "vitest";
import {
  applyTranscriptEvent,
  labelForTranscriptRole,
} from "./voiceTranscript";

describe("live sitting transcript", () => {
  it("updates an interim line then commits it", () => {
    const first = applyTranscriptEvent(
      [],
      { role: "user", text: "hel", interim: true },
      1,
    );
    const second = applyTranscriptEvent(
      first.lines,
      { role: "user", text: "hello", interim: true },
      first.nextId,
    );
    const committed = applyTranscriptEvent(
      second.lines,
      { role: "user", text: "hello there", interim: false },
      second.nextId,
    );
    expect(committed.lines).toEqual([
      { id: 1, role: "user", text: "hello there", interim: false },
    ]);
    expect(committed.nextId).toBe(2);
  });

  it("appends a later turn after a committed line", () => {
    const first = applyTranscriptEvent(
      [],
      { role: "assistant", text: "Hi.", interim: false },
      1,
    );
    const second = applyTranscriptEvent(
      first.lines,
      { role: "user", text: "Hi", interim: false },
      first.nextId,
    );
    expect(second.lines.map((line) => line.id)).toEqual([1, 2]);
    expect(second.lines[1]?.role).toBe("user");
  });

  it("labels roles from config, not from guessed wording", () => {
    expect(
      labelForTranscriptRole("caller", "caller", "persona", "You", "Ada"),
    ).toBe("You");
    expect(
      labelForTranscriptRole("persona", "caller", "persona", "You", "Ada"),
    ).toBe("Ada");
    expect(
      labelForTranscriptRole("other", "caller", "persona", "You", "Ada"),
    ).toBe("other");
  });
});
