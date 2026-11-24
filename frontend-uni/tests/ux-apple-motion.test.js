import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prefersReducedMotion, motionDuration } from '../src/a11y/a11y-motion.js';
import { humanErrorText, showUndoToast, triggerUndoToast, dismissUndoToast } from '../src/utils/toast.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootRead = (rel) => fs.readFileSync(path.join(here, '../..', rel), 'utf8');

describe('Apple 级动效令牌与 Reduced-Motion 降级', () => {
  it('tokens.generated.css 与 wxss 同步输出统一动效时长与弹簧曲线', () => {
    const css = rootRead('frontend-uni/src/styles/tokens.generated.css');
    const wxss = rootRead('miniapp-native/miniprogram/styles/tokens.generated.wxss');
    for (const tok of ['--dur-instant', '--dur-fast', '--dur-base', '--dur-slow', '--ease-standard', '--ease-decel', '--ease-spring', '--ease-spring-snappy']) {
      expect(css).toContain(`${tok}:`);
      expect(wxss).toContain(`${tok}:`);
    }
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it('prefersReducedMotion 与 motionDuration 按系统开关归零动画时长', () => {
    const origWindow = globalThis.window;
    globalThis.window = { matchMedia: () => ({ matches: true }) };
    expect(prefersReducedMotion()).toBe(true);
    expect(motionDuration(360)).toBe(0);

    globalThis.window = { matchMedia: () => ({ matches: false }) };
    expect(prefersReducedMotion()).toBe(false);
    expect(motionDuration(360)).toBe(360);
    globalThis.window = origWindow;
  });
});

describe('UX 错误文案与非阻塞 Undo 总线', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dismissUndoToast(false);
  });

  afterEach(() => {
    dismissUndoToast(false);
    vi.useRealTimers();
  });

  it('humanErrorText 将底层 HTTP/网络/内部异常翻译为自然中文', () => {
    expect(humanErrorText('request:fail timeout')).toContain('超时');
    expect(humanErrorText('failed to fetch')).toContain('网络');
    expect(humanErrorText('HTTP 401')).toContain('重新登录');
    expect(humanErrorText('HTTP 429')).toContain('太快');
    expect(humanErrorText('HTTP 502')).toContain('开小差');
    expect(humanErrorText('SyntaxError: Unexpected token', '加载失败')).toBe('加载失败');
    expect(humanErrorText('缺少 uid')).toContain('本机状态异常');
  });

  it('showUndoToast 支持限时自动提交与点击撤销回滚', () => {
    const onUndo = vi.fn();
    const onCommit = vi.fn();
    const id = showUndoToast({ text: '已暂退这题', actionText: '撤销', duration: 4000, onUndo, onCommit });
    expect(id).toBeTruthy();
    expect(triggerUndoToast(id)).toBe(true);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();

    const onUndo2 = vi.fn();
    const onCommit2 = vi.fn();
    showUndoToast({ text: '已删除', duration: 4000, onUndo: onUndo2, onCommit: onCommit2 });
    vi.advanceTimersByTime(4000);
    expect(onCommit2).toHaveBeenCalledTimes(1);
    expect(onUndo2).not.toHaveBeenCalled();

    const onUndo3 = vi.fn();
    const id3 = showUndoToast('已取消收藏', onUndo3);
    expect(id3).toBeTruthy();
    expect(triggerUndoToast(id3)).toBe(true);
    expect(onUndo3).toHaveBeenCalledTimes(1);
  });
});

describe('共享 UX / 动效原语与双端对齐契约', () => {
  it('五大新组件（kg-confirm-sheet/kg-undo-bar/kg-switch/kg-collapse/kg-number）遵循零重排与语义命名', () => {
    const cfm = rootRead('frontend-uni/src/components/kg-confirm-sheet/kg-confirm-sheet.vue');
    expect(cfm).toContain('kg-cfm');
    expect(cfm).toContain('confirm');
    expect(cfm).toContain('cancel');

    const undo = rootRead('frontend-uni/src/components/kg-undo-bar/kg-undo-bar.vue');
    expect(undo).toContain('scaleX');
    expect(undo).toContain('prefersReducedMotion');

    const sw = rootRead('frontend-uni/src/components/kg-switch/kg-switch.vue');
    expect(sw).toContain('role="switch"');
    expect(sw).toContain('--ease-spring-snappy');

    const col = rootRead('frontend-uni/src/components/kg-collapse/kg-collapse.vue');
    expect(col).toContain('grid-template-rows: 0fr');
    expect(col).toContain('grid-template-rows: 1fr');

    const num = rootRead('frontend-uni/src/components/kg-number/kg-number.vue');
    expect(num).toContain('motionDuration');
    expect(num).toContain('tabular-nums');
  });

  it('H5 与小程序 kg-progress / kg-sheet 同步采用 scaleX 与跟手下拉手势', () => {
    const h5Prog = rootRead('frontend-uni/src/components/kg-progress/kg-progress.vue');
    const mpProgWxml = rootRead('miniapp-native/miniprogram/components/kg-progress/index.wxml');
    const mpProgWxss = rootRead('miniapp-native/miniprogram/components/kg-progress/index.wxss');
    expect(h5Prog).toContain('scaleX(');
    expect(mpProgWxml).toContain('scaleX(');
    expect(mpProgWxss).toContain('transform var(--dur-base)');

    const h5Sheet = rootRead('frontend-uni/src/components/kg-sheet/kg-sheet.vue');
    const mpSheetTs = rootRead('miniapp-native/miniprogram/components/kg-sheet/index.ts');
    const mpSheetWxml = rootRead('miniapp-native/miniprogram/components/kg-sheet/index.wxml');
    expect(h5Sheet).toContain('onTouchMove');
    expect(mpSheetTs).toContain('onSheetTouchMove');
    expect(mpSheetWxml).toContain('sheetDragY');
  });

  it('landing/index.html 已剥离装饰性花哨动画并统一 FAQ 与 GPU scaleX 进度条', () => {
    const lp = rootRead('landing/index.html');
    expect(lp).not.toMatch(/@keyframes\s+(floatY|sheen|glowDrift|gradShift)/);
    expect(lp).not.toContain('perspective(800px)');
    expect(lp).not.toContain('>SM-2<');
    expect(lp).not.toContain('全站先验');
    expect(lp).not.toContain('AI 问泽');
    expect(lp).toContain('scaleX(');
    expect(lp).toContain('先用手机网页版');
    expect(lp).toContain('--dur-fast');
  });

  it('后端鉴权接口不向前端暴露原始微信 errmsg 或内部细节', () => {
    const authPy = rootRead('backend/app/api/auth.py');
    const ssoPy = rootRead('backend/app/api/zalize_sso.py');
    expect(authPy).not.toContain("data.get('errmsg')");
    expect(authPy).not.toContain('小程序密钥');
    expect(authPy).not.toContain('"无效的匿名 uid"');
    expect(ssoPy).not.toContain('并发初始化冲突');
  });
});
