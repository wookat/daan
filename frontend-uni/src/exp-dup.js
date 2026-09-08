// 官方解析是否已被花生十三解析覆盖（纯函数）：命中则完成页只展示 hs，避免复读。
// 两份解析常只差空白/全半角标点/结尾「故选 A」，精确子串判不出来，故归一化后按句级覆盖率判定。

const COVER_MIN = 0.8;

const FULL_TO_HALF = { '，': ',', '。': '.', '．': '.', '、': ',', '：': ':', '；': ';', '！': '!', '？': '?', '（': '(', '）': ')', '“': '"', '”': '"', '‘': "'", '’': "'", '【': '[', '】': ']', '《': '"', '》': '"', '％': '%', '～': '~', '—': '-', '－': '-' };
const FULL_RE = new RegExp('[' + Object.keys(FULL_TO_HALF).join('') + ']', 'g');
// 全角字母/数字（U+FF10-FF5A）→ ASCII
const FW_ALNUM_RE = /[\uff10-\uff5a]/g;
// 收束句：故选 A / 故本题选 AB / 确认答案为 C / 因此答案是 D / 综上，选 B …（可带「项」与句号）
const TAIL_RE = /([,.;:!?]|^)(?:故|因此|所以|综上所述|综上|由此)?,?(?:本题|此题)?(?:故选|应选|选择|确认答案为|正确答案为|答案为|答案是|答案选|选)[a-d]{1,4}项?[.!]*$/;

export function normalizeExplanation(s) {
  if (typeof s !== 'string') return '';
  const t = s
    .replace(/\s+/g, '')
    .replace(FW_ALNUM_RE, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(FULL_RE, (c) => FULL_TO_HALF[c])
    .toLowerCase();
  const m = TAIL_RE.exec(t);
  return m ? t.slice(0, m.index) + m[1] : t;
}

function sentences(t) {
  return t.split(/[.;!?]/).filter((x) => x.length > 0);
}

/**
 * expl 去首尾空白后长度 ≥ 20，且归一化后各句在归一化 hs 中的（按字数加权）覆盖率 ≥ 0.8 → true；
 * 其余（空/短文本/非字符串/覆盖不足）一律 false。
 */
export function isExplanationCovered(hs, expl) {
  if (typeof hs !== 'string' || typeof expl !== 'string') return false;
  if (expl.trim().length < 20) return false;
  const h = normalizeExplanation(hs);
  const e = normalizeExplanation(expl);
  if (!h || !e) return false;
  if (h.includes(e)) return true;
  const parts = sentences(e);
  const total = parts.reduce((n, p) => n + p.length, 0);
  if (!total) return false;
  const hit = parts.reduce((n, p) => n + (h.includes(p) ? p.length : 0), 0);
  return hit / total >= COVER_MIN;
}
