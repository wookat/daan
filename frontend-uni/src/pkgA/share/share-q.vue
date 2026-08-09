<template>
  <view class="wrap shareq">
    <view v-if="loading" class="card empty">加载中…</view>
    <view v-else-if="errMsg" class="card empty">{{ errMsg }}</view>

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
          <text class="tag">{{ d.question.module || '行测' }}</text>
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
      </view>

      <!-- 作答后 / 分享者：答案与解析 -->
      <template v-if="revealed">
        <view v-if="myResult" class="res-bar" :class="myResult.correct ? 'ok' : 'bad'">
          {{ myResult.correct ? '✅ 答对了！正确答案 ' + d.question.answer : '❌ 答错了，正确答案是 ' + d.question.answer + '，你选了 ' + myResult.picked }}
        </view>
        <view v-else class="res-bar ok">正确答案：{{ d.question.answer }}</view>

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

        <view class="act-btn main" @click="goSimilar">去刷同类题</view>
        <view v-if="d.is_sharer" class="act-btn sub" @click="copyLink">复制分享链接，喊更多人来答</view>
      </template>

      <view class="reg-tip" @click="goLogin">
        <text class="reg-t">登录 / 注册考公助手，13 万题库免费刷 ›</text>
      </view>
    </template>
  </view>
</template>

<script>
import { shareDetail, shareAnswer, trackEvent } from '../../api.js';

const SITE = 'https://kaogong.zalize.com';

export default {
  data() {
    return {
      sid: '',
      d: null,
      loading: true,
      errMsg: '',
      picked: '',
      myResult: null,
      answers: [],
      startTs: 0,
      submitting: false,
    };
  },
  computed: {
    revealed() {
      return !!(this.d && (this.d.is_sharer || this.d.answered || this.myResult));
    },
    nAnsweredText() {
      return `${this.answers.length || this.d.n_answered} 人已作答`;
    },
  },
  onLoad(query) {
    this.sid = query && query.sid ? String(query.sid) : '';
    trackEvent('share_open', 'share', this.sid || null);
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
        this.startTs = Date.now();
      } catch (e) {
        this.errMsg = e.message || '分享不存在或已过期';
      }
      this.loading = false;
    },
    optCls(k) {
      if (!this.revealed) return { pick: this.picked === k };
      const right = this.d.question.answer;
      const myPick = this.myResult ? this.myResult.picked : null;
      return { right: k === right, wrong: myPick && k === myPick && k !== right };
    },
    async pick(k) {
      if (this.revealed || this.submitting) return;
      this.picked = k;
      this.submitting = true;
      try {
        const secs = Math.round((Date.now() - this.startTs) / 1000);
        const r = await shareAnswer(this.sid, k, secs);
        this.myResult = { picked: k, correct: r.correct };
        this.d.question.answer = r.answer;
        this.d.question.explanation = r.explanation;
        this.answers = r.answers || [];
        trackEvent('share_answer', 'share', this.sid);
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
      uni.setClipboardData({
        data: `我在考公助手分享了一道题，敢来挑战吗？${SITE}/#/pkgA/share/share-q?sid=${this.sid}`,
        success: () => uni.showToast({ title: '分享链接已复制', icon: 'none' }),
      });
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

.from-bar { display: flex; align-items: center; gap: 18rpx; background: linear-gradient(135deg, #5b8af8, #3b6ff5); border-radius: 28rpx; padding: 26rpx 28rpx; margin-bottom: 20rpx; box-shadow: 0 12rpx 36rpx rgba(59, 111, 245, 0.3); }
.from-av { width: 72rpx; height: 72rpx; border-radius: 50%; background: #fff; color: var(--brand); font-size: 30rpx; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.from-l { flex: 1; min-width: 0; }
.from-t { display: block; color: #fff; font-size: 30rpx; font-weight: 700; }
.from-s { display: block; color: rgba(255, 255, 255, 0.85); font-size: 22rpx; margin-top: 4rpx; }

.q-tags { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.tag { font-size: 21rpx; color: var(--brand); background: var(--brand-soft); border-radius: 8rpx; padding: 4rpx 14rpx; }
.tag.gray { color: var(--ink-2); background: var(--fill); }
.stem { display: block; font-size: 29rpx; color: var(--ink); line-height: 1.7; margin-bottom: 22rpx; white-space: pre-wrap; }

.opt { display: flex; gap: 16rpx; align-items: flex-start; border: 1rpx solid var(--line); border-radius: 18rpx; padding: 20rpx 22rpx; margin-bottom: 14rpx; }
.opt .k { font-weight: 700; color: var(--ink-2); }
.opt .t { flex: 1; font-size: 27rpx; color: var(--ink); line-height: 1.6; }
.opt.pick { border-color: var(--brand); background: var(--brand-soft); }
.opt.right { border-color: var(--ok); background: var(--ok-soft); }
.opt.wrong { border-color: var(--bad); background: var(--bad-soft); }

.res-bar { border-radius: 18rpx; padding: 20rpx 26rpx; font-size: 27rpx; font-weight: 600; margin-bottom: 20rpx; }
.res-bar.ok { background: var(--ok-soft); color: var(--ok); }
.res-bar.bad { background: var(--bad-soft); color: var(--bad); }

.exp-k { display: block; font-size: 23rpx; color: var(--ink-2); font-weight: 600; margin-bottom: 10rpx; }
.exp { font-size: 26rpx; color: var(--ink); line-height: 1.7; white-space: pre-wrap; }

.ans-row { display: flex; align-items: center; gap: 16rpx; padding: 14rpx 0; border-bottom: 1rpx solid var(--fill); }
.ans-row:last-child { border-bottom: none; }
.ans-name { flex: 1; font-size: 26rpx; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ans-pick { font-size: 24rpx; color: var(--ink-2); }
.ans-res { font-size: 22rpx; font-weight: 700; padding: 4rpx 16rpx; border-radius: 999rpx; }
.ans-res.ok { background: var(--ok-soft); color: var(--ok); }
.ans-res.bad { background: var(--bad-soft); color: var(--bad); }

.act-btn { min-height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 999rpx; font-size: 29rpx; font-weight: 600; margin-bottom: 18rpx; }
.act-btn.main { background: var(--brand); color: #fff; }
.act-btn.sub { background: var(--brand-soft); color: var(--brand); }

.reg-tip { text-align: center; padding: 20rpx 0; }
.reg-t { font-size: 24rpx; color: var(--brand); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.shareq { max-width: 640px; }
}
/* #endif */
</style>
