<template>
  <wd-popup
    :model-value="modelValue"
    :position="position"
    :duration="popupDuration"
    :safe-area-inset-bottom="position === 'bottom'"
    :z-index="zIndex"
    :custom-class="cls"
    :custom-style="sheetStyle"
    @update:model-value="$emit('update:modelValue', $event)"
    @after-enter="onEntered"
    @close="$emit('close')"
  >
    <view ref="inRef" class="kg-sheet__in" :class="{ 'is-dialog': position === 'center' }" role="dialog" aria-modal="true" :aria-label="title || undefined">
      <view
        v-if="position === 'bottom'"
        class="kg-sheet__grab-wrap"
        @touchstart="onHandleTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      >
        <view class="kg-sheet__grab" />
      </view>
      <view
        v-if="title"
        class="kg-sheet__hd"
        @touchstart="onHandleTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      >
        <text class="kg-sheet__t">{{ title }}</text>
        <view class="kg-sheet__x" role="button" aria-label="关闭" @click.stop="$emit('update:modelValue', false)">
          <l-icon name="x" :size="24" tone="ink-2" />
        </view>
      </view>
      <scroll-view
        scroll-y
        class="kg-sheet__body"
        :show-scrollbar="false"
        @scroll="onBodyScroll"
        @touchstart="onBodyTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      >
        <slot />
      </scroll-view>
      <view v-if="$slots.footer" class="kg-sheet__ft"><slot name="footer" /></view>
    </view>
  </wd-popup>
</template>

<script>
/** KgSheet（COMPONENTS §1.11）：wd-popup 封装，≥1024 自动改 dialog 形态。遮罩色走 --wot-overlay-bg；层级 wd-popup 只认内联 z-index prop，运行时读 --z-overlay（须压过 uni-h5 壳 tabbar/page-head 998）。
 * H5 键盘/返回：Esc 关、Tab 圈定、焦点归还由 a11y-focus 全局栈按 .wd-popup 接管；浏览器 Back 先关层不离页由 sheet-history 接管。
 * 移动端 bottom 形态支持 1:1 跟手下拉关闭（含上拉橡皮筋与滚动交接）及完整 --dur-sheet 入场动画 + 360ms 防丢屏兜底。 */
// #ifdef H5
import { sheetOpened, sheetClosed } from '../../utils/sheet-history.js';
// #endif
import { motionDuration, watchReducedMotion } from '../../a11y/a11y-motion.js';

const Z_OVERLAY_FALLBACK = 1000;

function readZOverlay() {
  // #ifdef H5
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const v = parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--z-overlay'), 10);
    if (v > 0) return v;
  }
  // #endif
  return Z_OVERLAY_FALLBACK;
}

