// 上岸通（gongkao-shangantong, MIT）题库 → knowledge/questions_bank.jsonl 追加格式
// 用法: node tools/qbank-import/parse_szt.mjs <szt-js-dir> [out.jsonl]
// 解析所有 QUESTION_BANK["模块"] = ...concat([...]) 数组（JSON 字面量），
// 归一化为我们 questions 表口径；题干规范化去重（本文件内 + 与既有 jsonl）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SZ_DIR = process.argv[2];
const OUT = process.argv[3] || null;           // 默认 stdout 统计；给路径才写 jsonl
const EXISTING = process.argv[4] || null;      // 既有 questions_bank.jsonl（跨库去重）

const MOD_MAP = {
  '常识判断': 'changshi', '政治理论': 'changshi', '言语理解': 'yanyu',
  '数量关系': 'shuliang', '判断推理': 'panduan', '资料分析': 'ziliao',
};
const REAL_TYPES = /真题|省考|选调/;          // type 含这些→is_real=1（模考/精选不算）

const norm = (s) => String(s || '')
  .replace(/\[\d+\]/g, '')                     // [图0] 占位符
  .replace(/[　\s\u3000]/g, '')
  .replace(/[，。、；：？！“”‘’（）()【】《》〈〉,.!?;:'"\-—…·\[\]{}<>]/g, '')
  .toLowerCase();

const KAODIAN_RE = /考点[：:]\s*([^】\n，。]{2,24})/;
const RATE_RE = /正确率\s*(\d{1,3})\s*%/;
const LETTERS = 'ABCDEFGHIJ';
const MARK = /\[(?:图|表)\d*\]/g;              // [图0]/[表1]/[图]/[表] 占位标记
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const QIMG_DIR = path.join(REPO, 'qimg');       // 后端 /qimg 静态目录（assets/img→/qimg）
const localImgs = new Set();                    // 需拷入 qimg/ 的本地图片

const stripMark = (s) => String(s || '').replace(MARK, '').replace(/[ \t]+\n/g, '\n').trim();

function* concatArrays(src) {
  // 提取 concat( <json-array> ) 的数组字面量并 yield JSON.parse 结果
  let idx = 0;
  while (true) {
    const i = src.indexOf('.concat(', idx);
    if (i < 0) return;
    let j = i + 8;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== '[') { idx = j; continue; }
    let depth = 0, k = j, inStr = false, esc = false;
    for (; k < src.length; k++) {
      const c = src[k];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) { k++; break; } }
    }
    yield JSON.parse(src.slice(j, k));
    idx = k;
  }
}

