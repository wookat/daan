<template>
  <view class="page">
    <kg-skeleton v-if="loading" preset="cards" />
    <kg-empty-state
      v-else-if="errMsg"
      icon="swords"
      :title="errMsg"
      desc="对局可能未结束或链接不完整，也可以发起你自己的 PK"
      cta-text="发起我的 PK 对局"
      @cta="goChallenge"
    />

    <template v-else-if="d">
      <kg-hero-card label="答题 PK 战绩" :value="d.creator.score + ' : ' + d.opponent.score">
        <text class="hero-s">{{ resultText }} · {{ modLabel }} · 同组 {{ d.n_questions }} 题 · 挑战码 <text class="num">{{ d.code }}</text></text>
      </kg-hero-card>

      <kg-card variant="flat" class="sec vs">
        <view class="p" :class="{ win: d.winner === 'creator' }">
          <view class="av-wrap">
            <l-icon v-if="d.winner === 'creator'" name="crown" :size="20" tone="warn" fill="currentColor" class="crown" />
            <view class="av">{{ (d.creator.name || '?').slice(0, 1) }}</view>
          </view>
          <text class="nm">{{ creatorName }}</text>
          <text class="sc num">{{ d.creator.score }}</text>
          <text class="meta num">答对 {{ d.creator.correct }}/{{ d.n_questions }} · {{ fmtMs(d.creator.time_ms) }}</text>
        </view>
        <view class="mid">
          <text class="mid-vs">VS</text>
          <kg-tag :tone="d.winner === 'draw' ? 'neutral' : 'brand'">{{ resultText }}</kg-tag>
        </view>
        <view class="p" :class="{ win: d.winner === 'opponent' }">
          <view class="av-wrap">
            <l-icon v-if="d.winner === 'opponent'" name="crown" :size="20" tone="warn" fill="currentColor" class="crown" />
            <view class="av rival">{{ (d.opponent.name || '?').slice(0, 1) }}</view>
          </view>
          <text class="nm">{{ opponentName }}</text>
          <text class="sc num">{{ d.opponent.score }}</text>
          <text class="meta num">答对 {{ d.opponent.correct }}/{{ d.n_questions }} · {{ fmtMs(d.opponent.time_ms) }}</text>
        </view>
      </kg-card>

      <kg-card variant="flat" class="sec">
        <kg-stat-row :items="[
          { label: creatorName + ' 答对', value: d.creator.correct, unit: '/' + d.n_questions, tone: d.winner === 'creator' ? 'brand' : undefined },
          { label: '用时对比', value: fmtMs(d.creator.time_ms) + ' vs ' + fmtMs(d.opponent.time_ms) },
          { label: opponentName + ' 答对', value: d.opponent.correct, unit: '/' + d.n_questions, tone: d.winner === 'opponent' ? 'brand' : undefined },
        ]" />
      </kg-card>

      <kg-card variant="flat" class="sec cta">
        <text class="cta-t">不服来战？</text>
        <text class="cta-s">同组 10 题拼手速，答对 +80 分，越快加成越高</text>
      </kg-card>

      <view class="reg-tip">
        <kg-button variant="text" size="md" @click="goLogin">登录 / 注册岸上见，10万+ 题库免费刷</kg-button>
      </view>

      <kg-action-bar layout="actions" primary-text="发起我的 PK 对局" @primary="goChallenge" />
    </template>
  </view>
</template>

<script>
import { pkResult, trackEvent, canonicalizeSharePath } from '../../api.js';
import { MODULES, moduleLabel } from '../../module-meta.js';

export default {
  data() {
    return { rid: '', d: null, loading: true, errMsg: '' };
  },
  computed: {
    modLabel() {
      const m = this.d && this.d.module;
      return MODULES[m] ? moduleLabel(m) : '混合模块';
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
          title: `${this.creatorName} vs ${this.opponentName} 的答题 PK 战绩，不服来战！- 岸上见`,
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
.page { padding: var(--sp-16) var(--page-x) calc(var(--bar-h) + var(--sp-24) + env(safe-area-inset-bottom, 0px)); }
.sec { margin-top: var(--card-gap); }
.hero-s { display: block; font-size: var(--fs-sub); color: var(--on-brand); opacity: 0.85; margin-top: var(--sp-8); }
.vs { display: flex; align-items: stretch; gap: var(--sp-8); }
.p { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); }
.av-wrap { position: relative; padding-top: var(--sp-16); }
.crown { position: absolute; top: -2px; left: 50%; transform: translateX(-50%); }
.av { width: 48px; height: 48px; border-radius: var(--r-full); background: var(--brand-soft); color: var(--brand-text); display: flex; align-items: center; justify-content: center; font-size: var(--fs-h3); font-weight: 600; }
.av.rival { background: var(--warn-soft); color: var(--warn-strong); }
.p.win .av { box-shadow: 0 0 0 3px var(--warn); }
.nm { font-size: var(--fs-sub); color: var(--ink); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc { font-size: var(--fs-display); font-weight: 600; color: var(--ink); line-height: var(--lh-display); }
.p.win .sc { color: var(--brand-text); }
.meta { font-size: var(--fs-caption); color: var(--ink-2); text-align: center; }
.mid { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-8); padding: 0 var(--sp-4); }
.mid-vs { font-size: var(--fs-h2); font-weight: 600; color: var(--ink-3); }
.cta { text-align: center; }
.cta-t { display: block; font-size: var(--fs-h2); font-weight: 600; color: var(--ink); }
.cta-s { display: block; font-size: var(--fs-sub); color: var(--ink-2); margin-top: var(--sp-8); }
.reg-tip { display: flex; justify-content: center; padding: var(--sp-12) 0; }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .page { max-width: 760px; margin: 0 auto; padding-bottom: var(--sp-24); }
}
/* #endif */
</style>
