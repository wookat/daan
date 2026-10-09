// R564：「继续上次练习 / 模考？」从 uni.showModal 改为 KgSheet。
// 生产依据：R559 c8fabd0f 复验坐实练习页物理 F5 弹原生「继续上次练习？」；R563 e8c11732 复验坐实 uni-modal 把 Esc 当 cancel。
// 两者叠加 = 桌面端 F5 后按 Esc 直接 removeStorage pendingSession + POST 清服务端进度 + 开新一组；模考同形态丢未交卷作答。
// 修法：关层（X / Esc / Back / 遮罩）= 继续；丢弃进度只能显式点按 ghost/bad 按钮。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resumeAsk, resumeDismissAction } from '../src/resume-ask.js';

const PRACTICE = readFileSync(fileURLToPath(new URL('../src/pages/practice/practice.vue', import.meta.url)), 'utf8')+readFileSync(fileURLToPath(new URL('../src/practice/daily-ops.js', import.meta.url)), 'utf8')+readFileSync(fileURLToPath(new URL('../src/practice/session-ops.js', import.meta.url)), 'utf8');
const EXAM = readFileSync(fileURLToPath(new URL('../src/pkgA/exam/exam.vue', import.meta.url)), 'utf8');

function slice(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  const e = src.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error('marker not found: ' + startMarker);
  return src.slice(s, e);
}

describe('resumeAsk 文案', () => {
  it('local：标题/进度/清进度后果，按钮「继续上次练习」primary 与「不用了，开新一组」', () => {
    const a = resumeAsk('local', { title: '判断推理', done: 3, total: 10 });
    expect(a.title).toBe('继续上次练习？');
    expect(a.tip).toContain('「判断推理」上次还有一组未做完（3/10 题）');
    expect(a.tip).toContain('开新一组会清掉这组进度');
    expect(a.cont).toBe('继续上次练习');
    expect(a.drop).toBe('不用了，开新一组');
  });

  it('remote：无标题不带「」，措辞「在其他设备」', () => {
    const a = resumeAsk('remote', { title: '', done: 2, total: 10 });
    expect(a.tip.startsWith('在其他设备还有一组未做完（2/10 题）')).toBe(true);
  });

  it('exam：丢弃按钮带已答题数，tip 说明重新计时', () => {
    const a = resumeAsk('exam', { title: '2024 国考', done: 17, total: 130 });
    expect(a.title).toBe('继续上次模考？');
    expect(a.tip).toContain('「2024 国考」检测到未交卷的进度（已答 17/130 题）');
    expect(a.cont).toBe('继续上次模考');
    expect(a.drop).toBe('重新开始（丢弃已答 17 题）');
  });

  it('resumeDismissAction：未选而关 → cont；已选/无层 → null（不重复执行）', () => {
    expect(resumeDismissAction({ picked: false })).toBe('cont');
    expect(resumeDismissAction({ picked: true })).toBeNull();
    expect(resumeDismissAction(null)).toBeNull();
  });
});

