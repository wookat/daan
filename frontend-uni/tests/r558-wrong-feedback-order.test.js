// R558：错答反馈信息层级——错因自评（选填）从「判分横幅之后、解析之前」下移到「主解析卡之后、第二解析/AI/纠错之前」。
// 依据（生产只读 file:/data/data.db?mode=ro，非测试非探针）：mistakes 287 行仅 7 行有错因（近 7 天 84/4），
// 近 30 天作答 310 行 170 错（55%）→ 错答反馈是多数路径；错因块占着紧邻横幅的首屏位却 <5% 使用，
// 而用户真正要看的解析被顶到其后。粉笔官方错题条目口径为「题目→我的答案→正确答案→解析→错因归因」，归因在解析之后。
// 同轮埋点：「看解析」（取消答对自动推进）打 practice_stay_here，为下一轮判断 1.2s 自动推进可预期性攒自然样本。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const practice = read('../src/pages/practice/practice.vue');
const tpl = practice.slice(0, practice.indexOf('<script'));
const script = practice.slice(practice.indexOf('<script'), practice.indexOf('</script>'));
const team = read('../../backend/app/team.py');

const after = tpl.slice(tpl.indexOf('class="after"'), tpl.indexOf('<kg-action-bar'));
const at = (s) => {
  const i = after.indexOf(s);
  expect(i, `after 区缺少 ${s}`).toBeGreaterThan(-1);
  return i;
};

describe('R558 错答反馈信息层级', () => {
  it('顺序：判分横幅 → 主解析卡（含来源/考点/社交）→ 错因自评（选填）→ 第二解析 → AI 详解/纠错', () => {
    const banner = at('<kg-banner');
    const ana = at('<kg-analysis-card');
    const anaEnd = at('</kg-analysis-card>');
    const reasons = at('class="reasons" role="group" aria-label="错因自评"');
    const xp = at('class="xp-card"');
    const deep = at('class="deep-acts"');
    expect(banner).toBeLessThan(ana);
    expect(anaEnd).toBeLessThan(reasons);
    expect(reasons).toBeLessThan(xp);
    expect(xp).toBeLessThan(deep);
  });

  it('错因块本身不变：仅答错显示、标「（选填）」、4 个 aria-pressed 药丸走 setReason', () => {
    expect(after).toContain('<view v-if="picked && picked !== cur.answer" class="reasons" role="group" aria-label="错因自评">');
    expect(after).toContain('<text class="rz-t">错因自评（选填）</text>');
    expect(after).toContain(':aria-pressed="cur._reason === rz ? \'true\' : \'false\'"');
    expect(after).toContain('@click="setReason(rz)"');
    expect(script).toContain("REASONS: ['粗心大意', '概念不清', '方法不会', '纯蒙的']");
  });

  it('答对自动推进口径不变（1200ms、看解析仅在计时器存在时显示、stayHere 取消）；stayHere 追加 practice_stay_here 埋点', () => {
    expect(script).toMatch(/if \(this\.autoNext\) \{\s*this\.autoTimer = setTimeout\(\(\) => \{\s*this\.autoTimer = null;\s*if \(this\.picked === k\) this\.next\(\);\s*\}, 1200\);/);
    expect(after).toContain(':action-text="!beiMode && picked === cur.answer && autoTimer ? \'看解析\' : \'\'"');
    expect(after).toContain('@action="stayHere"');
    const stay = script.slice(script.indexOf('stayHere() {'), script.indexOf('toggleAutoNext() {'));
    expect(stay).toContain('clearTimeout(this.autoTimer)');
    expect(stay).toContain("trackEvent('practice_stay_here', this._source || 'practice')");
    expect(team).toContain('"practice_stay_here"');
  });
});
