/**
 * POST /api/validate-question-coverage
 *
 * LLM-based semantic coverage gap check. Used by the preflight validator on
 * the create-interview Save flow when the rule-based check (every active
 * dimension has ≥1 tagged question) passes AND the operator hasn't manually
 * edited the question list since generation.
 *
 * Determinism: temperature=0, seed=7, response_format: json_schema strict.
 * Model: gpt-4o-mini-2024-07-18 (cheap, quick gap check).
 *
 * Body: { jobDescription, mustHaves, questions }
 * Returns:
 *   200 { uncovered_must_haves: string[], semantic_gaps: string[] }  (max 5 each)
 *   400 { error } — invalid body
 *   200 with semantic_gaps containing a "validator unavailable" sentinel when the
 *       upstream model fails (degrades gracefully — never blocks Save).
 *
 * Auth: Clerk-protected by middleware (not in public allow-list).
 */

import { NextResponse } from "next/server";
import { OpenAI } from "openai";

import { logger } from "@/lib/logger";

const SYSTEM_PROMPT_VALIDATOR =
  "You are a hiring-interview coverage validator. Given a job description, a list of must-haves, and a question set, identify (a) must-haves that no question plausibly probes, and (b) free-text semantic gaps in the question set (e.g., 'no question targets leadership' when the JD requires team leadership). Return JSON matching the schema. Be concise — max 5 items per array.";

const VALIDATE_COVERAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["uncovered_must_haves", "semantic_gaps"],
  properties: {
    uncovered_must_haves: {
      type: "array",
      items: { type: "string" },
    },
    semantic_gaps: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export async function POST(req: Request) {
  let body: {
    jobDescription?: unknown;
    mustHaves?: unknown;
    questions?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobDescription =
    typeof body.jobDescription === "string" ? body.jobDescription : "";
  const mustHaves = Array.isArray(body.mustHaves)
    ? (body.mustHaves as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const questions = Array.isArray(body.questions)
    ? (body.questions as Array<Record<string, unknown>>).map((q) => ({
        question: typeof q.question === "string" ? q.question : "",
        targetDimension:
          typeof q.targetDimension === "string" ? q.targetDimension : undefined,
        rubricNote:
          typeof q.rubricNote === "string" ? q.rubricNote : undefined,
      }))
    : [];

  // No questions or no must-haves AND no JD → nothing to validate semantically.
  if (questions.length === 0) {
    return NextResponse.json(
      { uncovered_must_haves: [], semantic_gaps: [] },
      { status: 200 },
    );
  }

  const prompt = `Job Description:
${jobDescription.trim() || "(none provided)"}

Must-haves:
${mustHaves.length ? mustHaves.map((m) => `- ${m}`).join("\n") : "(none)"}

Question set (with dimension tags):
${questions.map((q, i) => `${i + 1}. (${q.targetDimension ?? "untagged"}) ${q.question}${q.rubricNote ? ` [rubricNote: ${q.rubricNote}]` : ""}`).join("\n")}

Identify:
1. Each must-have that no question plausibly probes (uncovered_must_haves). If a must-have is implicitly covered by a question's rubricNote or text, do NOT list it.
2. Semantic gaps — JD requirements or skills the question set fails to probe (semantic_gaps). Max 5 entries.

Return JSON: { "uncovered_must_haves": string[], "semantic_gaps": string[] }`;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 0, // no retries — degrade gracefully on first failure
    timeout: 15_000, // hard cap; this is a soft-warning check, not a blocker
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini-2024-07-18",
      temperature: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seed: 7 as any,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_VALIDATOR },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "validate_coverage",
          strict: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          schema: VALIDATE_COVERAGE_SCHEMA as any,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    const content = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as {
      uncovered_must_haves: string[];
      semantic_gaps: string[];
    };
    return NextResponse.json(parsed, { status: 200 });
  } catch (err) {
    logger.warn("validate-question-coverage upstream error — degrading", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        uncovered_must_haves: [],
        semantic_gaps: ["validator unavailable — proceed at your own risk"],
      },
      { status: 200 },
    );
  }
}
