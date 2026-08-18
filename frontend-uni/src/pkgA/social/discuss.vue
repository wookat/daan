<template>
  <view class="wrap">
    <!-- 题目摘要卡 -->
    <view v-if="q" class="card qcard">
      <view class="qtags">
        <text class="tag" :style="{ background: modColor(q.module).bg, color: modColor(q.module).fg }">{{ modName(q.module) }}</text>
        <text v-if="q.is_real" class="tag gray">{{ [q.exam_year, q.exam_region, '真题'].filter(Boolean).join(' ') }}</text>
        <text v-if="q.attempt_count >= 5 && q.correct_ratio != null" class="tag gray">正确率 {{ q.correct_ratio }}%</text>
      </view>
      <view class="qtx">{{ q.question }}</view>
      <view class="qans">正确答案 {{ q.answer }}</view>
    </view>

    <!-- 排序 -->
    <view class="chips">
      <text class="chip" :class="{ on: sort === 'hot' }" @click="switchSort('hot')">最热</text>
      <text class="chip" :class="{ on: sort === 'new' }" @click="switchSort('new')">最新</text>
      <text class="cnt">共 {{ total }} 条讨论</text>
    </view>

    <!-- 评论列表 -->
    <view v-if="loading" class="card empty">加载中…</view>
    <view v-else-if="!items.length" class="card empty">
      <view class="empty-t">还没有讨论</view>
      <view class="empty-s">说说你的解法、避坑经验，帮到下一位考友</view>
    </view>
    <view v-else class="card cmlist">
      <view v-for="c in items" :key="c.id" class="cm">
        <view class="avatar" :style="avatarStyle(c.nickname)">{{ c.nickname.slice(0, 1) }}</view>
        <view class="cm-body">
          <view class="cm-hd">
            <text class="nm">{{ c.nickname }}</text>
            <text v-if="c.likes >= 10" class="tag warn">高赞</text>
            <text class="tm">{{ fmtTime(c.created_at) }}</text>
          </view>
          <view class="tx">{{ c.content }}</view>
          <view class="ft">
            <view class="up" :class="{ on: c.liked }" @click="like(c)"><l-icon name="thumbs-up" :size="13" :color="c.liked ? '#2e5bff' : '#8a90a0'" /><text>{{ c.likes || '赞' }}</text></view>
            <text class="op" @click="startReply(c)">回复{{ c.replies.length ? ' ' + c.replies.length : '' }}</text>
            <text v-if="c.mine" class="op del" @click="removeOwn(c)">删除</text>
          </view>
          <view v-for="r in c.replies" :key="r.id" class="reply">
            <text class="rnm">{{ r.nickname }}：</text>{{ r.content }}
            <view class="rft">
              <view class="up sm" :class="{ on: r.liked }" @click="like(r)"><l-icon name="thumbs-up" :size="12" :color="r.liked ? '#2e5bff' : '#8a90a0'" /><text>{{ r.likes || '赞' }}</text></view>
              <text class="op sm" @click="startReply(c, r)">回复</text>
              <text v-if="r.mine" class="op sm del" @click="removeOwn(r, c)">删除</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="pin"><l-icon name="info" :size="14" color="#2c5ad6" /> 社区公约：讨论解题思路，不传播付费课程内容；违规内容将被删除。</view>
    <view style="height: 140rpx" />

    <!-- 输入栏 -->
    <view class="inputbar">
      <view v-if="replyTo" class="replying">
        回复 {{ replyTo.nickname }}
        <view class="rx" @click="replyTo = null"><l-icon name="x" :size="14" color="#8a90a0" /></view>
      </view>
      <view class="inputrow">
        <input
          v-model="draft"
          class="ipt"
          :placeholder="logged ? '说说你的解法 / 吐槽这道题…' : '登录后参与讨论'"
          :maxlength="500"
          confirm-type="send"
          @confirm="submit"
          @focus="ensureLogin"
        />
        <button class="send" :disabled="busy || !draft.trim()" @click="submit">发布</button>
      </view>
    </view>
  </view>
</template>

