import { NextResponse } from "next/server";
import { OpenAI } from "openai";

import { logger } from "@/lib/logger";
import {
  GENERATE_QUESTIONS_JSON_SCHEMA,
  SYSTEM_PROMPT,
  generateQuestionsPrompt,
  type GenerateQuestionsArgs,
} from "@/lib/prompts/generate-questions";

export const maxDuration = 60;

const VALID_SENIORITIES = new Set([
  "junior",
  "mid",
  "senior",
  "staff",
  "principal",
]);
const VALID_DIMENSIONS = new Set([
  "role_fit",
  "depth_of_knowledge",
  "problem_solving",
  "examples_evidence",
]);

export async function POST(req: Request) {
  logger.info("generate-interview-questions request received");
  let body: Partial<GenerateQuestionsArgs>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ---- Validate inputs ----
  const number = Number(body.number);
  const isFillGaps =
    Array.isArray(body.missingDimensions) && body.missingDimensions.length > 0;

  if (!isFillGaps && (!Number.isInteger(number) || number < 4 || number > 8)) {
    return NextResponse.json(
      {
        error:
          "`number` must be an integer between 4 and 8 (inclusive) for full-generation mode",
      },
      { status: 400 },
    );
  }
  if (body.seniority && !VALID_SENIORITIES.has(body.seniority)) {
    return NextResponse.json(
      { error: "`seniority` must be one of junior|mid|senior|staff|principal" },
      { status: 400 },
    );
  }
  if (isFillGaps) {
    for (const d of body.missingDimensions ?? []) {
      if (!VALID_DIMENSIONS.has(d)) {
        return NextResponse.json(
          { error: `Invalid missingDimensions entry: ${d}` },
          { status: 400 },
        );
      }
    }
  }

  const args: GenerateQuestionsArgs = {
    name: body.name ?? "",
    objective: body.objective ?? "",
    number,
    context: body.context ?? "",
    jobDescription: body.jobDescription ?? "",
    mustHaves: Array.isArray(body.mustHaves) ? body.mustHaves : [],
    seniority: body.seniority ?? "mid",
    missingDimensions: body.missingDimensions,
    existingQuestions: body.existingQuestions,
  };

  // maxRetries: 1 (not 3) + explicit per-request timeout to stay well inside
  // Vercel's 60s function limit. 3 retries × ~15s = 60s = function killed
  // before we ever see the error. With 1 retry × 25s = 50s max, leaving
  // headroom to log the failure and respond.
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 25_000,
  });

  try {
    const baseCompletion = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      temperature: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seed: 7 as any,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: generateQuestionsPrompt(args) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "generate_questions",
          strict: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          schema: GENERATE_QUESTIONS_JSON_SCHEMA as any,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    const content = baseCompletion.choices[0]?.message?.content;
    if (!content) {
      logger.error("Generator returned empty content");
      return NextResponse.json(
        { error: "Generator returned no content" },
        { status: 502 },
      );
    }

    logger.info("Interview questions generated successfully", {
      mode: isFillGaps ? "fill_gaps" : "full",
      number,
      seniority: args.seniority,
    });

    return NextResponse.json({ response: content }, { status: 200 });
  } catch (error) {
    // Surface as much detail as possible — OpenAI SDK errors have a `status`
    // and sometimes a structured `error.error.message`. Without this, hangs
    // and 5xx errors are indistinguishable in the logs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    logger.error("Error generating interview questions", {
      message: err?.message ?? String(error),
      status: err?.status ?? null,
      openaiCode: err?.code ?? null,
      openaiType: err?.error?.type ?? null,
      openaiMessage: err?.error?.message ?? null,
    });
    const isTimeout =
      err?.name === "APITimeoutError" || /timeout/i.test(err?.message ?? "");
    return NextResponse.json(
      {
        error: isTimeout
          ? "Question generation timed out. Please retry — the model service is slow right now."
          : "Could not generate questions. Please retry.",
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
