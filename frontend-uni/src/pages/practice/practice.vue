<template>
  <view class="wrap" :class="{ 'has-banner': picked }">
    <!-- 加载/空态（本页仅承载答题会话，选题在首页） -->
    <view v-if="!session" class="card spin" @click="quit">正在准备练习…点此返回首页</view>
    <!-- 答题 -->
    <view v-if="session && cur" class="card">
      <view v-if="beiMode || timedMode || cur.is_real" class="modechips">
        <text v-if="beiMode" class="mchip brand">背题模式</text>
        <text v-if="timedMode && !beiMode && !examMode" class="mchip info">限时训练</text>
        <text v-if="examMode" class="mchip bad">模考态 · 交卷统一判分</text>
      </view>
      <view class="rhead">
        <text class="tag" @click="cardOpen = true">{{ modName(cur.module) }}{{ lastSubmodule ? ' · ' + lastSubmodule : '' }} · {{ idx + 1 }}/{{ items.length }} ▾</text>
        <view class="hstats">
          <text class="timer" :class="{ examleft: examMode, overtime: timedMode && !examMode && qsecs > targetSecs }">{{ examMode ? fmtSecs(examLeft) : timedMode ? (qsecs > targetSecs ? '超时+' + fmtSecs(qsecs - targetSecs) : fmtSecs(targetSecs - qsecs)) : fmtSecs(qsecs) }}</text>
          <text v-if="!examMode" class="cnt okc">✓{{ right }}</text>
          <text v-if="!examMode" class="cnt badc">✗{{ wrongCount }}</text>
          <view v-if="streak >= 3" class="cnt fire"><l-icon name="flame" :size="13" color="#f97316" fill="#fdba74" /><text class="fire-n">{{ streak }}</text></view>
          <view class="fontbtn iconbtn" @click="toggleFav"><l-icon name="star" :size="16" :color="isFav ? '#f59e0b' : '#8a90a0'" :fill="isFav ? '#f59e0b' : 'none'" /></view>
          <text class="fontbtn" @click="toolsOpen = true">···</text>
          <text class="op" @click="quit">退出</text>
        </view>
      </view>
      <view v-if="toolsOpen" class="mask" @click="toolsOpen = false">
        <view class="sheet" @click.stop>
          <view class="sheet-h">
            <text class="sheet-t">练习工具</text>
            <view class="sheet-x" @click="toolsOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
          </view>
          <view class="tool-row" @click="cycleFont">
            <text class="tool-name">字号大小</text>
            <text class="tool-val">{{ ['小', '标准', '大'][fontLv] || '标准' }} · 点击切换</text>
          </view>
          <view v-if="!examMode" class="tool-row" @click="toggleBei">
            <text class="tool-name">背题模式</text>
            <text class="tool-val" :class="{ on: beiMode }">{{ beiMode ? '已开启' : '已关闭' }}</text>
          </view>
          <view v-if="!examMode" class="tool-row" @click="toggleAutoNext">
            <text class="tool-name">答对自动跳下一题</text>
            <text class="tool-val" :class="{ on: autoNext }">{{ autoNext ? '已开启' : '已关闭' }}</text>
          </view>
          <view v-if="!examMode && !beiMode" class="tool-row" @click="toggleTimed">
            <text class="tool-name">限时训练（按模块建议用时倒计时）</text>
            <text class="tool-val" :class="{ on: timedMode }">{{ timedMode ? '已开启' : '已关闭' }}</text>
          </view>
          <view class="tool-row" @click="toggleSfx">
            <text class="tool-name">答题音效</text>
            <text class="tool-val" :class="{ on: sfxOn }">{{ sfxOn ? '已开启' : '已关闭' }}</text>
          </view>
        </view>
      </view>
      <view class="progress"><view class="pfill" :style="{ width: (idx / items.length) * 100 + '%' }" /></view>
      <view v-if="offline" class="offline-tag"><l-icon name="plane" :size="14" color="#b45309" /> 离线题包模式 · 本地判分，作答记录联网后自动同步（AI 讲解等需联网）</view>
      <view v-if="cur.is_real" class="real-tag">真题{{ cur.exam_year ? ' · ' + cur.exam_year : '' }}{{ cur.exam_region ? ' · ' + cur.exam_region : '' }}</view>
      <view v-if="cur.group_seq" class="grp-tag">同材料题组 {{ cur.group_seq }}</view>
      <view class="q" :style="qStyle">
        <template v-if="qSegs"><text v-for="(s, si) in qSegs" :key="si" :class="{ qhl: s.hl }">{{ s.t }}</text></template>
        <template v-else>{{ cur.question }}</template>
      </view>
      <view v-if="qSegs && qSegs.some(s => s.hl)" class="qhl-tip">已标注题干重点（解析涉及的关键数字/关键词），对照检查是否找对了信息</view>
      <image v-if="cur.image" class="qimg" :src="imgUrl(cur.image)" mode="widthFix" @click="previewImg(cur.image)" />
      <view v-if="cur.image && cur.image_credit" class="qimg-credit">图源：{{ cur.image_credit }}</view>
      <view
        v-for="(v, k) in cur.options"
        :key="k"
        class="opt"
        :class="optClass(k)"
        :style="optStyle"
        @click="beiMode ? null : pick(k)"
      >
        <text class="okey">{{ k }}</text>
        <text class="otext">{{ v }}</text>
        <text v-if="!examMode && (picked || beiMode) && k === cur.answer" class="omark good">✓</text>
        <text v-else-if="!examMode && picked && k === picked" class="omark badm">✗</text>
      </view>
      <view v-if="(picked || beiMode) && !examMode" class="after">
        <view v-if="picked && picked !== cur.answer" class="reasons">
          <text class="rz-t">错因自评：</text>
          <text
            v-for="rz in REASONS"
            :key="rz"
            class="rz"
            :class="{ on: cur._reason === rz }"
            @click="setReason(rz)"
          >{{ rz }}</text>
        </view>
        <view class="exp-sec">
          <view class="exp-row">
            <text class="exp-k">正确答案</text>
            <text class="exp-ans" :class="beiMode || picked === cur.answer ? 'okc2' : 'badc2'">{{ cur.answer }}</text>
            <text v-if="timedMode && !beiMode && cur._secs != null" class="tm-cmp" :class="{ over: cur._secs > targetSecs }">用时 {{ cur._secs }}s / 目标 {{ targetSecs }}s</text>
          </view>
          <view v-if="qStatLine" class="exp-row">
            <text class="exp-k">全站数据</text>
            <text class="exp-v">{{ qStatLine }}</text>
          </view>
          <view v-if="cur.hs_explanation" class="exp-row col">
            <text class="exp-k hs">花生十三方法解析</text>
            <view class="exp hsx">{{ cur.hs_explanation }}</view>
            <template v-if="cur.xp_explanation">
              <text class="exp-k xp">{{ cur.xp_school || '第二名师视角' }}</text>
              <view class="exp xpx">{{ cur.xp_explanation }}</view>
            </template>
            <view class="hs-rate">
              <text v-if="hsRated[cur.id]" class="hs-rate-done">{{ hsRated[cur.id] === 'up' ? '已反馈：有用' : '已反馈：有误' }}</text>
              <template v-else>
                <view class="hs-rate-btn" @click="rateHs(cur, true)"><l-icon name="thumbs-up" :size="13" color="#3b6ff5" /><text>有用</text></view>
                <view class="hs-rate-btn bad" @click="rateHs(cur, false)"><l-icon name="thumbs-down" :size="13" color="#b91c1c" /><text>有误</text></view>
              </template>
            </view>
          </view>
          <view v-if="cur.explanation" class="exp-row col">
            <text class="exp-k">解析</text>
            <view class="exp">{{ cur.explanation }}</view>
          </view>
          <view v-if="kpChain" class="exp-row">
            <text class="exp-k">考点</text>
            <text class="exp-v">{{ kpChain }}</text>
          </view>
          <view v-if="cur.source" class="exp-row">
            <text class="exp-k">来源</text>
            <text class="exp-v">{{ cur.source }}</text>
          </view>
        </view>
        <view class="deep" @click="deepExplain">用花生十三方法详解这道题 ›</view>
        <view v-if="!cur._sz" class="report-link" @click="reportQuestion">{{ cur._reported ? '已提交纠错，感谢反馈' : '题目有问题？纠错' }}</view>
        <q-social-bar v-if="cur.id && !cur._sz" :question-id="cur.id" />
      </view>
    </view>

    <!-- 完成/结算 -->
    <view v-if="session && !cur" class="card done">
      <view v-if="!beiMode" class="ring" :style="ringStyle">
        <view class="ring-in">
          <text class="ring-n">{{ Math.round((right / items.length) * 100) }}%</text>
          <text class="ring-t">正确率</text>
        </view>
      </view>
      <view class="big">{{ beiMode ? '本组背完' : '本组完成' }}</view>
      <view v-if="!beiMode" class="sub">答对 {{ right }}/{{ items.length }} · 最高连对 {{ bestStreak }} 题<template v-if="autoSaved">，错题已自动加入错题本</template></view>
      <view v-else class="sub">已浏览 {{ items.length }} 道题的答案与解析</view>
      <view v-if="!beiMode && percentile != null" class="beat">本组正确率击败了 {{ percentile }}% 的刷题记录</view>
      <view v-if="!beiMode" class="report">
        <view class="report-row">
          <view class="report-cell"><text class="report-n">{{ fmtSecs(totalSecs) }}</text><text class="report-t">总用时</text></view>
          <view class="report-cell"><text class="report-n">{{ avgSecs }}s</text><text class="report-t">平均每题</text></view>
          <view class="report-cell"><text class="report-n badc2">{{ wrongCount }}</text><text class="report-t">错题</text></view>
        </view>
        <view v-if="moduleBreakdown.length >= 2" class="mb-list">
          <view v-for="b in moduleBreakdown" :key="b.mod" class="mb-row">
            <text class="mb-name">{{ modName(b.mod) }}</text>
            <view class="mb-bar"><view class="mb-fill" :class="{ lo: b.pct < 60, mid: b.pct >= 60 && b.pct < 80 }" :style="{ width: b.pct + '%' }" /></view>
            <text class="mb-pct">{{ b.right }}/{{ b.n }} · {{ b.pct }}%</text>
          </view>
        </view>
        <view class="report-grid">
          <view
            v-for="(q, i) in items"
            :key="i"
            class="acard-n"
            :class="!q._picked ? 'skip' : q._picked === q.answer ? 'ok' : 'bad'"
            @click="jumpTo(i)"
          >{{ i + 1 }}</view>
        </view>
        <view class="report-tip">点题号可回看题目与解析<template v-if="items.some(q => !q._picked)">（灰色为未作答）</template></view>
      </view>
      <button class="btn" @click="start(lastModule, lastSubmodule)">再来一组</button>
      <button v-if="!beiMode" class="btn ghost" style="margin-top: 16rpx" @click="shareResult">分享成绩</button>
      <button class="btn plain" style="margin-top: 8rpx" @click="quit">返回首页</button>
    </view>

    <!-- 答题卡 -->
    <view v-if="cardOpen && session" class="mask" @click="cardOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">答题卡</text>
          <view class="sheet-x" @click="cardOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <view class="acard-grid">
          <view
            v-for="(q, i) in items"
            :key="i"
            class="acard-n"
            :class="acardClass(q, i)"
            @click="jumpTo(i)"
          >{{ i + 1 }}</view>
        </view>
        <view class="acard-foot">已答 {{ answeredCount }}/{{ items.length }}<template v-if="!examMode"> · 正确 {{ right }}</template></view>
        <button v-if="examMode" class="btn" style="margin-top: 16rpx" @click="confirmFinishExam">交卷</button>
      </view>
    </view>

    <!-- 题目纠错弹层 -->
    <view v-if="reportOpen" class="mask" @click="reportOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">题目纠错</text>
          <view class="sheet-x" @click="reportOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <view class="rp-types">
          <text
            v-for="t in reportTypes"
            :key="t"
            class="rp-chip"
            :class="{ on: reportType === t }"
            @click="reportType = t"
          >{{ t }}</text>
        </view>
        <textarea
          v-model="reportDetail"
          class="rp-detail"
          placeholder="补充说明（选填，500 字以内）"
          :maxlength="500"
        />
        <button class="btn rp-submit" :disabled="!reportType || reportBusy" @click="submitReport">
          {{ reportBusy ? '提交中…' : '提交纠错' }}
        </button>
      </view>
    </view>

    <!-- 判分横幅 -->
    <view v-if="cur && !examMode && (picked || beiMode)" class="banner" :class="beiMode || picked === cur.answer ? 'bok' : 'bbad'">
      <view class="binfo">
        <text class="btitle">{{ beiMode ? '背题模式 · 答案 ' + cur.answer : picked === cur.answer ? '✓ 回答正确' + (streak >= 3 ? ' · 连对 ' + streak + ' 题！' : '') : '✗ 正确答案 ' + cur.answer }}</text>
        <text v-if="!beiMode && picked !== cur.answer" class="bsub">{{ cur._saved ? '已自动存入错题本' : '' }}</text>
      </view>
      <button v-if="!beiMode && picked === cur.answer && autoTimer" class="bnext bstay" @click="stayHere">看解析</button>
      <button class="bnext" :class="beiMode || picked === cur.answer ? 'nok' : 'nbad'" @click="next">
        {{ idx + 1 < items.length ? '下一题' : '完成' }}
      </button>
    </view>
  </view>
