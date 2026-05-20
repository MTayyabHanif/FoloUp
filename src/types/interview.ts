export interface Question {
  id: string;
  question: string;
  follow_up_count: number;
}

export interface Quote {
  quote: string;
  call_id: string;
}

export type Seniority = "junior" | "mid" | "senior" | "staff" | "principal";

export interface InterviewBase {
  user_id: string;
  organization_id: string;
  name: string;
  interviewer_id: bigint;
  objective: string;
  question_count: number;
  time_duration: string;
  is_anonymous: boolean;
  invite_only: boolean;
  questions: Question[];
  description: string;
  response_count: bigint;
  /**
   * v2 analytics fields (see openspec change hiring-grade-analytics-scoring).
   * DB defaults: job_description='', seniority='mid', must_haves='[]'.
   * Required at the TS level; existing rows are filled by DDL defaults.
   */
  job_description: string;
  seniority: Seniority;
  must_haves: string[];
}

export interface InterviewDetails {
  id: string;
  created_at: Date;
  url: string | null;
  insights: string[];
  quotes: Quote[];
  details: any;
  is_active: boolean;
  theme_color: string;
  logo_url: string;
  respondents: string[];
  readable_slug: string;
  public_token: string | null;
  public_token_expires_at: string | null;
}

export interface Interview extends InterviewBase, InterviewDetails {}
