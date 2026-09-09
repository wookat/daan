// R565：小程序两处「继续上次练习/模考？」原生 wx.showModal 的 cancel 分支都是丢弃进度（H5 R564 已改 KgSheet）。
// wx.showModal 没有 Esc/遮罩隐式关闭、cancelText 限 4 字，故不改按钮，只把后果写进 content；
// 模考恢复层 fail（弹窗本身失败、非用户选择）不再等于丢弃快照重开。其余「放弃…？」确认 cancel=再想想 为非破坏，不动。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const PRACTICE = read('../miniprogram/pages/practice/practice.ts');
const EXAM = read('../miniprogram/pkgExam/exam/exam.ts');

describe('practice.ts 本机快照恢复确认', () => {
  it('content 明示「不用了」= 清进度开新一组（已答记录仍进错题本）；cancelText 仍 ≤4 字', () => {
    const i = PRACTICE.indexOf("title: '继续上次练习？'");
    const body = PRACTICE.slice(i, PRACTICE.indexOf('});', i));
    expect(body).toContain("选「不用了」会清掉这组进度并开新一组（已答记录仍进错题本）。");
    expect(body).toContain("cancelText: '不用了',");
    expect(body).toContain('wx.removeStorageSync(PENDING_KEY);');
    expect(body).toContain('this.clearServerProgress();');
  });
});

describe('pkgExam/exam.ts 未交卷恢复确认', () => {
  it('content 明示重新开始会丢弃作答并重新计时；fail 分支视为继续（不丢快照）', () => {
    const i = EXAM.indexOf("title: '继续上次模考？'");
    const body = EXAM.slice(i, EXAM.indexOf('});', i));
    expect(body).toContain("重新开始会丢弃这些作答，从第 1 题重新计时。");
    expect(body).toContain("cancelText: '重新开始',");
    expect(body).toContain('success: (r) => resolve(!!r.confirm),');
    expect(body).toContain('fail: () => resolve(true),');
    expect(body).not.toContain('fail: () => resolve(false)');
  });
});
