export interface Interviewer {
  id: bigint;
  created_at: Date;
  name: string;
  rapport: number;
  exploration: number;
  empathy: number;
  speed: number;
  image: string;
  description: string;
  audio: string;
  agent_id: string;
  prompt: string;
  voice_id: string | null;
  deleted_at: string | null;
  retell_llm_id: string | null;
}