<script>
import { deleteOwnComment, fetchComments, getToken, likeComment, postComment, request } from '../../api.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };
const COLORS = {
  changshi: { bg: '#FEF3C7', fg: '#B45309' },
  shuliang: { bg: '#DBEAFE', fg: '#1D4ED8' },
  panduan: { bg: '#EDE9FE', fg: '#6D28D9' },
  ziliao: { bg: '#D1FAE5', fg: '#047857' },
  yanyu: { bg: '#FEE2E2', fg: '#B91C1C' },
};
const AV_COLORS = [
  { bg: '#FFF7E6', fg: '#D97706' },
  { bg: '#ECFDF5', fg: '#16A34A' },
  { bg: '#EFF6FF', fg: '#2563EB' },
  { bg: '#FEF2F2', fg: '#DC2626' },
  { bg: '#F5F3FF', fg: '#7C3AED' },
];

export default {
  data() {
    return {
      qid: null,
      q: null,
      items: [],
      total: 0,
      sort: 'hot',
      loading: true,
      draft: '',
      busy: false,
      replyTo: null,
      logged: false,
    };
  },
  onShow() {
    const l = !!getToken();
    if (l !== this.logged) {
      this.logged = l;
      if (this.qid) this.load();
    }
  },
  onLoad(opts) {
    this.qid = Number(opts.qid || 0);
    if (!this.qid) {
      uni.showToast({ title: '缺少题目参数', icon: 'none' });
      return;
    }
    this.loadQuestion();
    this.load();
  },
  methods: {
    modName(m) {
      return NAMES[m] || m || '';
    },
    modColor(m) {
      return COLORS[m] || { bg: '#EEF3FF', fg: '#2E5BFF' };
    },
    avatarStyle(nm) {
      let h = 0;
      for (let i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) >>> 0;
      const c = AV_COLORS[h % AV_COLORS.length];
      return { background: c.bg, color: c.fg };
    },
    fmtTime(ts) {
      const diff = Date.now() / 1000 - ts;
      if (diff < 3600) return Math.max(1, Math.floor(diff / 60)) + ' 分钟前';
      if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
      if (diff < 30 * 86400) return Math.floor(diff / 86400) + ' 天前';
      const d = new Date(ts * 1000);
      return `${d.getMonth() + 1}-${d.getDate()}`;
    },
    async loadQuestion() {
      try {
        const d = await request(`/api/question/${this.qid}`);
        this.q = d.item;
      } catch (e) { /* 摘要卡非关键 */ }
    },
    async load() {
      this.loading = true;
      try {
        const d = await fetchComments(this.qid, this.sort);
        this.items = d.items;
        this.total = d.total;
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' });
      }
      this.loading = false;
    },
    switchSort(s) {
      if (this.sort === s) return;
      this.sort = s;
      this.load();
    },
    ensureLogin() {
      if (this.logged) return true;
      uni.showModal({
        title: '需要登录',
        content: '发言需登录账号，登录后即可参与讨论',
        confirmText: '去登录',
        success: (r) => {
          if (r.confirm) uni.navigateTo({ url: '/pkgA/user/login' });
        },
      });
      return false;
    },
    startReply(top, sub) {
      if (!this.ensureLogin()) return;
      this.replyTo = { id: top.id, nickname: (sub || top).nickname };
    },
    async submit() {
      const content = this.draft.trim();
      if (!content || this.busy) return;
      if (!this.ensureLogin()) return;
      this.busy = true;
      try {
        const d = await postComment(this.qid, content, this.replyTo && this.replyTo.id);
        this.draft = '';
        if (this.replyTo) {
          const top = this.items.find((c) => c.id === d.item.parent_id);
          if (top) top.replies.push(d.item);
          this.replyTo = null;
        } else {
          this.items.unshift({ ...d.item, replies: [] });
        }
        this.total += 1;
        uni.showToast({ title: '已发布', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' });
      }
      this.busy = false;
    },
    async like(c) {
      if (!this.ensureLogin()) return;
      try {
        const d = await likeComment(c.id);
        c.liked = d.liked;
        c.likes = d.likes;
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' });
      }
    },
    removeOwn(c, parent) {
      uni.showModal({
        title: '删除这条讨论？',
        success: async (r) => {
          if (!r.confirm) return;
          try {
            await deleteOwnComment(c.id);
            if (parent) parent.replies = parent.replies.filter((x) => x.id !== c.id);
            else this.items = this.items.filter((x) => x.id !== c.id);
            this.total = Math.max(0, this.total - 1);
          } catch (e) {
            uni.showToast({ title: e.message, icon: 'none' });
          }
        },
      });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; }
.card { background: var(--card, #fff); border-radius: var(--radius, 24rpx); padding: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); margin-bottom: 20rpx; }
.qtags { display: flex; gap: 10rpx; margin-bottom: 12rpx; flex-wrap: wrap; }
.tag { font-size: 20rpx; padding: 4rpx 14rpx; border-radius: 8rpx; background: var(--brand-soft); color: var(--brand); }
.tag.gray { background: var(--fill); color: var(--ink-3); }
.tag.warn { background: #fef3c7; color: #b45309; }
.qtx { font-size: 26rpx; color: var(--ink-2); line-height: 1.7; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.qans { font-size: 23rpx; color: var(--ink-3); margin-top: 10rpx; }
.chips { display: flex; align-items: center; gap: 14rpx; margin: 4rpx 4rpx 18rpx; }
.chip { font-size: 24rpx; color: var(--ink-2); background: var(--fill); padding: 8rpx 26rpx; border-radius: 999rpx; }
.chip.on { background: var(--brand-soft); color: var(--brand); font-weight: 700; }
.cnt { font-size: 22rpx; color: var(--ink-3); margin-left: auto; }
.empty { text-align: center; color: var(--ink-3); font-size: 25rpx; padding: 60rpx 24rpx; }
.empty-t { font-size: 28rpx; font-weight: 600; color: var(--ink-2); margin-bottom: 8rpx; }
.cmlist { padding: 6rpx 24rpx; }
.cm { display: flex; gap: 18rpx; padding: 24rpx 0; border-bottom: 1rpx solid var(--fill); }
.cm:last-child { border-bottom: none; }
.avatar { width: 64rpx; height: 64rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26rpx; font-weight: 700; flex-shrink: 0; }
.cm-body { flex: 1; min-width: 0; }
.cm-hd { display: flex; align-items: center; gap: 10rpx; }
.nm { font-size: 25rpx; font-weight: 600; color: var(--ink); }
.tm { font-size: 21rpx; color: var(--ink-3); }
.tx { font-size: 27rpx; color: var(--ink-2); line-height: 1.65; margin-top: 6rpx; word-break: break-all; }
.ft { display: flex; gap: 30rpx; margin-top: 12rpx; align-items: center; }
.up { display: inline-flex; align-items: center; gap: 6rpx; font-size: 23rpx; color: var(--ink-3); }
.up.on { color: var(--brand); font-weight: 700; }
.up.sm, .op.sm { font-size: 21rpx; }
.op { font-size: 23rpx; color: var(--ink-3); }
.op.del { color: #ef4444; }
.reply { background: var(--fill); border-radius: 14rpx; padding: 14rpx 18rpx; font-size: 24rpx; color: var(--ink-2); margin-top: 12rpx; line-height: 1.6; word-break: break-all; }
.rnm { font-weight: 600; color: var(--ink); }
.rft { display: flex; gap: 24rpx; margin-top: 6rpx; }
.pin { border: 1rpx solid var(--brand-soft-2); background: var(--brand-soft); border-radius: 16rpx; padding: 18rpx 22rpx; font-size: 23rpx; color: #2c5ad6; line-height: 1.6; }
.inputbar { position: fixed; left: 0; right: 0; bottom: 0; background: var(--card); border-top: 1rpx solid var(--line); padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom)); z-index: 20; }
.replying { font-size: 22rpx; color: var(--ink-3); margin-bottom: 8rpx; display: flex; align-items: center; gap: 12rpx; }
.rx { padding: 4rpx 12rpx; }
.inputrow { display: flex; gap: 16rpx; align-items: center; }
.ipt { flex: 1; height: 72rpx; border-radius: 999rpx; background: var(--fill); font-size: 26rpx; padding: 0 28rpx; }
.send { margin: 0; height: 72rpx; line-height: 72rpx; padding: 0 34rpx; border-radius: 999rpx; background: var(--brand); color: #fff; font-size: 26rpx; }
.send[disabled] { background: var(--brand-soft-2); color: #fff; }
</style>
