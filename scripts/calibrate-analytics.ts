#!/usr/bin/env tsx
/**
 * Calibration harness for the v2 hiring-grade analytics pipeline.
 *
 * Replays historical `response` rows through `runAnalyticsV2` and emits a
 * CSV diff so operators can spot-check the new pipeline against whatever
 * was stored on each row before fully trusting it for hiring decisions.
 *
 * Usage:
 *   npx tsx scripts/calibrate-analytics.ts \
 *     [--limit N]      (default 50, hard max 500)
 *     [--since ISO]    (default now - 30 days)
 *     [--out FILE]     (default calibration-<timestamp>.csv)
 *     [--dry-run]      (print to stdout instead of file)
 *     [--yes]          (skip cost-confirmation prompt)
 *
 * Cost note: each row issues one OpenAI call (~$0.02). Default --limit 50
 * runs ~$1. The script prompts for confirmation when limit > 10 unless
 * --dry-run or --yes is set.
 *
 * Sequential by design — rows are processed strictly in series to cap
 * OpenAI rate-limit exposure. Do not parallelize without rate-limit handling.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * OPENAI_API_KEY.
 *
 * See openspec/changes/analytics-v2-followups/design.md §1 for full design.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { createClient } from "@supabase/supabase-js";

import { runAnalyticsV2 } from "../src/services/analytics.service.ts";
import type { Seniority } from "../src/types/interview.ts";
import type { AnalyticsV2 } from "../src/types/response.ts";

const HARD_MAX_LIMIT = 500;
const COST_PER_ROW_USD = 0.02;
const COST_CONFIRM_THRESHOLD = 10;

interface CliArgs {
  limit: number;
  since: string;
  out: string;
  dryRun: boolean;
  yes: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    limit: 50,
    since: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    out: `calibration-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
    dryRun: false,
    yes: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--limit":
        args.limit = Number(argv[++i]);
        break;
      case "--since":
        args.since = argv[++i];
        break;
      case "--out":
        args.out = argv[++i];
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--yes":
        args.yes = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        if (a.startsWith("--")) {
          console.error(`Unknown flag: ${a}`);
          process.exit(2);
        }
    }
  }
  return args;
}

function printHelp(): void {
  console.log(
    `\ncalibrate-analytics — replay historical responses through runAnalyticsV2\n\n` +
      `Flags:\n` +
      `  --limit N      max rows to process (default 50, hard max ${HARD_MAX_LIMIT})\n` +
      `  --since ISO    only process rows created on/after this timestamp (default 30d ago)\n` +
      `  --out FILE     output CSV path (default calibration-<timestamp>.csv)\n` +
      `  --dry-run      print CSV to stdout, do not write file\n` +
      `  --yes          skip cost-confirmation prompt\n` +
      `  --help, -h     show this message\n`,
  );
}

async function confirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

function escapeCsv(s: string | number | null | undefined): string {
  if (s === null || s === undefined) {return "";}
  const str = String(s);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const CSV_HEADER = [
  "response_id",
  "interview_name",
  "original_schema",
  "original_score",
  "v2_score",
  "v2_recommendation",
  "v2_confidence",
  "hard_rules_triggered",
  "delta",
  "has_evidence_quotes",
  "notes",
].join(",");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.limit > HARD_MAX_LIMIT) {
    console.error(
      `Maximum limit is ${HARD_MAX_LIMIT} rows per run. Use multiple runs with --since for larger windows.`,
    );
    process.exit(2);
  }
  if (args.limit <= 0) {
    console.error("--limit must be > 0");
    process.exit(2);
  }

  // ---- env check ----
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.",
    );
    process.exit(2);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing env: OPENAI_API_KEY required for runAnalyticsV2.");
    process.exit(2);
  }

  // ---- cost guard ----
  if (args.limit > COST_CONFIRM_THRESHOLD && !args.dryRun && !args.yes) {
    const estCost = (args.limit * COST_PER_ROW_USD).toFixed(2);
    const ok = await confirm(
      `\n[calibrate] About to process up to ${args.limit} rows.\n` +
        `Estimated OpenAI cost: ~$${estCost}. Proceed? [y/N] `,
    );
    if (!ok) {
      console.error("Aborted.");
      process.exit(1);
    }
  }

  // ---- supabase client (service-role, bypasses RLS — SCRIPT ONLY) ----
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.error(`[calibrate] fetching up to ${args.limit} rows since ${args.since}...`);

  // FK embed pulls the joined interview row in a single query.
  const { data: rows, error } = await supabase
    .from("response")
    .select("id, call_id, analytics, details, duration, interview_id, created_at, interview(*)")
    .not("analytics", "is", null)
    .gte("created_at", args.since)
    .order("created_at", { ascending: false })
    .limit(args.limit);

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.error("[calibrate] no rows matched. Nothing to do.");
    process.exit(0);
  }

  console.error(`[calibrate] processing ${rows.length} rows sequentially...`);

  const csvLines: string[] = [CSV_HEADER];

  // Sequential by design — caps OpenAI rate-limit exposure; cost is linear with --limit.
  let processed = 0;
  for (const row of rows) {
    processed++;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const interview = (row as any).interview as Record<string, unknown> | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const details = (row as any).details as Record<string, unknown> | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original = (row as any).analytics as Record<string, unknown> | null;

    const originalSchema =
      original && typeof original === "object" && "schemaVersion" in original
        ? `v${original.schemaVersion}`
        : "v1";
    const originalScore =
      original && typeof original.overallScore === "number"
        ? (original.overallScore as number)
        : null;

    const notes: string[] = [];
    let v2: AnalyticsV2 | null = null;

    try {
      if (!interview) {
        throw new Error("interview row missing (deleted?)");
      }
      if (!details) {
        throw new Error("response.details missing");
      }

      // Parse interview.time_duration ("30" or "30 minutes") into seconds.
      const td = (interview.time_duration as string | null) ?? "";
      const tdNumeric = Number(String(td).match(/\d+/)?.[0] ?? "0");
      const expectedDurationSeconds = tdNumeric * 60;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const co = details as any;
      v2 = await runAnalyticsV2({
        roleTitle:
          (interview.name as string) ||
          (interview.objective as string) ||
          "the role",
        companyName: "Robust Devs",
        seniority: ((interview.seniority as string) ?? "mid") as Seniority,
        jobDescription: (interview.job_description as string) ?? "",
        mustHaves: Array.isArray(interview.must_haves)
          ? (interview.must_haves as string[])
          : [],
        questions: (
          (interview.questions as Array<{ question: string }>) ?? []
        ).map((q) => ({ question: q.question })),
        expectedDurationSeconds,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transcriptObject: (co.transcript_object as any) ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callAnalysis: (co.call_analysis as any) ?? null,
        disconnectionReason: (co.disconnection_reason as string) ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        durationSeconds: Number((row as any).duration ?? 0),
      });
    } catch (err) {
      notes.push(err instanceof Error ? err.message : String(err));
    }

    const v2Score = v2 ? v2.overallScore : null;
    const v2Recommendation = v2 ? v2.recommendation : "";
    const v2Confidence = v2 ? v2.confidence : "";
    const rulesTriggered = v2
      ? v2.hardRulesTriggered.map((r) => r.rule).join("|")
      : "";
    const delta =
      v2Score !== null && originalScore !== null
        ? v2Score - originalScore
        : null;
    const evidenceQuoteCount = v2
      ? v2.dimensions.reduce((acc, d) => acc + d.evidenceQuotes.length, 0) +
        v2.perQuestionScores.reduce(
          (acc, q) => acc + q.evidenceQuotes.length,
          0,
        )
      : null;

    const interviewName =
      interview && typeof interview.name === "string"
        ? (interview.name as string)
        : "(unknown)";

    csvLines.push(
      [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        escapeCsv(String((row as any).id)),
        escapeCsv(interviewName),
        escapeCsv(originalSchema),
        escapeCsv(originalScore),
        escapeCsv(v2Score),
        escapeCsv(v2Recommendation),
        escapeCsv(v2Confidence),
        escapeCsv(rulesTriggered),
        escapeCsv(delta),
        escapeCsv(evidenceQuoteCount),
        escapeCsv(notes.join("; ")),
      ].join(","),
    );

    if (processed % 10 === 0) {
      console.error(`[calibrate] processed ${processed} / ${rows.length}`);
    }
  }

  const csvBody = csvLines.join("\n") + "\n";

  if (args.dryRun) {
    process.stdout.write(csvBody);
    console.error(`[calibrate] dry-run complete (${rows.length} rows).`);
  } else {
    const outPath = path.resolve(process.cwd(), args.out);
    await fs.writeFile(outPath, csvBody, "utf8");
    console.error(`[calibrate] wrote ${rows.length} rows to ${outPath}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
