"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";

import { InterviewerService } from "@/services/interviewers.service";

const interviewersKey = (userId?: string) =>
  ["interviewers", userId] as const;

/**
 * Adopted in change #3 wave 4. Replaces the useEffect-based fetching pattern
 * in InterviewerProvider.
 */
export function useInterviewersQuery() {
  const { user } = useUser();
  const userId = user?.id;

  return useQuery({
    queryKey: interviewersKey(userId),
    queryFn: () => InterviewerService.getAllInterviewers(userId ?? ""),
    enabled: !!userId,
  });
}

export function useInvalidateInterviewers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["interviewers"] });
}
