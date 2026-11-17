<template>
  <image :src="src" :mode="mode" :style="fitStyle" class="kg-fit" @load="onLoad" @click="$emit('click', $event)" />
</template>

<script>
/**
 * KgFitImg：按图片原始尺寸渲染，仅超出容器时才缩到 max-width: 100%。
 * 解决 widthFix + width:100% 把小尺寸公式图/符号图拉伸放大变糊的问题。
 */
export default {
  name: 'KgFitImg',
  props: {
    src: { type: String, required: true },
    mode: { type: String, default: 'widthFix' },
  },
  emits: ['click'],
  data() { return { nw: 0 }; },
  watch: {
    src() { this.nw = 0; },
  },
  computed: {
    fitStyle() { return this.nw ? { width: `${this.nw}px` } : null; },
  },
  methods: {
    onLoad(e) {
      const w = e && e.detail && e.detail.width;
      if (w) this.nw = w;
    },
  },
};
</script>

<style scoped>
.kg-fit { display: inline-block; max-width: 100%; vertical-align: middle; }
</style>
