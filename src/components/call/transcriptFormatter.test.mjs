import assert from "node:assert/strict";
import test from "node:test";

import { formatCallTranscript } from "./transcriptFormatter.ts";

test("formats agent and user labels for a transcript", () => {
  const transcript = formatCallTranscript("Agent: Hello\nUser: Hi", "Ava");

  assert.equal(transcript, "**AI interviewer:** Hello\n\n**Ava:** Hi");
});

test("returns an empty string when transcript is missing", () => {
  const transcript = formatCallTranscript(undefined, "Ava");

  assert.equal(transcript, "");
});
