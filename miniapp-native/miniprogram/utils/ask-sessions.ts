// AI 问答历史会话跨设备同步（对齐 frontend-uni/src/ask-sessions.js + ask-link.js）：纯函数，fail-closed。

export interface AskFu {
  role: 'user' | 'ai';
  content: string;
}

export interface AskItem {
  ts: number;
  qid?: number;
  module?: string;
  module_name?: string;
  question_type?: string;
  question_text?: string;
  explanation: string;
  explain_key?: string;
  user_answer?: string;
  userText?: string;
  saved?: boolean;
  fu?: AskFu[];
}

export interface AskSession {
  id: number;
  ts: number;
  title: string;
  n: number;
  items: AskItem[];
}

export type Tombs = Record<string, number>;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function validSid(sid: unknown): sid is number {
  return typeof sid === 'number' && Number.isInteger(sid) && sid > 0;
}

function valid(s: unknown): s is AskSession {
  return (
    isObj(s) &&
    validSid(s.id) &&
    typeof s.ts === 'number' &&
    Number.isInteger(s.ts) &&
    s.ts > 0 &&
    Array.isArray(s.items) &&
    s.items.length > 0
  );
}

function asList(v: unknown): AskSession[] {
  return Array.isArray(v) ? (v as unknown[]).filter(valid) : [];
}

// 按 id 去重并集（本机优先），ts 降序，上限 20 条
export function mergeAskSessions(local: unknown, remote: unknown): AskSession[] {
  const loc = asList(local);
  const rem = asList(remote);
  const seen = new Set(loc.map((s) => s.id));
  const merged = [...loc];
  for (const s of rem) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      merged.push(s);
    }
  }
  merged.sort((a, b) => b.ts - a.ts || b.id - a.id);
  return merged.slice(0, 20);
}

export function upsertLocalSession(sessions: unknown, sess: AskSession): AskSession[] {
  const list = asList(sessions);
  if (!valid(sess)) return list;
  return [sess, ...list.filter((s) => s.id !== sess.id)].slice(0, 20);
}

const TOMB_TTL = 7 * 24 * 3600 * 1000;
const TOMB_CAP = 40;

function normTombs(tombs: unknown): Tombs {
  const out: Tombs = {};
  if (!isObj(tombs)) return out;
  for (const k of Object.keys(tombs)) {
    const sid = Number(k);
    const at = tombs[k];
    if (validSid(sid) && typeof at === 'number' && Number.isFinite(at) && at > 0) out[sid] = at;
  }
  return out;
}

export function addTombstone(tombs: unknown, sid: number, now?: number): Tombs {
  const out = normTombs(tombs);
  if (!validSid(sid)) return out;
  out[sid] = typeof now === 'number' && now > 0 ? now : Date.now();
  const keys = Object.keys(out);
  if (keys.length > TOMB_CAP) {
    keys
      .sort((a, b) => out[a] - out[b])
      .slice(0, keys.length - TOMB_CAP)
      .forEach((k) => delete out[k]);
  }
  return out;
}

export function removeTombstone(tombs: unknown, sid: number): Tombs {
  const out = normTombs(tombs);
  delete out[Number(sid)];
  return out;
}

export function pruneTombstones(tombs: unknown, now?: number): Tombs {
  const out = normTombs(tombs);
  const t = typeof now === 'number' && now > 0 ? now : Date.now();
  for (const k of Object.keys(out)) {
    if (t - out[k] > TOMB_TTL) delete out[k];
  }
  return out;
}

export function filterTombstoned(sessions: unknown, tombs: unknown): AskSession[] {
  const tb = normTombs(tombs);
  return asList(sessions).filter((s) => !(s.id in tb));
}

// 进行中会话快照清洗：缺 explanation 的条目无法呈现，剔除
export function sanitizeCurItems(items: unknown): AskItem[] {
  if (!Array.isArray(items)) return [];
  return (items as unknown[]).filter(
    (r): r is AskItem => isObj(r) && typeof r.explanation === 'string' && r.explanation.length > 0
  );
}

export function parseRemoteCur(data: unknown): { sid: number; items: AskItem[] } | null {
  if (!isObj(data)) return null;
  const items = sanitizeCurItems(data.items);
  if (!items.length) return null;
  return { sid: validSid(data.sid) ? data.sid : 0, items };
}

// 题库题目 id（正整数）解析，非法归 0
export function askQid(v: unknown): number {
  let n = 0;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d+$/.test(v.trim())) n = Number(v.trim());
  return Number.isInteger(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER ? n : 0;
}

function hasQid(items: unknown, q: number): boolean {
  return Array.isArray(items) && items.some((it) => it && typeof it === 'object' && askQid((it as AskItem).qid) === q);
}

// 返回 {sid}：sid=0 表示命中进行中会话；无命中返回 null
export function findAskSid(sessions: unknown, curItems: unknown, qid: unknown): { sid: number } | null {
  const q = askQid(qid);
  if (!q) return null;
  if (hasQid(curItems, q)) return { sid: 0 };
  if (!Array.isArray(sessions)) return null;
  for (const s of sessions) {
    if (s && typeof s === 'object' && hasQid((s as AskSession).items, q)) {
      const sid = (s as AskSession).id;
      if (Number.isInteger(sid) && sid > 0) return { sid };
    }
  }
  return null;
}

// AI 问答预填文本：题干 + 选项拼接（对齐 frontend-uni/src/ask-prefill.js）
export function askPrefill(stem: unknown, options: unknown): string {
  const s = typeof stem === 'string' ? stem.trim() : '';
  if (!s) return '';
  let opt = '';
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    opt = Object.entries(options as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string' && v.trim())
      .map(([k, v]) => `${k}.${v}`)
      .join(' ');
  }
  return opt ? s + '\n' + opt : s;
}
