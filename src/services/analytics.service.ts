"use server";

import { OpenAI } from "openai";
import { ResponseService } from "@/services/responses.service";
import { InterviewService } from "@/services/interviews.service";
import { Question } from "@/types/interview";
import { Analytics } from "@/types/response";
import {
  getInterviewAnalyticsPrompt,
  SYSTEM_PROMPT,
} from "@/lib/prompts/analytics";

export const generateInterviewAnalytics = async (payload: {
  callId: string;
  interviewId: string;
  transcript: string;
}) => {
  const { callId, interviewId, transcript } = payload;

  // Re-throw on failure (per change #3 wave 2 service pattern). The webhook
  // handler and route handlers catch + return a 500 / structured response;
  // UI callers wrap in try/catch + toastError.
  const response = await ResponseService.getResponseByCallId(callId);
  const interview = await InterviewService.getInterviewById(interviewId);

  if (response?.analytics) {
    return { analytics: response.analytics as Analytics, status: 200 };
  }

  const interviewTranscript = transcript || response?.details?.transcript || "";
  const questions = interview?.questions || [];
  const mainInterviewQuestions = questions
    .map((q: Question, index: number) => `${index + 1}. ${q.question}`)
    .join("\n");

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 5,
  });

  const prompt = getInterviewAnalyticsPrompt(
    interviewTranscript,
    mainInterviewQuestions,
  );

  const baseCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const basePromptOutput = baseCompletion.choices[0] || {};
  const content = basePromptOutput.message?.content || "";
  const analyticsResponse = JSON.parse(content);

  analyticsResponse.mainInterviewQuestions = questions.map(
    (q: Question) => q.question,
  );

  return { analytics: analyticsResponse, status: 200 };
};
