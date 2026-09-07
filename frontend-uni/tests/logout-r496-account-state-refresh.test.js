// R496：个人页 / 统计页「退出登录」后只重拉了一部分数据，账号态的连续打卡 / 徽章 / 热力图 /
// 消息未读 / 模考趋势等仍留在屏上（顶部已显示「未登录」），要再切一次 tab 才恢复匿名态。
// 修法：onShow 的整套拉取抽成 refreshAccountData()，退出时先清账号态字段再整套按匿名身份重拉。
// R497：清字段 + 重拉收拢到 resetAccountState()，由 authChanged 监听在身份（uid）真变时调用：
// 退出登录、登录、401/403 自动清态三条路径都走同一处，doLogout 只需 clearAuth()。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PAGES = {
  profile: {
    src: readFileSync(new URL('../src/pages/profile/profile.vue', import.meta.url), 'utf8'),
    loaders: ['loadRemote', 'loadBadges', 'loadInbox'],
    cleared: ['mistakeN = null', 'profile = null', 'growth = null', 'badgeInfo = null', 'inboxUnread = 0'],
    userField: 'user',
  },
  stats: {
    src: readFileSync(new URL('../src/pages/stats/stats.vue', import.meta.url), 'utf8'),
    loaders: ['loadHeatmap', 'loadGrowth', 'loadReco', 'loadSlStats', 'loadMastery', 'loadExamTrend', 'load'],
    cleared: ['hmDays = null', 'svStreak = null', 'kmCov = null', 'examAttempts = null', 'examTarget = null', 'growth = null', 'reco = null', 'slStats = null'],
    userField: 'authUser',
  },
};

function block(src, name, indent) {
  const m = src.match(new RegExp(`\\n {${indent}}(?:async )?${name}\\([^)]*\\) \\{[\\s\\S]*?\\n {${indent}}\\},`));
  expect(m, name).not.toBeNull();
  return m[0];
}

for (const [page, cfg] of Object.entries(PAGES)) {
  describe(`${page}.vue 退出登录后整页回到匿名态`, () => {
    it('onShow 只调 refreshAccountData()，且 refreshAccountData 覆盖全部账号相关拉取', () => {
      const onShow = block(cfg.src, 'onShow', 2);
      expect(onShow).toMatch(/this\.refreshAccountData\(\);/);
      for (const l of cfg.loaders) expect(onShow, l).not.toMatch(new RegExp(`this\\.${l}\\(`));
      const refresh = block(cfg.src, 'refreshAccountData', 4);
      expect(refresh).toMatch(new RegExp(`this\\.${cfg.userField} = getAuthUser\\(\\);`));
      for (const l of cfg.loaders) expect(refresh, l).toMatch(new RegExp(`this\\.${l}\\(`));
    });

    it('resetAccountState() 先清账号态字段再 refreshAccountData()，不再各自挑选着重拉', () => {
      const reset = block(cfg.src, 'resetAccountState', 4);
      for (const c of cfg.cleared) expect(reset, c).toContain(`this.${c};`);
      expect(reset).toMatch(/this\.refreshAccountData\(\);/);
      expect(reset.indexOf('this.refreshAccountData();')).toBeGreaterThan(reset.indexOf(`this.${cfg.cleared[cfg.cleared.length - 1]};`));
      for (const l of cfg.loaders) expect(reset, l).not.toMatch(new RegExp(`this\\.${l}\\(`));
    });

    it('doLogout 确认后只 clearAuth()，清态/重拉交给 authChanged 监听（不重复、不漏）', () => {
      const body = block(cfg.src, 'doLogout', 4);
      const confirm = body.slice(body.indexOf('clearAuth();'));
      expect(confirm).toMatch(/clearAuth\(\);/);
      for (const c of cfg.cleared) expect(confirm, c).not.toContain(`this.${c};`);
      for (const l of [...cfg.loaders, 'refreshAccountData', 'resetAccountState']) expect(confirm, l).not.toMatch(new RegExp(`this\\.${l}\\(`));
    });

    it('authChanged 监听：身份 uid 变了才 resetAccountState()，不再只改顶部 user 字段（R497 401/403 自动清态当页残留）', () => {
      const m = cfg.src.match(/this\._onAuth = \(\) => \{([\s\S]*?)\n {4}\};/);
      expect(m).not.toBeNull();
      const h = m[1];
      expect(h).toMatch(/const u = getAuthUser\(\);/);
      expect(h).toMatch(new RegExp(`\\(u \\? u\\.uid : null\\) === \\(this\\.${cfg.userField} \\? this\\.${cfg.userField}\\.uid : null\\)\\) return;`));
      expect(h).toMatch(/this\.resetAccountState\(\);/);
      expect(h).not.toMatch(new RegExp(`this\\.${cfg.userField} = getAuthUser\\(\\);`));
    });
  });
}
