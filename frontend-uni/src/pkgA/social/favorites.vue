<template>
  <view class="wrap">
    <!-- 顶部分段 -->
    <view class="seg">
      <text class="seg-i" :class="{ on: tab === 'fav' }" @click="tab = 'fav'">收藏题目</text>
      <text class="seg-i" :class="{ on: tab === 'note' }" @click="switchNote">我的笔记</text>
    </view>

    <template v-if="tab === 'fav'">
      <view class="fav-cols">
      <view class="fav-left">
      <!-- 收藏夹列表 -->
      <view class="card folders">
        <view
          v-for="f in folders"
          :key="f.id"
          class="folder"
          :class="{ on: folderId === f.id }"
          @click="pickFolder(f)"
          @longpress="folderOps(f)"
        >
          <text class="fico">{{ f.icon }}</text>
          <view class="fmain">
            <text class="fname">{{ f.name }}</text>
            <text class="fsub">{{ f.n }} 题</text>
          </view>
          <!-- #ifdef H5 -->
          <text v-if="f.id" class="fops" @click.stop="folderOps(f)">···</text>
          <!-- #endif -->
          <text class="chev">{{ folderId === f.id ? '✓' : '›' }}</text>
        </view>
        <view class="folder add" @click="newFolder">
          <view class="fico"><l-icon name="folder-plus" :size="18" color="#2e5bff" /></view>
          <view class="fmain"><text class="fname add-t">新建收藏夹</text></view>
        </view>
      </view>
      </view>

      <view class="fav-right">
      <!-- 模块筛选 -->
      <view class="chips">
        <text class="chip" :class="{ on: !modFilter }" @click="modFilter = ''">全部模块</text>
        <text
          v-for="(nm, m) in MODS"
          :key="m"
          class="chip"
          :class="{ on: modFilter === m }"
          @click="modFilter = modFilter === m ? '' : m"
        >{{ nm }}</text>
      </view>

      <view v-if="loading" class="card empty">加载中…</view>
      <view v-else-if="favErr" class="card empty">
        <view class="empty-t">加载失败：{{ favErr }}</view>
        <view class="retry" @click="load">重试 ›</view>
      </view>
      <view v-else-if="!shownItems.length" class="card empty">
        <view class="empty-t">这里还没有收藏</view>
        <view class="empty-s">刷题时点右上角收藏星标收藏好题，收藏后可在这里「移动到…」选收藏夹</view>
      </view>
      <template v-else>
        <button class="btn" @click="redoFolder">重练{{ curFolderName }}（{{ shownItems.length }} 题 · 乱序）</button>
        <view v-for="it in shownItems" :key="it.id || it._lkey" class="card qitem" @click="it._open = !it._open">
          <view class="qtx" :class="{ full: it._open }">{{ it.question }}</view>
          <view class="meta">
            <text class="tag" :style="{ background: modColor(it.module).bg, color: modColor(it.module).fg }">{{ modName(it.module) }}</text>
            <text v-if="it.submodule" class="tag gray">{{ it.submodule }}</text>
            <text class="mtime">收藏于 {{ fmtDate(it.faved_at) }}</text>
          </view>
          <view v-if="it.note" class="mynote"><text class="nb"><l-icon name="pencil-line" :size="13" color="#b45309" /> 我的笔记：</text>{{ it.note }}</view>
          <view v-if="it._open" class="detail">
            <view v-for="(v, k) in it.options" :key="k" class="opt" :class="{ ans: (it.answer || '').indexOf(k) !== -1 }">{{ k }}. {{ v }}</view>
            <view class="ansline">正确答案 {{ it.answer }}</view>
            <view v-if="it.hs_explanation || it.explanation" class="exp">{{ it.hs_explanation || it.explanation }}</view>
            <view class="ops">
              <text v-if="askSeenTick >= 0 && favAskSeen(it)" class="op seen" role="button" aria-label="回看 AI 详解" @click.stop="openSeenAskFav(it)">回看 AI 详解</text>
              <text class="op" role="button" aria-label="AI 详解本题" @click.stop="askFromFav(it)">AI 详解本题</text>
              <text v-if="!it._local" class="op" @click.stop="moveItem(it)">移动到…</text>
              <text v-if="!it._local" class="op" @click.stop="openDiscuss(it)">讨论区</text>
              <text class="op del" @click.stop="unfav(it)">取消收藏</text>
            </view>
          </view>
        </view>
      </template>
      </view>
      </view>
    </template>

    <template v-else>
      <view v-if="loading" class="card empty">加载中…</view>
      <view v-else-if="noteErr" class="card empty">
        <view class="empty-t">加载失败：{{ noteErr }}</view>
        <view class="retry" @click="switchNote">重试 ›</view>
      </view>
      <view v-else-if="!notes.length" class="card empty">
        <view class="empty-t">还没有笔记</view>
        <view class="empty-s">答题后在解析下方「写笔记」，方法心得随题沉淀</view>
      </view>
      <view class="ngrid">
      <view v-for="n in notes" :key="n.question_id" class="card qitem">
        <view class="qtx">{{ n.question }}</view>
        <view class="meta">
          <text class="tag" :style="{ background: modColor(n.module).bg, color: modColor(n.module).fg }">{{ modName(n.module) }}</text>
          <text v-if="n.submodule" class="tag gray">{{ n.submodule }}</text>
          <text class="mtime">{{ fmtDate(n.updated_at) }}</text>
        </view>
        <view class="mynote"><text class="nb"><l-icon name="pencil-line" :size="13" color="#b45309" /> </text>{{ n.content }}</view>
      </view>
      </view>
    </template>
    <view style="height: 40rpx" />
  </view>
