/**
 * Analytics prompts — v1 (legacy) + v2 (hiring-grade).
 *
 * See openspec/changes/hiring-grade-analytics-scoring/ for the full design.
 *
 * The v2 prompt is the production hiring-grade scoring prompt. The v1 prompt
 * is preserved for dual-write during the rollout window — do NOT add new
 * v1 callers.
 */

import type { Question, Seniority } from "@/types/interview";

// ============================================================================
// v1 (LEGACY — kept for dual-write only)
// ============================================================================

export const SYSTEM_PROMPT =
  "You are an expert in analyzing interview transcripts. You must only use the main questions provided and not generate or infer additional questions.";

/**
 * @deprecated kept for v1 dual-write only. New code paths MUST use
 * `getInterviewAnalyticsPromptV2`. See openspec hiring-grade-analytics-scoring.
 */
export const getInterviewAnalyticsPrompt = (
  interviewTranscript: string,
  mainInterviewQuestions: string,
) => `Analyse the following interview transcript and provide structured feedback:

###
Transcript: ${interviewTranscript}

Main Interview Questions:
${mainInterviewQuestions}


Based on this transcript and the provided main interview questions, generate the following analytics in JSON format:
1. Overall Score (0-100) and Overall Feedback (60 words) - take into account the following factors:
   - Communication Skills: Evaluate the use of language, grammar, and vocabulary. Assess if the interviewee communicated effectively and clearly.
   - Time Taken to Answer: Consider if the interviewee answered promptly or took too long. Note if they were concise or tended to ramble.
   - Confidence: Assess the interviewee's confidence level. Were they assertive and self-assured, or did they seem hesitant and unsure?
   - Clarity: Evaluate the clarity of their answers. Were their responses well-structured and easy to understand?
   - Attitude: Consider the interviewee's attitude towards the interview and questions. Were they positive, respectful, and engaged?
   - Relevance of Answers: Determine if the interviewee's responses are relevant to the questions asked. Assess if they stayed on topic or veered off track.
   - Depth of Knowledge: Evaluate the interviewee's depth of understanding and knowledge in the subject matter. Look for detailed and insightful answers.
   - Problem-Solving Ability: Consider how the interviewee approaches problem-solving questions. Assess their logical reasoning and analytical skills.
   - Examples and Evidence: Note if the interviewee provides concrete examples or evidence to support their answers. This can indicate experience and credibility.
   - Listening Skills: Look for signs that the interviewee is actively listening and responding appropriately to follow-up questions.
   - Consistency: Evaluate if the interviewee's answers are consistent throughout the interview or if they contradict themselves.
   - Adaptability: Assess how well the interviewee adapts to different types of questions, including unexpected or challenging ones.

2. Communication Skills: Score (0-10) and Feedback (60 words). Rating system and guidleines for communication skills is as follwing.
    - 10: Fully operational command, use of English is appropriate, accurate, fluent, shows complete understanding.
    - 09: Fully operational command with occasional inaccuracies and inappropriate usage. May misunderstand unfamiliar situations but handles complex arguments well.
    - 08: Operational command with occasional inaccuracies, inappropriate usage, and misunderstandings. Handles complex language and detailed reasoning well.
    - 07: Effective command despite some inaccuracies, inappropriate usage, and misunderstandings. Can use and understand reasonably complex language, especially in familiar situations.
    - 06: Partial command, copes with overall meaning, frequent mistakes. Handles basic communication in their field.
    - 05: Basic competence limited to familiar situations with frequent problems in understanding and expression.
    - 04: Understands only general meaning in very familiar situations, with frequent communication breakdowns.
    - 03: Has great difficulty understanding spoken English.
    - 02: Has no ability to use the language except a few isolated words.
    - 01: Did not answer the questions.
3. Summary for each main interview question: ${mainInterviewQuestions}
   - Use ONLY the main questions provided, it should output all the questions with the numbers even if it's not found in the transcript.
   - Follow the below rules when outputing the question and summary
      - If a main interview question isn't found in the transcript, then output the main question and give the summary as "Not Asked"
      - If a main interview question is found in the transcript but an answer couldn't be found, then output the main question and give the summary as "Not Answered"
      - If a main interview question is found in the transcript and an answer can also be found, then,
          - For each main question (q), provide a summary that includes:
            a) The candidate's response to the main question
            b) Any follow-up questions that were asked related to this main question and their answers
          - The summary should be a cohesive paragraph encompassing all related information for each main question
4. Create a 10 to 15 words summary regarding the soft skills considering factors such as confidence, leadership, adaptability, critical thinking and decision making.
Ensure the output is in valid JSON format with the following structure:
{
  "overallScore": number,
  "overallFeedback": string,
  "communication": { "score": number, "feedback": string },
  "questionSummaries": [{ "question": string, "summary": string }],
  "softSkillSummary: string
}

IMPORTANT: Only use the main questions provided. Do not generate or infer additional questions such as follow-up questions.`;

