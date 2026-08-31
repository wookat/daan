<template>
  <image class="l-icon" aria-hidden="true" :src="src" :style="{ width: px, height: px }" mode="aspectFit" />
</template>

<script>
import PATHS from './paths.js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64encode(str) {
  let out = '';
  for (let i = 0; i < str.length; i += 3) {
    const c1 = str.charCodeAt(i);
    const c2 = str.charCodeAt(i + 1);
    const c3 = str.charCodeAt(i + 2);
    out += B64[c1 >> 2] + B64[((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4)];
    out += isNaN(c2) ? '=' : B64[((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6)];
    out += isNaN(c3) ? '=' : B64[c3 & 63];
  }
  return out;
}

/**
 * Lucide 图标组件（三端可用：H5 / mp-weixin / App）。
 * SVG 以 base64 data URI 渲染进 <image>，小程序端同样支持。
 * 用法：<l-icon name="flame" :size="20" color="#d97706" />
 */
export default {
  name: 'LIcon',
  props: {
    name: { type: String, required: true },
    size: { type: [Number, String], default: 20 },
    color: { type: String, default: '#40434e' },
    strokeWidth: { type: [Number, String], default: 2 },
    fill: { type: String, default: 'none' },
  },
  computed: {
    px() {
      return typeof this.size === 'number' ? this.size + 'px' : this.size;
    },
    src() {
      const body = PATHS[this.name] || '';
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${this.fill}" stroke="${this.color}"` +
        ` stroke-width="${this.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
      return 'data:image/svg+xml;base64,' + b64encode(svg);
    },
  },
};
</script>

<style scoped>
.l-icon { display: inline-block; flex-shrink: 0; vertical-align: middle; }
</style>