</template>

<script>
import { createFavFolder, deleteFavFolder, fetchFavFolders, fetchFavs, fetchNotes, removeFav, renameFavFolder, setFav, trackEvent } from '../../api.js';
import { askPrefill } from '../../ask-prefill.js';
import { askQid, findAskSid } from '../../ask-link.js';
import { buildFavoritesUrl, parseFavoritesOpts } from '../../favorites-url.js';

const MODS = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', 时政: '时政' };
const COLORS = {
  changshi: { bg: '#FEF3C7', fg: '#B45309' },
  shuliang: { bg: '#DBEAFE', fg: '#1D4ED8' },
  panduan: { bg: '#EDE9FE', fg: '#6D28D9' },
  ziliao: { bg: '#D1FAE5', fg: '#047857' },
  yanyu: { bg: '#FEE2E2', fg: '#B91C1C' },
};

export default {
  data() {
    return {
      MODS,
      tab: 'fav',
      favErr: '',
      noteErr: '',
      folders: [],
      folderId: null,
      items: [],
      notes: [],
      modFilter: '',
      askSeenTick: 0,
      loading: true,
    };
  },
  computed: {
    shownItems() {
      let list = this.items;
      if (this.folderId != null) list = list.filter((it) => it.folder_id === this.folderId);
      if (this.modFilter) list = list.filter((it) => it.module === this.modFilter);
      return list;
    },
    curFolderName() {
      if (this.folderId == null) return '全部收藏';
      const f = this.folders.find((x) => x.id === this.folderId);
      return f ? '「' + f.name + '」' : '本夹';
    },
  },
  onLoad(opts) {
    const p = parseFavoritesOpts(opts);
    if (p.mod) this.modFilter = p.mod;
    this._pendingFolder = p.folder;
    if (p.tab === 'note') this.switchNote();
  },
  onShow() {
    this.askSeenTick++;
    this.load();
  },
  watch: {
    tab() {
      this.syncUrl();
    },
    folderId() {
      this.syncUrl();
    },
    modFilter() {
      this.syncUrl();
    },
  },
  methods: {
    syncUrl() {
      // #ifdef H5
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', buildFavoritesUrl({ tab: this.tab === 'note' ? 'note' : '', mod: this.modFilter, folder: this.folderId }));
      }
      // #endif
    },
    modName(m) {
      return MODS[m] || m || '';
    },
    modColor(m) {
      return COLORS[m] || { bg: '#EEF3FF', fg: '#2E5BFF' };
    },
    fmtDate(ts) {
      const d = new Date(ts * 1000);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },
    async load() {
      this.loading = true;
      this.favErr = '';
      try {
        const [f, v] = await Promise.all([fetchFavFolders(), fetchFavs()]);
        this.folders = f.items;
        this.items = v.items.map((it) => ({ ...it, _open: false }));
        // 合并本地收藏（时政题等无题库 id 的收藏只存本地），与题目页/错题本口径一致
        const seen = new Set(this.items.map((it) => it.question));
        const locals = (uni.getStorageSync('favQuestions') || [])
          .filter((x) => x.question && !seen.has(x.question))
          .map((x, i) => ({ ...x, module: x.module || '时政', id: null, _local: true, _lkey: 'L' + i, folder_id: 0, faved_at: Math.round((x.t || Date.now()) / 1000), _open: false }));
        this.items = [...this.items, ...locals].sort((a, b) => b.faved_at - a.faved_at);
        const def = this.folders.find((x) => x.id === 0);
        if (def) def.n += locals.length;
        if (this._pendingFolder != null) {
          const want = this._pendingFolder;
          this._pendingFolder = null;
          if (this.folders.some((x) => x.id === want)) this.folderId = want;
        }
      } catch (e) {
        this.favErr = e.message || '网络异常';
        uni.showToast({ title: e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async switchNote() {
      this.tab = 'note';
      this.loading = true;
      this.noteErr = '';
      try {
        const d = await fetchNotes();
        this.notes = d.items;
      } catch (e) {
        this.noteErr = e.message || '网络异常';
        uni.showToast({ title: e.message, icon: 'none' });
      }
      this.loading = false;
    },
    pickFolder(f) {
      this.folderId = this.folderId === f.id ? null : f.id;
    },
    newFolder() {
      uni.showModal({
        title: '新建收藏夹',
        editable: true,
        placeholderText: '夹名，如：图推·必背规律',
        success: async (r) => {
          if (!r.confirm || !r.content) return;
          try {
            await createFavFolder(r.content.trim());
            this.load();
          } catch (e) {
            uni.showToast({ title: e.message, icon: 'none' });
          }
        },
      });
    },
    folderOps(f) {
      if (!f.id) return; // 默认夹不可改
      uni.showActionSheet({
        itemList: ['重命名', '删除（夹内收藏移回默认夹）'],
        success: (r) => {
          if (r.tapIndex === 0) {
            uni.showModal({
              title: '重命名收藏夹',
              editable: true,
              placeholderText: f.name,
              success: async (m) => {
                if (!m.confirm || !m.content) return;
                try {
                  await renameFavFolder(f.id, m.content.trim());
                  this.load();
                } catch (e) {
                  uni.showToast({ title: e.message, icon: 'none' });
                }
              },
            });
          } else if (r.tapIndex === 1) {
            uni.showModal({
              title: `删除「${f.name}」？`,
              content: '夹内收藏会移回默认收藏夹',
              success: async (m) => {
                if (!m.confirm) return;
                try {
                  await deleteFavFolder(f.id);
                  if (this.folderId === f.id) this.folderId = null;
                  this.load();
                } catch (e) {
                  uni.showToast({ title: e.message, icon: 'none' });
                }
              },
            });
          }
        },
      });
    },
    favAskSeen(it) {
      return findAskSid(uni.getStorageSync('askSessions'), uni.getStorageSync('askCurSession'), it && it.id);
    },
    openSeenAskFav(it) {
      const seen = this.favAskSeen(it);
      if (!seen) return;
      if (seen.sid > 0) uni.setStorageSync('askOpenSid', seen.sid);
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    askFromFav(it) {
      const text = askPrefill(it && it.question, it && it.options);
      if (!text) return;
      trackEvent('fav_ask_click', (it && it.module) || '');
      uni.setStorageSync('redoQuestion', text);
      const qid = askQid(it && it.id);
      if (qid) uni.setStorageSync('redoQid', qid);
      else uni.removeStorageSync('redoQid');
      uni.removeStorageSync('redoAnswer');
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    moveItem(it) {
      const opts = this.folders.map((f) => f.icon + ' ' + f.name);
      uni.showActionSheet({
        itemList: opts,
        success: async (r) => {
          const f = this.folders[r.tapIndex];
          try {
            await setFav(it.id, f.id || null);
            it.folder_id = f.id;
            this.load();
            uni.showToast({ title: '已移入「' + f.name + '」', icon: 'none' });
          } catch (e) {
            uni.showToast({ title: e.message, icon: 'none' });
          }
        },
      });
    },
    unfav(it) {
      uni.showModal({
        title: '取消收藏这道题？',
        success: async (r) => {
          if (!r.confirm) return;
          try {
            if (it._local) {
              const locals = (uni.getStorageSync('favQuestions') || []).filter((x) => x.question !== it.question);
              uni.setStorageSync('favQuestions', locals);
            } else {
              await removeFav(it.id);
            }
            this.load();
          } catch (e) {
            uni.showToast({ title: e.message, icon: 'none' });
          }
        },
      });
    },
    openDiscuss(it) {
      uni.navigateTo({ url: '/pkgA/social/discuss?qid=' + it.id });
    },
    redoFolder() {
      const list = [...this.shownItems];
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      uni.setStorageSync('redoSet', list.slice(0, 50));
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; }
.card { background: var(--card, #fff); border-radius: var(--radius, 24rpx); padding: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); margin-bottom: 20rpx; }
.seg { display: flex; background: var(--line); border-radius: 18rpx; padding: 6rpx; margin-bottom: 20rpx; }
.seg-i { flex: 1; text-align: center; padding: 14rpx 0; border-radius: 14rpx; font-size: 26rpx; color: var(--ink-2); }
.seg-i.on { background: var(--card); color: var(--ink); font-weight: 700; box-shadow: 0 2rpx 8rpx rgba(31, 36, 48, 0.08); }
.folders { padding: 8rpx 24rpx; }
.folder { display: flex; align-items: center; gap: 18rpx; padding: 22rpx 0; border-bottom: 1rpx solid var(--fill); }
.folder:last-child { border-bottom: none; }
.fico { width: 68rpx; height: 68rpx; border-radius: 16rpx; background: var(--brand-soft); display: flex; align-items: center; justify-content: center; font-size: 32rpx; }
.fmain { flex: 1; display: flex; flex-direction: column; }
.fname { font-size: 28rpx; font-weight: 600; }
.folder.on .fname { color: var(--brand-text); }
.fsub { font-size: 24rpx; color: var(--ink-3); margin-top: 2rpx; }
.chev { color: var(--ink-4); font-size: 26rpx; }
.folder.on .chev { color: var(--brand-text); font-weight: 700; }
.add-t { color: var(--brand-text); }
.chips { display: flex; gap: 12rpx; flex-wrap: wrap; margin: 4rpx 4rpx 18rpx; }
.chip { font-size: 24rpx; color: var(--ink-2); background: var(--fill); padding: 8rpx 22rpx; border-radius: 999rpx; }
.chip.on { background: var(--brand-soft); color: var(--brand-text); font-weight: 700; }
.empty { text-align: center; color: var(--ink-3); font-size: 26rpx; padding: 60rpx 24rpx; }
.retry { display: flex; align-items: center; justify-content: center; min-height: 40px; margin-top: 4rpx; color: var(--brand-text); font-size: 26rpx; font-weight: 500; }
.empty-t { font-size: 28rpx; font-weight: 600; color: var(--ink-2); margin-bottom: 8rpx; }
.btn { background: var(--brand); color: #fff; font-size: 28rpx; border-radius: 18rpx; margin-bottom: 20rpx; }
.qtx { font-size: 28rpx; line-height: 1.65; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.qtx.full { -webkit-line-clamp: unset; display: block; }
.meta { display: flex; gap: 10rpx; align-items: center; margin-top: 12rpx; flex-wrap: wrap; }
.tag { font-size: 24rpx; padding: 4rpx 14rpx; border-radius: 8rpx; }
.tag.gray { background: var(--fill); color: var(--ink-3); }
.mtime { font-size: 24rpx; color: var(--ink-3); }
.mynote { background: var(--warn-soft); border-left: 6rpx solid #f59e0b; border-radius: 0 12rpx 12rpx 0; padding: 14rpx 18rpx; font-size: 24rpx; color: var(--ink-2); margin-top: 14rpx; line-height: 1.6; }
.nb { color: #b45309; font-weight: 600; }
.detail { margin-top: 16rpx; border-top: 1rpx solid var(--fill); padding-top: 16rpx; }
.opt { font-size: 26rpx; color: var(--ink-2); line-height: 1.7; }
.opt.ans { color: #16a34a; font-weight: 600; }
.ansline { font-size: 24rpx; color: var(--ink-3); margin: 10rpx 0; }
.exp { font-size: 24rpx; color: var(--ink-2); line-height: 1.7; background: var(--fill); border-radius: 14rpx; padding: 16rpx 20rpx; }
.ops { display: flex; gap: 34rpx; margin-top: 16rpx; }
.op { font-size: 24rpx; color: var(--brand-text); }
.op.seen { color: var(--ok-strong); }
.op.del { color: #ef4444; }
.fops { color: var(--ink-4); font-size: 26rpx; padding: 0 10rpx; }

/* 桌面（H5）：≥768 页宽收敛；≥1024 左收藏夹侧栏+右列表双栏，笔记两列 */
/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .folder:hover, .chip:hover, .qitem:hover, .seg-i:hover, .fops:hover { cursor: pointer; }
  .qitem:hover { box-shadow: 0 8rpx 24rpx rgba(31, 36, 48, 0.08); }
  .fops:hover { color: var(--brand-text); }
}
@media (min-width: 1024px) {
  .fav-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .fav-left { width: 300px; flex: none; position: sticky; top: 24rpx; }
  .fav-right { flex: 1; min-width: 0; }
  .ngrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; align-items: start; }
}
/* #endif */
</style>
