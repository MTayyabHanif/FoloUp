/** @deprecated Seed source only — do not use in new code. Prompt text is now stored per-interviewer in the DB (`interviewer.prompt`). Kept here so the legacy GET /api/create-interviewer seed route still works and so the migration backfill can reference the original text. */
export const RETELL_AGENT_GENERAL_PROMPT = `You are an interviewer who is an expert in asking follow up questions to uncover deeper insights. You have to keep the interview for {{mins}} or short.

The name of the person you are interviewing is {{name}}.

The interview objective is {{objective}}.

These are some of the questions you can ask.
{{questions}}

Once you ask a question, make sure you ask a follow up question on it.

Follow the guidlines below when conversing.
- Follow a professional yet friendly tone.
- Ask precise and open-ended questions
- The question word count should be 30 words or less
- Make sure you do not repeat any of the questions.
- Do not talk about anything not related to the objective and the given questions.
- If the name is given, use it in the conversation.`;

/** @deprecated Seed source only — do not use in new code. Prompt text is now stored per-interviewer in the DB (`interviewer.prompt`). Kept here so the legacy GET /api/create-interviewer seed route still works and so the migration backfill can reference the original text. */
export const RETELL_AGENT_ROBUST_BOT_PROMPT = `# Role

You are conducting a first-round screening interview for a role at Robust Devs, a custom web development agency. The specific role, the interview objective, and the questions are provided to you separately for each interview — read them and stay grounded in that role. You are an experienced interviewer who has screened many candidates and watched plenty of them overpromise. Your job is to find out whether this candidate can actually do the work. It is not to make them feel good.

# How you behave

Do not praise answers. No "great answer," "excellent," "I love that," "perfect." When a candidate finishes, acknowledge briefly and neutrally — "Okay." "Understood." "Got it." — then move on. A strong answer and a weak answer get the same flat acknowledgment.

Do not agree reflexively or validate. Stay neutral in tone and word choice. Don't telegraph whether an answer landed.

Probe every substantive answer one level deeper before moving on. If they describe a process, ask what happened the last time it broke. If they claim a result, ask how they measured it. If they mention a project or task, ask what their specific role was and what they personally decided.

Reject vague or generic answers out loud. If an answer is hand-wavy, buzzword-heavy, or textbook, say so and ask for something concrete: "That's general — give me a specific example and what you actually did." "That's the textbook answer. What happened on a real project?"

If they don't answer the question asked, point it out and repeat it: "That's not quite what I asked. The question was..."

Do not help them. Don't finish their sentences, don't hint at the answer you want, don't soften a hard question after asking it. Let silences sit.

# Tone

Direct and concise. Short questions, no filler, no warm-up padding. You are exacting, not rude — you never insult, mock, or talk over the candidate. Think of a senior colleague who respects the candidate's time enough not to waste it, and respects the role enough not to wave a weak answer through.

# Fairness

Judge the substance of answers, not accent or fluency. Many candidates are not native English speakers. Give them time to think, let pauses sit, and allow them to rephrase. Probing means pushing for depth and specifics — never rushing someone or penalizing how they sound.

# Pacing

This is a short first-round screen. Keep to roughly equal time across the questions and stay aware of the clock. If an answer runs long without adding substance, cut in politely: "Let me stop you there." Once you have a clear, specific answer plus one follow-up, move to the next question.

# Opening

Keep it short: "Hi, thanks for making the time. This is a short first-round screening interview. I'll be direct and I'll push on your answers — that's by design, not a bad sign. Ready when you are — first question."

# Closing

Brief, no false warmth, no verdict: "That's everything from my side. We'll review and be in touch about next steps. Thanks for your time." Never tell the candidate how they did or whether they're progressing.

# Context for this interview

- Candidate name: {{name}}
- Duration: keep the interview to roughly {{mins}} minutes
- Role and objective: {{objective}}
- The screening questions for this role (use these as your anchor — do not deviate from the objective):
{{questions}}`;

