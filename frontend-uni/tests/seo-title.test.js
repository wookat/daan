// R389：uni H5 构建用 manifest.json 的 h5.title（缺省 name）覆写 index.html 的 <title>，
// 首页此前线上 <title> 只有品牌名「错题邦」（Google 已收录的 2 页之一）——index.html 里写的 SEO 标题从未上线。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const html = read('../index.html');
// manifest.json 带 /* */ 注释，不是严格 JSON
const manifest = JSON.parse(read('../src/manifest.json').replace(/\/\*[\s\S]*?\*\//g, ''));

describe('首页 <title> 的真实来源是 manifest.h5.title', () => {
  const h5Title = manifest.h5 && manifest.h5.title;
  const htmlTitle = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  const ogTitle = (html.match(/property="og:title" content="([^"]*)"/) || [])[1];

  it('manifest.h5.title 存在且带检索词（公务员/行测/真题/错题本），不是只有品牌名', () => {
    expect(h5Title).toBeTruthy();
    for (const kw of ['公务员', '行测', '真题', '错题本']) expect(h5Title).toContain(kw);
    expect(h5Title.length).toBeGreaterThan(manifest.name.length + 8);
    // 移动端 SERP 大致截断在 30 个汉字左右
    expect(h5Title.length).toBeLessThanOrEqual(34);
  });

  it('index.html <title> / og:title 与 manifest.h5.title 三处一致（避免再出现"源码写了、线上没有"）', () => {
    expect(htmlTitle).toBe(h5Title);
    expect(ogTitle).toBe(h5Title);
  });
});

// R394：百度自适应标注（搜索学堂《自适应对百度友好关键》）——首页壳与 /tiku/* SSR 页同步声明 pc,mobile。
describe('首页壳百度自适应标注', () => {
  it('head 内恰有一条 applicable-device=pc,mobile，且在 <title> 之前', () => {
    const head = html.split('</head>')[0];
    const tags = head.match(/<meta name="applicable-device"[^>]*>/g) || [];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain('content="pc,mobile"');
    expect(head.indexOf(tags[0])).toBeLessThan(head.indexOf('<title>'));
  });
});
