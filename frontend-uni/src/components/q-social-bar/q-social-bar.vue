<template>
  <view class="qsb" :class="{ 'is-compact': compact }">
    <!-- 我的笔记 -->
    <view v-if="!editing && note" class="mynote" @click="startEdit">
      <view class="nb"><l-icon name="pencil-line" :size="16" tone="inherit" /><text>我的笔记：</text></view>{{ note }}
      <text class="edit">编辑</text>
    </view>
    <view v-if="!editing && note && !isAuthed" class="sync-tip" role="button" @click="goSyncLogin">
      <l-icon name="cloud" :size="14" tone="brand-text" />
      <text class="sync-tip-t">笔记仅存本机，登录多端同步 ›</text>
    </view>
    <view v-else-if="editing" class="note-edit">
      <textarea
        v-model="draft"
        class="note-ta"
        placeholder="记下这题的方法 / 陷阱，下次遇到随解析展示"
        :maxlength="1000"
        auto-height
      />
      <view class="note-ops">
        <template v-if="delConfirm">
          <text class="nop cancel" @click="delConfirm = false">留着吧</text>
          <text class="nop del" @click="saveIt('')">{{ busy ? '删除中…' : '确认删除' }}</text>
        </template>
        <template v-else>
          <text class="nop cancel" @click="cancelEdit">取消</text>
          <text v-if="note" class="nop del" @click="delConfirm = true">删除笔记</text>
          <text class="nop save" @click="saveIt(draft)">{{ busy ? '保存中…' : '保存' }}</text>
        </template>
      </view>
    </view>
    <view class="qsb-row">
      <view v-if="!note && !editing" class="qsb-link" @click="startEdit"><l-icon name="pencil-line" :size="16" tone="inherit" /><text>写笔记</text></view>
      <view class="qsb-link" @click="openDiscuss"><l-icon name="message-circle" :size="16" tone="inherit" /><text>讨论{{ count != null ? ' (' + count + ')' : '' }} ›</text></view>
      <view class="qsb-link" :class="{ 'is-copied': copiedShare }" @click="shareToMates">
        <l-icon :class="{ 'kg-icon-pop': copiedShare }" :name="copiedShare ? 'check' : 'share-2'" :size="16" :tone="copiedShare ? 'ok' : 'inherit'" />
        <text>{{ copiedShare ? '链接已复制' : '分享给队友' }}</text>
      </view>
    </view>
    <view v-if="hot" class="hotc" @click="openDiscuss">
      <view class="hotc-top">
        <view class="hotc-tag"><l-icon name="flame" :size="16" tone="inherit" /><text>热评</text></view>
        <text class="hotc-nick">{{ hot.nickname }}</text>
        <view v-if="hot.likes" class="hotc-likes"><l-icon name="thumbs-up" :size="16" tone="inherit" /><text class="num">{{ hot.likes }}</text></view>
      </view>
      <view class="hotc-body">{{ hot.content }}</view>
    </view>
    <view v-else-if="count === 0" class="firstc" @click="openDiscuss(true)">
      <text class="firstc-ph">这题还没有讨论，说说你的解法…</text>
      <text class="firstc-cta">抢首评 →</text>
    </view>
  </view>
</template>

<script>
import { fetchQuestionSocial, fetchCommentCount, fetchComments, fetchNote, saveNote, shareCreate, qShareText, shareVariant, trackEvent, getAuthUser } from '../../api/api.js';
import { toastOk, toastErrFrom } from '../../utils/toast.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };

