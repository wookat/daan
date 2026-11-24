<template>
  <view v-if="visible" class="mask" :class="{ 'above-tabbar': aboveTabbar }" @click="$emit('close')">
    <view class="sheet" role="dialog" aria-modal="true" aria-label="导出 PDF" @click.stop>
      <view class="sheet-h">
        <text class="sheet-t">导出 PDF</text>
        <view class="sheet-x" @click="$emit('close')">✕</view>
      </view>
      <view class="info-row">
        <text class="info-k">导出范围</text>
        <text class="info-v">{{ scope }}</text>
      </view>
      <view class="info-row">
        <text class="info-k">题数</text>
        <text class="info-v">{{ countText }}</text>
      </view>
      <view class="exp-opts">
        <text class="expchip" :class="{ on: withAns && !only }" role="button" :aria-pressed="String(withAns && !only)" @click="only = false; withAns = !withAns">含解析</text>
        <text class="expchip" :class="{ on: only }" role="button" :aria-pressed="String(only)" @click="only = !only">仅答案</text>
        <text class="expchip" :class="{ on: withSheet && !only }" role="button" :aria-pressed="String(withSheet && !only)" @click="only = false; withSheet = !withSheet">含答题卡</text>
        <text v-if="reviewable" class="expchip" :class="{ on: withMine && (only || withAns) }" @click="toggleMine">含我的错答/错因</text>
      </view>
      <view class="opt-note">{{ optNote }}</view>
      <view v-if="sheetlessNote" class="opt-note sheetless">{{ sheetlessNote }}</view>
      <view v-if="!isAuthed()" class="sync-note" role="button" @click="goLogin">
        <text class="sync-note-t">登录后错题与试卷码云端留档，换设备随时重导</text>
        <text class="sync-note-go">去登录 ›</text>
      </view>
      <view class="confirm-btn" :class="{ dim: busy }" role="button" :aria-disabled="String(!!busy)" @click="onConfirm">{{ busy ? '正在生成 PDF…' : '确认导出' }}</view>
    </view>
  </view>
</template>

<script>
import { getAuthUser, trackEvent } from '../../api/api.js';
// #ifdef H5
import { sheetOpened, sheetClosed } from '../../utils/sheet-history.js';
// #endif

// H5 浏览器 Back 先关本层（与 KgSheet 同走 sheet-history；叠在筛选层之上时 Back 逐层关）
export default {
  name: 'ExportConfirm',
  props: {
    visible: { type: Boolean, default: false },
    scope: { type: String, default: '当前题目' },
    count: { type: Number, default: null },
    busy: { type: Boolean, default: false },
    aboveTabbar: { type: Boolean, default: false },
    /** 无题库 id 的题数（时政/手录）：只进正文与参考答案，不上机读答题卡。 */
    sheetless: { type: Number, default: 0 },
    /** 错题本导出：参考答案页可附每题「我的错答/错因」（需含答案）。 */
    reviewable: { type: Boolean, default: false },
  },
  data() {
    return { withAns: true, withSheet: true, only: false, withMine: true };
  },
  watch: {
    visible(v) {
      if (v && this.$forceUpdate) this.$forceUpdate();
      // #ifdef H5
      if (v) {
        if (this._histTok == null) this._histTok = sheetOpened(() => this.$emit('close'));
      } else if (this._histTok != null) {
        sheetClosed(this._histTok);
        this._histTok = null;
      }
      // #endif
    },
  },
  mounted() {
    this._onAuth = () => { if (this.$forceUpdate) this.$forceUpdate(); };
    if (uni.$on) uni.$on('authChanged', this._onAuth);
    // #ifdef H5
    if (this.visible) this._histTok = sheetOpened(() => this.$emit('close'));
    // #endif
  },
  beforeUnmount() {
    if (this._onAuth && uni.$off) uni.$off('authChanged', this._onAuth);
    // #ifdef H5
    if (this._histTok != null) {
      sheetClosed(this._histTok);
      this._histTok = null;
    }
    // #endif
  },
  computed: {
    countText() {
      return this.count != null ? this.count + ' 题' : '按当前设置组卷';
    },
    withNotes() {
      return this.reviewable && this.withMine && (this.only || this.withAns);
    },
    optNote() {
      const mine = this.withNotes ? ' + 我的错答/错因' : '';
      if (this.only) return '只导出参考答案页，不含题目' + mine;
      return '导出题目' + (this.withAns ? ' + 答案解析' + mine : '') + (this.withSheet ? ' + 机读答题卡' : '');
    },
    sheetlessNote() {
      if (this.only || !this.withSheet || !(this.sheetless > 0)) return '';
      if (this.count != null && this.sheetless >= this.count) return '所选均为时政/手录题，无机读答题卡，请对照参考答案核对';
      return '其中 ' + this.sheetless + ' 题（时政/手录）不上机读答题卡，请对照参考答案核对';
    },
  },
  methods: {
    toggleMine() {
      this.withMine = !this.withNotes;
      if (this.withMine && !this.only) this.withAns = true;
    },
    onConfirm() {
      if (this.busy) return;
      this.$emit('confirm', {
        include_answers: this.only || this.withAns,
        answer_sheet: !this.only && this.withSheet,
        include_questions: !this.only,
        with_notes: this.withNotes,
      });
    },
    isAuthed() {
      return !!getAuthUser();
    },
    goLogin() {
      trackEvent('login_nudge_click', 'pdf_export');
      this.$emit('close');
      uni.navigateTo({ url: '/pkgA/user/login' });
    },
  },
};
</script>

