export interface Question {
  id: number | null;
  module: string;
  submodule?: string | null;
  question_type?: string | null;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation?: string | null;
  hs_explanation?: string | null;
  xp_explanation?: string | null;
  xp_school?: string | null;
  source?: string | null;
  is_real?: number | boolean;
  exam_year?: number | null;
  exam_region?: string | null;
  attempt_count?: number;
  correct_ratio?: number | null;
  most_wrong?: string | null;
  image?: string | null;
}

export interface QuestionsResp {
  items: Question[];
}

export interface AnswerLogItem {
  qid: number | null;
  module: string | null;
  submodule: string | null;
  correct: boolean;
  secs: number;
  picked: string;
  source: string | null;
}

export interface Mistake {
  id: number;
  question_id: number | null;
  module: string;
  question_type?: string | null;
  question_text: string;
  user_answer: string;
  correct_answer: string;
  explanation?: string | null;
  mastered?: number;
  error_reason?: string | null;
  tag3_name?: string | null;
  created_at?: number | string;
}

export interface MistakesResp {
  items: Mistake[];
}

export interface AuthResp {
  token: string;
  user: { uid: string; phone?: string; nickname?: string | null };
}

export interface PlanTask {
  type?: string;
  module?: string | null;
  submodule?: string | null;
  target: number;
  done_n?: number;
  done?: boolean;
  real?: boolean;
  title?: string;
}

export interface PlanToday {
  tasks?: PlanTask[];
  days_left?: number | null;
  done_pct?: number;
}

export interface Profile {
  exam_type?: string;
  target_region?: string;
  exam_date?: string;
  target_score?: number;
  daily_minutes?: number;
  base_level?: string;
}

export interface Paper {
  source: string;
  title?: string;
  region?: string | null;
  year?: number | null;
  n?: number;
}

export interface FavItem {
  question_id: number;
  module?: string | null;
  question?: string;
  folder_id?: number | null;
}

export interface PracticeResultResp {
  percentile?: number | null;
}