export default {
  name: 'QSocialBar',
  props: {
    questionId: { type: Number, required: true },
    compact: { type: Boolean, default: false },
  },
  data() {
    return { count: null, note: '', draft: '', editing: false, delConfirm: false, busy: false, hot: null, isAuthed: !!getAuthUser(), copiedShare: false };
  },
  mounted() {
    this._onAuth = () => { this.isAuthed = !!getAuthUser(); };
    if (uni.$on) uni.$on('authChanged', this._onAuth);
  },
  beforeUnmount() {
    if (this._copyT) { clearTimeout(this._copyT); this._copyT = null; }
    if (this._onAuth && uni.$off) uni.$off('authChanged', this._onAuth);
  },
  watch: {
    questionId: {
      immediate: true,
      handler() {
        this.editing = false;
        this.delConfirm = false;
        this.copiedShare = false;
        this.note = '';
        this.count = null;
        this.hot = null;
        this.load();
      },
    },
    draft(v) {
      if (!this.editing) return;
      const k = 'qNoteDraft:' + this.questionId;
      if (v && v !== this.note) uni.setStorageSync(k, v);
      else uni.removeStorageSync(k);
    },
  },
  methods: {
    async load() {
      const qid = this.questionId;
      this.isAuthed = !!getAuthUser();
      try {
        try {
          const d = await fetchQuestionSocial(qid);
          if (qid !== this.questionId) return;
          this.count = d.total;
          this.note = d.note || '';
          this.hot = d.hot || null;
          return;
        } catch (e) {
          if (!String((e && e.message) || '').includes('404')) throw e;
        }
        const [c, n] = await Promise.all([fetchCommentCount(qid), fetchNote(qid)]);
        if (qid !== this.questionId) return;
        this.count = c.total;
        this.note = (n.item && n.item.content) || '';
        if (c.total > 0) {
          const d = await fetchComments(qid, 'hot');
          if (qid !== this.questionId) return;
          this.hot = (d.items && d.items[0]) || null;
        }
      } catch (e) { /* 非关键路径 */ }
    },
    goSyncLogin() {
      trackEvent('login_nudge_click', 'note_sync');
      uni.navigateTo({ url: '/pkgA/user/login' });
    },
    startEdit() {
      this.delConfirm = false;
      this.draft = uni.getStorageSync('qNoteDraft:' + this.questionId) || this.note;
      this.editing = true;
    },
    cancelEdit() {
      this.delConfirm = false;
      this.editing = false;
    },
    async saveIt(content) {
      if (this.busy) return;
      this.busy = true;
      try {
        const d = await saveNote(this.questionId, content.trim());
        this.note = d.content || '';
        this.editing = false;
        this.delConfirm = false;
        uni.removeStorageSync('qNoteDraft:' + this.questionId);
        toastOk(this.note ? '笔记已保存' : '笔记已删除');
      } catch (e) {
        toastErrFrom(e, '笔记保存失败，请重试');
      }
      this.busy = false;
    },
    openDiscuss(focus) {
      uni.navigateTo({ url: '/pkgA/social/discuss?qid=' + this.questionId + (focus === true ? '&focus=1' : '') });
    },
    async shareToMates() {
      try {
        uni.showLoading({ title: '生成分享链接…' });
        const d = await shareCreate(this.questionId);
        uni.hideLoading();
        const mod = d.submodule || NAMES[d.module] || d.module || '行测';
        trackEvent('share_copy', 'qbar_' + shareVariant(), d.sid);
        uni.setClipboardData({
          data: qShareText(mod, d.sid),
          success: () => {
            this.copiedShare = true;
            if (this._copyT) clearTimeout(this._copyT);
            this._copyT = setTimeout(() => { this.copiedShare = false; }, 1800);
            toastOk('已复制分享链接');
          },
        });
      } catch (e) {
        uni.hideLoading();
        toastErrFrom(e, '生成分享链接失败，请稍后重试');
      }
    },
  },
};
</script>

