// R563-fix：练习中途「退出」确认从 uni.showModal 改为 KgSheet 三选项。
// 生产 e8c11732 375 复验 FAIL（E）：已答 1 题后打开退出框按 Escape → uni-modal 把 Esc 当「取消」= cancelText「结束本组」
// → 直接回首页、removeStorage pendingSession、POST /api/practice/progress {qids:[]} 清服务端进度。
// 键盘「取消/关层」不得等价于破坏性动作：关层（X / Esc / Back / 遮罩）= 继续做题，两种离开都要显式点按。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PRACTICE = readFileSync(fileURLToPath(new URL('../src/pages/practice/practice.vue', import.meta.url)), 'utf8')+readFileSync(fileURLToPath(new URL('../src/practice/daily-ops.js', import.meta.url)), 'utf8')+readFileSync(fileURLToPath(new URL('../src/practice/session-ops.js', import.meta.url)), 'utf8');

function fnBody(startMarker, endMarker) {
  const s = PRACTICE.indexOf(startMarker);
  const e = PRACTICE.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error('marker not found: ' + startMarker);
  return PRACTICE.slice(s, e);
}

describe('R563-fix 练习退出确认层', () => {
  it('quit()：有已答未答完 → 只开 KgSheet（quitOpen/quitSum），不再 uni.showModal；无可保留 → 直接 leave(false)', () => {
    const quit = fnBody('    quit() {', '    quitPick(keep) {');
    expect(quit).not.toContain('showModal');
    expect(quit).toContain('this.quitSum = sum');
    expect(quit).toContain('this.quitOpen = true');
    expect(quit).toContain('this.leave(false)');
  });

  it('quitPick(keep)：关层 + 埋点 practice_quit_keep/end + leave(keep)，与原 success 回调同口径', () => {
    const pick = fnBody('    quitPick(keep) {', '\n};');
    expect(pick).toContain('this.quitOpen = false');
    expect(pick).toContain("trackEvent(keep ? 'practice_quit_keep' : 'practice_quit_end'");
    expect(pick).toContain('this.leave(keep)');
  });

  it('模板：kg-sheet v-model=quitOpen，三个显式动作——保留进度(primary)/结束本组(ghost bad)/继续做题(text 仅关层)；标题用 quitSum.title', () => {
    const s = PRACTICE.indexOf('<kg-sheet v-model="quitOpen"');
    expect(s).toBeGreaterThan(0);
    const tpl = PRACTICE.slice(s, PRACTICE.indexOf('</kg-sheet>', s));
    expect(tpl).toContain(":title=\"quitSum ? quitSum.title : '退出练习'\"");
    expect(tpl).toMatch(/variant="primary"[^>]*@click="quitPick\(true\)">保留进度并退出</);
    expect(tpl).toMatch(/variant="ghost"[^>]*tone="bad"[^>]*@click="quitPick\(false\)">结束本组并退出</);
    expect(tpl).toMatch(/variant="text"[^>]*@click="quitOpen = false">继续做题</);
    // 关层本身不触发任何 leave：v-model 只写 quitOpen
    expect(tpl).not.toContain('@close');
    expect(tpl).not.toContain('@update:model-value');
  });

  it('data 里声明 quitOpen/quitSum；trackEvent 口径与 R553 保留（practice_quit_keep/end 仍各一处）', () => {
    expect(PRACTICE).toContain('      quitOpen: false,\n      quitSum: null,');
    expect(PRACTICE.match(/practice_quit_keep/g)).toHaveLength(1);
    expect(PRACTICE.match(/practice_quit_end/g)).toHaveLength(1);
  });
});
