import { PUBLIC_TOKEN_TTL_HOURS } from "@/lib/access-control-constants";
import { getServerBaseUrl } from "@/lib/base-url";
import { logger } from "@/lib/logger";
import { InterviewService } from "@/services/interviews.service";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const url_id = nanoid();
    const url = `${getServerBaseUrl(req)}/call/${url_id}`;
    const body = await req.json();

    logger.info("create-interview request received");

    const payload = body.interviewData;

    const slugify = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    let readableSlug = null;
    if (body.organizationName) {
      const interviewNameSlug = slugify(payload.name ?? "");
      const orgNameSlug = slugify(body.organizationName ?? "");
      readableSlug = [orgNameSlug, interviewNameSlug].filter(Boolean).join("-");
      if (!readableSlug) {
        readableSlug = null;
      }
    }

    if (payload?.invite_only === true && payload?.is_anonymous === true) {
      return NextResponse.json(
        { error: "invite-only-incompatible-with-anonymous" },
        { status: 422 },
      );
    }

    const publicTokenExpiresAt = new Date(
      Date.now() + PUBLIC_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const newInterview = await InterviewService.createInterview({
      ...payload,
      url: url,
      id: url_id,
      readable_slug: readableSlug,
      public_token: crypto.randomUUID(),
      public_token_expires_at: publicTokenExpiresAt,
    });

    logger.info("Interview created successfully");

    return NextResponse.json({ response: "Interview created successfully" }, { status: 200 });
  } catch (err) {
    logger.error("Error creating interview");

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