</template>

<script>
import { request, BASE_URL, anonUid, exportPdf, removeFav, setFav, fetchCheckinBadges, trackEvent } from '../../api.js';
import { drawOffline, enqueueAnswers, enqueueMistake, flushOfflineQueue } from '../../offline.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };
const COLORS = {
  changshi: { bg: '#FEF3C7', fg: '#B45309' },
  shuliang: { bg: '#DBEAFE', fg: '#1D4ED8' },
  panduan: { bg: '#EDE9FE', fg: '#6D28D9' },
  ziliao: { bg: '#D1FAE5', fg: '#047857' },
  yanyu: { bg: '#FEE2E2', fg: '#B91C1C' },
};

function loadPStats() {
  return uni.getStorageSync('pstats') || { byModule: {}, days: {} };
}
function savePStats(s) {
  uni.setStorageSync('pstats', s);
}

export default {
  data() {
    return {
      counts: [],
      session: false,
      offline: false,
      items: [],
      idx: 0,
      picked: '',
      right: 0,
      lastModule: null,
      lastSubmodule: null,
      subSelect: null,
      paperSheet: false,
      customOpen: false,
      reportOpen: false,
      reportType: '',
      reportDetail: '',
      reportBusy: false,
      reportTypes: ['答案错误', '解析错误', '题干或选项错字', '图片缺失', '分类错误', '重复题', '其他'],
      exporting: false,
      expSheet: true,
      expAns: true,
      expOnly: false,
      plan: null,
      profile: undefined,
      planToday: null,
      guideHide: uni.getStorageSync('planGuideHide') ? true : false,
      setupOpen: false,
      setupStep: 1,
      setupBusy: false,
      pf: { exam_type: '国考', target_region: '', exam_date: '', target_score: 70, daily_minutes: 60, base_level: '零基础' },
      FOCUS_MODS: { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断' },
      papers: [],
      paperRegion: null,
      subProg: {},
      submodules: [],
      streak: 0,
      bestStreak: 0,
      autoSaved: false,
      resultSent: false,
      percentile: null,
      examMode: false,
      examLeft: 0,
      examTimer: null,
      pstats: { byModule: {}, days: {} },
      autoTimer: null,
      cardOpen: false,
      toolsOpen: false,
      qsecs: 0,
      qTimer: null,
      fontLv: uni.getStorageSync('fontLv') || 1,
      sfxOn: uni.getStorageSync('sfxOff') ? false : true,
      beiMode: false,
      timedMode: uni.getStorageSync('timedMode') ? true : false,
      favs: uni.getStorageSync('favQuestions') || [],
      autoNext: uni.getStorageSync('autoNextOff') ? false : true,
      daily: uni.getStorageSync('dailyPlan') || { days: {} },
      szDaily: uni.getStorageSync('szDaily') || { days: {} },
      realMode: uni.getStorageSync('realMode') ? true : false,
      realYears: [],
      realRegions: [],
      realYear: uni.getStorageSync('realYear') || null,
      realRegion: uni.getStorageSync('realRegion') || null,
      groupSize: uni.getStorageSync('groupSize') || 10,
      dailyGoal: uni.getStorageSync('dailyGoal') || 20,
      hsRated: {},
      announce: null,
      REASONS: ['粗心大意', '概念不清', '方法不会', '纯蒙的'],
    };
  },
  computed: {
    moduleBreakdown() {
      const map = {};
      for (const q of this.items) {
        const m = q.module || 'other';
        if (!map[m]) map[m] = { mod: m, n: 0, right: 0 };
        map[m].n++;
        if (q._picked && q._picked === q.answer) map[m].right++;
      }
      const order = ['changshi', 'yanyu', 'shuliang', 'panduan', 'ziliao'];
      return Object.values(map)
        .map((b) => ({ ...b, pct: Math.round((b.right / b.n) * 100) }))
        .sort((a, b) => order.indexOf(a.mod) - order.indexOf(b.mod));
    },
    paperRegions() {
      const seen = [];
      for (const p of this.papers) {
        if (p.region && !seen.includes(p.region)) seen.push(p.region);
      }
      return seen.sort((a, b) => a.localeCompare(b, 'zh'));
    },
    shownPapers() {
      return this.paperRegion ? this.papers.filter((p) => p.region === this.paperRegion) : this.papers;
    },
    kpChain() {
      const q = this.cur;
      if (!q) return '';
      const parts = [this.modName(q.module)];
      if (q.submodule) parts.push(q.submodule);
      if (q.question_type) {
        const kp = q.question_type.replace(/^.+-/, '');
        if (kp && kp !== q.submodule) parts.push(kp);
      }
      return parts.filter(Boolean).join(' › ');
    },
    qStatLine() {
      const q = this.cur;
      if (!q || !q.attempt_count || q.attempt_count < 5 || q.correct_ratio == null) return '';
      const r = q.correct_ratio;
      const stars = '★'.repeat(r > 85 ? 1 : r > 70 ? 2 : r > 55 ? 3 : r > 40 ? 4 : 5);
      let s = `难度${stars} · 全站正确率 ${r}%（${q.attempt_count} 人次）`;
      if (q.most_wrong && q.most_wrong !== q.answer) s += ` · 易错项 ${q.most_wrong}`;
      return s;
    },
    qSegs() {
      const q = this.cur;
      if (!q || (!this.picked && !this.beiMode) || this.examMode) return null;
      const src = [q.hs_explanation, q.explanation, q.xp_explanation].filter(Boolean).join('\n');
      if (!src) return null;
      const toks = new Set();
      for (const m of src.match(/\d[\d.,]*[%％万亿倍]?/g) || []) {
        if (m.replace(/[.,]/g, '').length >= 2 && q.question.includes(m)) toks.add(m);
      }
      const CONJ = ['但是', '然而', '因此', '所以', '总之', '可见', '也就是说', '实际上', '换句话说', '不仅', '而且', '否则', '如果', '只有', '除非'];
      for (const c of CONJ) {
        if (src.includes(c) && q.question.includes(c)) toks.add(c);
      }
      if (!toks.size) return null;
      const list = [...toks].sort((a, b) => b.length - a.length).slice(0, 20);
      const text = q.question;
      const isD = (ch) => ch >= '0' && ch <= '9';
      const ivs = [];
      for (const t of list) {
        let p = 0;
        while ((p = text.indexOf(t, p)) !== -1) {
          const pre = text[p - 1];
          const post = text[p + t.length];
          if (!(isD(t[0]) && ((pre && isD(pre)) || (post && (isD(post) || post === '.')))) &&
              !ivs.some((v) => p < v[1] && p + t.length > v[0])) {
            ivs.push([p, p + t.length]);
          }
          p += t.length;
        }
      }
      if (!ivs.length) return null;
      ivs.sort((a, b) => a[0] - b[0]);
      const segs = [];
      let last = 0;
      for (const [s, e] of ivs) {
        if (s > last) segs.push({ t: text.slice(last, s), hl: false });
        segs.push({ t: text.slice(s, e), hl: true });
        last = e;
      }
      if (last < text.length) segs.push({ t: text.slice(last), hl: false });
      return segs;
    },
    targetSecs() {
      const t = { changshi: 40, yanyu: 50, shuliang: 90, panduan: 60, ziliao: 80 };
      return (this.cur && t[this.cur.module]) || 60;
    },
    todayCount() {
      const days = (this.pstats && this.pstats.days) || {};
      return days[new Date().toISOString().slice(0, 10)] || 0;
    },
    cur() {
      return this.items[this.idx] || null;
    },
    wrongCount() {
      return this.items.filter((q) => q._picked && q._picked !== q.answer).length;
    },
    weakModule() {
      let worst = null;
      let worstAcc = 1;
      for (const [m, s] of Object.entries(this.pstats.byModule)) {
        if (s.done < 5) continue;
        const acc = s.correct / s.done;
        if (acc < 0.8 && acc < worstAcc) {
          worstAcc = acc;
          worst = m;
        }
      }
      return worst;
    },
    isFav() {
      if (!this.cur) return false;
      return this.favs.some((f) => f.question === this.cur.question);
    },
    todayDone() {
      return !!this.daily.days[new Date().toISOString().slice(0, 10)];
    },
    szTodayDone() {
      return !!this.szDaily.days[new Date().toISOString().slice(0, 10)];
    },
    dailyModule() {
      const mods = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi'];
      const key = new Date().toISOString().slice(0, 10);
      let h = 0;
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      return mods[h % mods.length];
    },
    dailyModName() {
      return this.modName(this.dailyModule);
    },
    dailyStreak() {
      let n = 0;
      const d = new Date();
      if (!this.todayDone) d.setDate(d.getDate() - 1);
      while (this.daily.days[d.toISOString().slice(0, 10)]) {
        n++;
        d.setDate(d.getDate() - 1);
      }
      return n;
    },
    answeredCount() {
      return this.items.filter((q) => q._picked).length;
    },
    qStyle() {
      return { fontSize: [26, 30, 34][this.fontLv] + 'rpx' };
    },
    optStyle() {
      return { fontSize: [25, 29, 33][this.fontLv] + 'rpx' };
    },
    totalSecs() {
      return this.items.reduce((a, q) => a + (q._secs || 0), 0);
    },
    avgSecs() {
      return this.items.length ? Math.round(this.totalSecs / this.items.length) : 0;
    },
    ringStyle() {
      const pct = Math.round((this.right / (this.items.length || 1)) * 100);
      const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
      return { background: `conic-gradient(${color} 0% ${pct}%, var(--brand-soft) ${pct}% 100%)` };
    },
  },
  onShow() {
    this.pstats = loadPStats();
    this.favs = uni.getStorageSync('favQuestions') || [];
    this.realMode = uni.getStorageSync('realMode') ? true : false;
    this.realYear = uni.getStorageSync('realYear') || null;
    this.realRegion = uni.getStorageSync('realRegion') || null;
    this.groupSize = uni.getStorageSync('groupSize') || 10;
    this.dailyGoal = uni.getStorageSync('dailyGoal') || 20;
    const launch = uni.getStorageSync('practiceLaunch');
    if (launch && launch.kind) {
      uni.removeStorageSync('practiceLaunch');
      if (launch.kind === 'daily') {
        this.startDaily();
        return;
      }
      if (launch.kind === 'shizheng') {
        this.startShizheng();
        return;
      }
      if (launch.kind === 'szreview') {
        this.reviewShizheng();
        return;
      }
      if (launch.kind === 'paper') {
        this.startPaper({ source: launch.source, title: launch.title || '真题卷' });
        return;
      }
      if (launch.kind === 'reinforce') {
        this.startReinforce(launch);
        return;
      }
      if (launch.kind === 'start') {
        this.start(launch.module || null, launch.submodule || null, launch.count || null, !!launch.adaptive, launch.forceReal, launch.tag3 || null, launch.source || null);
        return;
      }
    }
    const redoSet = uni.getStorageSync('redoSet');
    if (redoSet && redoSet.length) {
      uni.removeStorageSync('redoSet');
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
      }
      this.items = redoSet.map((q) => ({ ...q, _saved: false }));
      this.idx = 0;
      this.picked = '';
      this.right = 0;
      this.streak = 0;
      this.bestStreak = 0;
      this.autoSaved = false;
      this.resultSent = false;
      this.percentile = null;
      this.lastModule = null;
      this.lastSubmodule = null;
      this.session = true;
      this.startQTimer();
      uni.showToast({ title: '错题重练开始', icon: 'none' });
      return;
    }
    const preset = uni.getStorageSync('practicePreset');
    if (preset && preset.module) {
      uni.removeStorageSync('practicePreset');
      this.start(preset.module, preset.submodule || null, preset.count || 10, preset.adaptive, undefined, preset.tag3 || null, preset.source || null);
      return;
    }
    const pm = uni.getStorageSync('practiceModule');
    if (pm) {
      uni.removeStorageSync('practiceModule');
      this.start(pm);
      return;
    }
    if (!this.session) this.tryResume();
  },
  onHide() {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.stopQTimer();
  },
  methods: {
    modName(m) {
      return NAMES[m] || m || '未知';
    },
    imgUrl(p) {
      return /^https?:/.test(p) ? p : (BASE_URL || '') + p;
    },
    previewImg(p) {
      uni.previewImage({ urls: [this.imgUrl(p)] });
    },
    modColor(m) {
      return COLORS[m] || { bg: 'var(--brand-soft)', fg: 'var(--brand)' };
    },
    modStat(m) {
      return this.pstats.byModule[m] || { done: 0, correct: 0 };
    },
    progText(c) {
      const s = this.modStat(c.module);
      if (!s.done) return c.n + ' 题';
      return `已刷 ${s.done}/${c.n} · 正确率 ${Math.round((s.correct / s.done) * 100)}%`;
    },
    progPct(c) {
      const s = this.modStat(c.module);
      return Math.min(100, (s.done / (c.n || 1)) * 100);
    },
    async loadAnnounce() {
      try {
        const d = await request('/api/announcement');
        const item = d.item;
        if (item && uni.getStorageSync('annDismissed') !== String(item.id)) this.announce = item;
      } catch (e) { /* 非关键路径 */ }
    },
    setGoal(g) {
      this.dailyGoal = g;
      uni.setStorageSync('dailyGoal', g);
    },
    dismissAnn() {
      if (this.announce) uni.setStorageSync('annDismissed', String(this.announce.id));
      this.announce = null;
    },
    async loadCounts() {
      try {
        const d = await request('/api/questions?limit=1');
        this.counts = d.counts || [];
      } catch (e) { /* 走下方重试 */ }
      if (this.counts.length) {
        this._countsTries = 0;
        return;
      }
      this._countsTries = (this._countsTries || 0) + 1;
      if (this._countsTries <= 20) setTimeout(() => this.loadCounts(), 3000);
    },
    async openModule(module) {
      try {
        const d = await request('/api/submodules?module=' + module);
        const items = (d.items || []).filter((s) => s.submodule);
        if (items.length < 2) {
          this.start(module);
          return;
        }
        this.submodules = items;
        this.subSelect = module;
        this.subProg = {};
        const uid = uni.getStorageSync('anonUid');
        if (uid) {
          request('/api/submodule_progress?uid=' + uid + '&module=' + module)
            .then((p) => { this.subProg = p.items || {}; })
            .catch(() => {});
        }
      } catch (e) {
        this.start(module);
      }
    },
    setReal(v) {
      this.realMode = v;
      uni.setStorageSync('realMode', v ? '1' : '');
      if (v && !this.realYears.length) this.loadRealFilters();
    },
    async loadRealFilters() {
      try {
        const d = await request('/api/real_filters');
        this.realYears = d.years || [];
        this.realRegions = d.regions || [];
      } catch (e) { /* 非关键路径 */ }
    },
    setRealYear(y) {
      this.realYear = y;
      uni.setStorageSync('realYear', y || '');
    },
    setRealRegion(r) {
      this.realRegion = r;
      uni.setStorageSync('realRegion', r || '');
    },
    setGroup(n) {
      this.groupSize = n;
      uni.setStorageSync('groupSize', n);
    },
    goMini() {
      uni.navigateTo({ url: '/pkgA/exam/exam?mini=1' });
    },
    goExamList() {
      uni.navigateTo({ url: '/pkgA/exam/list' });
    },
    goSearch() {
      uni.navigateTo({ url: '/pkgA/search/search' });
    },
    async openPapers() {
      this.paperSheet = true;
      if (this.papers.length) return;
      try {
        const d = await request('/api/papers');
        this.papers = d.items || [];
      } catch (e) {
        uni.showToast({ title: '试卷加载失败：' + e.message, icon: 'none' });
        this.paperSheet = false;
      }
    },
    async startPaper(p) {
      if (this._starting) return;
      this._starting = true;
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
      }
      uni.showLoading({ title: '加载试卷…', mask: true });
      try {
        const d = await request('/api/paper_questions?src=' + encodeURIComponent(p.source));
        const items = d.items || [];
        if (items.length < 20) {
          uni.showToast({ title: '试卷题目不足，换一张试试', icon: 'none' });
          return;
        }
        this.paperSheet = false;
        this.items = items;
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.resultSent = false;
        this.percentile = null;
        this.lastModule = null;
        this.lastSubmodule = null;
        this.session = true;
        this.examMode = true;
        this.examLeft = 120 * 60;
        this.startQTimer();
        if (this.examTimer) clearInterval(this.examTimer);
        this.examTimer = setInterval(() => {
          this.examLeft--;
          if (this.examLeft <= 0) {
            uni.showToast({ title: '时间到，自动交卷', icon: 'none' });
            this.finishExam();
          }
        }, 1000);
        uni.showToast({ title: p.title + ' 开始：交卷后统一判分', icon: 'none', duration: 1800 });
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      } finally {
        uni.hideLoading();
        this._starting = false;
      }
    },
    async startExam(full) {
      if (this._starting) return;
      this._starting = true;
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
      }
      uni.showLoading({ title: '组卷中…', mask: true });
      try {
        let items = [];
        if (full) {
          const plan = [
            ['changshi', 15],
            ['yanyu', 30],
            ['shuliang', 10],
            ['panduan', 30],
            ['ziliao', 15],
          ];
          const parts = await Promise.all(
            plan.map(([m, n]) => request('/api/questions?limit=' + n + '&module=' + m + '&real=1').catch(() => ({ items: [] })))
          );
          for (let i = 0; i < plan.length; i++) {
            let got = parts[i].items || [];
            if (got.length < plan[i][1]) {
              const extra = await request('/api/questions?limit=' + (plan[i][1] - got.length) + '&module=' + plan[i][0]).catch(() => ({ items: [] }));
              got = got.concat(extra.items || []);
            }
            items = items.concat(got.slice(0, plan[i][1]));
          }
        } else {
          const d = await request('/api/questions?limit=25');
          items = d.items || [];
        }
        if (items.length < 5) {
          uni.showToast({ title: '题目不足，稍后再试', icon: 'none' });
          return;
        }
        this.items = items;
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.resultSent = false;
        this.percentile = null;
        this.lastModule = null;
        this.lastSubmodule = null;
        this.session = true;
        this.examMode = true;
        this.examLeft = (full ? 100 : 20) * 60;
        this.startQTimer();
        if (this.examTimer) clearInterval(this.examTimer);
        this.examTimer = setInterval(() => {
          this.examLeft--;
          if (this.examLeft <= 0) {
            uni.showToast({ title: '时间到，自动交卷', icon: 'none' });
            this.finishExam();
          }
        }, 1000);
        uni.showToast({ title: (full ? '全真模考开始' : '模考开始') + '：交卷后统一判分', icon: 'none', duration: 1500 });
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      } finally {
        uni.hideLoading();
        this._starting = false;
      }
    },
    confirmFinishExam() {
      const left = this.items.filter((q) => !q._picked).length;
      if (!left) {
        this.finishExam();
        return;
      }
      uni.showModal({
        title: '确认交卷？',
        content: '还有 ' + left + ' 题未作答，交卷后未答题不得分',
        confirmText: '交卷',
        cancelText: '继续作答',
        success: (res) => {
          if (res.confirm) this.finishExam();
        },
      });
    },
    finishExam() {
      if (!this.examMode) return;
      this._wasExam = true;
      this.examMode = false;
      if (this.examTimer) {
        clearInterval(this.examTimer);
        this.examTimer = null;
      }
      this.cardOpen = false;
      this.stopQTimer();
      this.right = this.items.filter((q) => q._picked === q.answer).length;
      this.items.forEach((q) => {
        if (q._picked && q._picked !== q.answer) this.saveExamWrong(q);
      });
      this.idx = this.items.length;
      this.picked = '';
      this.submitResult();
    },
    async saveExamWrong(q) {
      if (q._saved) return;
      const optText = Object.entries(q.options).map(([k, v]) => `${k}.${v}`).join(' ');
      try {
        const res = await request('/api/mistakes', {
          method: 'POST',
          data: {
            uid: anonUid(),
            question_id: q._sz ? null : q.id || null,
            module: q.module,
            question_type: q.question_type || q.submodule,
            question_text: q.question + '\n' + optText,
            user_answer: q._picked,
            correct_answer: q.answer,
            explanation: q.explanation || '',
          },
        });
        q._mid = res.id;
        q._saved = true;
        this.autoSaved = true;
      } catch (e) {
        enqueueMistake({
          uid: anonUid(),
          question_id: q._sz ? null : q.id || null,
          module: q.module,
          question_type: q.question_type || q.submodule,
          question_text: q.question + '\n' + optText,
          user_answer: q._picked,
          correct_answer: q.answer,
          explanation: q.explanation || '',
        });
        q._saved = true;
        this.autoSaved = true;
      }
    },
    openPoster() {
      uni.navigateTo({ url: '/pkgA/social/poster' });
    },
    toggleFav() {
      if (!this.cur) return;
      const qid = this.cur._sz ? null : this.cur.id;
      const i = this.favs.findIndex((f) => f.question === this.cur.question);
      if (i >= 0) {
        this.favs.splice(i, 1);
        if (qid) removeFav(qid).catch(() => {});
        uni.showToast({ title: '已取消收藏', icon: 'none', duration: 900 });
      } else {
        if (qid) setFav(qid).catch(() => {});
        const { question, options, answer, explanation, hs_explanation, xp_explanation, xp_school, module, submodule, is_real, exam_year, exam_region, image, image_credit } = this.cur;
        this.favs.unshift({ t: Date.now(), question, options, answer, explanation, hs_explanation, xp_explanation, xp_school, module: this.cur._sz ? '时政' : module, submodule, is_real, exam_year, exam_region, image, image_credit });
        if (this.favs.length > 200) this.favs.length = 200;
        uni.showToast({ title: '已收藏，可在错题本查看', icon: 'none', duration: 900 });
      }
      uni.setStorageSync('favQuestions', this.favs);
    },
    startDaily() {
      this._daily = true;
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
        uni.showToast({ title: '每日一练按做题模式进行', icon: 'none', duration: 1200 });
      }
      this.start(this.dailyModule);
    },
    markDailyDone() {
      if (!this._daily) return;
      this._daily = false;
      this.daily.days[new Date().toISOString().slice(0, 10)] = true;
      uni.setStorageSync('dailyPlan', this.daily);
      uni.showToast({ title: '今日一练完成，打卡成功！', icon: 'none' });
    },
    _mapShizheng(q) {
      return {
        ...q,
        explanation: (q.explanation || '') + (q.source_note ? '\n【出处】' + q.source_note : ''),
        _sz: true,
        _saved: false,
      };
    },
    async startShizheng() {
      if (this._starting) return;
      this._starting = true;
      uni.showLoading({ title: '出题中…', mask: true });
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
      }
      try {
        const d = await request('/api/shizheng/daily');
        if (!d.items || !d.items.length) {
          uni.showToast({ title: '时政题库准备中，敬请期待', icon: 'none' });
          return;
        }
        this._shizheng = true;
        this._szDate = d.date;
        this.lastModule = '时政';
        this.lastSubmodule = null;
        this.items = d.items.map((q) => this._mapShizheng(q));
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.resultSent = false;
        this.percentile = null;
        this.session = true;
        this.startQTimer();
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      } finally {
        uni.hideLoading();
        this._starting = false;
      }
    },
    async reviewShizheng() {
      const day = new Date().toISOString().slice(0, 10);
      const rec = this.szDaily.days[day];
      if (!rec) {
        this.startShizheng();
        return;
      }
      uni.showLoading({ title: '加载回顾…', mask: true });
      try {
        const d = await request('/api/shizheng/daily');
        this._shizheng = false;
        this.lastModule = '时政';
        this.items = (d.items || []).map((q, i) => ({
          ...this._mapShizheng(q),
          _picked: (rec.picks || [])[i] || '',
          _logged: true,
          _saved: true,
        }));
        this.right = rec.right || 0;
        this.idx = this.items.length;
        this.picked = '';
        this.resultSent = true;
        this.session = true;
        this.stopQTimer();
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },
    markShizhengDone() {
      if (!this._shizheng) return;
      this._shizheng = false;
      const day = new Date().toISOString().slice(0, 10);
      this.szDaily.days[day] = { right: this.right, picks: this.items.map((q) => q._picked || '') };
      uni.setStorageSync('szDaily', this.szDaily);
      uni.showToast({ title: '时政每日一练完成！', icon: 'none' });
    },
    async startReinforce(launch) {
      if (this._starting) return;
      this._starting = true;
      this._source = launch.source || 'reinforce';
      uni.showLoading({ title: '组题中…', mask: true });
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
      }
      const uid = anonUid();
      const q =
        '/api/questions?mode=reinforce&limit=' + (launch.count || 5) +
        '&uid=' + encodeURIComponent(uid) +
        (launch.module ? '&module=' + launch.module : '') +
        (launch.submodule ? '&submodule=' + encodeURIComponent(launch.submodule) : '') +
        (launch.tag3 ? '&tag3=' + encodeURIComponent(launch.tag3) : '');
      try {
        const d = await request(q);
        if (!d.items || !d.items.length) {
          uni.showToast({ title: '该考点暂无新题，换个考点试试', icon: 'none' });
          return;
        }
        this._reinforce = { tag3: launch.tag3 || null, mastery: launch.mastery };
        this.lastModule = launch.module || null;
        this.lastSubmodule = launch.submodule || null;
        this.items = d.items.map((it) => ({ ...it, _saved: false }));
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.resultSent = false;
        this.percentile = null;
        this.session = true;
        this.startQTimer();
        uni.showToast({ title: '同考点强化开始：均为未做过的新题', icon: 'none', duration: 1500 });
      } catch (e) {
        uni.showToast({ title: '组题失败：' + e.message, icon: 'none' });
      } finally {
        uni.hideLoading();
        this._starting = false;
      }
    },
    async start(module, submodule, count, adaptive, forceReal, tag3, source) {
      if (this._starting) return;
      this._starting = true;
      // 推荐埋点：记录本次练习的入口来源（reco/weak 等），随 answer_log 落库
      this._source = source || null;
      uni.showLoading({ title: '出题中…', mask: true });
      this.lastModule = module;
      this.lastSubmodule = submodule || null;
      this.subSelect = null;
      const limit = count || this.groupSize || 10;
      const realQ = forceReal
        ? '&real=1'
        : this.realMode
        ? '&real=1' +
          (this.realYear ? '&year=' + this.realYear : '') +
          (this.realRegion ? '&region=' + encodeURIComponent(this.realRegion) : '')
        : '';
      const uid = uni.getStorageSync('anonUid');
      const uidQ = uid ? '&uid=' + encodeURIComponent(uid) : '';
      const adQ = adaptive && uid ? '&adaptive=1' : '';
      const grpQ = module === 'ziliao' && !submodule && !tag3 && !this.realMode ? '&grouped=1' : '';
      const tagQ = tag3 ? '&tag3=' + encodeURIComponent(tag3) : '';
      try {
        let d = await request(
          '/api/questions?limit=' + limit + realQ + uidQ + adQ + grpQ + tagQ +
            (module ? '&module=' + module : '') +
            (submodule ? '&submodule=' + encodeURIComponent(submodule) : '')
        );
        if (!d.items.length && tag3) {
          d = await request(
            '/api/questions?limit=' + limit + realQ + uidQ + adQ +
              (module ? '&module=' + module : '') +
              (submodule ? '&submodule=' + encodeURIComponent(submodule) : '')
          );
        }
        if (!d.items.length && submodule) {
          this.lastSubmodule = null;
          d = await request('/api/questions?limit=' + limit + realQ + uidQ + (module ? '&module=' + module : ''));
        }
        if (!d.items.length && this.realMode && (this.realYear || this.realRegion)) {
          uni.showToast({ title: '该年份/地区暂无此模块真题，已放宽筛选', icon: 'none' });
          d = await request('/api/questions?limit=' + limit + '&real=1' + uidQ + (module ? '&module=' + module : ''));
        }
        if (!d.items.length && this.realMode) {
          uni.showToast({ title: '真题还在搜集中，已切回题库模式', icon: 'none' });
          d = await request('/api/questions?limit=' + limit + uidQ + (module ? '&module=' + module : ''));
        }
        if (!d.items.length) {
          uni.hideLoading();
          this._starting = false;
          uni.showToast({ title: '该模块暂无题目', icon: 'none' });
          return;
        }
        this.items = d.items.map((q) => ({ ...q, _saved: false }));
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.resultSent = false;
        this.percentile = null;
        this.session = true;
        this.startQTimer();
        uni.setStorageSync('lastModule', module || '');
        this.offline = false;
        flushOfflineQueue();
      } catch (e) {
        // 无网络：尝试使用已下载的离线题包（本地判分，作答记录进队列待同步）
        const offItems = module ? drawOffline(module, limit) : null;
        if (offItems && offItems.length) {
          this.items = offItems.map((q) => ({ ...q, _saved: false }));
          this.idx = 0;
          this.picked = '';
          this.right = 0;
          this.streak = 0;
          this.bestStreak = 0;
          this.autoSaved = false;
          this.resultSent = false;
          this.percentile = null;
          this.offline = true;
          this.session = true;
          this.startQTimer();
          uni.setStorageSync('lastModule', module || '');
          uni.showToast({ title: '当前无网络，已切换离线题包模式', icon: 'none', duration: 1800 });
        } else {
          uni.showToast({ title: '加载失败：' + e.message + '（可在我的→离线题包提前下载）', icon: 'none', duration: 2200 });
        }
      } finally {
        uni.hideLoading();
        this._starting = false;
      }
    },
    recordStat(module, correct, submodule) {
      const s = this.pstats;
      if (!s.byModule[module]) s.byModule[module] = { done: 0, correct: 0 };
      s.byModule[module].done++;
      if (correct) s.byModule[module].correct++;
      if (submodule) {
        if (!s.bySub) s.bySub = {};
        const key = module + '|' + submodule;
        if (!s.bySub[key]) s.bySub[key] = { done: 0, correct: 0 };
        s.bySub[key].done++;
        if (correct) s.bySub[key].correct++;
      }
      const day = new Date().toISOString().slice(0, 10);
      s.days[day] = (s.days[day] || 0) + 1;
      if (!s.daysCorrect) s.daysCorrect = {};
      if (correct) s.daysCorrect[day] = (s.daysCorrect[day] || 0) + 1;
      savePStats(s);
      this.checkBadgeMilestone();
    },
    async checkBadgeMilestone() {
      const MILESTONES = [3, 7, 14, 30, 60, 100];
      const days = this.pstats.days || {};
      let streak = 0;
      const d = new Date();
      while (days[d.toISOString().slice(0, 10)]) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
      const seen = Number(uni.getStorageSync('badgeSeenMax') || 0);
      if (!MILESTONES.includes(streak) || streak <= seen || this._badgeChecking) return;
      this._badgeChecking = true;
      try {
        const b = await fetchCheckinBadges();
        if ((b.badges || []).some((x) => x.days === streak && x.unlocked)) {
          uni.setStorageSync('badgeSeenMax', streak);
          trackEvent('badge_unlock', 'badge', String(streak));
          uni.showModal({
            title: '🏅 解锁新徽章！',
            content: `连续打卡 ${streak} 天，坚持就是实力。生成专属海报，晒给考友看？`,
            confirmText: '生成海报',
            cancelText: '稍后再看',
            success: (r) => {
              if (r.confirm) uni.navigateTo({ url: '/pkgA/social/poster?badge=' + streak });
            },
          });
        }
      } catch (e) { /* 非关键路径 */ }
      this._badgeChecking = false;
    },
    fmtSecs(s) {
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },
    startQTimer() {
      this.stopQTimer();
      this.qsecs = 0;
      this.qTimer = setInterval(() => {
        this.qsecs++;
        if (this.timedMode && !this.examMode && !this.beiMode && this.qsecs === this.targetSecs + 1) {
          uni.showToast({ title: '超时了，考场上建议果断猜选跳过', icon: 'none' });
        }
      }, 1000);
    },
    stopQTimer() {
      if (this.qTimer) {
        clearInterval(this.qTimer);
        this.qTimer = null;
      }
    },
    toggleSfx() {
      this.sfxOn = !this.sfxOn;
      uni.setStorageSync('sfxOff', this.sfxOn ? '' : '1');
      uni.showToast({ title: this.sfxOn ? '音效已开启' : '音效已关闭', icon: 'none', duration: 800 });
    },
    playSfx(correct) {
      if (!this.sfxOn) return;
      // #ifdef H5
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!this._actx) this._actx = new Ctx();
        const ctx = this._actx;
        const t = ctx.currentTime;
        const mk = (freq, start, dur) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.12, t + start);
          g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
          o.connect(g).connect(ctx.destination);
          o.start(t + start);
          o.stop(t + start + dur);
        };
        if (correct) {
          mk(660, 0, 0.12);
          mk(880, 0.1, 0.18);
        } else {
          mk(220, 0, 0.25);
        }
      } catch (e) { /* 音效失败不影响刷题 */ }
      // #endif
      // #ifndef H5
      // 小程序 / App 无 WebAudio 合成能力 → 用触感反馈代替提示音
      uni.vibrateShort({ type: correct ? 'light' : 'heavy', fail: () => {} });
      // #endif
    },
    cycleFont() {
      this.fontLv = (this.fontLv + 1) % 3;
      uni.setStorageSync('fontLv', this.fontLv);
      uni.showToast({ title: '字号：' + ['小', '标准', '大'][this.fontLv], icon: 'none', duration: 800 });
    },
    acardClass(q, i) {
      if (i === this.idx) return 'cur';
      if (!q._picked) return '';
      if (this.examMode) return 'cur';
      return q._picked === q.answer ? 'ok' : 'bad';
    },
    jumpTo(i) {
      this.cardOpen = false;
      if (i === this.idx) return;
      if (this.autoTimer) {
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
      }
      this.idx = i;
      this.picked = this.items[i]._picked || '';
      if (!this.picked) this.startQTimer();
    },
    async setReason(rz) {
      const q = this.cur;
      q._reason = rz;
      this.$forceUpdate();
      if (q._mid) {
        try {
          await request('/api/mistakes/' + q._mid, { method: 'PATCH', data: { error_reason: rz } });
        } catch (e) { /* 非关键路径 */ }
      }
    },
    pick(k) {
      if (this.picked) return;
      this.picked = k;
      this.cur._picked = k;
      this.cur._secs = this.qsecs;
      this.stopQTimer();
      if (this.examMode) {
        setTimeout(() => {
          if (this.idx + 1 < this.items.length) {
            this.next();
            return;
          }
          const un = this.items.findIndex((q) => !q._picked);
          if (un === -1) this.finishExam();
          else {
            uni.showToast({ title: '还有未答题目，答完自动交卷', icon: 'none' });
            this.jumpTo(un);
          }
        }, 200);
        return;
      }
      const correct = k === this.cur.answer;
      if (!this.beiMode) this.logAttempts([this.cur]);
      this.recordStat(this.cur.module, correct, this.cur.submodule);
      this.playSfx(correct);
      try { uni.vibrateShort({ type: correct ? 'light' : 'medium' }); } catch (e) { /* 不支持则忽略 */ }
      if (correct) {
        this.right++;
        this.streak++;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        const s = this.pstats;
        if (this.streak > (s.bestStreak || 0)) {
          s.bestStreak = this.streak;
          savePStats(s);
        }
        if (this.autoNext) {
          this.autoTimer = setTimeout(() => {
            this.autoTimer = null;
            if (this.picked === k) this.next();
          }, 1200);
        }
      } else {
        this.streak = 0;
        this.saveWrong();
      }
      this.saveSession();
    },
    saveSession() {
      if (this.examMode || this.beiMode || this._shizheng || !this.session || !this.items.length) return;
      if (this.items.every((q) => q._picked)) {
        uni.removeStorageSync('pendingSession');
        return;
      }
      uni.setStorageSync('pendingSession', {
        t: Date.now(),
        items: this.items,
        idx: this.idx,
        right: this.right,
        streak: this.streak,
        bestStreak: this.bestStreak,
        lastModule: this.lastModule,
        lastSubmodule: this.lastSubmodule,
      });
    },
    tryResume() {
      const s = uni.getStorageSync('pendingSession');
      if (!s || !s.items || !s.items.length) return false;
      if (Date.now() - s.t > 24 * 3600 * 1000) {
        uni.removeStorageSync('pendingSession');
        return false;
      }
      const done = s.items.filter((q) => q._picked).length;
      uni.showModal({
        title: '继续上次练习？',
        content: '上次还有一组未做完（' + done + '/' + s.items.length + ' 题），是否继续？',
        confirmText: '继续',
        cancelText: '不用了',
        success: (res) => {
          if (res.confirm) {
            s.items.forEach((q) => { if (q._picked) q._logged = true; });
            this.items = s.items;
            this.idx = Math.min(s.idx, s.items.length - 1);
            this.picked = this.items[this.idx]._picked || '';
            this.right = s.right;
            this.streak = s.streak;
            this.bestStreak = s.bestStreak;
            this.lastModule = s.lastModule;
            this.lastSubmodule = s.lastSubmodule;
            this.autoSaved = false;
            this.resultSent = false;
            this.percentile = null;
            this.session = true;
            this.startQTimer();
          } else {
            uni.removeStorageSync('pendingSession');
          }
        },
      });
      return true;
    },
    async rateHs(q, up) {
      this.hsRated[q.id] = up ? 'up' : 'down';
      try {
        await request('/api/rate', { method: 'POST', data: { question_id: q.id, up } });
      } catch (e) { /* 静默失败 */ }
      uni.showToast({ title: up ? '感谢反馈' : '已记录，我们会核查这条解析', icon: 'none' });
    },
    stayHere() {
      if (this.autoTimer) {
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
      }
    },
    toggleAutoNext() {
      this.autoNext = !this.autoNext;
      uni.setStorageSync('autoNextOff', this.autoNext ? '' : '1');
      uni.showToast({ title: this.autoNext ? '答对自动跳下一题' : '答对后停留看解析', icon: 'none', duration: 1200 });
    },
    toggleTimed() {
      this.timedMode = !this.timedMode;
      uni.setStorageSync('timedMode', this.timedMode ? '1' : '');
      uni.showToast({ title: this.timedMode ? '限时训练开启：按考场建议用时倒计时' : '已关闭限时训练', icon: 'none', duration: 1500 });
    },
    toggleBei() {
      this.beiMode = !this.beiMode;
      uni.setStorageSync('beiMode', this.beiMode ? '1' : '');
      uni.showToast({ title: this.beiMode ? '背题模式：直接看答案解析，不计入正确率' : '已切回做题模式', icon: 'none', duration: 1500 });
    },
    optClass(k) {
      if (this.examMode) return k === this.picked ? 'sel' : '';
      if (this.beiMode) return k === this.cur.answer ? 'right' : '';
      if (!this.picked) return '';
      if (k === this.cur.answer) return 'right';
      if (k === this.picked) return 'wrong';
      return 'dim';
    },
    async saveWrong() {
      const q = this.cur;
      if (q._saved) return;
      const optText = Object.entries(q.options).map(([k, v]) => `${k}.${v}`).join(' ');
      try {
        const res = await request('/api/mistakes', {
          method: 'POST',
          data: {
            uid: anonUid(),
            question_id: q._sz ? null : q.id || null,
            module: q.module,
            question_type: q.question_type || q.submodule,
            question_text: q.question + '\n' + optText,
            user_answer: this.picked,
            correct_answer: q.answer,
            explanation: q.explanation || '',
          },
        });
        q._mid = res.id;
        if (q._reason) {
          request('/api/mistakes/' + q._mid, { method: 'PATCH', data: { error_reason: q._reason } });
        }
        q._saved = true;
        this.autoSaved = true;
      } catch (e) {
        // 断网：错题进本地队列，联网后补传
        enqueueMistake({
          uid: anonUid(),
          question_id: q._sz ? null : q.id || null,
          module: q.module,
          question_type: q.question_type || q.submodule,
          question_text: q.question + '\n' + optText,
          user_answer: this.picked,
          correct_answer: q.answer,
          explanation: q.explanation || '',
        });
        q._saved = true;
        this.autoSaved = true;
      }
    },
    shareResult() {
      const pct = Math.round((this.right / this.items.length) * 100);
      let txt =
        '我在考公助手刷了 ' + this.items.length + ' 道' + (this.lastModule ? this.modName(this.lastModule) : '行测') + '题，正确率 ' + pct + '%';
      if (this.bestStreak >= 3) txt += '，最高连对 ' + this.bestStreak + ' 题';
      if (this.percentile != null) txt += '，击败了 ' + this.percentile + '% 的刷题记录';
      txt += '！一起来刷：https://kaogong.zalize.com';
      uni.setClipboardData({
        data: txt,
        success: () => uni.showToast({ title: '成绩已复制，去粘贴给研友吧', icon: 'none', duration: 1600 }),
      });
    },
    reportQuestion() {
      const q = this.cur;
      if (!q || !q.id) return;
      this.reportType = '';
      this.reportDetail = '';
      this.reportOpen = true;
    },
    async submitReport() {
      const q = this.cur;
      if (!q || !this.reportType || this.reportBusy) return;
      this.reportBusy = true;
      try {
        await request('/api/question_report', {
          method: 'POST',
          data: { question_id: q.id, uid: anonUid(), type: this.reportType, detail: this.reportDetail.slice(0, 500) },
        });
        q._reported = true;
        this.reportOpen = false;
        uni.showToast({ title: '感谢反馈，我们会尽快核查', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '提交失败：' + e.message, icon: 'none' });
      } finally {
        this.reportBusy = false;
      }
    },
    deepExplain() {
      const q = this.cur;
      const optText = Object.entries(q.options).map(([k, v]) => `${k}.${v}`).join(' ');
      uni.setStorageSync('redoQuestion', q.question + '\n' + optText);
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    async loadPlan() {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      try {
        this.plan = await request('/api/daily_plan?uid=' + encodeURIComponent(uid));
      } catch (e) { /* 非关键路径 */ }
    },
    async loadProfile() {
      try {
        const d = await request('/api/profile?uid=' + encodeURIComponent(anonUid()));
        this.profile = d.profile || null;
        if (this.profile) await this.loadPlanToday();
        else this.planToday = null;
      } catch (e) { /* 非关键路径 */ }
    },
    async loadPlanToday() {
      try {
        this.planToday = await request('/api/plan/today?uid=' + encodeURIComponent(anonUid()));
      } catch (e) { /* 非关键路径 */ }
    },
    openSetup() {
      const p = this.profile || {};
      this.pf = {
        exam_type: p.exam_type || '国考',
        target_region: p.target_region || '',
        exam_date: p.exam_date || '',
        target_score: p.target_score || 70,
        daily_minutes: p.daily_minutes || 60,
        base_level: p.base_level || '零基础',
      };
      this.setupStep = 1;
      this.setupOpen = true;
    },
    skipGuide() {
      this.guideHide = true;
      uni.setStorageSync('planGuideHide', '1');
      uni.showToast({ title: '已跳过，可在统计页随时制定', icon: 'none', duration: 1500 });
    },
    async setupNext() {
      if (this.setupStep === 1 && !this.pf.exam_date) {
        uni.showToast({ title: '请先选择考试日期', icon: 'none' });
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
        this.profile = d.profile;
        await this.loadPlanToday();
        this.setupOpen = false;
        uni.showToast({ title: '学习计划已生成', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '保存失败：' + e.message, icon: 'none' });
      } finally {
        this.setupBusy = false;
      }
    },
    goTask(t) {
      if (t.done) return;
      if (t.type === 'mock') {
        this.goMini();
        return;
      }
      if (t.type === 'review') {
        this.goBook();
        return;
      }
      const remain = Math.max(t.target - (t.done_n || 0), 5);
      this.start(t.module || null, t.submodule || null, remain, !!t.submodule, t.real);
    },
    async exportPaper() {
      if (this.exporting) return;
      this.exporting = true;
      try {
        const limit = this.groupSize || 20;
        const realQ = this.realMode
          ? '&real=1' +
            (this.realYear ? '&year=' + this.realYear : '') +
            (this.realRegion ? '&region=' + encodeURIComponent(this.realRegion) : '')
          : '';
        const uid = uni.getStorageSync('anonUid');
        const d = await request('/api/questions?limit=' + limit + realQ + (uid ? '&uid=' + encodeURIComponent(uid) : ''));
        const ids = (d.items || []).map((q) => q.id).filter(Boolean);
        if (!ids.length) throw new Error('没有可导出的题目');
        const date = new Date();
        const title = (this.realMode ? '真题精选卷' : '练习卷') + ' ' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
        await exportPdf({
          title,
          question_ids: ids,
          include_answers: this.expOnly || this.expAns,
          answer_sheet: !this.expOnly && this.expSheet,
          include_questions: !this.expOnly,
        });
        uni.showToast({ title: 'PDF 已开始下载', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '导出失败：' + e.message, icon: 'none' });
      }
      this.exporting = false;
    },
    async setFocus(mod) {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      const next = this.plan && this.plan.focus === mod ? '' : mod;
      try {
        await request('/api/user_state', { method: 'POST', data: { uid, focus: next } });
        this.plan = await request('/api/daily_plan?uid=' + encodeURIComponent(uid));
        if (this.profile) this.loadPlanToday();
        if (next) uni.showToast({ title: '今日主攻已设为' + (this.FOCUS_MODS[next] || next) + '，推荐已更新', icon: 'none' });
      } catch (e) { /* 非关键路径 */ }
    },
    goBook() {
      uni.switchTab({ url: '/pages/book/book' });
    },
    goShenlun() {
      uni.navigateTo({ url: '/pkgA/shenlun/shenlun' });
    },
    next() {
      this.saveSession();
      if (this.autoTimer) {
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
      }
      this.idx++;
      this.picked = (this.items[this.idx] && this.items[this.idx]._picked) || '';
      if (this.cur && !this.picked) this.startQTimer();
      else this.stopQTimer();
      if (!this.cur) {
        this.markDailyDone();
        this.markShizhengDone();
        this.submitResult();
      }
    },
    async submitResult() {
      if (this.beiMode || this.resultSent || !this.items.length) return;
      this.resultSent = true;
      uni.removeStorageSync('pendingSession');
      try {
        const hist = uni.getStorageSync('practiceHistory') || [];
        hist.unshift({
          t: Date.now(),
          module: this.lastModule || '',
          n: this.items.length,
          correct: this.right,
          secs: this.totalSecs,
          exam: this._wasExam ? (this.items.length > 50 ? 'full' : 'mini') : '',
        });
        uni.setStorageSync('practiceHistory', hist.slice(0, 100));
      } catch (e) { /* 非关键路径 */ }
      this._wasExam = false;
      try {
        const d = await request('/api/practice_result', {
          method: 'POST',
          data: { module: this.lastModule || '', n: this.items.length, correct: this.right, secs: this.totalSecs }
        });
        if (d.percentile != null) this.percentile = d.percentile;
      } catch (e) { /* 非关键路径 */ }
      await this.logAttempts(this.items);
      if (this.profile) this.loadPlanToday();
    },
    async logAttempts(qs) {
      try {
        let uid = uni.getStorageSync('anonUid');
        if (!uid) {
          uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
          uni.setStorageSync('anonUid', uid);
        }
        const pending = qs.filter((q) => q._picked && !q._logged);
        const items = pending.map((q) => ({
          qid: q.id || null,
          module: q.module || this.lastModule || null,
          submodule: q.submodule || null,
          correct: q._picked === q.answer,
          secs: q._secs || 0,
          picked: q._picked,
          source: this._source || null,
        }));
        if (items.length) {
          // 先标记再发请求，避免请求在途期间并发调用重复落库
          pending.forEach((q) => { q._logged = true; });
          try {
            await request('/api/answer_log', { method: 'POST', data: { uid, items } });
          } catch (err) {
            // 断网：进本地队列，恢复网络后自动同步（按 key 去重）
            enqueueAnswers(uid, items.map((it, i) => ({ ...it, t: Date.now() + i })));
          }
        }
      } catch (e) { /* 非关键路径 */ }
    },
    quit() {
      if (!this.beiMode && this.items.length) this.logAttempts(this.items);
      uni.removeStorageSync('pendingSession');
      this.examMode = false;
      if (this.examTimer) {
        clearInterval(this.examTimer);
        this.examTimer = null;
      }
      this.session = false;
      this.items = [];
      this.idx = 0;
      this.picked = '';
      this.cardOpen = false;
      this.stopQTimer();
      this.pstats = loadPStats();
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/home/home' }) });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.home { padding-bottom: 40rpx; }
.plancard { padding: 22rpx 26rpx; }
.guide { display: flex; align-items: center; gap: 16rpx; background: linear-gradient(120deg, var(--brand-soft), var(--brand-soft)); border: 1rpx solid var(--brand-soft-2); padding: 24rpx 26rpx; }
.guide-l { flex: 1; min-height: 44px; display: flex; flex-direction: column; justify-content: center; }
.guide-t { font-size: 28rpx; font-weight: 600; color: var(--brand); }
.guide-s { font-size: 22rpx; color: var(--ink-2); margin-top: 6rpx; }
.guide-btn { flex-shrink: 0; background: var(--brand); color: #fff; border-radius: 999rpx; padding: 0 26rpx; font-size: 24rpx; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; }
.guide-x { flex-shrink: 0; font-size: 22rpx; color: var(--ink-3); min-height: 44px; display: inline-flex; align-items: center; padding: 0 8rpx; }
.plan-hr { display: flex; align-items: center; gap: 14rpx; }
.plan-days { font-size: 21rpx; color: var(--brand); background: var(--brand-50); border-radius: 999rpx; padding: 4rpx 14rpx; }
.plan-edit { font-size: 22rpx; color: var(--ink-3); min-height: 44px; display: inline-flex; align-items: center; }
.plan-prog { display: flex; align-items: center; gap: 14rpx; margin: 8rpx 0 6rpx; }
.plan-prog-bar { flex: 1; height: 10rpx; background: var(--brand-soft); border-radius: 999rpx; overflow: hidden; }
.plan-prog-fill { height: 100%; background: var(--brand); border-radius: 999rpx; transition: width 0.3s; }
.plan-prog-t { font-size: 21rpx; color: var(--ink-3); flex-shrink: 0; }
.plan-row.task { gap: 16rpx; }
.task-ck { width: 36rpx; height: 36rpx; border-radius: 50%; border: 2rpx solid var(--ink-4); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 22rpx; color: #fff; box-sizing: border-box; }
.task-ck.on { background: #16a34a; border-color: #16a34a; }
.task-main { flex: 1; display: flex; flex-direction: column; padding: 10rpx 0; }
.plan-txt.tdone { color: var(--ink-3); text-decoration: line-through; }
.task-sub { font-size: 21rpx; color: var(--ink-3); margin-top: 4rpx; }
.pf-input { flex: 1; min-height: 44px; border: 1rpx solid var(--line); border-radius: 12rpx; padding: 0 20rpx; font-size: 26rpx; background: var(--fill); box-sizing: border-box; }
.pf-date { min-height: 44px; display: inline-flex; align-items: center; border: 1rpx solid var(--line); border-radius: 12rpx; padding: 0 24rpx; font-size: 26rpx; color: var(--ink); background: var(--fill); box-sizing: border-box; }
.pf-date.empty { color: var(--ink-3); }
.pf-summary { margin-top: 8rpx; font-size: 23rpx; color: var(--ink-2); background: var(--brand-50); border-radius: 12rpx; padding: 18rpx 22rpx; }
.pf-back { margin-top: 16rpx; text-align: center; font-size: 24rpx; color: var(--ink-3); min-height: 44px; display: flex; align-items: center; justify-content: center; }
.plan-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6rpx; }
.plan-t { font-size: 27rpx; font-weight: 600; color: var(--ink); }
.plan-y { font-size: 21rpx; color: var(--ink-3); }
.plan-row { display: flex; align-items: center; gap: 14rpx; min-height: 44px; border-top: 1rpx solid var(--line); }
.plan-row:first-of-type { border-top: none; }
.plan-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: var(--brand); flex-shrink: 0; }
.plan-dot.due { background: #f59e0b; }
.plan-txt { flex: 1; font-size: 25rpx; color: var(--ink); }
.plan-go { font-size: 24rpx; color: var(--brand); flex-shrink: 0; }
.plan-focus { display: flex; align-items: center; gap: 10rpx; flex-wrap: wrap; border-top: 1rpx solid var(--line); padding-top: 14rpx; margin-top: 6rpx; }
.plan-focus-k { font-size: 22rpx; color: var(--ink-3); margin-right: 4rpx; }
.plan-fchip { font-size: 22rpx; color: var(--ink-2); background: var(--fill); border-radius: 999rpx; padding: 0 20rpx; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; }
.plan-fchip.on { background: var(--brand-50); color: var(--brand); font-weight: 600; }
.hbanner { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(120deg, var(--brand), #6c9bff); border-radius: 24rpx; padding: 28rpx; margin-bottom: 24rpx; }
.hbanner-l { flex: 1; margin-right: 20rpx; }
.hbanner-t { display: block; font-size: 30rpx; font-weight: 600; color: #fff; }
.hbanner-s { display: block; font-size: 23rpx; color: rgba(255, 255, 255, 0.82); margin-top: 6rpx; }
.hbanner-poster { color: #fff; font-weight: 700; text-decoration: underline; }
.hbanner-bar { height: 10rpx; background: rgba(255, 255, 255, 0.25); border-radius: 999rpx; margin-top: 14rpx; overflow: hidden; }
.hbanner-fill { height: 100%; background: var(--card); border-radius: 999rpx; }
.hbanner-btn { flex-shrink: 0; background: var(--card); color: var(--brand); border-radius: 999rpx; padding: 22rpx 28rpx; font-size: 26rpx; font-weight: 500; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; }
.grid4 { display: flex; padding: 20rpx 8rpx; }
.g4 { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 10rpx 0; }
.g4-ic { width: 88rpx; height: 88rpx; border-radius: 24rpx; display: flex; align-items: center; justify-content: center; margin-bottom: 10rpx; }
.g4-t { font-size: 24rpx; color: var(--ink-2); }
.custom-row { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 28rpx; }
.custom-start { margin-top: 24rpx; background: var(--brand); color: #fff; text-align: center; border-radius: 999rpx; padding: 22rpx 0; font-size: 28rpx; font-weight: 500; }
.exp-opts { display: flex; gap: 12rpx; margin-top: 20rpx; }
.expchip { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--line); border-radius: 12rpx; font-size: 24rpx; color: var(--ink-2); background: var(--fill); }
.expchip.on { border-color: var(--brand); color: var(--brand); background: var(--brand-soft); font-weight: 600; }
.custom-export { margin-top: 16rpx; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; text-align: center; border: 1rpx solid var(--brand); color: var(--brand); border-radius: 999rpx; padding: 20rpx 0; font-size: 27rpx; font-weight: 500; }
.custom-note { margin-top: 14rpx; text-align: center; font-size: 21rpx; color: var(--ink-3); }
.wrap.has-banner { padding-bottom: 200rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 600; margin-bottom: 20rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 24rpx; }
.goal { margin-bottom: 22rpx; }
.goal-top { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-bottom: 10rpx; flex-wrap: wrap; }
.goal-t { font-size: 24rpx; color: var(--ink-2); }
.goal-set { display: flex; gap: 8rpx; }
.goal-chip { font-size: 22rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 8rpx 20rpx; }
.goal-chip.on { color: #fff; background: var(--brand); border-color: var(--brand); }
.goal-bar { height: 12rpx; background: var(--brand-soft); border-radius: 999rpx; overflow: hidden; }
.goal-fill { height: 100%; background: var(--brand); border-radius: 999rpx; transition: width 0.3s; }
.goal-fill.done { background: #16a34a; }
.setrow { display: flex; align-items: center; gap: 18rpx; margin-bottom: 16rpx; flex-wrap: wrap; }
.set-k { font-size: 24rpx; color: var(--ink-2); }
.set-kwrap { display: flex; flex-direction: column; min-width: 150rpx; }
.set-sub { font-size: 19rpx; color: var(--ink-3); margin-top: 2rpx; }
.set-chips { display: flex; gap: 12rpx; flex-wrap: wrap; }
.set-chips.scrollx { flex-wrap: nowrap; overflow-x: auto; max-width: 70%; padding-bottom: 4rpx; }
.set-chips.scrollx .set-chip { flex-shrink: 0; }
.set-chip { font-size: 23rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 12rpx 24rpx; }
.set-chip.on { color: #fff; background: var(--brand); border-color: var(--brand); }
.new-tag { font-size: 19rpx; color: #fff; background: #f43f5e; border-radius: 999rpx; padding: 2rpx 12rpx; margin-left: 10rpx; }
.real-tag { display: inline-block; font-size: 21rpx; color: #b45309; background: #fef3c7; border-radius: 8rpx; padding: 4rpx 14rpx; margin-bottom: 10rpx; }
.offline-tag { font-size: 21rpx; color: var(--warn); background: var(--warn-soft); border-radius: 8rpx; padding: 8rpx 14rpx; margin-bottom: 10rpx; line-height: 1.5; }
.grp-tag { display: inline-block; font-size: 21rpx; color: #0e7490; background: #cffafe; border-radius: 8rpx; padding: 4rpx 14rpx; margin-bottom: 10rpx; margin-left: 10rpx; }
.daily { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(120deg, var(--brand), #6c9bff); border-radius: 20rpx; padding: 24rpx 28rpx; margin-bottom: 20rpx; }
.daily.done { background: linear-gradient(135deg, #10b981, #059669); }
.daily.sz { background: linear-gradient(120deg, #d9480f, #f59e0b); }
.daily.sz.done { background: linear-gradient(135deg, #10b981, #059669); }
.daily.sz .daily-go { color: #d9480f; }
.daily.sz.done .daily-go { color: #059669; }
.daily-t { display: flex; align-items: center; gap: 8rpx; }
.daily-t-t { font-size: 27rpx; font-weight: 700; color: #fff; }
.daily-s { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.85); margin-top: 4rpx; }
.daily-go { background: var(--card); color: var(--brand); font-size: 24rpx; font-weight: 600; border-radius: 999rpx; padding: 10rpx 26rpx; flex-shrink: 0; }
.smart { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #f97316, #f43f5e); border-radius: 20rpx; padding: 24rpx 28rpx; margin-bottom: 20rpx; }
.smart-t { display: flex; align-items: center; gap: 8rpx; font-size: 27rpx; font-weight: 700; color: #fff; }
.smart-t-t { font-size: 27rpx; font-weight: 700; color: #fff; }
.smart-s { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.8); margin-top: 4rpx; }
.smart-go { background: var(--card); color: #f43f5e; font-size: 24rpx; font-weight: 600; border-radius: 999rpx; padding: 10rpx 26rpx; flex-shrink: 0; }
.grid { display: flex; flex-wrap: wrap; gap: 20rpx; }
.mcard { width: calc(50% - 10rpx); box-sizing: border-box; background: var(--soft-bg); border: 1rpx solid var(--line); border-radius: 20rpx; padding: 24rpx; }
.mcard.all { background: linear-gradient(135deg, #6c9bff, var(--brand)); border: none; }
.mcard.all .mname, .mcard.all .mn { color: #fff; }
.mtop { display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.mico { width: 48rpx; height: 48rpx; line-height: 48rpx; text-align: center; border-radius: 12rpx; font-size: 24rpx; font-weight: 600; }
.mname { font-size: 29rpx; font-weight: 600; color: var(--ink); }
.mn { display: block; font-size: 21rpx; color: var(--ink-2); margin: 4rpx 0 10rpx; }
.mbar { height: 8rpx; background: var(--line); border-radius: 999rpx; overflow: hidden; }
.mfill { height: 100%; background: var(--brand); border-radius: 999rpx; transition: width 0.4s ease; }
.modechips { display: flex; gap: 12rpx; margin-bottom: 14rpx; flex-wrap: wrap; }
.mchip { font-size: 21rpx; border-radius: 12rpx; padding: 4rpx 16rpx; font-weight: 500; }
.mchip.brand { background: var(--brand-soft); color: var(--brand); }
.mchip.info { background: #cffafe; color: #0e7490; }
.mchip.bad { background: var(--bad-soft); color: #dc2626; }
.rhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14rpx; }
.tag { display: inline-block; background: var(--brand-soft); color: var(--brand); border-radius: 12rpx; padding: 6rpx 20rpx; font-size: 22rpx; }
.hstats { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.tool-row { display: flex; justify-content: space-between; align-items: center; min-height: 44px; padding: 8rpx 4rpx; border-bottom: 1rpx solid var(--line); }
.tool-row:last-child { border-bottom: none; }
.tool-name { font-size: 27rpx; color: var(--ink); }
.tool-val { font-size: 24rpx; color: var(--ink-2); }
.tool-val.on { color: var(--brand); font-weight: 600; }
.cnt { font-size: 22rpx; border-radius: 999rpx; padding: 2rpx 14rpx; font-weight: 600; }
.okc { background: var(--ok-soft); color: var(--ok); }
.badc { background: var(--bad-soft); color: var(--bad); }
.fire { background: var(--warn-soft); color: #ea580c; display: inline-flex; align-items: center; gap: 2rpx; }
.fire-n { font-size: 22rpx; color: #ea580c; font-weight: 700; }
.iconbtn { display: inline-flex; align-items: center; }
.timer { font-size: 22rpx; color: var(--ink-2); }
.fontbtn { font-size: 24rpx; font-weight: 700; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 10rpx; padding: 2rpx 12rpx; }
.fontbtn.beion { background: var(--brand); border-color: var(--brand); color: #fff; }
.reasons { display: flex; flex-wrap: wrap; align-items: center; gap: 12rpx; margin-bottom: 16rpx; }
.rz-t { font-size: 23rpx; color: var(--ink-2); }
.rz { font-size: 23rpx; color: var(--ink-2); border: 1rpx solid var(--line); background: var(--soft-bg); border-radius: 999rpx; padding: 8rpx 22rpx; }
.rz.on { background: var(--brand); border-color: var(--brand); color: #fff; font-weight: 600; }
.acard-grid { display: flex; flex-wrap: wrap; gap: 20rpx; padding: 8rpx 0 20rpx; }
.acard-n { width: 80rpx; height: 80rpx; line-height: 80rpx; text-align: center; border-radius: 50%; background: var(--soft-bg); border: 2rpx solid var(--line); font-size: 27rpx; font-weight: 600; color: var(--ink-2); box-sizing: border-box; }
.acard-n.ok { background: var(--ok-soft); border-color: #86efac; color: #15803d; }
.acard-n.bad { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }
.acard-n.cur { border-color: var(--brand); color: var(--brand); background: var(--brand-soft); }
.acard-foot { text-align: center; font-size: 23rpx; color: var(--ink-2); padding-bottom: 8rpx; }
.op { font-size: 24rpx; color: var(--ink-2); margin-left: 6rpx; }
.progress { height: 6rpx; background: var(--fill); border-radius: 999rpx; overflow: hidden; margin-bottom: 22rpx; }
.pfill { height: 100%; background: linear-gradient(90deg, #6c9bff, var(--brand)); border-radius: 999rpx; transition: width 0.3s ease; }
.q { font-size: 30rpx; line-height: 1.7; margin-bottom: 22rpx; white-space: pre-wrap; }
.qimg { width: 100%; border-radius: 12rpx; margin-bottom: 8rpx; background: var(--fill); }
.qimg-credit { font-size: 20rpx; color: var(--ink-2); margin-bottom: 16rpx; }
.opt { display: flex; align-items: center; border: 2rpx solid var(--line); border-radius: 20rpx; padding: 22rpx 24rpx; margin-bottom: 20rpx; font-size: 29rpx; line-height: 1.6; transition: border-color 0.15s, background 0.15s; }
.okey { flex-shrink: 0; width: 52rpx; height: 52rpx; line-height: 52rpx; text-align: center; border-radius: 50%; background: var(--soft-bg); color: var(--ink-2); font-weight: 600; font-size: 26rpx; margin-right: 20rpx; border: 1rpx solid var(--line); }
.otext { flex: 1; }
.omark { flex-shrink: 0; font-size: 30rpx; font-weight: 700; margin-left: 12rpx; }
.omark.good { color: var(--ok); }
.omark.badm { color: var(--bad); }
.opt.right { background: var(--ok-soft); border-color: var(--ok); animation: pop 0.35s cubic-bezier(0.2, 0.8, 0.2, 1.4); }
@keyframes pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.03); }
  100% { transform: scale(1); }
}
.opt.right .okey { background: var(--ok); color: #fff; border-color: var(--ok); }
.opt.wrong { background: var(--bad-soft); border-color: var(--bad); animation: shake 0.3s; }
.opt.wrong .okey { background: var(--bad); color: #fff; border-color: var(--bad); }
.opt.dim { opacity: 0.5; }
@keyframes shake {
  25% { transform: translateX(-8rpx); }
  75% { transform: translateX(8rpx); }
}
.after { margin-top: 8rpx; }
.exp-k.hs { color: var(--brand); }
.exp.hsx { border-left: 5rpx solid var(--brand); background: var(--brand-soft); }
.exp-k.xp { color: #b45309; margin-top: 12rpx; }
.exp.xpx { border-left: 5rpx solid #f59e0b; background: var(--warn-soft); }
.hs-rate { display: flex; gap: 14rpx; margin-top: 10rpx; align-items: center; }
.hs-rate-btn { display: inline-flex; align-items: center; gap: 6rpx; font-size: 23rpx; color: var(--brand); border: 1rpx solid var(--brand); border-radius: 999rpx; padding: 6rpx 22rpx; }
.hs-rate-btn.bad { color: var(--bad); border-color: var(--bad); }
.hs-rate-done { font-size: 23rpx; color: var(--ink-2); }
.exp { background: var(--soft-bg); border-radius: 14rpx; padding: 20rpx; font-size: 25rpx; line-height: 1.7; color: var(--ink); white-space: pre-wrap; margin-top: 8rpx; }
.exp-sec { background: linear-gradient(180deg, var(--brand-soft), var(--card) 40%); border: 1rpx solid var(--brand-soft-2); border-radius: 20rpx; padding: 20rpx; margin-bottom: 16rpx; }
.exp-row { display: flex; align-items: baseline; gap: 16rpx; margin-bottom: 12rpx; }
.exp-row:last-child { margin-bottom: 0; }
.exp-row.col { display: block; }
.exp-k { flex-shrink: 0; font-size: 22rpx; color: var(--ink-2); font-weight: 600; }
.exp-v { font-size: 24rpx; color: var(--ink); }
.exp-ans { font-size: 32rpx; font-weight: 800; }
.exp-ans.okc2 { color: var(--ok); }
.exp-ans.badc2 { color: var(--bad); }
.rp-types { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 20rpx; }
.rp-chip { padding: 18rpx 26rpx; min-height: 44rpx; border-radius: 999rpx; background: var(--soft-bg); font-size: 26rpx; color: var(--ink-2); }
.rp-chip.on { background: rgba(59, 111, 245, 0.12); color: var(--brand); font-weight: 600; }
.rp-detail { width: 100%; box-sizing: border-box; min-height: 140rpx; background: var(--soft-bg); border-radius: 16rpx; padding: 20rpx; font-size: 26rpx; margin-bottom: 24rpx; }
.rp-submit { width: 100%; }
.rp-submit[disabled] { opacity: 0.5; }
.report-link {
  text-align: center;
  font-size: 22rpx;
  color: var(--ink-2);
  padding-top: 14rpx;
  text-decoration: underline;
}
.deep { margin-top: 6rpx; text-align: center; font-size: 25rpx; color: var(--brand); border: 1rpx solid var(--brand); border-radius: 999rpx; padding: 14rpx 0; }
.banner { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 28rpx 32rpx calc(28rpx + env(safe-area-inset-bottom)); animation: slideup 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); }
/* #ifdef H5 */
@media (max-width: 767px) {
  .banner { bottom: calc(50px + env(safe-area-inset-bottom)); padding-bottom: 28rpx; }
  .wrap.has-banner { padding-bottom: calc(240rpx + 50px + env(safe-area-inset-bottom)); }
}
/* #endif */
@keyframes slideup {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.banner { background: rgba(255, 255, 255, 0.97); border-top: 1rpx solid var(--line); box-shadow: 0 -8rpx 24rpx rgba(23, 24, 28, 0.08); }
.theme-dark .banner { background: rgba(29, 31, 40, 0.97); }
.binfo { flex: 1; min-width: 0; }
.btitle { display: block; font-size: 30rpx; font-weight: 700; }
.bok .btitle { color: var(--ok); }
.bbad .btitle { color: var(--bad); }
.bsub { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.bnext { flex-shrink: 0; border-radius: 999rpx; font-size: 28rpx; font-weight: 600; color: #fff; padding: 0 44rpx; min-height: 44px; line-height: 44px; margin: 0; }
.bnext.nok, .bnext.nbad { background: linear-gradient(180deg, #4a7bf7, #3567ec); box-shadow: 0 6rpx 16rpx rgba(59, 111, 245, 0.25); }
.bnext.bstay { background: transparent; border: 2rpx solid var(--brand); color: var(--brand); margin-right: 12rpx; box-shadow: none; }
.ann { display: flex; align-items: flex-start; gap: 12rpx; background: var(--info-soft); border: 1rpx solid #bae6fd; border-radius: 16rpx; padding: 18rpx 22rpx; margin-bottom: 20rpx; }
.ann-c { flex: 1; }
.ann-t { display: block; font-size: 26rpx; font-weight: 600; color: #0369a1; }
.ann-b { display: block; font-size: 23rpx; color: #0284c7; margin-top: 4rpx; }
.ann-x { color: #0369a1; font-size: 26rpx; padding: 8rpx 16rpx; }
.daily.exam { background: var(--card); border: 1rpx solid var(--line); box-shadow: 0 2rpx 8rpx rgba(23,24,28,.04); }
.exam-ico { width: 56rpx; height: 56rpx; border-radius: 16rpx; display: inline-flex; align-items: center; justify-content: center; }
.exam-ico.warn { background: var(--warn-soft); }
.exam-ico.err { background: var(--bad-soft); }
.daily-t-t.dark { color: var(--ink); }
.daily-s.dark { color: var(--ink-2); }
.daily.exam .daily-go { background: var(--brand-soft); color: var(--brand); }

.timer.examleft { color: #ef4444; font-weight: 700; }
.timer.overtime { color: #ef4444; font-weight: 700; }
.tm-cmp { margin-left: auto; font-size: 22rpx; color: #16a34a; }
.tm-cmp.over { color: #ef4444; }
.qhl { background: var(--hl-bg, #fef08a); color: var(--hl-ink, inherit); border-radius: 4rpx; padding: 0 2rpx; font-weight: 600; }
.qhl-tip { margin-top: 8rpx; font-size: 21rpx; color: var(--warn); }
.opt.sel { border-color: var(--brand); background: var(--soft-bg); }
.acard-n.skip { background: var(--line); color: var(--ink-2); }
.beat { margin-top: 10rpx; font-size: 25rpx; color: var(--brand); background: var(--soft-bg); border-radius: 999rpx; padding: 10rpx 26rpx; }
.report { width: 100%; margin: 20rpx 0 28rpx; }
.report-row { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.report-cell { flex: 1; background: var(--soft-bg); border-radius: 16rpx; padding: 20rpx 0; display: flex; flex-direction: column; align-items: center; gap: 6rpx; }
.report-n { font-size: 34rpx; font-weight: 700; color: var(--ink); }
.report-n.badc2 { color: var(--bad); }
.report-t { font-size: 22rpx; color: var(--ink-2); }
.mb-list { margin-bottom: 24rpx; }
.mb-row { display: flex; align-items: center; gap: 16rpx; margin-bottom: 12rpx; }
.mb-name { font-size: 23rpx; color: var(--ink); width: 130rpx; text-align: left; flex-shrink: 0; }
.mb-bar { flex: 1; height: 14rpx; background: var(--line); border-radius: 999rpx; overflow: hidden; }
.mb-fill { height: 100%; border-radius: 999rpx; background: #22c55e; }
.mb-fill.mid { background: #f59e0b; }
.mb-fill.lo { background: #ef4444; }
.mb-pct { font-size: 22rpx; color: var(--ink-2); width: 150rpx; text-align: right; flex-shrink: 0; }
.report-grid { display: flex; flex-wrap: wrap; gap: 16rpx; justify-content: center; }
.report-tip { text-align: center; font-size: 22rpx; color: var(--ink-2); margin-top: 14rpx; }
.btn { background: linear-gradient(135deg, #6c9bff, var(--brand)); color: #fff; border-radius: 18rpx; font-size: 30rpx; font-weight: 600; box-shadow: 0 6rpx 16rpx rgba(59, 111, 245, 0.25); min-height: 44px; line-height: 44px; }
.btn.ghost { background: var(--brand-soft); color: var(--brand); box-shadow: none; }
.btn.plain { background: none; color: var(--ink-2); box-shadow: none; }
.done { text-align: center; padding: 48rpx 28rpx; }
.ring { width: 200rpx; height: 200rpx; border-radius: 50%; margin: 0 auto 24rpx; display: flex; align-items: center; justify-content: center; }
.ring-in { width: 156rpx; height: 156rpx; border-radius: 50%; background: var(--card); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-n { font-size: 40rpx; font-weight: 700; color: var(--ink); }
.ring-t { font-size: 20rpx; color: var(--ink-2); }
.big { font-size: 40rpx; font-weight: 700; margin-bottom: 12rpx; }
.sub { font-size: 26rpx; color: var(--ink-2); margin-bottom: 28rpx; }
.mask { position: fixed; inset: 0; background: rgba(15, 18, 30, 0.5); z-index: 90; display: flex; align-items: flex-end; }
.sheet { width: 100%; box-sizing: border-box; background: var(--card); border-radius: 32rpx 32rpx 0 0; padding: 32rpx 28rpx calc(130rpx + env(safe-area-inset-bottom)); max-height: 70vh; overflow-y: auto; animation: slideup 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.sheet-t { font-size: 30rpx; font-weight: 700; }
.sheet-x { font-size: 28rpx; color: var(--ink-2); padding: 8rpx 16rpx; }
.sub-chip { display: flex; justify-content: space-between; align-items: center; border: 1rpx solid var(--line); background: var(--soft-bg); border-radius: 18rpx; padding: 24rpx 28rpx; margin-bottom: 16rpx; }
.sub-l { display: flex; flex-direction: column; gap: 4rpx; min-width: 0; }
.pr-scroll { white-space: nowrap; margin-bottom: 20rpx; }
.pr-scroll .set-chip { display: inline-block; margin-right: 12rpx; }
.sub-prog { font-size: 22rpx; color: var(--muted); }
.sub-chip.all-chip { background: linear-gradient(135deg, #6c9bff, var(--brand)); border: none; }
.sub-chip.all-chip .sub-name, .sub-chip.all-chip .sub-n { color: #fff; }
.sub-name { font-size: 28rpx; font-weight: 600; color: var(--ink); }
.sub-n { font-size: 22rpx; color: var(--ink-2); }
.searchbar { display: flex; align-items: center; gap: 12rpx; background: var(--card); border-radius: 999rpx; padding: 16rpx 26rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04); }
.searchbar-t { font-size: 26rpx; color: var(--ink-3); }
</style>
