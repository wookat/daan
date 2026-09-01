<template>
  <view class="wrap reminders">
    <view class="card group">
      <view class="set-row">
        <view class="ico"><l-icon name="alarm-clock" :size="18" color="#2e5bff" /></view>
        <view class="grow">
          <text class="nm">每日刷题提醒</text>
          <text class="sub">每天 {{ time }} · 未完成今日目标时提醒</text>
        </view>
        <wd-switch :model-value="on" active-color="#2e5bff" size="22px" @change="toggle" />
      </view>
      <view class="set-row" :class="{ dim: !on }">
        <view class="ico"><l-icon name="clock" :size="18" color="#2e5bff" /></view>
        <view class="grow">
          <text class="nm">提醒时间</text>
          <text class="sub">建议安排在晚间黄金学习时段</text>
        </view>
        <picker mode="time" :value="time" :disabled="!on" @change="setTime">
          <view class="time-v">{{ time }} ›</view>
        </picker>
      </view>
    </view>

    <!-- #ifdef H5 -->
    <view v-if="on && perm !== 'granted'" class="card warn-card">
      <view class="warn-t"><l-icon name="bell" :size="15" color="#d97706" /><text>{{ perm === 'denied' ? '浏览器通知权限被拒绝' : '需要开启浏览器通知权限' }}</text></view>
      <text class="warn-s">{{ perm === 'denied' ? '请在浏览器地址栏左侧站点设置中允许「通知」后刷新页面。' : '开启后才能在提醒时间收到今日目标进度提示。' }}</text>
      <view v-if="perm !== 'denied'" class="warn-btn" @click="askPerm">开启通知权限</view>
    </view>
    <view v-if="perm === 'unsupported'" class="card warn-card">
      <text class="warn-t">当前浏览器不支持通知</text>
      <text class="warn-s">提醒仅在支持 Notification 的浏览器（且页面保持打开）时生效。</text>
    </view>
    <!-- #endif -->

    <!-- #ifdef H5 -->
    <view v-if="pushSupported" class="card group">
      <view class="set-row">
        <view class="ico"><l-icon name="send" :size="18" color="#2e5bff" /></view>
        <view class="grow">
          <text class="nm">每日一练离线推送</text>
          <text class="sub">每天早上推送全站同题 10 题，关闭页面也能收到</text>
        </view>
        <wd-switch :model-value="pushOn" :disabled="pushBusy" active-color="#2e5bff" size="22px" @change="togglePush" />
      </view>
    </view>
    <!-- #endif -->

    <!-- #ifdef MP-WEIXIN -->
    <view v-if="mpSubscribeAvailable" class="card group">
      <view class="set-row" @click="mpSubscribe">
        <view class="ico"><l-icon name="send" :size="18" color="#2e5bff" /></view>
        <view class="grow">
          <text class="nm">微信订阅提醒</text>
          <text class="sub">一次授权可收到一条服务通知</text>
        </view>
        <text class="time-v">去订阅 ›</text>
      </view>
    </view>
    <!-- #endif -->

    <view class="sec-t">提醒样式预览</view>
    <view class="push">
      <view class="hd"><text class="appico">岸</text><text>错题邦 · {{ time }}</text></view>
      <text class="tt">{{ done >= goal ? '今日目标已达成，保持手感再练一组？🎉' : '今晚还差 ' + previewLeft + ' 题就能守住连续打卡 🔥' }}</text>
      <text class="bd">今日目标 {{ goal }} 题已完成 {{ done }} 题{{ done >= goal ? '' : '，练完守住连续打卡～' }}</text>
    </view>

    <view class="card tip">
      <text class="tip-t"><l-icon name="lightbulb" :size="14" color="#2e5bff" /> 提醒只在「有事可做」时打扰你：当天已达成目标则改为轻量鼓励；H5 端需保持页面打开才能收到通知。</text>
    </view>
  </view>
</template>

<script>
import { getReminderSettings, setReminderSettings } from '../../reminder.js';
// #ifdef H5
import { request, anonUid } from '../../api.js';
// #endif
// #ifdef H5
import { notificationPermission, requestNotificationPermission } from '../../reminder.js';
// #endif
// #ifdef MP-WEIXIN
import { MP_SUBSCRIBE_TEMPLATE_ID, requestMpSubscribe } from '../../reminder.js';
// #endif

