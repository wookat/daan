<template>
  <view class="wrap">
    <!-- 顶部分段 -->
    <wd-segmented ref="seg" :value="tabLabel" :options="tabOpts" class="seg" @change="onTabChange" />

    <template v-if="tab === 'fav'">
      <kg-skeleton v-if="loading" preset="cards" />
      <kg-empty-state
        v-else-if="favErr"
        icon="wifi-off"
        :title="'加载失败：' + favErr"
        cta-text="重试"
        @cta="load"
      />
      <!-- 一条收藏都没有：不展示假可用的收藏夹/筛选，直接空态 -->
      <kg-empty-state
        v-else-if="!items.length"
        icon="star"
        title="这里还没有收藏"
        desc="刷题时点右上角收藏星标收藏好题，收藏后可在这里「移动到…」选收藏夹"
        cta-text="去刷题"
        :secondary-text="logged ? '' : '登录同步收藏'"
        @cta="goPractice"
        @secondary="goLogin"
      />
      <kg-two-col v-else aside-first>
        <template #aside>
          <!-- 收藏夹列表 -->
          <kg-card class="folders" :padding="12">
            <view
              v-for="f in folders"
              :key="f.id"
              class="folder"
              :class="{ on: folderId === f.id }"
              role="button"
              @click="pickFolder(f)"
              @longpress="folderOps(f)"
            >
              <view class="fico"><text class="fico-t">{{ f.icon }}</text></view>
              <view class="fmain">
                <text class="fname">{{ f.name }}</text>
                <text class="fsub"><text class="num">{{ f.n }}</text> 题</text>
              </view>
              <!-- #ifdef H5 -->
              <view v-if="f.id" class="fops" role="button" aria-label="收藏夹操作" @click.stop="folderOps(f)"><l-icon name="ellipsis" :size="20" tone="faint" /></view>
              <!-- #endif -->
              <l-icon :name="folderId === f.id ? 'check' : 'chevron-right'" :size="20" :tone="folderId === f.id ? 'brand-text' : 'faint'" />
            </view>
            <view class="folder add" role="button" @click="newFolder">
              <view class="fico"><l-icon name="folder-plus" :size="20" tone="brand-text" /></view>
              <view class="fmain"><text class="fname add-t">新建收藏夹</text></view>
            </view>
          </kg-card>
        </template>
        <template #main>
          <!-- 模块筛选：只列本人有收藏的模块，只有 1 个模块时不显示 -->
          <kg-chip-row v-if="modChipsVisible" v-model="modFilter" :options="modOpts" class="chips" />

          <kg-empty-state
            v-if="!shownItems.length"
            compact
            icon="star"
            title="这个筛选下还没有收藏"
            desc="换个收藏夹或模块看看"
          />
          <template v-else>
            <kg-button variant="primary" size="lg" block icon="shuffle" class="redo" @click="redoFolder">重练{{ curFolderName }}（{{ shownItems.length }} 题 · 乱序）</kg-button>
            <kg-card v-for="it in shownItems" :key="it.id || it._lkey" clickable class="qitem" @click="it._open = !it._open">
              <text class="qtx q-text" :class="{ full: it._open }">{{ it.question }}</text>
              <view class="meta">
                <kg-tag tone="module" :module="it.module">{{ modName(it.module) }}</kg-tag>
                <kg-tag v-if="it.submodule" tone="neutral">{{ it.submodule }}</kg-tag>
                <text class="mtime">收藏于 {{ fmtDate(it.faved_at) }}</text>
              </view>
              <view v-if="it.note" class="mynote">
                <view class="nb"><l-icon name="pencil-line" :size="16" tone="warn" /><text class="nb-t">我的笔记</text></view>
                <text class="mynote-t q-text">{{ it.note }}</text>
              </view>
              <view v-if="it._open" class="detail">
                <text v-for="(v, k) in it.options" :key="k" class="opt q-text" :class="{ ans: (it.answer || '').indexOf(k) !== -1 }">{{ k }}. {{ v }}</text>
                <text class="ansline">正确答案 {{ it.answer }}</text>
                <text v-if="it.hs_explanation || it.explanation" class="exp q-text">{{ it.hs_explanation || it.explanation }}</text>
                <view class="ops" @click.stop>
                  <kg-button v-if="askSeenTick >= 0 && favAskSeen(it)" variant="text" size="sm" aria-label="回看 AI 详解" @click.stop="openSeenAskFav(it)">回看 AI 详解</kg-button>
                  <kg-button variant="text" size="sm" aria-label="AI 详解本题" @click.stop="askFromFav(it)">AI 详解本题</kg-button>
                  <kg-button v-if="!it._local" variant="text" size="sm" @click.stop="moveItem(it)">移动到…</kg-button>
                  <kg-button v-if="!it._local" variant="text" size="sm" @click.stop="openDiscuss(it)">讨论区</kg-button>
                  <kg-button variant="text" size="sm" tone="bad" @click.stop="unfav(it)">取消收藏</kg-button>
                </view>
              </view>
            </kg-card>
          </template>
        </template>
      </kg-two-col>
    </template>

    <template v-else>
      <kg-skeleton v-if="loading" preset="cards" />
      <kg-empty-state
        v-else-if="noteErr"
        icon="wifi-off"
        :title="'加载失败：' + noteErr"
        cta-text="重试"
        @cta="switchNote"
      />
      <kg-empty-state
        v-else-if="!notes.length"
        icon="pencil-line"
        title="还没有笔记"
        desc="答题后在解析下方「写笔记」，方法心得随题沉淀"
        cta-text="去刷题"
        @cta="goPractice"
      />
      <view v-else class="ngrid">
        <kg-card v-for="n in notes" :key="n.question_id" class="qitem">
          <text class="qtx q-text">{{ n.question }}</text>
          <view class="meta">
            <kg-tag tone="module" :module="n.module">{{ modName(n.module) }}</kg-tag>
            <kg-tag v-if="n.submodule" tone="neutral">{{ n.submodule }}</kg-tag>
            <text class="mtime">{{ fmtDate(n.updated_at) }}</text>
          </view>
          <view class="mynote">
            <view class="nb"><l-icon name="pencil-line" :size="16" tone="warn" /><text class="nb-t">我的笔记</text></view>
            <text class="mynote-t q-text">{{ n.content }}</text>
          </view>
        </kg-card>
      </view>
    </template>
  </view>
