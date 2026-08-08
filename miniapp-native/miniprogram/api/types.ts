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
  tag3?: string | null;
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

// ---------- 模考 ----------

export interface ExamPaper {
  id: number;
  title: string;
  kind?: string;
  year?: number | null;
  region?: string | null;
  n: number;
  duration_min: number;
  best_score?: number | null;
  attempt_count?: number;
  question_ids?: number[];
}

export interface ExamFilters {
  years: Array<{ y: number }>;
  regions: Array<{ r: string }>;
}

export interface ExamPapersResp {
  items: ExamPaper[];
  filters?: ExamFilters;
}

export interface ExamAttempt {
  id: number;
  title?: string;
  score: number;
  paper_id?: number;
  started_at?: number;
  submitted_at?: number;
  per_module?: Record<string, { n: number; correct: number }>;
}

export interface ExamStartResp {
  attempt_id: number;
  paper: ExamPaper;
  items: Question[];
}

export interface ExamSubmitItem {
  status?: string;
  module?: string | null;
  correct?: boolean;
}

export interface ExamSubmitResp {
  attempt_id: number;
  score: number;
  total: number;
  correct: number;
  items?: ExamSubmitItem[];
}

export interface ExamReportItem {
  no: number;
  question: string;
  options: Record<string, string>;
  answer: string;
  picked?: string | null;
  correct?: boolean;
  module?: string | null;
  explanation?: string | null;
  hs_explanation?: string | null;
}

export interface ExamReport {
  paper: ExamPaper;
  attempt: ExamAttempt;
  total: number;
  correct: number;
  answered: number;
  items: ExamReportItem[];
}

export interface ExamRankResp {
  cold?: boolean;
  rank?: number;
  total?: number;
  avg?: number;
  pct?: number;
  distribution?: number[];
  my_bucket?: number;
}

// ---------- 模考大赛 ----------

export interface MockEvent {
  id: number;
  title: string;
  series?: string;
  phase: 'upcoming' | 'running' | 'ended';
  paper_id: number;
  paper_title?: string;
  n_questions?: number;
  duration_min?: number;
  open_at: number;
  close_at: number;
  registered?: number;
  submitted?: number;
  my_state?: string;
  my_score?: number | null;
  my_rank?: number | null;
}

export interface MockPastEvent {
  id: number;
  title: string;
  close_at: number;
  joined?: boolean;
  score?: number;
  rank?: number | null;
}

export interface MockEventsResp {
  current?: MockEvent | null;
  next?: MockEvent | null;
  past?: MockPastEvent[];
}

export interface ContestReport {
  event: { id: number; title: string; phase: string };
  attempt_id: number;
  score: number;
  rank: number;
  total: number;
  pct: number;
  avg: number;
  small_sample?: boolean;
  history_pool?: { n: number; avg: number };
  distribution: number[];
  my_bucket: number;
  target_score?: number | null;
  gap_to_target?: number;
  top25_score?: number | null;
  modules: Array<{
    module: string;
    n: number;
    correct: number;
    avg_correct?: number | null;
    secs: number;
    rec_secs: number;
  }>;
  weak_tags: Array<{ tag3: string; name?: string; wrong: number; n: number }>;
  history: Array<{ id: number; score: number }>;
}

// ---------- 统计 ----------

export interface MasteryTag3 {
  code: string;
  name: string;
  level: string;
  n: number;
  mastery: number;
  acc: number;
  due_mistakes?: number;
}

export interface MasterySub {
  code: string;
  submodule: string;
  n: number;
  mastery: number;
  tag3s: MasteryTag3[];
}

export interface MasteryModule {
  module: string;
  name: string;
  mastery: number;
  subs: MasterySub[];
}

export interface MasteryMapResp {
  cold?: boolean;
  n_total?: number;
  need?: number;
  coverage?: { pct: number; practiced: number; total: number };
  modules?: MasteryModule[];
}

export interface WeeklyReport {
  status?: string;
  range?: string;
  prev_week?: string;
  week_start?: string;
  summary?: { days: number; n: number; acc: number; secs: number };
  prev?: { n: number };
  compare?: { n: number[]; acc: number[]; secs: number[]; days: number[] };
  badges?: Array<{ key: string; title: string; desc: string }>;
  mastery?: {
    up: Array<{ submodule: string; prev_acc: number; acc: number }>;
    down: Array<{ submodule: string; prev_acc: number; acc: number }>;
  };
  reasons?: Array<{ reason: string; n: number; prev_n: number }>;
  mock?: {
    score: number;
    n_exams: number;
    attempt_id: number;
    event_title?: string;
    rank?: number;
    pct?: number;
  } | null;
  actions?: Array<{ type?: string; title: string; url?: string }>;
}

export interface PredictResp {
  status?: string;
  need?: number;
  n?: number;
  n_exam?: number;
  score?: number;
  confidence?: string;
  delta_week?: number | null;
  history?: Array<{ week_end: string; score: number; label: string }>;
  modules?: Array<{ module: string; name: string; score: number; max: number; trend: number }>;
}

export interface CheckinSummary {
  streak: number;
  today_n: number;
  today_rate?: number | null;
  cleared_today: number;
  total: number;
  days_to_exam?: number | null;
  exam_type?: string | null;
}

// ---------- 搜索 ----------

export interface SearchQuestionHit {
  id: number;
  code?: string;
  module?: string;
  submodule?: string | null;
  question: string;
  is_real?: number | boolean;
  exam_year?: number | null;
}

export interface SearchQuestionDetail extends SearchQuestionHit {
  options: Record<string, string>;
  answer: string;
  explanation?: string | null;
}

export interface SearchResp {
  q: string;
  code_hit?: SearchQuestionHit | null;
  topics?: Array<{ code: string; name: string; module_name?: string; group_name?: string; n?: number }>;
  papers?: Array<{ id: number; title: string; year?: number | null; region?: string | null }>;
  questions?: { total: number; items: SearchQuestionHit[] };
}

// ---------- 收藏夹 / 笔记 ----------

export interface FavFolder {
  id: number;
  name: string;
  icon?: string;
  n: number;
}

export interface FavFull {
  id: number;
  question: string;
  module?: string | null;
  submodule?: string | null;
  options: Record<string, string>;
  answer: string;
  explanation?: string | null;
  hs_explanation?: string | null;
  folder_id?: number | null;
  faved_at?: number;
  note?: string | null;
}

export interface NoteItem {
  question_id: number;
  question: string;
  module?: string | null;
  submodule?: string | null;
  content: string;
  updated_at?: number;
}
