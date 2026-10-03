// 「继续上次…？」确认层文案（练习本机快照 / 跨设备快照 / 未交卷模考）。
// 丢弃进度是破坏性动作，只能显式点按；关层（X / Esc / Back / 遮罩）一律等于「继续」。
export function resumeAsk(kind, { title, done, total }) {
  const n = Number(done) || 0;
  const all = Number(total) || 0;
  const t = title ? '「' + title + '」' : '';
  if (kind === 'exam') {
    return {
      title: '继续上次模考？',
      tip: `${t}检测到未交卷的进度（已答 ${n}/${all} 题）。重新开始会丢弃这些作答，从第 1 题重新计时。`,
      cont: '继续上次模考',
      drop: `重新开始（丢弃已答 ${n} 题）`,
    };
  }
  const where = kind === 'remote' ? '在其他设备还有一组未做完' : '上次还有一组未做完';
  return {
    title: '继续上次练习？',
    tip: `${t}${where}（${n}/${all} 题）。开新一组会清掉这组进度（已答记录仍进错题本）。`,
    cont: '继续上次练习',
    drop: '不用了，开新一组',
  };
}

// 关层收尾：未显式选择就关掉（X / Esc / Back / 遮罩）→ 按「继续」处理；已选过则不重复执行
export function resumeDismissAction(act) {
  if (!act || act.picked) return null;
  return 'cont';
}
