// KgOptionGroup 7 态判定（COMPONENTS §2.1），纯函数便于 vitest；H5 与小程序（kg-option-group 阶段 2）共用口径。
export const OPTION_STATES = ['idle', 'selected', 'right', 'wrong', 'dim', 'excluded', 'disabled'];

const toList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * @param {string} key 选项字母
 * @param {{picked?: string|string[], answer?: string|string[], revealed?: boolean, excluded?: string[], readonly?: boolean}} ctx
 */
export function optionState(key, ctx) {
  const picked = toList(ctx.picked);
  const answers = toList(ctx.answer);
  if (ctx.readonly && !ctx.revealed) return 'disabled';
  if (ctx.revealed) {
    if (answers.includes(key)) return 'right';
    if (picked.includes(key)) return 'wrong';
    return 'dim';
  }
  if ((ctx.excluded || []).includes(key)) return 'excluded';
  if (picked.includes(key)) return 'selected';
  return 'idle';
}

/** 点击后的新 modelValue；不可点（锁定/已排除）返回 null */
export function nextPicked(key, ctx) {
  if (ctx.readonly || ctx.revealed || (ctx.excluded || []).includes(key)) return null;
  const picked = toList(ctx.picked);
  if (!ctx.multiple) return key;
  return picked.includes(key) ? picked.filter((x) => x !== key) : [...picked, key].sort();
}
