// Exam 组（真题卷库 / 全真模考 / 成绩报告 / 模考大赛 / 申论）响应类型
// 与 backend/app/exam_api.py、mock_event.py、shenlun_api.py 返回结构一致；基础类型复用 ./types

import type { ExamPaperInfo, ExamRankResp, ExamReportItem, ExamReportResp, ExamWeakTag, Question } from './types';

// ---------- 真题卷库 ----------

export interface ExamPaper extends ExamPaperInfo {
  psource?: string | null;
  takers?: number;
  avg_score?: number | null;
  practiced?: number;
  wrong?: number;
  best_score?: number | null;
  attempt_count?: number;
  best_attempt_id?: number | null;
}

export interface ExamPaperFilters {
  years: Array<{ y: number; n: number }>;
  regions: Array<{ r: string; n: number }>;
}

export interface ExamPapersResp {
  items: ExamPaper[];
  filters?: ExamPaperFilters;
}

export interface ExamPaperDetail extends ExamPaperInfo {
  question_ids: number[];
  psource?: string | null;
}

/** GET /api/exam/attempts 列项：只含已交卷；迷你模考为 kind='mock'（标题带时间与随机后缀） */
export interface ExamAttempt {
  id: number;
  paper_id: number;
  title: string;
  kind: 'zhenti' | 'mock' | string;
  year?: number | null;
  region?: string | null;
  duration_min?: number | null;
  started_at: number;
  submitted_at?: number | null;
  score?: number | null;
  per_module?: Record<string, { n: number; answered: number; correct: number; secs: number }>;
}

export interface ExamAttemptsResp {
  items: ExamAttempt[];
}

// ---------- 作答 / 断点 ----------

export type ExamPicks = Record<string, string>;
export type ExamSecs = Record<string, number>;
export type ExamExcl = Record<string, string[]>;

export interface ExamProgressBody {
  uid: string;
  attempt_id: number;
  picks: ExamPicks;
  idx: number;
  marks: number[];
  secs: ExamSecs;
  excl: ExamExcl;
}

export interface ExamResumeResp {
  attempt_id: number;
  paper: ExamPaperInfo;
  items: Question[];
  picks: ExamPicks;
  marks: number[];
  secs: ExamSecs;
  excl: ExamExcl;
  idx: number;
  end_at_ms: number;
  mini?: boolean;
}

export interface PaperAnswersResp {
  code: string;
  title?: string | null;
  total: number;
  answered: number;
  correct: number;
  saved: boolean;
  items: Array<{ no: number; picked: string; answer: string; correct: boolean; status: string }>;
}

// ---------- 报告 ----------

export interface ExamReportFullItem extends ExamReportItem {
  tag3?: string | null;
  secs?: number;
  marked?: boolean;
  mistake_id?: number | null;
  error_reason?: string | null;
  image?: string | null;
  image_credit?: string | null;
  is_real?: number | boolean;
  exam_year?: number | null;
  exam_region?: string | null;
  attempt_count?: number;
  correct_ratio?: number | null;
  most_wrong?: string | null;
}

export interface ExamReportFull extends ExamReportResp {
  items: ExamReportFullItem[];
}

export interface ExamRankFull extends ExamRankResp {
  distribution?: number[];
  my_bucket?: number;
  board?: Array<{ rank: number; name: string; score: number; me: boolean }>;
  module_avg?: Record<string, { pct: number; n_users: number }>;
}

export interface PredictResp {
  status: 'cold' | 'ok' | string;
  score?: number | null;
  n?: number;
  need?: number;
  n_recent?: number;
  n_exam?: number;
  confidence?: string | null;
  delta_week?: number | null;
  modules?: Array<{ module: string; name: string; score: number; max: number; n?: number; acc?: number; trend?: number }>;
  history?: Array<{ week_end: number; label: string; score: number }>;
}

export interface ExportPdfBody {
  title: string;
  question_ids: number[];
  include_answers?: boolean;
  answer_sheet?: boolean;
  include_questions?: boolean;
}

export interface ExportPdfResult {
  filePath: string;
  code: string;
}

// ---------- 模考大赛 ----------

export type MockPhase = 'upcoming' | 'running' | 'ended';

