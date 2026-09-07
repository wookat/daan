<template>
  <view class="wrap" :class="{ 'has-bar': !noQid }">
    <kg-empty-state
      v-if="noQid"
      icon="message-circle"
      title="链接缺少题目参数"
      desc="请从题目解析页进入讨论，或去讨论广场看看大家在聊什么"
      cta-text="去讨论广场"
      @cta="goPlaza"
    />
    <kg-two-col v-else aside-first>
      <template #aside>
        <!-- 题目摘要卡 -->
        <kg-card v-if="q" class="qcard">
          <view class="qtags">
            <kg-tag tone="module" :module="q.module">{{ modName(q.module) }}</kg-tag>
            <kg-tag v-if="q.is_real" tone="neutral">{{ [q.exam_year, q.exam_region, '真题'].filter(Boolean).join(' ') }}</kg-tag>
            <kg-tag v-if="q.attempt_count >= 5 && q.correct_ratio != null" tone="neutral">正确率 {{ q.correct_ratio }}%</kg-tag>
          </view>
          <text class="qtx q-text">{{ q.question }}</text>
          <text class="qans">正确答案 {{ q.answer }}</text>
        </kg-card>
      </template>
      <template #main>
        <!-- 排序 -->
        <view class="toolbar">
          <wd-segmented :value="sortLabel" :options="sortOpts" size="small" @change="onSortChange" />
          <text class="cnt">共 <text class="num">{{ total }}</text> 条</text>
          <view class="msg" role="button" aria-label="消息" @click="goInbox">
            <l-icon name="bell" :size="20" tone="ink-2" />
            <text class="msg-t">消息</text>
            <text v-if="inboxUnread" class="msg-badge num">{{ inboxUnread }}</text>
          </view>
        </view>

        <!-- 评论列表 -->
        <kg-skeleton v-if="loading" preset="lines" />
        <kg-empty-state
          v-else-if="loadErr"
          compact
          icon="wifi-off"
          :title="'加载失败：' + loadErr"
          cta-text="重试"
          @cta="load"
        />
        <kg-empty-state
          v-else-if="!items.length"
          compact
          icon="message-square"
          title="还没有讨论"
          desc="说说你的解法、避坑经验，帮到下一位考友"
        />
        <kg-card v-else class="cmlist" :padding="12">
          <view v-for="c in items" :key="c.id" class="cm">
            <view class="avatar" :class="'av-' + avatarTone(c.nickname)" aria-hidden="true">{{ c.nickname.slice(0, 1) }}</view>
            <view class="cm-body">
              <view class="cm-hd">
                <text class="nm">{{ c.nickname }}</text>
                <kg-tag v-if="c.likes >= 10" tone="warn">高赞</kg-tag>
                <text class="tm">{{ fmtTime(c.created_at) }}</text>
              </view>
              <text class="tx q-text">{{ c.content }}</text>
              <view class="ft">
                <view class="op up" :class="{ on: c.liked }" role="button" aria-label="点赞" @click="like(c)">
                  <l-icon name="thumbs-up" :size="16" :tone="c.liked ? 'brand-text' : 'muted'" />
                  <text class="num">{{ c.likes || '赞' }}</text>
                </view>
                <text class="op" role="button" @click="startReply(c)">回复{{ c.replies.length ? ' ' + c.replies.length : '' }}</text>
                <text v-if="c.mine" class="op del" role="button" @click="removeOwn(c)">删除</text>
                <text v-else class="op" role="button" @click="report(c)">举报</text>
              </view>
              <view v-for="r in c.replies" :key="r.id" class="reply">
                <text class="rtx q-text"><text class="rnm">{{ r.nickname }}：</text>{{ r.content }}</text>
                <view class="rft">
                  <view class="op sm up" :class="{ on: r.liked }" role="button" aria-label="点赞" @click="like(r)">
                    <l-icon name="thumbs-up" :size="16" :tone="r.liked ? 'brand-text' : 'muted'" />
                    <text class="num">{{ r.likes || '赞' }}</text>
                  </view>
                  <text class="op sm" role="button" @click="startReply(c, r)">回复</text>
                  <text v-if="r.mine" class="op sm del" role="button" @click="removeOwn(r, c)">删除</text>
                  <text v-else class="op sm" role="button" @click="report(r, c)">举报</text>
                </view>
              </view>
            </view>
          </view>
        </kg-card>

        <view class="pin">
          <l-icon name="info" :size="16" tone="brand-text" />
          <text class="pin-t">社区公约：讨论解题思路，不传播付费课程内容；违规内容将被删除。</text>
        </view>

        <!-- 输入栏 -->
        <kg-action-bar layout="input" class="ibar">
          <view class="ibar-in">
            <view v-if="replyTo" class="replying">
              <text class="replying-t">回复 {{ replyTo.nickname }}</text>
              <view class="rx" role="button" aria-label="取消回复" @click="replyTo = null"><l-icon name="x" :size="16" tone="muted" /></view>
            </view>
            <view class="inputrow">
              <textarea
                v-model="draft"
                class="ipt"
                :placeholder="logged ? '说说你的解法 / 吐槽这道题…' : '登录后参与讨论'"
                placeholder-style="color: var(--ink-4)"
                :maxlength="500"
                :focus="autoFocus"
                :auto-height="true"
                @focus="ensureLogin"
              />
              <kg-button variant="primary" size="lg" icon="send" :disabled="busy || !draft.trim()" :loading="busy" @click="submit">发布</kg-button>
            </view>
          </view>
        </kg-action-bar>
      </template>
    </kg-two-col>
  </view>