// ============================================================================
// v2 (HIRING-GRADE)
// ============================================================================

export const SYSTEM_PROMPT_V2 =
  "You are a hiring evaluator. You score candidates against a structured rubric using ONLY direct evidence from the candidate's own turns in the transcript. You do not invent skills or experiences. You ignore protected attributes (age, gender, accent, etc.). You return JSON matching the enforced response_format schema.";

export interface TranscriptTurn {
  role: "agent" | "user";
  content: string;
}

export interface RetellCallAnalysisLike {
  call_summary: string;
  user_sentiment: string;
  agent_sentiment?: string;
  agent_task_completion_rating?: string;
  agent_task_completion_rating_reason?: string;
  call_completion_rating: string;
  call_completion_rating_reason: string;
}

export interface GetInterviewAnalyticsPromptV2Args {
  /** The role title — typically `interview.name` or `interview.objective`. */
  roleTitle: string;
  /** Company name — for now a static constant from constants.ts. */
  companyName: string;
  seniority: Seniority;
  /** Full JD text. Empty string is allowed; the prompt warns when empty. */
  jobDescription: string;
  /** Bullet list of non-negotiable requirements. Empty array OK — the section is omitted entirely when empty. */
  mustHaves: string[];
  /** The main interview questions, in order. */
  questions: Pick<Question, "question">[];
  /** Separated turns. Empty `content` turns are skipped. */
  transcriptTurns: TranscriptTurn[];
  /** Retell call_analysis (or sentinel when absent). */
  callAnalysis: RetellCallAnalysisLike;
  disconnectionReason: string;
  /** Total call duration in seconds. */
  durationSeconds: number;
  /**
   * Pre-computed: code-side estimate of how many questions the candidate
   * answered (substantive user turns). Passed to the model as ground truth
   * to avoid the model–own–output circular dependency.
   */
  promptTimeQuestionsAnswered: number;
  /** Computed from word-level timestamps before the model is called. */
  candidateSpeakingSeconds: number;
}

const HARD_RULES_TEXT = `HARD_RULES
The service code will apply the following caps to your numeric output AFTER you respond. Your job is to score honestly so these caps rarely need to fire — but understand that your output will be clamped:

1. If the candidate answered 0 questions: recommendation is forced to "insufficient_data", overallScore is capped at 20, confidence is forced to "insufficient".
2. If candidate speaking time is less than 30 seconds: overallScore is capped at 40.
3. If the call was abandoned or the candidate hung up before half the expected duration: overallScore is capped at 50.
4. If the candidate never spoke at all while the agent did: recommendation is forced to "insufficient_data", overallScore is capped at 10, confidence is forced to "insufficient".

When multiple caps apply, the LOWEST cap wins. The applied caps will appear in hardRulesTriggered[] in the final output (the service adds them — you do NOT need to populate that field; leave it as an empty array).`;

const BIAS_GUARDRAILS_TEXT = `BIAS_GUARDRAILS
You MUST NOT infer or score based on protected attributes. This includes:
- Age
- Gender or gender identity
- National origin or ethnicity
- Race
- Accent or perceived native-speaker status
- Disability
- Religion
- Marital or family status
- Sexual orientation

Do not infer these attributes from voice, name, accent, or any transcript content.
Do not score "communication" lower because of accent or non-native fluency.
Score communication on PARTICIPATION (did the candidate engage?) and CLARITY (was their meaning understandable?), not on accent or grammar.
If a candidate's transcript contains references to protected attributes (e.g., "I'm a recent graduate" → age inference), ignore those references when scoring.`;

const EVIDENCE_REQUIREMENT_TEXT = `EVIDENCE_REQUIREMENT
Every dimension feedback string MUST cite at least one direct candidate quote, or explicitly state "No candidate evidence" and score the dimension low (<=3).
Every perQuestionScores entry with answered=true MUST have at least one evidenceQuote.
Every redFlag with severity 'high' MUST have a non-null evidenceQuote.
Quotes must be VERBATIM substrings of CANDIDATE turns in the TRANSCRIPT section. Do not paraphrase, summarize, or invent quotes.`;