export interface MockEvent {
  id: number;
  title: string;
  series?: string | null;
  paper_id: number;
  paper_title?: string | null;
  duration_min: number;
  n_questions: number;
  open_at: number;
  close_at: number;
  phase: MockPhase;
  registered: number;
  submitted: number;
  my_state?: string | null;
  my_score?: number | null;
  my_rank?: number | null;
}

export interface MockPastEvent {
  id: number;
  title: string;
  close_at: number;
  score?: number | null;
  rank?: number | null;
  joined: boolean;
}

export interface MockEventsResp {
  current: MockEvent | null;
  next: MockEvent | null;
  past: MockPastEvent[];
}

export interface MockEnterResp {
  paper_id: number;
  close_at: number;
}

export interface MockAttachResp {
  ok: boolean;
  score?: number | null;
  first: boolean;
}

export interface MockRankRow {
  rank: number;
  nickname: string;
  score: number;
  me?: boolean;
}

export interface MockRankResp {
  event_id: number;
  phase: MockPhase;
  frozen: boolean;
  total: number;
  avg: number;
  distribution: number[];
  my_score?: number | null;
  my_rank?: number | null;
  my_pct?: number | null;
  my_bucket?: number | null;
  small_sample: boolean;
  history_pool?: { n: number; avg: number } | null;
  top: MockRankRow[];
}

export interface MockReportModule {
  module: string;
  n: number;
  correct: number;
  secs: number;
  rec_secs: number;
  avg_correct?: number | null;
}

export interface MockReportResp {
  event: { id: number; title: string; close_at: number; phase: MockPhase };
  attempt_id: number;
  score: number;
  rank: number;
  total: number;
  pct: number;
  avg: number;
  distribution: number[];
  my_bucket: number;
  small_sample: boolean;
  history_pool: { n: number; avg: number };
  target_score?: number | null;
  gap_to_target?: number | null;
  top25_score?: number | null;
  modules: MockReportModule[];
  weak_tags: ExamWeakTag[];
  history: Array<{ id: number; title?: string; score: number }>;
}

// ---------- 卷内答案（/api/paper_answers，卷码为 PDF 导出时生成） ----------

export interface PaperAnswersBody {
  uid: string;
  code: string;
  picks: Record<string, string>;
}

// ---------- 申论（字段与 backend/app/db.py shenlun_* 查询列一致） ----------

export interface ShenlunQuestion {
  id: number;
  exam_year?: number | null;
  exam_region?: string | null;
  paper?: string | null;
  qtype?: string | null;
  question: string;
  material_len?: number;
}

export interface ShenlunQuestionDetail extends ShenlunQuestion {
  material?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface ShenlunMaterial {
  id: number;
  type?: string | null;
  topic?: string | null;
  content?: string | null;
  source?: string | null;
}

export interface ShenlunHotspotItem {
  id: number;
  type?: string | null;
  content?: string | null;
  source?: string | null;
}

export interface ShenlunHotspot {
  topic: string;
  segs: { 内涵?: ShenlunHotspotItem[]; 角度?: ShenlunHotspotItem[]; 金句?: ShenlunHotspotItem[] };
  others: ShenlunHotspotItem[];
}

export interface ShenlunHotspotsResp {
  total: number;
  items: ShenlunHotspot[];
}

export interface ShenlunNote {
  id: number;
  topic?: string | null;
  title?: string | null;
  content: string;
  created_at: number;
  updated_at: number;
}

export interface ShenlunFilters {
  years: number[];
  regions: string[];
}

export interface ShenlunListResp<T> {
  items: T[];
  total?: number;
}

export interface ShenlunDraftResp {
  content?: string | null;
  updated_at?: number | null;
}

export interface ShenlunGradeResp {
  result: string;
  essay: boolean;
}

export interface ShenlunHistoryItem {
  id: number;
  qid: number;
  answer: string;
  result?: string | null;
  created_at: number;
  qtype?: string | null;
  question?: string | null;
}

export interface ShenlunStats {
  total: number;
  last_at?: number | null;
  by_type: Array<{ qtype: string; n: number }>;
  issues: Array<{ qtype: string; kind: string; text: string }>;
}

export interface ShenlunQFavsResp {
  ids: number[];
  items: ShenlunQuestion[];
}

export interface ShenlunMatFavsResp {
  ids: number[];
  items: ShenlunMaterial[];
}