export default {
  name: 'KgSheet',
  props: {
    modelValue: Boolean,
    title: { type: String, default: '' },
    size: { type: String, default: 'md' }, // md=480px 表单类；lg=640px 长文阅读型（仅桌面 center 生效）
  },
  emits: ['update:modelValue', 'close'],
  data() {
    return {
      wide: false,
      zIndex: readZOverlay(),
      settled: false,
      dragging: false,
      snapping: false,
      dragY: 0,
      dragDurMs: 0,
      dragDismiss: false,
    };
  },
  computed: {
    position() { return this.wide ? 'center' : 'bottom'; },
    popupDuration() {
      return this.dragDismiss ? 0 : motionDuration(this.position === 'center' ? 240 : 280);
    },
    cls() {
      return ['kg-sheet', this.settled ? 'is-settled' : '', this.dragging || this.snapping ? 'is-dragging' : '']
        .filter(Boolean)
        .join(' ');
    },
    /** wd-popup 把 #fff 写死在 .wd-popup-wrapper[scoped] .wd-popup 上、深色只认 .wot-theme-dark，且 custom-class 挂在非根节点拿不到本组件 scope 属性；用内联 custom-style 让面板底色跟 --card */
    sheetStyle() {
      const base = 'background:var(--card);';
      if (this.position !== 'center') {
        const y = Math.round(this.dragY * 10) / 10;
        let tail = '';
        if (this.dragging || this.snapping) {
          const ease = this.dragDismiss ? 'var(--ease-accel)' : 'var(--ease-spring-snappy)';
          const tr = this.snapping ? `transition:transform ${this.dragDurMs}ms ${ease}` : 'transition:none';
          tail = `;top:auto;bottom:0;left:0;right:0;transform:translate3d(0, ${y}px, 0);${tr}`;
        } else if (this.settled) {
          tail = ';top:auto;bottom:0;left:0;right:0;transform:translate3d(0, 0, 0)';
        }
        return base + 'border-radius:var(--r-lg) var(--r-lg) 0 0' + tail;
      }
      const w = this.size === 'lg' ? 640 : 480;
      return base + `width:min(${w}px,92vw);border-radius:var(--r-lg)`;
    },
  },
  watch: {
    modelValue(v) {
      this.clearTimers();
      if (v) {
        this.resetDrag();
        const fallbackMs = motionDuration(360);
        if (fallbackMs <= 0) this.settled = true;
        else this._settleT = setTimeout(() => { this.settled = true; }, fallbackMs);
      } else {
        this.settled = false;
        this.resetDrag();
      }
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
    if (this.modelValue) this.settled = true;
    this._bodyScrollTop = 0;
    this._unwatchMotion = watchReducedMotion(() => {
      if (this.modelValue && motionDuration(1) === 0) this.settled = true;
    });
    // #ifdef H5
    if (this.modelValue) this._histTok = sheetOpened(() => this.$emit('update:modelValue', false));
    const mq = window.matchMedia && window.matchMedia('(min-width: 1024px)');
    if (mq) {
      this._mq = mq;
      this.wide = mq.matches;
      this._mqOff = () => { this.wide = mq.matches; };
      mq.addEventListener ? mq.addEventListener('change', this._mqOff) : mq.addListener(this._mqOff);
    }
    // #endif
  },
  beforeUnmount() {
    this.clearTimers();
    this.setOverlayOpacity(null);
    if (this._unwatchMotion) { this._unwatchMotion(); this._unwatchMotion = null; }
    // #ifdef H5
    if (this._histTok != null) {
      sheetClosed(this._histTok);
      this._histTok = null;
    }
    if (this._mq && this._mqOff) {
      this._mq.removeEventListener
        ? this._mq.removeEventListener('change', this._mqOff)
        : this._mq.removeListener(this._mqOff);
    }
    this._mq = null;
    this._mqOff = null;
    // #endif
  },
  methods: {
    clearTimers() {
      if (this._settleT) { clearTimeout(this._settleT); this._settleT = null; }
      if (this._snapT) { clearTimeout(this._snapT); this._snapT = null; }
    },
    onEntered() {
      if (this._settleT) { clearTimeout(this._settleT); this._settleT = null; }
      if (this.modelValue) this.settled = true;
    },
    resetDrag() {
      this.dragging = false;
      this.snapping = false;
      this.dragY = 0;
      this.dragDurMs = 0;
      this.dragDismiss = false;
      this._dragCtx = null;
      this.setOverlayOpacity(null);
    },
    onBodyScroll(e) {
      this._bodyScrollTop = (e && e.detail && e.detail.scrollTop) || 0;
    },
    getPoint(e) {
      const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
      return t ? { x: t.clientX, y: t.clientY } : null;
    },
    sheetRoot() {
      // #ifdef H5
      const r = this.$refs.inRef;
      const el = (r && r.$el) || r || this.$el;
      if (el && el.closest) return { wrap: el.closest('.wd-popup-wrapper'), box: el.closest('.wd-popup') };
      // #endif
      return { wrap: null, box: null };
    },
    setOverlayOpacity(val) {
      // #ifdef H5
      const { wrap } = this.sheetRoot();
      const ov = wrap && wrap.querySelector('.wd-overlay');
      if (!ov) return;
      if (val == null) {
        ov.style.opacity = '';
        ov.style.transition = '';
      } else {
        ov.style.transition = this.snapping ? `opacity ${this.dragDurMs}ms var(--ease-standard)` : 'none';
        ov.style.opacity = String(val);
      }
      // #endif
    },
    startDrag(e, fromBody) {
      if (this.position === 'center' || !this.modelValue || this.snapping) return;
      const pt = this.getPoint(e);
      if (!pt) return;
      let atTop = true;
      let sheetH = 420;
      // #ifdef H5
      const { box } = this.sheetRoot();
      if (fromBody && box) {
        const scroller = box.querySelector('.uni-scroll-view-wrap') || box.querySelector('.kg-sheet__body');
        atTop = (!scroller || (scroller.scrollTop || 0) <= 1) && this._bodyScrollTop <= 1;
      }
      if (box && box.getBoundingClientRect) sheetH = box.getBoundingClientRect().height || 420;
      // #endif
      if (fromBody && !atTop && this._bodyScrollTop > 1) return;
      const now = Date.now();
      this._dragCtx = {
        sx: pt.x,
        sy: pt.y,
        fromBody: !!fromBody,
        locked: !fromBody,
        aborted: false,
        sheetH,
        samples: [{ y: pt.y, t: now }],
      };
    },
    onHandleTouchStart(e) {
      this.startDrag(e, false);
    },
    onBodyTouchStart(e) {
      this.startDrag(e, true);
    },
    onTouchMove(e) {
      const ctx = this._dragCtx;
      if (!ctx || ctx.aborted) return;
      const pt = this.getPoint(e);
      if (!pt) return;
      const dx = pt.x - ctx.sx;
      const dy = pt.y - ctx.sy;
      if (!ctx.locked) {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
        if (dy > 6 && Math.abs(dy) > Math.abs(dx) * 1.2) {
          ctx.locked = true;
        } else {
          ctx.aborted = true;
          return;
        }
      }
      if (e.cancelable && typeof e.preventDefault === 'function') e.preventDefault();
      this.dragging = true;
      this.snapping = false;
      const now = Date.now();
      ctx.samples.push({ y: pt.y, t: now });
      while (ctx.samples.length > 2 && now - ctx.samples[0].t > 80) ctx.samples.shift();
      if (dy >= 0) {
        this.dragY = dy;
        const ov = Math.max(0.15, Math.min(1, 1 - dy / (ctx.sheetH * 1.15)));
        this.setOverlayOpacity(ov);
      } else {
        // 上拉越界：Apple 橡皮筋阻尼（最多 28px）
        this.dragY = -28 * (1 - 1 / (1 + Math.abs(dy) / 140));
        this.setOverlayOpacity(1);
      }
    },
    onTouchEnd() {
      const ctx = this._dragCtx;
      this._dragCtx = null;
      if (!ctx || !this.dragging) return;
      const dy = this.dragY;
      const first = ctx.samples[0];
      const last = ctx.samples[ctx.samples.length - 1];
      const dt = Math.max(1, last.t - first.t);
      const vy = (last.y - first.y) / dt;
      const dismiss = dy > Math.min(120, ctx.sheetH * 0.3) || (vy > 0.55 && dy > 24);
      if (dismiss) {
        const dur = motionDuration(Math.round(Math.max(130, Math.min(220, (ctx.sheetH - dy) / Math.max(vy, 0.9)))));
        this.dragging = false;
        this.snapping = true;
        this.dragDismiss = true;
        this.dragDurMs = dur;
        this.dragY = ctx.sheetH + 40;
        this.setOverlayOpacity(0);
        this._snapT = setTimeout(() => {
          this.$emit('update:modelValue', false);
          this.$emit('close');
          this.resetDrag();
        }, dur);
      } else {
        const dur = motionDuration(240);
        this.dragging = false;
        this.snapping = dur > 0;
        this.dragDismiss = false;
        this.dragDurMs = dur;
        this.dragY = 0;
        this.setOverlayOpacity(1);
        if (dur > 0) {
          this._snapT = setTimeout(() => {
            this.resetDrag();
          }, dur);
        } else {
          this.resetDrag();
        }
      }
    },
  },
};
</script>

<style>
.kg-sheet__in { display: flex; flex-direction: column; max-height: 70vh; padding: 0 var(--sp-16) var(--sp-16); position: relative; }
.kg-sheet__in:not(.is-dialog)::after { content: ''; position: absolute; left: 0; right: 0; bottom: -32px; height: 32px; background: var(--card); pointer-events: none; }
.kg-sheet__grab-wrap { padding: var(--sp-8) 0 var(--sp-4); margin: 0 calc(-1 * var(--sp-16)); min-height: 24px; display: flex; align-items: center; justify-content: center; touch-action: none; }
.kg-sheet__grab { width: 36px; height: 4px; border-radius: var(--r-full); background: var(--line-strong); }
.kg-sheet__hd { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-12); touch-action: pan-x; }
.kg-sheet__t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.kg-sheet__x { width: var(--hit-min); height: var(--hit-min); display: flex; align-items: center; justify-content: center; margin-right: calc(-1 * var(--sp-12)); border-radius: var(--r-full); transition: transform var(--dur-instant) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard); }
.kg-sheet__x:active { transform: scale(0.9); background: var(--fill); }
/* H5 的 uni-scroll-view 内层 height:100% 在 max-height 弹性容器里解析为 auto，需在外层自己滚，否则长内容顶掉 footer */
.kg-sheet__body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; }
.kg-sheet__ft { padding-top: var(--sp-12); }
/* 桌面居中对话框：四周内边距加大（左右 24 / 上 12+标题行 12≈24 / 下 20），不再贴边；移动端底部抽屉仍是 16 */
.kg-sheet__in.is-dialog { padding: var(--sp-12) var(--sp-24) var(--sp-20); }
/* #ifdef H5 */
.kg-sheet__x { cursor: pointer; }
@media (hover: hover) and (pointer: fine) {
  .kg-sheet__x:hover { background: var(--fill); }
}
/* #endif */
</style>