const ANTI_FABRICATION_TEXT = `ANTI_FABRICATION
You MUST NOT invent, infer, or assume skills, experiences, qualities, or characteristics that are not directly supported by CANDIDATE turns in the TRANSCRIPT.
If the candidate did not speak about a topic, you must say so in the relevant dimension's feedback and score that dimension low (<=3).
If a dimension has no supporting candidate quote, its score MUST be <=3, its evidenceQuotes array MUST be empty, and that dimension's name MUST appear in evidenceGaps.
"Inferred from professionalism" or "implied by their answers" are NOT valid evidence. Only direct quotes from CANDIDATE turns count.
If the must-haves section lists a requirement the candidate did not address, add it to evidenceGaps and reflect it in role_fit's feedback.`;

const OUTPUT_SCHEMA_TEXT = `OUTPUT_SCHEMA
Return JSON matching the schema enforced by response_format. Required top-level fields: recommendation, confidence, overallScore, overallFeedback, dimensions, perQuestionScores, redFlags, evidenceGaps, hardRulesTriggered, candidateSpeakingSeconds, questionsAnswered, questionsTotal, callSignals.

For dimensions: produce EXACTLY these six entries in this order, with the listed weights:
  1. role_fit (weight 0.25)
  2. depth_of_knowledge (weight 0.25)
  3. problem_solving (weight 0.20)
  4. examples_evidence (weight 0.15)
  5. communication (weight 0.10)
  6. professionalism (weight 0.05)

The service code will recompute overallScore from your dimension scores, so your overallScore should equal round(sum(dim.score * dim.weight) * 10). If you can't compute it precisely, the code will fix it — but be close.

Leave hardRulesTriggered as an empty array; the service populates it.`;

function renderTranscript(turns: TranscriptTurn[]): string {
  const lines: string[] = [];
  for (const t of turns) {
    const content = (t.content || "").trim();
    if (!content) {continue;}
    const label = t.role === "user" ? "CANDIDATE" : "AGENT";
    lines.push(`${label}: ${content}`);
  }
  return lines.length ? lines.join("\n") : "(no transcript turns available)";
}

function renderQuestions(questions: Pick<Question, "question">[]): string {
  if (questions.length === 0) {return "(no questions defined for this interview)";}
  return questions.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
}

function renderCallSignals(args: GetInterviewAnalyticsPromptV2Args): string {
  return `CALL_SIGNALS
- Call summary (from Retell): ${args.callAnalysis.call_summary || "N/A"}
- User sentiment (from Retell): ${args.callAnalysis.user_sentiment || "N/A"}
- Call completion rating (from Retell): ${args.callAnalysis.call_completion_rating || "N/A"}
- Call completion reason (from Retell): ${args.callAnalysis.call_completion_rating_reason || "N/A"}
- Disconnection reason: ${args.disconnectionReason || "unknown"}
- Total call duration: ${args.durationSeconds}s
- Candidate speaking time (computed): ${args.candidateSpeakingSeconds}s
- Questions answered (computed): ${args.promptTimeQuestionsAnswered} of ${args.questions.length}`;
}

/**
 * Build the v2 hiring-grade analytics prompt body.
 *
 * 11 ordered sections, per design.md Decision 10. Section order is locked —
 * do not reorder. Rules sections (HARD_RULES, BIAS, EVIDENCE, ANTI_FAB) come
 * immediately before OUTPUT so they are freshest in the model's attention.
 */
