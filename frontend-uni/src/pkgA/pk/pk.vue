<template>
  <view class="wrap pk">
    <!-- 入口页 -->
    <template v-if="view === 'home'">
      <view class="pk-cols">
      <view class="pk-left">
      <view class="hero">
        <view class="hero-t"><l-icon name="swords" :size="22" color="#ffffff" /><text>答题 PK</text></view>
        <text class="hero-s">同组 10 题 · 比分数拼手速 · 答对 +80，越快加成越高</text>
      </view>

      <view class="sec-t">选择模块</view>
      <view class="mod-chips">
        <text v-for="(n, m) in MODS" :key="m" class="chip" :class="{ on: module === m }" @click="module = m">{{ n }}</text>
        <text class="chip" :class="{ on: !module }" @click="module = null">混合</text>
      </view>

      <view class="act-btn main" @click="createMatch">发起好友挑战</view>
      <view class="act-btn sub" @click="randomMatch">随机匹配对手</view>

      <view class="join-row">
        <input v-model="joinCode" class="join-input" placeholder="输入挑战码，如 A8X2QK" :maxlength="8" />
        <view class="join-btn" @click="joinByCode">应战</view>
      </view>
      </view>

      <view class="pk-right">
      <view class="sec-h">
        <text class="sec-t">本周胜场榜</text>
        <text v-if="lb.my_rank" class="sec-more">我的排名 #{{ lb.my_rank }} · {{ lb.my_wins }} 胜</text>
      </view>
      <view class="card">
        <view v-if="loadErr && !lb.items.length" class="empty">加载失败：{{ loadErr }}<view class="retry" @click="loadHome">重试 ›</view></view>
        <view v-else-if="!lb.items.length" class="empty">本周还没有对局，快来抢占榜首！</view>
        <view v-for="e in lb.items" :key="e.rank" class="lb-row">
          <text class="lb-rank" :class="'r' + e.rank">{{ e.rank }}</text>
          <text class="lb-name">{{ e.name }}</text>
          <text class="lb-wins">{{ e.wins }} 胜</text>
        </view>
      </view>

      <view class="sec-h">
        <text class="sec-t">我的对局</text>
        <text v-if="mine.wins" class="sec-more">累计 {{ mine.wins }} 胜</text>
      </view>
      <view class="card">
        <view v-if="loadErr && !mine.items.length" class="empty">加载失败：{{ loadErr }}<view class="retry" @click="loadHome">重试 ›</view></view>
        <view v-else-if="!mine.items.length" class="empty">还没有对局记录</view>
        <view v-for="m in mine.items" :key="m.code" class="m-row" @click="openMatch(m)">
          <view class="m-l">
            <text class="m-t">{{ MODS[m.module] || '混合' }} · {{ m.code }}</text>
            <text class="m-s">{{ matchDesc(m) }}</text>
          </view>
          <text class="m-badge" :class="matchBadge(m).cls">{{ matchBadge(m).t }}</text>
        </view>
      </view>
      </view>
      </view>
    </template>

    <!-- 答题页 -->
    <template v-else-if="view === 'quiz'">
      <view class="pk-solo">
      <view class="pk-top">
        <view class="vs">
          <view class="p">
            <view class="av">我</view>
            <text class="nm">{{ myName }}</text>
            <text class="sc">{{ answers.length }}<text class="sc-sub">/{{ questions.length }}</text></text>
          </view>
          <text class="mid">VS</text>
          <view class="p">
            <view class="av rival">{{ (rivalName || '?').slice(0, 1) }}</view>
            <text class="nm">{{ rivalName || '等待对手' }}</text>
            <text class="sc">{{ rivalScore == null ? '—' : rivalScore }}</text>
          </view>
        </view>
        <view class="timer"><view class="timer-fill" :style="{ width: (timeLeft / 30) * 100 + '%' }" /></view>
        <text class="timer-t">本题剩余 {{ timeLeft }} 秒 · 答对+80，越快加成越高 · 第 {{ qIndex + 1 }}/{{ questions.length }} 题</text>
      </view>

      <view class="streak">
        <view v-for="(s, i) in streak" :key="i" class="dot" :class="s" />
      </view>

      <view v-if="curQ" class="card q">
        <view class="q-tags">
          <text class="tag">{{ MODS[curQ.module] || curQ.module }}</text>
          <text v-if="curQ.submodule" class="tag gray">{{ curQ.submodule }}</text>
        </view>
        <text class="stem">{{ curQ.question }}</text>
        <view
          v-for="(t, k) in curQ.options"
          :key="k"
          class="opt"
          :class="{ pick: picked === k }"
          @click="pick(k)"
        >
          <text class="k">{{ k }}</text>
          <text class="t">{{ t }}</text>
        </view>
      </view>

      <view v-if="rivalDone" class="card hint"><l-icon name="zap" :size="15" color="#2e5bff" /> 对手已完成全部作答 —— 锁定你的答案！</view>

      <view v-if="submitFailed" class="card hint">
        <text>提交未成功（作答已保留），网络恢复后可重试</text>
        <view class="act-btn main" style="margin-top: 16rpx" @click="finishQuiz">重新提交</view>
      </view>
      </view>
    </template>

    <!-- 结果 / 等待页 -->
    <template v-else-if="view === 'result'">
      <view class="pk-solo">
      <view class="res-hero" :class="resCls">
        <text class="res-t">{{ resTitle }}</text>
        <text class="res-s">{{ MODS[match.module] || '混合模块' }} · 挑战码 {{ match.code }}</text>
      </view>

      <view class="card res-vs">
        <view class="res-p">
          <text class="res-name">{{ myP().name }}{{ mySide ? '（我）' : '' }}</text>
          <text class="res-score">{{ myP().score }}</text>
          <text class="res-meta">答对 {{ myP().correct }}/{{ match.n_questions }} · 用时 {{ fmtMs(myP().time_ms) }}</text>
        </view>
        <text class="res-mid">VS</text>
        <view class="res-p">
          <template v-if="theirP() && theirP().done">
            <text class="res-name">{{ theirP().name }}</text>
            <text class="res-score">{{ theirP().score }}</text>
            <text class="res-meta">答对 {{ theirP().correct }}/{{ match.n_questions }} · 用时 {{ fmtMs(theirP().time_ms) }}</text>
          </template>
          <template v-else>
            <text class="res-name">{{ theirP() ? theirP().name : '虚位以待' }}</text>
            <text class="res-score wait">?</text>
            <text class="res-meta">等待对手完成同组 10 题</text>
          </template>
        </view>
      </view>

      <template v-if="match.status !== 'finished'">
        <view v-if="noOppHint" class="card wait-hint">⏳ 暂无对手，试试邀请好友——复制下方挑战码或分享链接，叫考友来应战</view>
        <view class="card share-card">
          <text class="share-t">把挑战发给考友，等 TA 应战</text>
          <view class="code-box" @click="copyCode"><text class="code">{{ match.code }}</text><text class="copy">复制</text></view>
          <view class="act-btn main" @click="shareMatch">{{ isMp ? '转发给好友应战' : '复制挑战链接' }}</view>
          <view class="act-btn sub" @click="refreshMatch">刷新对局状态</view>
        </view>
      </template>
      <template v-else>
        <view class="act-btn main" @click="shareResult">晒战绩，喊人来战</view>
        <view class="act-btn sub" @click="rematch">再来一局</view>
      </template>
      <view class="act-btn plain" @click="backHome">返回 PK 大厅</view>
      </view>
    </template>

    <view v-else class="card empty">加载中…</view>
  </view>
