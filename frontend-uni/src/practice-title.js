// 练习页导航栏标题：按当前会话来源给出（与小程序 practice.ts navTitleFor 同口径），
// 非会话态回落 pages.json 的「刷题」。卷名不硬截（uni-h5 顶栏 .uni-page-head__title 自带 nowrap+ellipsis，
// 375 宽约 14 字后省略号，桌面宽屏全显），只对异常长串做 40 字兑底。
export const PRACTICE_TITLE_DEFAULT = '刷题';
const PTITLE_MAX = 40;

export function practiceNavTitle(ctx, modName) {
  if (!ctx || !ctx.session) return PRACTICE_TITLE_DEFAULT;
  if (typeof ctx.ptitle === 'string' && ctx.ptitle.trim()) return ctx.ptitle.trim().slice(0, PTITLE_MAX);
  if (ctx.shizheng) return ctx.szPast ? '往期时政补练' : '时政每日一练';
  if (ctx.daily) return ctx.dailyPast ? '往期每日一练' : '每日一练';
  if (ctx.source === 'redo') return '错题重练';
  const mod = (ctx.module && typeof modName === 'function' && modName(ctx.module)) || '综合';
  if (ctx.reinforce) return mod + ' · 强化练习';
  if (typeof ctx.submodule === 'string' && ctx.submodule.trim()) return mod + ' · ' + ctx.submodule.trim();
  return mod + ' · 专项练习';
}
