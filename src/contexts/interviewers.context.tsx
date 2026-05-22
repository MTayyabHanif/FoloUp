"use client";

import { InterviewerService } from "@/services/interviewers.service";
import type { Interviewer } from "@/types/interviewer";
import { useClerk } from "@clerk/nextjs";
import React, { useState, useContext, type ReactNode, useEffect } from "react";

export interface InterviewerPatch {
  name?: string;
  description?: string;
  image?: string;
  voice_id?: string;
  prompt?: string;
  empathy?: number;
  rapport?: number;
  exploration?: number;
  speed?: number;
}

interface InterviewerContextProps {
  interviewers: Interviewer[];
  setInterviewers: React.Dispatch<React.SetStateAction<Interviewer[]>>;
  fetchInterviewers: () => Promise<void>;
  updateInterviewer: (id: number, patch: InterviewerPatch) => Promise<void>;
  deleteInterviewer: (id: number) => Promise<void>;
  interviewersLoading: boolean;
  setInterviewersLoading: (interviewersLoading: boolean) => void;
}

export const InterviewerContext = React.createContext<InterviewerContextProps>({
  interviewers: [],
  setInterviewers: () => {},
  fetchInterviewers: async () => {},
  updateInterviewer: async () => {},
  deleteInterviewer: async () => {},
  interviewersLoading: false,
  setInterviewersLoading: () => undefined,
});

interface InterviewerProviderProps {
  children: ReactNode;
}

export function InterviewerProvider({ children }: InterviewerProviderProps) {
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const { user } = useClerk();
  const [interviewersLoading, setInterviewersLoading] = useState(true);

  const fetchInterviewers = async () => {
    try {
      setInterviewersLoading(true);
      const response = await InterviewerService.getAllInterviewers(user?.id as string);
      setInterviewers(response);
    } catch (error) {
      console.error(error);
    }
    setInterviewersLoading(false);
  };

  const updateInterviewer = async (id: number, patch: InterviewerPatch) => {
    const res = await fetch(`/api/interviewers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // Preserve the server-provided failure type so callers (e.g., the edit
      // modal) can render the right error message. See design.md 7e.
      const err = new Error(body.error ?? `Update failed (HTTP ${res.status})`) as Error & {
        type?: string;
        status?: number;
      };
      err.type = typeof body.type === "string" ? body.type : undefined;
      err.status = res.status;
      throw err;
    }
    await fetchInterviewers();
  };

  const deleteInterviewer = async (id: number) => {
    const res = await fetch(`/api/interviewers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Delete failed (HTTP ${res.status})`);
    }
    await fetchInterviewers();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (user?.id) {
      fetchInterviewers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <InterviewerContext.Provider
      value={{
        interviewers,
        setInterviewers,
        fetchInterviewers,
        updateInterviewer,
        deleteInterviewer,
        interviewersLoading,
        setInterviewersLoading,
      }}
    >
      {children}
    </InterviewerContext.Provider>
  );
}

export const useInterviewers = () => {
  const value = useContext(InterviewerContext);

  return value;
};
