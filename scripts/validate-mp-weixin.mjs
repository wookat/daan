#!/usr/bin/env node
// 校验 frontend-uni/dist/build/mp-weixin 编译产物是否满足微信小程序约束。
// 微信开发者工具无 Linux 版，CI/Linux 上用本脚本做静态校验；正式预览/上传仍需在
// Win/macOS 上用开发者工具或 miniprogram-ci（需正式 AppID + 上传密钥）。
//
// 用法: node scripts/validate-mp-weixin.mjs [distDir]
import fs from 'node:fs';
import path from 'node:path';

const dist = process.argv[2] || path.join(process.cwd(), 'frontend-uni/dist/build/mp-weixin');
const errors = [];
const warns = [];

function dirSize(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return total;
}

if (!fs.existsSync(path.join(dist, 'app.json'))) {
  console.error(`未找到编译产物: ${dist}（先执行 npm run build:mp-weixin）`);
  process.exit(1);
}
const app = JSON.parse(fs.readFileSync(path.join(dist, 'app.json'), 'utf8'));
const subRoots = (app.subPackages || []).map((s) => s.root.replace(/\/$/, ''));

// 1. 页面四件套齐全
const allPages = [
  ...(app.pages || []),
  ...(app.subPackages || []).flatMap((s) => s.pages.map((p) => `${s.root.replace(/\/$/, '')}/${p}`)),
];
for (const page of allPages) {
  for (const ext of ['.wxml', '.js', '.json', '.wxss']) {
    const f = path.join(dist, page + ext);
    if (!fs.existsSync(f)) (ext === '.wxss' ? warns : errors).push(`缺少 ${page}${ext}`);
  }
}

// 2. tabBar 页面必须在主包
for (const item of app.tabBar?.list || []) {
  if (!(app.pages || []).includes(item.pagePath)) errors.push(`tabBar 页面不在主包: ${item.pagePath}`);
  for (const icon of [item.iconPath, item.selectedIconPath].filter(Boolean)) {
    if (!fs.existsSync(path.join(dist, icon))) errors.push(`tabBar 图标缺失: ${icon}`);
  }
}

// 3. 分包配置一致性 + 主包/分包体积（主包 ≤ 2MB，单个分包 ≤ 2MB，总包 ≤ 20MB）
const totalSize = dirSize(dist);
const subSizes = subRoots.map((r) => [r, fs.existsSync(path.join(dist, r)) ? dirSize(path.join(dist, r)) : 0]);
const mainSize = totalSize - subSizes.reduce((a, [, s]) => a + s, 0);
const MB = 1024 * 1024;
if (mainSize > 2 * MB) errors.push(`主包 ${(mainSize / MB).toFixed(2)}MB 超过 2MB`);
for (const [r, s] of subSizes) {
  if (s === 0) errors.push(`分包目录缺失: ${r}`);
  if (s > 2 * MB) errors.push(`分包 ${r} ${(s / MB).toFixed(2)}MB 超过 2MB`);
}
if (totalSize > 20 * MB) errors.push(`总包 ${(totalSize / MB).toFixed(2)}MB 超过 20MB`);
for (const rule of Object.keys(app.preloadRule || {})) {
  if (!allPages.includes(rule)) errors.push(`preloadRule 指向不存在的页面: ${rule}`);
  for (const pkg of app.preloadRule[rule].packages || []) {
    if (pkg !== '__APP__' && !subRoots.includes(pkg)) errors.push(`preloadRule 指向不存在的分包: ${pkg}`);
  }
}

// 4. 产物中不得残留 H5-only 全局对象（uni-app 运行时自身的兼容判断除外）
const banned = [
  ['document.createElement', /document\.createElement/],
  ['window.location', /window\.location/],
  ['localStorage', /\blocalStorage\b/],
  ['new FormData', /new FormData\(/],
  ['fetch(', /[^.\w]fetch\(/],
  ['TextDecoder', /new TextDecoder\(/],
  ['EventSource', /new EventSource\(/],
];
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}
for (const f of walk(dist)) {
  // uni-app / vue 运行时自带跨端兼容分支，只检查业务代码
  if (f.includes(`${path.sep}node-modules${path.sep}`) || f.includes('vendor.js')) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const [name, re] of banned) {
    if (re.test(src)) errors.push(`${path.relative(dist, f)} 残留 H5-only API: ${name}`);
  }
}

console.log(`产物: ${dist}`);
console.log(`主包 ${(mainSize / MB).toFixed(2)}MB / 分包 ${subSizes.map(([r, s]) => `${r} ${(s / MB).toFixed(2)}MB`).join(', ') || '无'} / 总计 ${(totalSize / MB).toFixed(2)}MB`);
console.log(`页面 ${allPages.length} 个，tabBar ${app.tabBar?.list?.length || 0} 项`);
warns.forEach((w) => console.log(`WARN  ${w}`));
if (errors.length) {
  errors.forEach((e) => console.log(`ERROR ${e}`));
  process.exit(1);
}
console.log('OK：小程序产物静态校验通过');
