// 错题本「手录错题」（免 AI、不对回题库）：表单态 → POST /api/mistakes 请求体；
// 服务端 manual_mistake.normalize 同口径校验，这里只做可即时提示的前置检查。
export const MANUAL_MODULES = [
  { value: 'ziliao', label: '资料分析' },
  { value: 'shuliang', label: '数量关系' },
  { value: 'yanyu', label: '言语理解' },
  { value: 'panduan', label: '判断推理' },
  { value: 'changshi', label: '常识判断' },
  { value: '时政', label: '时政' },
];
export const MANUAL_LETTERS = ['A', 'B', 'C', 'D'];
export const MANUAL_QUESTION_MAX = 2000;
export const MANUAL_EXPLANATION_MAX = 2000;

export function emptyManualEntry() {
  return { module: '', question: '', correct: '', picked: '', reason: '', explanation: '' };
}

/** 单选/多选字母切换：correct 允许多选（多选题），picked 同样。返回新串（A-D 升序去重）。 */
export function toggleLetter(cur, L) {
  const set = new Set(String(cur || '').split('').filter((c) => MANUAL_LETTERS.includes(c)));
  if (set.has(L)) set.delete(L);
  else set.add(L);
  return [...set].sort().join('');
}

/** 不可提交的原因（空串=可提交）。 */
export function manualEntryError(f) {
  if (!f || !f.module) return '请选择模块';
  if (String(f.question || '').trim().length < 2) return '请填写题干（可连选项一起粘贴）';
  if (!f.correct) return '请选择正确答案';
  if (f.picked && f.picked === f.correct) return '我的答案与正确答案相同，不算错题';
  return '';
}

export function manualEntryBody(f, uid) {
  return {
    uid,
    source: 'manual',
    module: f.module,
    question_text: String(f.question || '').trim().slice(0, MANUAL_QUESTION_MAX),
    correct_answer: f.correct,
    user_answer: f.picked || null,
    error_reason: f.reason || null,
    explanation: String(f.explanation || '').trim().slice(0, MANUAL_EXPLANATION_MAX) || null,
  };
}

/** 保存回包 id 已在当前列表 → 服务端按同题干去重、只累计错次。 */
export function manualSavedToast(id, items) {
  const dup = Array.isArray(items) && items.some((m) => m && m.id === id);
  return dup ? '该题已在错题本，已记为再错一次' : '已加入错题本，之后会安排复习';
}