</template>

<script>
import { createFavFolder, deleteFavFolder, fetchFavFolders, fetchFavs, fetchNotes, getToken, removeFav, renameFavFolder, setFav, trackEvent } from '../../api.js';
import { askPrefill } from '../../ask-prefill.js';
import { askQid, findAskSid } from '../../ask-link.js';
import { favModulePlan } from '../../fav-module-opts.js';
import { buildFavoritesUrl, parseFavoritesOpts } from '../../favorites-url.js';
import { MODULES, MODULE_KEYS, moduleLabel } from '../../module-meta.js';
import { segResizeMixin } from '../../seg-resize.js';

// 收藏页模块筛选项：题库 5 模块（module-meta 单一来源）+ 本地时政收藏
const MOD_KEYS = [...MODULE_KEYS, '时政'];
const TAB_OPTS = [
  { label: '收藏题目', value: 'fav' },
  { label: '我的笔记', value: 'note' },
];

export default {
  mixins: [segResizeMixin],
  data() {
    return {
      tab: 'fav',
      logged: false,
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
    tabOpts() {
      return TAB_OPTS.map((o) => o.label);
    },
    tabLabel() {
      return (TAB_OPTS.find((o) => o.value === this.tab) || TAB_OPTS[0]).label;
    },
    modPlan() {
      return favModulePlan(this.items, this.modFilter, MOD_KEYS, (m) => this.modName(m));
    },
    modOpts() {
      return this.modPlan.opts;
    },
    modChipsVisible() {
      return this.modPlan.visible;
    },
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
    this.logged = !!getToken();
    this.load();
    // 与 book.vue 同口径（R546）：进深页时 router 用自己缓存的地址覆写本条目，返回后地址栏丢 tab/mod，回来重写一次；
    // 深链 ?folder= 尚未落地（load 里才应用）时让位，否则会把入参抹掉
    if (this._pendingFolder == null) this.syncUrl();
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
        window.history.replaceState(window.history.state, '', buildFavoritesUrl({ tab: this.tab === 'note' ? 'note' : '', mod: this.modFilter, folder: this.folderId }));
      }
      // #endif
    },
    modName(m) {
      return MODULES[m] ? moduleLabel(m) : m || '';
    },
    onTabChange(opt) {
      const o = TAB_OPTS.find((x) => x.label === (opt && opt.value));
      if (!o || o.value === this.tab) return;
      if (o.value === 'note') this.switchNote();
      else this.tab = 'fav';
    },
    goPractice() {
      uni.switchTab({ url: '/pages/home/home' });
    },
    goLogin() {
      uni.navigateTo({ url: '/pkgA/user/login' });
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
            if (!it._local) await removeFav(it.id);
            // 云条目也清本机同题：题页/错题本对账（syncCloudFavs）会把云收藏写进 favQuestions，只删云端的话 load() 合并时它会以本机条目复活
            const locals = (uni.getStorageSync('favQuestions') || []).filter((x) => x.question !== it.question && !(it.id != null && x.id === it.id));
            uni.setStorageSync('favQuestions', locals);
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
.wrap { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.seg { margin-bottom: var(--sp-16); }
.folder { display: flex; align-items: center; gap: var(--sp-12); min-height: var(--cell-h); padding: var(--sp-8) 0; border-bottom: 1px solid var(--line); }
.folder:last-child { border-bottom: none; }
.fico { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--brand-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.fico-t { font-size: var(--fs-body); line-height: 1; }
.fmain { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.fname { font-size: var(--fs-body); font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folder.on .fname { color: var(--brand-text); }
.fsub { font-size: var(--fs-caption); color: var(--ink-3); margin-top: 2px; }
.add-t { color: var(--brand-text); }
.fops { width: var(--hit-min); height: var(--hit-min); display: flex; align-items: center; justify-content: center; border-radius: var(--r-full); }
.chips { margin-bottom: var(--sp-12); }
.redo { margin-bottom: var(--sp-12); }
.qitem { margin-bottom: var(--card-gap); }
.qtx { display: -webkit-box; font-size: var(--fs-body); color: var(--ink); -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.qtx.full { -webkit-line-clamp: unset; display: block; }
.meta { display: flex; gap: var(--sp-8); align-items: center; margin-top: var(--sp-8); flex-wrap: wrap; }
.mtime { font-size: var(--fs-caption); color: var(--ink-3); }
.mynote { background: var(--warn-soft); border-left: 3px solid var(--warn); border-radius: 0 var(--r-sm) var(--r-sm) 0; padding: var(--sp-8) var(--sp-12); margin-top: var(--sp-12); }
.nb { display: flex; align-items: center; gap: var(--sp-4); margin-bottom: var(--sp-4); }
.nb-t { font-size: var(--fs-caption); color: var(--warn-strong); font-weight: 600; }
.mynote-t { display: block; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--ink-2); }
.detail { margin-top: var(--sp-12); border-top: 1px solid var(--line); padding-top: var(--sp-12); }
.opt { display: block; font-size: var(--fs-sub); color: var(--ink-2); }
.opt.ans { color: var(--ok); font-weight: 600; }
.ansline { display: block; font-size: var(--fs-sub); color: var(--ink-3); margin: var(--sp-8) 0; }
.exp { display: block; font-size: var(--fs-sub); color: var(--ink-2); background: var(--fill); border-radius: var(--r-sm); padding: var(--sp-12); }
.ops { display: flex; gap: var(--sp-4); margin-top: var(--sp-8); flex-wrap: wrap; }
.ngrid { display: flex; flex-direction: column; }

/* 桌面（H5）：≥1024 KgTwoCol 双栏（收藏夹辅栏 + 列表主列），笔记两列 */
/* #ifdef H5 */
@media (min-width: 768px) {
  .folder:hover, .qitem:hover, .fops:hover { cursor: pointer; }
}
@media (min-width: 1024px) {
  .wrap { max-width: 1044px !important; }
  .ngrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--sp-24); align-items: start; }
}
/* #endif */
</style>
