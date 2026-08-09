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

export interface TeamInfo {
  id: number;
  name: string;
  invite_code: string;
  n_members?: number;
  is_creator?: number | boolean;
}

export interface TeamMember {
  nickname: string;
  is_me?: boolean;
  is_creator?: boolean;
  today_n?: number;
  today_acc?: number;
  streak?: number;
  last_active?: number | null;
  week: number[];
}

export interface TeamPanelResp {
  team: TeamInfo;
  members: TeamMember[];
}

export interface ShareQuestion {
  module?: string | null;
  submodule?: string | null;
  question: string;
  options: Record<string, string>;
  answer?: string;
  explanation?: string | null;
}

export interface ShareAnswerRow {
  nickname: string;
  picked: string;
  correct: boolean | number;
}

export interface QStats {
  total: number;
  acc?: number | null;
  beat_pct?: number | null;
}

export interface TeamInvite {
  code: string;
  name: string;
  n_members?: number;
}

export interface ShareDetailResp {
  from_name?: string;
  question: ShareQuestion;
  answered?: boolean;
  is_sharer?: boolean;
  n_answered?: number;
  answers?: ShareAnswerRow[];
  my_answer?: { picked: string; correct: boolean } | null;
  q_stats?: QStats | null;
  team_invite?: TeamInvite | null;
}

export interface ShareAnswerResp {
  correct: boolean;
  answer: string;
  explanation?: string | null;
  answers?: ShareAnswerRow[];
  q_stats?: QStats | null;
  team_invite?: TeamInvite | null;
}

export interface ShareCreateResp {
  sid: string;
  module?: string | null;
  submodule?: string | null;
}

export interface CheckinSummaryResp {
  date?: string;
  streak: number;
  today_n: number;
  today_correct?: number;
  today_rate?: number | null;
  cleared_today?: number;
  total: number;
  exam_type?: string | null;
  days_to_exam?: number | null;
}

export interface CheckinBadge {
  days: number;
  unlocked: boolean;
}

export interface CheckinBadgesResp {
  streak: number;
  best_streak: number;
  badges: CheckinBadge[];
}

export interface PkResultSide {
  role?: string;
  name: string;
  score: number;
  correct: number;
  time_ms?: number | null;
}

export interface PkResultResp {
  code: string;
  module?: string | null;
  n_questions: number;
  winner: string;
  creator: PkResultSide;
  opponent: PkResultSide;
  finished_at?: number | null;
}
