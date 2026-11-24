<template>
  <view v-if="item" class="kg-undo-wrap" :class="{ 'above-tabbar': aboveTabbar, 'is-in': shown }" role="status" aria-live="polite">
    <view class="kg-undo">
      <view class="kg-undo__in">
        <text class="kg-undo__t">{{ item.text }}</text>
        <view class="kg-undo__btn" role="button" tabindex="0" @click="undo" @keydown.enter.prevent="undo" @keydown.space.prevent="undo">
          <l-icon name="undo-2" :size="16" tone="brand-text" />
          <text class="kg-undo__btn-t">{{ item.actionText }}</text>
        </view>
      </view>
      <view class="kg-undo__bar-wrap">
        <view class="kg-undo__bar" :style="barStyle" />
      </view>
    </view>
  </view>
</template>

<script>
import { subscribeUndoToast, triggerUndoToast } from '../../utils/toast.js';
import { prefersReducedMotion } from '../../a11y/a11y-motion.js';

/** KgUndoBar：非阻塞可撤销浮条（替代破坏性删/清/标掌握的阻塞弹窗，GPU scaleX 倒计时轨）。 */
export default {
  name: 'KgUndoBar',
  props: {
    aboveTabbar: { type: Boolean, default: false },
  },
  data() {
    return { item: null, shown: false, shrinking: false };
  },
  computed: {
    barStyle() {
      if (!this.item) return {};
      const dur = prefersReducedMotion() ? 0 : (this.shrinking ? this.item.duration : 0);
      return {
        transform: this.shrinking ? 'scaleX(0)' : 'scaleX(1)',
        transition: dur > 0 ? `transform ${dur}ms linear` : 'none',
      };
    },
  },
  mounted() {
    this._unsub = subscribeUndoToast((snap) => {
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = null;
      }
      this.item = snap;
      this.shown = false;
      this.shrinking = false;
      if (!snap) return;
      const start = () => {
        this.shown = true;
        this.shrinking = true;
      };
      if (typeof requestAnimationFrame === 'function') {
        this._raf = requestAnimationFrame(() => {
          this._raf = requestAnimationFrame(start);
        });
      } else {
        setTimeout(start, 16);
      }
    });
  },
  beforeUnmount() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._unsub) { this._unsub(); this._unsub = null; }
  },
  methods: {
    undo() {
      if (!this.item) return;
      triggerUndoToast(this.item.id);
    },
  },
};
</script>

<style scoped>
.kg-undo-wrap {
  position: fixed;
  left: var(--page-x);
  right: var(--page-x);
  bottom: calc(var(--sp-16) + env(safe-area-inset-bottom, 0px));
  z-index: var(--z-toast);
  display: flex;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  transform: translate3d(0, 12px, 0) scale(0.96);
  transition: opacity var(--dur-base) var(--ease-decel), transform var(--dur-base) var(--ease-spring-snappy);
}
.kg-undo-wrap.is-in {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}
/* #ifdef H5 */
@media (max-width: 767px) {
  .kg-undo-wrap.above-tabbar {
    bottom: calc(var(--tab-h) + var(--sp-12) + env(safe-area-inset-bottom, 0px));
  }
}
@media (min-width: 768px) {
  uni-page[type='tabBar'] .kg-undo-wrap.above-tabbar {
    left: calc(208px + var(--page-x));
  }
}
/* #endif */
.kg-undo {
  pointer-events: auto;
  width: min(460px, 100%);
  background: var(--card);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-md);
  box-shadow: var(--sh-3);
  overflow: hidden;
}
.kg-undo__in {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-12);
  padding: var(--sp-12) var(--sp-16);
}
.kg-undo__t {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-sub);
  color: var(--ink);
  font-weight: 500;
}
.kg-undo__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-4);
  min-height: 32px;
  padding: 0 var(--sp-12);
  border-radius: var(--r-full);
  background: var(--brand-soft);
  flex-shrink: 0;
  transition: transform var(--dur-instant) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard);
}
.kg-undo__btn:active {
  transform: scale(0.95);
  background: var(--brand-soft-2);
}
.kg-undo__btn-t {
  font-size: var(--fs-sub);
  font-weight: 600;
  color: var(--brand-text);
}
.kg-undo__bar-wrap {
  height: 2px;
  background: var(--fill);
  overflow: hidden;
}
.kg-undo__bar {
  width: 100%;
  height: 100%;
  background: var(--brand);
  transform-origin: left center;
  will-change: transform;
}
/* #ifdef H5 */
.kg-undo__btn {
  cursor: pointer;
}
/* #endif */
</style>
