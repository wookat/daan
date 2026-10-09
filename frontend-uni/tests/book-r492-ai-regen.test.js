// R492 错题本 AI 分析结果态整页审：成功结果按页面生命周期缓存（tab 页常驻），用户练完新题回到错题本
// 再开只会看到旧结果且无任何重新生成入口（只能整页刷新）；失败态（R398）保持不缓存 + 重试。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/pages/book/book.vue', import.meta.url)), 'utf8');

describe('book.vue AI 错题分析结果态（源文件锁）', () => {
  it('成功结果态带「重新生成」入口，走 aiAnalysis(true) 绕过 aiHtml 缓存', () => {
    const m = src.match(/<view v-else>\s*<rich-text :nodes="aiHtml" \/>([\s\S]*?)<\/view>/);
    expect(m, '结果态 rich-text 需包在容器里并跟随重新生成按钮').toBeTruthy();
    // 重新生成入口固定在 #footer（长报告不用滚到底）：kg-button + aiAnalysis(true) 绕过缓存
    expect(src).toMatch(/<kg-button v-if="aiHtml && !aiLoading"[^>]*@click="aiAnalysis\(true\)">按当前错题重新生成/);
  });
  it('已有结果时重新生成失败只 toast、不覆盖旧结果；首次失败仍走 aiErr 失败态', () => {
    const fn = src.slice(src.indexOf('async aiAnalysis(retry)'), src.indexOf('this.aiLoading = false;', src.indexOf('async aiAnalysis(retry)')));
    expect(fn).toMatch(/if \(this\.aiHtml\) uni\.showToast\(\{ title: '重新生成失败：'/);
    expect(fn).toMatch(/else this\.aiErr = e\.message/);
  });
});
