<template>
  <view class="wrap">
    <view class="mini card" @click="startMini">
      <text class="mini-ico">⚡</text>
      <view class="mini-l">
        <text class="mini-t">迷你模考</text>
        <text class="mini-s">30 题 · 30 分钟 · 随机组卷，即刻开考</text>
      </view>
      <view class="mini-go">开始</view>
    </view>

    <view v-if="filters.years.length || filters.regions.length" class="filters">
      <scroll-view v-if="filters.years.length" scroll-x class="fscroll">
        <text class="fchip" :class="{ on: !year }" @click="setYear(null)">全部年份</text>
        <text v-for="y in filters.years" :key="y.y" class="fchip" :class="{ on: year === y.y }" @click="setYear(y.y)">{{ y.y }}年</text>
      </scroll-view>
      <scroll-view v-if="filters.regions.length" scroll-x class="fscroll">
        <text class="fchip" :class="{ on: !region }" @click="setRegion(null)">全部地区</text>
        <text v-for="r in filters.regions" :key="r.r" class="fchip" :class="{ on: region === r.r }" @click="setRegion(r.r)">{{ r.r }}</text>
      </scroll-view>
    </view>

    <view v-if="loading" class="spin">试卷加载中…</view>
    <view v-else-if="loadErr" class="spin">加载失败：{{ loadErr }}<view class="retry" @click="load">重试 ›</view></view>
    <view v-else-if="!items.length" class="spin">暂无成套真题卷{{ year || region ? '，试试放宽筛选' : '' }}</view>

    <view class="plist">
    <view v-for="p in items" :key="p.id" class="card paper">
      <view class="paper-top" @click="startPaper(p)">
        <text class="paper-t">{{ p.title }}</text>
        <view class="paper-meta">
          <text v-if="p.year" class="ptag">{{ p.year }}年</text>
          <text v-if="p.region" class="ptag">{{ p.region }}</text>
          <text class="pmeta">{{ p.n }} 题 · {{ p.duration_min }} 分钟{{ p.takers ? ' · ' + p.takers + ' 人考过' : '' }}</text>
        </view>
        <text v-if="p.best_score != null" class="pbest">我的最好成绩 {{ p.best_score }} 分 · 已考 {{ p.attempt_count }} 次</text>
        <text v-else class="pbest none">还没考过，来挑战一下</text>
      </view>
      <view class="paper-btns">
        <view class="pbtn main" @click="startPaper(p)">开始模考</view>
        <view class="pbtn" @click="askExport(p)">{{ exportingId === p.id ? '导出中…' : '导出 PDF' }}</view>
      </view>
    </view>
    </view>

    <export-confirm
      :visible="!!exportTarget"
      :scope="exportTarget ? exportTarget.title : ''"
      :count="exportTarget ? exportTarget.n : null"
      :busy="!!exportingId"
      @close="exportTarget = null"
      @confirm="exportPaper"
    />

    <view v-if="attempts.length" class="card">
      <view class="h">历史成绩</view>
      <view v-for="a in attempts" :key="a.id" class="arow" @click="openReport(a)">
        <view class="arow-l">
          <text class="arow-t">{{ a.title }}</text>
          <text class="arow-s">{{ fmtTime(a.submitted_at) }}</text>
        </view>
        <text class="arow-score">{{ a.score }} 分</text>
      </view>
    </view>
  </view>
</template>

<script>
import { request, anonUid, exportPdf } from '../../api.js';