</template>

<script>
import { pkCreate, pkJoin, pkRandomMatch, pkMatch, pkSubmit, pkMine, pkLeaderboard, pkNickname, trackEvent } from '../../api.js';

const MODS = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断' };
const PER_Q_SEC = 30;

export default {
  data() {
    return {
      MODS,
      view: 'home',
      module: null,
      joinCode: '',
      lb: { items: [], my_rank: null, my_wins: 0 },
      mine: { items: [], wins: 0 },
      loadErr: '',
      // 对局
      code: '',
      match: null,
      mySide: null,
      questions: [],
      qIndex: 0,
      picked: '',
      answers: [],
      qStart: 0,
      timeLeft: PER_Q_SEC,
      timerId: null,
      rivalName: '',
      rivalScore: null,
      rivalDone: false,
      myName: pkNickname(),
      submitting: false,
      submitFailed: false,
      fromRandom: false,
      noOppHint: false,
      waitTimerId: null,
      waitPollId: null,
    };
  },
  computed: {
    curQ() {
      return this.questions[this.qIndex] || null;
    },
    streak() {
      return this.questions.map((q, i) => {
        if (i < this.answers.length) return this.answers[i].correctGuess == null ? 'cur' : this.answers[i].correctGuess ? 'ok' : 'bad';
        return i === this.qIndex ? 'cur' : '';
      });
    },
    resCls() {
      if (!this.match || this.match.status !== 'finished') return 'waiting';
      if (this.match.winner === 'draw' || !this.mySide) return 'draw';
      return this.match.winner === this.mySide ? 'win' : 'lose';
    },
    resTitle() {
      if (!this.match || this.match.status !== 'finished') return '⏳ 等待对手应战';
      if (!this.mySide) return '🏳️ 对局已结束';
      if (this.match.winner === 'draw') return '🤝 平局！';
      return this.match.winner === this.mySide ? '🏆 胜利！' : '💪 惜败，再战一局';
    },
    isMp() {
      // #ifdef MP-WEIXIN
      return true;
      // #endif
      // eslint-disable-next-line no-unreachable
      return false;
    },
  },
  onLoad(query) {
    if (query && query.code) {
      this.joinCode = query.code;
      this.joinByCode();
    }
  },
  onShow() {
    if (this.view === 'home') this.loadHome();
  },
  onUnload() {
    this.stopTimer();
    this.stopWaitWatch();
  },
  // #ifdef MP-WEIXIN
  onShareAppMessage() {
    const code = this.code || (this.match && this.match.code) || '';
    return {
      title: `${this.myName} 向你发起答题 PK，敢来应战吗？`,
      path: `/pkgA/pk/pk?code=${code}`,
    };
  },
  // #endif
  methods: {
    async loadHome() {
      this.loadErr = '';
      try {
        const [lb, mine] = await Promise.all([pkLeaderboard(), pkMine()]);
        this.lb = lb;
        this.mine = mine;
      } catch (e) {
        this.loadErr = e.message || '网络异常';
      }
    },
    async createMatch() {
      try {
        uni.showLoading({ title: '出题中…' });
        const d = await pkCreate(this.module);
        uni.hideLoading();
        this.fromRandom = false;
        this.startQuiz(d.code, d.questions, 'creator');
      } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: e.message || '发起失败', icon: 'none' });
      }
    },
    async randomMatch() {
      try {
        uni.showLoading({ title: '匹配中…' });
        const d = await pkRandomMatch(this.module);
        uni.hideLoading();
        if (d.matched) {
          uni.showToast({ title: '已匹配到对手！', icon: 'none' });
          this.startQuiz(d.code, d.questions, 'opponent');
          this.loadRival(d.code);
        } else {
          uni.showToast({ title: '暂无对手，已为你开局等待匹配', icon: 'none' });
          this.fromRandom = true;
          this.startQuiz(d.code, d.questions, 'creator');
        }
      } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: e.message || '匹配失败', icon: 'none' });
      }
    },
    async joinByCode() {
      const code = (this.joinCode || '').trim().toUpperCase();
      if (!code) return uni.showToast({ title: '请输入挑战码', icon: 'none' });
      try {
        uni.showLoading({ title: '加入中…' });
        const d = await pkJoin(code);
        uni.hideLoading();
        this.startQuiz(d.code, d.questions, 'opponent');
        this.loadRival(d.code);
      } catch (e) {
        uni.hideLoading();
        // 已提交过：直接看结果
        if ((e.message || '').includes('已被') || (e.message || '').includes('自己')) {
          this.viewResult(code);
        } else {
          uni.showToast({ title: e.message || '加入失败', icon: 'none' });
        }
      }
    },
    async loadRival(code) {
      try {
        const d = await pkMatch(code);
        const m = d.match;
        const their = m.my_side === 'creator' ? m.opponent : m.creator;
        if (their) {
          this.rivalName = their.name;
          this.rivalDone = their.done;
        }
      } catch (e) { /* 非关键路径 */ }
    },
    startQuiz(code, questions, side) {
      if (side !== 'creator') this.fromRandom = false;
      this.code = code;
      this.questions = questions;
      this.mySide = side;
      this.qIndex = 0;
      this.answers = [];
      this.picked = '';
      this.submitFailed = false;
      this.rivalName = '';
      this.rivalScore = null;
      this.rivalDone = false;
      this.view = 'quiz';
      this.beginQ();
    },
    beginQ() {
      this.picked = '';
      this.qStart = Date.now();
      this.timeLeft = PER_Q_SEC;
      this.stopTimer();
      this.timerId = setInterval(() => {
        this.timeLeft = Math.max(0, PER_Q_SEC - Math.floor((Date.now() - this.qStart) / 1000));
        if (this.timeLeft <= 0) this.lockAnswer('');
      }, 250);
    },
    stopTimer() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    },
    pick(k) {
      if (this.picked) return;
      this.picked = k;
      setTimeout(() => this.lockAnswer(k), 350);
    },
    lockAnswer(k) {
      if (this.answers.length > this.qIndex) return;
      this.stopTimer();
      const ms = Math.min(Date.now() - this.qStart, PER_Q_SEC * 1000);
      this.answers.push({ question_id: this.curQ.id, answer: k, ms, correctGuess: null, points: 0 });
      if (this.qIndex < this.questions.length - 1) {
        this.qIndex++;
        this.beginQ();
      } else {
        this.finishQuiz();
      }
    },
    async finishQuiz() {
      if (this.submitting) return;
      this.submitting = true;
      this.submitFailed = false;
      try {
        uni.showLoading({ title: '判分中…' });
        const d = await pkSubmit(this.code, this.answers.map((a) => ({ question_id: a.question_id, answer: a.answer, ms: a.ms })));
        uni.hideLoading();
        this.match = d.match;
        this.view = 'result';
        if (this.fromRandom && d.match.status !== 'finished') this.startWaitWatch();
      } catch (e) {
        uni.hideLoading();
        // 超时/断连时提交可能已在服务端生效，先确认比分再决定是否让用户重试
        try {
          const d = await pkMatch(this.code);
          const mySide = d.match && d.match.my_side;
          if (mySide && d.match[mySide] && d.match[mySide].done) {
            this.match = d.match;
            this.view = 'result';
            if (this.fromRandom && d.match.status !== 'finished') this.startWaitWatch();
            return;
          }
        } catch (e2) {
          /* 忽略确认失败，走重试提示 */
        }
        this.submitFailed = true;
        uni.showToast({ title: e.message || '提交超时，请重试', icon: 'none' });
      } finally {
        this.submitting = false;
      }
    },
    startWaitWatch() {
      this.stopWaitWatch();
      this.noOppHint = false;
      this.waitTimerId = setTimeout(() => {
        if (this.view === 'result' && this.match && this.match.status !== 'finished') this.noOppHint = true;
      }, 30000);
      this.waitPollId = setInterval(async () => {
        if (this.view !== 'result') return this.stopWaitWatch();
        try {
          const d = await pkMatch(this.code);
          this.match = d.match;
          if (d.match.status === 'finished') {
            this.stopWaitWatch();
            uni.showToast({ title: '对手已完成！', icon: 'none' });
          }
        } catch (e) { /* 非关键路径 */ }
      }, 5000);
    },
    stopWaitWatch() {
      if (this.waitTimerId) {
        clearTimeout(this.waitTimerId);
        this.waitTimerId = null;
      }
      if (this.waitPollId) {
        clearInterval(this.waitPollId);
        this.waitPollId = null;
      }
    },
    async viewResult(code) {
      try {
        const d = await pkMatch(code);
        this.match = d.match;
        this.mySide = d.match.my_side;
        this.code = code;
        this.view = 'result';
      } catch (e) {
        uni.showToast({ title: e.message || '对局不存在', icon: 'none' });
      }
    },
    async refreshMatch() {
      await this.viewResult(this.code);
      if (this.match && this.match.status === 'finished') {
        uni.showToast({ title: '对手已完成！', icon: 'none' });
      } else {
        uni.showToast({ title: '对手还没完成，稍后再看', icon: 'none' });
      }
    },
    openMatch(m) {
      if (m.my_side && !(m.my_side === 'creator' ? m.creator.done : m.opponent && m.opponent.done)) {
        // 未交卷（提交失败/中途离开）：重新拉题续答
        this.resumeMatch(m);
        return;
      }
      this.viewResult(m.code);
    },
    async resumeMatch(m) {
      try {
        uni.showLoading({ title: '加载中…' });
        const d = await pkJoin(m.code);
        uni.hideLoading();
        this.fromRandom = false;
        this.startQuiz(d.code, d.questions, m.my_side);
        this.loadRival(d.code);
      } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: e.message || '加载失败', icon: 'none' });
      }
    },
    myP() {
      return this.mySide === 'opponent' ? this.match.opponent : this.match.creator;
    },
    theirP() {
      return this.mySide === 'opponent' ? this.match.creator : this.match.opponent;
    },
    oppOf() {
      return this.match.opponent || { name: this.myName };
    },
    fmtMs(ms) {
      if (ms == null) return '—';
      return (ms / 1000).toFixed(1) + 's';
    },
    matchDesc(m) {
      const my = m.my_side === 'opponent' ? m.opponent : m.creator;
      const their = m.my_side === 'opponent' ? m.creator : m.opponent;
      if (m.status === 'finished') return `${my.score} : ${their.score} · ${their.name}`;
      if (!my || !my.done) return '待作答';
      return their ? `等待 ${their.name} 完成` : '等待对手应战';
    },
    matchBadge(m) {
      if (m.status !== 'finished') return { t: '等待中', cls: 'wait' };
      if (m.winner === 'draw') return { t: '平局', cls: 'draw' };
      return m.winner === m.my_side ? { t: '胜', cls: 'win' } : { t: '负', cls: 'lose' };
    },
    copyCode() {
      uni.setClipboardData({ data: this.match.code, success: () => uni.showToast({ title: '挑战码已复制', icon: 'none' }) });
    },
    shareMatch() {
      // #ifdef H5
      const url = `${window.location.origin}${window.location.pathname}#/pkgA/pk/pk?code=${this.match.code}`;
      uni.setClipboardData({
        data: `我在错题邦向你发起答题 PK（挑战码 ${this.match.code}），敢来应战吗？${url}`,
        success: () => uni.showToast({ title: '挑战链接已复制，发给考友吧', icon: 'none' }),
      });
      // #endif
      // #ifdef MP-WEIXIN
      uni.showToast({ title: '点右上角「…」转发给好友', icon: 'none' });
      // #endif
    },
    shareResult() {
      const code = this.match.code;
      trackEvent('pk_result_copy', 'pk_share', code);
      // #ifdef H5
      const url = `${window.location.origin}/p/${code}`;
      const me = this.myP();
      const them = this.theirP() || {};
      uni.setClipboardData({
        data: `【答题PK战绩】${me.name || this.myName} ${me.score} : ${them.score} ${them.name}，不服来战：${url}`,
        success: () => uni.showToast({ title: '战绩链接已复制，发给考友吧', icon: 'none' }),
      });
      // #endif
      // #ifndef H5
      uni.setClipboardData({
        data: `【答题PK战绩】不服来战：https://kaogong.zalize.com/p/${code}`,
        success: () => uni.showToast({ title: '战绩链接已复制，发给考友吧', icon: 'none' }),
      });
      // #endif
    },
    rematch() {
      this.module = this.match.module;
      this.view = 'home';
      this.loadHome();
      this.createMatch();
    },
    backHome() {
      this.stopWaitWatch();
      this.fromRandom = false;
      this.view = 'home';
      this.loadHome();
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 60rpx; }
.card { background: var(--card); border-radius: 28rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 24rpx 28rpx; margin-bottom: 20rpx; }
.empty { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 30rpx 0; }
.retry { margin-top: 12rpx; color: var(--brand-text); font-size: 26rpx; font-weight: 500; }

