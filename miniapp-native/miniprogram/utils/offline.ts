// 离线作答队列（镜像 frontend-uni/src/offline.js 的队列部分）：
// answer_log / 错题上报失败时入本地 storage 队列，恢复网络后按 key 去重补传。
import type { AnswerLogItem } from '../api/types';
import { request } from './request';

const QUEUE_KEY = 'offlineQueue';

interface QueuedAnswer {
  key: string;
  uid: string;
  item: AnswerLogItem;
}

export interface QueuedMistakeData {
  uid: string;
  question_id: number | null;
  module: string;
  question_type?: string | null;
  question_text: string;
  user_answer: string;
  correct_answer: string;
  explanation?: string;
}

interface QueuedMistake {
  key: string;
  data: QueuedMistakeData;
}

interface OfflineQueue {
  answers: QueuedAnswer[];
  mistakes: QueuedMistake[];
}

function getQueue(): OfflineQueue {
  const q = wx.getStorageSync<OfflineQueue | ''>(QUEUE_KEY);
  return q && Array.isArray(q.answers) && Array.isArray(q.mistakes)
    ? q
    : { answers: [], mistakes: [] };
}

function setQueue(q: OfflineQueue): void {
  wx.setStorageSync(QUEUE_KEY, q);
}

export function pendingCount(): number {
  const q = getQueue();
  return q.answers.length + q.mistakes.length;
}

// key = uid|qid|时间戳，防重复入队 / 重复上传；item.t 记作答时刻，补传时服务端按 t 落 created_at
export function enqueueAnswers(uid: string, items: AnswerLogItem[]): void {
  const q = getQueue();
  const seen = new Set(q.answers.map((a) => a.key));
  const now = Date.now();
  items.forEach((it, i) => {
    const key = uid + '|' + (it.qid || 'x') + '|' + (now + i);
    if (seen.has(key)) return;
    seen.add(key);
    q.answers.push({ key, uid, item: { ...it, t: it.t || now + i } });
  });
  setQueue(q);
}

export function enqueueMistake(data: QueuedMistakeData): void {
  const q = getQueue();
  const key = data.uid + '|' + (data.question_id || data.question_text || '');
  if (q.mistakes.some((m) => m.key === key)) return;
  q.mistakes.push({ key, data });
  setQueue(q);
}

let flushing = false;

export async function flushOfflineQueue(): Promise<void> {
  if (flushing) return;
  const q = getQueue();
  if (!q.answers.length && !q.mistakes.length) return;
  flushing = true;
  try {
    // answer_log：按 uid 分组批量上传，成功后按 key 出队
    const byUid: Record<string, QueuedAnswer[]> = {};
    for (const a of q.answers) (byUid[a.uid] = byUid[a.uid] || []).push(a);
    for (const uid of Object.keys(byUid)) {
      const arr = byUid[uid];
      await request<void>('/api/answer_log', {
        method: 'POST',
        data: { uid, items: arr.map((a) => a.item) },
      });
      const done = new Set(arr.map((a) => a.key));
      const cur = getQueue();
      cur.answers = cur.answers.filter((a) => !done.has(a.key));
      setQueue(cur);
    }
    // 错题：逐条补传（后端按 uid+question_text 合并，无重复风险）
    for (const m of q.mistakes.slice()) {
      await request<void>('/api/mistakes', { method: 'POST', data: m.data });
      const cur = getQueue();
      cur.mistakes = cur.mistakes.filter((x) => x.key !== m.key);
      setQueue(cur);
    }
    if (!pendingCount()) wx.showToast({ title: '离线作答已同步', icon: 'none' });
  } catch (e) {
    /* 仍无网络：下次前台 / 进入刷题页再试 */
  } finally {
    flushing = false;
  }
}

export function watchNetwork(): void {
  try {
    wx.onNetworkStatusChange((res) => {
      if (res.isConnected) flushOfflineQueue();
    });
  } catch (e) {
    /* 不支持则依赖 onShow 触发 */
  }
}
