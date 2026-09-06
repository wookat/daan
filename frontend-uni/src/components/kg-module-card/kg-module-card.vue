<template>
  <kg-card variant="flat" clickable :chevron="layout === 'row' && !progress" class="kg-mod" :class="[`kg-mod--${layout}`]" @click="$emit('click', meta.key)">
    <view class="kg-mod__ico" :style="{ background: meta.soft }">
      <l-icon :name="meta.icon" :size="layout === 'grid' ? 32 : 24" :tone="`module:${meta.key}`" />
    </view>
    <view class="kg-mod__body">
      <view class="kg-mod__row">
        <text class="kg-mod__t">{{ meta.label }}</text>
        <kg-tag v-if="badge" tone="brand">{{ badge }}</kg-tag>
      </view>
      <text class="kg-mod__sub">{{ subText }}</text>
    </view>
    <view v-if="progress && layout === 'row'" class="kg-mod__prog">
      <kg-progress :value="progress.done" :max="progress.total" :module="meta.key" />
    </view>
  </kg-card>
</template>

<script>
import { MODULE_KEYS, moduleMeta } from '../../module-meta.js';

/** KgModuleCard（COMPONENTS §2.2）：练习入口卡 row/grid，label/icon/color 全部来自 module-meta.js，页面不再持有 COLORS。 */
export default {
  name: 'KgModuleCard',
  props: {
    module: { type: String, required: true, validator: (k) => MODULE_KEYS.includes(k) },
    layout: { type: String, default: 'row', validator: (v) => v === 'row' || v === 'grid' },
    /** {done, total, acc?} */
    progress: { type: Object, default: null },
    badge: { type: String, default: '' },
    sub: { type: String, default: '' },
  },
  emits: ['click'],
  computed: {
    meta() { return moduleMeta(this.module); },
    subText() {
      if (this.sub) return this.sub;
      const p = this.progress;
      if (!p) return '';
      const parts = [`已练 ${p.done}`];
      if (p.acc != null) parts.push(`正确率 ${p.acc}%`);
      return parts.join(' · ');
    },
  },
};
</script>

<style scoped>
.kg-mod { display: flex; align-items: center; gap: var(--sp-12); }
.kg-mod--row { min-height: 72px; padding: var(--sp-12) var(--sp-16); }
.kg-mod__ico { flex-shrink: 0; width: 44px; height: 44px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; }
.kg-mod__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-4); }
.kg-mod__row { display: flex; align-items: center; gap: var(--sp-8); }
.kg-mod__t { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.kg-mod__sub { font-size: var(--fs-sub); color: var(--ink-3); }
.kg-mod__prog { width: 60px; flex-shrink: 0; }
.kg-mod--grid { flex-direction: column; align-items: flex-start; min-height: 96px; }
.kg-mod--grid .kg-mod__ico { width: 40px; height: 40px; }
</style>
