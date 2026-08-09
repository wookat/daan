// AI 输出文本处理：去停止符 / markdown 转纯文本 / 答案卡解析

export function stripStop(s: string): string {
  return (s || '').replace(/<\|[a-z_]+\|>/gi, '').trimEnd();
}

// 小程序端不渲染 rich-text（Skyline 下能力有限），把常见 markdown 标记转为可读纯文本
export function mdToPlain(s: string): string {
  return (s || '')
    .replace(/```[a-z]*\n?/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '· ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface AnsCard {
  ans: string;
  method: string;
  brief: string;
}

// 解析首行「【答案】X｜【方法】Y｜【一句话】Z」为答案卡（与 frontend-uni splitAnswer 对齐）
export function splitAnswer(full: string): { card: AnsCard | null; rest: string } {
  const text = full || '';
  const m = /^\s*【答案】\s*([^｜|\n]+?)\s*[｜|]\s*【方法】\s*([^｜|\n]+?)\s*[｜|]\s*【一句话】\s*([^\n]*)\n?/.exec(
    text
  );
  if (m) {
    return {
      card: { ans: m[1].trim(), method: m[2].trim(), brief: m[3].trim() },
      rest: text.slice(m.index + m[0].length),
    };
  }
  const lines = text.split('\n');
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const am = /【答案】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
    if (!am) continue;
    const mm = /【方法】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
    const bm = /【一句话】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
    const rest = lines
      .slice(0, i)
      .concat(lines.slice(i + 1))
      .join('\n');
    return {
      card: { ans: am[1].trim(), method: mm ? mm[1].trim() : '', brief: bm ? bm[1].trim() : '' },
      rest,
    };
  }
  return { card: null, rest: text };
}

export function fmtClock(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => (x < 10 ? '0' + x : String(x));
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDateTime(tsSec: number): string {
  const d = new Date((tsSec || 0) * 1000);
  const p = (n: number) => (n < 10 ? '0' + n : String(n));
  return (
    d.getFullYear() +
    '-' +
    p(d.getMonth() + 1) +
    '-' +
    p(d.getDate()) +
    ' ' +
    p(d.getHours()) +
    ':' +
    p(d.getMinutes())
  );
}

export function fmtAgo(tsSec: number): string {
  const diff = Date.now() / 1000 - tsSec;
  if (diff < 3600) return Math.max(1, Math.floor(diff / 60)) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 30 * 86400) return Math.floor(diff / 86400) + ' 天前';
  const d = new Date(tsSec * 1000);
  return `${d.getMonth() + 1}-${d.getDate()}`;
}
