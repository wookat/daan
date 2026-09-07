// R494：完成页登录/推送两条 nudge 的漏斗此前只有 show / click / ok 三个事件，
// 「关闭」与「开启失败（权限拒绝 / 订阅异常）」在生产完全不可观测——
// 首个非探针 uid 同时看到两条 nudge 后 0 click / 0 ok / push_subs 0，无法区分「忽略」「关掉」「点了但失败」。
// 关闭与失败各补一条埋点（不改展示条件、不改本地关闭语义）。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(new URL('../src/pages/practice/practice.vue', import.meta.url), 'utf8');
const TEAM = readFileSync(new URL('../../backend/app/team.py', import.meta.url), 'utf8');

function method(name) {
  const m = SRC.match(new RegExp(`\\n {4}(?:async )?${name}\\([^)]*\\) \\{[\\s\\S]*?\\n {4}\\},`));
  expect(m, name).not.toBeNull();
  return m[0];
}

describe('practice.vue 完成页 nudge 漏斗埋点', () => {
  it('dismissLoginNudge 写 loginNudgeDismissed 后打 login_nudge_dismiss', () => {
    const body = method('dismissLoginNudge');
    expect(body).toMatch(/setStorageSync\('loginNudgeDismissed', '1'\);\n\s*trackEvent\('login_nudge_dismiss'\)/);
  });

  it('dismissPushNudge 写 pushNudgeOff 后打 push_nudge_dismiss', () => {
    const body = method('dismissPushNudge');
    expect(body).toMatch(/setStorageSync\('pushNudgeOff', '1'\);\n\s*trackEvent\('push_nudge_dismiss'\)/);
  });

  it('pushNudgeGo 权限非 granted → push_nudge_fail/denied；subscribe/上报异常 → push_nudge_fail/error；成功仍 push_nudge_ok', () => {
    const body = method('pushNudgeGo');
    expect(body).toMatch(/!== 'granted'\) \{[\s\S]*?trackEvent\('push_nudge_fail', null, 'denied'\);\n\s*return;/);
    expect(body).toMatch(/catch \(e\) \{[\s\S]*?trackEvent\('push_nudge_fail', null, 'error'\);/);
    expect(body).toMatch(/this\.pushNudgeDone = true;\n\s*trackEvent\('push_nudge_ok'\)/);
  });

  it('前端打的 nudge 事件都在 /api/track 白名单里', () => {
    const events = [...SRC.matchAll(/trackEvent\('((?:login|push)_nudge_[a-z]+)'/g)].map((m) => m[1]);
    expect(new Set(events)).toEqual(
      new Set(['login_nudge_show', 'login_nudge_click', 'login_nudge_dismiss', 'push_nudge_show', 'push_nudge_ok', 'push_nudge_fail', 'push_nudge_dismiss'])
    );
    for (const ev of new Set(events)) expect(TEAM, ev).toContain(`"${ev}"`);
  });
});
