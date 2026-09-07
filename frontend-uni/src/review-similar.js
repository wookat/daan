// 复习流「加练同类题」条目与错题记录构造（fail-closed 纯函数）

import { askAnswerLetter } from './ask-prefill.js';
import { reviewOptions, reviewOptionsFull } from './review-opts.js';
import { MODULE_KEYS } from './module-meta.js';

/** 错题/复习条目是否有题库同类题池：只有行测五模块走 /api/questions 抽题；时政（/api/shizheng/daily）、手录等模块无池，同类题入口不应出现。 */
export function hasSimilarPool(m) {
  return !!(m && typeof m === 'object' && typeof m.module === 'string' && MODULE_KEYS.includes(m.module));
}

/** 复习流条目 → AI 详解携带的用户作答：加练条目取本轮作答，普通条目取历史作答。 */
export function reviewAskAnswer(cur, picked) {
  if (!cur || typeof cur !== 'object') return '';
  return askAnswerLetter(cur._extra === true ? picked : cur.user_answer);
}

/** 错题/复习条目 → 同类题子模块：题库联查的 submodule（mistakes.question_type 已去「模块-」前缀、且与题库 submodule 口径不同，不可反推）；无则 null 只按模块抽。 */
export function similarSubmodule(m) {
  if (!m || typeof m !== 'object') return null;
  const s = typeof m.submodule === 'string' ? m.submodule.trim() : '';
  return s || null;
}

function optLine(options) {
  return Object.entries(options || {})
    .map(([k, v]) => `${k}.${v}`)
    .join(' ');
}

/** /api/questions item → 复习流 _extra 加练条目；无题干返回 null。结构化 options 有效时题干只留 stem（作答卡按 reviewOptions 铺选项）。 */
export function similarItemFromQuestion(x) {
  if (!x || typeof x !== 'object' || !x.question) return null;
  const id = Number(x.id);
  const full = reviewOptionsFull(reviewOptions({ options: x.options }));
  return {
    _extra: true,
    question_id: Number.isInteger(id) && id > 0 ? id : null,
    module: x.module || null,
    submodule: typeof x.submodule === 'string' && x.submodule.trim() ? x.submodule.trim() : null,
    question_type: x.question_type || x.submodule || null,
    question_text: full ? x.question : x.question + '\n' + optLine(x.options),
    options: full ? x.options : null,
    correct_answer: x.answer,
    explanation: x.hs_explanation || x.explanation || '',
  };
}

/** 复习流条目 → 错因打标目标错题 id；加练条目未入库返回 null。 */
export function reviewReasonMid(cur) {
  if (!cur || typeof cur !== 'object') return null;
  if (cur._extra === true) {
    const mid = Number(cur._mid);
    return Number.isInteger(mid) && mid > 0 ? mid : null;
  }
  const id = Number(cur.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** _extra 加练条目 → POST /api/mistakes 请求体；非加练/缺题干/缺正解返回 null。快照 question_text 与练习页同口径（题干 + 选项行）。 */
export function mistakeRecFromExtra(item, userAnswer, uid) {
  if (!item || item._extra !== true || !item.question_text || !item.correct_answer) return null;
  return {
    uid,
    question_id: item.question_id || null,
    module: item.module || null,
    question_type: item.question_type || null,
    question_text: item.options ? item.question_text + '\n' + optLine(item.options) : item.question_text,
    user_answer: userAnswer || null,
    correct_answer: item.correct_answer,
    explanation: item.explanation || '',
  };
}
