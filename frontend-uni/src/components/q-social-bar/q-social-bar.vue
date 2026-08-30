<template>
  <view class="qsb">
    <!-- 我的笔记 -->
    <view v-if="!editing && note" class="mynote" @click="startEdit">
      <text class="nb">📝 我的笔记：</text>{{ note }}
      <text class="edit">改</text>
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
        <text class="nop cancel" @click="editing = false">取消</text>
        <text v-if="note" class="nop del" @click="saveIt('')">删除笔记</text>
        <text class="nop save" @click="saveIt(draft)">{{ busy ? '保存中…' : '保存' }}</text>
      </view>
    </view>
    <view class="qsb-row">
      <text v-if="!note && !editing" class="qsb-link" @click="startEdit">📝 写笔记</text>
      <text class="qsb-link" @click="openDiscuss">💬 讨论{{ count != null ? ' (' + count + ')' : '' }} ›</text>
      <text class="qsb-link" @click="shareToMates">🔗 分享给队友</text>
    </view>
    <view v-if="hot" class="hotc" @click="openDiscuss">
      <view class="hotc-top">
        <text class="hotc-tag">🔥 热评</text>
        <text class="hotc-nick">{{ hot.nickname }}</text>
        <text v-if="hot.likes" class="hotc-likes">👍 {{ hot.likes }}</text>
      </view>
      <view class="hotc-body">{{ hot.content }}</view>
    </view>
  </view>
</template>

<script>
import { fetchCommentCount, fetchComments, fetchNote, saveNote, shareCreate, qShareText, shareVariant, trackEvent } from '../../api.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };

export default {
  name: 'QSocialBar',
  props: {
    questionId: { type: Number, required: true },
  },
  data() {
    return { count: null, note: '', draft: '', editing: false, busy: false, hot: null };
  },
  watch: {
    questionId: {
      immediate: true,
      handler() {
        this.editing = false;
        this.note = '';
        this.count = null;
        this.hot = null;
        this.load();
      },
    },
  },
  methods: {
    async load() {
      const qid = this.questionId;
      try {
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
    startEdit() {
      this.draft = this.note;
      this.editing = true;
    },
    async saveIt(content) {
      if (this.busy) return;
      this.busy = true;
      try {
        const d = await saveNote(this.questionId, content.trim());
        this.note = d.content || '';
        this.editing = false;
        uni.showToast({ title: this.note ? '笔记已保存' : '笔记已删除', icon: 'none', duration: 900 });
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' });
      }
      this.busy = false;
    },
    openDiscuss() {
      uni.navigateTo({ url: '/pkgA/social/discuss?qid=' + this.questionId });
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
          success: () => uni.showToast({ title: '分享链接已复制，发给队友吧', icon: 'none' }),
        });
      } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: e.message || '分享失败', icon: 'none' });
      }
    },
  },
};
</script>

<style scoped>
.qsb { margin-top: 16rpx; }
.mynote { background: var(--warn-soft); border-left: 6rpx solid #f59e0b; border-radius: 0 12rpx 12rpx 0; padding: 14rpx 18rpx; font-size: 24rpx; color: var(--ink-2); line-height: 1.6; }
.nb { color: #b45309; font-weight: 600; }
.edit { color: var(--brand); margin-left: 12rpx; font-size: 22rpx; }
.note-edit { background: var(--warn-soft); border-radius: 14rpx; padding: 16rpx 18rpx; }
.note-ta { width: 100%; min-height: 100rpx; font-size: 25rpx; line-height: 1.6; box-sizing: border-box; }
.note-ops { display: flex; justify-content: flex-end; gap: 34rpx; margin-top: 10rpx; }
.nop { font-size: 24rpx; color: var(--ink-3); }
.nop.save { color: var(--brand); font-weight: 600; }
.nop.del { color: #ef4444; }
.qsb-row { display: flex; gap: 40rpx; margin-top: 14rpx; }
.qsb-link { font-size: 24rpx; color: var(--brand); }
.hotc { background: var(--fill); border-radius: 14rpx; padding: 14rpx 18rpx; margin-top: 14rpx; }
.hotc-top { display: flex; align-items: center; gap: 12rpx; }
.hotc-tag { font-size: 21rpx; color: #ea580c; background: #ffedd5; border-radius: 999rpx; padding: 2rpx 12rpx; font-weight: 600; }
.hotc-nick { font-size: 22rpx; color: var(--ink-2); font-weight: 600; }
.hotc-likes { font-size: 21rpx; color: var(--ink-3); margin-left: auto; }
.hotc-body { font-size: 24rpx; color: var(--ink-2); line-height: 1.6; margin-top: 8rpx; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
/* #ifdef H5 */
.hotc { cursor: pointer; }
/* #endif */
</style>
