// 全站 38 页三端审查与全量优化（批次 A–E）核心回归锁
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO = join(ROOT, '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const readRepo = (rel) => readFileSync(join(REPO, rel), 'utf8');

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe('Batch A：P0 安全/数据隔离/崩溃/iPad 缩放', () => {
  it('pages.json 与 font-size.js 禁止 iPad 768-959px 下 rpx 2.05× 字体暴涨', () => {
    const pagesJson = JSON.parse(read('src/pages.json'));
    expect(pagesJson.globalStyle.rpxCalcMaxDeviceWidth).toBe(480);
    const fsJs = read('src/services/font-size.js');
    expect(fsJs).not.toMatch(/\d+rpx/);
  });

  it('theme.js 设置 .tc-light 并在切换主题时广播 themeChanged 供 ECharts 实时重绘', () => {
    const themeJs = read('src/services/theme.js');
    expect(themeJs).toContain('tc-light');
    expect(themeJs).toContain("uni.$emit('themeChanged'");
  });

  it('kg-button.vue 桌面 hover 按 tone 分域，不把反色/危险按钮洗成品牌主色', () => {
    const btn = read('src/components/kg-button/kg-button.vue');
    expect(btn).toContain('.kg-btn.kg-btn--tone-brand.kg-btn--primary:hover');
    expect(btn).toContain('.kg-btn.kg-btn--tone-bad.kg-btn--primary:hover');
    expect(btn).toContain('.kg-btn.kg-btn--tone-inverse.kg-btn--primary:hover');
  });

  it('dev/design 生产隔离：precache 排除 dev-design 且 design.vue 有 DEV 门禁与 .ds-wrap 命名', () => {
    const precache = read('scripts/gen-precache-manifest.mjs');
    expect(precache).toContain('dev-design');
    const design = read('src/pkgA/dev/design.vue');
    expect(design).toContain('isDev');
    expect(design).toContain('ds-wrap');
  });

  it('ask.vue 隔离账号切换会话、exam.vue 持久化 eventId/templateId、team.vue 邀请链带 /app/、login.vue 防 SSO 死循环', () => {
    const ask = read('src/pages/ask/ask.vue');
    expect(ask).toContain('authChanged');
    expect(ask).toContain('resetAccountState');

    const exam = read('src/pkgA/exam/exam.vue');
    expect(exam).toContain('eventId: this._eventId');
    expect(exam).toContain('templateId: this._templateId');

    const team = read('src/pkgA/team/team.vue');
    expect(team).toContain('/app/#/pages/team/join');

    const login = read('src/pkgA/user/login.vue');
    expect(login).toContain('fromCallback');
  });
});

describe('Batch B：三端响应式骨架与 KgTwoCol 规范化', () => {
  it('kg-two-col.vue 空 aside 隐藏且 sticky top 计入 --window-top', () => {
    const two = read('src/components/kg-two-col/kg-two-col.vue');
    expect(two).toContain('.kg-two__aside:empty');
    expect(two).toContain('--window-top');
  });

  it('reminders.vue 单栏居中且不包含矛盾的双重提醒卡', () => {
    const rem = read('src/pkgA/settings/reminders.vue');
    expect(rem).toContain('520px');
    expect(rem).not.toContain('kg-two-col');
  });
});

describe('Batch C：核心业务子页并发、账号与交互修复', () => {
  it('shenlun.vue 统一走 anonUid() 不直读 storage key 且有请求序锁', () => {
    const sl = read('src/pkgA/shenlun/shenlun.vue');
    expect(sl).not.toMatch(/getStorageSync\(\s*['"]anonUid['"]\s*\)/);
    expect(sl).toContain('_qSeq');
    expect(sl).toContain('_openSeq');
  });

  it('interview.vue 桌面端左题右答分栏并移除无效语音桩', () => {
    const iv = read('src/pkgA/interview/interview.vue');
    expect(iv).toContain('ans-two');
    expect(iv).not.toContain('voiceStub');
  });

  it('stats.vue 监听 themeChanged 并在切换账号时重置页面状态', () => {
    const st = read('src/pages/stats/stats.vue');
    expect(st).toContain('themeChanged');
    expect(st).toContain('resetAccountState');
  });
});

describe('Batch D & E：全站零 rpx、零失效 Beacon、旧组件现代化与孤儿文件清理', () => {
  it('landing/index.html 与 frontend-uni/index.html 不再加载失效 beacon.min.js', () => {
    const appHtml = read('index.html');
    const lpHtml = readRepo('landing/index.html');
    expect(appHtml).not.toContain('beacon.min.js');
    expect(lpHtml).not.toContain('beacon.min.js');
    expect(lpHtml).toMatch(/prefers-color-scheme:\s*dark/);
    expect(lpHtml).toContain('navDrawer');
  });

  it('frontend-uni/src 全部 vue/css/scss 文件已 0 残留 rpx 且 export-confirm 使用 --tab-h', () => {
    const files = walk(join(ROOT, 'src')).filter((p) => /\.(vue|css|scss)$/.test(p));
    const hits = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      if (/\d+rpx/.test(text)) hits.push(f);
    }
    expect(hits).toEqual([]);

    const exp = read('src/components/export-confirm/export-confirm.vue');
    expect(exp).toContain('var(--tab-h)');
  });

  it('landing/index.html 账号态埋点携带 Bearer authToken 防 403，且 exam.vue 到期后停止上报进度防 400', () => {
    const lpHtml = readRepo('landing/index.html');
    expect(lpHtml).toContain('readUniStr');
    expect(lpHtml).toContain('isAccountUid');
    expect(lpHtml).toContain('hdrs.Authorization');

    const exam = read('src/pkgA/exam/exam.vue');
    expect(exam).toMatch(/pushProgress\(\)\s*\{\s*if\s*\(!this\.attemptId \|\| this\.submitting \|\| \(this\._endAt && Date\.now\(\) >= this\._endAt\)\) return;/);
  });
});
