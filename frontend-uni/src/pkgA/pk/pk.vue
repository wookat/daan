<template>
  <view class="page" :class="{ 'is-quiz': view === 'quiz' }">
    <!-- 入口页（T1） -->
    <kg-two-col v-if="view === 'home'">
      <template #main>
        <kg-hero-card label="本周胜场" :value="lb.my_wins || 0" unit="胜">
          <text class="hero-s">{{ lb.my_rank ? '本周榜 #' + lb.my_rank + ' · ' : '' }}同组 10 题拼手速 · 答对 +80，越快加成越高</text>
        </kg-hero-card>

        <kg-card variant="flat" class="sec">
          <text class="h">选择模块</text>
          <kg-chip-row :options="modOpts" :model-value="module || ''" @update:model-value="module = $event || null" />
          <view class="acts">
            <kg-button block size="lg" icon="swords" @click="createMatch">发起好友挑战</kg-button>
            <kg-button block size="lg" variant="ghost" icon="shuffle" @click="randomMatch">随机匹配对手</kg-button>
          </view>
          <kg-invite-input v-model="joinCode" placeholder="输入挑战码，如 A8X2QK" button-text="应战" :maxlength="8" class="join" @submit="joinByCode" />
        </kg-card>

        <kg-card variant="flat" class="sec">
          <view class="sec-h">
            <text class="h">我的对局</text>
            <text v-if="mine.wins" class="sec-more num">累计 {{ mine.wins }} 胜</text>
          </view>
          <kg-empty-state v-if="loadErr && !mine.items.length" compact icon="wifi-off" title="加载失败" :desc="loadErr" cta-text="重试" @cta="loadHome" />
          <kg-empty-state v-else-if="!mine.items.length" compact icon="swords" title="还没有对局记录" desc="发起一局或输入挑战码应战" />
          <view v-for="m in mine.items" :key="m.code" class="m-row" role="button" hover-class="row--hover" @click="openMatch(m)">
            <view class="m-l">
              <text class="m-t">{{ MODS[m.module] || '混合' }} · <text class="num">{{ m.code }}</text></text>
              <text class="m-s">{{ matchDesc(m) }}</text>
            </view>
            <kg-tag :tone="matchBadge(m).tone">{{ matchBadge(m).t }}</kg-tag>
            <l-icon name="chevron-right" :size="16" tone="faint" />
          </view>
        </kg-card>
      </template>

      <template #aside>
        <kg-card variant="flat" class="sec lb-card">
          <view class="sec-h">
            <text class="h">本周胜场榜</text>
            <text v-if="lb.my_rank" class="sec-more num">我的排名 #{{ lb.my_rank }} · {{ lb.my_wins }} 胜</text>
          </view>
          <kg-empty-state v-if="loadErr && !lb.items.length" compact icon="wifi-off" title="加载失败" :desc="loadErr" cta-text="重试" @cta="loadHome" />
          <kg-empty-state v-else-if="!lb.items.length" compact icon="trophy" title="本周还没有对局" desc="快来抢占榜首！" />
          <view v-for="e in lb.items" :key="e.rank" class="lb-row">
            <kg-tag :tone="e.rank === 1 ? 'warn' : e.rank <= 3 ? 'brand' : 'neutral'" class="lb-rank">{{ e.rank }}</kg-tag>
            <text class="lb-name">{{ e.name }}</text>
            <text class="lb-wins num">{{ e.wins }} 胜</text>
          </view>
        </kg-card>
      </template>
    </kg-two-col>

    <!-- 答题页（T3） -->
    <template v-else-if="view === 'quiz'">
      <kg-card variant="raised" class="pk-top">
        <view class="vs">
          <view class="p">
            <view class="av">我</view>
            <text class="nm">{{ myName }}</text>
            <text class="sc num">{{ answers.length }}<text class="sc-sub">/{{ questions.length }}</text></text>
          </view>
          <text class="mid">VS</text>
          <view class="p">
            <view class="av rival">{{ (rivalName || '?').slice(0, 1) }}</view>
            <text class="nm">{{ rivalName || '等待对手' }}</text>
            <text class="sc num">{{ rivalScore == null ? '—' : rivalScore }}</text>
          </view>
        </view>
        <kg-progress :value="timeLeft" :max="30" aria-label="本题剩余时间" />
        <text class="timer-t num">本题剩余 {{ timeLeft }} 秒 · 答对+80，越快加成越高 · 第 {{ qIndex + 1 }}/{{ questions.length }} 题</text>
        <view class="streak" aria-hidden="true">
          <view v-for="(s, i) in streak" :key="i" class="dot" :class="s" />
        </view>
      </kg-card>

      <kg-question-card v-if="curQ" :q="quizQ" :index="qIndex" :total="questions.length" class="sec">
        <kg-option-group :options="quizOpts" :model-value="picked" :readonly="!!picked" @select="pick" />
      </kg-question-card>

      <kg-banner v-if="rivalDone" tone="info" icon="zap" :closable="false" text="对手已完成全部作答 —— 锁定你的答案！" class="sec" />
      <kg-banner v-if="submitFailed" tone="warn" :closable="false" text="提交未成功（作答已保留），网络恢复后可重试" action-text="重新提交" class="sec" @action="finishQuiz" />
    </template>

    <!-- 结果 / 等待页（T4） -->
    <template v-else-if="view === 'result'">
      <kg-hero-card :label="resTitle" :value="myP().score" unit="分">
        <text class="hero-s">{{ MODS[match.module] || '混合模块' }} · 挑战码 <text class="num">{{ match.code }}</text></text>
      </kg-hero-card>

      <kg-card variant="flat" class="sec res-vs">
        <view class="p">
          <text class="nm">{{ myP().name }}{{ mySide ? '（我）' : '' }}</text>
          <text class="sc num">{{ myP().score }}</text>
          <text class="meta num">答对 {{ myP().correct }}/{{ match.n_questions }} · 用时 {{ fmtMs(myP().time_ms) }}</text>
        </view>
        <text class="mid">VS</text>
        <view class="p">
          <template v-if="theirP() && theirP().done">
            <text class="nm">{{ theirP().name }}</text>
            <text class="sc num">{{ theirP().score }}</text>
            <text class="meta num">答对 {{ theirP().correct }}/{{ match.n_questions }} · 用时 {{ fmtMs(theirP().time_ms) }}</text>
          </template>
          <template v-else>
            <text class="nm">{{ theirP() ? theirP().name : '虚位以待' }}</text>
            <text class="sc wait">?</text>
            <text class="meta">等待对手完成同组 10 题</text>
          </template>
        </view>
      </kg-card>

      <template v-if="match.status !== 'finished'">
        <kg-banner v-if="noOppHint" tone="warn" :closable="false" text="暂无对手，试试邀请好友——复制下方挑战码或分享链接，叫考友来应战" class="sec" />
        <kg-card variant="flat" class="sec share-card">
          <text class="h">把挑战发给考友，等 TA 应战</text>
          <view class="code-box" role="button" aria-label="复制挑战码" @click="copyCode">
            <text class="code num">{{ match.code }}</text>
            <l-icon name="copy" :size="20" tone="brand" />
          </view>
          <kg-button block size="md" variant="ghost" icon="refresh-cw" @click="refreshMatch">刷新对局状态</kg-button>
        </kg-card>
        <kg-action-bar layout="actions" :primary-text="isMp ? '转发给好友应战' : '复制挑战链接'" secondary-text="返回 PK 大厅" @primary="shareMatch" @secondary="backHome" />
      </template>
      <template v-else>
        <view class="sec back-row">
          <kg-button variant="text" size="md" icon="arrow-left" @click="backHome">返回 PK 大厅</kg-button>
        </view>
        <kg-action-bar layout="actions" primary-text="再来一局" secondary-text="晒战绩，喊人来战" @primary="rematch" @secondary="shareResult" />
      </template>
    </template>

    <kg-skeleton v-else preset="cards" />
  </view>
