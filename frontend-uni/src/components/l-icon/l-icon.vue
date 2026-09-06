<template>
  <image v-if="legacy" class="l-icon" aria-hidden="true" :src="legacySrc" :style="{ width: px, height: px }" mode="aspectFit" />
  <view v-else class="l-icon" aria-hidden="true" :style="style" />
</template>

<script>
import PATHS from './paths.js';
import { ICON_SIZES, isIconTone, resolveIconColor, iconMaskUri, iconSvgUri } from '../../icon-tone.js';

/**
 * Lucide 图标组件（H5 / mp-weixin / App）。
 * 新用法：<l-icon name="flame" tone="warn" :size="20" /> —— SVG 作 CSS mask，颜色由 tone 语义变量决定，随深色模式切换。
 * 尺寸只用 16/20/24/32（SPEC §2.9）。
 * color 为 deprecated 裸值通道：传了就走旧的 <image src=data-uri> 渲染（保留 stroke/fill 双色），页面迁到 tone 后连同这条路径一起删。
 */
export default {
  name: 'LIcon',
  props: {
    name: { type: String, required: true },
    /** 16 / 20 / 24 / 32；其他值仅 dev 下 warn，不阻断旧页面 */
    size: {
      type: [Number, String],
      default: 20,
      validator: (v) => ICON_SIZES.includes(Number(v)),
    },
    tone: {
      type: String,
      default: '',
      validator: (v) => v === '' || isIconTone(v),
    },
    /** @deprecated 用 tone */
    color: { type: String, default: '' },
    strokeWidth: { type: [Number, String], default: 2 },
    fill: { type: String, default: 'none' },
  },
  computed: {
    px() {
      return typeof this.size === 'number' ? this.size + 'px' : this.size;
    },
    body() {
      return PATHS[this.name] || '';
    },
    legacy() {
      return !this.tone && !!this.color;
    },
    legacySrc() {
      return iconSvgUri(this.body, { stroke: this.color, fill: this.fill, strokeWidth: this.strokeWidth });
    },
    style() {
      const mask = `url("${iconMaskUri(this.body, { strokeWidth: this.strokeWidth, fill: this.fill })}") center / contain no-repeat`;
      return {
        width: this.px,
        height: this.px,
        backgroundColor: resolveIconColor(this.tone, ''),
        '-webkit-mask': mask,
        mask,
      };
    },
  },
};
</script>

<style scoped>
.l-icon { display: inline-block; flex-shrink: 0; vertical-align: middle; }
</style>
