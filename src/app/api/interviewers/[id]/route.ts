import { NextResponse, type NextRequest } from "next/server";
import Retell from "retell-sdk";

import { logger } from "@/lib/logger";
import { InterviewerService } from "@/services/interviewers.service";
import { VOICE_OPTIONS } from "@/lib/constants";
import { appendFooter, stripFooter } from "@/lib/promptFooter";
import type { Interviewer } from "@/types/interviewer";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

const ALLOWED_VOICE_IDS = new Set<string>(VOICE_OPTIONS.map((v) => v.id));

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const isTrait = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 10;

type PatchBody = {
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

// PATCH fields that, when present, require a Retell agent.update call.
const AGENT_FIELDS = ["name", "voice_id"] as const;
// PATCH fields that, when present, require a Retell llm.update call.
const LLM_FIELDS = ["prompt", "empathy", "rapport", "exploration", "speed"] as const;

// Soft-delete an interviewer. Idempotent — re-deleting an already-deleted
// row overwrites `deleted_at` and returns 200. Returns 404 only when no row
// with the given id exists at all. Intentionally does NOT call any Retell
// deletion API; the agent and LLM resources are left in Retell as an
// accepted v1 leak (documented in design.md).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { error: "`id` must be a positive integer" },
      { status: 400 },
    );
  }

  logger.info(`DELETE /api/interviewers/${id} request received`);

  try {
    const affected = await InterviewerService.deleteInterviewer(id);
    if (affected.length === 0) {
      return NextResponse.json(
        { error: "Interviewer not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logger.error(`DELETE /api/interviewers/${id} failed:`, error as object);
    const details = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: "Failed to delete interviewer",
        ...(process.env.NODE_ENV !== "production" && { details }),
      },
      { status: 500 },
    );
  }
}

