"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useOrganization } from "@clerk/nextjs";

import { InterviewService } from "@/services/interviews.service";

const interviewsKey = (userId?: string, orgId?: string) =>
  ["interviews", userId, orgId] as const;

/**
 * Adopted in change #3 wave 4. Replaces the useEffect-based fetching pattern
 * in InterviewProvider with react-query: automatic cache, loading/error
 * states, and a stable invalidation point for mutations.
 */
export function useInterviewsQuery() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const userId = user?.id;
  const orgId = organization?.id;

  return useQuery({
    queryKey: interviewsKey(userId, orgId),
    queryFn: () => InterviewService.getAllInterviews(userId!, orgId!),
    enabled: !!userId && !!orgId,
  });
}

/**
 * Single-interview query (used by interview detail page).
 * Keys nest under the list cache so mutations on the list invalidate both.
 */
export function useInterviewQuery(id: string | undefined) {
  return useQuery({
    queryKey: ["interviews", "byId", id] as const,
    queryFn: () => InterviewService.getInterviewById(id!),
    enabled: !!id,
  });
}

/**
 * Helper for mutations: returns a callback that invalidates the interviews
 * list and any single-interview query, forcing the next reader to refetch.
 */
export function useInvalidateInterviews() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["interviews"] });
}
