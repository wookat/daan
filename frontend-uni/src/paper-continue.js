// 按卷练习续练：按服务端逐题 done 标记拆分已练/未练，fail-closed（无标记视为未练）
export function paperContinuePlan(items) {
  if (!Array.isArray(items)) return { doneN: 0, remaining: [] };
  let doneN = 0;
  const remaining = [];
  for (const q of items) {
    if (q && q.done === true) doneN++;
    else remaining.push(q);
  }
  return { doneN, remaining };
}