// PATCH an interviewer. Atomicity policy: Retell LLM PATCH (if needed) →
// Retell agent PATCH (if needed) → DB UPDATE. Any Retell failure returns
// 500 with `type: "retell_failure"` and no DB write. A DB failure after
// Retell success returns 500 with `type: "db_failure"`; the next edit
// reapplies the same Retell state (idempotent) and reconverges. See
// design.md decision 3 and 7e.
//
// Note on the Lisa/Bob shared-LLM legacy quirk: the seed-route Lisa and Bob
// interviewers share a single Retell LLM object. Editing Lisa's prompt
// therefore also affects Bob's Retell behavior. This is pre-existing and
// not addressed by this PR.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { error: "`id` must be a positive integer" },
      { status: 400 },
    );
  }

  logger.info(`PATCH /api/interviewers/${id} request received`);

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  // Validate present fields only; reject if no recognized field is present.
  const patch: Partial<Interviewer> = {};

  if ("name" in body) {
    if (!isNonEmptyString(body.name)) {
      return NextResponse.json({ error: "`name` must be a non-empty string" }, { status: 422 });
    }
    patch.name = body.name;
  }
  if ("description" in body) {
    if (!isNonEmptyString(body.description)) {
      return NextResponse.json({ error: "`description` must be a non-empty string" }, { status: 422 });
    }
    patch.description = body.description;
  }
  if ("image" in body) {
    if (!isNonEmptyString(body.image)) {
      return NextResponse.json({ error: "`image` must be a non-empty string" }, { status: 422 });
    }
    patch.image = body.image;
  }
  if ("voice_id" in body) {
    if (!isNonEmptyString(body.voice_id) || !ALLOWED_VOICE_IDS.has(body.voice_id)) {
      return NextResponse.json(
        { error: `\`voice_id\` must be one of: ${Array.from(ALLOWED_VOICE_IDS).join(", ")}` },
        { status: 422 },
      );
    }
    patch.voice_id = body.voice_id;
  }
  if ("empathy" in body) {
    if (!isTrait(body.empathy)) {
      return NextResponse.json({ error: "`empathy` must be a number in [1, 10]" }, { status: 422 });
    }
    patch.empathy = body.empathy;
  }
  if ("rapport" in body) {
    if (!isTrait(body.rapport)) {
      return NextResponse.json({ error: "`rapport` must be a number in [1, 10]" }, { status: 422 });
    }
    patch.rapport = body.rapport;
  }
  if ("exploration" in body) {
    if (!isTrait(body.exploration)) {
      return NextResponse.json({ error: "`exploration` must be a number in [1, 10]" }, { status: 422 });
    }
    patch.exploration = body.exploration;
  }
  if ("speed" in body) {
    if (!isTrait(body.speed)) {
      return NextResponse.json({ error: "`speed` must be a number in [1, 10]" }, { status: 422 });
    }
    patch.speed = body.speed;
  }

  // Prompt body: client sends only the user-authored portion (no footer).
  // The route assembles the full prompt via appendFooter before sending to
  // Retell and storing in the DB.
  let assembledPrompt: string | undefined;
  if ("prompt" in body) {
    if (!isNonEmptyString(body.prompt)) {
      return NextResponse.json({ error: "`prompt` must be a non-empty string" }, { status: 422 });
    }
    // Defensive: if the client sent the full prompt (with footer), strip it
    // first so we never double-append. stripFooter returns the input
    // unchanged when no footer is detected.
    const promptBody = stripFooter(body.prompt);
    if (promptBody.trim().length === 0) {
      return NextResponse.json({ error: "Prompt body must not be empty" }, { status: 422 });
    }
    assembledPrompt = appendFooter(promptBody);
    patch.prompt = assembledPrompt;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Body must contain at least one recognized field" },
      { status: 400 },
    );
  }

  // Fetch the current row to learn agent_id and (possibly) retell_llm_id.
  let current: Interviewer | null;
  try {
    current = (await InterviewerService.getInterviewer(BigInt(id))) as Interviewer | null;
  } catch (error) {
    logger.error(`PATCH /api/interviewers/${id} fetch failed:`, error as object);
    const details = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: "Failed to fetch interviewer",
        type: "db_failure",
        ...(process.env.NODE_ENV !== "production" && { details }),
      },
      { status: 500 },
    );
  }

  if (!current) {
    return NextResponse.json({ error: "Interviewer not found" }, { status: 404 });
  }

  const needsLlmUpdate = LLM_FIELDS.some((f) => f in body);
  const needsAgentUpdate = AGENT_FIELDS.some((f) => f in body);

  let resolvedLlmId: string | null = current.retell_llm_id;

  try {
    // Lazy backfill: resolve retell_llm_id from the Retell agent if the
    // DB row hasn't recorded it yet AND we actually need an LLM update.
    if (needsLlmUpdate && !resolvedLlmId) {
      const agent = await retellClient.agent.retrieve(current.agent_id);
      if (agent.response_engine?.type !== "retell-llm") {
        logger.error(
          `PATCH /api/interviewers/${id}: agent ${current.agent_id} has non-retell-llm response_engine ${agent.response_engine?.type}`,
        );

        return NextResponse.json(
          {
            error:
              "This interviewer's underlying engine is not a Retell LLM. Prompt/trait edits are not supported for this engine type.",
            type: "retell_failure",
          },
          { status: 500 },
        );
      }
      resolvedLlmId = agent.response_engine.llm_id;
      // Persist the resolved id alongside the rest of the patch.
      patch.retell_llm_id = resolvedLlmId;
    }

    // Retell LLM PATCH branch (prompt or any trait slider changed).
    if (needsLlmUpdate) {
      if (!resolvedLlmId) {
        // Defensive — should be unreachable thanks to the lazy backfill above.
        return NextResponse.json(
          { error: "Could not resolve Retell LLM id", type: "retell_failure" },
          { status: 500 },
        );
      }

      // Assemble the prompt to send to Retell: use the just-assembled prompt
      // if the body included `prompt`, otherwise stripFooter→appendFooter
      // the stored prompt so trait-only edits still rewrite a clean copy.
      const llmPrompt = assembledPrompt ?? appendFooter(stripFooter(current.prompt));
      await retellClient.llm.update(resolvedLlmId, {
        general_prompt: llmPrompt,
      });
    }

    // Retell agent PATCH branch (voice_id or name changed).
    if (needsAgentUpdate) {
      const agentPatch: { voice_id?: string; agent_name?: string } = {};
      if (typeof patch.voice_id === "string") {
        agentPatch.voice_id = patch.voice_id;
      }
      if (typeof patch.name === "string") {
        agentPatch.agent_name = patch.name;
      }
      await retellClient.agent.update(current.agent_id, agentPatch);
    }
  } catch (error) {
    logger.error(`PATCH /api/interviewers/${id} Retell update failed:`, error as object);
    const details = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: "Failed to sync changes to Retell",
        type: "retell_failure",
        ...(process.env.NODE_ENV !== "production" && { details }),
      },
      { status: 500 },
    );
  }

  // DB UPDATE — Retell side already converged at this point.
  try {
    const updated = await InterviewerService.updateInterviewer(id, patch);

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    logger.error(`PATCH /api/interviewers/${id} DB update failed:`, error as object);
    const details = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: "Failed to save changes to the database",
        type: "db_failure",
        ...(process.env.NODE_ENV !== "production" && { details }),
      },
      { status: 500 },
    );
  }
}
