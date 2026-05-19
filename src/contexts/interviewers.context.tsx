"use client";

import { InterviewerService } from "@/services/interviewers.service";
import type { Interviewer } from "@/types/interviewer";
import { useClerk } from "@clerk/nextjs";
import React, { useState, useContext, type ReactNode, useEffect } from "react";

interface InterviewerContextProps {
  interviewers: Interviewer[];
  setInterviewers: React.Dispatch<React.SetStateAction<Interviewer[]>>;
  fetchInterviewers: () => Promise<void>;
  deleteInterviewer: (id: number) => Promise<void>;
  interviewersLoading: boolean;
  setInterviewersLoading: (interviewersLoading: boolean) => void;
}

export const InterviewerContext = React.createContext<InterviewerContextProps>({
  interviewers: [],
  setInterviewers: () => {},
  fetchInterviewers: async () => {},
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