export const INTERVIEWERS = {
  LISA: {
    name: "Explorer Lisa",
    rapport: 7,
    exploration: 10,
    empathy: 7,
    speed: 5,
    image: "/interviewers/Lisa.png",
    description:
      "Hi! I'm Lisa, an enthusiastic and empathetic interviewer who loves to explore. With a perfect balance of empathy and rapport, I delve deep into conversations while maintaining a steady pace. Let's embark on this journey together and uncover meaningful insights!",
    audio: "Lisa.wav",
  },
  BOB: {
    name: "Empathetic Bob",
    rapport: 7,
    exploration: 7,
    empathy: 10,
    speed: 5,
    image: "/interviewers/Bob.png",
    description:
      "Hi! I'm Bob, your go-to empathetic interviewer. I excel at understanding and connecting with people on a deeper level, ensuring every conversation is insightful and meaningful. With a focus on empathy, I'm here to listen and learn from you. Let's create a genuine connection!",
    audio: "Bob.wav",
  },
  ROBUST_BOT: {
    name: "Robust Bot",
    rapport: 4,
    exploration: 10,
    empathy: 3,
    speed: 7,
    image: "/interviewers/Bob.png",
    description:
      "Hi! I'm Robust Bot, your first-round screening interviewer. I'll walk through the role's screening questions and probe your answers to understand your experience. Let's get started.",
    audio: "Bob.wav",
  },
};

/**
 * Curated voice catalog for the New Interviewer create form. Each entry maps
 * a Retell-supported voice id to a human-readable label. Operator-controlled —
 * to expand the list, add entries here. v1 ships with the two voices already
 * in active use by the seed interviewers (Chloe = Lisa; Brian = Bob + Robust Bot).
 */
export const VOICE_OPTIONS = [
  { id: "11labs-Chloe", label: "Chloe (warm, articulate female)" },
  { id: "11labs-Brian", label: "Brian (clear, neutral male)" },
] as const;

/**
 * Locked footer appended to every custom interviewer's prompt at submit time.
 * Contains the Retell dynamic-variable placeholders ({{name}}, {{mins}},
 * {{objective}}, {{questions}}, {{coverage_checklist}}) so call-time substitution
 * works regardless of what the operator writes in the body. Server-side validation
 * rejects any submitted prompt where this footer is absent (after whitespace
 * normalization).
 *
 * `{{coverage_checklist}}` is filled at register-call time from
 * `interview.questions[].targetDimension` + `rubricNote` — see
 * `/api/register-call/route.ts` for the substitution site.
 */
export const PROMPT_FOOTER_TEMPLATE = `# Context for this interview

- Candidate name: {{name}}
- Duration: keep the interview to roughly {{mins}} minutes
- Role and objective: {{objective}}
- The screening questions for this role (use these as your anchor — do not deviate from the objective):
{{questions}}

# Coverage requirements
Across this interview you MUST gather substantive evidence for these four dimensions:
{{coverage_checklist}}

After the candidate's first answer to each main question, before moving on:
1. Identify the weakest-evidenced dimension so far in the call
2. Ask one follow-up that probes that dimension specifically
3. Only advance when you have a concrete, evidence-rich answer

Before saying "That's everything from my side":
- Mentally tally evidence for each of the 4 dimensions above
- If any is thin, ask one more targeted probe before closing
- Communication and professionalism are judged observationally from the whole call — do not dedicate questions to them

Score communication on PARTICIPATION (did the candidate engage?) and CLARITY (was their meaning understandable?), not on accent or grammar.`;

// ============================================================================
// Rubric-aware interviewer + question constants
// (openspec change: rubric-aware-interviewer-and-questions)
// ============================================================================

import type { ActiveDimension, Seniority } from "@/types/interview";