export default {
  data() {
    return {
      items: [],
      filters: { years: [], regions: [] },
      attempts: [],
      year: null,
      region: null,
      loading: true,
      loadErr: '',
      exportingId: null,
      exportTarget: null,
    };
  },
  created() {
    this._starting = false;
  },
  onShow() {
    this.load();
    this.loadAttempts();
  },
  methods: {
    async load() {
      this.loading = true;
      this.loadErr = '';
      try {
        const q = ['kind=zhenti', 'uid=' + encodeURIComponent(anonUid())];
        if (this.year) q.push('year=' + this.year);
        if (this.region) q.push('region=' + encodeURIComponent(this.region));
        const d = await request('/api/exam/papers?' + q.join('&'));
        this.items = d.items || [];
        this.filters = d.filters || { years: [], regions: [] };
      } catch (e) {
        this.loadErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async loadAttempts() {
      try {
        const d = await request('/api/exam/attempts?uid=' + encodeURIComponent(anonUid()) + '&limit=10');
        this.attempts = d.items || [];
      } catch (e) { /* 非关键路径 */ }
    },
    setYear(y) { this.year = y; this.load(); },
    setRegion(r) { this.region = r; this.load(); },
    startPaper(p) {
      if (this._starting) return;
      uni.navigateTo({ url: '/pkgA/exam/exam?paper_id=' + p.id });
    },
    startMini() {
      uni.navigateTo({ url: '/pkgA/exam/exam?mini=1' });
    },
    openReport(a) {
      uni.navigateTo({ url: '/pkgA/exam/report?attempt_id=' + a.id });
    },
    fmtTime(t) {
      const d = new Date(t * 1000);
      return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },
    askExport(p) {
      if (this.exportingId) return;
      this.exportTarget = p;
    },
    async exportPaper(opts) {
      const p = this.exportTarget;
      if (!p || this.exportingId) return;
      this.exportingId = p.id;
      try {
        const d = await request('/api/exam/papers/' + p.id);
        await exportPdf({
          title: p.title,
          question_ids: d.paper.question_ids,
          ...opts,
        });
        this.exportTarget = null;
        uni.showToast({ title: 'PDF 已开始下载', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '导出失败：' + e.message, icon: 'none' });
      }
      this.exportingId = null;
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 600; margin-bottom: 20rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 40rpx 24rpx; }
.retry { margin-top: 12rpx; color: var(--brand); font-size: 26rpx; font-weight: 500; }
.mini { display: flex; align-items: center; gap: 20rpx; background: linear-gradient(135deg, var(--warn-soft), var(--card)); border: 1rpx solid var(--line); }
.mini-ico { flex-shrink: 0; font-size: 48rpx; }
.mini-l { flex: 1; min-width: 0; }
.mini-t { display: block; font-size: 30rpx; font-weight: 700; color: var(--ink); }
.mini-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 6rpx; }
.mini-go { flex-shrink: 0; background: var(--brand); color: #fff; border-radius: 999rpx; padding: 0 36rpx; min-height: 38px; line-height: 38px; font-size: 26rpx; font-weight: 600; }
.filters { margin-bottom: 20rpx; }
.fscroll { white-space: nowrap; margin-bottom: 12rpx; }
.fchip { display: inline-flex; align-items: center; min-height: 44px; box-sizing: border-box; font-size: 24rpx; color: var(--ink-2); background: var(--card); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 0 26rpx; margin-right: 12rpx; }
.fchip.on { color: #fff; background: var(--brand); border-color: var(--brand); font-weight: 600; }
.paper-top { min-height: 44px; }
.paper-t { font-size: 29rpx; font-weight: 600; color: var(--ink); line-height: 1.5; }
.paper-meta { display: flex; align-items: center; gap: 12rpx; margin-top: 10rpx; flex-wrap: wrap; }
.ptag { font-size: 21rpx; color: var(--brand); background: var(--brand-soft); border-radius: 8rpx; padding: 4rpx 14rpx; }
.pmeta { font-size: 23rpx; color: var(--ink-2); }
.pbest { display: block; font-size: 22rpx; color: var(--warn); margin-top: 10rpx; }
.pbest.none { color: var(--ink-2); }
.paper-btns { display: flex; gap: 16rpx; margin-top: 20rpx; }
.pbtn { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--brand); color: var(--brand); border-radius: 999rpx; font-size: 25rpx; font-weight: 500; }
.pbtn.main { background: var(--brand); color: #fff; border-color: var(--brand); }
.arow { display: flex; justify-content: space-between; align-items: center; min-height: 44px; padding: 12rpx 0; border-bottom: 1rpx solid var(--line); }
.arow:last-child { border-bottom: none; }
.arow-l { flex: 1; min-width: 0; margin-right: 16rpx; }
.arow-t { display: block; font-size: 25rpx; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arow-s { display: block; font-size: 21rpx; color: var(--ink-2); margin-top: 4rpx; }
.arow-score { flex-shrink: 0; font-size: 28rpx; font-weight: 700; color: var(--brand); }

/* 桌面网格（仅 H5 ≥1024px） */
/* #ifdef H5 */
@media (min-width: 1024px) {
  .wrap { max-width: 1044px !important; margin: 0 auto; }
  .plist { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24rpx; align-items: stretch; margin-bottom: 24rpx; }
  .plist .paper { margin-bottom: 0; display: flex; flex-direction: column; }
  .plist .paper .paper-top { flex: 1; }
}
/* #endif */
</style>
