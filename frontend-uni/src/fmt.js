// 共享日期/时长格式化——全部基于 dayjs（vendor/dayjs，npm tarball 内嵌版）。
// 各页同名本地 fmt* 方法统一收敛到这里；新增时间展示先来这里找，没有再写。
// 入参约定：ts 均为「秒」（后端 created_at/submitted_at 均为 epoch 秒），fmtSlashMD 例外（毫秒）。
import dayjs from './vendor/dayjs/index.js';

export { dayjs };

// 'M-DD HH:mm' —— interview/history、social/inbox、social/plaza、stats/practice-history 同款
export const fmtMDHM = (ts) => dayjs((ts || 0) * 1000).format('M-DD HH:mm');

// 'M月D日 HH:mm' —— exam/list 提交时间
export const fmtCnDHM = (ts) => dayjs((ts || 0) * 1000).format('M月D日 HH:mm');

// 'YYYY-MM-DD HH:mm' —— shenlun 历史
export const fmtYMDHM = (ts) => dayjs((ts || 0) * 1000).format('YYYY-MM-DD HH:mm');

// 'YYYY-MM-DD' —— plan-setup-sheet 考试日期
export const fmtYMD = (d) => dayjs(d).format('YYYY-MM-DD');

// 'M/D HH:mm' —— ask 历史记录（入参为毫秒）
export const fmtSlashMD = (ms) => dayjs(ms).format('M/D HH:mm');

// `m'ss"` —— 作答时长（interview/history 同款，恒显示分钟位）
export const fmtDur = (s) => `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;

// 短时长：不足一分钟不显示 0'（practice-history 语义）
export const fmtDurShort = (s) => {
  if (!s) return '0"';
  const m = Math.floor(s / 60);
  return m ? fmtDur(s) : `${s}"`;
};

// 相对时间 'N 分钟前/小时前/天前'（30 天外落 'M-D'）—— social/discuss
export const fmtAgo = (ts) => {
  const diff = Date.now() / 1000 - ts;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 30 * 86400) return `${Math.floor(diff / 86400)} 天前`;
  return dayjs((ts || 0) * 1000).format('M-D');
};

// '今天/昨天/M 月 D 日' —— practice-history 分组日标签
export const fmtDayLabel = (ts) => {
  const d = dayjs((ts || 0) * 1000);
  const now = dayjs();
  if (d.isSame(now, 'day')) return '今天';
  if (d.isSame(now.subtract(1, 'day'), 'day')) return '昨天';
  return d.format('M 月 D 日');
};
