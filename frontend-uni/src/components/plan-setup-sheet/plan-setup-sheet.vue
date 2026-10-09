<template>
  <kg-sheet :model-value="modelValue" :title="'制定学习计划 · ' + ['考试信息', '目标', '每日时长'][setupStep - 1] + '（' + setupStep + '/3）'" @update:model-value="$emit('update:modelValue', $event)">
    <template v-if="setupStep === 1">
      <view class="setrow">
        <text class="set-k">考试类型</text>
        <kg-chip-row size="sm" :options="['国考', '省考', '事业单位', '其他'].map((t) => ({ label: t, value: t }))" :model-value="pf.exam_type" :scroll-to-selected="false" @update:model-value="(v) => (pf.exam_type = v)" />
      </view>
      <view class="setrow">
        <text class="set-k">目标地区</text>
        <input v-model="pf.target_region" class="pf-input" placeholder="如 广东 / 全国（选填）" :maxlength="20" />
      </view>
      <view class="setrow">
        <text class="set-k">考试日期</text>
        <wd-datetime-picker
          v-model="pfDateTs"
          type="date"
          :min-date="dateStartTs"
          :max-date="dateEndTs"
          :before-confirm="beforeExamDate"
          @confirm="onExamDate"
        >
          <view class="pf-date" :class="{ empty: !pf.exam_date, past: pfDatePast }">{{ pfDateText }}</view>
        </wd-datetime-picker>
      </view>
    </template>
    <template v-else-if="setupStep === 2">
      <view class="setrow">
        <text class="set-k">目标分</text>
        <kg-chip-row size="sm" :options="[60, 65, 70, 75, 80].map((s) => ({ label: s + '+', value: s }))" :model-value="pf.target_score" :scroll-to-selected="false" @update:model-value="(v) => (pf.target_score = v)" />
      </view>
      <view class="setrow">
        <text class="set-k">基础自评</text>
        <kg-chip-row size="sm" :options="['零基础', '有基础', '二战'].map((b) => ({ label: b, value: b }))" :model-value="pf.base_level" :scroll-to-selected="false" @update:model-value="(v) => (pf.base_level = v)" />
      </view>
    </template>
    <template v-else>
      <view class="setrow">
        <view class="set-kwrap"><text class="set-k">每日可用时长</text><text class="set-sub">决定每日任务量</text></view>
        <kg-chip-row size="sm" :options="[30, 60, 90, 120].map((m) => ({ label: m + ' 分钟', value: m }))" :model-value="pf.daily_minutes" :scroll-to-selected="false" @update:model-value="(v) => (pf.daily_minutes = v)" />
      </view>
      <text class="pf-summary">{{ pf.exam_type }}{{ pf.target_region ? ' · ' + pf.target_region : '' }} · {{ pf.exam_date }} · 目标 {{ pf.target_score }}+ · {{ pf.base_level }} · 每天 {{ pf.daily_minutes }} 分钟</text>
    </template>
    <template #footer>
      <view class="sheet-acts">
        <kg-button variant="primary" size="lg" block :loading="setupBusy" @click="setupNext">{{ setupStep < 3 ? '下一步' : setupBusy ? '生成中…' : '生成我的学习计划' }}</kg-button>
        <kg-button v-if="setupStep > 1" variant="text" size="md" block @click="setupStep--">上一步</kg-button>
      </view>
    </template>
  </kg-sheet>
</template>

<script>
/** PlanSetupSheet：3 步学习计划向导（考试信息 → 目标 → 每日时长）。
 * 原来内嵌在 home.vue；抽成组件后 home 只负责 openSetup() 与 saved 后刷新计划卡。
 * 保存走 POST /api/profile，成功后 emit('saved', profile)。 */
import { request, anonUid } from '../../api.js';
import { isExamDatePast, examDateFieldText, cnTodayStr } from '../../plan-days-label.js';

