<template>
  <view class="wrap">
    <view v-if="loading" class="spin">报告加载中…</view>

    <view v-if="!loading && !report && loadErr" class="card empty">
      <text class="empty-t">加载失败</text>
      <text class="empty-s">{{ loadErr }}</text>
      <view class="retry" @click="load(aid)">重试 ›</view>
    </view>
    <view v-else-if="!loading && !report" class="card empty">
      <text class="empty-t">暂无成绩报告</text>
      <text class="empty-s">请从模考交卷或「模考记录」进入查看报告</text>
      <view class="pbtn main" @click="goList">去卷库</view>
    </view>

    <template v-if="!loading && report">
      <view class="rp2-cols">
      <view class="rp2-side">
      <view class="card hero">
        <text class="hero-title">{{ report.paper.title }}</text>
        <view class="hero-score">
          <text class="score-n">{{ report.attempt.score }}</text>
          <text class="score-u">分</text>
        </view>
        <view class="hero-meta">
          <text class="hm">答对 {{ report.correct }}/{{ report.total }}（已答 {{ report.answered }}）</text>
          <text class="hm">已答正确率 {{ accuracy }}%</text>
          <text class="hm">全卷正确率 {{ fullAccuracy }}%</text>
          <text class="hm">用时 {{ usedTime }}</text>
          <text v-if="prevDeltaText" class="hm">较上次同卷 {{ prevDeltaText }}</text>
        </view>
      </view>

      <rank-card v-if="report.attempt && report.attempt.id" :attempt-id="report.attempt.id" @loaded="rankData = $event" />

      <view v-if="goal" class="card">
        <view class="h">距离目标</view>
        <view class="gap-row">
          <text class="gap-k">目标分 {{ goal.target }}</text>
          <text class="gap-v" :class="{ ok: goal.gap <= 0 }">{{ goal.gap <= 0 ? '已达标 🎉' : '还差 ' + goal.gap + ' 分' }}</text>
        </view>
      </view>

      <view v-if="shareText" class="share-cta" role="button" aria-label="邀考友挑战本卷" @click="copyShare">
        <text class="share-cta-t">邀考友挑战本卷</text>
        <text class="share-cta-s">复制成绩与同卷模考链接，发给考友比一比</text>
      </view>

      <view v-if="report.attempt && report.attempt.id" class="share-cta" role="button" aria-label="生成成绩海报" @click="goPoster">
        <text class="share-cta-t">生成成绩海报</text>
        <text class="share-cta-s">一张图晒出得分与排名，保存后发给考友 / 朋友圈</text>
      </view>

      <view v-if="modules.length" class="card">
        <view class="h">模块得分</view>
        <view v-for="m in modules" :key="m.key" class="mrow">
          <text class="mrow-name">{{ m.name }}</text>
          <view class="mrow-bar">
            <view class="mrow-fill" :style="{ width: m.pct + '%' }"></view>
          </view>
          <view class="mrow-r">
            <text class="mrow-v">{{ m.correct }}/{{ m.n }}</text>
            <text v-if="m.avgPct != null" class="mrow-avg">全站 {{ m.avgPct }}%</text>
          </view>
        </view>
      </view>

      <view v-if="paceRows.length" class="card">
        <view class="h">模块用时 · 配速</view>
        <view v-for="p in paceRows" :key="p.key" class="prow">
          <view class="prow-top">
            <text class="prow-name">{{ p.name }}</text>
            <text class="prow-tag" :class="p.status">{{ p.status === 'over' ? '超时' : p.status === 'fast' ? '偏快' : '合理' }}</text>
          </view>
          <view class="prow-bar">
            <view class="prow-fill" :class="p.status" :style="{ width: p.pct + '%' }"></view>
          </view>
          <text class="prow-v">用时 {{ fmtMin(p.secs) }} · 参考 {{ fmtMin(p.refSecs) }}</text>
        </view>
        <text class="note">参考用时按各模块题量占比折算自本卷限时</text>
      </view>
      </view>

      <view class="rp2-main">
      <view v-if="history.length > 1" class="card">
        <view class="h">历次成绩</view>
        <view class="curve">
          <view v-for="(a, i) in history" :key="a.id" class="curve-col" @click="openAttempt(a)">
            <text class="curve-v">{{ a.score }}</text>
            <view class="curve-bar" :class="{ cur: a.id === report.attempt.id }" :style="{ height: Math.max(8, a.score) + '%' }"></view>
            <text class="curve-x">{{ i + 1 }}</text>
          </view>
        </view>
        <text class="curve-note">同类试卷最近 {{ history.length }} 次成绩（分）</text>
      </view>

      <view class="card">
        <view class="h">本卷薄弱考点</view>
        <text v-if="!(report.weak_tags && report.weak_tags.length)" class="note">本卷错题较少，暂未形成薄弱考点结论，继续保持！</text>
        <view v-for="t in report.weak_tags || []" :key="t.tag3" class="wrow" @click="goPractice(t.tag3)">
          <view class="wrow-l">
            <text class="wrow-t">{{ t.name || t.tag3 }}</text>
            <text class="wrow-s">错 {{ t.wrong }}/{{ t.n }} 题</text>
          </view>
          <text class="wrow-go">去练 ›</text>
        </view>
      </view>

      <view class="card">
        <view class="h">逐题对错（点击看解析）</view>
        <view class="qgrid">
          <view
            v-for="it in report.items"
            :key="it.no"
            class="qn"
            :class="it.picked ? (it.correct ? 'ok' : 'bad') : 'blank'"
            @click="openQ(it)"
          >{{ it.no }}</view>
        </view>
        <view class="legend">
          <text class="lg"><text class="dot ok"></text>答对</text>
          <text class="lg"><text class="dot bad"></text>答错</text>
          <text class="lg"><text class="dot"></text>未答</text>
        </view>
        <view v-if="redoCount" class="redo-cta" role="button" aria-label="本卷错题重练" @click="redoWrong">
          <text class="redo-cta-t">本卷错题重练（{{ redoCount }} 题）</text>
          <text class="redo-cta-s">按刷题模式把本卷答错的题重做一遍{{ wrongTotal > redoCount ? '（本轮先练前 ' + redoCount + ' 题）' : '' }}</text>
        </view>
      </view>

      <view class="btns">
        <view class="pbtn" @click="goList">返回卷库</view>
        <view class="pbtn main" @click="retake">再考一次</view>
      </view>
      </view>
      </view>
    </template>

    <!-- 解析浮层 -->
    <view v-if="detail" class="mask" @click="detail = null">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">第 {{ detail.no }} 题 · {{ detail.correct ? '答对' : (detail.picked ? '答错' : '未答') }}</text>
          <view class="sheet-acts">
            <view class="sheet-x" role="button" :aria-label="detailFaved ? '取消收藏本题' : '收藏本题'" @click="toggleDetailFav"><l-icon name="star" :size="20" :color="detailFaved ? '#f59e0b' : '#8a90a0'" :fill="detailFaved ? '#f59e0b' : 'none'" /></view>
            <view class="sheet-x" role="button" aria-label="关闭" @click="detail = null"><l-icon name="x" :size="20" color="#6b7280" /></view>
          </view>
        </view>
        <scroll-view scroll-y class="detail-scroll">
          <template v-if="detailMat">
            <view
              class="mat-fold"
              role="button"
              :aria-label="matOpen ? '收起材料' : '展开材料'"
              @click="matOpen = !matOpen"
            >
              <text class="mat-fold-t">📄 资料材料</text>
              <text class="mat-fold-a">{{ matOpen ? '收起 ‹' : '展开 ›' }}</text>
            </view>
            <text v-if="matOpen" class="dq">{{ detailMat.material }}</text>
            <text class="dq">{{ detailMat.stem }}</text>
          </template>
          <text v-else class="dq">{{ detail.question }}</text>
          <image v-if="detail.image" class="dimg" :src="imgUrl(detail.image)" mode="widthFix" @click="previewImg(detail.image)" />
          <view v-if="detail.image && detail.image_credit" class="dimg-credit">图源：{{ detail.image_credit }}</view>
          <view v-for="(v, k) in detail.options" :key="k" class="dopt" :class="{ right: k === detail.answer, wrong: k === detail.picked && k !== detail.answer }">
            <text>{{ k }}. {{ v }}</text>
          </view>
          <view class="dans">
            正确答案 <text class="da ok">{{ detail.answer }}</text>
            <template v-if="detail.picked">，你选了 <text class="da" :class="detail.correct ? 'ok' : 'bad'">{{ detail.picked }}</text></template>
          </view>
          <view v-if="detailStatLine" class="dstat">{{ detailStatLine }}</view>
          <view v-if="detail.hs_explanation || detail.explanation" class="dexp">
            <text>{{ detail.hs_explanation || detail.explanation }}</text>
          </view>
          <q-social-bar v-if="detail.question_id" :question-id="detail.question_id" />
        </scroll-view>
        <view class="dnav">
          <view class="dnav-btn" :class="{ dis: !hasPrevQ }" role="button" aria-label="上一题解析" :aria-disabled="!hasPrevQ" @click="stepQ(-1)">‹ 上一题</view>
          <view class="dnav-mid" role="button" :aria-label="wrongOnly ? '切换为看全部题解析' : '切换为只看错题与未答解析'" @click="wrongOnly = !wrongOnly">{{ wrongOnly ? '只看错题/未答' : '全部题目' }}</view>
          <view class="dnav-btn" :class="{ dis: !hasNextQ }" role="button" aria-label="下一题解析" :aria-disabled="!hasNextQ" @click="stepQ(1)">下一题 ›</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, anonUid, isNetErr, trackEvent, BASE_URL, setFav, removeFav } from '../../api.js';