<style scoped>
.mask { position: fixed; inset: 0; background: var(--mask); z-index: var(--z-overlay); display: flex; align-items: flex-end; justify-content: center; animation: kg-ec-fade var(--dur-fast) var(--ease-decel); }
/* #ifdef H5 */
/* H5 底部 TabBar 常驻：整个弹层收在 TabBar 上方（仅 tab 页需要） */
@media (max-width: 767px) {
  .mask.above-tabbar { bottom: calc(var(--tab-h) + env(safe-area-inset-bottom)); }
}
/* #endif */
.sheet { width: 100%; box-sizing: border-box; background: var(--card); border-radius: var(--r-lg) var(--r-lg) 0 0; padding: var(--sp-16) var(--sp-16) calc(var(--sp-20) + env(safe-area-inset-bottom)); max-height: 76vh; overflow-y: auto; animation: kg-ec-up var(--dur-sheet) var(--ease-decel); }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-12); }
.sheet-t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.sheet-x { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; font-size: var(--fs-sub); color: var(--ink-2); margin: -6px -4px -6px 0; border-radius: var(--r-full); transition: transform var(--dur-instant) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard); }
.sheet-x:active { transform: scale(0.9); background: var(--fill); }
.info-row { display: flex; align-items: baseline; gap: var(--sp-12); margin-bottom: var(--sp-8); }
.info-k { flex-shrink: 0; font-size: var(--fs-caption); color: var(--ink-2); }
.info-v { font-size: var(--fs-sub); color: var(--ink); font-weight: 500; }
.exp-opts { display: flex; flex-wrap: wrap; gap: var(--sp-8); margin-top: var(--sp-12); }
.expchip { flex: 1 1 auto; min-height: 44px; padding: 0 var(--sp-8); box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: var(--r-sm); font-size: var(--fs-caption); color: var(--ink-2); background: var(--fill); white-space: nowrap; transition: background-color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-spring-snappy); }
.expchip:active { transform: scale(0.96); }
.expchip.on { border-color: var(--brand-text); color: var(--brand-text); background: var(--brand-soft); font-weight: 600; }
.opt-note { margin-top: var(--sp-8); font-size: var(--fs-caption); color: var(--ink-3); line-height: var(--lh-caption); }
.sync-note { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); min-height: 40px; margin-top: var(--sp-8); padding: var(--sp-4) var(--sp-12); border-radius: var(--r-sm); background: var(--fill); box-sizing: border-box; transition: background-color var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-spring-snappy); }
.sync-note:active { transform: scale(0.985); }
.sync-note-t { font-size: var(--fs-caption); color: var(--ink-2); }
.sync-note-go { flex-shrink: 0; font-size: var(--fs-caption); font-weight: 600; color: var(--brand-text); }
.confirm-btn { margin-top: var(--sp-16); min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background: var(--brand); color: var(--on-brand); border-radius: var(--r-full); font-size: var(--fs-sub); font-weight: 600; transition: background-color var(--dur-instant) var(--ease-standard), transform var(--dur-fast) var(--ease-spring-snappy), opacity var(--dur-fast) var(--ease-standard); }
.confirm-btn:active:not(.dim) { transform: scale(0.97); background: var(--brand-press); }
.confirm-btn.dim { opacity: 0.6; }
@keyframes kg-ec-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes kg-ec-up { from { opacity: 0; transform: translate3d(0, 28px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
@keyframes kg-ec-zoom { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
/* #ifdef H5 */
@media (min-width: 768px) {
  .mask { align-items: center; }
  .sheet { width: min(480px, 92vw); border-radius: var(--r-lg); padding: var(--sp-20); animation: kg-ec-zoom var(--dur-base) var(--ease-spring-snappy); }
  .sheet-x, .expchip, .confirm-btn, .sync-note { cursor: pointer; }
}
@media (hover: hover) and (pointer: fine) {
  .sheet-x:hover { background: var(--fill); }
  .expchip:not(.on):hover { border-color: var(--line-strong); }
  .confirm-btn:not(.dim):hover { background: var(--brand-press); }
}
/* #endif */
</style>
