// AI 问答会话与题库题目关联（qid 挂在会话 item 上，fail-closed）
export function askQid(v) {
  let n = 0;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d+$/.test(v.trim())) n = Number(v.trim());
  return Number.isInteger(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER ? n : 0;
}

function hasQid(items, q) {
  return Array.isArray(items) && items.some((it) => it && typeof it === 'object' && !Array.isArray(it) && askQid(it.qid) === q);
}

// 会话讲解条目回到题目本体的搜索深链（code_hit 直达 + ?qid 自动展开详情）
export function askViewUrl(qid) {
  const q = askQid(qid);
  return q ? '/pkgA/search/search?q=' + q + '&qid=' + q : null;
}

// 返回 {sid}：sid=0 表示命中进行中会话；无命中返回 null
export function findAskSid(sessions, curItems, qid) {
  const q = askQid(qid);
  if (!q) return null;
  if (hasQid(curItems, q)) return { sid: 0 };
  if (!Array.isArray(sessions)) return null;
  for (const s of sessions) {
    if (s && typeof s === 'object' && !Array.isArray(s) && hasQid(s.items, q)) {
      const sid = s.id;
      if (Number.isInteger(sid) && sid > 0) return { sid };
    }
  }
  return null;
}

// 讲解流 thinking 心跳（推理模型 reasoning 阶段）→ 已推理秒数；非法/缺失一律 0
export function thinkingSecs(t) {
  const n = t && typeof t === 'object' && !Array.isArray(t) ? Number(t.secs) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// 流式卡正文到达前的占位文案：未收到心跳时保持「生成中…」，收到后显示推理计时（正文平均在推理 40 s 后才出现）
export function thinkingLabel(secs) {
  const s = thinkingSecs({ secs });
  if (!s) return '生成中…';
  return s < 30 ? `AI 正在推理…（已 ${s} 秒）` : `AI 推理接近完成，讲解正文马上出现…（已 ${s} 秒）`;
}

// 面试点评流同款占位（点评正文平均在推理 25 s 后才出现）
export function reviewThinkingLabel(secs) {
  const s = thinkingSecs({ secs });
  if (!s) return '考官正在撰写点评…';
  return s < 20 ? `考官正在思考…（已 ${s} 秒）` : `考官思考接近完成，点评正文马上出现…（已 ${s} 秒）`;
}