<style scoped>
.qsb { margin-top: var(--sp-8); }
.qsb.is-compact { margin-top: var(--sp-4); }
.qsb.is-compact .qsb-row { margin-top: 0; gap: 0 var(--sp-12); }
.qsb.is-compact .firstc { margin-top: var(--sp-4); padding: var(--sp-4) var(--sp-12); }
.qsb.is-compact .hotc { margin-top: var(--sp-4); }
.mynote { background: var(--warn-soft); border-left: 3px solid var(--warn); border-radius: 0 var(--r-xs) var(--r-xs) 0; padding: var(--sp-8) var(--sp-12); font-size: var(--fs-caption); color: var(--ink-2); line-height: 1.6; }
.sync-tip { display: inline-flex; align-items: center; gap: var(--sp-4); min-height: 40px; padding: 0 var(--sp-4); margin: 0 -4px; }
.sync-tip-t { font-size: var(--fs-caption); color: var(--brand-text); }
.nb { display: inline-flex; align-items: center; gap: var(--sp-4); vertical-align: middle; color: var(--warn-strong); font-weight: 600; }
.edit { color: var(--brand-text); margin-left: var(--sp-4); font-size: var(--fs-caption); display: inline-flex; align-items: center; min-height: 40px; padding: 0 var(--sp-4); margin-top: -10px; margin-bottom: -10px; vertical-align: middle; }
.note-edit { background: var(--warn-soft); border-radius: var(--r-sm); padding: var(--sp-8) var(--sp-12); animation: kg-fade-in var(--dur-fast) var(--ease-decel); }
.note-ta { width: 100%; min-height: 56px; font-size: var(--fs-sub); line-height: 1.6; box-sizing: border-box; color: var(--ink); }
.note-ops { display: flex; justify-content: flex-end; gap: var(--sp-16); margin-top: var(--sp-4); }
.nop { font-size: var(--fs-caption); color: var(--ink-3); min-height: 40px; display: inline-flex; align-items: center; padding: 0 var(--sp-4); margin: -6px -4px; transition: transform var(--dur-instant) var(--ease-standard); }
.nop:active { transform: scale(0.95); }
.nop.save { color: var(--brand-text); font-weight: 600; }
.nop.del { color: var(--bad-strong); font-weight: 600; }
.qsb-row { display: flex; flex-wrap: wrap; gap: 0 var(--sp-16); margin-top: var(--sp-4); }
.qsb-link { font-size: var(--fs-caption); color: var(--brand-text); min-height: 40px; display: inline-flex; align-items: center; gap: var(--sp-4); padding: 0 var(--sp-4); margin: 0 -4px; transition: color var(--dur-fast) var(--ease-standard), transform var(--dur-instant) var(--ease-standard); }
.qsb-link:active { transform: scale(0.96); }
.qsb-link.is-copied { color: var(--ok-strong); }
.hotc { background: var(--fill); border-radius: var(--r-sm); padding: var(--sp-8) var(--sp-12); margin-top: var(--sp-8); transition: background-color var(--dur-fast) var(--ease-standard); }
.hotc-top { display: flex; align-items: center; gap: var(--sp-8); }
.hotc-tag { display: inline-flex; align-items: center; gap: 2px; font-size: var(--fs-caption); color: var(--warn-strong); background: var(--warn-soft); border-radius: var(--r-full); padding: 2px var(--sp-8); font-weight: 600; }
.hotc-nick { font-size: var(--fs-caption); color: var(--ink-2); font-weight: 600; }
.hotc-likes { display: inline-flex; align-items: center; gap: 2px; font-size: var(--fs-caption); color: var(--ink-3); margin-left: auto; }
.hotc-body { font-size: var(--fs-caption); color: var(--ink-2); line-height: 1.6; margin-top: var(--sp-4); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.firstc { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); background: var(--fill); border: 1px dashed var(--line); border-radius: var(--r-full); padding: var(--sp-8) var(--sp-12); margin-top: var(--sp-8); transition: border-color var(--dur-fast) var(--ease-standard); }
.firstc-ph { font-size: var(--fs-caption); color: var(--ink-3); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.firstc-cta { font-size: var(--fs-caption); color: var(--brand-text); font-weight: 600; flex-shrink: 0; }
/* #ifdef H5 */
.hotc, .firstc, .qsb-link, .mynote, .nop, .edit, .sync-tip { cursor: pointer; }
@media (hover: hover) and (pointer: fine) {
  .firstc:hover { border-color: var(--brand-text); }
}
/* #endif */
</style>
