/**
 * Renders the `{{coverage_checklist}}` string injected into the agent's prompt
 * at register-call time. See openspec rubric-aware-interviewer-and-questions §5.
 */

import type { Question } from "@/types/interview";

const DIMENSION_LABEL: Record<string, string> = {
  role_fit: "role_fit",
  depth_of_knowledge: "depth_of_knowledge",
  problem_solving: "problem_solving",
  examples_evidence: "examples_evidence",
};

/**
 * Build a numbered list, one line per tagged question:
 *   N. {{dimension}} — {{rubricNote}}
 *
 * Untagged questions emit `N. (untagged)` — they should not occur for
 * newly-created interviews because the preflight validator blocks them, but
 * legacy interviews predating the rubric-aware change will still flow through
 * here. The presence of any untagged question is logged by the caller.
 */
export function buildCoverageChecklist(
  questions: Question[] | null | undefined,
): string {
  if (!Array.isArray(questions) || questions.length === 0) {
    return "(no questions defined)";
  }
  return questions
    .map((q, i) => {
      const dim = q.targetDimension ? DIMENSION_LABEL[q.targetDimension] ?? q.targetDimension : null;
      const note = q.rubricNote?.trim() || "";
      if (!dim) {
        return `${i + 1}. (untagged)`;
      }
      if (note) {
        return `${i + 1}. ${dim} — ${note}`;
      }
      return `${i + 1}. ${dim}`;
    })
    .join("\n");
}

/**
 * True if the question list has at least one entry missing `targetDimension`.
 * Used to log a warning when register-call assembles the checklist for a
 * legacy interview.
 */
export function hasUntaggedQuestions(
  questions: Question[] | null | undefined,
): boolean {
  if (!Array.isArray(questions)) {return false;}
  return questions.some((q) => !q.targetDimension);
}
