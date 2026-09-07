// 模考本地进度快照（镜像 H5 exam.vue 的 PROG_KEY）：
// 退出/切后台不丢作答，卷库页据此展示「继续上次模考」；服务端进度另经 /api/exam/progress 同步。
import type { ExamStartResp, Question } from '../api/types';

const PROG_KEY = 'examProgress';

export interface ExamItem extends Question {
  _picked: string;
  _secs: number;
  optList: Array<{ k: string; v: string }>;
}

export interface ExamProgressSnap {
  attemptId: number;
  paperId: number | null;
  mini: boolean;
  paper: ExamStartResp['paper'];
  items: ExamItem[];
  idx: number;
  endAt: number;
}

export function loadExamProgress(): ExamProgressSnap | null {
  const s = wx.getStorageSync<ExamProgressSnap | ''>(PROG_KEY);
  if (!s || !s.attemptId || !Array.isArray(s.items) || !s.items.length) return null;
  if (!(s.endAt > Date.now())) {
    clearExamProgress();
    return null;
  }
  return s;
}

export function saveExamProgress(snap: ExamProgressSnap): void {
  wx.setStorageSync(PROG_KEY, snap);
}

export function clearExamProgress(): void {
  wx.removeStorageSync(PROG_KEY);
}
