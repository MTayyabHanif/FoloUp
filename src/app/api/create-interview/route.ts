import { logger } from "@/lib/logger";
import { InterviewService } from "@/services/interviews.service";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;

export async function POST(req: Request) {
  try {
    const url_id = nanoid();
    const url = `${base_url}/call/${url_id}`;
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

    const newInterview = await InterviewService.createInterview({
      ...payload,
      url: url,
      id: url_id,
      readable_slug: readableSlug,
    });

    logger.info("Interview created successfully");

    return NextResponse.json({ response: "Interview created successfully" }, { status: 200 });
  } catch (err) {
    logger.error("Error creating interview");

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
