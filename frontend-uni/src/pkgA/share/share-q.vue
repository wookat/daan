<template>
  <view class="wrap shareq">
    <view v-if="loading" class="card empty">加载中…</view>
    <view v-else-if="errMsg" class="card empty err">
      <text class="err-t">{{ errMsg }}</text>
      <text class="err-s">题目可能已被删除或链接不完整，10万+ 题库仍可免费刷</text>
      <view class="act-btn main" @click="goHome">去刷题</view>
    </view>

    <template v-else-if="d">
      <view class="from-bar">
        <view class="from-av">{{ (d.from_name || '?').slice(0, 1) }}</view>
        <view class="from-l">
          <text class="from-t">{{ d.from_name }} 分享了一道题</text>
          <text class="from-s">{{ d.answered || d.is_sharer ? nAnsweredText : '先作答，再看答案和大家的选择' }}</text>
        </view>
      </view>

      <view class="card q">
        <view class="q-tags">
          <text class="tag">{{ modLabel }}</text>
          <text v-if="d.question.submodule" class="tag gray">{{ d.question.submodule }}</text>
        </view>
        <text class="stem">{{ d.question.question }}</text>
        <view
          v-for="(t, k) in d.question.options"
          :key="k"
          class="opt"
          :class="optCls(k)"
          @click="pick(k)"
        >
          <text class="k">{{ k }}</text>
          <text class="t">{{ t }}</text>
        </view>
        <view v-if="isMulti && !revealed" class="multi-bar">
          <text class="multi-hint">多选题：选完所有正确项后确认</text>
          <view class="multi-ok" :class="{ dis: !multiSel.length || submitting }" role="button" @click="confirmMulti">
            确认答案{{ multiSel.length ? '（' + multiSel.length + '）' : '' }}
          </view>
        </view>
      </view>

      <!-- 作答后 / 分享者：答案与解析 -->
      <template v-if="revealed">
        <view v-if="myResult" class="res-bar" :class="myResult.correct ? 'ok' : 'bad'">
          {{ myResult.correct ? '✅ 答对了！正确答案 ' + d.question.answer : '❌ 答错了，正确答案是 ' + d.question.answer + '，你选了 ' + myResult.picked }}
        </view>
        <view v-else class="res-bar ok">正确答案：{{ d.question.answer }}</view>

        <view v-if="beatText" class="beat-bar">{{ beatText }}</view>

        <view v-if="d.question.explanation" class="card">
          <text class="exp-k">解析</text>
          <view class="exp">{{ d.question.explanation }}</view>
        </view>

        <view class="card">
          <text class="exp-k">大家的作答（{{ answers.length }} 人）</text>
          <view v-if="!answers.length" class="empty small">还没有人作答，把链接再发给几个考友吧</view>
          <view v-for="(a, i) in answers" :key="i" class="ans-row">
            <text class="ans-name">{{ a.nickname }}</text>
            <text class="ans-pick">选 {{ a.picked }}</text>
            <text class="ans-res" :class="a.correct ? 'ok' : 'bad'">{{ a.correct ? '对' : '错' }}</text>
          </view>
        </view>

        <view v-if="teamInvite && !teamJoined" class="card team-cta">
          <view class="tc-l">
            <text class="tc-t">和 {{ d.from_name }} 组队刷题</text>
            <text class="tc-s">加入小队「{{ teamInvite.name }}」，每天互相监督打卡</text>
          </view>
          <view class="tc-btn" :class="{ off: joining }" @click="joinTeam">{{ joining ? '加入中…' : '一键加入' }}</view>
        </view>
        <view v-else-if="teamJoined" class="card team-cta joined">
          <view class="tc-l">
            <text class="tc-t">🎉 已加入「{{ teamInvite.name }}」</text>
            <text class="tc-s">每天刷题就是打卡，队友都能看到你的进度</text>
          </view>
          <view class="tc-btn ghost" @click="goTeamPage">看队友 ›</view>
        </view>

        <view class="act-btn main" @click="goSimilar">去刷同类题</view>
        <view v-if="d.is_sharer" class="act-btn sub" @click="copyLink">复制分享链接，喊更多人来答</view>
      </template>

      <view class="reg-tip" @click="goLogin">
        <text class="reg-t">登录 / 注册错题邦，10万+ 题库免费刷 ›</text>
      </view>
    </template>
  </view>
</template>

<script>
import { shareDetail, shareAnswer, trackEvent, teamJoin, qShareText, canonicalizeSharePath } from '../../api.js';
import { togglePickLetter } from '../../exam-excl.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };
const modName = (m) => NAMES[m] || m || '行测';

