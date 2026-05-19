import { logger } from "@/lib/logger";
import { InterviewerService } from "@/services/interviewers.service";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";
import Retell from "retell-sdk";
import {
  INTERVIEWERS,
  RETELL_AGENT_GENERAL_PROMPT,
  RETELL_AGENT_ROBUST_BOT_PROMPT,
} from "@/lib/constants";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

// NOTE: This route is not idempotent — calling it multiple times will create
// duplicate Retell agents and interviewer rows for Lisa, Bob, and Robust Bot.
// Pre-existing issue; tracked for a future `fix-create-interviewer-idempotency`
// change.
export async function GET(res: NextRequest) {
  logger.info("create-interviewer request received");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  );

  try {
    const newModel = await retellClient.llm.create({
      model: "gpt-4o",
      general_prompt: RETELL_AGENT_GENERAL_PROMPT,
      general_tools: [
        {
          type: "end_call",
          name: "end_call_1",
          description:
            "End the call if the user uses goodbye phrases such as 'bye,' 'goodbye,' or 'have a nice day.' ",
        },
      ],
    });

    // Create Lisa
    const newFirstAgent = await retellClient.agent.create({
      response_engine: { llm_id: newModel.llm_id, type: "retell-llm" },
      voice_id: "11labs-Chloe",
      agent_name: "Lisa",
    });

    const newInterviewer = await InterviewerService.createInterviewer(
      {
        agent_id: newFirstAgent.agent_id,
        ...INTERVIEWERS.LISA,
      },
      supabase,
    );

    // Create Bob
    const newSecondAgent = await retellClient.agent.create({
      response_engine: { llm_id: newModel.llm_id, type: "retell-llm" },
      voice_id: "11labs-Brian",
      agent_name: "Bob",
    });

    const newSecondInterviewer = await InterviewerService.createInterviewer(
      {
        agent_id: newSecondAgent.agent_id,
        ...INTERVIEWERS.BOB,
      },
      supabase,
    );

    // Robust Bot uses its own dedicated Retell LLM so it can carry the
    // probing first-round screening prompt without affecting Lisa/Bob.
    const robustBotModel = await retellClient.llm.create({
      model: "gpt-4o",
      general_prompt: RETELL_AGENT_ROBUST_BOT_PROMPT,
      general_tools: [
        {
          type: "end_call",
          name: "end_call_1",
          description:
            "End the call if the user uses goodbye phrases such as 'bye,' 'goodbye,' or 'have a nice day.' ",
        },
      ],
    });

    const robustBotAgent = await retellClient.agent.create({
      response_engine: { llm_id: robustBotModel.llm_id, type: "retell-llm" },
      voice_id: "11labs-Brian",
      agent_name: "Robust Bot",
    });

    const newThirdInterviewer = await InterviewerService.createInterviewer(
      {
        agent_id: robustBotAgent.agent_id,
        ...INTERVIEWERS.ROBUST_BOT,
      },
      supabase,
    );

    logger.info("");

    return NextResponse.json(
      {
        newInterviewer,
        newSecondInterviewer,
        newThirdInterviewer,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Error creating interviewers:", error as object);

    const details =
      error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: "Failed to create interviewers",
        ...(process.env.NODE_ENV !== "production" && { details }),
      },
      { status: 500 },
    );
  }
}
