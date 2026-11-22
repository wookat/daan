// 全栈代码审查 P2/P3 前端、管理台、落地页与工具链专项回归测试
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSseEvents, trackReplayPayload } from '../src/api/api-policy.js';

const rootRead = (rel) => readFileSync(fileURLToPath(new URL('../../' + rel, import.meta.url)), 'utf8');

describe('P2-F1/F2/F3/F5: 路由状态、组件生命周期与 App 节流', () => {
  it('4 个页面 replaceState 均保留 window.history.state（不再传 null）', () => {
    for (const rel of [
      'frontend-uni/src/pkgA/exam/list.vue',
      'frontend-uni/src/pkgA/search/search.vue',
      'frontend-uni/src/pkgA/shenlun/shenlun.vue',
      'frontend-uni/src/pkgA/stats/mastery-map.vue',
    ]) {
      const src = rootRead(rel);
      expect(src, rel).not.toMatch(/replaceState\s*\(\s*null/);
      expect(src, rel).toContain('replaceState(window.history.state');
    }
  });

  it('KgSheet 保存并正确解绑 _mq；KgLottie 卸载后 _destroyed 防竞态；App.vue rAF 合并', () => {
    const sheet = rootRead('frontend-uni/src/components/kg-sheet/kg-sheet.vue');
    expect(sheet).toContain('this._mq = mq');
    expect(sheet).toContain('this._mq.removeEventListener');

    const lottie = rootRead('frontend-uni/src/components/kg-lottie/kg-lottie.vue');
    expect(lottie).toContain('this._destroyed = true');
    expect(lottie).toMatch(/if\s*\(\s*this\._destroyed\b[^)]*\)\s*return/);

    const app = rootRead('frontend-uni/src/App.vue');
    expect(app).toContain('requestAnimationFrame');
  });
});

describe('P2-F4/F6/F7/F11/F13: PK/Ask/ExamList/AnalysisCard/Export/API 细节', () => {
  it('pk.vue pick() 立即停表、记录 _pickDelay 并透传 image/option_imgs', () => {
    const pk = rootRead('frontend-uni/src/pkgA/pk/pk.vue');
    expect(pk).toMatch(/pick\(k\)\s*\{[\s\S]*?this\.stopTimer\(\);[\s\S]*?this\._pickDelay = setTimeout/);
    expect(pk).toContain('option_imgs');
    expect(pk).toContain('imgUrl');
  });

  it('kg-analysis-card 多选判对先排序字母', () => {
    const card = rootRead('frontend-uni/src/components/kg-analysis-card/kg-analysis-card.vue');
    expect(card).toContain("sort().join('')");
  });

  it('kg-question-card 格式化空格占位符为横线且不动段首缩进', () => {
    const qcard = rootRead('frontend-uni/src/components/kg-question-card/kg-question-card.vue');
    expect(qcard).toContain('displayStem');
    expect(qcard).toContain('$1 ____ $2');
  });

  it('exportPdf H5 携带 X-Access-Code 与 authHeader', () => {
    const exp = rootRead('frontend-uni/src/api/export.js');
    expect(exp).toContain("'X-Access-Code': getAccessCode(), ...authHeader()");
  });

  it('api-policy: parseSseEvents 容错非法 JSON；trackReplayPayload 按需保留 platform/session_id', () => {
    const parsed = parseSseEvents('event: message\ndata: {bad json\n\nevent: message\ndata: {"d":"ok"}\n\n');
    expect(parsed.events).toEqual([{ type: 'message', data: { d: 'ok' } }]);

    expect(trackReplayPayload({ uid: 'u1', event: 'e', t: 1000, platform: 'h5', session_id: 's1' }, 2500)).toEqual({
      uid: 'u1',
      event: 'e',
      source: null,
      ref: null,
      ago_ms: 1500,
      platform: 'h5',
      session_id: 's1',
    });
  });

  it('interview.vue 卸载 abort 流且支持无 _sid 重试', () => {
    const iv = rootRead('frontend-uni/src/pkgA/interview/interview.vue');
    expect(iv).toContain('AbortController');
    expect(iv).toContain('this._streamAc.abort()');
    expect(iv).toContain('if (!this._sid)');
  });

  it('exam/list.vue 无重复 ref="seg"、无未定义 --ls-num', () => {
    const list = rootRead('frontend-uni/src/pkgA/exam/list.vue');
    expect(list).toContain('ref="seg"');
    expect(list).toContain('ref="seg2"');
    expect(list).not.toContain('--ls-num');
  });

  it('profile.vue 登录后账号卡不触发 goLogin，偏好设置移入 #aside 平衡桌面双栏，主题色单行不裁切', () => {
    const prof = rootRead('frontend-uni/src/pages/profile/profile.vue');
    expect(prof).toContain('@click="!user && goLogin()"');
    expect(prof).toContain('flex-wrap: nowrap');
    expect(prof).toContain('custom-class="acc-cell"');
    expect(prof.indexOf('<template #aside>')).toBeLessThan(prof.indexOf('<kg-section-header title="偏好设置" />'));
  });
});

describe('P2-F8/F12/Infra: 落地页、管理后台与工具路径', () => {
  it('管理后台按需加载模块、捕获 unhandledrejection、analytics 失败驱逐缓存、governance 支持 refresh=1', () => {
    const idx = rootRead('backend/app/admin/index.html');
    expect(idx).not.toContain('/admin/static/pages/dashboard.js');

    const core = rootRead('backend/app/admin/core.js');
    expect(core).toContain('loadPageScript');
    expect(core).toContain('unhandledrejection');
    expect(core).toContain('assetVersion');

    const ana = rootRead('backend/app/admin/pages/analytics.js');
    expect(ana).toContain('delete cache[path]');

    const gov = rootRead('backend/app/admin/pages/governance.js');
    expect(gov).toContain('/api/admin/governance?refresh=1');
  });

  it('landing/index.html 统一支持邮箱与题库口径，跑马灯克隆带 aria-hidden 且离屏暂停', () => {
    const lp = rootRead('landing/index.html');
    expect(lp).not.toContain('wookat@qq.com');
    expect(lp).not.toContain('63,992');
    expect(lp).toContain('support@zalize.com');
    expect(lp).toContain("clone.setAttribute('aria-hidden', 'true')");
    expect(lp).toContain('if (reduce || !inView) return');
  });

  it('tools/api-types/gen.mjs 写入正确的 src/api/api-openapi.d.ts', () => {
    const gen = rootRead('tools/api-types/gen.mjs');
    expect(gen).toContain('frontend-uni/src/api/api-openapi.d.ts');
    expect(gen).not.toContain("'frontend-uni/src/api-openapi.d.ts'");
  });
});
