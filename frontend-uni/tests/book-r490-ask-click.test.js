// R490：错题本列表展开态「AI 详解」（redo(m)）是生产唯一被非探针用户真实走过的带 qid 问答深链
// （09-05 17:05:56Z 展开卡 234494 → 17:05:57Z 问答页 → 17:07:18Z explain/stream 带 qid），
// 但它是 7 个带 qid 入口里唯一没有 *_ask_click 埋点的——R487/R489 的「6 入口」漏数了它，
// 导致 R489 把这次触达按排除法误归到练习页深链。switchTab 不改 Referer，埋点是唯一可观测手段。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8')+readFileSync(new URL('../src/pages/book/review-ops.js', import.meta.url), 'utf8');

describe('book.vue 列表「AI 详解」深链打点', () => {
  it('redo(m) 在 switchTab 前打 book_ask_click（source=module, ref=qid）', () => {
    const m = SRC.match(/redo\(m\) \{[\s\S]*?uni\.switchTab\(\{ url: '\/pages\/ask\/ask' \}\);/);
    expect(m).not.toBeNull();
    expect(m[0]).toMatch(/trackEvent\('book_ask_click', m\.module \|\| '', String\(qid \|\| ''\)\);\n\s*uni\.switchTab/);
  });

  it('全部带 qid 的问答深链（写 redoQid）都有 *_ask_click 埋点', () => {
    // 每处 setStorageSync('redoQid', …) 到最近的 switchTab 之间必须有一条 trackEvent('…_ask_click'
    const blocks = SRC.split("uni.switchTab({ url: '/pages/ask/ask' })");
    const withQid = blocks.filter((b) => b.includes("uni.setStorageSync('redoQid'"));
    expect(withQid.length).toBe(2); // askFromReview + redo
    for (const b of withQid) {
      // 只看写 redoQid 的那个方法体（4 空格缩进的方法头到块尾）
      const heads = [...b.matchAll(/\n {4}\w+\([^)]*\) \{/g)];
      const method = b.slice(heads[heads.length - 1].index);
      expect(method).toContain("uni.setStorageSync('redoQid'");
      expect(method).toMatch(/trackEvent\('[a-z]+_ask_click'/);
    }
  });
});
