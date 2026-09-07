<template>
  <view class="page">
    <kg-skeleton v-if="loading" preset="cards" />

    <kg-empty-state
      v-if="!loading && !report && loadErr"
      icon="wifi-off"
      title="报告加载失败"
      :desc="loadErr"
      cta-text="重试"
      @cta="load(aid)"
    />
    <kg-empty-state
      v-else-if="!loading && !report"
      icon="chart-column"
      title="暂无成绩报告"
      desc="从卷库开始一场模考，交卷后这里会生成成绩报告"
      cta-text="去卷库"
      @cta="goList"
    />

    <kg-two-col v-if="!loading && report">
      <template #main>
        <kg-hero-card :label="report.paper.title" :value="report.attempt.score" unit="分">
          <view class="hero-sub">
            <text class="hero-line">答对 {{ report.correct }}/{{ report.total }}（已答 {{ report.answered }}）· 用时 {{ usedTime }}</text>
            <text v-if="prevDeltaText" class="hero-line">较上次同卷 {{ prevDeltaText }}</text>
            <text v-if="beatText" class="hero-beat num">{{ beatText }}</text>
          </view>
        </kg-hero-card>

        <kg-card variant="flat" class="sec">
          <kg-stat-row :items="statItems" />
        </kg-card>

        <rank-card v-if="report.attempt && report.attempt.id" :attempt-id="report.attempt.id" @loaded="rankData = $event" />

        <kg-card v-if="goal" variant="flat" class="sec">
          <view class="gap-row">
            <text class="gap-k">目标分 <text class="num">{{ goal.target }}</text></text>
            <text class="gap-v" :class="{ ok: goal.gap <= 0 }">{{ goal.gap <= 0 ? '已达标 🎉' : '还差 ' + goal.gap + ' 分' }}</text>
          </view>
        </kg-card>

        <kg-card v-if="modules.length" variant="flat" class="sec">
          <text class="h">模块得分</text>
          <view v-if="radar" class="radar-wrap" aria-label="模块正确率雷达">
            <view class="radar">
              <view class="radar-grid" :style="{ clipPath: radar.grid }"></view>
              <view class="radar-grid inner" :style="{ clipPath: radar.grid }"></view>
              <view class="radar-data" :style="{ clipPath: radar.data }"></view>
              <text v-for="l in radar.labels" :key="l.key" class="radar-l" :style="{ left: l.x + '%', top: l.y + '%' }">{{ l.name }} <text class="num">{{ l.pct }}%</text></text>
            </view>
          </view>
          <view v-for="m in modules" :key="m.key" class="mrow">
            <text class="mrow-name">{{ m.name }}</text>
            <kg-progress :value="m.pct" :module="m.key" class="mrow-bar" />
            <view class="mrow-r">
              <text class="mrow-v num">{{ m.correct }}/{{ m.n }}</text>
              <text v-if="m.avgPct != null" class="mrow-avg num">全站 {{ m.avgPct }}%</text>
            </view>
          </view>
          <view
            v-if="weakMod"
            class="cta"
            role="button"
            tabindex="0"
            :aria-label="'去专项强化' + weakMod.name"
            @click="goWeak"
            @keydown.enter="goWeak"
          >
            <view class="cta-l">
              <text class="cta-t">薄弱模块：{{ weakMod.name }}</text>
              <text class="cta-d">{{ weakMod.reason }}</text>
            </view>
            <text class="cta-go">去专项强化</text>
          </view>
        </kg-card>

        <kg-card v-if="paceRows.length" variant="flat" class="sec">
          <text class="h">模块用时 · 配速</text>
          <view v-for="p in paceRows" :key="p.key" class="prow">
            <view class="prow-top">
              <text class="prow-name">{{ p.name }}</text>
              <kg-tag :tone="p.status === 'over' ? 'bad' : p.status === 'ok' ? 'ok' : 'neutral'">{{ p.tag }}</kg-tag>
            </view>
            <view class="prow-bar"><view class="prow-fill" :class="p.status" :style="{ width: p.pct + '%' }"></view></view>
            <text class="prow-v num">用时 {{ fmtMin(p.secs) }} · 参考 {{ fmtMin(p.refSecs) }}{{ p.refNote }}</text>
          </view>
          <text class="note">参考用时按各模块题量占比折算自本卷限时</text>
        </kg-card>

        <kg-card v-if="history.length > 1" variant="flat" class="sec">
          <text class="h">历次成绩</text>
          <view class="curve">
            <view v-for="(a, i) in history" :key="a.id" class="curve-col" role="button" :aria-label="'第 ' + (i + 1) + ' 次 ' + a.score + ' 分'" @click="openAttempt(a)">
              <text class="curve-v num">{{ a.score }}</text>
              <view class="curve-bar" :class="{ cur: a.id === report.attempt.id }" :style="{ height: Math.max(8, a.score) + '%' }"></view>
              <text class="curve-x num">{{ i + 1 }}</text>
            </view>
          </view>
          <text class="note">同类试卷最近 {{ history.length }} 次成绩（分）</text>
        </kg-card>

        <kg-card variant="flat" class="sec">
          <text class="h">本卷薄弱考点</text>
          <text v-if="!(report.weak_tags && report.weak_tags.length)" class="note">本卷错题较少，暂未形成薄弱考点结论，继续保持！</text>
          <view v-for="t in report.weak_tags || []" :key="t.tag3" class="wrow" role="button" hover-class="row--hover" @click="goPractice(t.tag3)">
            <view class="wrow-l">
              <text class="wrow-t">{{ t.name || t.tag3 }}</text>
              <text class="wrow-s">错 {{ t.wrong }}/{{ t.n }} 题</text>
            </view>
            <text class="wrow-go">去练</text>
            <l-icon name="chevron-right" :size="16" tone="brand" />
          </view>
        </kg-card>

        <kg-card variant="flat" class="sec answers-mobile">
          <text class="h">逐题对错（点击看解析）</text>
          <view class="qgrid">
            <view
              v-for="it in report.items"
              :key="it.no"
              class="qn num"
              :class="[it.picked ? (it.correct ? 'ok' : 'bad') : 'blank', it.marked ? 'mk' : '']"
              role="button"
              :aria-label="'第 ' + it.no + ' 题，' + (it.picked ? (it.correct ? '答对' : '答错') : '未答')"
              @click="openQ(it)"
            >{{ it.no }}</view>
          </view>
          <view class="legend">
            <text class="lg"><text class="dot ok"></text>答对</text>
            <text class="lg"><text class="dot bad"></text>答错</text>
            <text class="lg"><text class="dot"></text>未答</text>
            <text v-if="markCount" class="lg"><text class="dot mk"></text>考中标记</text>
          </view>
        </kg-card>

        <view v-if="redoCount" class="cta" role="button" aria-label="本卷错题重练" @click="redoWrong">
          <view class="cta-l">
            <text class="cta-t">本卷错题重练（{{ redoCount }} 题）</text>
            <text class="cta-d">按刷题模式把本卷答错的题重做一遍{{ wrongTotal > redoCount ? '（本轮先练前 ' + redoCount + ' 题）' : '' }}</text>
          </view>
          <l-icon name="chevron-right" :size="20" tone="brand" />
        </view>

        <kg-card v-if="reasonRecap" variant="flat" class="sec">
          <text class="h">本卷错因画像</text>
          <view
            v-for="g in reasonRecap.rows"
            :key="g.name"
            class="rz-row"
            role="button"
            :aria-label="'去错题本复习错因：' + g.name"
            @click="goBookReason(g.name)"
          >
            <text class="rz-name">{{ g.name }} ›</text>
            <view class="rz-bar"><view class="rz-fill" :style="{ width: Math.round((g.n / reasonRecap.total) * 100) + '%' }" /></view>
            <text class="rz-n num">{{ g.n }}</text>
          </view>
          <text class="note">点击错因直达错题本对应待掌握错题（不限本卷）；解析浮层里可逐题标注错因</text>
        </kg-card>

        <view v-if="nextReco" class="cta next" role="button" tabindex="0" :aria-label="'继续模考' + nextReco.title" @click="goNext" @keydown.enter="goNext">
          <view class="cta-l">
            <text class="cta-t">继续模考：{{ nextReco.title }}</text>
            <text class="cta-d">{{ nextReco.takers > 0 ? '已有 ' + nextReco.takers + ' 人模考' + (nextReco.avgScore != null ? ' · 平均 ' + nextReco.avgScore + ' 分' : '') : '换一卷继续练手感' }}</text>
          </view>
          <text class="cta-go">去看这卷</text>
        </view>

        <view class="share-row share-mobile">
          <kg-button v-if="shareText" variant="ghost" size="md" icon="copy" @click="copyShare">邀考友挑战本卷</kg-button>
          <kg-button v-if="report.attempt && report.attempt.id" variant="ghost" size="md" icon="share-2" @click="goPoster">生成成绩海报</kg-button>
        </view>

        <kg-action-bar layout="actions" primary-text="再考一次" secondary-text="返回卷库" @primary="retake" @secondary="goList" />
      </template>

      <!-- #ifdef H5 -->
      <template #aside>
        <kg-card variant="flat" class="side-card">
          <text class="h">逐题对错</text>
          <view class="qgrid">
            <view
              v-for="it in report.items"
              :key="it.no"
              class="qn num"
              :class="[it.picked ? (it.correct ? 'ok' : 'bad') : 'blank', it.marked ? 'mk' : '']"
              role="button"
              :aria-label="'第 ' + it.no + ' 题'"
              @click="openQ(it)"
            >{{ it.no }}</view>
          </view>
          <view class="legend">
            <text class="lg"><text class="dot ok"></text>答对</text>
            <text class="lg"><text class="dot bad"></text>答错</text>
            <text class="lg"><text class="dot"></text>未答</text>
          </view>
          <view class="share-col">
            <kg-button v-if="shareText" variant="ghost" size="md" block icon="copy" @click="copyShare">邀考友挑战本卷</kg-button>
            <kg-button v-if="report.attempt && report.attempt.id" variant="ghost" size="md" block icon="share-2" @click="goPoster">生成成绩海报</kg-button>
          </view>
          <text class="kbd-note">←/→ 在解析间切题</text>
        </kg-card>
      </template>
      <!-- #endif -->
    </kg-two-col>

    <!-- 解析浮层 -->
    <kg-sheet :model-value="!!detail" :title="detail ? '第 ' + detail.no + ' 题 · ' + (detail.correct ? '答对' : (detail.picked ? '答错' : '未答')) : ''" @update:model-value="!$event && (detail = null)">
      <template v-if="detail">
        <view class="d-tools">
          <kg-tag v-if="detail.marked" tone="warn">考试时标记过本题</kg-tag>
          <view class="kg-tool" role="button" :aria-label="detailFaved ? '取消收藏本题' : '收藏本题'" @click="toggleDetailFav">
            <l-icon name="star" :size="24" :tone="detailFaved ? 'warn' : 'ink-2'" :fill="detailFaved ? 'currentColor' : 'none'" />
          </view>
        </view>
        <kg-question-card :q="detailQ" :show-meta="false">
          <kg-option-group :options="detailOpts" :model-value="(detail.picked || '').split('')" :answer="(detail.answer || '').split('')" revealed readonly />
        </kg-question-card>
        <kg-analysis-card
          :answer="detail.answer"
          :picked="detail.picked || ''"
          :analysis="detail.hs_explanation || detail.explanation || ''"
          :stats="detailStats"
          :tags="detail.tag3 ? [detail.tag3] : []"
          :collapsed="false"
        />
        <text v-if="detailTimeLine" class="dstat">{{ detailTimeLine }}</text>
        <view v-if="detail.mistake_id" class="dreasons">
          <text class="drz-t">错因自评：</text>
          <text
            v-for="rz in reasonOpts"
            :key="rz"
            class="chip"
            :class="{ on: detail.error_reason === rz }"
            role="button"
            :aria-label="'错因自评：' + rz + (detail.error_reason === rz ? '，已选中' : '')"
            @click="setDetailReason(rz)"
          >{{ rz }}</text>
        </view>
        <view v-if="detail.tag3" class="cta" role="button" :aria-label="'练同类题：' + detail.tag3 + '，同考点强化 5 道新题'" @click="reinforceDetail">
          <view class="cta-l"><text class="cta-t">练同类题：{{ detail.tag3 }}</text></view>
          <text class="cta-go">强化 5 道新题</text>
        </view>
        <view class="d-links">
          <kg-button v-if="detailAskSeen" variant="text" size="md" @click="openSeenAsk">回看 AI 详解</kg-button>
          <kg-button v-if="detailAskable" variant="text" size="md" @click="askDetail">看不懂？AI 详解本题</kg-button>
          <kg-button v-if="detail.question_id" variant="text" size="md" tone="neutral" :disabled="detailReported" @click="openQcReport">{{ detailReported ? '已提交纠错，感谢反馈' : '题目有问题？纠错' }}</kg-button>
        </view>
        <q-social-bar v-if="detail.question_id" :question-id="detail.question_id" />
      </template>
      <template #footer>
        <view class="dnav">
          <kg-button variant="ghost" size="md" :disabled="!hasPrevQ" aria-label="上一题解析" @click="stepQ(-1)">上一题</kg-button>
          <kg-button variant="text" size="md" :aria-label="navModeAria" @click="cycleNavMode">{{ navModeLabel }}</kg-button>
          <kg-button variant="ghost" size="md" :disabled="!hasNextQ" aria-label="下一题解析" @click="stepQ(1)">下一题</kg-button>
        </view>
      </template>
    </kg-sheet>
    <!-- 题目纠错弹层 -->
    <kg-sheet v-model="reportOpen" title="题目纠错">
      <view class="rp-types">
        <text
          v-for="t in reportTypes"
          :key="t"
          class="chip"
          :class="{ on: reportType === t }"
          role="button"
          :aria-label="'纠错类型：' + t"
          @click="reportType = t"
        >{{ t }}</text>
      </view>
      <textarea
        v-model="reportDetail"
        class="rp-detail"
        aria-label="纠错补充说明"
        placeholder="补充说明（选填，500 字以内）"
        :maxlength="500"
      />
      <template #footer>
        <kg-button block size="lg" :disabled="!reportType" :loading="reportBusy" @click="submitQcReport">提交纠错</kg-button>
      </template>
    </kg-sheet>

  </view>
