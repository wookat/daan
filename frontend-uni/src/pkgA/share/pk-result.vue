<template>
  <view class="wrap pkres">
    <view v-if="loading" class="card empty">加载中…</view>
    <view v-else-if="errMsg" class="card empty err">
      <text class="err-t">{{ errMsg }}</text>
      <text class="err-s">对局可能未结束或链接不完整，也可以发起你自己的 PK</text>
      <view class="act-btn main" @click="goChallenge">发起我的 PK 对局</view>
    </view>

    <template v-else-if="d">
      <view class="hero">
        <text class="hero-t">⚔️ 答题 PK 战绩</text>
        <text class="hero-s">{{ modLabel }} · 同组 {{ d.n_questions }} 题 · 挑战码 {{ d.code }}</text>
      </view>

      <view class="card vs">
        <view class="p" :class="{ win: d.winner === 'creator' }">
          <text v-if="d.winner === 'creator'" class="crown">👑</text>
          <view class="av">{{ (d.creator.name || '?').slice(0, 1) }}</view>
          <text class="nm">{{ creatorName }}</text>
          <text class="sc">{{ d.creator.score }}</text>
          <text class="meta">答对 {{ d.creator.correct }}/{{ d.n_questions }} · {{ fmtMs(d.creator.time_ms) }}</text>
        </view>
        <view class="mid">
          <text class="mid-vs">VS</text>
          <text class="mid-res">{{ resultText }}</text>
        </view>
        <view class="p" :class="{ win: d.winner === 'opponent' }">
          <text v-if="d.winner === 'opponent'" class="crown">👑</text>
          <view class="av rival">{{ (d.opponent.name || '?').slice(0, 1) }}</view>
          <text class="nm">{{ opponentName }}</text>
          <text class="sc">{{ d.opponent.score }}</text>
          <text class="meta">答对 {{ d.opponent.correct }}/{{ d.n_questions }} · {{ fmtMs(d.opponent.time_ms) }}</text>
        </view>
      </view>

      <view class="card cta">
        <text class="cta-t">不服来战？</text>
        <text class="cta-s">同组 10 题拼手速，答对 +80 分，越快加成越高</text>
        <view class="act-btn main" @click="goChallenge">发起我的 PK 对局</view>
      </view>

      <view class="reg-tip" @click="goLogin">
        <text class="reg-t">登录 / 注册错题邦，10万+ 题库免费刷 ›</text>
      </view>
    </template>
  </view>
</template>

<script>
import { pkResult, trackEvent, canonicalizeSharePath } from '../../api.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断' };

export default {
  data() {
    return { rid: '', d: null, loading: true, errMsg: '' };
  },
  computed: {
    modLabel() {
      return NAMES[this.d && this.d.module] || '混合模块';
    },
    sameName() {
      return !!(this.d && this.d.creator.name === this.d.opponent.name);
    },
    creatorName() {
      if (!this.d) return '';
      return this.sameName ? `${this.d.creator.name}（发起方）` : this.d.creator.name;
    },
    opponentName() {
      if (!this.d) return '';
      return this.sameName ? `${this.d.opponent.name}（应战方）` : this.d.opponent.name;
    },
    resultText() {
      if (!this.d) return '';
      if (this.d.winner === 'draw') return '平局';
      const w = this.d.winner === 'creator' ? this.creatorName : this.opponentName;
      return `${w} 获胜`;
    },
  },
  onLoad(query) {
    this.rid = query && query.rid ? String(query.rid) : '';
    trackEvent('pk_result_open', 'pk_share', this.rid || null);
    if (this.rid) canonicalizeSharePath('/p/' + encodeURIComponent(this.rid));
    uni.setStorageSync('regSource', 'pk_share');
    this.load();
  },
  methods: {
    async load() {
      if (!this.rid) {
        this.loading = false;
        this.errMsg = '战绩链接无效';
        return;
      }
      try {
        const d = await pkResult(this.rid);
        this.d = d;
        uni.setNavigationBarTitle({
          title: `${this.creatorName} vs ${this.opponentName} 的答题 PK 战绩，不服来战！- 错题邦`,
        });
      } catch (e) {
        this.errMsg = e.message || '战绩不存在或对局未结束';
      }
      this.loading = false;
    },
    fmtMs(ms) {
      if (ms == null) return '—';
      return (ms / 1000).toFixed(1) + 's';
    },
    goChallenge() {
      trackEvent('pk_result_challenge', 'pk_share', this.rid);
      uni.navigateTo({ url: '/pkgA/pk/pk' });
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
.empty.err { padding: 70rpx 28rpx; }
.err-t { display: block; font-size: 30rpx; font-weight: 600; color: var(--ink); }
.err-s { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 12rpx; margin-bottom: 32rpx; }
.empty.err .act-btn { max-width: 360rpx; margin: 0 auto; }

.hero { background: linear-gradient(135deg, #5b8af8, #2e5bff); border-radius: 32rpx; padding: 36rpx 32rpx; margin-bottom: 24rpx; box-shadow: 0 12rpx 36rpx rgba(46, 91, 255, 0.3); }
.hero-t { display: block; color: #fff; font-size: 40rpx; font-weight: 800; }
.hero-s { display: block; color: rgba(255, 255, 255, 0.85); font-size: 24rpx; margin-top: 10rpx; }

.vs { display: flex; align-items: stretch; padding: 32rpx 20rpx; }
.p { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; position: relative; padding-top: 30rpx; }
.crown { position: absolute; top: -6rpx; font-size: 34rpx; }
.av { width: 96rpx; height: 96rpx; border-radius: 50%; background: var(--brand-soft); color: var(--brand-text); display: flex; align-items: center; justify-content: center; font-size: 36rpx; font-weight: 800; }
.av.rival { background: #fef3c7; color: #d97706; }
.p.win .av { box-shadow: 0 0 0 6rpx #fbbf24; }
.nm { font-size: 24rpx; color: var(--ink); max-width: 220rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc { font-size: 52rpx; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
.p.win .sc { color: var(--brand-text); }
.meta { font-size: 24rpx; color: var(--ink-2); }
.mid { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10rpx; padding: 0 12rpx; }
.mid-vs { font-size: 36rpx; font-weight: 800; color: var(--ink-3); }
.mid-res { font-size: 24rpx; color: var(--ink-2); text-align: center; max-width: 140rpx; }

.cta { text-align: center; padding: 32rpx 28rpx; }
.cta-t { display: block; font-size: 32rpx; font-weight: 800; color: var(--ink); }
.cta-s { display: block; font-size: 24rpx; color: var(--ink-2); margin: 10rpx 0 24rpx; }
.act-btn { min-height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 999rpx; font-size: 29rpx; font-weight: 600; }
.act-btn.main { background: var(--brand); color: #fff; }

.reg-tip { text-align: center; padding: 20rpx 0; }
.reg-t { font-size: 24rpx; color: var(--brand-text); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.pkres { max-width: 640px; }
}
/* #endif */
</style>
