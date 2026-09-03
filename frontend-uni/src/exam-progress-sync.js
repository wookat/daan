// 模考进度跨设备续考：/api/exam/resume 应答 -> examProgress 同构本机快照
// 本机快照仍有效时一律本机优先（返回 null，不覆盖）。
import { parseExamProgress } from './exam-resume';

export function adoptServerExamProgress(localSaved, server, now) {
  if (parseExamProgress(localSaved, now)) return null;
  if (!server || !server.attempt_id || !server.paper || !server.paper.id) return null;
  if (!Array.isArray(server.items) || !server.items.length) return null;
  const endAt = Number(server.end_at_ms);
  if (!Number.isFinite(endAt) || endAt <= now) return null;
  const picks = server.picks && typeof server.picks === 'object' ? server.picks : {};
  const marked = new Set(
    (Array.isArray(server.marks) ? server.marks : [])
      .map((m) => Number(m))
      .filter((m) => Number.isFinite(m)),
  );
  const rawSecs = server.secs && typeof server.secs === 'object' && !Array.isArray(server.secs) ? server.secs : {};
  const secsById = {};
  Object.keys(rawSecs).forEach((k) => {
    const id = Number(k);
    const v = Number(rawSecs[k]);
    if (Number.isFinite(id) && Number.isFinite(v) && v > 0) secsById[id] = Math.floor(v);
  });
  const rawExcl = server.excl && typeof server.excl === 'object' && !Array.isArray(server.excl) ? server.excl : {};
  const exclById = {};
  Object.keys(rawExcl).forEach((k) => {
    const id = Number(k);
    const v = rawExcl[k];
    if (!Number.isFinite(id) || !Array.isArray(v)) return;
    const letters = v.filter((x) => typeof x === 'string' && ['A', 'B', 'C', 'D'].includes(x));
    if (letters.length) exclById[id] = letters;
  });
  const items = server.items.map((q) => ({
    ...q,
    _picked: typeof picks[q.id] === 'string' ? picks[q.id] : (typeof picks[String(q.id)] === 'string' ? picks[String(q.id)] : ''),
    _marked: marked.has(Number(q.id)),
    _secs: secsById[Number(q.id)] || 0,
    _excl: exclById[Number(q.id)] || [],
  }));
  const idx = Number.isInteger(server.idx) && server.idx > 0 ? Math.min(server.idx, items.length - 1) : 0;
  return {
    attemptId: server.attempt_id,
    paperId: server.paper.id,
    mini: false,
    paper: server.paper,
    items,
    idx,
    endAt,
  };
}
