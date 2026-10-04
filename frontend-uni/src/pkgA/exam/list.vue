<template>
  <view class="page">
    <kg-two-col>
      <template #main>
        <kg-card v-if="resume" variant="flat" class="resume" selected>
          <view class="resume-l">
            <text class="resume-t">未交卷：{{ resume.title }}</text>
            <text class="resume-s">已答 {{ resume.answered }}/{{ resume.total }} 题 · 剩余 <text class="num">{{ fmtLeft(resume.leftSecs) }}</text></text>
          </view>
          <view class="resume-btns">
            <kg-button size="md" @click="continueExam">继续模考</kg-button>
            <kg-button size="md" variant="text" tone="bad" aria-label="放弃未交卷进度" @click="dropResume">放弃</kg-button>
          </view>
        </kg-card>

        <kg-card variant="raised" class="mini">
          <view class="mini-ico"><l-icon name="zap" :size="24" tone="warn" /></view>
          <view class="mini-l">
            <text class="mini-t">组卷模考</text>
            <text class="mini-s">按省份卷型快速组卷 · 可加薄弱考点权重</text>
          </view>
          <kg-button size="md" @click="openTpl">组卷</kg-button>
        </kg-card>

        <view v-if="prog.total > 0" class="progrow">
          <view class="prog-txt">
            <text class="prog-t">{{ prog.done === prog.total ? '全部刷完 🎉' : '已刷 ' + prog.done + '/' + prog.total + ' 卷' }}</text>
            <text class="prog-p num">{{ prog.pct }}%</text>
          </view>
          <kg-progress :value="prog.done" :max="prog.total" :aria-label="'已刷 ' + prog.done + '/' + prog.total + ' 卷'" />
        </view>

        <view class="kinds">
          <wd-segmented ref="seg" :value="kindLabel" :options="KIND_LABELS" size="small" @change="onKind" />
        </view>

        <view v-if="filters.years.length || filters.regions.length" class="filters">
          <wd-segmented ref="seg" :value="stLabel" :options="ST_LABELS" size="small" @change="onSt" />
          <kg-chip-row v-if="filters.years.length" :options="yearOpts" :model-value="year == null ? '' : year" @update:model-value="setYear($event === '' ? null : $event)" />
          <kg-chip-row v-if="filters.regions.length" class="region-row" :options="regionOpts" :model-value="region || ''" :scroll-to-selected="false" @update:model-value="setRegion($event || null)" />
        </view>

        <kg-skeleton v-if="loading" preset="cards" />
        <kg-empty-state
          v-else-if="loadErr"
          icon="wifi-off"
          title="试卷加载失败"
          :desc="loadErr"
          cta-text="重试"
          @cta="load"
        />
        <kg-empty-state
          v-else-if="!shown.length"
          icon="inbox"
          :title="kind === 'mokao' ? '暂无模考卷' : '暂无成套真题卷'"
          :desc="year || region || st ? '试试放宽筛选条件' : (kind === 'mokao' ? '模考大赛卷持续录入中' : '真题卷持续录入中，先来一场迷你模考')"
          :cta-text="year || region || st ? '清除筛选' : '迷你模考'"
          @cta="year || region || st ? clearFilters() : startMini()"
        />

        <view v-else class="plist">
          <kg-card v-for="p in visible" :key="p.id" :id="'paper-' + p.id" variant="flat" class="paper" :selected="p.id === pinnedId">
            <view class="paper-top" role="button" @click="startPaper(p)">
              <kg-tag v-if="p.id === pinnedId" tone="brand">邀你挑战的卷</kg-tag>
              <text class="paper-t">{{ p.title }}</text>
              <text v-if="modsText(p)" class="pmods">{{ modsText(p) }}</text>
              <view class="paper-meta">
                <kg-tag v-if="p.year" tone="neutral">{{ p.year }}年</kg-tag>
                <kg-tag v-if="p.region" tone="neutral">{{ p.region }}</kg-tag>
                <text class="pmeta">{{ p.n }} 题 · {{ p.duration_min }} 分钟{{ p.takers ? ' · ' + p.takers + ' 人考过' + (p.avg_score != null ? ' · 平均 ' + p.avg_score + ' 分' : '') : '' }}</text>
              </view>
              <text v-if="p.best_score != null" class="pbest">我的最好成绩 <text class="num">{{ p.best_score }}</text> 分 · 已考 {{ p.attempt_count }} 次</text>
              <text v-else class="pbest none">还没考过，来挑战一下</text>
              <text v-if="p.psource && practicedState(p).show" class="ppracticed" :class="{ done: practicedState(p).done }">{{ practicedState(p).text }}</text>
            </view>
            <template #footer>
              <view class="paper-btns">
                <kg-button size="md" class="paper-main" @click="startPaper(p)">开始模考</kg-button>
                <view class="more" role="button" :aria-label="'更多操作：' + p.title" hover-class="more--hover" @click="openMenu(p)">
                  <l-icon name="ellipsis" :size="24" tone="ink-2" />
                </view>
              </view>
            </template>
          </kg-card>
        </view>

        <view v-if="!loading && !loadErr && visible.length < shown.length" class="more-row">
          <kg-button variant="ghost" size="lg" block @click="pageN += 1">加载更多（还有 {{ shown.length - visible.length }} 卷）</kg-button>
        </view>

        <export-confirm
          :visible="!!exportTarget"
          :scope="exportTarget ? exportTarget.title : ''"
          :count="exportTarget ? exportTarget.n : null"
          :busy="!!exportingId"
          @close="exportTarget = null"
          @confirm="exportPaper"
        />

        <kg-card v-if="attempts.length" variant="flat" class="hist">
          <text class="h">历史成绩</text>
          <view v-for="a in attempts" :key="a.id" class="arow" role="button" hover-class="arow--hover" @click="openReport(a)">
            <view class="arow-l">
              <text class="arow-t">{{ a.title }}</text>
              <text class="arow-s">{{ fmtTime(a.submitted_at) }}</text>
            </view>
            <text class="arow-score num">{{ a.score }} 分</text>
            <l-icon name="chevron-right" :size="16" tone="faint" />
          </view>
        </kg-card>
      </template>

      <!-- #ifdef H5 -->
      <template #aside>
        <kg-card v-if="filters.regions.length" variant="flat">
          <text class="h">按地区</text>
          <view class="rg-wrap">
            <view class="rg" :class="{ on: !region }" role="radio" :aria-checked="!region ? 'true' : 'false'" @click="setRegion(null)">全部地区</view>
            <view v-for="r in filters.regions" :key="r.r" class="rg" :class="{ on: region === r.r }" role="radio" :aria-checked="region === r.r ? 'true' : 'false'" @click="setRegion(r.r)">{{ r.r }}</view>
          </view>
        </kg-card>
      </template>
      <!-- #endif -->
    </kg-two-col>

    <kg-sheet v-model="menuOpen" :title="menuPaper ? menuPaper.title : ''">
      <view v-if="menuPaper" class="menu">
        <view v-if="menuPaper.psource" class="menu-it" role="button" hover-class="menu-it--hover" @click="menuGo(practicePaper)">
          <l-icon name="pencil-line" :size="20" tone="ink-2" /><text>按卷练习（不计时）</text>
        </view>
        <view v-if="menuPaper.best_attempt_id" class="menu-it" role="button" hover-class="menu-it--hover" @click="menuGo(openBestReport)">
          <l-icon name="chart-column" :size="20" tone="ink-2" /><text>看最好成绩报告</text>
        </view>
        <view class="menu-it" role="button" hover-class="menu-it--hover" @click="menuGo(askExport)">
          <l-icon name="file-text" :size="20" tone="ink-2" /><text>{{ exportingId === menuPaper.id ? '导出中…' : '导出 PDF' }}</text>
        </view>
      </view>
    </kg-sheet>

    <kg-sheet v-model="tplOpen" title="组卷模考">
      <kg-skeleton v-if="tplLoading" preset="lines" />
      <view v-else>
        <view v-for="t in templates" :key="t.id" class="tpl-it" :class="{ on: tplId === t.id }" role="radio" :aria-checked="tplId === t.id ? 'true' : 'false'" @click="tplId = t.id">
          <view class="tpl-l">
            <text class="tpl-t">{{ t.name }}</text>
            <text v-if="t.note" class="tpl-s">{{ t.note }}</text>
          </view>
          <text class="tpl-n num">{{ t.n }} 题 · {{ t.duration_min }} 分</text>
        </view>
        <view class="boost-row">
          <view class="boost-l">
            <text class="boost-t">薄弱考点加权</text>
            <text class="boost-s">优先抽你最近易错的考点</text>
          </view>
          <wd-switch v-model="weakBoost" size="small" />
        </view>
      </view>
      <template #footer>
        <view class="sheet-acts">
          <kg-button variant="primary" size="lg" block :disabled="tplLoading || !templates.length" @click="tplStart">开考</kg-button>
        </view>
      </template>
    </kg-sheet>

    <kg-sheet :model-value="!!exportDone" title="试卷已导出" @update:model-value="(v) => { if (!v) exportDone = null; }">
      <view v-if="exportDone" class="done">
        <text class="done-t">{{ exportDone.title }}</text>
        <view class="done-code">
          <text class="done-k">本卷回填码</text>
          <text class="done-c num">{{ exportDone.code }}</text>
        </view>
        <text class="done-s">纸质作答后：拍答题卡自动判分，或按码手动录入答案</text>
      </view>
      <template #footer>
        <view class="sheet-acts">
          <kg-button variant="primary" size="lg" block @click="onGoScan">拍答题卡判分</kg-button>
          <kg-button variant="secondary" size="md" block @click="onGoFill">按卷码手录答案</kg-button>
        </view>
      </template>
    </kg-sheet>
  </view>