import { splitMaterial } from '../../material.js';
import { buildPaceRows, fmtMin } from '../../exam-pace.js';
import { buildExamRedoSet } from '../../exam-redo.js';
import { buildExamReportShareText } from '../../exam-share.js';
import { reviewStep } from '../../exam-review.js';
import { isFaved, toggleFav } from '../../exam-fav.js';
import { qStatLine } from '../../q-stat.js';
import { goalGap, prevScoreDelta } from '../../exam-goal.js';
import { modAvgPct } from '../../exam-mod-avg.js';

const MODS = { changshi: '常识判断', yanyu: '言语理解', shuliang: '数量关系', panduan: '判断推理', ziliao: '资料分析' };
const MOD_ORDER = ['changshi', 'yanyu', 'shuliang', 'panduan', 'ziliao'];

export default {
  data() {
    return { loading: true, loadErr: '', aid: null, report: null, history: [], targetScore: null, detail: null, matOpen: false, wrongOnly: false, favs: uni.getStorageSync('favQuestions') || [], rankData: null };
  },
  computed: {
    accuracy() {
      const r = this.report;
      return r && r.answered ? Math.round((r.correct / r.answered) * 100) : 0;
    },
    fullAccuracy() {
      const r = this.report;
      return r && r.total ? Math.round((r.correct / r.total) * 100) : 0;
    },
    usedTime() {
      const a = this.report && this.report.attempt;
      if (!a || !a.submitted_at) return '-';
      const s = Math.max(0, Math.round(a.submitted_at - a.started_at));
      return Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒';
    },
    detailStatLine() {
      return qStatLine(this.detail);
    },
    detailFaved() {
      return !!this.detail && isFaved(this.favs, this.detail.question);
    },
    detailMat() {
      const d = this.detail;
      if (!d || d.module !== 'ziliao') return null;
      return splitMaterial(d.question);
    },
    modules() {
      const pm = (this.report && this.report.attempt.per_module) || {};
      const keys = MOD_ORDER.filter((k) => pm[k]).concat(Object.keys(pm).filter((k) => !MOD_ORDER.includes(k)));
      return keys.map((k) => ({
        key: k,
        name: MODS[k] || k,
        n: pm[k].n,
        correct: pm[k].correct,
        pct: pm[k].n ? Math.round((pm[k].correct / pm[k].n) * 100) : 0,
        avgPct: modAvgPct(this.rankData, k),
      }));
    },
    paceRows() {
      const r = this.report;
      if (!r) return [];
      const rows = buildPaceRows(r.attempt.per_module, r.paper.duration_min, r.total);
      const order = (k) => { const i = MOD_ORDER.indexOf(k); return i < 0 ? MOD_ORDER.length : i; };
      return rows
        .slice()
        .sort((a, b) => order(a.key) - order(b.key))
        .map((p) => ({
          ...p,
          name: MODS[p.key] || p.key,
          pct: Math.max(4, Math.round((p.secs / Math.max(p.secs, p.refSecs, 1)) * 100)),
        }));
    },
    wrongTotal() {
      const r = this.report;
      return r ? r.items.filter((it) => it.picked && !it.correct).length : 0;
    },
    redoCount() {
      const r = this.report;
      return r ? buildExamRedoSet(r.items).length : 0;
    },
    shareText() {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return buildExamReportShareText(this.report, origin);
    },
    goal() {
      return this.report ? goalGap(this.report.attempt.score, this.targetScore) : null;
    },
    prevDeltaText() {
      if (!this.report) return '';
      const d = prevScoreDelta(this.history, this.report.attempt.id);
      if (!d) return '';
      return d.delta > 0 ? '+' + d.delta + ' 分' : d.delta < 0 ? d.delta + ' 分' : '持平';
    },
    hasPrevQ() {
      return !!(this.report && this.detail && reviewStep(this.report.items, this.detail.no, -1, this.wrongOnly));
    },
    hasNextQ() {
      return !!(this.report && this.detail && reviewStep(this.report.items, this.detail.no, 1, this.wrongOnly));
    },
  },
  onLoad(opt) {
    if (opt && opt.attempt_id) {
      this.load(opt.attempt_id);
    } else {
      this.loading = false;
    }
  },
  onShow() {
    // #ifdef H5
    if (!this._rpKeyHandler && typeof window !== 'undefined') {
      this._rpKeyHandler = (e) => this.onRpKeydown(e);
      window.addEventListener('keydown', this._rpKeyHandler);
    }
    // #endif
  },
  onUnload() {
    // #ifdef H5
    if (this._rpKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._rpKeyHandler);
      this._rpKeyHandler = null;
    }
    // #endif
  },
  onHide() {
    // #ifdef H5
    if (this._rpKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._rpKeyHandler);
      this._rpKeyHandler = null;
    }
    // #endif
  },
  methods: {
    async load(aid) {
      this.aid = aid;
      this.loading = true;
      this.loadErr = '';
      try {
        const d = await request('/api/exam/report/' + aid + '?uid=' + encodeURIComponent(anonUid()));
        this.report = d;
        uni.setNavigationBarTitle({ title: '成绩报告' });
        this.loadHistory();
        this.loadProfile();
      } catch (e) {
        // 仅网络层失败置错误态；HTTP 业务错误（如报告不存在）保持空态引导
        if (isNetErr(e)) this.loadErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async loadHistory() {
      try {
        const d = await request(
          '/api/exam/attempts?uid=' + encodeURIComponent(anonUid()) + '&paper_id=' + this.report.paper.id + '&limit=10'
        );
        this.history = (d.items || []).slice().reverse();
      } catch (e) { /* 非关键路径 */ }
    },
    async loadProfile() {
      try {
        const d = await request('/api/profile?uid=' + encodeURIComponent(anonUid()));
        this.targetScore = (d.profile && d.profile.target_score) != null ? d.profile.target_score : null;
      } catch (e) { /* 非关键路径：未设/失败不渲染 */ }
    },
    openQ(it) { this.matOpen = false; this.detail = it; },
    toggleDetailFav() {
      const d = this.detail;
      if (!d) return;
      const { list, added } = toggleFav(this.favs, d);
      this.favs = list;
      uni.setStorageSync('favQuestions', list);
      if (d.question_id) (added ? setFav(d.question_id) : removeFav(d.question_id)).catch(() => {});
      uni.showToast({ title: added ? '已收藏，可在收藏与笔记查看' : '已取消收藏', icon: 'none', duration: 900 });
    },
    stepQ(dir) {
      if (!this.report || !this.detail) return;
      const nxt = reviewStep(this.report.items, this.detail.no, dir, this.wrongOnly);
      if (nxt) this.openQ(nxt);
    },
    // #ifdef H5
    onRpKeydown(e) {
      if (typeof window === 'undefined' || window.innerWidth < 1024) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (!this.detail) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.stepQ(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.stepQ(1); }
    },
    // #endif
    openAttempt(a) {
      if (a.id === this.report.attempt.id) return;
      this.load(a.id);
    },
    goList() {
      uni.redirectTo({ url: '/pkgA/exam/list' });
    },
    retake() {
      const p = this.report.paper;
      uni.redirectTo({ url: p.kind === 'mock' ? '/pkgA/exam/exam?mini=1' : '/pkgA/exam/exam?paper_id=' + p.id });
    },
    fmtMin,
    imgUrl(p) {
      return /^https?:/.test(p) ? p : (BASE_URL || '') + p;
    },
    previewImg(p) {
      uni.previewImage({ urls: [this.imgUrl(p)] });
    },
    copyShare() {
      if (!this.shareText) return;
      trackEvent('share_copy', 'exam_report', String(this.report.paper.id));
      uni.setClipboardData({
        data: this.shareText,
        success: () => uni.showToast({ title: '挑战链接已复制，发给考友吧', icon: 'none' }),
      });
    },
    goPoster() {
      trackEvent('share_poster', 'exam_report', String(this.report.attempt.id));
      uni.navigateTo({ url: '/pkgA/social/poster?mode=exam&attempt_id=' + this.report.attempt.id });
    },
    redoWrong() {
      const set = buildExamRedoSet(this.report.items);
      if (!set.length) return;
      uni.setStorageSync('redoSet', set);
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goPractice(tag3) {
      uni.setStorageSync('practiceLaunch', { kind: 'start', tag3: tag3 || null, count: 10, adaptive: true });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 60rpx 24rpx; }
.empty { text-align: center; padding: 80rpx 28rpx; }
.empty-t { display: block; font-size: 30rpx; font-weight: 600; color: var(--ink); }
.empty-s { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 12rpx; margin-bottom: 32rpx; }
.empty .pbtn { margin: 0 auto; max-width: 320rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 600; margin-bottom: 20rpx; }
.hero { background: linear-gradient(135deg, var(--brand), #5c82ff); border: none; text-align: center; }
.hero-title { display: block; font-size: 25rpx; color: rgba(255, 255, 255, 0.85); }
.hero-score { margin: 16rpx 0 10rpx; }
.score-n { font-size: 88rpx; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
.score-u { font-size: 26rpx; color: rgba(255, 255, 255, 0.85); margin-left: 6rpx; }
.hero-meta { display: flex; justify-content: center; gap: 28rpx; flex-wrap: wrap; }
.hm { font-size: 23rpx; color: rgba(255, 255, 255, 0.9); }

.gap-row { display: flex; justify-content: space-between; align-items: center; min-height: 44px; }
.gap-k { font-size: 26rpx; color: var(--ink); }
.gap-v { font-size: 26rpx; font-weight: 700; color: var(--warn-strong); }
.gap-v.ok { color: var(--ok-strong); }
.mrow { display: flex; align-items: center; gap: 16rpx; min-height: 44px; }
.mrow-name { flex-shrink: 0; width: 130rpx; font-size: 24rpx; color: var(--ink-2); }
.mrow-bar { flex: 1; height: 16rpx; background: var(--brand-soft); border-radius: 999rpx; overflow: hidden; }
.mrow-fill { height: 100%; background: var(--brand); border-radius: 999rpx; transition: width 0.4s ease; }
.mrow-v { flex-shrink: 0; width: 90rpx; text-align: right; font-size: 24rpx; color: var(--ink); font-weight: 600; }
.mrow-r { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; }
.mrow-r .mrow-v { width: auto; }
.mrow-avg { font-size: 20rpx; color: var(--ink-3); white-space: nowrap; }
.curve { display: flex; align-items: flex-end; gap: 14rpx; height: 220rpx; padding: 10rpx 0; }
.curve-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 44rpx; }
.curve-v { font-size: 20rpx; color: var(--ink-2); margin-bottom: 4rpx; }
.curve-bar { width: 60%; max-width: 44rpx; background: var(--brand-soft); border-radius: 8rpx 8rpx 0 0; }
.curve-bar.cur { background: var(--brand); }
.curve-x { font-size: 20rpx; color: var(--ink-2); margin-top: 6rpx; }
.curve-note { font-size: 21rpx; color: var(--ink-2); }
.qgrid { display: flex; flex-wrap: wrap; gap: 18rpx; margin-bottom: 16rpx; }
.qn { width: 76rpx; height: 76rpx; line-height: 76rpx; text-align: center; border-radius: 50%; font-size: 25rpx; font-weight: 600; box-sizing: border-box; background: var(--soft-bg); border: 2rpx solid var(--line); color: var(--ink-2); }
.qn.ok { background: var(--ok-soft); border-color: #86efac; color: #15803d; }
.qn.bad { background: var(--bad-soft); border-color: #fca5a5; color: #b91c1c; }
.legend { display: flex; gap: 24rpx; }
.lg { display: inline-flex; align-items: center; gap: 8rpx; font-size: 22rpx; color: var(--ink-2); }
.dot { width: 20rpx; height: 20rpx; border-radius: 50%; background: var(--soft-bg); border: 2rpx solid var(--line); display: inline-block; }
.redo-cta { margin-top: 20rpx; border: 2rpx solid var(--brand); border-radius: 16rpx; padding: 18rpx 22rpx; background: var(--brand-soft); cursor: pointer; }
.redo-cta-t { display: block; font-size: 26rpx; font-weight: 600; color: var(--brand); }
.redo-cta-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.share-cta { margin-top: 20rpx; border: 2rpx solid var(--brand); border-radius: 16rpx; padding: 18rpx 22rpx; background: var(--brand-soft); cursor: pointer; }
.share-cta-t { display: block; font-size: 26rpx; font-weight: 600; color: var(--brand); }
.share-cta-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.dimg { width: 100%; border-radius: 12rpx; margin-bottom: 8rpx; }
.dimg-credit { font-size: 21rpx; color: var(--ink-2); margin-bottom: 16rpx; }
.dot.ok { background: #86efac; border-color: #86efac; }
.dot.bad { background: #fca5a5; border-color: #fca5a5; }
.btns { display: flex; gap: 16rpx; }
.pbtn { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--brand); color: var(--brand-text); border-radius: 999rpx; font-size: 27rpx; font-weight: 500; background: var(--card); }
.pbtn.main { background: var(--brand); color: #fff; }
.retry { margin-top: 12rpx; color: var(--brand-text); font-size: 26rpx; font-weight: 500; }
.mask { position: fixed; inset: 0; background: rgba(15, 18, 25, 0.45); z-index: 90; display: flex; align-items: flex-end; }
.sheet { width: 100%; background: var(--card); border-radius: 28rpx 28rpx 0 0; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); max-height: 80vh; display: flex; flex-direction: column; box-sizing: border-box; }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.sheet-acts { display: flex; align-items: center; }
.sheet-t { font-size: 30rpx; font-weight: 600; }
.sheet-x { font-size: 30rpx; color: var(--ink-2); padding: 8rpx 16rpx; }
.detail-scroll { max-height: 62vh; }
.dnav { display: flex; align-items: center; gap: 16rpx; margin-top: 20rpx; }
.dnav-btn { flex: 1; text-align: center; padding: 18rpx 0; border: 1rpx solid var(--line); border-radius: 14rpx; font-size: 26rpx; color: var(--ink); background: var(--bg); }
.dnav-btn.dis { color: var(--ink-3); opacity: 0.55; }
.dnav-mid { flex: none; padding: 18rpx 22rpx; border-radius: 14rpx; font-size: 24rpx; color: var(--brand-text); background: var(--brand-soft); }
.mat-fold { display: flex; justify-content: space-between; align-items: center; background: #f0fdfa; border: 1rpx solid #99f6e4; border-radius: 12rpx; padding: 14rpx 20rpx; margin-bottom: 14rpx; }
.mat-fold-t { font-size: 24rpx; color: #0f766e; }
.mat-fold-a { font-size: 24rpx; color: #0d9488; font-weight: 600; flex-shrink: 0; margin-left: 16rpx; }
.dq { display: block; font-size: 28rpx; line-height: 1.7; white-space: pre-wrap; margin-bottom: 20rpx; }
.dopt { border: 2rpx solid var(--line); border-radius: 16rpx; padding: 16rpx 20rpx; margin-bottom: 14rpx; font-size: 26rpx; line-height: 1.6; }
.dopt.right { border-color: var(--ok, #16a34a); background: var(--ok-soft); }
.dopt.wrong { border-color: var(--bad, #dc2626); background: var(--bad-soft); }
.dans { font-size: 25rpx; color: var(--ink-2); margin: 10rpx 0 16rpx; }
.dstat { font-size: 23rpx; color: var(--ink-2); margin: -6rpx 0 16rpx; }
.da { font-weight: 800; font-size: 28rpx; }
.da.ok { color: var(--ok, #16a34a); }
.da.bad { color: var(--bad, #dc2626); }
.dexp { background: var(--soft-bg); border-left: 5rpx solid var(--brand); border-radius: 14rpx; padding: 20rpx; font-size: 25rpx; line-height: 1.7; white-space: pre-wrap; margin-bottom: 20rpx; }
.note { display: block; font-size: 23rpx; color: var(--ink-2); }
.wrow { display: flex; justify-content: space-between; align-items: center; min-height: 44px; padding: 10rpx 0; border-bottom: 1rpx solid var(--line); }
.wrow:last-child { border-bottom: none; }
.wrow-l { display: flex; flex-direction: column; gap: 4rpx; }
.wrow-t { font-size: 26rpx; color: var(--ink); font-weight: 500; }
.wrow-s { font-size: 22rpx; color: var(--ink-2); }
.wrow-go { font-size: 25rpx; color: var(--brand-text); font-weight: 600; }
.prow { padding: 10rpx 0; }
.prow-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8rpx; }
.prow-name { font-size: 24rpx; color: var(--ink-2); }
.prow-tag { font-size: 21rpx; font-weight: 600; border-radius: 999rpx; padding: 2rpx 14rpx; background: var(--ok-soft); color: var(--ok-strong, #15803d); }
.prow-tag.over { background: var(--bad-soft); color: var(--bad-strong, #b91c1c); }
.prow-tag.fast { background: var(--soft-bg); color: var(--ink-2); }
.prow-bar { height: 14rpx; background: var(--brand-soft); border-radius: 999rpx; overflow: hidden; }
.prow-fill { height: 100%; background: var(--brand); border-radius: 999rpx; transition: width 0.4s ease; }
.prow-fill.over { background: var(--bad, #dc2626); }
.prow-v { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 6rpx; font-variant-numeric: tabular-nums; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .mask { justify-content: center; align-items: center; }
  .sheet { width: 640px; border-radius: 24rpx; }
  .wrow:hover, .qn:hover, .pbtn:hover, .curve-col:hover, .sheet-x:hover { cursor: pointer; }
  .wrow:hover { background: var(--soft-bg, #f5f6fa); }
}

@media (min-width: 1024px) {
  .rp2-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .rp2-side { width: 420px; flex: none; position: sticky; top: 24rpx; }
  .rp2-main { flex: 1; min-width: 0; }
}
/* #endif */
</style>