</template>

<script>
import { request, anonUid, isNetErr, trackEvent, BASE_URL, setFav, removeFav } from '../../api.js';
import { splitMaterial } from '../../material.js';
import { buildPaceRows, fmtMin } from '../../exam-pace.js';
import { buildExamRedoSet } from '../../exam-redo.js';
import { buildExamReportShareText } from '../../exam-share.js';
import { reviewStep } from '../../exam-review.js';
import { markedNos, nextNavMode } from '../../exam-marks.js';
import { isFaved, toggleFav } from '../../exam-fav.js';
import { qStatLine } from '../../q-stat.js';
import { qTimeLine, paperAvgSecs } from '../../exam-time.js';
import { askPrefill, askAnswerLetter } from '../../ask-prefill.js';
import { askQid, findAskSid } from '../../ask-link.js';
import { goalGap, prevScoreDelta } from '../../exam-goal.js';
import { modAvgPct } from '../../exam-mod-avg.js';
import { weakModule } from '../../exam-weak.js';
import { nextPaper } from '../../exam-next.js';
import { moduleLabel } from '../../module-meta.js';
const PACE_TAG = { over: '超时', fast: '偏快', ok: '合理', skip: '未作答' };
const MOD_ORDER = ['changshi', 'yanyu', 'shuliang', 'panduan', 'ziliao'];