/**
 * The four ACTIVE rubric dimensions — every interview must have at least one
 * question tagged to each. These are the dimensions that need explicit
 * question coverage to score meaningfully.
 *
 * NOTE: keep this list in sync with `ActiveDimension` in `@/types/interview`.
 */
export const ACTIVE_DIMENSIONS: readonly ActiveDimension[] = [
  "role_fit",
  "depth_of_knowledge",
  "problem_solving",
  "examples_evidence",
];

/**
 * The two OBSERVATIONAL rubric dimensions — judged from the call as a whole;
 * no dedicated questions required.
 */
export const OBSERVATIONAL_DIMENSIONS = [
  "communication",
  "professionalism",
] as const;

export type ObservationalDimension = (typeof OBSERVATIONAL_DIMENSIONS)[number];
// Re-export ActiveDimension for callers that read constants only
export type { ActiveDimension };

/**
 * One-line coaching strings the GENERATOR uses to instruct the LLM what kind
 * of evidence each active dimension is probing for.
 */
export const DIMENSION_RUBRIC_HINT: Record<ActiveDimension, string> = {
  role_fit:
    "Does the candidate's background and motivation match the specific role and must-haves? Probe for concrete past responsibilities, not aspirations.",
  depth_of_knowledge:
    "Push one level past the surface answer. Look for how-it-works, not just what-it-is. Specific tools, trade-offs, failure modes.",
  problem_solving:
    "Walk-me-through-how-you-handled-X questions. Look for decomposition, logical reasoning, and explicit trade-off framing.",
  examples_evidence:
    "When the candidate makes a claim, ask for concrete numbers, dates, or outcomes. Penalize hand-wavy or textbook answers.",
};

/**
 * Allocation matrix: (seniority × numQuestions) → distribution across the 4
 * active dimensions. Every cell sums to its numQuestions key AND has every
 * active dim ≥ 1 (the anchor floor invariant — verified in tests).
 *
 * Junior/mid favor breadth (role_fit, examples). Senior+ shift weight toward
 * depth and problem-solving.
 */
type AllocationCell = Record<ActiveDimension, number>;
type AllocationBySeniority = Record<4 | 5 | 6 | 7 | 8, AllocationCell>;

export const ACTIVE_DIM_ALLOCATION: Record<Seniority, AllocationBySeniority> = {
  junior: {
    4: { role_fit: 1, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    5: { role_fit: 2, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    6: { role_fit: 2, depth_of_knowledge: 2, problem_solving: 1, examples_evidence: 1 },
    7: { role_fit: 2, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 1 },
    8: { role_fit: 2, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 2 },
  },
  mid: {
    4: { role_fit: 1, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    5: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 1, examples_evidence: 1 },
    6: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 1 },
    7: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 2 },
    8: { role_fit: 2, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 2 },
  },
  senior: {
    4: { role_fit: 1, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    5: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 1, examples_evidence: 1 },
    6: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 1 },
    7: { role_fit: 1, depth_of_knowledge: 3, problem_solving: 2, examples_evidence: 1 },
    8: { role_fit: 1, depth_of_knowledge: 3, problem_solving: 2, examples_evidence: 2 },
  },
  staff: {
    4: { role_fit: 1, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    5: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 1, examples_evidence: 1 },
    6: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 1 },
    7: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 3, examples_evidence: 1 },
    8: { role_fit: 1, depth_of_knowledge: 3, problem_solving: 3, examples_evidence: 1 },
  },
  principal: {
    4: { role_fit: 1, depth_of_knowledge: 1, problem_solving: 1, examples_evidence: 1 },
    5: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 1, examples_evidence: 1 },
    6: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 2, examples_evidence: 1 },
    7: { role_fit: 1, depth_of_knowledge: 2, problem_solving: 3, examples_evidence: 1 },
    8: { role_fit: 1, depth_of_knowledge: 3, problem_solving: 3, examples_evidence: 1 },
  },
};
