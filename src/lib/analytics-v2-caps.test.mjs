// Run with: node --experimental-strip-types src/lib/analytics-v2-caps.test.mjs
//
// Table-driven coverage for the hard-cap logic in analytics-v2-caps.ts.
// Per openspec/changes/analytics-v2-followups/design.md §3.

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyHardCaps,
  computeCandidateSpeakingSeconds,
  computeOverallScoreFromDimensions,
  countSubstantiveUserTurns,
} from "./analytics-v2-caps.ts";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/**
 * Build a Retell user turn with even word timing across [startSec, endSec].
 */
function makeUserTurn(content, startSec, endSec) {
  const words = content.split(/\s+/).filter(Boolean);
  const dur = endSec - startSec;
  const perWord = words.length > 0 ? dur / words.length : 0;
  return {
    role: "user",
    content,
    words: words.map((w, i) => ({
      word: w,
      start: startSec + i * perWord,
      end: startSec + (i + 1) * perWord,
    })),
  };
}

/**
 * Build an agent turn analogously.
 */
function makeAgentTurn(content, startSec, endSec) {
  const turn = makeUserTurn(content, startSec, endSec);
  turn.role = "agent";
  return turn;
}

/**
 * Build a minimal valid AnalyticsV2 model output. `opts` is a shallow override.
 * Default has all 6 dimensions with mid-range scores, 3 questions answered,
 * no red flags, no hard rules triggered (the caller asserts triggered state).
 */
function makeModelOutput(opts = {}) {
  return {
    schemaVersion: 2,
    recommendation: "lean_yes",
    confidence: "medium",
    overallScore: 65,
    overallFeedback: "Solid responses across most dimensions.",
    dimensions: [
      { name: "role_fit", score: 7, weight: 0.25, feedback: "Good fit.", evidenceQuotes: ["I led the team."] },
      { name: "depth_of_knowledge", score: 6, weight: 0.25, feedback: "Adequate.", evidenceQuotes: ["I used React hooks."] },
      { name: "problem_solving", score: 7, weight: 0.2, feedback: "Logical.", evidenceQuotes: ["I broke it into steps."] },
      { name: "examples_evidence", score: 6, weight: 0.15, feedback: "Cited.", evidenceQuotes: ["At my last job..."] },
      { name: "communication", score: 8, weight: 0.1, feedback: "Clear.", evidenceQuotes: ["To summarise..."] },
      { name: "professionalism", score: 8, weight: 0.05, feedback: "Engaged.", evidenceQuotes: ["Thank you for your time."] },
    ],
    perQuestionScores: [
      { question: "Q1", answered: true, score: 4, summary: "Good answer.", evidenceQuotes: ["I led the team."] },
      { question: "Q2", answered: true, score: 3, summary: "OK answer.", evidenceQuotes: ["I used React hooks."] },
      { question: "Q3", answered: true, score: 4, summary: "Good answer.", evidenceQuotes: ["I broke it into steps."] },
    ],
    redFlags: [],
    evidenceGaps: [],
    hardRulesTriggered: [],
    candidateSpeakingSeconds: 0, // overwritten by applyHardCaps
    questionsAnswered: 0, // overwritten
    questionsTotal: 3, // overwritten
    callSignals: {
      callSummary: "",
      userSentiment: "",
      callCompletionRating: "",
      disconnectionReason: "",
      durationSeconds: 0,
    },
    ...opts,
  };
}

/**
 * Build a RetellSignals payload. `overrides` patches the defaults.
 */
function makeRetellSignals(overrides = {}) {
  return {
    transcriptObject: [],
    disconnectionReason: "agent_hangup",
    durationSeconds: 600,
    expectedDurationSeconds: 1800, // 30 min
    callAnalysisPresent: true,
    ...overrides,
  };
}

// A long, substantive user transcript: 4 substantive turns totaling ~90s of speech.
function buildHealthyTranscript() {
  return [
    makeAgentTurn("Tell me about your most recent project.", 0, 4),
    makeUserTurn(
      "I led the rebuild of our payments service from monolith to microservices, focusing on the checkout path and the reconciliation worker.",
      4,
      30,
    ),
    makeAgentTurn("What was the biggest technical challenge?", 30, 33),
    makeUserTurn(
      "The hardest part was the dual-write window where both systems had to stay consistent. We used outbox pattern with idempotent consumers and a backfill job.",
      33,
      60,
    ),
    makeAgentTurn("How did you measure success?", 60, 63),
    makeUserTurn(
      "P99 checkout latency dropped from 800 milliseconds to 220 milliseconds and our incident rate halved over the next quarter.",
      63,
      90,
    ),
  ];
}

