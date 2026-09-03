<template>
  <view class="wrap">
    <view v-if="resume" class="card resume">
      <view class="resume-l">
        <text class="resume-t">未交卷：{{ resume.title }}</text>
        <text class="resume-s">已答 {{ resume.answered }}/{{ resume.total }} 题 · 剩余 {{ fmtLeft(resume.leftSecs) }}</text>
      </view>
      <view class="resume-btns">
        <view class="pbtn main rbtn" @click="continueExam">继续模考</view>
        <view class="pbtn rbtn" role="button" aria-label="放弃未交卷进度" @click="dropResume">放弃</view>
      </view>
    </view>

    <view class="mini card" @click="startMini">
      <text class="mini-ico">⚡</text>
      <view class="mini-l">
        <text class="mini-t">迷你模考</text>
        <text class="mini-s">30 题 · 30 分钟 · 随机组卷，即刻开考</text>
      </view>
      <view class="mini-go">开始</view>
    </view>

    <view v-if="prog.total > 0" class="card progcard">
      <view class="prog-row">
        <text class="prog-t">{{ prog.done === prog.total ? '全部刷完 🎉' : '已刷 ' + prog.done + '/' + prog.total + ' 卷' }}</text>
        <text class="prog-p">{{ prog.pct }}%</text>
      </view>
      <view class="prog-bar" role="progressbar" :aria-valuenow="prog.pct" aria-valuemin="0" aria-valuemax="100" :aria-label="'已刷 ' + prog.done + '/' + prog.total + ' 卷'">
        <view class="prog-fill" :style="{ width: prog.pct + '%' }" />
      </view>
    </view>

    <view v-if="filters.years.length || filters.regions.length" class="filters">
      <scroll-view scroll-x class="fscroll">
        <text class="fchip" :class="{ on: !st }" @click="setSt('')">全部</text>
        <text class="fchip" :class="{ on: st === 'todo' }" @click="setSt('todo')">没考过 {{ prog.total - prog.done }}</text>
        <text class="fchip" :class="{ on: st === 'done' }" @click="setSt('done')">考过的 {{ prog.done }}</text>
      </scroll-view>
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
    <view v-else-if="!shown.length" class="spin">暂无成套真题卷{{ year || region || st ? '，试试放宽筛选' : '' }}</view>

    <view class="plist">
    <view v-for="p in shown" :key="p.id" :id="'paper-' + p.id" class="card paper" :class="{ pinned: p.id === pinnedId }">
      <view class="paper-top" @click="startPaper(p)">
        <text v-if="p.id === pinnedId" class="pin-badge">邀你挑战的卷</text>
        <text class="paper-t">{{ p.title }}</text>
        <view class="paper-meta">
          <text v-if="p.year" class="ptag">{{ p.year }}年</text>
          <text v-if="p.region" class="ptag">{{ p.region }}</text>
          <text class="pmeta">{{ p.n }} 题 · {{ p.duration_min }} 分钟{{ p.takers ? ' · ' + p.takers + ' 人考过' + (p.avg_score != null ? ' · 平均 ' + p.avg_score + ' 分' : '') : '' }}</text>
        </view>
        <text v-if="p.best_score != null" class="pbest">我的最好成绩 {{ p.best_score }} 分 · 已考 {{ p.attempt_count }} 次</text>
        <text v-else class="pbest none">还没考过，来挑战一下</text>
        <text v-if="p.psource && p.practiced" class="ppracticed">已练 {{ p.practiced }}/{{ p.n }} 题</text>
      </view>
      <view class="paper-btns">
        <view class="pbtn main" @click="startPaper(p)">开始模考</view>
        <view v-if="p.psource" class="pbtn" @click="practicePaper(p)">按卷练习</view>
        <view v-if="p.best_attempt_id" class="pbtn" @click="openBestReport(p)">看报告</view>
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
import { request, snapPeek, anonUid, exportPdf } from '../../api.js';
import { buildExamListUrl, parseExamListOpts } from '../../exam-list-url.js';
import { parseExamProgress, fmtLeftSecs } from '../../exam-resume.js';
import { filterPapersByStatus } from '../../exam-list-status.js';
import { paperProgress } from '../../exam-list-progress.js';
import { adoptServerExamProgress } from '../../exam-progress-sync.js';