function convert(q, modCn) {
  const module = MOD_MAP[q.mod || modCn] || MOD_MAP[modCn];
  if (!module) return null;
  const stem = stripMark(q.stem);
  const opts = Array.isArray(q.options) ? q.options.map((o) => stripMark(o)) : null;
  if (!stem || !opts || opts.length < 2) return null;
  if (opts.some((o) => o === '')) return 'IMG';  // 选项为纯图片占位→我们无法渲染，跳过
  const options = {};
  opts.forEach((o, i) => { options[LETTERS[i]] = o; });

  // 答案：index → 字母；"ABD" 已是字母序
  let answer = '';
  if (typeof q.answer === 'number') answer = LETTERS[q.answer] || '';
  else if (typeof q.answer === 'string') {
    answer = [...new Set(q.answer.toUpperCase().replace(/[^A-Z]/g, ''))].sort().join('');
  }
  if (!answer || ![...answer].every((c) => options[c])) return null;

  const src = q.src || (Array.isArray(q.srcs) && q.srcs[0]) || {};
  const srcs = Array.isArray(q.srcs) && q.srcs.length ? q.srcs : (src.name ? [src] : []);
  const analysis = String(q.analysis || '').trim();

  // 考点：解析头【正确率 x%｜考点：xx】→ type 兜底
  let kd = (analysis.match(KAODIAN_RE) || [])[1];
  if (kd) kd = kd.replace(/[（(].*?$/, '').trim(); // 去掉「考点：xx（括号内难度提示）」尾
  if (!kd || kd.length > 16) kd = String(q.type || '').replace(/真题|省考|模考|选调|精选|（.*?）/g, '').trim();
  const modName = q.mod || modCn;
  const question_type = kd ? `${modName}-${kd}` : modName;

  // 材料题：mat 前置（沿用库内「问题：」分隔惯例，material_hash 可成组）
  const mat = stripMark(q.mat);
  const question = mat ? `${mat}\n问题：${stem}` : stem;

  const srcName = src.name || srcs[0]?.name || q.tag || '上岸通题库';
  const exam = src.exam || srcs[0]?.exam || '';
  const isReal = REAL_TYPES.test(String(q.type)) || REAL_TYPES.test(exam);
  const year = parseInt(src.year || srcs[0]?.year || 0, 10) || null;
  const rawRegion = src.province || srcs.map((s) => s.province).filter(Boolean)[0] || '';
  const region = rawRegion && rawRegion !== '通用' ? rawRegion : null;
  const rate = analysis.match(RATE_RE);
  const rec = {
    module, question_type, question, options, answer,
    explanation: analysis || '（无解析）',
    source: srcName,
    is_real: isReal ? 1 : 0,
    exam_year: year, exam_region: region,
    import_batch: 'szt',
  };
  if (rate) rec.correct_ratio = Math.min(100, Math.max(0, parseInt(rate[1], 10)));
  const imgs = [...(Array.isArray(q.images) ? q.images : []), ...(Array.isArray(q.mat_images) ? q.mat_images : [])];
  for (const u of imgs) if (/^assets\//.test(u)) localImgs.add(path.basename(u));
  const img = imgs[0];
  if (img) {
    rec.image = /^assets\//.test(img) ? `/qimg/${path.basename(img)}` : img;
    rec.image_credit = '粉笔题库';
  }
  return rec;
}

// ---- main
const files = [];
for (const f of fs.readdirSync(SZ_DIR)) {
  const p = path.join(SZ_DIR, f);
  if (f.endsWith('.js') && fs.statSync(p).isFile()) files.push(p);
  if (f === 'bank') for (const g of fs.readdirSync(p)) if (g.endsWith('.js')) files.push(path.join(p, g));
}
const seen = new Set();
if (EXISTING && fs.existsSync(EXISTING)) {
  for (const line of fs.readFileSync(EXISTING, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { seen.add(norm(JSON.parse(line).question)); } catch { /* skip */ }
  }
}
const stats = { files: files.length, parsed: 0, converted: 0, dup: 0, bad: 0, badImg: 0, byModule: {}, real: 0, rated: 0, withImg: 0, papers: new Set() };
const out = OUT ? fs.createWriteStream(OUT, { flags: 'w' }) : null;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const modCn = (src.match(/QUESTION_BANK\["([^"]+)"\]/) || [])[1] || '';
  for (const arr of concatArrays(src)) {
    for (const q of arr) {
      stats.parsed++;
      const rec = convert(q, modCn);
      if (rec === 'IMG') { stats.badImg++; continue; }
      if (!rec) { stats.bad++; continue; }
      const key = norm(rec.question);
      if (!key || seen.has(key)) { stats.dup++; continue; }
      seen.add(key);
      stats.converted++;
      stats.byModule[rec.module] = (stats.byModule[rec.module] || 0) + 1;
      if (rec.is_real) stats.real++;
      if (rec.correct_ratio != null) stats.rated++;
      if (rec.image) stats.withImg++;
      stats.papers.add(rec.source);
      if (out) out.write(JSON.stringify(rec) + '\n');
    }
  }
}
if (out) out.end();
// 本地图片落库：assets/img/<name> → repo qimg/<name>（后端 /qimg 已挂载）
let copied = 0;
const srcImgDir = path.resolve(SZ_DIR, '..', 'assets', 'img');
if (localImgs.size && fs.existsSync(srcImgDir)) {
  fs.mkdirSync(QIMG_DIR, { recursive: true });
  for (const name of localImgs) {
    const src = path.join(srcImgDir, name), dst = path.join(QIMG_DIR, name);
    if (fs.existsSync(src) && !fs.existsSync(dst)) { fs.copyFileSync(src, dst); copied++; }
  }
}
stats.imgCopied = copied; stats.imgLocal = localImgs.size;
stats.papers = stats.papers.size;
console.log(JSON.stringify(stats, null, 1));