// ---------------------------------------------------------------------------
// Case 1 — clean call, no caps triggered
// ---------------------------------------------------------------------------

// Helper: full set of active-dim-tagged questions so applyHardCaps doesn't
// force assessed:false on active dims. Used by clean-call tests that need
// legacy scoring math to hold.
const FULL_ACTIVE_DIM_QUESTIONS = [
  { targetDimension: "role_fit" },
  { targetDimension: "depth_of_knowledge" },
  { targetDimension: "problem_solving" },
  { targetDimension: "examples_evidence" },
];

test("case 1: clean call — no caps triggered, model score preserved", () => {
  const modelOutput = makeModelOutput();
  const retellSignals = makeRetellSignals({
    transcriptObject: buildHealthyTranscript(),
    durationSeconds: 95,
  });

  const result = applyHardCaps({
    modelOutput,
    retellSignals,
    questionsTotal: 3,
    questions: FULL_ACTIVE_DIM_QUESTIONS,
  });

  assert.equal(result.hardRulesTriggered.length, 0, "no hard rules should fire");
  assert.notEqual(result.recommendation, "insufficient_data");
  // overallScore is recomputed from dimensions: round((7*0.25 + 6*0.25 + 7*0.2 + 6*0.15 + 8*0.1 + 8*0.05) * 10)
  // = round((1.75 + 1.5 + 1.4 + 0.9 + 0.8 + 0.4) * 10) = round(67.5) = 68
  assert.equal(result.overallScore, 68);
  assert.equal(result.questionsAnswered, 3);
});

// ---------------------------------------------------------------------------
// Case 2 — no answers
// ---------------------------------------------------------------------------