export function getInterviewAnalyticsPromptV2(
  args: GetInterviewAnalyticsPromptV2Args,
): string {
  const sections: string[] = [];

  // 1. ROLE
  sections.push(
    `ROLE\nYou are a hiring evaluator for a ${args.seniority} ${args.roleTitle} role at ${args.companyName}.`,
  );

  // 2. JOB_DESCRIPTION
  if (args.jobDescription.trim()) {
    sections.push(`JOB_DESCRIPTION\n${args.jobDescription.trim()}`);
  } else {
    sections.push(
      `JOB_DESCRIPTION\n(none provided — score role_fit conservatively, and add "job_description missing" to evidenceGaps)`,
    );
  }

  // 3. MUST_HAVES — omit entirely when empty so the model doesn't invent them
  if (args.mustHaves.length > 0) {
    const bullets = args.mustHaves.map((m) => `- ${m}`).join("\n");
    sections.push(`MUST_HAVES\n${bullets}`);
  }

  // 4. INTERVIEW_QUESTIONS
  sections.push(`INTERVIEW_QUESTIONS\n${renderQuestions(args.questions)}`);

  // 5. CALL_SIGNALS
  sections.push(renderCallSignals(args));

  // 6. TRANSCRIPT
  sections.push(`TRANSCRIPT\n${renderTranscript(args.transcriptTurns)}`);

  // 7-10. Rules sections (verbatim)
  sections.push(HARD_RULES_TEXT);
  sections.push(BIAS_GUARDRAILS_TEXT);
  sections.push(EVIDENCE_REQUIREMENT_TEXT);
  sections.push(ANTI_FABRICATION_TEXT);

  // 11. OUTPUT_SCHEMA
  sections.push(OUTPUT_SCHEMA_TEXT);

  return sections.join("\n\n");
}

// ============================================================================
// v2 JSON Schema — enforced by OpenAI `response_format: { type: 'json_schema' }`
// ============================================================================

/**
 * JSON Schema mirror of AnalyticsV2. Co-located with the prompt builder so the
 * two stay in sync.
 *
 * CRITICAL: nullable fields MUST use array-type syntax: `{ "type": ["number", "null"] }`,
 * NOT `{ "type": "number" }`. With `strict: true` the model is forced to
 * follow this — if the schema lies about nullability, the model returns 0/""
 * instead of null and silently corrupts the `answered: false` signal.
 */
export const ANALYTICS_V2_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "recommendation",
    "confidence",
    "overallScore",
    "overallFeedback",
    "dimensions",
    "perQuestionScores",
    "redFlags",
    "evidenceGaps",
    "hardRulesTriggered",
    "candidateSpeakingSeconds",
    "questionsAnswered",
    "questionsTotal",
    "callSignals",
  ],
  properties: {
    recommendation: {
      type: "string",
      enum: [
        "strong_yes",
        "yes",
        "lean_yes",
        "lean_no",
        "no",
        "insufficient_data",
      ],
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low", "insufficient"],
    },
    overallScore: { type: "number", minimum: 0, maximum: 100 },
    overallFeedback: { type: "string" },
    dimensions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "score", "weight", "feedback", "evidenceQuotes"],
        properties: {
          name: {
            type: "string",
            enum: [
              "role_fit",
              "depth_of_knowledge",
              "communication",
              "problem_solving",
              "examples_evidence",
              "professionalism",
            ],
          },
          score: { type: "number", minimum: 0, maximum: 10 },
          weight: { type: "number", minimum: 0, maximum: 1 },
          feedback: { type: "string" },
          evidenceQuotes: { type: "array", items: { type: "string" } },
        },
      },
    },
    perQuestionScores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "question",
          "answered",
          "score",
          "summary",
          "evidenceQuotes",
        ],
        properties: {
          question: { type: "string" },
          answered: { type: "boolean" },
          // Nullable — uses array-type syntax (REQUIRED with strict mode).
          score: { type: ["number", "null"], minimum: 0, maximum: 5 },
          summary: { type: "string" },
          evidenceQuotes: { type: "array", items: { type: "string" } },
        },
      },
    },
    redFlags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["flag", "severity", "evidenceQuote"],
        properties: {
          flag: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          // Nullable — uses array-type syntax (REQUIRED with strict mode).
          evidenceQuote: { type: ["string", "null"] },
        },
      },
    },
    evidenceGaps: { type: "array", items: { type: "string" } },
    hardRulesTriggered: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rule", "detail"],
        properties: {
          rule: {
            type: "string",
            enum: ["no_answers", "short_call", "abandoned", "agent_only_speech"],
          },
          detail: { type: "string" },
        },
      },
    },
    candidateSpeakingSeconds: { type: "number", minimum: 0 },
    questionsAnswered: { type: "integer", minimum: 0 },
    questionsTotal: { type: "integer", minimum: 0 },
    callSignals: {
      type: "object",
      additionalProperties: false,
      required: [
        "callSummary",
        "userSentiment",
        "callCompletionRating",
        "disconnectionReason",
        "durationSeconds",
      ],
      properties: {
        callSummary: { type: "string" },
        userSentiment: { type: "string" },
        callCompletionRating: { type: "string" },
        disconnectionReason: { type: "string" },
        durationSeconds: { type: "number", minimum: 0 },
      },
    },
  },
} as const;
