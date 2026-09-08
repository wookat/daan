<template>
  <view class="wrap stats">
    <!-- 未登录：横幅（不占首屏大块） -->
    <view v-if="!authUser" class="strip">
      <kg-banner tone="info" icon="user-round" text="登录后错题与记录多端同步" action-text="登录 / 注册" :closable="false" @action="goLogin" />
    </view>

    <!-- 0 数据：整页折叠为 1 张解锁卡 -->
    <template v-if="!hasData">
      <kg-hero-card
        variant="plain"
        :label="'再答 ' + unlockLeft + ' 题解锁学习统计'"
        :value="totalDone"
        :total="UNLOCK_N"
        unit="题"
        :progress="unlockPct"
        :primary="{ text: '去刷 10 题' }"
        :secondary="{ text: '学习日历' }"
        @primary="goPractice('')"
        @secondary="goCalendar"
      >
        <text class="unlock-s">答满 {{ UNLOCK_N }} 题后，这里会出现学习热力图、五模块能力雷达、错题分布与考点掌握度地图</text>
      </kg-hero-card>
      <view v-if="loadErr" class="err-row">
        <kg-empty-state compact icon="wifi-off" title="统计加载失败" :desc="loadErr" cta-text="重试" @cta="load" />
      </view>
    </template>

    <kg-two-col v-else>
      <template #main>
        <kg-hero-card variant="plain" label="累计刷题（含模考）" :value="totalDone" unit="题" :streak="streakDays" :secondary="{ text: '学习日历' }" @secondary="goCalendar">
          <kg-stat-row :items="heroStats" />
        </kg-hero-card>

        <predict-card ref="predict" />

        <!-- 今日待办 -->
        <kg-card v-if="(reco && reco.items.length) || dueN" class="sec">
          <kg-section-header title="今日待办" />
          <view v-if="dueN" class="todo-row">
            <view class="todo-ico is-warn"><l-icon name="book-open" :size="20" tone="warn" /></view>
            <view class="todo-main">
              <text class="todo-name">错题到期复习</text>
              <text class="todo-meta">{{ dueN }} 题今日待复习</text>
            </view>
            <kg-button variant="primary" size="sm" @click="goBook">去复习</kg-button>
          </view>
          <view v-for="(r, i) in (reco ? reco.items : [])" :key="i" class="todo-row">
            <view class="todo-ico"><l-icon name="target" :size="20" tone="brand" /></view>
            <view class="todo-main">
              <text class="todo-name">{{ r.label || r.submodule }}</text>
              <text class="todo-meta">{{ r.reason }} · 正确率 {{ Math.round(r.acc * 100) }}%（{{ r.n }}题）</text>
            </view>
            <kg-button variant="primary" size="sm" @click="goSub(r.module, r.submodule, r.tag3, 'reco')">练10题</kg-button>
          </view>
          <text class="note">基于你的做题历史（正确率/近期趋势/遗忘曲线/考频）自动推荐</text>
        </kg-card>

        <!-- 热力图 -->
        <kg-card class="sec">
          <kg-section-header title="学习热力图 · 近 12 周">
            <template #right><text class="hm-total">学习 {{ hmTotal }} 次(含复习)</text></template>
          </kg-section-header>
          <view class="hm-body">
            <view class="hm-ylab">
              <text v-for="w in ['一', '', '三', '', '五', '', '日']" :key="w + 'y'" class="hm-yl">{{ w }}</text>
            </view>
            <view class="hm-grid">
              <view v-for="(col, ci) in hmCols" :key="ci" class="hm-col">
                <view v-for="(c, ri) in col" :key="ri" class="hm-c" :class="'lv' + c.lv + (c.future ? ' fut' : '')" />
              </view>
            </view>
          </view>
          <view class="hm-legend">
            <text class="hm-note">统计练习/模考/复习作答</text>
            <text class="hm-lt">少</text>
            <view v-for="i in [0, 1, 2, 3, 4]" :key="'lg' + i" class="hm-c" :class="'lv' + i" />
            <text class="hm-lt">多</text>
          </view>
        </kg-card>

        <!-- 雷达 -->
        <kg-card class="sec">
          <kg-section-header title="五模块能力雷达" />
          <kg-empty-state v-if="!hasRadar" compact icon="chart-column" title="还没有能力数据" desc="刷几题就能生成你的五模块能力画像" cta-text="去刷题" @cta="goPractice('')" />
          <view v-else class="radar-flex">
            <view class="radar-box">
              <view class="radar">
                <view v-for="i in 4" :key="'g' + i" class="ring" :style="ringStyle(i)" />
                <view class="poly" :style="polyStyle" />
                <view v-for="(a, i) in axes" :key="a.key" class="axis-label" :style="labelStyle(i)">
                  <text class="al-name">{{ a.name }}</text>
                  <text class="al-val num">{{ a.pct }}%</text>
                </view>
              </view>
            </view>
            <view class="radar-side">
              <text v-if="weakAxes.length" class="rs-t">最薄弱</text>
              <view v-for="a in weakAxes" :key="a.key" class="rs-row">
                <text class="rs-name">{{ a.name }}</text>
                <text class="rs-pct num">{{ a.pct }}%</text>
              </view>
              <kg-button v-if="weakAxes.length" variant="secondary" size="lg" block @click="goPractice(weakAxes[0].key, 'weak')">去补弱</kg-button>
            </view>
          </view>
        </kg-card>

        <!-- 错题模块分布 -->
        <kg-card class="sec">
          <kg-section-header title="错题模块分布" />
          <kg-empty-state v-if="loadErr && !byModule.length" compact icon="wifi-off" title="加载失败" :desc="loadErr" cta-text="重试" @cta="load" />
          <kg-empty-state v-else-if="!byModule.length" compact icon="inbox" title="暂无错题" desc="答错的题会汇集到这里，按模块统计" />
          <view v-for="m in shownModules" :key="m.module" class="mrow" role="button" @click="goPractice(m.module)">
            <view class="mrow-main">
              <view class="blabel">
                <text>{{ modName(m.module) }}</text>
                <text class="bn num">×{{ m.n }}</text>
              </view>
              <kg-progress :value="m.n" :max="total" :module="m.module" />
            </view>
            <l-icon name="chevron-right" :size="20" tone="faint" />
          </view>
          <view v-if="byModule.length > 3" class="more" role="button" @click="modOpen = !modOpen">{{ modOpen ? '收起' : '展开全部 ' + byModule.length + ' 个模块' }}</view>
        </kg-card>

        <!-- 高频错题型 -->
        <kg-card class="sec">
          <kg-section-header title="高频错题型 TOP10" />
          <kg-empty-state v-if="loadErr && !byType.length" compact icon="wifi-off" title="加载失败" :desc="loadErr" cta-text="重试" @cta="load" />
          <kg-empty-state v-else-if="!byType.length" compact icon="inbox" title="暂无数据" desc="错题积累后会按题型聚合" />
          <view v-else class="top-chips">
            <view v-for="t in shownTypes" :key="t.question_type" class="top-chip" role="button" @click="goPractice('')">
              <text class="tc-name">{{ typeName(t.question_type) }}</text>
              <text class="tc-n num">×{{ t.n }}</text>
            </view>
            <view v-if="byType.length > 5" class="top-chip is-more" role="button" @click="topOpen = !topOpen">{{ topOpen ? '收起' : '+' + (byType.length - 5) }}</view>
          </view>
        </kg-card>

        <!-- 错因分布 -->
        <kg-card v-if="byReason.length" class="sec">
          <kg-section-header title="错因分布" />
          <view v-for="r in byReason" :key="r.error_reason" class="brow">
            <view class="blabel">
              <text>{{ r.error_reason }}</text>
              <text class="bn num">×{{ r.n }}</text>
            </view>
            <view class="bar"><view class="fill is-warn" :style="{ width: (r.n / reasonTotal) * 100 + '%' }" /></view>
          </view>
        </kg-card>

        <!-- 近 7 日 -->
        <kg-card v-if="trendHas" class="sec">
          <kg-section-header title="近 7 日正确率" />
          <view class="trend7">
            <view v-for="t in trend" :key="t.key" class="tcol">
              <text class="tpct num">{{ t.done ? t.pct + '%' : '' }}</text>
              <view class="tbar">
                <view class="tfill" :class="{ 'is-lo': t.done && t.pct < 60 }" :style="{ height: (t.done ? Math.max(t.pct, 6) : 0) + '%' }" />
              </view>
              <text class="tday">{{ t.label }}</text>
            </view>
          </view>
        </kg-card>

        <!-- 成长轨迹 -->
        <kg-card v-if="growth && growth.weeks.length >= 2" class="sec">
          <kg-section-header title="成长轨迹（周正确率）" />
          <kg-chip-row v-model="gwMod" :options="gwOptions" size="sm" />
          <view class="gw-row" v-for="w in growthRows" :key="w.week">
            <text class="gw-wk">{{ w.label }}</text>
            <view class="bar thin">
              <view class="fill is-ok" :class="{ 'is-bad': w.pct < 60, 'is-warn': w.pct >= 60 && w.pct < 80 }" :style="{ width: w.pct + '%' }" />
            </view>
            <text class="gw-pct num">{{ w.pct }}%<text class="gw-n">（{{ w.n }}题）</text></text>
          </view>
          <text v-if="growthDelta !== null" class="gw-delta" :class="{ 'is-up': growthDelta >= 0 }">
            {{ growthDeltaLabel }}{{ growthDelta >= 0 ? '提升' : '下降' }} {{ Math.abs(growthDelta) }} 个百分点
          </text>
        </kg-card>

        <!-- 申论 -->
        <kg-card v-if="slStats && slStats.total" class="sec">
          <kg-section-header title="申论学习" more="作答记录" @more="goShenlun" />
          <view class="sl-row">
            <text class="sl-num num">{{ slStats.total }}</text>
            <text class="sl-lab">次 AI 批改</text>
            <text v-if="slStats.last_at" class="sl-last">最近 {{ slLast }}</text>
          </view>
          <view class="sl-types">
            <kg-tag v-for="t in slStats.by_type" :key="t.qtype" tone="brand">{{ t.qtype }} ×{{ t.n }}</kg-tag>
          </view>
          <template v-if="slStats.issues && slStats.issues.length">
            <view class="sl-ih" role="button" @click="slIssuesOpen = !slIssuesOpen">
              <text>近期问题点（{{ slStats.issues.length }}）</text>
              <l-icon name="chevron-down" :size="16" tone="muted" class="chev" :class="{ 'is-open': slIssuesOpen }" />
            </view>
            <view v-if="slIssuesOpen">
              <view v-for="(it, i) in slStats.issues" :key="i" class="sl-issue">
                <kg-tag :tone="it.kind === '提升建议' ? 'warn' : 'bad'">{{ it.kind === '提升建议' ? '建议' : '遗漏' }}</kg-tag>
                <text class="sl-it">{{ it.text }}</text>
              </view>
              <text class="note">来自你最近的 AI 批改结果，供针对性强化</text>
            </view>
          </template>
        </kg-card>

        <!-- 模考趋势 -->
        <kg-card v-if="examTrendD" class="sec">
          <kg-section-header :title="'模考成绩趋势（近 ' + examTrendD.points.length + ' 次）'" />
          <view class="trend et-wrap">
            <view v-if="examTrendD.targetPct != null" class="et-target" :style="{ bottom: examTrendD.targetPct + '%' }">
              <text class="et-target-t">目标 {{ examTrendD.target }} 分</text>
            </view>
            <view
              v-for="p in examTrendD.points"
              :key="p.id"
              class="trend-col"
              role="button"
              :aria-label="'查看这次模考报告，得分 ' + p.score + ' 分'"
              :tabindex="0"
              @click="goExamReport(p.id)"
              @keydown.enter="goExamReport(p.id)"
            >
              <view class="trend-bar" :class="{ 'is-bad': p.score < examTrendD.scaleMax * 0.6, 'is-warn': p.score >= examTrendD.scaleMax * 0.6 && p.score < examTrendD.scaleMax * 0.8 }" :style="{ height: Math.max((p.score / examTrendD.scaleMax) * 100, 4) + '%' }" />
            </view>
          </view>
          <view class="trend-x">
            <text>旧</text>
            <text>最好 {{ examTrendD.best }} 分 · 最近 {{ examTrendD.latest }} 分</text>
            <text>新</text>
          </view>
          <text class="note">点柱查看单次报告 · 不同卷难度不同，仅供参考</text>
        </kg-card>

        <!-- 正确率趋势 -->
        <kg-card v-if="history.length >= 3" class="sec">
          <kg-section-header :title="'正确率趋势（近 ' + trendData.length + ' 次）'" />
          <view class="trend">
            <view v-for="(p, i) in trendData" :key="i" class="trend-col">
              <view class="trend-bar" :class="{ 'is-bad': p < 60, 'is-warn': p >= 60 && p < 80 }" :style="{ height: Math.max(p, 4) + '%' }" />
            </view>
          </view>
          <view class="trend-x">
            <text>旧</text>
            <text>近 {{ trendData.length }} 次平均 {{ trendAvg }}%</text>
            <text>新</text>
          </view>
        </kg-card>

        <!-- 速度趋势 -->
        <kg-card v-if="speedData.length >= 3" class="sec">
          <kg-section-header title="做题速度趋势（平均每题用时）" />
          <view class="trend">
            <view v-for="(s, i) in speedData" :key="i" class="trend-col">
              <view class="trend-bar" :class="{ 'is-bad': s > 90, 'is-warn': s > 60 && s <= 90 }" :style="{ height: Math.min(Math.max((s / 120) * 100, 6), 100) + '%' }" />
            </view>
          </view>
          <view class="trend-x">
            <text>旧</text>
            <text>近 {{ speedData.length }} 次平均 {{ speedAvg }}s/题（越短越好）</text>
            <text>新</text>
          </view>
        </kg-card>

        <!-- 练习记录 -->
        <kg-card v-if="history.length" class="sec">
          <kg-section-header title="练习记录" more="逐题回看" @more="goPracticeHistory" />
          <view v-for="(h, i) in history.slice(0, showAllHist ? 30 : 6)" :key="i" class="hist-row">
            <text class="hist-time num">{{ fmtHist(h.t) }}</text>
            <text class="hist-mod" :class="{ 'is-exam': h.exam }">{{ h.exam ? (h.exam === 'full' ? '全真模考' : '迷你模考') : h.module ? modName(h.module) : h.n >= 100 ? '全真模考' : '混合' }}</text>
            <text class="hist-n num">{{ h.correct }}/{{ h.n }}</text>
            <text class="hist-pct num" :class="{ 'is-bad': h.n && Math.round((h.correct / h.n) * 100) < 60 }">{{ h.n ? Math.round((h.correct / h.n) * 100) : 0 }}%</text>
          </view>
          <view v-if="history.length > 6" class="more" role="button" @click="showAllHist = !showAllHist">{{ showAllHist ? '收起' : '展开全部 ' + Math.min(history.length, 30) + ' 条' }}</view>
        </kg-card>

        <!-- 掌握度地图入口 -->
        <kg-card class="sec" clickable chevron @click="goMasteryMap">
          <view class="km-entry">
            <view class="km-cov" :style="kmCovStyle"><view class="km-cov-in num">{{ kmCov != null ? kmCov + '%' : '--' }}</view></view>
            <view class="grow">
              <text class="km-entry-t">考点掌握度地图</text>
              <text class="km-entry-s">三级考点五档色阶，看清每个考点的掌握度{{ kmCov != null ? '，已覆盖 ' + kmCov + '% 考点' : '' }}</text>
            </view>
          </view>
        </kg-card>

        <!-- 考点地图 -->
        <kg-card v-if="subMap.length" class="sec">
          <kg-section-header title="考点地图" />
          <view v-for="g in subMap" :key="g.module" class="km-group">
            <text class="km-mod">{{ g.name }}</text>
            <view class="km-items">
              <view v-for="s in g.subs" :key="s.sub" class="km-chip" :class="'is-' + s.lv" role="button" @click="goSub(g.module, s.sub)">
                <text class="km-name">{{ s.sub }}</text>
                <text class="km-pct num">{{ s.pct }}% · {{ s.done }}题</text>
              </view>
            </view>
          </view>
          <view class="km-legend">
            <kg-tag tone="bad">&lt;60% 薄弱</kg-tag>
            <kg-tag tone="warn">60–80%</kg-tag>
            <kg-tag tone="ok">&gt;80% 掌握</kg-tag>
            <text class="note">点考点直达专项练习</text>
          </view>
        </kg-card>

        <kg-card class="sec" clickable chevron @click="goPlanSetup">
          <view class="km-entry">
            <view class="todo-ico"><l-icon name="calendar" :size="20" tone="brand" /></view>
            <view class="grow">
              <text class="km-entry-t">学习计划</text>
              <text class="km-entry-s">报考画像与每日任务，可随时重新制定</text>
            </view>
          </view>
        </kg-card>
      </template>

      <template #aside>
        <!-- 成就勋章 -->
        <kg-card class="sec">
          <kg-section-header title="成就勋章">
            <template #right><text class="hm-total num">已获 {{ medals.filter((m) => m.got).length }}/{{ medals.length }}</text></template>
          </kg-section-header>
          <view class="medals">
            <view v-for="md in medals" :key="md.name" class="medal" :class="{ 'is-got': md.got }">
              <view class="m-ring" :style="medalRingStyle(md)"><view class="m-ring-in"><l-icon :name="md.icon" :size="22" :tone="md.got ? 'warn' : 'faint'" /></view></view>
              <text class="m-name">{{ md.name }}</text>
              <text class="m-sub">{{ md.got ? '已达成' : md.progress }}</text>
            </view>
          </view>
        </kg-card>

        <kg-card class="sec" clickable chevron @click="goCalendar">
          <view class="km-entry">
            <view class="todo-ico"><l-icon name="calendar-check" :size="20" tone="brand" /></view>
            <view class="grow">
              <text class="km-entry-t">学习日历</text>
              <text class="km-entry-s">连续打卡 {{ streakDays }} 天 · 里程碑与打卡海报</text>
            </view>
          </view>
        </kg-card>
      </template>
    </kg-two-col>
  </view>