</template>

<script>
import { request, snapPeek, anonUid, exportPdf } from '../../api.js';
import { buildExamListUrl, parseExamListOpts } from '../../exam-list-url.js';
import { parseExamProgress, fmtLeftSecs } from '../../exam-resume.js';
import { filterPapersByStatus } from '../../exam-list-status.js';
import { paperProgress } from '../../exam-list-progress.js';
import { adoptServerExamProgress } from '../../exam-progress-sync.js';
import { paperPracticedState } from '../../paper-continue.js';
import { paperModsText } from '../../exam-paper-mods.js';
import { segResizeMixin } from '../../seg-resize.js';

const PAGE = 20;
const ST_LABELS = ['全部', '没考过', '考过的'];
const ST_VALUES = ['', 'todo', 'done'];
const KIND_LABELS = ['真题卷', '模考大赛'];
const KIND_VALUES = ['zhenti', 'mokao'];

export default {
  mixins: [segResizeMixin],
  data() {
    return {
      items: [],
      filters: { years: [], regions: [] },
      attempts: [],
      kind: 'zhenti',
      year: null,
      region: null,
      st: '',
      loading: true,
      loadErr: '',
      exportingId: null,
      exportTarget: null,
      pinnedId: 0,
      resume: null,
      pageN: 1,
      menuOpen: false,
      menuPaper: null,
      tplOpen: false,
      templates: [],
      tplLoading: false,
      tplId: 'mini',
      weakBoost: false,
      exportDone: null,
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
    visible() {
      return this.shown.slice(0, this.pageN * PAGE);
    },
    ST_LABELS() { return ST_LABELS; },
    stLabel() { return ST_LABELS[Math.max(0, ST_VALUES.indexOf(this.st))]; },
    kindLabel() { return KIND_LABELS[Math.max(0, KIND_VALUES.indexOf(this.kind))]; },
    KIND_LABELS() { return KIND_LABELS; },
    yearOpts() {
      return [{ value: '', label: '全部年份' }].concat(this.filters.years.map((y) => ({ value: y.y, label: y.y + '年' })));
    },
    regionOpts() {
      return [{ value: '', label: '全部地区' }].concat(this.filters.regions.map((r) => ({ value: r.r, label: r.r })));
    },
  },
  onReachBottom() {
    if (this.visible.length < this.shown.length) this.pageN += 1;
  },
  onLoad(opts) {
    const p = parseExamListOpts(opts);
    this._pendingFilter = p;
    this._pendingPid = p.pid;
    this.kind = p.kind;
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
      const q = ['kind=' + this.kind, 'uid=' + encodeURIComponent(anonUid())];
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
      const at = this.shown.findIndex((p) => p.id === pid);
      if (at < 0) return;
      this.pinnedId = pid;
      this.pageN = Math.max(this.pageN, Math.floor(at / PAGE) + 1);
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
        window.history.replaceState(null, '', buildExamListUrl({ year: this.year, region: this.region, st: this.st, kind: this.kind }));
      }
      // #endif
    },
    setYear(y) { this.year = y; this.pinnedId = 0; this.pageN = 1; this.syncUrl(); this.load(); },
    setRegion(r) { this.region = r; this.pinnedId = 0; this.pageN = 1; this.syncUrl(); this.load(); },
    setSt(s) { this.st = s; this.pinnedId = 0; this.pageN = 1; this.syncUrl(); },
    onSt(e) {
      const i = ST_LABELS.indexOf(e && e.value);
      this.setSt(i > 0 ? ST_VALUES[i] : '');
    },
    onKind(e) {
      const i = KIND_LABELS.indexOf(e && e.value);
      const k = i > 0 ? KIND_VALUES[i] : 'zhenti';
      if (k === this.kind) return;
      this.kind = k;
      this.year = null;
      this.region = null;
      this.st = '';
      this.pinnedId = 0;
      this.pageN = 1;
      this.syncUrl();
      this.load();
    },
    clearFilters() {
      this.st = '';
      this.year = null;
      this.region = null;
      this.pinnedId = 0;
      this.pageN = 1;
      this.syncUrl();
      this.load();
    },
    openMenu(p) {
      this.menuPaper = p;
      this.menuOpen = true;
    },
    menuGo(fn) {
      const p = this.menuPaper;
      this.menuOpen = false;
      if (p) fn.call(this, p);
    },
    startPaper(p) {
      if (this._starting) return;
      uni.navigateTo({ url: '/pkgA/exam/exam?paper_id=' + p.id });
    },
    modsText(p) {
      return paperModsText(p && p.mods);
    },
    practicedState(p) {
      return paperPracticedState(p.practiced, p.n, p.wrong);
    },
    practicePaper(p) {
      // 不计时逐题练习，复用刷题页既有按卷练习协议
      uni.setStorageSync('practiceLaunch', { kind: 'paper', source: p.psource, pid: p.id, title: p.title, untimed: true });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    openBestReport(p) {
      uni.navigateTo({ url: '/pkgA/exam/report?attempt_id=' + p.best_attempt_id });
    },
    startMini() {
      uni.navigateTo({ url: '/pkgA/exam/exam?mini=1' });
    },
    openTpl() {
      this.tplOpen = true;
      if (this.templates.length || this.tplLoading) return;
      this.tplLoading = true;
      request('/api/exam/templates')
        .then((d) => { this.templates = (d && d.items) || []; })
        .catch(() => { this.tplOpen = false; this.startMini(); })
        .finally(() => { this.tplLoading = false; });
    },
    tplStart() {
      const id = this.tplId || 'mini';
      this.tplOpen = false;
      uni.navigateTo({ url: '/pkgA/exam/exam?template=' + encodeURIComponent(id) + (this.weakBoost ? '&boost=1' : '') });
    },
    onGoFill() {
      const code = this.exportDone && this.exportDone.code;
      this.exportDone = null;
      if (code) uni.setStorageSync('bookManualCode', code);
      uni.switchTab({ url: '/pages/book/book' });
    },
    onGoScan() {
      this.exportDone = null;
      uni.setStorageSync('bookAutoScan', true);
      uni.switchTab({ url: '/pages/book/book' });
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
        const last = (uni.getStorageSync('recentPapers') || [])[0];
        if (last && last.code) {
          this.exportDone = { code: last.code, title: p.title };
        } else {
          uni.showToast({ title: 'PDF 已开始下载', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '导出失败：' + e.message, icon: 'none' });
      }
      this.exportingId = null;
    },
  },
};
</script>