test("case 2: no-answers — recommendation forced to insufficient_data, cap 20", () => {
  const modelOutput = makeModelOutput({
    perQuestionScores: [
      { question: "Q1", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
      { question: "Q2", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
      { question: "Q3", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
    ],
  });
  // Need transcript_object to exist (otherwise agent_only_speech also fires).
  const retellSignals = makeRetellSignals({
    transcriptObject: buildHealthyTranscript(),
    durationSeconds: 95,
  });

  const result = applyHardCaps({ modelOutput, retellSignals, questionsTotal: 3 });

  assert.equal(result.recommendation, "insufficient_data");
  assert.equal(result.confidence, "insufficient");
  assert.ok(result.overallScore <= 20, `overallScore ${result.overallScore} must be <= 20`);
  assert.ok(
    result.hardRulesTriggered.some((r) => r.rule === "no_answers"),
    "should contain no_answers trigger",
  );
});

// ---------------------------------------------------------------------------
// Case 3 — short call
// ---------------------------------------------------------------------------

test("case 3: short call — candidateSpeakingSeconds < 30, cap 40", () => {
  // 1 short user turn (~5s of speech), 1 question answered.
  const transcriptObject = [
    makeAgentTurn("Tell me about yourself.", 0, 4),
    makeUserTurn("I worked at a startup for two years.", 4, 9),
  ];
  const modelOutput = makeModelOutput({
    perQuestionScores: [
      { question: "Q1", answered: true, score: 3, summary: "Brief.", evidenceQuotes: ["I worked at a startup"] },
      { question: "Q2", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
      { question: "Q3", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
    ],
  });
  const retellSignals = makeRetellSignals({ transcriptObject, durationSeconds: 10 });

  const result = applyHardCaps({ modelOutput, retellSignals, questionsTotal: 3 });

  assert.ok(result.overallScore <= 40, `overallScore ${result.overallScore} must be <= 40`);
  assert.ok(
    result.hardRulesTriggered.some((r) => r.rule === "short_call"),
    "should contain short_call trigger",
  );
  assert.notEqual(result.recommendation, "insufficient_data");
});

// ---------------------------------------------------------------------------
// Case 4 — abandoned (hangup + duration < 50% of expected)
// ---------------------------------------------------------------------------

test("case 4: abandoned — user hangup + duration < half expected, cap 50", () => {
  // Healthy speech (avoids short_call trigger) but call ended early via hangup.
  const modelOutput = makeModelOutput();
  const retellSignals = makeRetellSignals({
    transcriptObject: buildHealthyTranscript(),
    disconnectionReason: "user_hangup",
    durationSeconds: 95, // < 900 (half of 1800 expected)
    expectedDurationSeconds: 1800,
  });

  const result = applyHardCaps({ modelOutput, retellSignals, questionsTotal: 3 });

  assert.ok(result.overallScore <= 50, `overallScore ${result.overallScore} must be <= 50`);
  assert.ok(
    result.hardRulesTriggered.some((r) => r.rule === "abandoned"),
    "should contain abandoned trigger",
  );
  assert.notEqual(result.recommendation, "insufficient_data");
});

// ---------------------------------------------------------------------------
// Case 5 — agent-only speech
// ---------------------------------------------------------------------------

test("case 5: agent-only — candidate silent, agent spoke 30s+, cap 10", () => {
  // Only agent turns; no user turns at all.
  const transcriptObject = [
    makeAgentTurn(
      "Hi there, thanks for joining. We have a few questions for you today about your experience and the role.",
      0,
      40,
    ),
    makeAgentTurn("Are you there? Can you hear me okay?", 40, 60),
  ];
  const modelOutput = makeModelOutput({
    perQuestionScores: [
      { question: "Q1", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
      { question: "Q2", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
      { question: "Q3", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
    ],
  });
  const retellSignals = makeRetellSignals({ transcriptObject, durationSeconds: 60 });

  const result = applyHardCaps({ modelOutput, retellSignals, questionsTotal: 3 });

  assert.equal(result.recommendation, "insufficient_data");
  assert.equal(result.confidence, "insufficient");
  assert.ok(result.overallScore <= 10, `overallScore ${result.overallScore} must be <= 10`);
  assert.ok(
    result.hardRulesTriggered.some((r) => r.rule === "agent_only_speech"),
    "should contain agent_only_speech trigger",
  );
});

// ---------------------------------------------------------------------------
// Case 6 — multiple caps stacked
// ---------------------------------------------------------------------------

test("case 6: multiple caps stacked — no-answers + short-call, lowest wins (20)", () => {
  // Short candidate speech AND no answers in perQuestionScores.
  const transcriptObject = [
    makeAgentTurn("Hi.", 0, 1),
    makeUserTurn("Hi sorry I can't do this right now.", 1, 5),
  ];
  const modelOutput = makeModelOutput({
    perQuestionScores: [
      { question: "Q1", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
      { question: "Q2", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
      { question: "Q3", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
    ],
  });
  const retellSignals = makeRetellSignals({ transcriptObject, durationSeconds: 5 });

  const result = applyHardCaps({ modelOutput, retellSignals, questionsTotal: 3 });

  assert.ok(result.overallScore <= 20, `overallScore ${result.overallScore} must be <= 20 (lowest cap wins)`);
  assert.ok(
    result.hardRulesTriggered.some((r) => r.rule === "no_answers"),
    "should contain no_answers trigger",
  );
  assert.ok(
    result.hardRulesTriggered.some((r) => r.rule === "short_call"),
    "should also contain short_call trigger",
  );
  assert.equal(result.recommendation, "insufficient_data");
});

// ---------------------------------------------------------------------------
// Case 7 — call_analysis missing (sentinel substituted)
// ---------------------------------------------------------------------------

test("case 7: call_analysis missing — sentinel triggers added but no extra cap", () => {
  const modelOutput = makeModelOutput();
  const retellSignals = makeRetellSignals({
    transcriptObject: buildHealthyTranscript(),
    durationSeconds: 95,
    callAnalysisPresent: false, // the sentinel case
  });

  const result = applyHardCaps({
    modelOutput,
    retellSignals,
    questionsTotal: 3,
    questions: FULL_ACTIVE_DIM_QUESTIONS,
  });

  // agent_only_speech trigger appended with "limited signal" detail.
  const sentinelTrigger = result.hardRulesTriggered.find(
    (r) => r.rule === "agent_only_speech" && /limited signal/i.test(r.detail),
  );
  assert.ok(sentinelTrigger, "should append agent_only_speech trigger with 'limited signal' detail");
  // No additional cap applied beyond the sentinel marker.
  assert.ok(result.overallScore > 10, "score should NOT be capped at 10 by sentinel alone");
  assert.notEqual(result.recommendation, "insufficient_data");
});

// ---------------------------------------------------------------------------
// Case 8 — empty transcript_object entirely
// ---------------------------------------------------------------------------

test("case 8: empty transcript_object — agent_only_speech, cap 10", () => {
  const modelOutput = makeModelOutput({
    perQuestionScores: [
      { question: "Q1", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
      { question: "Q2", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
      { question: "Q3", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
    ],
  });
  const retellSignals = makeRetellSignals({ transcriptObject: [], durationSeconds: 30 });

  const result = applyHardCaps({ modelOutput, retellSignals, questionsTotal: 3 });

  assert.ok(
    result.hardRulesTriggered.some((r) => r.rule === "agent_only_speech"),
    "should contain agent_only_speech trigger",
  );
  assert.ok(result.overallScore <= 10, `overallScore ${result.overallScore} must be <= 10`);
  assert.equal(result.recommendation, "insufficient_data");
});

// ---------------------------------------------------------------------------
// Case 9 — computeOverallScoreFromDimensions math
// ---------------------------------------------------------------------------

test("case 9: computeOverallScoreFromDimensions — weights + math", () => {
  const dimensions = [
    { name: "role_fit", score: 8, weight: 0.25, feedback: "", evidenceQuotes: [] },
    { name: "depth_of_knowledge", score: 8, weight: 0.25, feedback: "", evidenceQuotes: [] },
    { name: "problem_solving", score: 8, weight: 0.2, feedback: "", evidenceQuotes: [] },
    { name: "examples_evidence", score: 8, weight: 0.15, feedback: "", evidenceQuotes: [] },
    { name: "communication", score: 8, weight: 0.1, feedback: "", evidenceQuotes: [] },
    { name: "professionalism", score: 8, weight: 0.05, feedback: "", evidenceQuotes: [] },
  ];

  const score = computeOverallScoreFromDimensions(dimensions);
  // All 8s → weighted avg = 8 → ×10 = 80
  assert.equal(score, 80);

  // Weights sum to 1.0 within floating-point epsilon
  const sum = dimensions.reduce((a, d) => a + d.weight, 0);
  assert.ok(Math.abs(sum - 1.0) < 1e-9, `weights must sum to 1.0; got ${sum}`);

  // Edge case: empty dimensions → 0
  assert.equal(computeOverallScoreFromDimensions([]), 0);
});

// ---------------------------------------------------------------------------
// Case 10 — countSubstantiveUserTurns heuristic
// ---------------------------------------------------------------------------

test("case 10: countSubstantiveUserTurns — counts only qualifying user turns", () => {
  const transcriptObject = [
    // Agent turn — excluded
    { role: "agent", content: "What was your role on that project? Please give specifics." },
    // User turn, 12 words — substantive (>=8 words)
    { role: "user", content: "I led the entire backend rebuild and I owned the on-call rotation too." },
    // User turn, ~50 chars but only 7 words — substantive via char count (>=40)
    { role: "user", content: "Substantive answer with many words yes here haha." },
    // User filler turn — 3 words, ~10 chars — excluded
    { role: "user", content: "yeah okay." },
    // Another agent turn — excluded
    { role: "agent", content: "Can you say more?" },
    // Empty user turn — excluded
    { role: "user", content: "" },
  ];

  const count = countSubstantiveUserTurns(transcriptObject);
  assert.equal(count, 2, "should count 2 substantive user turns");

  // Empty / null input
  assert.equal(countSubstantiveUserTurns([]), 0);
  assert.equal(countSubstantiveUserTurns(null), 0);
});

// ---------------------------------------------------------------------------
// Sanity — computeCandidateSpeakingSeconds
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// v3 rubric-aware: assessed-override coverage
// ---------------------------------------------------------------------------

test("v3: legacy interview (no tagged questions) → all active dims assessed=false", () => {
  // Per OD-A: when no question carries a targetDimension, the service forces
  // all 4 active dims to assessed:false. Only communication + professionalism
  // survive and renormalize against weight sum 0.15.
  const modelOutput = makeModelOutput();
  const retellSignals = makeRetellSignals({
    transcriptObject: buildHealthyTranscript(),
    durationSeconds: 95,
  });

  const result = applyHardCaps({
    modelOutput,
    retellSignals,
    questionsTotal: 3,
    questions: [{ targetDimension: undefined }, { targetDimension: undefined }],
  });

  // All 4 active dims should now be assessed=false.
  const dimByName = Object.fromEntries(
    result.dimensions.map((d) => [d.name, d]),
  );
  assert.equal(dimByName.role_fit.assessed, false);
  assert.equal(dimByName.depth_of_knowledge.assessed, false);
  assert.equal(dimByName.problem_solving.assessed, false);
  assert.equal(dimByName.examples_evidence.assessed, false);
  // Observational dims stay assessed=true (never overridden by absence).
  assert.equal(dimByName.communication.assessed, true);
  assert.equal(dimByName.professionalism.assessed, true);
  // overallScore renormalizes against the 0.15 observational weight sum:
  // (8*0.10 + 8*0.05) / 0.15 = 8 → ×10 = 80
  assert.equal(result.overallScore, 80);
});

test("v3: partial coverage (only role_fit tagged) → 3 active dims unassessed", () => {
  const modelOutput = makeModelOutput();
  const retellSignals = makeRetellSignals({
    transcriptObject: buildHealthyTranscript(),
    durationSeconds: 95,
  });

  const result = applyHardCaps({
    modelOutput,
    retellSignals,
    questionsTotal: 3,
    questions: [{ targetDimension: "role_fit" }],
  });

  const dimByName = Object.fromEntries(
    result.dimensions.map((d) => [d.name, d]),
  );
  assert.equal(dimByName.role_fit.assessed, true);
  assert.equal(dimByName.depth_of_knowledge.assessed, false);
  assert.equal(dimByName.problem_solving.assessed, false);
  assert.equal(dimByName.examples_evidence.assessed, false);
  assert.equal(dimByName.communication.assessed, true);
  assert.equal(dimByName.professionalism.assessed, true);
});

test("v3: no_answers fires → all 6 dims forced assessed=false", () => {
  // When the hard cap fires (no candidate signal at all), no dim is
  // meaningfully assessable, including observational ones.
  const modelOutput = makeModelOutput({
    perQuestionScores: [
      { question: "Q1", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
      { question: "Q2", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
      { question: "Q3", answered: false, score: null, summary: "Not answered", evidenceQuotes: [] },
    ],
  });
  const retellSignals = makeRetellSignals({
    transcriptObject: buildHealthyTranscript(),
    durationSeconds: 95,
  });

  const result = applyHardCaps({
    modelOutput,
    retellSignals,
    questionsTotal: 3,
    questions: FULL_ACTIVE_DIM_QUESTIONS,
  });

  // All 6 dims forced to assessed=false.
  assert.ok(
    result.dimensions.every((d) => d.assessed === false),
    "all dims should be unassessed when no_answers fires",
  );
  assert.equal(result.recommendation, "insufficient_data");
});

test("v3: computeOverallScoreFromDimensions filters unassessed + renormalizes", () => {
  // Hand-built dimensions: role_fit unassessed, others scored.
  const dims = [
    { name: "role_fit", score: 10, weight: 0.25, feedback: "", evidenceQuotes: [], assessed: false },
    { name: "depth_of_knowledge", score: 6, weight: 0.25, feedback: "", evidenceQuotes: [], assessed: true },
    { name: "problem_solving", score: 6, weight: 0.2, feedback: "", evidenceQuotes: [], assessed: true },
    { name: "examples_evidence", score: 6, weight: 0.15, feedback: "", evidenceQuotes: [], assessed: true },
    { name: "communication", score: 6, weight: 0.1, feedback: "", evidenceQuotes: [], assessed: true },
    { name: "professionalism", score: 6, weight: 0.05, feedback: "", evidenceQuotes: [], assessed: true },
  ];

  const score = computeOverallScoreFromDimensions(dims);
  // role_fit excluded → weight sum = 0.75. All remaining = 6.
  // weighted avg = (6*0.25 + 6*0.2 + 6*0.15 + 6*0.1 + 6*0.05) / 0.75 = 4.5 / 0.75 = 6 → ×10 = 60
  assert.equal(score, 60);

  // Legacy input (no `assessed` field) — behaves as before.
  const legacyDims = dims.map(({ assessed: _, ...rest }) => rest);
  const legacyScore = computeOverallScoreFromDimensions(legacyDims);
  // weighted avg = (10*0.25 + 6*0.75) / 1.0 = 2.5 + 4.5 = 7.0 → 70
  assert.equal(legacyScore, 70);

  // All unassessed → returns 0.
  const allUnassessed = dims.map((d) => ({ ...d, assessed: false }));
  assert.equal(computeOverallScoreFromDimensions(allUnassessed), 0);
});

test("sanity: computeCandidateSpeakingSeconds sums word-level user turns", () => {
  const transcriptObject = [
    makeAgentTurn("Tell me about yourself.", 0, 5),
    makeUserTurn("I am a software engineer with eight years of experience.", 5, 15), // 10s
    makeAgentTurn("Cool.", 15, 16),
    makeUserTurn("My focus has been backend systems and distributed architectures.", 16, 26), // 10s
  ];

  const speaking = computeCandidateSpeakingSeconds(transcriptObject);
  // ~20s candidate speaking time across the two user turns.
  assert.ok(speaking >= 19 && speaking <= 21, `expected ~20s, got ${speaking}`);

  // Empty / missing → 0
  assert.equal(computeCandidateSpeakingSeconds([]), 0);
  assert.equal(computeCandidateSpeakingSeconds(null), 0);
});
