// 题目全站数据锚点行：难度★ · 全站正确率 · 易错项（与 H5 q-stat.js 同一口径：样本 <5 或无聚合值不产出）
import type { Question } from '../api/types';

export function qStatLine(q: Question | null | undefined): string {
  if (!q || !q.attempt_count || q.attempt_count < 5 || q.correct_ratio == null) return '';
  const r = q.correct_ratio;
  const stars = '★'.repeat(r > 85 ? 1 : r > 70 ? 2 : r > 55 ? 3 : r > 40 ? 4 : 5);
  let s = `难度${stars} · 全站正确率 ${r}%（${q.attempt_count} 人次）`;
  if (q.most_wrong && q.most_wrong !== q.answer) s += ` · 易错项 ${q.most_wrong}`;
  return s;
}

// B3：难度徽标（后端 difficulty 分档校准值；样本不足返回 null 不渲染）
export type DifficultyTag = { label: string; tone: 'info' | 'neutral' | 'warn' | 'bad' };
export function difficultyTag(q: Question | null | undefined): DifficultyTag | null {
  if (!q || q.difficulty == null || !q.difficulty_label) return null;
  const d = q.difficulty;
  const tone = d >= 5 ? 'bad' : d === 4 ? 'warn' : d === 3 ? 'neutral' : 'info';
  return { label: q.difficulty_label, tone };
}

// 考点链：模块 › 子模块 › 题型末段（与 H5 practice.vue kpChain 同口径）
export function kpChain(q: Question | null | undefined, modLabel: string): string {
  if (!q) return '';
  const parts: string[] = [modLabel];
  if (q.submodule) parts.push(q.submodule);
  if (q.question_type) {
    const kp = q.question_type.replace(/^.+-/, '');
    if (kp && kp !== q.submodule) parts.push(kp);
  }
  return parts.filter(Boolean).join(' › ');
}

// 来源行：original/unknown/ai 是库内占位值（同 backend quality.py），不是可展示的出处
const SOURCE_PLACEHOLDER = /^(original|unknown|ai)$/i;
export function sourceLabel(q: Question | null | undefined): string {
  const s = (q && q.source ? String(q.source) : '').trim();
  return SOURCE_PLACEHOLDER.test(s) ? '' : s;
}