export default {
  data() {
    return {
      items: [],
      filters: { years: [], regions: [] },
      attempts: [],
      year: null,
      region: null,
      st: '',
      loading: true,
      loadErr: '',
      exportingId: null,
      exportTarget: null,
      pinnedId: 0,
      resume: null,
    };
  },
  created() {
    this._starting = false;
  },
  computed: {
    shown() {
      return filterPapersByStatus(this.items, this.st);
    },
    prog() {
      return paperProgress(this.items);
    },
  },
  onLoad(opts) {
    const p = parseExamListOpts(opts);
    this._pendingFilter = p;
    this._pendingPid = p.pid;
    if (p.st) {
      this.st = p.st;
      this.syncUrl();
    }
  },
  onShow() {
    this.load();
    this.loadAttempts();
    this.loadResume();
  },
  methods: {
    async load() {
      this.loadErr = '';
      const q = ['kind=zhenti', 'uid=' + encodeURIComponent(anonUid())];
      if (this.year) q.push('year=' + this.year);
      if (this.region) q.push('region=' + encodeURIComponent(this.region));
      const p = '/api/exam/papers?' + q.join('&');
      // 快照即显：uid 请求绕过公开边缘缓存，长尾下先用最近成功快照铺屏，真实响应到达后覆盖
      const snap = snapPeek(p);
      if (snap) {
        this.items = snap.items || [];
        this.filters = snap.filters || { years: [], regions: [] };
      }
      this.loading = !snap;
      try {
        const d = await request(p);
        this.items = d.items || [];
        this.filters = d.filters || { years: [], regions: [] };
        if (this.applyPendingFilter()) return;
        this.applyPendingPin();
      } catch (e) {
        this.loadErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async loadAttempts() {
      const p = '/api/exam/attempts?uid=' + encodeURIComponent(anonUid()) + '&limit=10';
      const snap = snapPeek(p);
      if (snap) this.attempts = snap.items || [];
      try {
        const d = await request(p);
        this.attempts = d.items || [];
      } catch (e) { /* 非关键路径 */ }
    },
    // 入向深链：filters 真实返回后按白名单应用一次（非法忽略），应用则重拉列表
    applyPendingFilter() {
      const p = this._pendingFilter;
      if (!p) return false;
      this._pendingFilter = null;
      const y = p.year && (this.filters.years || []).some((o) => o.y === p.year) ? p.year : null;
      const r = p.region && (this.filters.regions || []).some((o) => o.r === p.region) ? p.region : null;
      if (!y && !r) return false;
      if (y) this.year = y;
      if (r) this.region = r;
      this.syncUrl();
      this.load();
      return true;
    },
    // 入向定位深链：列表真实返回后若含目标卷则高亮定位一次（列表不含时静默忽略）
    applyPendingPin() {
      const pid = this._pendingPid;
      if (!pid) return;
      this._pendingPid = 0;
      if (!this.shown.some((p) => p.id === pid)) return;
      this.pinnedId = pid;
      // #ifdef H5
      this.$nextTick(() => {
        if (typeof document !== 'undefined') {
          const el = document.getElementById('paper-' + pid);
          if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
        }
      });
      // #endif
    },
    loadResume() {
      const saved = uni.getStorageSync('examProgress');
      this.resume = parseExamProgress(saved, Date.now());
      if (saved && saved.attemptId && !this.resume) uni.removeStorageSync('examProgress');
      if (!this.resume) this.syncResume();
    },
    async syncResume() {
      const clearedAt = uni.getStorageSync('erClearedAt');
      if (clearedAt && Date.now() - clearedAt < 30 * 1000) return;
      try {
        const d = await request('/api/exam/resume?uid=' + encodeURIComponent(anonUid()));
        const now = Date.now();
        const snap = adoptServerExamProgress(uni.getStorageSync('examProgress'), d, now);
        if (!snap) return;
        uni.setStorageSync('examProgress', snap);
        this.resume = parseExamProgress(snap, now);
      } catch (e) { /* 非关键路径 */ }
    },
    continueExam() {
      const r = this.resume;
      if (!r) return;
      uni.navigateTo({ url: r.mini ? '/pkgA/exam/exam?mini=1' : '/pkgA/exam/exam?paper_id=' + r.paperId });
    },
    dropResume() {
      uni.showModal({
        title: '放弃未交卷进度？',
        content: '放弃后本次作答记录不再保留',
        confirmText: '放弃', cancelText: '再想想',
        success: (res) => {
          if (!res.confirm) return;
          uni.setStorageSync('erClearedAt', Date.now());
          if (this.resume && this.resume.attemptId) {
            request('/api/exam/progress', { method: 'POST', data: { uid: anonUid(), attempt_id: this.resume.attemptId, drop: true } }).catch(() => {});
          }
          uni.removeStorageSync('examProgress');
          this.resume = null;
        },
      });
    },
    fmtLeft(s) { return fmtLeftSecs(s); },
    syncUrl() {
      // #ifdef H5
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', buildExamListUrl({ year: this.year, region: this.region, st: this.st }));
      }
      // #endif
    },
    setYear(y) { this.year = y; this.pinnedId = 0; this.syncUrl(); this.load(); },
    setRegion(r) { this.region = r; this.pinnedId = 0; this.syncUrl(); this.load(); },
    setSt(s) { this.st = s; this.pinnedId = 0; this.syncUrl(); },
    startPaper(p) {
      if (this._starting) return;
      uni.navigateTo({ url: '/pkgA/exam/exam?paper_id=' + p.id });
    },
    practicePaper(p) {
      // 不计时逐题练习，复用刷题页既有按卷练习协议
      uni.setStorageSync('practiceLaunch', { kind: 'paper', source: p.psource, title: p.title, untimed: true });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    openBestReport(p) {
      uni.navigateTo({ url: '/pkgA/exam/report?attempt_id=' + p.best_attempt_id });
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
.retry { margin-top: 12rpx; color: var(--brand-text); font-size: 26rpx; font-weight: 500; }
.mini { display: flex; align-items: center; gap: 20rpx; background: linear-gradient(135deg, var(--warn-soft), var(--card)); border: 1rpx solid var(--line); }
.mini-ico { flex-shrink: 0; font-size: 48rpx; }
.mini-l { flex: 1; min-width: 0; }
.mini-t { display: block; font-size: 30rpx; font-weight: 700; color: var(--ink); }
.mini-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 6rpx; }
.mini-go { flex-shrink: 0; background: var(--brand); color: #fff; border-radius: 999rpx; padding: 0 36rpx; min-height: 38px; line-height: 38px; font-size: 26rpx; font-weight: 600; }
.progcard { padding: 22rpx 28rpx; }
.prog-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.prog-t { font-size: 25rpx; font-weight: 600; color: var(--ink); }
.prog-p { font-size: 23rpx; font-weight: 600; color: var(--brand-text); }
.prog-bar { height: 12rpx; background: var(--brand-soft); border-radius: 999rpx; overflow: hidden; }
.prog-fill { height: 100%; min-width: 4rpx; background: var(--brand); border-radius: 999rpx; }
.filters { margin-bottom: 20rpx; }
.fscroll { white-space: nowrap; margin-bottom: 12rpx; }
.fchip { display: inline-flex; align-items: center; min-height: 44px; box-sizing: border-box; font-size: 24rpx; color: var(--ink-2); background: var(--card); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 0 26rpx; margin-right: 12rpx; }
.fchip.on { color: #fff; background: var(--brand); border-color: var(--brand-text); font-weight: 600; }
.paper-top { min-height: 44px; }
.paper.pinned { border-color: var(--brand); box-shadow: 0 4rpx 20rpx rgba(37, 99, 235, 0.18); }
.pin-badge { display: inline-block; font-size: 21rpx; color: #fff; background: var(--brand); border-radius: 8rpx; padding: 4rpx 14rpx; margin-bottom: 10rpx; }
.paper-t { font-size: 29rpx; font-weight: 600; color: var(--ink); line-height: 1.5; }
.paper-meta { display: flex; align-items: center; gap: 12rpx; margin-top: 10rpx; flex-wrap: wrap; }
.ptag { font-size: 21rpx; color: var(--brand-text); background: var(--brand-soft); border-radius: 8rpx; padding: 4rpx 14rpx; }
.pmeta { font-size: 23rpx; color: var(--ink-2); }
.pbest { display: block; font-size: 22rpx; color: var(--warn); margin-top: 10rpx; }
.pbest.none { color: var(--ink-2); }
.ppracticed { display: block; font-size: 22rpx; color: var(--ok-strong); margin-top: 6rpx; }
.paper-btns { display: flex; gap: 16rpx; margin-top: 20rpx; }
.pbtn { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--brand); color: var(--brand-text); border-radius: 999rpx; font-size: 25rpx; font-weight: 500; }
.pbtn.main { background: var(--brand); color: #fff; border-color: var(--brand-text); }
.arow { display: flex; justify-content: space-between; align-items: center; min-height: 44px; padding: 12rpx 0; border-bottom: 1rpx solid var(--line); }
.arow:last-child { border-bottom: none; }
.arow-l { flex: 1; min-width: 0; margin-right: 16rpx; }
.arow-t { display: block; font-size: 25rpx; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arow-s { display: block; font-size: 21rpx; color: var(--ink-2); margin-top: 4rpx; }
.arow-score { flex-shrink: 0; font-size: 28rpx; font-weight: 700; color: var(--brand-text); }
.resume { display: flex; align-items: center; gap: 20rpx; border-color: var(--brand); }
.resume-l { flex: 1; min-width: 0; }
.resume-t { display: block; font-size: 27rpx; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resume-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 6rpx; }
.resume-btns { flex-shrink: 0; display: flex; gap: 12rpx; }
.rbtn { flex: none; padding: 0 26rpx; }

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