.hero { background: linear-gradient(135deg, #5b8af8, #2e5bff); border-radius: 32rpx; padding: 36rpx 32rpx; margin-bottom: 24rpx; box-shadow: 0 12rpx 36rpx rgba(46, 91, 255, 0.3); }
.hero-t { display: flex; align-items: center; gap: 12rpx; color: #fff; font-size: 40rpx; font-weight: 800; }
.hero-s { display: block; color: rgba(255, 255, 255, 0.85); font-size: 24rpx; margin-top: 10rpx; }

.sec-t { font-size: 24rpx; color: var(--ink-2); margin: 24rpx 8rpx 14rpx; }
.sec-h { display: flex; align-items: center; justify-content: space-between; margin: 28rpx 8rpx 14rpx; }
.sec-h .sec-t { margin: 0; }
.sec-more { font-size: 24rpx; color: var(--brand-text); }

.mod-chips { display: flex; flex-wrap: wrap; gap: 14rpx; margin-bottom: 24rpx; }
.chip { padding: 12rpx 26rpx; border-radius: 999rpx; background: var(--card); font-size: 26rpx; color: var(--ink); border: 1rpx solid var(--line); }
.chip.on { background: var(--brand); color: #fff; border-color: var(--brand-text); font-weight: 600; }

.act-btn { min-height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 999rpx; font-size: 30rpx; font-weight: 600; margin-bottom: 18rpx; }
.act-btn.main { background: var(--brand); color: #fff; }
.act-btn.sub { background: var(--brand-soft); color: var(--brand-text); }
.act-btn.plain { background: var(--card); color: var(--ink-2); border: 1rpx solid var(--line); }

.join-row { display: flex; gap: 16rpx; margin-bottom: 8rpx; }
.join-input { flex: 1; background: var(--card); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 0 30rpx; min-height: 44px; font-size: 28rpx; box-sizing: border-box; }
.join-btn { min-height: 44px; display: flex; align-items: center; padding: 0 40rpx; background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 28rpx; font-weight: 600; }

.lb-row { display: flex; align-items: center; gap: 20rpx; padding: 16rpx 0; border-bottom: 1rpx solid var(--fill); }
.lb-row:last-child { border-bottom: none; }
.lb-rank { width: 44rpx; height: 44rpx; border-radius: 50%; background: var(--fill); color: var(--ink-2); font-size: 24rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.lb-rank.r1 { background: #fef3c7; color: #d97706; }
.lb-rank.r2 { background: #e5e7eb; color: #6b7280; }
.lb-rank.r3 { background: #fde8d7; color: #c2632b; }
.lb-name { flex: 1; font-size: 28rpx; color: var(--ink); }
.lb-wins { font-size: 26rpx; font-weight: 700; color: var(--brand-text); }

.m-row { display: flex; align-items: center; gap: 16rpx; padding: 18rpx 0; border-bottom: 1rpx solid var(--fill); }
.m-row:last-child { border-bottom: none; }
.m-l { flex: 1; min-width: 0; }
.m-t { display: block; font-size: 28rpx; color: var(--ink); font-weight: 600; }
.m-s { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 4rpx; }
.m-badge { flex-shrink: 0; font-size: 22rpx; font-weight: 700; padding: 6rpx 18rpx; border-radius: 999rpx; }
.m-badge.win { background: var(--ok-soft); color: var(--ok-strong); }
.m-badge.lose { background: var(--bad-soft); color: var(--bad-strong); }
.m-badge.draw { background: var(--fill); color: var(--ink-2); }
.m-badge.wait { background: var(--warn-soft); color: var(--warn); }

.wait-hint { background: #fef3c7; color: #b45309; font-size: 26rpx; font-weight: 600; line-height: 1.6; }

/* 答题页 */
.pk-top { background: linear-gradient(135deg, #5b8af8, #2e5bff); border-radius: 32rpx; padding: 30rpx 32rpx; margin-bottom: 20rpx; box-shadow: 0 12rpx 36rpx rgba(46, 91, 255, 0.3); }
.vs { display: flex; align-items: center; justify-content: space-between; }
.p { display: flex; flex-direction: column; align-items: center; gap: 8rpx; width: 200rpx; }
.av { width: 96rpx; height: 96rpx; border-radius: 50%; background: #fff; color: var(--brand-text); display: flex; align-items: center; justify-content: center; font-size: 36rpx; font-weight: 800; }
.av.rival { color: #d97706; }
.nm { font-size: 22rpx; color: #fff; max-width: 200rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc { font-size: 44rpx; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
.sc-sub { font-size: 24rpx; font-weight: 600; color: rgba(255, 255, 255, 0.75); }
.mid { font-size: 40rpx; font-weight: 800; color: rgba(255, 255, 255, 0.85); }
.timer { margin-top: 22rpx; background: rgba(255, 255, 255, 0.2); border-radius: 999rpx; height: 14rpx; overflow: hidden; }
.timer-fill { height: 100%; background: #fff; border-radius: 999rpx; transition: width 0.25s linear; }
.timer-t { display: block; text-align: center; font-size: 22rpx; color: rgba(255, 255, 255, 0.85); margin-top: 12rpx; }

.streak { display: flex; justify-content: center; gap: 10rpx; margin: 8rpx 0 20rpx; }
.dot { width: 44rpx; height: 12rpx; border-radius: 6rpx; background: var(--fill); }
.dot.ok { background: var(--ok); }
.dot.bad { background: var(--bad); }
.dot.cur { background: #93b4fa; }

.q-tags { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.tag { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 8rpx; background: var(--brand-soft); color: var(--brand-text); }
.tag.gray { background: var(--fill); color: var(--ink-2); }
.stem { display: block; font-size: 30rpx; line-height: 1.7; color: var(--ink); }
.opt { display: flex; align-items: center; gap: 20rpx; border: 2rpx solid var(--line); border-radius: 20rpx; padding: 22rpx 26rpx; margin-top: 18rpx; }
.opt .k { width: 52rpx; height: 52rpx; border-radius: 50%; border: 2rpx solid var(--line); display: flex; align-items: center; justify-content: center; font-size: 26rpx; font-weight: 700; color: var(--ink-2); flex-shrink: 0; }
.opt .t { flex: 1; font-size: 28rpx; color: var(--ink); line-height: 1.6; }
.opt.pick { border-color: var(--brand-text); background: var(--brand-soft); }
.opt.pick .k { border-color: var(--brand-text); background: var(--brand); color: #fff; }
.hint { background: var(--brand-soft); box-shadow: none; font-size: 24rpx; color: var(--brand-text); }

/* 结果页 */
.res-hero { border-radius: 32rpx; padding: 44rpx 32rpx; margin-bottom: 24rpx; text-align: center; }
.res-hero.win { background: linear-gradient(135deg, #34d399, #16a34a); }
.res-hero.lose { background: linear-gradient(135deg, #f87171, #dc2626); }
.res-hero.draw { background: linear-gradient(135deg, #a5b4fc, #6366f1); }
.res-hero.waiting { background: linear-gradient(135deg, #fbbf24, #d97706); }
.res-t { display: block; color: #fff; font-size: 44rpx; font-weight: 800; }
.res-s { display: block; color: rgba(255, 255, 255, 0.9); font-size: 24rpx; margin-top: 10rpx; }

.res-vs { display: flex; align-items: center; padding: 32rpx 24rpx; }
.res-p { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.res-name { font-size: 24rpx; color: var(--ink-2); max-width: 240rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.res-score { font-size: 56rpx; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
.res-score.wait { color: var(--ink-4); }
.res-meta { font-size: 22rpx; color: var(--ink-2); }
.res-mid { font-size: 32rpx; font-weight: 800; color: var(--ink-4); padding: 0 12rpx; }

.share-card { text-align: center; }
.share-t { display: block; font-size: 28rpx; font-weight: 600; color: var(--ink); margin-bottom: 20rpx; }
.code-box { display: flex; align-items: center; justify-content: center; gap: 20rpx; background: var(--fill); border-radius: 20rpx; padding: 22rpx; margin-bottom: 24rpx; }
.code { font-size: 44rpx; font-weight: 800; letter-spacing: 8rpx; color: var(--ink); font-variant-numeric: tabular-nums; }
.copy { font-size: 24rpx; color: var(--brand-text); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.pk { max-width: 1044px; margin: 0 auto; }
  .pk-solo { max-width: 680px; margin: 0 auto; }
  .opt:hover, .chip:hover, .act-btn:hover, .m-row:hover, .join-btn:hover, .lb-row:hover { cursor: pointer; }
}

@media (min-width: 1024px) {
  .pk-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .pk-left { width: 420px; flex: none; position: sticky; top: 24rpx; }
  .pk-right { flex: 1; min-width: 0; }
  .pk-right .sec-h:first-child { margin-top: 0; }
}
/* #endif */
</style>
