#!/usr/bin/env node
// 页面裸值门禁（SPEC §6.6 open question #6 的零依赖版，不引 stylelint）。
// 扫 frontend-uni/src/**/*.vue 的 <style> 与 miniapp-native/miniprogram/**/*.wxss：
//   裸 #hex / rgb() / rgba()（var() 之外）、font-size 用 rpx、font-weight 700/800/bold、word-break: break-all。
// 共享层（components/kg-*、l-icon、App.vue、uni.scss、app.wxss）命中 = error；业务页面先 warn（F5），页面组交付后加 --strict 转 error。
// 用法：node tools/design-tokens/lint-pages.mjs [--strict] [--quiet] [--file=<子串>]（只看某文件的命中）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const QUIET = args.has('--quiet');
const ONLY = [...args].find((a) => a.startsWith('--file='))?.slice(7) || '';

const RULES = [
  { id: 'no-hex', re: /#[0-9a-f]{3,8}\b/gi, msg: '裸 hex 色值 → 语义 token（--ink/--brand/--ok…）' },
  { id: 'no-rgb', re: /\brgba?\(/g, msg: 'rgb()/rgba() → 语义 token 或 -soft 变体' },
  { id: 'fs-rpx', re: /font-size\s*:\s*[^;]*\d\s*rpx/g, msg: 'font-size rpx → --fs-*（7 档 px）' },
  { id: 'fw', re: /font-weight\s*:\s*(700|800|900|bold|bolder)\b/g, msg: 'font-weight 700/800/bold → 600' },
  { id: 'wb', re: /word-break\s*:\s*break-all/g, msg: 'word-break: break-all → .q-text（line-break:strict + overflow-wrap:anywhere）' },
];

const SHARED = [
  /^frontend-uni\/src\/components\//,
  /^frontend-uni\/src\/App\.vue$/,
  /^frontend-uni\/src\/uni\.scss$/,
  /^miniapp-native\/miniprogram\/components\//,
  /^miniapp-native\/miniprogram\/app\.wxss$/,
];
// 生成文件与品牌包拷贝是 hex 的唯一合法来源
const ALLOW = [/tokens\.generated\./, /\/static\/brand\//, /\/miniprogram_npm\//, /\/node_modules\//, /\/unpackage\//];
// 组件里允许的少量 alpha 叠层（brand 渐变卡上的白色 14–28% 描边/槽），逐条列出而非放开整类
const SHARED_ALLOW_LINE = /rgba\(255,\s*255,\s*255,\s*0?\.\d+\)|rgba\(0,\s*0,\s*0,\s*0?\.\d+\)|mask-image\s*:|\[style\*=/;

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'unpackage' || ent.name === 'miniprogram_npm') continue;
      walk(p, exts, out);
    } else if (exts.some((e) => ent.name.endsWith(e))) out.push(p);
  }
  return out;
}

function styleBlocks(file, src) {
  if (file.endsWith('.vue')) {
    const blocks = [];
    const re = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
    let m;
    while ((m = re.exec(src))) {
      const before = src.slice(0, m.index).split('\n').length - 1;
      blocks.push({ text: m[1], lineOffset: before });
    }
    return blocks;
  }
  return [{ text: src, lineOffset: 0 }];
}

// 去掉注释与 var(--x, fallback) 的 fallback 段：fallback 里的 hex 是 compat 期允许的兜底值
function stripAllowed(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '))
    .replace(/var\(\s*--[\w-]+\s*,[^()]*(\([^()]*\)[^()]*)*\)/g, (s) => s.replace(/[^\n]/g, ' '));
}

const files = [
  ...walk(path.join(ROOT, 'frontend-uni/src'), ['.vue', '.scss']),
  ...walk(path.join(ROOT, 'miniapp-native/miniprogram'), ['.wxss']),
];

let errors = 0;
let warns = 0;
const perFile = [];

for (const abs of files) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  if (ALLOW.some((r) => r.test(rel))) continue;
  const shared = SHARED.some((r) => r.test(rel));
  const src = fs.readFileSync(abs, 'utf8');
  const hits = [];
  for (const { text, lineOffset } of styleBlocks(rel, src)) {
    const clean = stripAllowed(text);
    const lines = clean.split('\n');
    lines.forEach((line, i) => {
      if (shared && SHARED_ALLOW_LINE.test(line)) return;
      for (const rule of RULES) {
        rule.re.lastIndex = 0;
        if (rule.re.test(line)) hits.push({ line: lineOffset + i + 1, rule: rule.id, msg: rule.msg });
      }
    });
  }
  if (!hits.length) continue;
  const level = shared || STRICT ? 'error' : 'warn';
  if (level === 'error') errors += hits.length;
  else warns += hits.length;
  perFile.push({ rel, level, hits });
}

if (!QUIET) {
  for (const f of perFile) {
    if (ONLY ? !f.rel.includes(ONLY) : f.level === 'warn' && perFile.length > 30) continue; // 大量存量页面只汇总
    for (const h of f.hits) console.log(`${f.level === 'error' ? 'ERR ' : 'warn'} ${f.rel}:${h.line} [${h.rule}] ${h.msg}`);
  }
}
const warnFiles = perFile.filter((f) => f.level === 'warn').length;
console.log(
  `lint-pages: ${errors} error（共享层/strict），${warns} warn（存量页面 ${warnFiles} 文件，页面组交付时 --strict 转 error）`,
);
process.exit(errors ? 1 : 0);
