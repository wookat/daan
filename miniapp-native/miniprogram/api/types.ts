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
  image_credit?: string | null;
  /** 时政题（shizheng_daily / mistakes redo 回源）：id 属 shizheng_questions，不得当题库 id 用 */
  _sz?: boolean;
  /** 错题重练（/api/mistakes/redo）回源时对应的 mistakes.id，answer_log 以 mid 上送让无 qid 行也能推进复习 */
  mistake_id?: number;
}

export interface QuestionsResp {
  items: Question[];
}

export interface AnswerLogItem {
  qid: number | null;
  mid?: number;
  module: string | null;
  submodule: string | null;
  correct: boolean;
  secs: number;
  picked: string;
  source: string | null;
  t?: number;
}

/** /api/answer_log 回包：reviewed = 本次作答里答对的曾错题（服务端已推进复习计划） */
export interface AnswerLogReviewed {
  mistake_id: number;
  streak: number;
  mastered: boolean;
}

export interface AnswerLogResp {
  saved: number;
  reviewed?: AnswerLogReviewed[];
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
  times?: number;
  review_streak?: number;
  tag3_name?: string | null;
  type_group?: string | null;
  created_at?: number | string;
  options?: Record<string, string> | null;
}

export interface MistakesResp {
  items: Mistake[];
}

export interface ReviewResp {
  items: Mistake[];
  total: number;
}

export interface ReviewRecordResp {
  next_review_days: number;
  streak: number;
  mastered: boolean;
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
  id: number;
  module?: string | null;
  question?: string;
  folder_id?: number | null;
  note?: string | null;
  faved_at?: number;
}

export interface FavFolder {
  id: number;
  name: string;
  icon?: string | null;
  n: number;
}

export interface NoteItem {
  question_id: number;
  content: string;
  updated_at: number;
  question?: string | null;
  module?: string | null;
  submodule?: string | null;
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
  days?: Record<string, { n: number; correct: number | null }>;
  exam_type?: string | null;
  days_to_exam?: number | null;
}

export interface GrowthStat {
  n: number;
  c: number;
}

export interface GrowthWeek extends GrowthStat {
  week: string;
  modules: Record<string, GrowthStat>;
}

export interface GrowthResp {
  total: GrowthStat;
  modules: Record<string, GrowthStat>;
  weeks: GrowthWeek[];
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

export interface ExamPaperInfo {
  id: number;
  title: string;
  kind?: string | null;
  year?: number | null;
  region?: string | null;
  duration_min: number;
  n?: number;
}

/** /api/exam/papers 卷库项（含当前 uid 的做题/模考状态） */
export interface ExamPaper extends ExamPaperInfo {
  n: number;
  takers?: number;
  avg_score?: number | null;
  practiced?: number;
  wrong?: number;
  best_score?: number | null;
  attempt_count?: number;
  best_attempt_id?: number | null;
}

export interface ExamPapersResp {
  items: ExamPaper[];
  filters: { years: { y: number; n: number }[]; regions: { r: string; n: number }[] };
}

export interface ExamAttemptItem {
  id: number;
  paper_id: number;
  started_at: number;
  submitted_at: number;
  score: number | null;
  title: string;
  year?: number | null;
  region?: string | null;
  duration_min: number;
}

export interface ExamStartResp {
  attempt_id: number;
  paper: ExamPaperInfo;
  items: Question[];
}

export interface ExamSubmitItem {
  no: number;
  question_id: number | null;
  module?: string | null;
  submodule?: string | null;
  status: string;
  correct?: boolean;
  secs?: number;
}

export interface ExamSubmitResp {
  attempt_id: number;
  paper_id: number;
  title: string;
  score: number;
  total: number;
  answered: number;
  correct: number;
  per_module: Record<string, { n: number; answered: number; correct: number; secs: number }>;
  items: ExamSubmitItem[];
}

export interface ExamWeakTag {
  tag3: string;
  name: string;
  n: number;
  wrong: number;
}

export interface ExamReportItem {
  no: number;
  question_id: number | null;
  module?: string | null;
  submodule?: string | null;
  question: string;
  options: Record<string, string>;
  picked: string;
  answer: string;
  correct: boolean;
  explanation?: string | null;
  hs_explanation?: string | null;
}

export interface ExamReportResp {
  attempt: {
    id: number;
    paper_id: number;
    started_at: number;
    submitted_at: number;
    score: number;
    per_module: Record<string, { n: number; answered: number; correct: number; secs: number }>;
  };
  paper: ExamPaperInfo & { question_ids?: number[] };
  total: number;
  answered: number;
  correct: number;
  weak_tags: ExamWeakTag[];
  items: ExamReportItem[];
}

export interface ExamRankResp {
  attempt_id: number;
  score: number;
  rank: number;
  total: number;
  beaten_pct: number;
  avg: number;
  small_sample: boolean;
}