export default {
  data() {
    return {
      sid: '',
      d: null,
      loading: true,
      errMsg: '',
      picked: '',
      multiSel: '',
      myResult: null,
      answers: [],
      startTs: 0,
      submitting: false,
      qStats: null,
      teamInvite: null,
      teamJoined: false,
      joining: false,
      joinedTeamId: null,
      variant: '',
    };
  },
  computed: {
    revealed() {
      return !!(this.d && (this.d.is_sharer || this.d.answered || this.myResult));
    },
    isMulti() {
      return !!(this.d && this.d.question && this.d.question.multi);
    },
    modLabel() {
      return modName(this.d && this.d.question.module);
    },
    nAnsweredText() {
      return `${this.answers.length || this.d.n_answered} 人已作答`;
    },
    beatText() {
      const s = this.qStats;
      if (!s || !s.total || !this.myResult) return '';
      if (s.total < 5) return `🎯 全站第 ${s.total} 个作答本题的人，把题发给更多考友一起比比`;
      if (this.myResult.correct && s.beat_pct != null) return `🏆 你击败了全站 ${s.beat_pct}% 的作答者（共 ${s.total} 人做过这题）`;
      if (s.acc != null) return `全站共 ${s.total} 人做过这题，正确率 ${s.acc}%，再战同类题赢回来`;
      return '';
    },
  },
  onLoad(query) {
    this.sid = query && query.sid ? String(query.sid) : '';
    const v = query && query.v ? String(query.v) : '';
    this.variant = v === 'a' || v === 'b' ? v : '';
    trackEvent('share_open', this.variant ? 'share_' + this.variant : 'share', this.sid || null);
    if (this.sid) canonicalizeSharePath('/s/' + encodeURIComponent(this.sid));
    uni.setStorageSync('regSource', 'share');
    this.load();
  },
  methods: {
    async load() {
      if (!this.sid) {
        this.loading = false;
        this.errMsg = '分享链接无效';
        return;
      }
      try {
        const d = await shareDetail(this.sid);
        this.d = d;
        this.answers = d.answers || [];
        if (d.my_answer) this.myResult = d.my_answer;
        if (d.q_stats) this.qStats = d.q_stats;
        this.teamInvite = d.team_invite || null;
        this.startTs = Date.now();
        uni.setNavigationBarTitle({ title: `${d.from_name} 考了你一道${d.question.submodule || modName(d.question.module)}题，你能做对吗？- 错题邦` });
      } catch (e) {
        this.errMsg = e.message || '分享不存在或已过期';
      }
      this.loading = false;
    },
    optCls(k) {
      if (!this.revealed) return { pick: this.picked === k || this.multiSel.indexOf(k) !== -1 };
      const right = String(this.d.question.answer || '');
      const myPick = String((this.myResult && this.myResult.picked) || '');
      return { right: right.includes(k), wrong: myPick.includes(k) && !right.includes(k) };
    },
    pick(k) {
      if (this.revealed || this.submitting) return;
      if (this.isMulti) {
        this.multiSel = togglePickLetter(this.multiSel, k);
        return;
      }
      this.submit(k);
    },
    confirmMulti() {
      if (this.revealed || this.submitting || !this.multiSel) return;
      this.submit(this.multiSel);
    },
    async submit(k) {
      this.picked = k;
      this.submitting = true;
      try {
        const secs = Math.round((Date.now() - this.startTs) / 1000);
        const r = await shareAnswer(this.sid, k, secs);
        this.myResult = { picked: k, correct: r.correct };
        this.d.question.answer = r.answer;
        this.d.question.explanation = r.explanation;
        this.answers = r.answers || [];
        if (r.q_stats) this.qStats = r.q_stats;
        if (r.team_invite) this.teamInvite = r.team_invite;
        trackEvent('share_answer', this.variant ? 'share_' + this.variant : 'share', this.sid);
      } catch (e) {
        this.picked = '';
        uni.showToast({ title: e.message || '提交失败', icon: 'none' });
      }
      this.submitting = false;
    },
    goSimilar() {
      uni.setStorageSync('practiceLaunch', {
        kind: 'start',
        module: this.d.question.module || null,
        submodule: this.d.question.submodule || null,
        count: 10,
        source: 'share',
      });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    copyLink() {
      const mod = this.d.question.submodule || modName(this.d.question.module);
      trackEvent('share_copy', 'share_q', this.sid);
      uni.setClipboardData({
        data: qShareText(mod, this.sid),
        success: () => uni.showToast({ title: '分享链接已复制', icon: 'none' }),
      });
    },
    async joinTeam() {
      if (this.joining) return;
      this.joining = true;
      try {
        const d = await teamJoin(this.teamInvite.code);
        this.teamJoined = true;
        this.joinedTeamId = d.team.id;
        trackEvent('share_team_join', 'share_q', this.sid);
        uni.showToast({ title: d.already ? '你已在该小队' : '加入成功！', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: e.message || '加入失败', icon: 'none' });
      }
      this.joining = false;
    },
    goTeamPage() {
      uni.navigateTo({ url: '/pkgA/team/team?id=' + this.joinedTeamId });
    },
    goHome() {
      uni.reLaunch({ url: '/pages/home/home' });
    },
    goLogin() {
      uni.navigateTo({ url: '/pkgA/user/login' });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 60rpx; }
.card { background: var(--card); border-radius: 28rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 24rpx 28rpx; margin-bottom: 20rpx; }
.empty { text-align: center; color: var(--ink-2); font-size: 25rpx; padding: 30rpx 0; }
.empty.small { padding: 16rpx 0; }
.empty.err { padding: 70rpx 28rpx; }
.err-t { display: block; font-size: 30rpx; font-weight: 600; color: var(--ink); }
.err-s { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 12rpx; margin-bottom: 32rpx; }
.empty.err .act-btn { max-width: 320rpx; margin: 0 auto; }

.from-bar { display: flex; align-items: center; gap: 18rpx; background: linear-gradient(135deg, #5b8af8, #2e5bff); border-radius: 28rpx; padding: 26rpx 28rpx; margin-bottom: 20rpx; box-shadow: 0 12rpx 36rpx rgba(46, 91, 255, 0.3); }
.from-av { width: 72rpx; height: 72rpx; border-radius: 50%; background: #fff; color: var(--brand-text); font-size: 30rpx; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.from-l { flex: 1; min-width: 0; }
.from-t { display: block; color: #fff; font-size: 30rpx; font-weight: 700; }
.from-s { display: block; color: rgba(255, 255, 255, 0.85); font-size: 24rpx; margin-top: 4rpx; }

.q-tags { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.tag { font-size: 24rpx; color: var(--brand-text); background: var(--brand-soft); border-radius: 8rpx; padding: 4rpx 14rpx; }
.tag.gray { color: var(--ink-2); background: var(--fill); }
.stem { display: block; font-size: 29rpx; color: var(--ink); line-height: 1.7; margin-bottom: 22rpx; white-space: pre-wrap; }

.opt { display: flex; gap: 16rpx; align-items: flex-start; border: 1rpx solid var(--line); border-radius: 18rpx; padding: 20rpx 22rpx; margin-bottom: 14rpx; }
.opt .k { font-weight: 700; color: var(--ink-2); }
.opt .t { flex: 1; font-size: 27rpx; color: var(--ink); line-height: 1.6; }
.opt.pick { border-color: var(--brand-text); background: var(--brand-soft); }
.opt.right { border-color: var(--ok); background: var(--ok-soft); }
.opt.wrong { border-color: var(--bad); background: var(--bad-soft); }
.multi-bar { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin: 4rpx 0 6rpx; }
.multi-hint { font-size: 24rpx; color: var(--ink-2); }
.multi-ok { min-height: 44px; padding: 0 32rpx; display: inline-flex; align-items: center; border-radius: 999rpx; background: var(--brand); color: #fff; font-size: 28rpx; font-weight: 600; flex-shrink: 0; }
.multi-ok.dis { opacity: 0.45; }

.res-bar { border-radius: 18rpx; padding: 20rpx 26rpx; font-size: 27rpx; font-weight: 600; margin-bottom: 20rpx; }
.res-bar.ok { background: var(--ok-soft); color: var(--ok); }
.res-bar.bad { background: var(--bad-soft); color: var(--bad); }

.beat-bar { border-radius: 18rpx; padding: 18rpx 26rpx; font-size: 25rpx; font-weight: 600; margin-bottom: 20rpx; background: #fef3c7; color: #b45309; }

.team-cta { display: flex; align-items: center; gap: 18rpx; }
.team-cta.joined { background: var(--ok-soft); }
.tc-l { flex: 1; min-width: 0; }
.tc-t { display: block; font-size: 28rpx; font-weight: 700; color: var(--ink); }
.tc-s { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 6rpx; }
.tc-btn { flex-shrink: 0; min-height: 40px; display: flex; align-items: center; padding: 0 30rpx; background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 25rpx; font-weight: 600; }
.tc-btn.off { opacity: 0.6; }
.tc-btn.ghost { background: var(--brand-soft); color: var(--brand-text); }

.exp-k { display: block; font-size: 24rpx; color: var(--ink-2); font-weight: 600; margin-bottom: 10rpx; }
.exp { font-size: 26rpx; color: var(--ink); line-height: 1.7; white-space: pre-wrap; }

.ans-row { display: flex; align-items: center; gap: 16rpx; padding: 14rpx 0; border-bottom: 1rpx solid var(--fill); }
.ans-row:last-child { border-bottom: none; }
.ans-name { flex: 1; font-size: 26rpx; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ans-pick { font-size: 24rpx; color: var(--ink-2); }
.ans-res { font-size: 24rpx; font-weight: 700; padding: 4rpx 16rpx; border-radius: 999rpx; }
.ans-res.ok { background: var(--ok-soft); color: var(--ok); }
.ans-res.bad { background: var(--bad-soft); color: var(--bad); }

.act-btn { min-height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 999rpx; font-size: 29rpx; font-weight: 600; margin-bottom: 18rpx; }
.act-btn.main { background: var(--brand); color: #fff; }
.act-btn.sub { background: var(--brand-soft); color: var(--brand-text); }

.reg-tip { text-align: center; padding: 20rpx 0; }
.reg-t { font-size: 24rpx; color: var(--brand-text); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.shareq { max-width: 640px; }
}
/* #endif */
</style>