describe('practice.vue 继续上次练习层', () => {
  it('三处「继续上次练习？」showModal 全部移除；仅剩非破坏性 showModal（本卷已练完 / 继续上次进度 等）', () => {
    expect(PRACTICE).not.toContain("title: '继续上次练习？'");
    expect(PRACTICE.match(/this\.askResume\(/g)).toHaveLength(2);
  });

  it('tryResume：done>0 → askResume(local)，cont=adoptLocalPending，drop=removeStorage+clearServerProgress+start', () => {
    const body = slice(PRACTICE, '    tryResume() {', '    stayHere() {');
    expect(body).not.toContain('showModal');
    expect(body).toContain("this.askResume(\n        'local'");
    expect(body).toContain('() => this.adoptLocalPending(s)');
    expect(body).toContain("uni.removeStorageSync('pendingSession');\n          this.clearServerProgress();");
  });

  it('tryServerResume：askResume(remote)，cont=adoptRemoteSnap，drop=clearServerProgress+startDefault', () => {
    const body = slice(PRACTICE, '    tryServerResume() {', '    tryResume() {');
    expect(body).not.toContain('showModal');
    expect(body).toContain("'remote'");
    expect(body).toContain('() => this.adoptRemoteSnap(snap)');
    expect(body).toContain('this.clearServerProgress();\n              this.startDefault();');
  });

  it('resumePick：只执行一次、关层、埋点 practice_resume_cont/drop；watch resumeOpen 关层未选 → resumePick(true)', () => {
    const pick = slice(PRACTICE, '    resumePick(cont) {', '    quitPick(keep) {');
    expect(pick).toContain('if (!act || act.picked) return;');
    expect(pick).toContain('act.picked = true;');
    expect(pick).toContain('this.resumeOpen = false;');
    expect(pick).toContain("trackEvent(cont ? 'practice_resume_cont' : 'practice_resume_drop'");
    expect(pick).toContain('(cont ? act.cont : act.drop)();');
    expect(PRACTICE).toContain("resumeOpen(v) {\n      if (!v && resumeDismissAction(this._resumeAct) === 'cont') this.resumePick(true);");
  });

  it('模板：kg-sheet v-model=resumeOpen，primary 继续 / ghost bad 丢弃，无第三个「关层即丢弃」动作，不监听 @close', () => {
    const s = PRACTICE.indexOf('<kg-sheet v-model="resumeOpen"');
    expect(s).toBeGreaterThan(0);
    const tpl = PRACTICE.slice(s, PRACTICE.indexOf('</kg-sheet>', s));
    expect(tpl).toMatch(/variant="primary"[^>]*@click="resumePick\(true\)"/);
    expect(tpl).toMatch(/variant="ghost"[^>]*tone="bad"[^>]*@click="resumePick\(false\)"/);
    expect(tpl).not.toContain('@close');
    expect(PRACTICE).toContain('      resumeOpen: false,\n      resumeAsk: null,');
  });

  it('桌面快捷键 A–D/方向键在退出层或续练层打开时不落到题目', () => {
    const kd = slice(PRACTICE, '    onPKeydown(e) {', '      const k = e.key;');
    expect(kd).toContain('this.quitOpen || this.resumeOpen');
  });

  // 生产 ccd045d9 1440 FAIL：恢复层 X 上按 Enter → a11y 宿主 keydown 已 preventDefault 并 click 关层 →
  // 同一事件冒泡到 window 时层已关、恢复已完成 → 页面快捷键把这次 Enter 当「下一题」（模考 2/30 → 3/30）。
  // 已被当作激活消费的按键（defaultPrevented）不再进页面快捷键。
  it('页面快捷键忽略已被弹层按钮激活消费的 keydown（defaultPrevented）——练习页与模考页', () => {
    const p = slice(PRACTICE, '    onPKeydown(e) {', '      const k = e.key;');
    expect(p).toContain('e.altKey || e.defaultPrevented) return;');
    const x = slice(EXAM, '    onExKeydown(e) {', '      const k = e.key;');
    expect(x).toContain('e.altKey || e.defaultPrevented) return;');
    expect(x).toContain('this.cardOpen || this.resumeOpen) return;');
  });
});

describe('exam.vue 继续上次模考层', () => {
  it('onLoad：不再 showModal；Promise 由 resumePick resolve；未选关层 → 继续（不 removeStorage examProgress）', () => {
    const body = slice(EXAM, '  async onLoad(opt) {', '  onShow() {');
    expect(body).not.toContain('showModal');
    expect(body).toContain('this._resumeAct = { resolve, picked: false };');
    expect(body).toContain("resumeAsk('exam'");
    expect(body).toContain('this.resumeOpen = true;');
    expect(body).toContain('if (resume) {');
    expect(body).toContain("uni.removeStorageSync(PROG_KEY);\n    }\n    await this.start(opt);");
    expect(EXAM).toContain("resumeOpen(v) {\n      if (!v && resumeDismissAction(this._resumeAct) === 'cont') this.resumePick(true);");
    const pick = slice(EXAM, '    resumePick(cont) {', '    async start(opt) {');
    expect(pick).toContain('act.resolve(!!cont);');
  });

  it('模板：kg-sheet v-model=resumeOpen，primary 继续 / ghost bad 重新开始', () => {
    const s = EXAM.indexOf('<kg-sheet v-model="resumeOpen"');
    expect(s).toBeGreaterThan(0);
    const tpl = EXAM.slice(s, EXAM.indexOf('</kg-sheet>', s));
    expect(tpl).toMatch(/variant="primary"[^>]*@click="resumePick\(true\)"/);
    expect(tpl).toMatch(/variant="ghost"[^>]*tone="bad"[^>]*@click="resumePick\(false\)"/);
    expect(EXAM).toContain('      resumeOpen: false,\n      resumeAsk: null,');
  });
});