</template>

<script>
import { pkCreate, pkJoin, pkRandomMatch, pkMatch, pkSubmit, pkMine, pkLeaderboard, pkNickname, trackEvent } from '../../api.js';
import { MODULES } from '../../module-meta.js';

const MODS = Object.fromEntries(Object.keys(MODULES).map((k) => [k, MODULES[k].label]));
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
    modOpts() {
      // 默认选中「混合」(value '')：放首位，kg-chip-row 默认 scrollToSelected 才不会把首屏滚到行尾
      return [{ value: '', label: '混合' }].concat(Object.keys(MODS).map((k) => ({ value: k, label: MODS[k] })));
    },
    quizQ() {
      const q = this.curQ;
      return { id: q.id, module: q.module, tag3: q.submodule || '', stem: String(q.question || '') };
    },
    quizOpts() {
      const o = (this.curQ && this.curQ.options) || {};
      return Object.keys(o).map((k) => ({ key: k, text: String(o[k] == null ? '' : o[k]) }));
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
      if (m.status !== 'finished') return { t: '等待中', tone: 'warn' };
      if (m.winner === 'draw') return { t: '平局', tone: 'neutral' };
      return m.winner === m.my_side ? { t: '胜', tone: 'ok' } : { t: '负', tone: 'bad' };
    },
    copyCode() {
      uni.setClipboardData({ data: this.match.code, success: () => uni.showToast({ title: '挑战码已复制', icon: 'none' }) });
    },
    shareMatch() {
      // #ifdef H5
      const url = `${window.location.origin}${window.location.pathname}#/pkgA/pk/pk?code=${this.match.code}`;
      uni.setClipboardData({
        data: `我在答岸向你发起答题 PK（挑战码 ${this.match.code}），敢来应战吗？${url}`,
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
.page { padding: var(--sp-16) var(--page-x) calc(var(--bar-h) + var(--sp-24) + env(safe-area-inset-bottom, 0px)); }
.sec { margin-top: var(--card-gap); }
.hero-s { display: block; font-size: var(--fs-sub); color: var(--on-brand); opacity: 0.85; margin-top: var(--sp-8); }
.h { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.sec-h { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); margin-bottom: var(--sp-12); }
.sec-more { font-size: var(--fs-caption); color: var(--brand-text); }
.acts { display: flex; flex-direction: column; gap: var(--sp-8); margin-top: var(--sp-16); }
.join { margin-top: var(--sp-16); }
.m-row { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--cell-h); padding: var(--sp-8) 0; border-bottom: 1px solid var(--line); }
.m-row:last-child { border-bottom: none; padding-bottom: 0; }
.row--hover { background: var(--fill); }
.m-l { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-4); }
.m-t { font-size: var(--fs-body); color: var(--ink); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-s { font-size: var(--fs-caption); color: var(--ink-2); }
.lb-row { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); padding: var(--sp-4) 0; border-bottom: 1px solid var(--line); }
.lb-row:last-child { border-bottom: none; }
.lb-rank { flex-shrink: 0; min-width: 28px; justify-content: center; }
.lb-name { flex: 1; min-width: 0; font-size: var(--fs-body); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lb-wins { flex-shrink: 0; font-size: var(--fs-body); font-weight: 600; color: var(--brand-text); }

/* 答题页 */
.vs { display: flex; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-12); }
.p { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); }
.av { width: 40px; height: 40px; border-radius: var(--r-full); background: var(--brand-soft); color: var(--brand-text); display: flex; align-items: center; justify-content: center; font-size: var(--fs-body); font-weight: 600; }
.av.rival { background: var(--warn-soft); color: var(--warn-strong); }
.nm { font-size: var(--fs-caption); color: var(--ink-2); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc { font-size: var(--fs-h1); font-weight: 600; color: var(--ink); line-height: var(--lh-h1); }
.sc-sub { font-size: var(--fs-sub); color: var(--ink-3); font-weight: 400; }
.sc.wait { color: var(--ink-3); }
.mid { font-size: var(--fs-h3); font-weight: 600; color: var(--ink-3); flex-shrink: 0; }
.timer-t { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-8); text-align: center; }
.streak { display: flex; justify-content: center; gap: var(--sp-4); margin-top: var(--sp-12); }
.dot { width: 8px; height: 8px; border-radius: var(--r-full); background: var(--line); }
.dot.cur { background: var(--brand); }
.dot.ok { background: var(--ok); }
.dot.bad { background: var(--bad); }

/* 结果页 */
.res-vs { display: flex; align-items: stretch; gap: var(--sp-8); }
.res-vs .sc { font-size: var(--fs-display); line-height: var(--lh-display); }
.meta { font-size: var(--fs-caption); color: var(--ink-2); text-align: center; }
.code-box { display: flex; align-items: center; justify-content: center; gap: var(--sp-12); min-height: var(--hit-min); margin: var(--sp-12) 0; border: 1px dashed var(--brand); border-radius: var(--r-md); background: var(--brand-soft); }
.code { font-size: var(--fs-h1); font-weight: 600; letter-spacing: 4px; color: var(--brand-text); }
.back-row { display: flex; justify-content: center; }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .page { max-width: 1064px; margin: 0 auto; }
  .page.is-quiz { max-width: 760px; }
  .lb-card { margin-top: 0; }
  .m-row, .code-box { cursor: pointer; }
}
/* #endif */
</style>
