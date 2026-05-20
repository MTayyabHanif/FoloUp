import assert from "node:assert/strict";
import test from "node:test";

import {
  countQuestionsCovered,
  hasRetellReviewArtifacts,
  needsRetellReviewRefresh,
} from "./retellReviewArtifacts.ts";

test("recognizes a fully hydrated Retell review payload", () => {
  assert.equal(
    hasRetellReviewArtifacts({
      transcript: "Agent: Hello\nUser: Hi there",
      transcript_object: [{ role: "user", content: "I worked on a full test plan for a payments flow." }],
      recording_url: "https://example.com/recording.mp3",
      call_analysis: { call_summary: "Strong session" },
    }),
    true,
  );
});

test("treats early call payloads as incomplete review data", () => {
  assert.equal(
    hasRetellReviewArtifacts({
      transcript: "",
      recording_url: "",
      call_analysis: null,
    }),
    false,
  );
});

test("requests a refresh for analyzed rows that were frozen too early", () => {
  assert.equal(
    needsRetellReviewRefresh({
      is_analysed: true,
      questions_covered: null,
      details: {
        call_id: "call_123",
        call_status: "ongoing",
      },
    }),
    true,
  );
});

test("skips refresh once review artifacts and coverage are present", () => {
  assert.equal(
    needsRetellReviewRefresh({
      is_analysed: true,
      questions_covered: 4,
      details: {
        transcript: "Agent: Hello\nUser: I tested a production issue.",
        transcript_object: [{ role: "user", content: "I tested a production issue with a clear reproduction path." }],
        recording_url: "https://example.com/recording.mp3",
        call_analysis: { call_summary: "Good depth" },
      },
    }),
    false,
  );
});

test("counts only substantive user turns and caps them at question count", () => {
  assert.equal(
    countQuestionsCovered(
      [
        { role: "agent", content: "Tell me about your QA approach." },
        { role: "user", content: "Sure." },
        {
          role: "user",
          content: "I built a regression suite for our checkout flow and tracked every release risk.",
        },
        {
          role: "user",
          content: "I also owned API test coverage and documented failures with detailed repro steps.",
        },
      ],
      1,
    ),
    1,
  );
});
