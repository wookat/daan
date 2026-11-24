// 内测反馈 #56：数量关系「不考数字推理」排除开关前后端接线与预取隔离回归
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const readUni = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const readMini = (rel) => readFileSync(join(ROOT, '../miniapp-native/miniprogram', rel), 'utf8');

describe('#56 数量关系排除数字推理（H5 + 小程序）', () => {
  const home = readUni('src/pages/home/home.vue');
  const practice = readUni('src/pages/practice/practice.vue');
  const sessionOps = readUni('src/practice/session-ops.js');
  const miniLearn = readMini('api/learn.ts');
  const miniSetupWxml = readMini('pkgLearn/setup/setup.wxml');
  const miniSetupTs = readMini('pkgLearn/setup/setup.ts');
  const miniPractice = readMini('pages/practice/practice.ts');

  it('H5 首页在数量关系题型 sheet 与练习设置中均有开关并同步到 /api/profile & prefetchPack', () => {
    expect(home).toContain("v-if=\"subSelect === 'shuliang'\"");
    expect(home).toContain('不考数字推理');
    expect(home).toContain('排除数字推理');
    expect(home).toContain("exclude_shuzituili: v ? 1 : 0");
    expect(home).toContain("uni.removeStorageSync('prefetchPack')");
    expect(home).toContain('exclSub');
    expect(home).toContain("encodeURIComponent(exclSub)");
  });

  it('H5 practice.vue start() 与 session-ops 预取均传递 exclude_sub 且按 exclSub 校验预取包', () => {
    expect(practice).toContain("const exclSubVal = this.excludeSz && !submodule && !tag3 && (!module || module === 'shuliang') ? '数字推理' : '';");
    expect(practice).toContain('&exclude_sub=');
    expect(practice).toContain("if (p.excludeSz != null)");
    expect(sessionOps).toContain("if ((pk.exclSub || '') !== wantExclSub) return null;");
    expect(sessionOps).toContain("pk.module !== (module || '')");
  });

  it('小程序 setup + learn.ts + practice.ts 同步支持 exclude_sub 与 exclude_shuzituili', () => {
    expect(miniLearn).toContain('excludeSub?: string | null;');
    expect(miniLearn).toContain("'&exclude_sub=' + encodeURIComponent(exclSub)");
    expect(miniLearn).toContain("'exclude_shuzituili'");
    expect(miniSetupWxml).toContain('不考数字推理');
    expect(miniSetupWxml).toContain('onExcludeSz');
    expect(miniSetupTs).toContain('exclude_shuzituili');
    expect(miniPractice).toContain("wx.getStorageSync('excludeShuzituili')");
  });
});
