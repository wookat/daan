<template>
  <view class="wrap tjoin">
    <kg-hero-card label="刷题小队邀请" value="一起打卡冲上岸">
      <text class="hero-s">队友邀请你加入小队，每天刷题就是打卡，进度队友都看得见</text>
    </kg-hero-card>

    <kg-card class="jcard">
      <template v-if="state === 'ready'">
        <text class="code-l">邀请码</text>
        <text class="code num">{{ code }}</text>
        <kg-button variant="primary" size="lg" block @click="join">加入小队</kg-button>
      </template>
      <template v-else-if="state === 'joined'">
        <view class="ok-ico"><l-icon name="party-popper" :size="32" tone="brand" /></view>
        <text class="ok-t">已加入「{{ teamName }}」</text>
        <text class="ok-s">每天刷题就是打卡，队友都能看到你的进度</text>
        <view class="acts">
          <kg-button variant="primary" size="lg" block @click="goTeam">看队友打卡情况</kg-button>
          <kg-button variant="secondary" size="lg" block @click="goPractice">立刻刷 10 题打卡</kg-button>
        </view>
      </template>
      <template v-else-if="state === 'input'">
        <text class="code-l">输入邀请码加入小队</text>
        <kg-invite-input v-model="code" :maxlength="8" :minlength="6" placeholder="6 位邀请码，如 A8X2QK" button-text="加入小队" @submit="join" />
      </template>
      <template v-else>
        <view class="ok-ico is-bad"><l-icon name="circle-x" :size="32" tone="bad" /></view>
        <text class="err" role="alert">{{ errMsg }}</text>
        <kg-button variant="secondary" size="lg" block @click="state = 'input'">手动输入邀请码</kg-button>
      </template>
    </kg-card>

    <view class="reg-tip">
      <kg-button variant="text" size="lg" @click="goLogin">登录 / 注册账号，打卡记录多端同步 ›</kg-button>
    </view>
  </view>
</template>

<script>
import { teamJoin, trackEvent } from '../../api.js';

const SEO_TITLE = '队友邀请你加入刷题小队，一起打卡冲上岸 - 错题邦';

export default {
  data() {
    return { code: '', state: 'input', teamName: '', errMsg: '' };
  },
  onLoad(query) {
    const c = query && query.code ? String(query.code).trim().toUpperCase() : '';
    trackEvent('team_join_open', 'team', c || null);
    uni.setStorageSync('regSource', 'team');
    if (c) {
      this.code = c;
      this.state = 'ready';
    }
  },
  onReady() {
    // 导航栏标题固定为 pages.json 的「加入小队」；SEO 长句只写 <title>（分享/搜索用）
    // #ifdef H5
    if (typeof document !== 'undefined') document.title = SEO_TITLE;
    // #endif
  },
  methods: {
    async join() {
      const c = (this.code || '').trim().toUpperCase();
      if (!c) return uni.showToast({ title: '请输入邀请码', icon: 'none' });
      try {
        uni.showLoading({ title: '加入中…' });
        const d = await teamJoin(c);
        uni.hideLoading();
        this.teamName = d.team.name;
        this.state = 'joined';
        this._teamId = d.team.id;
      } catch (e) {
        uni.hideLoading();
        this.errMsg = e.message || '加入失败，邀请码可能无效';
        this.state = 'error';
      }
    },
    goTeam() {
      uni.navigateTo({ url: '/pkgA/team/team?id=' + this._teamId });
    },
    goPractice() {
      uni.setStorageSync('practiceLaunch', { kind: 'start', count: 10, source: 'team' });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goLogin() {
      uni.navigateTo({ url: '/pkgA/user/login' });
    },
  },
};
</script>

<style scoped>
/* T5 工具页：单列居中 max 480，永不双栏 */
.wrap { padding: var(--sp-16) var(--page-x) var(--sp-40); display: flex; flex-direction: column; gap: var(--sp-16); }
.hero-s { display: block; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--on-brand-2); }

.jcard { display: grid; justify-items: center; text-align: center; padding: var(--sp-24) var(--sp-16); }
.jcard :deep(.kg-inv) { width: 100%; }
.code-l { font-size: var(--fs-sub); color: var(--ink-3); margin-bottom: var(--sp-12); }
.code { font-size: var(--fs-display); font-weight: 600; line-height: var(--lh-display); color: var(--brand-text); letter-spacing: 4px; margin-bottom: var(--sp-24); }
.ok-ico { width: 64px; height: 64px; border-radius: var(--r-full); background: var(--brand-soft); display: flex; align-items: center; justify-content: center; margin-bottom: var(--sp-12); }
.ok-ico.is-bad { background: var(--bad-soft); }
.ok-t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); line-height: var(--lh-h3); margin-bottom: var(--sp-4); }
.ok-s { font-size: var(--fs-sub); color: var(--ink-3); line-height: var(--lh-sub); margin-bottom: var(--sp-24); }
.err { font-size: var(--fs-body); color: var(--bad-strong); line-height: var(--lh-body); margin-bottom: var(--sp-20); }
.acts { width: 100%; display: grid; gap: var(--sp-12); }
.acts :deep(.kg-btn), .jcard > :deep(.kg-btn) { width: 100%; }

.reg-tip { display: flex; justify-content: center; }

/* #ifdef H5 */
@media (min-width: 700px) {
  .wrap.tjoin { max-width: 480px; }
}
/* #endif */
</style>
