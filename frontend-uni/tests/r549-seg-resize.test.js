// R549：wot wd-segmented 的选中滑块只在 onMounted / value 变化时 getRect 测量一次（node_modules/wot-design-uni/components/wd-segmented），
// H5 窗口宽度变化（旋转/拖窄桌面浏览器）后高亮块保留旧宽度与 translateX，与文字错位（R549 生产走查讨论页复现）。
// 修法：页面级 mixin 订阅 uni.onWindowResize，防抖后调组件 defineExpose 的 updateActiveStyle(false)；卸载取消订阅。
import { describe, it, expect, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEG_RESIZE_DEBOUNCE_MS, segResizeMixin, segUpdater } from '../src/seg-resize.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const PAGES = ['pkgA/social/discuss', 'pkgA/social/favorites', 'pkgA/shenlun/shenlun', 'pkgA/user/login', 'pkgA/exam/list', 'pkgA/stats/mastery-map'];

describe('segUpdater', () => {
  it('取 ref 上的 updateActiveStyle 并以 animation=false 调用；数组 ref 取首个；无 ref / 无方法返回 null', () => {
    const inst = { updateActiveStyle: vi.fn() };
    segUpdater({ seg: inst })();
    expect(inst.updateActiveStyle).toHaveBeenCalledWith(false);
    segUpdater({ seg: [inst] })();
    expect(inst.updateActiveStyle).toHaveBeenCalledTimes(2);
    expect(segUpdater({})).toBeNull();
    expect(segUpdater(null)).toBeNull();
    expect(segUpdater({ seg: {} })).toBeNull();
    expect(segUpdater({ seg: [] })).toBeNull();
  });
});

describe('segResizeMixin', () => {
  it('mounted 订阅 onWindowResize，连发 resize 防抖成一次重测；beforeUnmount 用同一回调取消订阅', () => {
    vi.useFakeTimers();
    const handlers = [];
    globalThis.uni = {
      onWindowResize: vi.fn((fn) => handlers.push(fn)),
      offWindowResize: vi.fn(),
    };
    try {
      const inst = { updateActiveStyle: vi.fn() };
      const vm = { $refs: { seg: inst } };
      segResizeMixin.mounted.call(vm);
      expect(handlers).toHaveLength(1);
      handlers[0]({ size: { windowWidth: 375 } });
      handlers[0]({ size: { windowWidth: 414 } });
      vi.advanceTimersByTime(SEG_RESIZE_DEBOUNCE_MS - 1);
      expect(inst.updateActiveStyle).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(inst.updateActiveStyle).toHaveBeenCalledTimes(1);
      expect(inst.updateActiveStyle).toHaveBeenCalledWith(false);
      // ref 尚未渲染（v-if 隐藏）时静默
      vm.$refs = {};
      handlers[0]({});
      vi.advanceTimersByTime(SEG_RESIZE_DEBOUNCE_MS);
      expect(inst.updateActiveStyle).toHaveBeenCalledTimes(1);
      segResizeMixin.beforeUnmount.call(vm);
      expect(globalThis.uni.offWindowResize).toHaveBeenCalledWith(handlers[0]);
      expect(vm._segResize).toBeNull();
    } finally {
      delete globalThis.uni;
      vi.useRealTimers();
    }
  });

  it('无 uni.onWindowResize（非 H5 运行时）不订阅、卸载不报错', () => {
    globalThis.uni = {};
    try {
      const vm = { $refs: {} };
      segResizeMixin.mounted.call(vm);
      expect(vm._segResize).toBeUndefined();
      segResizeMixin.beforeUnmount.call(vm);
      expect(vm._segResize).toBeNull();
    } finally {
      delete globalThis.uni;
    }
  });

  it('mixin 只在 H5 条件编译块内生效', () => {
    const src = read('../src/seg-resize.js');
    expect(src.match(/\/\/ #ifdef H5/g)).toHaveLength(2);
    expect(src.match(/\/\/ #endif/g)).toHaveLength(2);
  });
});

describe('接入：仓库内所有用 wd-segmented 的页面', () => {
  it('每个 wd-segmented 标 ref="seg" 且页面挂 segResizeMixin；没有漏网的 wd-segmented 页面（dev/design 设计稿页除外）', () => {
    const all = execSync('git ls-files src', { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.endsWith('.vue') && read('../' + f).includes('<wd-segmented'))
      .map((f) => f.replace(/^src\//, '').replace(/\.vue$/, ''))
      .filter((f) => f !== 'pkgA/dev/design');
    expect(all.sort()).toEqual([...PAGES].sort());
    for (const p of PAGES) {
      const src = read('../src/' + p + '.vue');
      const tags = src.match(/<wd-segmented[^>]*>/g) || [];
      expect(tags.length, p).toBeGreaterThan(0);
      for (const t of tags) expect(t, p).toContain('ref="seg"');
      expect(src, p).toContain("import { segResizeMixin } from '../../seg-resize.js';");
      expect(src, p).toMatch(/\n {2}mixins: \[segResizeMixin[,\]]/);
    }
  });
});
