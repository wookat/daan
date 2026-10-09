<template>
  <view class="kg-lottie" :style="{ width: size + 'px', height: size + 'px' }">
    <!-- #ifdef H5 -->
    <view ref="box" class="kg-lottie-box" />
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <l-icon :name="fallback" :size="iconSize" :tone="tone" />
    <!-- #endif -->
  </view>
</template>

<script>
import lIcon from '../l-icon/l-icon.vue';

// lottie-web 轻量播放器 + 官方免费 JSON（confetti 3 层 63KB）。
// 播放器 380KB ESM 走动态 import，只在首次渲染庆祝时才进包加载；
// 非 H5 端（小程序）没有 lottie runtime，回退静态 l-icon。
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
  // #ifdef H5
  mounted() {
    this._play();
  },
  beforeUnmount() {
    this._anim && this._anim.destroy();
  },
  // #endif
  methods: {
    // #ifdef H5
    async _play() {
      if (typeof window === 'undefined' || !this.$refs.box) return;
      const el = this.$refs.box.$el || this.$refs.box;
      const { default: lottie } = await import('../../vendor/lottie/lottie_light.js');
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
.kg-lottie-box {
  width: 100%;
  height: 100%;
}
.kg-lottie-box :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
