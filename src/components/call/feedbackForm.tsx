import { useState } from "react";
import { MessageSquare, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FeedbackData } from "@/types/response";

enum SatisfactionLevel {
  Positive = "smooth",
  Moderate = "okay",
  Negative = "rough",
}

const satisfactionOptions: Array<{
  value: SatisfactionLevel;
  emoji: string;
  label: string;
  description: string;
}> = [
  {
    value: SatisfactionLevel.Positive,
    emoji: "😀",
    label: "Smooth",
    description: "The session felt clear and easy to complete.",
  },
  {
    value: SatisfactionLevel.Moderate,
    emoji: "🙂",
    label: "Okay",
    description: "The session worked, with a few moments that could improve.",
  },
  {
    value: SatisfactionLevel.Negative,
    emoji: "😕",
    label: "Rough",
    description: "Something made the session harder than expected.",
  },
];

interface FeedbackFormProps {
  onSubmit: (data: Omit<FeedbackData, "interview_id">) => void;
  email: string;
}

export function FeedbackForm({ onSubmit, email }: FeedbackFormProps) {
  const [satisfaction, setSatisfaction] = useState<SatisfactionLevel>(
    SatisfactionLevel.Moderate,
  );
  const [feedback, setFeedback] = useState("");

  const handleSubmit = () => {
    onSubmit({
      satisfaction: Object.values(SatisfactionLevel).indexOf(satisfaction),
      feedback,
      email,
    });
  };

  return (
    <div className="space-y-6 bg-[#fbfdf6] p-1 text-[#0a1d08]">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#e0e5d5] bg-[#d7e8b5]/45 text-[#203b14]">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold tracking-[-0.04em]">
            Share how the session felt
          </h3>
          <p className="text-sm leading-6 text-[#31200b]/76">
            Your feedback helps improve the candidate experience. A short note
            is enough.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {satisfactionOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              "rounded-[22px] border px-4 py-4 text-left transition-colors",
              satisfaction === option.value
                ? "border-[#203b14] bg-[#d7e8b5]/55"
                : "border-[#e0e5d5] bg-white/80 hover:border-[#c5ccb6]",
            )}
            onClick={() => setSatisfaction(option.value)}
          >
            <div className="flex items-start gap-4">
              <div className="text-2xl leading-none">{option.emoji}</div>
              <div className="space-y-1">
                <p className="text-base font-medium text-[#0a1d08]">
                  {option.label}
                </p>
                <p className="text-sm leading-6 text-[#31200b]/76">
                  {option.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-[24px] border border-[#e0e5d5] bg-white/80 p-4">
        <label
          htmlFor="candidate-feedback"
          className="flex items-center gap-2 text-sm font-medium text-[#203b14]"
        >
          <MessageSquare className="h-4 w-4" />
          Anything else we should know?
        </label>
        <Textarea
          id="candidate-feedback"
          value={feedback}
          placeholder="Share anything that felt confusing, helpful, or worth improving."
          className="mt-3 min-h-28 rounded-[20px] border-[#e0e5d5] bg-[#fbfdf6] text-[#0a1d08] placeholder:text-[#31200b]/45 focus-visible:ring-[#203b14]/20"
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>

      <Button
        className="h-12 w-full rounded-full bg-[#4a3212] text-base font-medium text-[#fbfdf6] hover:bg-[#31200b]"
        onClick={handleSubmit}
      >
        Submit feedback
      </Button>
    </div>
  );
}
