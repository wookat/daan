<template>
  <view class="kg-lottie" :style="{ width: size + 'px', height: size + 'px' }">
    <!-- #ifdef H5 -->
    <view v-if="!reduced" ref="box" class="kg-lottie-box" />
    <l-icon v-else :name="fallback" :size="iconSize" :tone="tone" />
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <l-icon :name="fallback" :size="iconSize" :tone="tone" />
    <!-- #endif -->
  </view>
</template>

<script>
import lIcon from '../l-icon/l-icon.vue';
import { prefersReducedMotion, watchReducedMotion } from '../../a11y/a11y-motion.js';

// lottie-web 轻量播放器 + 官方免费 JSON（confetti 3 层 63KB）。
// reduced-motion 开启时直接回退静态 l-icon，不下载/运行动画播放器。
export default {
  name: 'KgLottie',
  components: { lIcon },
  props: {
    src: { type: String, default: 'static/confetti.json' },
    size: { type: Number, default: 96 },
    loop: { type: Boolean, default: false },
    fallback: { type: String, default: 'party-popper' },
    iconSize: { type: Number, default: 48 },
    tone: { type: String, default: 'ok' },
  },
  data() {
    return { reduced: prefersReducedMotion() };
  },
  // #ifdef H5
  mounted() {
    this._destroyed = false;
    this._unwatchMotion = watchReducedMotion((v) => {
      this.reduced = v;
      if (v && this._anim) {
        this._anim.destroy();
        this._anim = null;
      } else if (!v && !this._anim) {
        this.$nextTick(() => this._play());
      }
    });
    if (!this.reduced) this._play();
  },
  beforeUnmount() {
    this._destroyed = true;
    if (this._unwatchMotion) { this._unwatchMotion(); this._unwatchMotion = null; }
    this._anim && this._anim.destroy();
    this._anim = null;
  },
  // #endif
  methods: {
    // #ifdef H5
    async _play() {
      if (this.reduced || typeof window === 'undefined' || !this.$refs.box) return;
      const el = this.$refs.box.$el || this.$refs.box;
      const { default: lottie } = await import('../../vendor/lottie/lottie_light.js');
      if (this._destroyed || this.reduced || !this.$refs.box) return;
      this._anim = lottie.loadAnimation({
        container: el,
        renderer: 'svg',
        loop: this.loop,
        autoplay: true,
        path: this.src,
      });
    },
    // #endif
  },
};
</script>

<style scoped>
.kg-lottie { display: inline-flex; align-items: center; justify-content: center; }
.kg-lottie-box {
  width: 100%;
  height: 100%;
}
.kg-lottie-box :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
