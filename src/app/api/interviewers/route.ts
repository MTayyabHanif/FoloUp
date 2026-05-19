import { NextResponse, type NextRequest } from "next/server";
import Retell from "retell-sdk";
import { createClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { InterviewerService } from "@/services/interviewers.service";
import { PROMPT_FOOTER_TEMPLATE, VOICE_OPTIONS } from "@/lib/constants";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

// Trim leading/trailing whitespace and normalize line endings so the footer
// presence check is robust to CRLF, trailing spaces, and extra blank lines.
const normalizeWhitespace = (s: string): string =>
  s.replace(/\r\n/g, "\n").trim();

const ALLOWED_VOICE_IDS = new Set<string>(VOICE_OPTIONS.map((v) => v.id));

type CreateBody = {
  name?: unknown;
  description?: unknown;
  image?: unknown;
  voice_id?: unknown;
  prompt?: unknown;
  empathy?: unknown;
  rapport?: unknown;
  exploration?: unknown;
  speed?: unknown;
};

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const isTrait = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 10;

export async function POST(req: NextRequest) {
  logger.info("POST /api/interviewers request received");

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Field validation
  if (!isNonEmptyString(body.name)) {
    return NextResponse.json({ error: "`name` is required" }, { status: 422 });
  }
  if (!isNonEmptyString(body.description)) {
    return NextResponse.json(
      { error: "`description` is required" },
      { status: 422 },
    );
  }
  if (!isNonEmptyString(body.image)) {
    return NextResponse.json({ error: "`image` is required" }, { status: 422 });
  }
  if (!isNonEmptyString(body.voice_id)) {
    return NextResponse.json(
      { error: "`voice_id` is required" },
      { status: 422 },
    );
  }
  if (!ALLOWED_VOICE_IDS.has(body.voice_id)) {
    return NextResponse.json(
      {
        error: `\`voice_id\` must be one of: ${Array.from(ALLOWED_VOICE_IDS).join(", ")}`,
      },
      { status: 422 },
    );
  }
  if (!isNonEmptyString(body.prompt)) {
    return NextResponse.json(
      { error: "`prompt` is required" },
      { status: 422 },
    );
  }
  if (
    !isTrait(body.empathy) ||
    !isTrait(body.rapport) ||
    !isTrait(body.exploration) ||
    !isTrait(body.speed)
  ) {
    return NextResponse.json(
      { error: "`empathy`, `rapport`, `exploration`, `speed` must be numbers in [1, 10]" },
      { status: 422 },
    );
  }

  // Footer-presence validation (whitespace-normalized)
  const normalizedPrompt = normalizeWhitespace(body.prompt);
  const normalizedFooter = normalizeWhitespace(PROMPT_FOOTER_TEMPLATE);
  if (!normalizedPrompt.includes(normalizedFooter)) {
    return NextResponse.json(
      {
        error:
          "Prompt is missing the required footer template. Submit the prompt through the create form, or include PROMPT_FOOTER_TEMPLATE verbatim.",
      },
      { status: 422 },
    );
  }

  // Empty-body validation: the user-authored portion (everything BEFORE the
  // footer suffix) must be non-empty after trimming. Prevents a prompt that
  // is just the footer with no personality instructions.
  const footerIdx = normalizedPrompt.lastIndexOf(normalizedFooter);
  const promptBody = normalizedPrompt.slice(0, footerIdx).trim();
  if (promptBody.length === 0) {
    return NextResponse.json(
      { error: "Prompt body must not be empty" },
      { status: 422 },
    );
  }

  // 3-resource provisioning: Retell LLM → Retell agent → DB row. On partial
  // failure we surface 500 and accept the orphan Retell resources as a v1
  // cost (documented in design.md).
  try {
    const newModel = await retellClient.llm.create({
      model: "gpt-4o",
      general_prompt: body.prompt,
      general_tools: [
        {
          type: "end_call",
          name: "end_call_1",
          description:
            "End the call if the user uses goodbye phrases such as 'bye,' 'goodbye,' or 'have a nice day.' ",
        },
      ],
    });

    const newAgent = await retellClient.agent.create({
      response_engine: { llm_id: newModel.llm_id, type: "retell-llm" },
      voice_id: body.voice_id,
      agent_name: body.name,
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    );

    const created = await InterviewerService.createInterviewer(
      {
        agent_id: newAgent.agent_id,
        name: body.name,
        description: body.description,
        image: body.image,
        audio: "",
        voice_id: body.voice_id,
        prompt: body.prompt,
        empathy: body.empathy,
        rapport: body.rapport,
        exploration: body.exploration,
        speed: body.speed,
      } as Parameters<typeof InterviewerService.createInterviewer>[0],
      supabase,
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error("POST /api/interviewers failed:", error as object);
    const details = error instanceof Error ? error.message : String(error);
    
return NextResponse.json(
      {
        error: "Failed to create interviewer",
        ...(process.env.NODE_ENV !== "production" && { details }),
      },
      { status: 500 },
    );
  }
}
