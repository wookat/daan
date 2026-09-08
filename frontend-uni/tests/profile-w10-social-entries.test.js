// W10-B：H5 除 pk-result / share-q / team-join 外无任何页面 navigateTo PK 与小队页，功能只能靠外链进入；
// 「我的」页「学习」分组补两条站内入口，与小程序 profile（onPk/onTeam）口径对齐。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(new URL('../src/pages/profile/profile.vue', import.meta.url), 'utf8');

describe('profile.vue PK / 小队站内入口', () => {
  it('goPk / goTeam 分别 navigateTo pkgA 的 pk 与 team 页', () => {
    expect(SRC).toMatch(/goPk\(\) \{\s*uni\.navigateTo\(\{ url: '\/pkgA\/pk\/pk' \}\);/);
    expect(SRC).toMatch(/goTeam\(\) \{\s*uni\.navigateTo\(\{ url: '\/pkgA\/team\/team' \}\);/);
  });

  it('两条 cell 挂在「学习」分组、位于讨论消息与练习历史之间', () => {
    const group = SRC.slice(SRC.indexOf('<kg-section-header title="学习" />'), SRC.indexOf('<kg-section-header title="偏好设置" />'));
    const order = ['@click="goInbox"', 'title="PK 对战"', '@click="goPk"', 'title="学习小队"', '@click="goTeam"', '@click="goPracticeHistory"'];
    const idx = order.map((s) => group.indexOf(s));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('小队副标只读快照、不新增请求', () => {
    expect(SRC).toMatch(/peekTeamName\(\) \{[\s\S]*?snapPeek\('\/api\/team\/mine\?uid='/);
    expect(SRC).not.toMatch(/teamMine\(|request\(['"`]\/api\/team/);
  });
});
