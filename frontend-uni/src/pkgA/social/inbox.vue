<template>
  <view class="wrap">
    <kg-two-col>
      <template #main>
        <view v-if="items.length" class="list">
          <kg-card v-for="(it, i) in items" :key="it.type + '-' + it.id + '-' + i" clickable class="item" @click="openDiscuss(it)">
            <view class="row">
              <view class="avatar" :class="{ 'is-like': it.type === 'like' }" aria-hidden="true">
                <l-icon v-if="it.type === 'like'" name="thumbs-up" :size="20" tone="brand-text" />
                <text v-else class="avatar-t">{{ (it.nickname || '?').slice(0, 1) }}</text>
              </view>
              <view class="body">
                <view class="hd">
                  <view class="who">
                    <view v-if="it.unread" class="dot" aria-label="未读" />
                    <text v-if="it.type === 'like'" class="act">有人赞了我的评论</text>
                    <template v-else>
                      <text class="nick">{{ it.nickname }}</text>
                      <text class="act">回复了我</text>
                    </template>
                  </view>
                  <text class="time num">{{ fmtTime(it.created_at) }}</text>
                </view>
                <text v-if="it.type !== 'like'" class="content q-text ellip1">{{ it.content }}</text>
                <text class="quote ellip1">我的评论：{{ it.parent_content }}</text>
              </view>
            </view>
          </kg-card>
        </view>
        <kg-empty-state
          v-else-if="loaded && !logged"
          icon="user-round"
          title="登录后查看消息"
          desc="登录账号后，评论收到的回复和点赞会在这里提醒你"
          cta-text="去登录"
          @cta="goLogin"
        />
        <kg-empty-state
          v-else-if="loadErr"
          icon="wifi-off"
          :title="'加载失败：' + loadErr"
          cta-text="重试"
          @cta="load"
        />
        <kg-empty-state
          v-else-if="loaded"
          icon="message-circle"
          title="暂无消息"
          desc="去讨论区发表评论，收到回复或点赞会在这里提醒你"
        />
        <kg-skeleton v-else preset="cards" />
      </template>
      <template #aside>
        <kg-card v-if="items.length" variant="soft">
          <kg-stat-row :items="[{ label: '消息', value: items.length }, { label: '未读', value: unreadCount }]" />
        </kg-card>
      </template>
    </kg-two-col>
  </view>
</template>

<script>
import { fmtMDHM } from '../../fmt.js';
import { fetchCommentInbox, readCommentInbox, getToken } from '../../api.js';

export default {
  data() {
    return { items: [], loaded: false, logged: false, loadErr: '' };
  },
  computed: {
    unreadCount() {
      return this.items.filter((x) => x.unread).length;
    },
  },
  onShow() {
    this.logged = !!getToken();
    if (this.logged) this.load();
    else this.loaded = true;
  },
  methods: {
    async load() {
      this.loadErr = '';
      try {
        const d = await fetchCommentInbox();
        this.items = d.items || [];
        if (d.unread) readCommentInbox().catch(() => {});
      } catch (e) {
        this.loadErr = e.message || '网络异常';
        uni.showToast({ title: e.message || '加载失败', icon: 'none' });
      }
      this.loaded = true;
    },
    goLogin() {
      uni.navigateTo({ url: '/pkgA/user/login' });
    },
    fmtTime(ts) {
      return fmtMDHM(ts);
    },
    openDiscuss(it) {
      uni.navigateTo({ url: '/pkgA/social/discuss?qid=' + it.question_id });
    },
  },
};
</script>

<style scoped>
.wrap { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.list { display: flex; flex-direction: column; gap: var(--card-gap); }
.row { display: flex; gap: var(--sp-12); align-items: flex-start; }
.avatar { flex-shrink: 0; width: 40px; height: 40px; border-radius: var(--r-full); background: var(--brand-soft); display: flex; align-items: center; justify-content: center; }
.avatar-t { font-size: var(--fs-body); font-weight: 600; color: var(--brand-text); }
.body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-4); }
.hd { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-8); }
.who { display: flex; align-items: center; gap: var(--sp-8); min-width: 0; }
.dot { flex-shrink: 0; width: 8px; height: 8px; border-radius: var(--r-full); background: var(--brand); }
.nick { font-size: var(--fs-body); font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act { font-size: var(--fs-sub); color: var(--ink-2); white-space: nowrap; }
.time { flex-shrink: 0; font-size: var(--fs-caption); color: var(--ink-3); font-weight: 400; }
.content { font-size: var(--fs-body); color: var(--ink); }
.quote { font-size: var(--fs-sub); color: var(--ink-3); background: var(--fill); border-radius: var(--r-xs); padding: var(--sp-4) var(--sp-8); }
.ellip1 { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .wrap { max-width: 1044px !important; }
}
/* #endif */
</style>