</template>

<script>
import { request, snapPeek, anonUid, getAuthUser, fetchCheckinSummary, trackEvent, isStaleUidErr } from '../../api.js';
import { checkinStreak, dayKey, cnWeekKey } from '../../checkin.js';
import { examTrend } from '../../exam-trend.js';

const MODS = [
  { key: 'ziliao', name: '资料' },
  { key: 'shuliang', name: '数量' },
  { key: 'yanyu', name: '言语' },
  { key: 'panduan', name: '判断' },
  { key: 'changshi', name: '常识' },
];

/** 0 数据折叠阈值：答满该题数前整页只显示解锁卡 */
const UNLOCK_N = 10;

export default {
  data() {
    return { UNLOCK_N, authUser: getAuthUser(), loadErr: '', byModule: [], byType: [], byReason: [], masteredCount: 0, pstats: { byModule: {}, days: {} }, kmCov: null, history: [], showAllHist: false, growth: null, reco: null, dueN: 0, gwMod: '', slStats: null, slIssuesOpen: false, modOpen: false, topOpen: false, hmDays: null, svStreak: null, examAttempts: null, examTarget: null };
  },
  computed: {
    hasData() {
      return this.totalDone > 0 || this.byModule.length > 0 || this.history.length > 0 || this.hmTotal > 0;
    },
    unlockLeft() {
      return Math.max(UNLOCK_N - this.totalDone, 1);
    },
    unlockPct() {
      return Math.min(100, Math.round((this.totalDone / UNLOCK_N) * 100));
    },
    heroStats() {
      return [
        { label: '总正确率', value: this.accPct + '%', tone: 'ok' },
        { label: '连续打卡', value: this.streakDays, unit: '天', tone: 'brand' },
        { label: '近 12 周学习', value: this.hmTotal, unit: '次' },
      ];
    },
    gwOptions() {
      return [{ label: '整体', value: '' }].concat(this.gwMods.map((m) => ({ label: m.name, value: m.key })));
    },
    shownModules() {
      return this.modOpen ? this.byModule : this.byModule.slice(0, 3);
    },
    shownTypes() {
      return this.topOpen ? this.byType : this.byType.slice(0, 5);
    },
    weakAxes() {
      // 有作答（n>0）即有数据；全错模块 pct=0 仍是最薄弱
      return this.axes
        .filter((a) => a.n > 0)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 2);
    },
    slLast() {
      if (!this.slStats || !this.slStats.last_at) return '';
      const d = new Date(this.slStats.last_at * 1000);
      const p = (n) => (n < 10 ? '0' + n : n);
      return p(d.getMonth() + 1) + '-' + p(d.getDate());
    },
    examTrendD() {
      return examTrend(this.examAttempts, this.examTarget);
    },
    speedData() {
      return this.history
        .filter((h) => h.n && h.secs)
        .slice(0, 14)
        .reverse()
        .map((h) => Math.round(h.secs / h.n));
    },
    speedAvg() {
      const d = this.speedData;
      return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : 0;
    },
    gwMods() {
      if (!this.growth) return [];
      const seen = new Set();
      this.growth.weeks.forEach((w) => Object.keys(w.modules || {}).forEach((k) => seen.add(k)));
      return MODS.filter((m) => seen.has(m.key));
    },
    growthRows() {
      if (!this.growth) return [];
      return this.growth.weeks.slice(-8).map((w) => {
        const [y, wk] = w.week.split('-');
        const src = this.gwMod ? (w.modules || {})[this.gwMod] || { n: 0, c: 0 } : w;
        return {
          week: w.week,
          label: y.slice(2) + '年第' + Number(wk) + '周',
          n: src.n,
          pct: src.n ? Math.round((src.c / src.n) * 100) : 0,
        };
      });
    },
    growthDelta() {
      const r = this.growthRows;
      if (r.length < 2) return null;
      return r[r.length - 1].pct - r[r.length - 2].pct;
    },
    growthDeltaLabel() {
      // 服务端 weeks 只含有作答的周：末两行是「本周 / 上周」才这么叫，否则点名两周
      const r = this.growthRows;
      const last = r[r.length - 1];
      const prev = r[r.length - 2];
      const today = this.cnToday;
      const lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      if (last.week === cnWeekKey(today) && prev.week === cnWeekKey(lastWeek)) return '本周比上周';
      return last.label + '比' + prev.label;
    },
    trendData() {
      return this.history
        .slice(0, 14)
        .reverse()
        .map((h) => (h.n ? Math.round((h.correct / h.n) * 100) : 0));
    },
    trendAvg() {
      if (!this.trendData.length) return 0;
      return Math.round(this.trendData.reduce((a, b) => a + b, 0) / this.trendData.length);
    },
    total() {
      return this.byModule.reduce((s, m) => s + m.n, 0) || 1;
    },
    totalDone() {
      // 服务端 answer_log 全量口径优先（含时政，与热力图/掌握度地图同源），离线降级本地 pstats
      const sv = this.growth && this.growth.total;
      if (sv) return sv.n || 0;
      return Object.values(this.pstats.byModule).reduce((s, m) => s + m.done, 0);
    },
    accPct() {
      const done = this.totalDone;
      if (!done) return 0;
      const sv = this.growth && this.growth.total;
      const c = sv
        ? sv.c || 0
        : Object.values(this.pstats.byModule).reduce((s, m) => s + m.correct, 0);
      return Math.round((c / done) * 100);
    },
    hmDayMap() {
      // 服务端 answer_log（按 uid）优先，未返回时降级本地 pstats
      if (this.hmDays) {
        const m = {};
        for (const [k, v] of Object.entries(this.hmDays)) m[k] = (v && v.n) || 0;
        return m;
      }
      return (this.pstats && this.pstats.days) || {};
    },
    // 服务端 days 按东八区日界计日，网格/合计同样用东八区“今天”，避免跨时区设备当日作答不落图
    cnToday() {
      const now = new Date();
      return new Date(now.getTime() + (now.getTimezoneOffset() + 8 * 60) * 60000);
    },
    hmCols() {
      const days = this.hmDayMap;
      const today = this.cnToday;
      const dow = (today.getDay() + 6) % 7; // 周一=0
      const cols = [];
      // 本周周一往前推 11 周，共 12 列
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow - 77);
      for (let w = 0; w < 12; w++) {
        const col = [];
        for (let r = 0; r < 7; r++) {
          const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + r);
          const future = d > today;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const n = days[key] || 0;
          let lv = 0;
          if (n >= 30) lv = 4;
          else if (n >= 15) lv = 3;
          else if (n >= 5) lv = 2;
          else if (n > 0) lv = 1;
          col.push({ lv, future });
        }
        cols.push(col);
      }
      return cols;
    },
    hmTotal() {
      const days = this.hmDayMap;
      const today = this.cnToday;
      const dow = (today.getDay() + 6) % 7;
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow - 77);
      let s = 0;
      for (const [k, n] of Object.entries(days)) {
        const d = new Date(k + 'T00:00:00');
        if (d >= from && d <= today) s += n;
      }
      return s;
    },
    streakDays() {
      if (this.svStreak != null) return this.svStreak;
      return checkinStreak(this.pstats);
    },
    medals() {
      const done = this.totalDone;
      const streak = this.streakDays;
      const best = this.pstats.bestStreak || 0;
      const zhan = this.masteredCount;
      const m = (icon, name, cur, target, unit) => ({ icon, name, got: cur >= target, progress: cur + '/' + target + ' ' + unit, pct: Math.min(100, Math.round((cur / target) * 100)) });
      return [
        m('sprout', '初战告捷', done, 10, '题'),
        m('dumbbell', '小有所成', done, 100, '题'),
        m('trophy', '刷题大师', done, 500, '题'),
        m('flame', '三日不辍', streak, 3, '天'),
        m('zap', '七日连环', streak, 7, '天'),
        m('target', '十连对', best, 10, '连对'),
        m('swords', '斩题十道', zhan, 10, '道'),
        m('crown', '百题斩', zhan, 100, '道'),
      ];
    },
    trend() {
      const days = this.pstats.days || {};
      const dc = this.pstats.daysCorrect || {};
      const out = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = dayKey(d);
        const done = days[key] || 0;
        out.push({
          key,
          label: i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`,
          done,
          pct: done ? Math.round(((dc[key] || 0) / done) * 100) : 0,
        });
      }
      return out;
    },
    trendHas() {
      return this.trend.some((t) => t.done > 0);
    },
    reasonTotal() {
      return this.byReason.reduce((s, r) => s + r.n, 0) || 1;
    },
    axes() {
      // 服务端 answer_log 全量分模块（按 uid）优先，与掌握度地图/预测卡同口径；离线降级本地 pstats
      const sv = this.growth && this.growth.modules;
      return MODS.map((m) => {
        if (sv) {
          const s = sv[m.key] || { n: 0, c: 0 };
          const n = s.n || 0;
          return { ...m, n, pct: n ? Math.round(((s.c || 0) / n) * 100) : 0 };
        }
        const s = this.pstats.byModule[m.key] || { done: 0, correct: 0 };
        const n = s.done || 0;
        return { ...m, n, pct: n ? Math.round(((s.correct || 0) / n) * 100) : 0 };
      });
    },
    hasRadar() {
      return this.axes.some((a) => a.n > 0);
    },
    kmCovStyle() {
      const pct = this.kmCov || 0;
      return { background: `conic-gradient(var(--brand) 0% ${pct}%, var(--brand-soft) ${pct}% 100%)` };
    },
    subMap() {
      const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断' };
      const bySub = this.pstats.bySub || {};
      const groups = {};
      for (const [key, s] of Object.entries(bySub)) {
        const [mod, sub] = key.split('|');
        if (!sub || s.done < 3) continue;
        const pct = Math.round((s.correct / s.done) * 100);
        if (!groups[mod]) groups[mod] = [];
        groups[mod].push({ sub, done: s.done, pct, lv: pct < 60 ? 'lo' : pct <= 80 ? 'mid' : 'hi' });
      }
      return Object.entries(groups).map(([m, subs]) => ({
        module: m,
        name: NAMES[m] || m,
        subs: subs.sort((a, b) => a.pct - b.pct),
      }));
    },
    polyStyle() {
      const pts = this.axes.map((a, i) => {
        const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const r = (a.pct / 100) * 50;
        return `${50 + r * Math.cos(ang)}% ${50 + r * Math.sin(ang)}%`;
      });
      return { clipPath: `polygon(${pts.join(',')})` };
    },
  },
  onLoad() {
    this._onAuth = () => {
      const u = getAuthUser();
      if ((u ? u.uid : null) === (this.authUser ? this.authUser.uid : null)) return;
      this.resetAccountState();
    };
    uni.$on('authChanged', this._onAuth);
  },
  onUnload() {
    if (this._onAuth) uni.$off('authChanged', this._onAuth);
  },
  onShow() {
    this.refreshAccountData();
  },
  watch: {
    // 解锁卡 → 完整页切换后 predict-card 才挂载，补一次加载
    hasData(v) {
      if (v) this.$nextTick(() => this.$refs.predict && this.$refs.predict.load());
    },
  },
  methods: {
    refreshAccountData() {
      this.authUser = getAuthUser();
      this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
      this.history = this.loadHist();
      this.loadHeatmap();
      if (this.$refs.predict) this.$refs.predict.load();
      this.loadGrowth();
      this.loadReco();
      this.loadSlStats();
      this.loadMastery();
      this.loadExamTrend();
      this.load();
    },
    resetAccountState() {
      this.hmDays = null;
      this.svStreak = null;
      this.kmCov = null;
      this.examAttempts = null;
      this.examTarget = null;
      this.growth = null;
      this.reco = null;
      this.slStats = null;
      this.refreshAccountData();
    },
    loadHist() {
      // 本地练习记录按当前身份隔离；无 uid 的历史记录一次性归属到当前身份（升级前设备默认单身份）
      try {
        const uid = anonUid();
        let hist = uni.getStorageSync('practiceHistory') || [];
        if (hist.some((h) => !h.uid)) {
          hist = hist.map((h) => (h.uid ? h : { ...h, uid }));
          uni.setStorageSync('practiceHistory', hist);
        }
        return hist.filter((h) => h.uid === uid);
      } catch (e) {
        return [];
      }
    },
    async loadExamTrend() {
      try {
        const uid = encodeURIComponent(anonUid());
        const [att, prof] = await Promise.all([
          request('/api/exam/attempts?uid=' + uid + '&limit=20'),
          request('/api/profile?uid=' + uid)
        ]);
        this.examAttempts = att.items || [];
        this.examTarget = prof.profile && prof.profile.target_score != null ? prof.profile.target_score : null;
      } catch (e) {
        /* 非关键路径：失败不渲染 */
      }
    },
    goExamReport(id) {
      uni.navigateTo({ url: '/pkgA/exam/report?attempt_id=' + id });
    },
    async loadHeatmap() {
      try {
        const d = await fetchCheckinSummary();
        this.hmDays = d.days || {};
        if (d.streak != null) this.svStreak = d.streak;
        if (!this._hmTracked) {
          this._hmTracked = true;
          trackEvent('heatmap_view', 'stats');
        }
      } catch (e) { /* 降级用本地 pstats */ }
    },
    goCalendar() {
      uni.navigateTo({ url: '/pages/stats/calendar' });
    },
    goPlanSetup() {
      uni.setStorageSync('openPlanSetup', '1');
      uni.switchTab({ url: '/pages/home/home' });
    },
    goLogin() {
      uni.navigateTo({ url: '/pkgA/user/login' });
    },
    fmtHist(t) {
      const d = new Date(t);
      const p = (x) => (x < 10 ? '0' + x : x);
      return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    typeName(t) {
      if (!t) return '未分类';
      return String(t).replace(/^(数量关系|数学运算|资料分析|言语理解(与表达)?|判断推理|逻辑判断|常识判断|常识)[-－·：:]/, '');
    },
    modName(m) {
      const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断' };
      return NAMES[m] || m || '未分类';
    },
    goPractice(mod, source) {
      const KEY = { '资料分析': 'ziliao', '数量关系': 'shuliang', '言语理解': 'yanyu', '判断推理': 'panduan', '常识判断': 'changshi' };
      const k = KEY[mod] || (Object.values(KEY).includes(mod) ? mod : '');
      if (k) uni.setStorageSync('practiceLaunch', { kind: 'start', module: k, source: source || null });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    ringStyle(i) {
      const size = i * 25;
      return { width: size + '%', height: size + '%', left: (100 - size) / 2 + '%', top: (100 - size) / 2 + '%' };
    },
    labelStyle(i) {
      const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return {
        left: 50 + 58 * Math.cos(ang) + '%',
        top: 50 + 58 * Math.sin(ang) + '%',
      };
    },
    medalRingStyle(md) {
      const color = md.got ? 'var(--warn)' : 'var(--ink-4)';
      const pct = md.got ? 100 : md.pct;
      return { background: `conic-gradient(${color} 0% ${pct}%, var(--fill) ${pct}% 100%)` };
    },
    goBook() {
      uni.switchTab({ url: '/pages/book/book' });
    },
    async loadMastery() {
      const p = '/api/mastery/map?uid=' + encodeURIComponent(anonUid());
      const snap = snapPeek(p);
      if (snap) this.kmCov = snap.cold ? null : snap.coverage.pct;
      try {
        const d = await request(p);
        this.kmCov = d.cold ? null : d.coverage.pct;
      } catch (e) { /* 非关键路径 */ }
    },
    goMasteryMap() {
      uni.navigateTo({ url: '/pkgA/stats/mastery-map' });
    },
    goPracticeHistory() {
      uni.navigateTo({ url: '/pkgA/stats/practice-history' });
    },
    goSub(module, sub, tag3, source) {
      uni.setStorageSync('practicePreset', { module, submodule: sub, count: 10, adaptive: true, tag3: tag3 || null, source: source || null });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    async loadSlStats() {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      const p = '/api/shenlun/stats?uid=' + encodeURIComponent(uid);
      const snap = snapPeek(p);
      if (snap) this.slStats = snap;
      try {
        this.slStats = await request(p);
      } catch (e) { /* 非关键路径 */ }
    },
    goShenlun() {
      uni.navigateTo({ url: '/pkgA/shenlun/shenlun?tab=r' });
    },
    async loadGrowth() {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      const p = '/api/growth?uid=' + encodeURIComponent(uid);
      const snap = snapPeek(p);
      if (snap) this.growth = snap;
      try {
        this.growth = await request(p);
      } catch (e) { /* 非关键路径 */ }
    },
    async loadReco() {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      const rp = '/api/recommend?uid=' + encodeURIComponent(uid);
      const rSnap = snapPeek(rp);
      if (rSnap) this.reco = rSnap;
      const vp = '/api/review?uid=' + encodeURIComponent(anonUid());
      const vSnap = snapPeek(vp);
      if (vSnap) this.dueN = vSnap.total || 0;
      try {
        this.reco = await request(rp);
      } catch (e) { /* 非关键路径 */ }
      try {
        const d = await request(vp);
        this.dueN = d.total || 0;
      } catch (e) { /* 非关键路径 */ }
    },
    applyStats(d) {
      this.byModule = d.by_module;
      this.byType = d.by_type;
      this.byReason = d.by_reason || [];
    },
    async load() {
      this.loadErr = '';
      const sp = '/api/stats?uid=' + encodeURIComponent(anonUid());
      const mp = '/api/mistakes?uid=' + encodeURIComponent(anonUid());
      // 快照即显：先用最近成功快照铺屏，真实响应到达后覆盖，避免 origin 长尾下长时间空白
      const sSnap = snapPeek(sp);
      if (sSnap) this.applyStats(sSnap);
      const mSnap = snapPeek(mp);
      if (mSnap) this.masteredCount = (mSnap.items || []).filter((m) => m.mastered).length;
      try {
        this.applyStats(await request(sp));
        const mk = await request(mp);
        this.masteredCount = (mk.items || []).filter((m) => m.mastered).length;
      } catch (e) {
        if (isStaleUidErr(e)) return;
        this.loadErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
  },
};
</script>

<style scoped>
.wrap { padding: var(--sp-16) var(--page-x) calc(var(--sp-40) + 50px + env(safe-area-inset-bottom)); }
.strip { margin-bottom: var(--card-gap); }
.strip :deep(.kg-banner) { min-height: var(--hit-min); }
.sec { margin-bottom: var(--card-gap); }
.unlock-s { display: block; font-size: var(--fs-sub); color: var(--ink-3); line-height: var(--lh-sub); }
.err-row { margin-top: var(--card-gap); }
.note { display: block; font-size: var(--fs-caption); color: var(--ink-3); line-height: var(--lh-caption); margin-top: var(--sp-8); }
.grow { flex: 1; min-width: 0; }
.more { text-align: center; font-size: var(--fs-sub); color: var(--brand-text); min-height: var(--hit-min); display: flex; align-items: center; justify-content: center; }

/* 热力图：4 档只用品牌色透明度，深色自动跟随 */
.hm-total { font-size: var(--fs-caption); color: var(--ink-3); }
.hm-body { display: flex; gap: var(--sp-4); margin-top: var(--sp-4); }
.hm-ylab { display: flex; flex-direction: column; justify-content: space-between; padding: 1px 0; }
.hm-yl { font-size: var(--fs-caption); color: var(--ink-3); height: 13px; line-height: 13px; }
.hm-grid { flex: 1; display: flex; gap: 3px; }
.hm-col { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.hm-c { width: 100%; height: 13px; border-radius: 3px; background: var(--fill); }
.hm-c.lv1 { background: var(--brand-soft-2); }
.hm-c.lv2 { background: var(--brand); opacity: 0.45; }
.hm-c.lv3 { background: var(--brand); opacity: 0.7; }
.hm-c.lv4 { background: var(--brand-press); }
.hm-c.fut { opacity: 0; }
.hm-legend { display: flex; align-items: center; gap: var(--sp-4); justify-content: flex-end; margin-top: var(--sp-8); }
.hm-legend .hm-c { width: 13px; flex: none; }
.hm-lt { font-size: var(--fs-caption); color: var(--ink-3); }
.hm-note { font-size: var(--fs-caption); color: var(--ink-3); margin-right: auto; }

/* 待办 */
.todo-row { display: flex; align-items: center; gap: var(--sp-12); min-height: 56px; border-bottom: 1px solid var(--line); }
.todo-row:last-of-type { border-bottom: none; }
.todo-ico { width: 40px; height: 40px; border-radius: var(--r-sm); background: var(--brand-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.todo-ico.is-warn { background: var(--warn-soft); }
.todo-main { flex: 1; min-width: 0; }
.todo-name { display: block; font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.todo-meta { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: 2px; }

/* 雷达 */
.radar-flex { display: flex; align-items: center; gap: var(--sp-12); padding: var(--sp-16) 0 var(--sp-8); }
.radar-box { flex: 1; display: flex; justify-content: center; }
.radar { position: relative; width: 160px; height: 160px; }
.radar-side { width: 110px; flex-shrink: 0; }
/* #ifdef H5 */
@media (max-width: 413px) {
  .radar-flex { flex-direction: column; gap: var(--sp-16); }
  .radar-box { padding: var(--sp-8) 0; }
  .radar-side { width: 100%; }
}
/* #endif */
.rs-t { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-bottom: var(--sp-4); }
.rs-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-4); }
.rs-name { font-size: var(--fs-sub); font-weight: 600; color: var(--ink); }
.rs-pct { font-size: var(--fs-sub); color: var(--bad-strong); font-weight: 600; }
.radar-side :deep(.kg-btn) { margin-top: var(--sp-8); }
.ring { position: absolute; border: 1px solid var(--line-strong); border-radius: var(--r-full); box-sizing: border-box; }
.poly { position: absolute; inset: 0; background: var(--brand); opacity: 0.35; border-radius: 1px; }
.axis-label { position: absolute; transform: translate(-50%, -50%); text-align: center; white-space: nowrap; }
.al-name { display: block; font-size: var(--fs-caption); color: var(--ink); font-weight: 600; }
.al-val { display: block; font-size: var(--fs-caption); color: var(--brand-text); }

/* 分布条 */
.mrow { display: flex; align-items: center; gap: var(--sp-8); min-height: 56px; border-bottom: 1px solid var(--line); }
.mrow:last-of-type { border-bottom: none; }
.mrow-main { flex: 1; min-width: 0; }
.brow { margin: var(--sp-8) 0; }
.blabel { display: flex; justify-content: space-between; align-items: center; font-size: var(--fs-sub); color: var(--ink); margin-bottom: var(--sp-4); }
.bn { font-size: var(--fs-caption); color: var(--ink-3); }
.bar { background: var(--prog-track); border-radius: var(--r-full); height: 8px; position: relative; overflow: hidden; }
.bar.thin { height: 6px; flex: 1; }
.fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--brand); border-radius: var(--r-full); transition: width var(--dur-slow) var(--ease-standard); }
.fill.is-ok { background: var(--ok); }
.fill.is-warn { background: var(--warn); }
.fill.is-bad { background: var(--bad); }
.top-chips { display: flex; flex-wrap: wrap; gap: var(--sp-8); }
.top-chip { display: flex; align-items: center; gap: var(--sp-4); background: var(--brand-soft); border-radius: var(--r-full); padding: 0 var(--sp-12); min-height: 32px; }
.tc-name { font-size: var(--fs-sub); color: var(--brand-text); font-weight: 600; }
.tc-n { font-size: var(--fs-caption); color: var(--ink-3); }
.top-chip.is-more { background: var(--fill); color: var(--ink-2); font-size: var(--fs-sub); font-weight: 600; }

/* 近 7 日 */
.trend7 { display: flex; align-items: flex-end; gap: var(--sp-8); height: 110px; padding-top: var(--sp-4); }
.tcol { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.tpct { font-size: var(--fs-caption); color: var(--brand-text); height: 14px; line-height: 14px; }
.tbar { flex: 1; width: 18px; background: var(--prog-track); border-radius: var(--r-full); display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
.tfill { width: 100%; background: var(--brand); border-radius: var(--r-full); }
.tfill.is-lo { background: var(--warn); }
.tday { font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }

/* 勋章 */
.medals { display: flex; flex-wrap: wrap; }
.medal { width: 25%; box-sizing: border-box; text-align: center; padding: var(--sp-8) var(--sp-4); }
.medal .m-name { color: var(--ink-3); }
.medal.is-got .m-name { color: var(--ink); }
.m-ring { width: 44px; height: 44px; border-radius: var(--r-full); margin: 0 auto var(--sp-4); display: flex; align-items: center; justify-content: center; }
.m-ring-in { width: 36px; height: 36px; border-radius: var(--r-full); background: var(--card); display: flex; align-items: center; justify-content: center; }
.m-name { display: block; font-size: var(--fs-caption); font-weight: 600; margin-top: var(--sp-4); }
.m-sub { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: 2px; }

/* 掌握度入口 / 考点地图 */
.km-entry { display: flex; align-items: center; gap: var(--sp-12); padding-right: var(--sp-24); }
.km-entry-t { display: block; font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.km-entry-s { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: 2px; }
.km-cov { width: 46px; height: 46px; border-radius: var(--r-full); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.km-cov-in { width: 34px; height: 34px; border-radius: var(--r-full); background: var(--card); display: flex; align-items: center; justify-content: center; font-size: var(--fs-caption); font-weight: 600; color: var(--brand-text); }
.km-group { margin-bottom: var(--sp-12); }
.km-mod { display: block; font-size: var(--fs-sub); font-weight: 600; color: var(--ink-2); margin-bottom: var(--sp-4); }
.km-items { display: flex; flex-wrap: wrap; gap: var(--sp-8); }
.km-chip { border-radius: var(--r-sm); padding: var(--sp-4) var(--sp-8); min-height: 36px; box-sizing: border-box; }
.km-chip.is-lo { background: var(--bad-soft); }
.km-chip.is-lo .km-name, .km-chip.is-lo .km-pct { color: var(--bad-strong); }
.km-chip.is-mid { background: var(--warn-soft); }
.km-chip.is-mid .km-name, .km-chip.is-mid .km-pct { color: var(--warn-strong); }
.km-chip.is-hi { background: var(--ok-soft); }
.km-chip.is-hi .km-name, .km-chip.is-hi .km-pct { color: var(--ok-strong); }
.km-name { display: block; font-size: var(--fs-sub); font-weight: 600; }
.km-pct { display: block; font-size: var(--fs-caption); margin-top: 1px; }
.km-legend { display: flex; gap: var(--sp-8); flex-wrap: wrap; align-items: center; margin-top: var(--sp-4); }
.km-legend .note { margin-top: 0; }

/* 记录 / 成长 / 申论 / 趋势 */
.hist-row { display: flex; align-items: center; gap: var(--sp-8); min-height: 40px; border-bottom: 1px solid var(--fill); }
.hist-time { font-size: var(--fs-caption); color: var(--ink-3); width: 84px; }
.hist-mod { font-size: var(--fs-sub); flex: 1; color: var(--ink); }
.hist-mod.is-exam { color: var(--warn-strong); font-weight: 600; }
.hist-n { font-size: var(--fs-sub); color: var(--ink-3); }
.hist-pct { font-size: var(--fs-sub); font-weight: 600; color: var(--ok-strong); width: 44px; text-align: right; }
.hist-pct.is-bad { color: var(--bad-strong); }
.gw-row { display: flex; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-8); }
.gw-wk { font-size: var(--fs-caption); color: var(--ink-3); width: 75px; flex-shrink: 0; white-space: nowrap; }
.gw-pct { font-size: var(--fs-caption); color: var(--ink); width: 90px; text-align: right; flex-shrink: 0; white-space: nowrap; }
.gw-n { color: var(--ink-3); }
.gw-delta { display: block; font-size: var(--fs-sub); color: var(--bad-strong); margin-top: var(--sp-4); }
.gw-delta.is-up { color: var(--ok-strong); }
.sec :deep(.kg-chips) { margin-bottom: var(--sp-8); }
.sl-row { display: flex; align-items: baseline; gap: var(--sp-4); margin: var(--sp-8) 0; }
.sl-num { font-size: var(--fs-h1); font-weight: 600; color: var(--brand-text); }
.sl-lab { font-size: var(--fs-sub); color: var(--ink-3); }
.sl-last { font-size: var(--fs-caption); color: var(--ink-3); margin-left: auto; }
.sl-types { display: flex; flex-wrap: wrap; gap: var(--sp-8); }
.sl-ih { display: flex; align-items: center; justify-content: space-between; font-size: var(--fs-sub); color: var(--ink-2); margin-top: var(--sp-8); min-height: var(--hit-min); }
.chev { transition: transform var(--dur-instant) var(--ease-standard); }
.chev.is-open { transform: rotate(180deg); }
.sl-issue { display: flex; align-items: flex-start; gap: var(--sp-8); margin-bottom: var(--sp-8); }
.sl-it { flex: 1; font-size: var(--fs-sub); color: var(--ink); line-height: var(--lh-sub); }
.trend { display: flex; align-items: flex-end; gap: var(--sp-4); height: 80px; padding-top: var(--sp-8); }
.trend-col { flex: 1; height: 100%; display: flex; align-items: flex-end; }
.trend-bar { width: 100%; border-radius: 3px 3px 0 0; background: var(--ok); min-height: 3px; }
.trend-bar.is-warn { background: var(--warn); }
.trend-bar.is-bad { background: var(--bad); }
.trend-x { display: flex; justify-content: space-between; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }
.et-wrap { position: relative; }
.et-target { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--warn-strong); z-index: 1; pointer-events: none; }
.et-target-t { position: absolute; right: 0; top: -16px; font-size: var(--fs-caption); color: var(--warn-strong); }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .wrap.stats { max-width: 1064px; }
  .radar { width: 200px; height: 200px; }
}
/* #endif */
</style>