export default {
  data() {
    return { loading: true, loadErr: '', aid: null, report: null, history: [], targetScore: null, detail: null, matOpen: false, navMode: 'all', favs: uni.getStorageSync('favQuestions') || [], rankData: null, nextReco: null, reportOpen: false, reportType: '', reportDetail: '', reportBusy: false, reportedIds: {}, reportTypes: ['答案错误', '解析错误', '题干或选项错字', '图片缺失', '分类错误', '重复题', '其他'], reasonOpts: ['粗心大意', '概念不清', '方法不会', '纯蒙的'], askSeenTick: 0 };
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
    markCount() {
      return markedNos(this.report && this.report.items).length;
    },
    navModeLabel() {
      return this.navMode === 'wrong' ? '只看错题/未答' : this.navMode === 'marked' ? '只看标记题' : '全部题目';
    },
    navModeAria() {
      const nxt = nextNavMode(this.navMode, this.markCount > 0);
      const names = { all: '全部题', wrong: '只看错题与未答', marked: '只看考中标记题' };
      return '当前' + names[this.navMode] + '解析，点击切换为' + names[nxt];
    },
    detailStatLine() {
      return qStatLine(this.detail);
    },
    detailTimeLine() {
      const d = this.detail;
      if (!d) return null;
      return qTimeLine(d.secs, paperAvgSecs(this.report && this.report.items));
    },
    detailReported() {
      return !!(this.detail && this.detail.question_id && this.reportedIds[this.detail.question_id]);
    },
    detailFaved() {
      return !!this.detail && isFaved(this.favs, this.detail.question);
    },
    detailMat() {
      const d = this.detail;
      if (!d || d.module !== 'ziliao') return null;
      return splitMaterial(d.question);
    },
    /** 解析浮层 KgQuestionCard 入参（只读展示，图片走 imgUrl 补全域名） */
    detailQ() {
      const d = this.detail;
      const m = this.detailMat;
      return {
        id: d.question_id,
        module: d.module,
        stem: m ? m.stem : String(d.question || ''),
        material: m ? m.material : '',
        images: d.image ? [this.imgUrl(d.image)] : [],
      };
    },
    detailOpts() {
      const o = (this.detail && this.detail.options) || {};
      return Object.keys(o).map((k) => ({ key: k, text: String(o[k] == null ? '' : o[k]) }));
    },
    /** KgAnalysisCard stats：与 qStatLine 同口径（attempt_count/correct_ratio/most_wrong），无 avg_secs 字段则不显示平均用时 */
    detailStats() {
      const d = this.detail;
      if (!d) return null;
      return { attemptCount: d.attempt_count, accuracy: d.correct_ratio, mostWrong: d.most_wrong, avgSecs: d.avg_secs };
    },
    /** 击败比例：rank-card 同源数据（/api/exam/rank），样本 <10 不显示 */
    beatText() {
      const r = this.rankData;
      if (!r || !(r.total >= 10) || r.beaten_pct == null) return '';
      return '击败 ' + r.beaten_pct + '% 考生';
    },
    statItems() {
      const items = [
        { label: '已答正确率', value: this.accuracy, unit: '%', tone: 'brand' },
        { label: '全卷正确率', value: this.fullAccuracy, unit: '%' },
      ];
      const r = this.rankData;
      if (r && r.rank && r.total) items.push({ label: '同卷排名', value: r.rank + '/' + r.total });
      else items.push({ label: '答对', value: this.report.correct + '/' + this.report.total });
      return items;
    },
    /** 模块雷达：≥3 个模块时按 per_module 正确率画多边形（clip-path，深色安全） */
    radar() {
      const ms = this.modules;
      if (ms.length < 3) return null;
      const n = ms.length;
      const pt = (i, r) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
        return [50 + 50 * r * Math.cos(a), 50 + 50 * r * Math.sin(a)];
      };
      const poly = (rs) => 'polygon(' + rs.map((r, i) => pt(i, r).map((v) => v.toFixed(1) + '%').join(' ')).join(', ') + ')';
      const labels = ms.map((m, i) => {
        const [x, y] = pt(i, 1.42);
        return { key: m.key, name: m.name, pct: m.pct, x: 25 + x / 2, y: 15 + (y * 120) / 200 };
      });
      return { grid: poly(ms.map(() => 1)), data: poly(ms.map((m) => Math.max(0.06, m.pct / 100))), labels };
    },
    detailAskSeen() {
      void this.askSeenTick;
      return findAskSid(uni.getStorageSync('askSessions'), uni.getStorageSync('askCurSession'), this.detail && this.detail.question_id);
    },
    detailAskable() {
      const d = this.detail;
      if (!d) return false;
      const stem = this.detailMat ? this.detailMat.stem : d.question;
      return !!askPrefill(stem, d.options);
    },
    modules() {
      const pm = (this.report && this.report.attempt.per_module) || {};
      const keys = MOD_ORDER.filter((k) => pm[k]).concat(Object.keys(pm).filter((k) => !MOD_ORDER.includes(k)));
      return keys.map((k) => ({
        key: k,
        name: moduleLabel(k),
        n: pm[k].n,
        correct: pm[k].correct,
        pct: pm[k].n ? Math.round((pm[k].correct / pm[k].n) * 100) : 0,
        avgPct: modAvgPct(this.rankData, k),
      }));
    },
    weakMod() {
      return weakModule(this.modules);
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
          name: moduleLabel(p.key),
          tag: PACE_TAG[p.status] || PACE_TAG.ok,
          refNote: p.status !== 'skip' && p.answered < p.n ? '（按已答 ' + p.answered + '/' + p.n + ' 题折算）' : '',
          pct: p.status === 'skip' ? 0 : Math.max(4, Math.round((p.secs / Math.max(p.secs, p.refSecs, 1)) * 100)),
        }));
    },
    wrongTotal() {
      const r = this.report;
      return r ? r.items.filter((it) => it.picked && !it.correct).length : 0;
    },
    reasonRecap() {
      const r = this.report;
      if (!r) return null;
      const wrong = r.items.filter((it) => it.picked && !it.correct);
      if (!wrong.length) return null;
      const cnt = {};
      for (const it of wrong) {
        const k = this.reasonOpts.includes(it.error_reason) ? it.error_reason : '未标注';
        cnt[k] = (cnt[k] || 0) + 1;
      }
      const rows = Object.keys(cnt)
        .map((name) => ({ name, n: cnt[name] }))
        .sort((a, b) => b.n - a.n);
      return { rows, total: wrong.length };
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
      return !!(this.report && this.detail && reviewStep(this.report.items, this.detail.no, -1, this.navMode));
    },
    hasNextQ() {
      return !!(this.report && this.detail && reviewStep(this.report.items, this.detail.no, 1, this.navMode));
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
    this.askSeenTick++;
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
    openSeenAsk() {
      if (!this.detailAskSeen) return;
      if (this.detailAskSeen.sid > 0) uni.setStorageSync('askOpenSid', this.detailAskSeen.sid);
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    askDetail() {
      const d = this.detail;
      if (!d) return;
      const stem = this.detailMat ? this.detailMat.stem : d.question;
      const text = askPrefill(stem, d.options);
      if (!text) return;
      trackEvent('report_ask_click', String(d.question_id || ''));
      uni.setStorageSync('redoQuestion', text);
      const qid = askQid(d.question_id);
      if (qid) uni.setStorageSync('redoQid', qid);
      else uni.removeStorageSync('redoQid');
      const ans = askAnswerLetter(d.picked);
      if (ans) uni.setStorageSync('redoAnswer', ans);
      else uni.removeStorageSync('redoAnswer');
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    openQcReport() {
      if (!this.detail || !this.detail.question_id || this.detailReported) return;
      this.reportType = '';
      this.reportDetail = '';
      this.reportOpen = true;
    },
    async submitQcReport() {
      const qid = this.detail && this.detail.question_id;
      if (!qid || !this.reportType || this.reportBusy) return;
      this.reportBusy = true;
      try {
        await request('/api/question_report', {
          method: 'POST',
          data: { question_id: qid, uid: anonUid(), type: this.reportType, detail: this.reportDetail.slice(0, 500) },
        });
        this.reportedIds = { ...this.reportedIds, [qid]: true };
        this.reportOpen = false;
        uni.showToast({ title: '感谢反馈，我们会尽快核查', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '提交失败：' + e.message, icon: 'none' });
      } finally {
        this.reportBusy = false;
      }
    },
    async load(aid) {
      this.aid = aid;
      this.loading = true;
      this.loadErr = '';
      try {
        const d = await request('/api/exam/report/' + aid + '?uid=' + encodeURIComponent(anonUid()));
        this.report = d;
        this.navMode = 'all';
        uni.setNavigationBarTitle({ title: '成绩报告' });
        this.loadHistory();
        this.loadProfile();
        this.loadNext();
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
    async loadNext() {
      try {
        const uid = encodeURIComponent(anonUid());
        const [papers, attempts] = await Promise.all([
          request('/api/exam/papers?kind=zhenti&uid=' + uid),
          request('/api/exam/attempts?uid=' + uid),
        ]);
        this.nextReco = nextPaper(papers.items, attempts.items, this.report.paper);
      } catch (e) { /* 非关键路径：失败不渲染 */ }
    },
    goNext() {
      if (!this.nextReco) return;
      uni.navigateTo({ url: '/pkgA/exam/list?pid=' + this.nextReco.id });
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
    cycleNavMode() {
      this.navMode = nextNavMode(this.navMode, this.markCount > 0);
    },
    stepQ(dir) {
      if (!this.report || !this.detail) return;
      const nxt = reviewStep(this.report.items, this.detail.no, dir, this.navMode);
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
    goBookReason(name) {
      if (!this.reasonOpts.includes(name) && name !== '未标注') return;
      uni.setStorageSync('bookRzIntent', name);
      uni.switchTab({ url: '/pages/book/book' });
    },
    async setDetailReason(rz) {
      const d = this.detail;
      if (!d || !d.mistake_id) return;
      const prev = d.error_reason || null;
      if (prev === rz) return;
      d.error_reason = rz;
      try {
        await request('/api/mistakes/' + d.mistake_id, { method: 'PATCH', data: { uid: anonUid(), error_reason: rz } });
      } catch (e) {
        d.error_reason = prev;
        uni.showToast({ title: '错因保存失败：' + e.message, icon: 'none' });
      }
    },
    reinforceDetail() {
      const d = this.detail;
      if (!d || !d.tag3) return;
      uni.setStorageSync('practiceLaunch', {
        kind: 'reinforce',
        module: d.module || null,
        submodule: d.submodule || null,
        tag3: d.tag3,
        count: 5,
        source: 'exam_report',
      });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goPractice(tag3) {
      uni.setStorageSync('practiceLaunch', { kind: 'start', tag3: tag3 || null, count: 10, adaptive: true });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goWeak() {
      if (!this.weakMod) return;
      uni.setStorageSync('practiceLaunch', { kind: 'start', module: this.weakMod.key, count: 10 });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
  },
};
</script>

<style scoped>
.page { padding: var(--sp-16) var(--page-x) calc(var(--bar-h) + var(--sp-24) + env(safe-area-inset-bottom, 0px)); }
.h { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); margin-bottom: var(--sp-12); }
.note { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-8); }
.sec { margin-top: var(--card-gap); }
.hero-sub { display: flex; flex-direction: column; gap: var(--sp-4); margin-top: var(--sp-8); }
.hero-line { font-size: var(--fs-sub); color: var(--on-brand); opacity: 0.85; }
.hero-beat { font-size: var(--fs-h3); font-weight: 600; color: var(--on-brand); margin-top: var(--sp-4); }
.gap-row { display: flex; justify-content: space-between; align-items: center; min-height: var(--hit-min); }
.gap-k { font-size: var(--fs-body); color: var(--ink); }
.gap-v { font-size: var(--fs-body); font-weight: 600; color: var(--warn-strong); }
.gap-v.ok { color: var(--ok-strong); }
.radar-wrap { display: flex; justify-content: center; padding: var(--sp-12) 0 var(--sp-24); }
.radar { position: relative; width: 240px; height: 200px; }
.radar-grid { position: absolute; left: 60px; top: 30px; width: 120px; height: 120px; background: var(--fill); }
.radar-grid.inner { left: 90px; top: 60px; width: 60px; height: 60px; background: var(--card); }
.radar-data { position: absolute; left: 60px; top: 30px; width: 120px; height: 120px; background: var(--brand); opacity: 0.55; }
.radar-l { position: absolute; transform: translate(-50%, -50%); font-size: var(--fs-caption); color: var(--ink-2); white-space: nowrap; }
.mrow { display: flex; align-items: center; gap: var(--sp-12); min-height: var(--hit-min); }
.mrow-name { flex-shrink: 0; width: 64px; font-size: var(--fs-sub); color: var(--ink-2); }
.mrow-bar { flex: 1; }
.mrow-r { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; min-width: 48px; }
.mrow-v { font-size: var(--fs-sub); color: var(--ink); font-weight: 600; }
.mrow-avg { font-size: var(--fs-caption); color: var(--ink-3); white-space: nowrap; }
.cta { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-12); margin-top: var(--sp-16); padding: var(--sp-12) var(--sp-16); background: var(--brand-soft); border-radius: var(--r-md); min-height: var(--hit-min); }
.cta.next { background: var(--card); border: 1px solid var(--line); }
.cta-l { display: flex; flex-direction: column; gap: var(--sp-4); min-width: 0; }
.cta-t { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.cta-d { font-size: var(--fs-caption); color: var(--ink-2); }
.cta-go { flex-shrink: 0; font-size: var(--fs-sub); font-weight: 600; color: var(--brand-text); white-space: nowrap; }
.prow { padding: var(--sp-8) 0; }
.prow-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-8); }
.prow-name { font-size: var(--fs-sub); color: var(--ink-2); }
.prow-bar { height: 8px; background: var(--brand-soft-2); border-radius: var(--r-full); overflow: hidden; }
.prow-fill { height: 100%; background: var(--brand); border-radius: var(--r-full); transition: width 0.4s ease; }
.prow-fill.over { background: var(--bad); }
.prow-v { display: block; font-size: var(--fs-caption); color: var(--ink-2); margin-top: var(--sp-4); }
.curve { display: flex; align-items: flex-end; gap: var(--sp-8); height: 120px; padding: var(--sp-4) 0; }
.curve-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 24px; }
.curve-v { font-size: var(--fs-caption); color: var(--ink-2); margin-bottom: var(--sp-4); }
.curve-bar { width: 60%; max-width: 24px; background: var(--brand-soft-2); border-radius: var(--r-xs) var(--r-xs) 0 0; }
.curve-bar.cur { background: var(--brand); }
.curve-x { font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }
.wrow { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); padding: var(--sp-8) 0; border-bottom: 1px solid var(--line); }
.wrow:last-child { border-bottom: none; }
.row--hover { background: var(--fill); }
.wrow-l { flex: 1; display: flex; flex-direction: column; gap: var(--sp-4); min-width: 0; }
.wrow-t { font-size: var(--fs-body); color: var(--ink); font-weight: 500; }
.wrow-s { font-size: var(--fs-caption); color: var(--ink-2); }
.wrow-go { font-size: var(--fs-sub); color: var(--brand-text); font-weight: 600; }
.qgrid { display: flex; flex-wrap: wrap; gap: var(--sp-8); margin-bottom: var(--sp-12); }
.qn { width: var(--acard-cell); height: var(--acard-cell); line-height: var(--acard-cell); text-align: center; border-radius: var(--r-full); font-size: var(--fs-sub); font-weight: 600; box-sizing: border-box; background: var(--fill); border: 1px solid var(--line); color: var(--ink-2); position: relative; }
.qn.ok { background: var(--ok-soft); border-color: var(--ok); color: var(--ok-strong); }
.qn.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad-strong); }
.qn.mk::after { content: ''; position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; border-radius: var(--r-full); background: var(--warn); border: 2px solid var(--card); }
.legend { display: flex; gap: var(--sp-16); flex-wrap: wrap; }
.lg { display: inline-flex; align-items: center; gap: var(--sp-4); font-size: var(--fs-caption); color: var(--ink-2); }
.dot { width: 10px; height: 10px; border-radius: var(--r-full); background: var(--fill); border: 1px solid var(--line); display: inline-block; }
.dot.ok { background: var(--ok-soft); border-color: var(--ok); }
.dot.bad { background: var(--bad-soft); border-color: var(--bad); }
.dot.mk { background: var(--warn); border-color: var(--warn); }
.rz-row { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); }
.rz-name { width: 80px; font-size: var(--fs-sub); color: var(--brand-text); flex: none; }
.rz-bar { flex: 1; height: 8px; border-radius: var(--r-full); background: var(--fill); overflow: hidden; }
.rz-fill { height: 100%; border-radius: var(--r-full); background: var(--warn); }
.rz-n { width: 28px; text-align: right; font-size: var(--fs-sub); color: var(--ink-2); flex: none; }
.share-row { display: flex; gap: var(--sp-8); flex-wrap: wrap; margin-top: var(--sp-16); }
.share-col { display: flex; flex-direction: column; gap: var(--sp-8); margin-top: var(--sp-16); }
.rp-types, .dreasons { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-12); }
.chip { display: inline-flex; align-items: center; height: var(--chip-h); padding: 0 var(--sp-12); border-radius: var(--r-full); border: 1px solid var(--line); background: var(--card); color: var(--ink-2); font-size: var(--fs-sub); }
.chip.on { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.rp-detail { width: 100%; box-sizing: border-box; min-height: 96px; padding: var(--sp-12); border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--fill); color: var(--ink); font-size: var(--fs-body); }
.d-tools { display: flex; justify-content: flex-end; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-8); }
.dstat { display: block; font-size: var(--fs-caption); color: var(--ink-2); margin: var(--sp-8) 0; }
.drz-t { font-size: var(--fs-sub); color: var(--ink-2); }
.d-links { display: flex; flex-wrap: wrap; gap: var(--sp-4); margin: var(--sp-12) 0; }
.dnav { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); }
.kbd-note { display: block; text-align: center; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-12); }

/* #ifdef H5 */
.page :deep(.kg-two__aside) { display: none; }
@media (min-width: 1024px) {
  .page { max-width: 1064px; margin: 0 auto; padding-bottom: var(--sp-24); }
  .page :deep(.kg-two__aside) { display: block; }
  .answers-mobile, .share-mobile { display: none; }
  .wrow, .qn, .curve-col, .cta, .rz-row, .chip, .kg-tool { cursor: pointer; }
}
/* #endif */
</style>