export default {
  data() {
    return {
      on: false,
      time: '20:30',
      perm: 'default',
      done: 0,
      goal: 20,
      pushSupported: false,
      pushOn: false,
      pushBusy: false,
      pushKey: '',
    };
  },
  computed: {
    previewLeft() {
      return Math.max(0, this.goal - this.done);
    },
    mpSubscribeAvailable() {
      // #ifdef MP-WEIXIN
      return !!MP_SUBSCRIBE_TEMPLATE_ID;
      // #endif
      // eslint-disable-next-line no-unreachable
      return false;
    },
  },
  onShow() {
    const s = getReminderSettings();
    this.on = s.on;
    this.time = s.time;
    this.goal = uni.getStorageSync('dailyGoal') || 20;
    const pstats = uni.getStorageSync('pstats') || { days: {} };
    this.done = (pstats.days || {})[new Date().toISOString().slice(0, 10)] || 0;
    // #ifdef H5
    this.perm = notificationPermission();
    this.initPush();
    // #endif
  },
  methods: {
    async toggle({ value }) {
      this.on = value;
      setReminderSettings({ on: this.on, time: this.time });
      // #ifdef H5
      if (this.on && this.perm !== 'granted') await this.askPerm();
      // #endif
      uni.showToast({ title: this.on ? `已开启 · 每天 ${this.time} 提醒` : '已关闭提醒', icon: 'none' });
    },
    setTime(e) {
      this.time = e.detail.value;
      setReminderSettings({ on: this.on, time: this.time });
      uni.removeStorageSync('remindFired');
      if (this.on) uni.showToast({ title: `每天 ${this.time} 提醒`, icon: 'none' });
    },
    // #ifdef H5
    async askPerm() {
      this.perm = await requestNotificationPermission();
      if (this.perm === 'granted') uni.showToast({ title: '通知权限已开启', icon: 'none' });
    },
    async initPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
        const { key } = await request('/api/push/pubkey');
        if (!key) return;
        this.pushKey = key;
        this.pushSupported = true;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        this.pushOn = !!sub;
      } catch (e) { /* 推送不可用时不渲染入口 */ }
    },
    async togglePush({ value }) {
      this.pushBusy = true;
      try {
        const reg = await navigator.serviceWorker.ready;
        if (value) {
          const perm = await requestNotificationPermission();
          if (perm !== 'granted') {
            this.perm = perm;
            this.pushOn = false;
            uni.showToast({ title: '需要通知权限才能推送', icon: 'none' });
            return;
          }
          this.perm = perm;
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.vapidKeyBytes(),
          });
          await request('/api/push/subscribe', { method: 'POST', data: { uid: anonUid(), sub: sub.toJSON() } });
          this.pushOn = true;
          uni.showToast({ title: '已开启每日一练推送', icon: 'none' });
        } else {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            const endpoint = sub.endpoint;
            await sub.unsubscribe();
            request('/api/push/unsubscribe', { method: 'POST', data: { endpoint } }).catch(() => {});
          }
          this.pushOn = false;
          uni.showToast({ title: '已关闭推送', icon: 'none' });
        }
      } catch (e) {
        this.pushOn = false;
        uni.showToast({ title: '开启失败，请稍后再试', icon: 'none' });
      } finally {
        this.pushBusy = false;
      }
    },
    vapidKeyBytes() {
      const pad = '='.repeat((4 - (this.pushKey.length % 4)) % 4);
      const raw = atob((this.pushKey + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const out = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
      return out;
    },
    // #endif
    // #ifdef MP-WEIXIN
    async mpSubscribe() {
      const r = await requestMpSubscribe();
      uni.showToast({ title: r.ok ? '订阅成功' : '未完成订阅', icon: 'none' });
    },
    // #endif
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 60rpx; }
.card { background: var(--card); border-radius: 28rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); margin-bottom: 20rpx; }
.group { padding: 4rpx 32rpx; }
.set-row { display: flex; align-items: center; gap: 22rpx; min-height: 56px; border-top: 1rpx solid var(--line); }
.set-row:first-child { border-top: none; }
.set-row.dim .ico,
.set-row.dim .wd-switch,
.set-row.dim uni-switch { opacity: 0.5; }
.set-row.dim .nm,
.set-row.dim .time-v { color: var(--ink-2); }
.ico { width: 68rpx; height: 68rpx; border-radius: 18rpx; background: var(--brand-soft); display: flex; align-items: center; justify-content: center; font-size: 32rpx; flex-shrink: 0; }
.grow { flex: 1; min-width: 0; }
.nm { display: block; font-size: 28rpx; font-weight: 600; color: var(--ink); }
.sub { display: block; font-size: 23rpx; color: var(--ink-2); margin-top: 4rpx; }
.time-v { font-size: 27rpx; color: var(--brand-text); font-weight: 600; }

.warn-card { padding: 26rpx 30rpx; background: var(--warn-soft); }
.warn-t { display: flex; align-items: center; gap: 8rpx; font-size: 27rpx; font-weight: 600; color: var(--warn); }
.warn-s { display: block; font-size: 23rpx; color: #b45309; margin-top: 8rpx; line-height: 1.6; }
.warn-btn { margin-top: 18rpx; min-height: 44px; display: flex; align-items: center; justify-content: center; background: var(--warn); color: #fff; border-radius: 999rpx; font-size: 26rpx; font-weight: 600; }

.sec-t { font-size: 24rpx; color: var(--ink-2); margin: 28rpx 8rpx 14rpx; }
.push { background: var(--card); border-radius: 24rpx; box-shadow: 0 6rpx 20rpx rgba(23, 24, 28, 0.08); padding: 24rpx 28rpx; margin-bottom: 20rpx; }
.push .hd { display: flex; align-items: center; gap: 12rpx; font-size: 21rpx; color: var(--ink-2); margin-bottom: 10rpx; }
.appico { width: 36rpx; height: 36rpx; border-radius: 10rpx; background: linear-gradient(135deg, #5b8af8, #2e5bff); color: #fff; font-size: 20rpx; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.tt { display: block; font-size: 27rpx; font-weight: 700; color: var(--ink); }
.bd { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 6rpx; line-height: 1.6; }

.tip { background: var(--brand-soft); box-shadow: none; padding: 22rpx 28rpx; }
.tip-t { font-size: 24rpx; color: var(--brand-text); line-height: 1.6; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.reminders { max-width: 680px; }
  .set-row:hover, .warn-btn:hover { cursor: pointer; }
}
/* #endif */
</style>
