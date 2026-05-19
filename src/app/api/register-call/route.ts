import { randomUUID } from "crypto";

import { logger } from "@/lib/logger";
import { InterviewerService } from "@/services/interviewers.service";
import { NextResponse } from "next/server";
import Retell from "retell-sdk";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

export async function POST(req: Request) {
  logger.info("register-call request received");

  const body = await req.json();

  const interviewerId = body.interviewer_id;
  const interviewer = await InterviewerService.getInterviewer(interviewerId);

  const registerCallResponse = await retellClient.call.createWebCall({
    agent_id: interviewer?.agent_id,
    retell_llm_dynamic_variables: body.dynamic_data,
  });

  // Mint a per-attempt session token. The client appends ?session=<token>
  // to the URL after Start; on reload within 60s the client uses
  // /api/check-session to reconnect to the same response row.
  const sessionToken = randomUUID();

  logger.info("Call registered successfully");

  return NextResponse.json(
    {
      registerCallResponse,
      session_token: sessionToken,
    },
    { status: 200 },
  );
}
