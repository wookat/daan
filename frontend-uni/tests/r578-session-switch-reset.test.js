// R578：完成页内开下一场（练同考点 / 只重练本组错题 / 再来一组 / 每日一练）时 session 不翻转，
// 生产 375 实拍（r578 j375/reinforce-q1）：SEO 深链 3 题练完 → 「练同考点」5 题第 1 题仍顶着「刚才那题在这里作答，之后 2 题同考点练习」
// 领跑题横幅，顶栏仍「资料分析 · 专项练习」（应为「资料分析 · 强化练习」）；R576 生产 375/1440 每日一练 → 练同考点 顶栏仍「每日一练」。
// 修法：items 落地即（sync）清 leadHint、（pre flush）重算标题；start() 把本场 leadHint 移到赋 items 之后。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { reactive, watch, nextTick } from 'vue';

const SRC = readFileSync(new URL('../src/pages/practice/practice.vue', import.meta.url), 'utf8');
const between = (a, b) => SRC.slice(SRC.indexOf(a), SRC.indexOf(b, SRC.indexOf(a)));

describe('practice.vue items watcher：换场即清领跑提示 + 重算标题', () => {
  it('watch.items 为数组：第一项 sync 清 leadHint，第二项 matOpen 重置 + syncNavTitle', () => {
    const w = between('  watch: {', '  methods: {');
    expect(w).toMatch(/items: \[\s*(?:\/\/[^\n]*\n\s*)?\{ handler\(\) \{ this\.leadHint = ''; \}, flush: 'sync' \},\s*function \(\) \{\s*this\.matOpen = \{\};(?:\s*\/\/[^\n]*)?\s*this\.syncNavTitle\(\);\s*\},\s*\]/);
    expect(w).toMatch(/session\(\) \{\s*this\.syncNavTitle\(\);\s*\}/);
  });

  it('start()：本场 leadHint 写在赋 items 之后（否则被 sync 清掉）', () => {
    const s = between('const items = mergeLead(lead, d.items);', 'this._plainStart =');
    const iItems = s.indexOf("this.items = items.map((q) => ({ ...q, _saved: false }));");
    const iHint = s.indexOf('this.leadHint = leadQid && items[0].id === leadQid ? leadHintText(tag3, items.length) : \'\';');
    expect(iItems).toBeGreaterThan(-1);
    expect(iHint).toBeGreaterThan(iItems);
    // 空题包在赋 items 前已 return，items[0] 不会越界
    expect(s.indexOf('if (!items.length) {')).toBeLessThan(iItems);
  });

  it('startReinforce / retryWrong / retryGroup 都是整体重赋 items（触发 watcher），无 push/splice 原地改', () => {
    expect(SRC).not.toMatch(/this\.items\.(push|splice|unshift|pop|shift)\(/);
    expect(between('    async startReinforce(launch) {', '    loginNudgeGo()')).toContain("this.items = d.items.map((it) => ({ ...it, _saved: false }));");
    expect(between('    retryWrong() {', '    retryGroup() {')).toContain('this.items = wrong;');
  });

  it('机制：sync 清空 + 赋 items 后再写 → 领跑场保留提示、下一场（同 session=true）提示为空', async () => {
    const vm = reactive({ items: [], leadHint: '', session: false, titles: [] });
    // 与真 syncNavTitle 同形：同标题不重复 set
    const syncNavTitle = () => {
      const t = vm.session ? 'S' + vm.items.length : '刷题';
      if (vm.titles[vm.titles.length - 1] !== t) vm.titles.push(t);
    };
    watch(() => vm.items, () => { vm.leadHint = ''; }, { flush: 'sync' });
    watch(() => vm.items, syncNavTitle);
    watch(() => vm.session, syncNavTitle);
    // 领跑场 start()
    vm.items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    vm.leadHint = '刚才那题在这里作答，之后 2 题同考点练习';
    vm.session = true;
    await nextTick();
    expect(vm.leadHint).toBe('刚才那题在这里作答，之后 2 题同考点练习');
    expect(vm.titles).toEqual(['S3']);
    // 完成页「练同考点」startReinforce：session 保持 true，只重赋 items
    vm.items = [{ id: 9 }, { id: 8 }, { id: 7 }, { id: 6 }, { id: 5 }];
    expect(vm.leadHint).toBe('');
    await nextTick();
    expect(vm.titles).toEqual(['S3', 'S5']);
  });
});