<style scoped>
.page { padding: var(--sp-16) var(--page-x) var(--sp-40); }
.h { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); margin-bottom: var(--sp-12); }
.resume { display: flex; align-items: center; gap: var(--sp-12); margin-bottom: var(--card-gap); }
.resume-l { flex: 1; min-width: 0; }
.resume-t { display: block; font-size: var(--fs-body); font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resume-s { display: block; font-size: var(--fs-sub); color: var(--ink-3); margin-top: var(--sp-4); }
.resume-btns { flex-shrink: 0; display: flex; flex-direction: column; align-items: stretch; gap: var(--sp-4); }
.mini { display: flex; align-items: center; gap: var(--sp-12); margin-bottom: var(--card-gap); }
.mini-ico { flex-shrink: 0; width: 40px; height: 40px; border-radius: var(--r-full); background: var(--warn-soft); display: flex; align-items: center; justify-content: center; }
.mini-l { flex: 1; min-width: 0; }
.mini-t { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.mini-s { display: block; font-size: var(--fs-sub); color: var(--ink-3); margin-top: var(--sp-4); }
.progrow { padding: var(--sp-4) 0 var(--sp-16); }
.kinds { margin-bottom: var(--sp-16); }
.prog-txt { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-8); }
.prog-t { font-size: var(--fs-sub); font-weight: 500; color: var(--ink); }
.prog-p { font-size: var(--fs-sub); color: var(--brand-text); }
.filters { display: flex; flex-direction: column; gap: var(--sp-12); margin-bottom: var(--sp-16); }
.plist { display: flex; flex-direction: column; gap: var(--card-gap); }
.plist .paper + .paper { margin-top: 0; }
.paper-top { min-height: var(--hit-min); display: flex; flex-direction: column; gap: var(--sp-8); align-items: flex-start; }
.paper-t { font-size: var(--fs-body); font-weight: 600; color: var(--ink); line-height: var(--lh-body); }
.paper-meta { display: flex; align-items: center; gap: var(--sp-8); flex-wrap: wrap; }
.pmeta { font-size: var(--fs-sub); color: var(--ink-3); }
.pmods { display: block; width: 100%; font-size: var(--fs-sub); color: var(--ink-3); }
.pbest { font-size: var(--fs-sub); color: var(--warn-strong); }
.pbest.none { color: var(--ink-3); }
.ppracticed { font-size: var(--fs-sub); color: var(--ok-strong); }
.ppracticed.done { color: var(--brand-text); font-weight: 500; }
.paper-btns { display: flex; align-items: center; gap: var(--sp-8); }
.paper-main { flex: 1; }
.paper-btns :deep(.kg-btn) { flex: 1; }
.more { flex-shrink: 0; width: var(--hit-min); height: var(--hit-min); border-radius: var(--r-full); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; }
.more--hover { background: var(--fill); }
.more-row { margin-top: var(--sp-16); }
.hist { margin-top: var(--sp-24); }
.arow { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--cell-h); padding: var(--sp-8) 0; border-bottom: 1px solid var(--line); }
.arow:last-child { border-bottom: none; padding-bottom: 0; }
.arow--hover { background: var(--fill); }
.arow-l { flex: 1; min-width: 0; }
.arow-t { display: block; font-size: var(--fs-body); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arow-s { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }
.arow-score { flex-shrink: 0; font-size: var(--fs-h3); color: var(--brand-text); }
.menu { display: flex; flex-direction: column; }
.menu-it { display: flex; align-items: center; gap: var(--sp-12); min-height: var(--cell-h); font-size: var(--fs-body); color: var(--ink); border-bottom: 1px solid var(--line); }
.menu-it:last-child { border-bottom: none; }
.menu-it--hover { background: var(--fill); }
.rg-wrap { display: flex; flex-wrap: wrap; gap: var(--sp-8); }
.rg { display: inline-flex; align-items: center; height: var(--chip-h); padding: 0 var(--sp-12); border-radius: var(--r-full); border: 1px solid var(--line); background: var(--card); color: var(--ink-2); font-size: var(--fs-sub); }
.rg.on { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.tpl-it { display: flex; align-items: center; gap: var(--sp-12); min-height: var(--cell-h); padding: var(--sp-8) 0; border-bottom: 1px solid var(--line); }
.tpl-it:last-of-type { border-bottom: none; }
.tpl-l { flex: 1; min-width: 0; }
.tpl-t { display: block; font-size: var(--fs-body); font-weight: 500; color: var(--ink); }
.tpl-it.on .tpl-t { color: var(--brand-text); font-weight: 600; }
.tpl-s { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }
.tpl-n { flex-shrink: 0; font-size: var(--fs-sub); color: var(--ink-3); }
.tpl-it.on .tpl-n { color: var(--brand-text); }
.boost-row { display: flex; align-items: center; gap: var(--sp-12); padding: var(--sp-12) 0 var(--sp-4); }
.boost-l { flex: 1; min-width: 0; }
.boost-t { display: block; font-size: var(--fs-body); font-weight: 500; color: var(--ink); }
.boost-s { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }
.sheet-acts { display: flex; flex-direction: column; gap: var(--sp-8); }
.done { display: flex; flex-direction: column; gap: var(--sp-8); }
.done-t { font-size: var(--fs-sub); color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.done-code { display: flex; align-items: baseline; gap: var(--sp-8); }
.done-k { font-size: var(--fs-sub); color: var(--ink-3); }
.done-c { font-size: var(--fs-h1); font-weight: 700; color: var(--brand-text); letter-spacing: var(--ls-num); }
.done-s { font-size: var(--fs-caption); color: var(--ink-3); }

/* #ifdef H5 */
.page :deep(.kg-two__aside) { display: none; }
@media (min-width: 1024px) {
  .page { max-width: 1064px; margin: 0 auto; }
  .page :deep(.kg-two__aside) { display: block; }
  .region-row { display: none; }
  .plist { display: grid; grid-template-columns: repeat(2, 1fr); align-items: stretch; }
  .plist .paper { display: flex; flex-direction: column; }
  .plist .paper .paper-top { flex: 1; }
  .paper-top, .more, .arow, .menu-it, .rg { cursor: pointer; }
}
/* #endif */
</style>
