/**
 * Generate-questions prompt + JSON schema for the rubric-aware generator.
 *
 * See openspec/changes/rubric-aware-interviewer-and-questions/design.md §2.
 */

import {
  ACTIVE_DIMENSIONS,
  DIMENSION_RUBRIC_HINT,
  ACTIVE_DIM_ALLOCATION,
} from "@/lib/constants";
import type { ActiveDimension, Question, Seniority } from "@/types/interview";

export const SYSTEM_PROMPT =
  "You are an interview-question architect. You design questions that are explicitly aligned with a hiring rubric — every question targets exactly one of four active rubric dimensions, and every question carries a `rubricNote` that tells a downstream evaluator what kind of evidence to look for in the candidate's answer. You produce JSON matching the enforced response_format schema. No prose.";

export interface GenerateQuestionsArgs {
  name: string;
  objective: string;
  /** numQuestions, must be 4 ≤ n ≤ 8 (validated by the route). */
  number: number;
  context: string;
  // v3 rubric-aware inputs (additive)
  jobDescription?: string;
  mustHaves?: string[];
  seniority?: Seniority;
  /** "Fill gaps only" mode — when set, generator targets exactly these dims and ignores the allocation matrix. */
  missingDimensions?: ActiveDimension[];
  /** "Fill gaps only" mode — existing questions for context (not regenerated). */
  existingQuestions?: Array<Pick<Question, "question" | "targetDimension">>;
}

function renderAllocationBlock(
  seniority: Seniority,
  numQuestions: number,
): string {
  // Only valid for 4..8 — caller validates.
  const cell =
    ACTIVE_DIM_ALLOCATION[seniority]?.[numQuestions as 4 | 5 | 6 | 7 | 8];
  if (!cell) {
    return "(allocation unavailable — produce a balanced set with each active dimension covered at least once)";
  }
  return Object.entries(cell)
    .map(([dim, n]) => `- ${dim}: ${n} question(s)`)
    .join("\n");
}

function renderDimensionHints(): string {
  return ACTIVE_DIMENSIONS.map(
    (d) => `- ${d} — ${DIMENSION_RUBRIC_HINT[d]}`,
  ).join("\n");
}

export const generateQuestionsPrompt = (args: GenerateQuestionsArgs): string => {
  const seniority = args.seniority ?? "mid";
  const mustHavesStr = (args.mustHaves ?? []).length
    ? (args.mustHaves ?? []).join(", ")
    : "(none provided)";
  const jdStr = (args.jobDescription ?? "").trim() || "(none provided)";

  // ---- Fill-gaps mode ----
  if (args.missingDimensions && args.missingDimensions.length > 0) {
    const existingStr =
      (args.existingQuestions ?? [])
        .map(
          (q, i) =>
            `${i + 1}. (${q.targetDimension ?? "untagged"}) ${q.question}`,
        )
        .join("\n") || "(none)";
    return `You are FILLING COVERAGE GAPS on an existing interview question set.

Existing questions (do NOT regenerate these):
${existingStr}

Active rubric dimensions and what each probes:
${renderDimensionHints()}

The existing set is missing coverage for these dimensions:
${args.missingDimensions.map((d) => `- ${d}`).join("\n")}

You must produce EXACTLY ${args.missingDimensions.length} new questions — one per missing dimension above, tagged accordingly.

Interview context:
- Title: ${args.name}
- Objective: ${args.objective}
- Seniority: ${seniority}
- Job Description: ${jdStr}
- Must-haves: ${mustHavesStr}
- Additional context: ${args.context || "(none)"}

Each new question must carry:
- question: the prompt to ask the candidate (≤30 words, open-ended, professional)
- targetDimension: one of role_fit | depth_of_knowledge | problem_solving | examples_evidence — MUST match the missing dimension assignment
- rubricNote: a one-line coaching string for the scorer explaining what kind of evidence to look for

Return JSON: { "questions": [{ "question", "targetDimension", "rubricNote" }, ...], "description": "" }
(description may be an empty string in fill-gaps mode — caller will not use it.)`;
  }

  // ---- Full generation mode ----
  return `You are designing a hiring interview question set ALIGNED WITH A SCORING RUBRIC.

Interview Title: ${args.name}
Interview Objective: ${args.objective}
Seniority: ${seniority}
Job Description: ${jdStr}
Must-haves: ${mustHavesStr}
Additional context: ${args.context || "(none)"}

Number of questions to produce: ${args.number}

Active rubric dimensions and what each probes:
${renderDimensionHints()}

For a ${seniority} role at ${args.number} questions, allocate exactly:
${renderAllocationBlock(seniority, args.number)}

Each question must carry three fields:
- question: the prompt to ask the candidate (≤30 words, open-ended, professional, no closed-yes/no)
- targetDimension: exactly one of role_fit | depth_of_knowledge | problem_solving | examples_evidence
- rubricNote: a one-line coaching string for the scorer ("look for ____ in the answer") — used by the scorer DIRECTLY, not shown to operators

Hard rules:
- Each question targets exactly ONE dimension — pick the strongest fit.
- The TOTAL distribution across questions MUST match the allocation table above exactly.
- Communication and professionalism are observational dimensions; do NOT tag any question to them, and do NOT dedicate questions to them.
- If the job description names specific technologies/skills, weave at least one into a depth_of_knowledge or problem_solving question.
- If must-haves are non-empty, ensure at least one question probes the strongest must-have (typically role_fit or depth_of_knowledge).

Also produce a 50-word-or-less second-person description of the interview for the candidate. Don't paste the objective verbatim. Field name: 'description'.

Return JSON: { "questions": [{ "question", "targetDimension", "rubricNote" }, ...], "description": string }`;
};

// ============================================================================
// JSON Schema — enforced by OpenAI response_format: json_schema strict
// ============================================================================

export const GENERATE_QUESTIONS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions", "description"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "targetDimension", "rubricNote"],
        properties: {
          question: { type: "string" },
          targetDimension: {
            type: "string",
            enum: [
              "role_fit",
              "depth_of_knowledge",
              "problem_solving",
              "examples_evidence",
            ],
          },
          rubricNote: { type: "string" },
        },
      },
    },
    description: { type: "string" },
  },
} as const;
