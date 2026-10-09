<template>
  <wd-popup
    :model-value="modelValue"
    :position="position"
    :safe-area-inset-bottom="position === 'bottom'"
    :z-index="zIndex"
    custom-class="kg-sheet"
    :custom-style="sheetStyle"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="$emit('close')"
  >
    <view class="kg-sheet__in" :class="{ 'is-dialog': position === 'center' }" role="dialog" aria-modal="true" :aria-label="title || undefined">
      <view v-if="position === 'bottom'" class="kg-sheet__grab" />
      <view v-if="title" class="kg-sheet__hd">
        <text class="kg-sheet__t">{{ title }}</text>
        <view class="kg-sheet__x" role="button" aria-label="关闭" @click="$emit('update:modelValue', false)">
          <l-icon name="x" :size="24" tone="ink-2" />
        </view>
      </view>
      <scroll-view scroll-y class="kg-sheet__body"><slot /></scroll-view>
      <view v-if="$slots.footer" class="kg-sheet__ft"><slot name="footer" /></view>
    </view>
  </wd-popup>
</template>

<script>
/** KgSheet（COMPONENTS §1.11）：wd-popup 封装，≥1024 自动改 dialog 形态。遮罩色走 --wot-overlay-bg；层级 wd-popup 只认内联 z-index prop，运行时读 --z-overlay（须压过 uni-h5 壳 tabbar/page-head 998）。
 * H5 键盘/返回：Esc 关、Tab 圈定、焦点归还由 a11y-focus 全局栈按 .wd-popup 接管；浏览器 Back 先关层不离页由 sheet-history 接管。 */
// #ifdef H5
import { sheetOpened, sheetClosed } from '../../sheet-history.js';
// #endif
const Z_OVERLAY_FALLBACK = 1000;

function readZOverlay() {
  // #ifdef H5
  const v = parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--z-overlay'), 10);
  if (v > 0) return v;
  // #endif
  return Z_OVERLAY_FALLBACK;
}

export default {
  name: 'KgSheet',
  props: {
    modelValue: Boolean,
    title: { type: String, default: '' },
    size: { type: String, default: 'md' },  // md=480px 表单类；lg=640px 长文阅读型（仅桌面 center 生效）
  },
  emits: ['update:modelValue', 'close'],
  data() { return { wide: false, zIndex: readZOverlay() }; },
  computed: {
    position() { return this.wide ? 'center' : 'bottom'; },
    /** wd-popup 把 #fff 写死在 .wd-popup-wrapper[scoped] .wd-popup 上、深色只认 .wot-theme-dark，且 custom-class 挂在非根节点拿不到本组件 scope 属性；用内联 custom-style 让面板底色跟 --card */
    sheetStyle() {
      const base = 'background:var(--card);';
      if (this.position !== 'center') return base + 'border-radius:var(--r-lg) var(--r-lg) 0 0';
      const w = this.size === 'lg' ? 640 : 480;
      return base + `width:min(${w}px,92vw);border-radius:var(--r-lg)`;
    },
  },
  watch: {
    modelValue(v) {
      // #ifdef H5
      if (v) {
        if (this._histTok == null) this._histTok = sheetOpened(() => this.$emit('update:modelValue', false));
      } else if (this._histTok != null) {
        sheetClosed(this._histTok);
        this._histTok = null;
      }
      // #endif
    },
  },
  mounted() {
    // #ifdef H5
    if (this.modelValue) this._histTok = sheetOpened(() => this.$emit('update:modelValue', false));
    const mq = window.matchMedia && window.matchMedia('(min-width: 1024px)');
    if (mq) {
      this.wide = mq.matches;
      this._mqOff = () => { this.wide = mq.matches; };
      mq.addEventListener ? mq.addEventListener('change', this._mqOff) : mq.addListener(this._mqOff);
    }
    // #endif
  },
  beforeUnmount() {
    // #ifdef H5
    if (this._histTok != null) {
      sheetClosed(this._histTok);
      this._histTok = null;
    }
    const mq = window.matchMedia && window.matchMedia('(min-width: 1024px)');
    if (mq && this._mqOff) mq.removeEventListener ? mq.removeEventListener('change', this._mqOff) : mq.removeListener(this._mqOff);
    // #endif
  },
};
</script>

<style>
.kg-sheet__in { display: flex; flex-direction: column; max-height: 70vh; padding: 0 var(--sp-16) var(--sp-16); }
.kg-sheet__grab { width: 36px; height: 4px; border-radius: var(--r-full); background: var(--line); margin: var(--sp-8) auto var(--sp-4); }
.kg-sheet__hd { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-12) 0; }
.kg-sheet__t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.kg-sheet__x { width: var(--hit-min); height: var(--hit-min); display: flex; align-items: center; justify-content: center; margin-right: calc(-1 * var(--sp-12)); }
/* H5 的 uni-scroll-view 内层 height:100% 在 max-height 弹性容器里解析为 auto，需在外层自己滚，否则长内容顶掉 footer */
.kg-sheet__body { flex: 1; min-height: 0; overflow-y: auto; }
.kg-sheet__ft { padding-top: var(--sp-12); }
/* 桌面居中对话框：四周内边距加大（左右 24 / 上 12+标题行 12≈24 / 下 20），不再贴边；移动端底部抽屉仍是 16 */
.kg-sheet__in.is-dialog { padding: var(--sp-12) var(--sp-24) var(--sp-20); }
</style>