export default {
  name: 'PlanSetupSheet',
  props: {
    modelValue: { type: Boolean, default: false },
    profile: { type: Object, default: null },
  },
  emits: ['update:modelValue', 'saved'],
  data() {
    return {
      setupStep: 1,
      setupBusy: false,
      pf: { exam_type: '国考', target_region: '', exam_date: '', target_score: 70, daily_minutes: 60, base_level: '零基础' },
      dateStartTs: Date.now(),
      dateEndTs: Date.now() + 3 * 366 * 86400000,
      pfDateTs: Date.now(),
      dateStartStr: new Date().toISOString().slice(0, 10),
      dateEndStr: new Date(Date.now() + 3 * 366 * 86400000).toISOString().slice(0, 10),
    };
  },
  computed: {
    pfDatePast() { return isExamDatePast(this.pf.exam_date, cnTodayStr()); },
    pfDateText() { return examDateFieldText(this.pf.exam_date, cnTodayStr()); },
  },
  watch: {
    modelValue(v) { if (v) this.initFromProfile(); },
  },
  methods: {
    initFromProfile() {
      const p = this.profile || {};
      this.pf = {
        exam_type: p.exam_type || '国考',
        target_region: p.target_region || '',
        exam_date: p.exam_date || '',
        target_score: p.target_score || 70,
        daily_minutes: p.daily_minutes || 60,
        base_level: p.base_level || '零基础',
      };
      const ts = this.pf.exam_date ? new Date(this.pf.exam_date + 'T12:00:00').getTime() : Date.now();
      this.pfDateTs = Math.min(Math.max(ts, this.dateStartTs), this.dateEndTs);
      this.setupStep = 1;
    },
    beforeExamDate(value, resolve) {
      // confirm 前拦截越界日期：钳回边界并提示，弹层保持打开
      if (value < this.dateStartTs || value > this.dateEndTs) {
        this.pfDateTs = value < this.dateStartTs ? this.dateStartTs : this.dateEndTs;
        uni.showToast({ title: `请选择 ${this.dateStartStr} 至 ${this.dateEndStr} 之间的日期`, icon: 'none', duration: 2500 });
        resolve(false);
        return;
      }
      resolve(true);
    },
    onExamDate({ value }) {
      this.pf.exam_date = this.fmtDateStr(value);
    },
    fmtDateStr(v) {
      const d = new Date(v);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    },
    async setupNext() {
      if (this.setupStep === 1 && !this.pf.exam_date) {
        uni.showToast({ title: '请先选择考试日期', icon: 'none' });
        return;
      }
      if (this.setupStep === 1 && this.pfDatePast) {
        uni.showToast({ title: '考试日期已过，请重新选择', icon: 'none' });
        return;
      }
      if (this.setupStep < 3) {
        this.setupStep++;
        return;
      }
      if (this.setupBusy) return;
      this.setupBusy = true;
      try {
        const d = await request('/api/profile', { method: 'POST', data: { uid: anonUid(), ...this.pf } });
        this.$emit('update:modelValue', false);
        this.$emit('saved', d.profile);
        uni.showToast({ title: '学习计划已生成', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '保存失败：' + e.message, icon: 'none' });
      } finally {
        this.setupBusy = false;
      }
    },
  },
};
</script>

<style scoped>
.setrow { margin-bottom: var(--sp-16); }
.set-k { display: block; font-size: var(--fs-sub); font-weight: 600; color: var(--ink-2); margin-bottom: var(--sp-8); }
.set-kwrap { display: flex; align-items: baseline; gap: var(--sp-8); }
.set-sub { font-size: var(--fs-caption); color: var(--ink-4); font-weight: 400; }
.pf-input { width: 100%; box-sizing: border-box; height: var(--hit-min); padding: 0 var(--sp-12); border-radius: var(--r-sm); background: var(--fill); font-size: var(--fs-body); color: var(--ink); border: none; }
.pf-date { min-height: var(--hit-min); display: flex; align-items: center; padding: 0 var(--sp-12); border-radius: var(--r-sm); background: var(--fill); font-size: var(--fs-body); color: var(--ink); }
.pf-date.empty { color: var(--ink-4); }
.pf-date.past { color: var(--bad-strong); border: 1px solid var(--bad-strong); }
.pf-summary { display: block; font-size: var(--fs-sub); color: var(--ink-2); line-height: var(--lh-sub); padding: var(--sp-12) 0 0; }
.sheet-acts { display: flex; flex-direction: column; gap: var(--sp-8); }
</style>
