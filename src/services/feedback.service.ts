import { createClient } from "@supabase/supabase-js";
import { FeedbackData } from "@/types/response";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

const submitFeedback = async (feedbackData: FeedbackData) => {
  const { error, data } = await supabase
    .from("feedback")
    .insert(feedbackData)
    .select();

  if (error) {
    console.error("Error submitting feedback:", error);
    throw error;
  }

  return data;
};

export const FeedbackService = {
  submitFeedback,
};