</template>

<script>
import { deleteOwnComment, fetchCommentInbox, fetchComments, getToken, likeComment, postComment, reportComment, request } from '../../api.js';
import { MODULES, moduleLabel } from '../../module-meta.js';

const SORT_OPTS = [
  { label: '最热', value: 'hot' },
  { label: '最新', value: 'new' },
];

const REPORT_REASONS = ['广告导流', '人身攻击', '违法违规', '色情低俗', '其他'];
const AV_TONES = ['warn', 'ok', 'brand', 'bad', 'info'];

export default {
  data() {
    return {
      qid: null,
      noQid: false,
      q: null,
      items: [],
      total: 0,
      sort: 'hot',
      loading: true,
      loadErr: '',
      draft: '',
      busy: false,
      replyTo: null,
      logged: false,
      autoFocus: false,
      inboxUnread: 0,
    };
  },
  computed: {
    sortOpts() {
      return SORT_OPTS.map((o) => o.label);
    },
    sortLabel() {
      return (SORT_OPTS.find((o) => o.value === this.sort) || SORT_OPTS[0]).label;
    },
  },
  watch: {
    draft(v) {
      if (!this.qid) return;
      const k = 'dcDraft:' + this.qid;
      if (v) uni.setStorageSync(k, v);
      else uni.removeStorageSync(k);
    },
  },
  onShow() {
    const l = !!getToken();
    if (l !== this.logged) {
      this.logged = l;
      if (this.qid) this.load();
    }
    this.loadInbox();
  },
  onLoad(opts) {
    this.qid = Number(opts.qid || 0);
    if (!this.qid) {
      this.noQid = true;
      this.loading = false;
      return;
    }
    this.draft = uni.getStorageSync('dcDraft:' + this.qid) || '';
    if (opts.focus === '1' && getToken()) {
      setTimeout(() => {
        this.autoFocus = true;
      }, 300);
    }
    this.loadQuestion();
    this.load();
    this._onAuth = () => {
      const l = !!getToken();
      if (l !== this.logged) {
        this.logged = l;
        if (this.qid) this.load();
      }
    };
    uni.$on('authChanged', this._onAuth);
  },
  onUnload() {
    if (this._onAuth) uni.$off('authChanged', this._onAuth);
  },
  methods: {
    modName(m) {
      return MODULES[m] ? moduleLabel(m) : m || '';
    },
    avatarTone(nm) {
      let h = 0;
      for (let i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) >>> 0;
      return AV_TONES[h % AV_TONES.length];
    },
    onSortChange(opt) {
      const o = SORT_OPTS.find((x) => x.label === (opt && opt.value));
      if (o) this.switchSort(o.value);
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
      this.loadErr = '';
      try {
        const d = await fetchComments(this.qid, this.sort);
        this.items = d.items;
        this.total = d.total;
      } catch (e) {
        this.loadErr = e.message || '网络异常';
        uni.showToast({ title: e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async loadInbox() {
      if (!this.logged) {
        this.inboxUnread = 0;
        return;
      }
      try {
        const d = await fetchCommentInbox();
        this.inboxUnread = d.unread || 0;
      } catch (e) { /* 非关键路径 */ }
    },
    goPlaza() {
      uni.reLaunch({ url: '/pkgA/social/plaza' });
    },
    goInbox() {
      if (!this.ensureLogin()) return;
      uni.navigateTo({ url: '/pkgA/social/inbox' });
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
        uni.removeStorageSync('dcDraft:' + this.qid);
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
    report(c, parent) {
      if (!this.ensureLogin()) return;
      uni.showActionSheet({
        itemList: REPORT_REASONS,
        success: async ({ tapIndex }) => {
          try {
            const d = await reportComment(c.id, REPORT_REASONS[tapIndex]);
            if (d.hidden) {
              if (parent) parent.replies = parent.replies.filter((x) => x.id !== c.id);
              else this.items = this.items.filter((x) => x.id !== c.id);
              this.total = Math.max(0, this.total - 1);
            }
            uni.showToast({ title: d.already ? '你已举报过这条评论' : '已收到举报，我们会尽快处理', icon: 'none' });
          } catch (e) {
            uni.showToast({ title: e.message, icon: 'none' });
          }
        },
      });
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
.wrap { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.wrap.has-bar { padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px)); }
.qtags { display: flex; gap: var(--sp-8); margin-bottom: var(--sp-12); flex-wrap: wrap; }
.qtx { display: -webkit-box; font-size: var(--fs-sub); color: var(--ink-2); -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.qans { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-8); }
.toolbar { display: flex; align-items: center; gap: var(--sp-12); margin-bottom: var(--sp-12); min-width: 0; }
.toolbar :deep(.wd-segmented) { flex: 1 1 0; min-width: 0; width: auto; }
.cnt { font-size: var(--fs-caption); color: var(--ink-3); margin-left: auto; white-space: nowrap; }
.msg { display: inline-flex; align-items: center; gap: var(--sp-4); min-height: var(--hit-min); padding: 0 var(--sp-8); border-radius: var(--r-sm); color: var(--ink-2); flex-shrink: 0; }
.msg-t { font-size: var(--fs-sub); }
.msg-badge { min-width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: var(--r-full); background: var(--bad); color: var(--on-brand); font-size: var(--fs-caption); padding: 0 var(--sp-4); box-sizing: border-box; }
.cm { display: flex; gap: var(--sp-12); padding: var(--sp-12) 0; border-bottom: 1px solid var(--line); }
.cm:last-child { border-bottom: none; }
.avatar { width: 32px; height: 32px; border-radius: var(--r-full); display: flex; align-items: center; justify-content: center; font-size: var(--fs-sub); font-weight: 600; flex-shrink: 0; }
.av-warn { background: var(--warn-soft); color: var(--warn); }
.av-ok { background: var(--ok-soft); color: var(--ok); }
.av-brand { background: var(--brand-soft); color: var(--brand-text); }
.av-bad { background: var(--bad-soft); color: var(--bad); }
.av-info { background: var(--info-soft); color: var(--info); }
.cm-body { flex: 1; min-width: 0; }
.cm-hd { display: flex; align-items: center; gap: var(--sp-8); flex-wrap: wrap; }
.nm { font-size: var(--fs-sub); font-weight: 600; color: var(--ink); }
.tm { font-size: var(--fs-caption); color: var(--ink-3); }
.tx { display: block; font-size: var(--fs-body); line-height: var(--lh-body); color: var(--ink); margin-top: var(--sp-4); white-space: pre-wrap; }
.ft { display: flex; gap: var(--sp-8); margin-top: var(--sp-4); align-items: center; flex-wrap: wrap; }
.op { display: inline-flex; align-items: center; gap: var(--sp-4); min-height: var(--hit-min); padding: 0 var(--sp-8); margin-left: calc(-1 * var(--sp-8)); border-radius: var(--r-sm); font-size: var(--fs-sub); color: var(--ink-3); }
.op + .op { margin-left: 0; }
.up.on { color: var(--brand-text); font-weight: 600; }
.op.sm { font-size: var(--fs-caption); }
.op.del { color: var(--bad); }
.reply { background: var(--fill); border-radius: var(--r-sm); padding: var(--sp-8) var(--sp-12); margin-top: var(--sp-8); }
.rtx { display: block; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--ink-2); white-space: pre-wrap; }
.rnm { font-weight: 600; color: var(--ink); }
.rft { display: flex; gap: var(--sp-8); align-items: center; flex-wrap: wrap; }
.pin { display: flex; align-items: flex-start; gap: var(--sp-8); margin-top: var(--sp-16); border: 1px solid var(--brand-soft-2); background: var(--brand-soft); border-radius: var(--r-md); padding: var(--sp-12); }
.pin-t { font-size: var(--fs-caption); color: var(--brand-text); line-height: var(--lh-caption); }
.ibar-in { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-8); }
.replying { display: flex; align-items: center; gap: var(--sp-8); }
.replying-t { font-size: var(--fs-caption); color: var(--ink-3); }
.rx { width: var(--hit-min); height: 40px; margin: -6px 0; display: flex; align-items: center; justify-content: center; border-radius: var(--r-sm); }
.inputrow { display: flex; gap: var(--sp-12); align-items: flex-end; }
.ipt { flex: 1; min-width: 0; min-height: var(--input-h); max-height: 120px; overflow-y: auto; border-radius: var(--r-lg); background: var(--fill); color: var(--ink); font-size: var(--fs-sub); line-height: 20px; padding: var(--sp-12) var(--sp-16); box-sizing: border-box; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .msg:hover, .op:hover, .rx:hover { cursor: pointer; }
}
@media (min-width: 1024px) {
  .wrap { max-width: 1044px !important; }
  .ibar { margin-top: var(--sp-16); border: 1px solid var(--line); border-radius: var(--r-md); }
}
/* #endif */
</style>
