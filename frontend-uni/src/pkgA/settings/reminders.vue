<template>
  <view class="page reminders">
    <kg-two-col aside-first>
      <template #aside>
        <wd-cell-group custom-class="cellcard" border>
          <wd-cell title="每日刷题提醒" :label="'每天 ' + time + ' · 未完成今日目标时提醒'" center>
            <template #icon><view class="ico"><l-icon name="alarm-clock" :size="20" tone="brand-text" /></view></template>
            <wd-switch :model-value="on" size="24px" @change="toggle" />
          </wd-cell>
          <wd-datetime-picker
            type="time"
            :model-value="time"
            :disabled="!on"
            title="提醒时间"
            @confirm="onTimeConfirm"
          >
            <wd-cell title="提醒时间" label="建议安排在晚间黄金学习时段" is-link :clickable="on" center :custom-class="on ? '' : 'is-dim'">
              <template #icon><view class="ico"><l-icon name="clock" :size="20" tone="brand-text" /></view></template>
              <text class="time-v num">{{ time }}</text>
            </wd-cell>
          </wd-datetime-picker>
        </wd-cell-group>

        <!-- #ifdef H5 -->
        <kg-card v-if="on && perm !== 'granted'" class="warn-card">
          <view class="warn-t">
            <l-icon name="bell" :size="16" tone="warn" />
            <text>{{ perm === 'denied' ? '浏览器通知权限被拒绝' : '需要开启浏览器通知权限' }}</text>
          </view>
          <text class="warn-s">{{ perm === 'denied' ? '请在浏览器地址栏左侧站点设置中允许「通知」后刷新页面。' : '开启后才能在提醒时间收到今日目标进度提示。' }}</text>
          <kg-button v-if="perm !== 'denied'" variant="primary" size="md" block class="warn-btn" @click="askPerm">开启通知权限</kg-button>
        </kg-card>
        <kg-card v-if="perm === 'unsupported'" class="warn-card">
          <view class="warn-t"><l-icon name="bell" :size="16" tone="warn" /><text>当前浏览器不支持通知</text></view>
          <text class="warn-s">提醒仅在支持 Notification 的浏览器（且页面保持打开）时生效。</text>
        </kg-card>
        <!-- #endif -->

        <!-- #ifdef H5 -->
        <wd-cell-group v-if="pushSupported" custom-class="cellcard" border>
          <wd-cell title="每日一练离线推送" label="每天早上推送全站同题 10 题，关闭页面也能收到" center>
            <template #icon><view class="ico"><l-icon name="send" :size="20" tone="brand-text" /></view></template>
            <wd-switch :model-value="pushOn" :disabled="pushBusy" size="24px" @change="togglePush" />
          </wd-cell>
        </wd-cell-group>
        <!-- #endif -->

        <!-- #ifdef MP-WEIXIN -->
        <wd-cell-group v-if="mpSubscribeAvailable" custom-class="cellcard" border>
          <wd-cell title="微信订阅提醒" label="一次授权可收到一条服务通知" is-link clickable center @click="mpSubscribe">
            <template #icon><view class="ico"><l-icon name="send" :size="20" tone="brand-text" /></view></template>
            <text class="time-v">去订阅</text>
          </wd-cell>
        </wd-cell-group>
        <!-- #endif -->
      </template>

      <template #main>
        <kg-section-header title="提醒样式预览" />
        <kg-card class="push">
          <view class="hd"><text class="appico">岸</text><text>错题邦 · <text class="num">{{ time }}</text></text></view>
          <text class="tt">{{ done >= goal ? '今日目标已达成，保持手感再练一组？' : '今晚还差 ' + previewLeft + ' 题就能守住连续打卡' }}</text>
          <text class="bd">今日目标 {{ goal }} 题已完成 {{ done }} 题{{ done >= goal ? '' : '，练完守住连续打卡～' }}</text>
        </kg-card>

        <kg-card class="tip" :padding="12">
          <l-icon name="lightbulb" :size="16" tone="brand-text" />
          <text class="tip-t">提醒只在「有事可做」时打扰你：当天已达成目标则改为轻量鼓励；H5 端需保持页面打开才能收到通知。</text>
        </kg-card>
      </template>
    </kg-two-col>
  </view>
</template>

<script>
import { getReminderSettings, setReminderSettings } from '../../reminder.js';
import { dayKey } from '../../checkin.js';
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
    this.done = (pstats.days || {})[dayKey()] || 0;
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
    onTimeConfirm({ value }) {
      this.setTime({ detail: { value } });
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
.page { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.ico { width: 36px; height: 36px; border-radius: var(--r-sm); background: var(--brand-soft); display: flex; align-items: center; justify-content: center; margin-right: var(--sp-12); flex-shrink: 0; }
.time-v { font-size: var(--fs-body); color: var(--brand-text); font-weight: 600; }
.reminders :deep(.is-dim) { opacity: 0.5; }
.reminders :deep(.cellcard) { margin-bottom: var(--card-gap); }
.reminders :deep(.wd-cell__left) { flex: 1 1 auto; min-width: 0; }
.reminders :deep(.wd-cell__right) { flex: 0 0 auto; }
.warn-card { background: var(--warn-soft); margin-bottom: var(--card-gap); }
.warn-t { display: flex; align-items: center; gap: var(--sp-4); font-size: var(--fs-body); font-weight: 600; color: var(--warn-strong); }
.warn-s { display: block; font-size: var(--fs-caption); line-height: var(--lh-sub); color: var(--warn-strong); margin-top: var(--sp-4); }
.warn-btn { margin-top: var(--sp-12); }

.push { margin-bottom: var(--card-gap); }
.push .hd { display: flex; align-items: center; gap: var(--sp-8); font-size: var(--fs-caption); color: var(--ink-2); margin-bottom: var(--sp-8); }
.appico { width: 20px; height: 20px; border-radius: var(--r-xs); background: var(--brand); color: var(--on-brand); font-size: var(--fs-caption); font-weight: 600; display: flex; align-items: center; justify-content: center; }
.tt { display: block; font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.bd { display: block; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--ink-2); margin-top: var(--sp-4); }

.tip { display: flex; align-items: flex-start; gap: var(--sp-8); background: var(--brand-soft); }
.tip-t { flex: 1; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--brand-text); }
</style>
