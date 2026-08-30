// 构建后处理：将 H5 入口 index.html 的渲染阻塞 CSS <link> 内联为 <style>，
// 消除移动网络下的额外请求往返（Lighthouse render-blocking）。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'dist/build/h5');
const htmlPath = resolve(outDir, 'index.html');

let html = readFileSync(htmlPath, 'utf8');
const linkRe = /<link\s+rel="stylesheet"[^>]*?href="(\/[^"]+\.css)"[^>]*>/g;

let count = 0;
html = html.replace(linkRe, (tag, href) => {
  const css = readFileSync(resolve(outDir, '.' + href), 'utf8').trim();
  count += 1;
  return `<style>/* inlined: ${href} */\n${css}\n</style>`;
});

if (count === 0) throw new Error('inline-critical-css: 未找到任何 stylesheet link，产物结构可能已变化');
writeFileSync(htmlPath, html);
console.log(`inline-critical-css: 已内联 ${count} 个 CSS 到 index.html`);
