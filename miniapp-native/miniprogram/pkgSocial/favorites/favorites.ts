// 收藏与笔记（对齐 frontend-uni/src/pkgA/social/favorites.vue）：收藏夹增删改、按夹/模块筛选、展开详情、
// 移动到…/取消收藏/AI 详解/讨论区/重练本夹；笔记 tab 列表。本地收藏（favQuestions）合并去重口径与 H5 一致。
import { createFavFolder, deleteFav, deleteFavFolder, fetchFavFolders, fetchFavs, fetchNotes, renameFavFolder, trackEvent } from '../../api/index';
import { setFav } from '../../api/social';
import type { FavFolder, NoteItem, Question } from '../../api/types';
import { askPrefill, askQid, findAskSid } from '../../utils/ask-sessions';
import { getToken } from '../../utils/auth';
import { dropFavItem } from '../../utils/fav-list';
import { favModulePlan } from '../../utils/fav-module-opts';
import { MODULE_KEYS, MODULES, moduleLabel } from '../../utils/module-meta';
import { confirmDanger, toastErrFrom, toastInfo, toastOk } from '../../utils/toast';

// 收藏页模块筛选项：题库 5 模块（module-meta 单一来源）+ 本地时政收藏
const MOD_KEYS = [...MODULE_KEYS, '时政'];
const TAB_OPTS = [
  { label: '收藏题目', value: 'fav' },
  { label: '我的笔记', value: 'note' },
];

interface FavQ extends Question {
  folder_id: number;
  faved_at: number;
  note?: string | null;
  _local?: boolean;
  _lkey?: string;
}

interface FavRow {
  key: string;
  id: number | null;
  module: string;
  modName: string;
  submodule: string;
  question: string;
  date: string;
  note: string;
  opts: { k: string; v: string; ans: boolean }[];
  answer: string;
  exp: string;
  open: boolean;
  local: boolean;
  seen: boolean;
}

interface NoteRow extends NoteItem {
  modName: string;
  date: string;
}

interface LocalFav {
  question: string;
  module?: string;
  options?: Record<string, string>;
  answer?: string;
  explanation?: string;
  t?: number;
}

function modName(m: string | null | undefined): string {
  return m && MODULES[m] ? moduleLabel(m) : m || '';
}

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

Page({
  data: {
    tab: 'fav' as 'fav' | 'note',
    tabOpts: TAB_OPTS,
    logged: false,
    loading: true,
    favErr: '',
    noteErr: '',
    folders: [] as FavFolder[],
    folderId: null as number | null,
    hasItems: false,
    rows: [] as FavRow[],
    notes: [] as NoteRow[],
    modFilter: '',
    modOpts: [{ label: '全部模块', value: '' }],
    modChipsVisible: false,
    curFolderName: '全部收藏',
    folderOpsOpen: false,
    folderOpsTitle: '收藏夹操作',
    moveOpen: false,
    moveFolderId: null as number | null,
  },

  items: [] as FavQ[],
  open: {} as Record<string, boolean>,
  pendingFolder: null as number | null,
  _opsFolder: null as FavFolder | null,
  _moveItem: null as FavQ | null,

  onLoad(opts: Record<string, string>) {
    if (opts.mod) this.setData({ modFilter: opts.mod });
    if (opts.folder != null && opts.folder !== '') this.pendingFolder = Number(opts.folder);
    if (opts.tab === 'note') this.switchNote();
  },
  onShow() {
    this.setData({ logged: !!getToken() });
    this.load();
  },

  // ---------- 收藏 ----------
  async load(opts?: { known?: boolean }) {
    // 已有列表在手时（onShow 回来 / 取消收藏 / 移动后）后台刷新不铺骨架，列表原地收缩（与 H5 同口径）；
    // 取消收藏删到 0 条时列表状态已由云端回执确认（known），空态直出不铺骨架；bind:cta 传入的是事件对象，known 不为 true
    const known = !!opts && opts.known === true;
    this.setData({ loading: !known && !this.items.length, favErr: '' });
    try {
      const [f, v] = await Promise.all([fetchFavFolders(), fetchFavs()]);
      const folders = f.items;
      const remote = v.items as unknown as FavQ[];
      const seen = new Set(remote.map((it) => it.question));
      const locals: FavQ[] = ((wx.getStorageSync('favQuestions') as LocalFav[]) || [])
        .filter((x) => x.question && !seen.has(x.question))
        .map((x, i) => ({
          id: null,
          module: x.module || '时政',
          question: x.question,
          options: x.options || {},
          answer: x.answer || '',
          explanation: x.explanation || '',
          _local: true,
          _lkey: 'L' + i,
          folder_id: 0,
          faved_at: Math.round((x.t || Date.now()) / 1000),
        }));
      this.items = [...remote, ...locals].sort((a, b) => b.faved_at - a.faved_at);
      const def = folders.find((x) => x.id === 0);
      if (def) def.n += locals.length;
      let folderId = this.data.folderId;
      if (this.pendingFolder != null) {
        const want = this.pendingFolder;
        this.pendingFolder = null;
        if (folders.some((x) => x.id === want)) folderId = want;
      }
      this.setData({ folders, folderId, hasItems: this.items.length > 0 });
      this.render();
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ favErr: msg });
      toastInfo(msg);
    }
    this.setData({ loading: false });
  },

  render() {
    const { folderId, modFilter, folders } = this.data;
    const plan = favModulePlan(this.items, modFilter, MOD_KEYS, modName);
    let list = this.items;
    if (folderId != null) list = list.filter((it) => it.folder_id === folderId);
    if (modFilter) list = list.filter((it) => it.module === modFilter);
    const sessions = wx.getStorageSync('askSessions');
    const cur = wx.getStorageSync('askCurSession');
    const rows: FavRow[] = list.map((it) => {
      const key = it.id != null ? String(it.id) : it._lkey || '';
      return {
        key,
        id: it.id,
        module: it.module || '',
        modName: modName(it.module),
        submodule: it.submodule || '',
        question: it.question,
        date: fmtDate(it.faved_at),
        note: it.note || '',
        opts: Object.keys(it.options || {}).map((k) => ({ k, v: it.options[k], ans: k === it.answer })),
        answer: it.answer,
        exp: it.hs_explanation || it.explanation || '',
        open: !!this.open[key],
        local: !!it._local,
        seen: !!findAskSid(sessions, cur, it.id),
      };
    });
    let curFolderName = '全部收藏';
    if (folderId != null) {
      const f = folders.find((x) => x.id === folderId);
      curFolderName = f ? '「' + f.name + '」' : '本夹';
    }
    this.setData({ rows, curFolderName, modOpts: plan.opts, modChipsVisible: plan.visible });
  },

  onTab(e: WechatMiniprogram.CustomEvent<{ value: 'fav' | 'note' }>) {
    const v = e.detail.value;
    if (v === this.data.tab) return;
    if (v === 'note') this.switchNote();
    else this.setData({ tab: 'fav' });
  },

  async switchNote() {
    this.setData({ tab: 'note', loading: true, noteErr: '' });
    try {
      const d = await fetchNotes();
      this.setData({ notes: d.items.map((n) => ({ ...n, modName: modName(n.module), date: fmtDate(n.updated_at) })) });
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ noteErr: msg });
      toastInfo(msg);
    }
    this.setData({ loading: false });
  },

  onModFilter(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ modFilter: e.detail.value || '' });
    this.render();
  },

  onPickFolder(e: WechatMiniprogram.BaseEvent) {
    const fid = Number(e.currentTarget.dataset.fid);
    this.setData({ folderId: this.data.folderId === fid ? null : fid });
    this.render();
  },

  onNewFolder() {
    wx.showModal({
      title: '新建收藏夹',
      editable: true,
      placeholderText: '夹名，如：图推·必背规律',
      success: async (r) => {
        if (!r.confirm || !r.content) return;
        try {
          await createFavFolder(r.content.trim());
          this.load();
        } catch (e) {
          toastInfo((e as Error).message);
        }
      },
    });
  },

  onFolderOps(e: WechatMiniprogram.BaseEvent) {
    const fid = Number(e.currentTarget.dataset.fid);
    const f = this.data.folders.find((x) => x.id === fid);
    if (!f || !f.id) return; // 默认夹不可改
    this._opsFolder = f;
    this.setData({ folderOpsOpen: true, folderOpsTitle: f.name });
  },
  onCloseFolderOps() {
    this.setData({ folderOpsOpen: false });
  },
  onSheetRenameFolder() {
    const f = this._opsFolder;
    this.setData({ folderOpsOpen: false });
    if (!f) return;
    wx.showModal({
      title: '重命名收藏夹',
      editable: true,
      placeholderText: f.name,
      success: async (m) => {
        if (!m.confirm || !m.content) return;
        try {
          await renameFavFolder(f.id, m.content.trim());
          toastOk('已重命名');
          this.load();
        } catch (err) {
          toastErrFrom(err, '重命名失败');
        }
      },
    });
  },
  async onSheetDeleteFolder() {
    const f = this._opsFolder;
    this.setData({ folderOpsOpen: false });
    if (!f) return;
    if (!(await confirmDanger({ title: `删除「${f.name}」？`, content: '夹内收藏会移回默认收藏夹', confirmText: '删除' }))) return;
    try {
      await deleteFavFolder(f.id);
      if (this.data.folderId === f.id) this.setData({ folderId: null });
      toastOk('已删除收藏夹');
      this.load();
    } catch (err) {
      toastErrFrom(err, '删除失败');
    }
  },

  rowOf(e: WechatMiniprogram.BaseEvent): FavQ | undefined {
    const key = String(e.currentTarget.dataset.key);
    return this.items.find((it) => (it.id != null ? String(it.id) : it._lkey) === key);
  },

  onToggle(e: WechatMiniprogram.BaseEvent) {
    const key = String(e.currentTarget.dataset.key);
    this.open[key] = !this.open[key];
    this.render();
  },
  noop() {},

  onSeenAsk(e: WechatMiniprogram.BaseEvent) {
    const it = this.rowOf(e);
    if (!it) return;
    const seen = findAskSid(wx.getStorageSync('askSessions'), wx.getStorageSync('askCurSession'), it.id);
    if (!seen) return;
    if (seen.sid > 0) wx.setStorageSync('askOpenSid', seen.sid);
    wx.navigateTo({ url: '/pkgSocial/ask/ask' });
  },

  onAsk(e: WechatMiniprogram.BaseEvent) {
    const it = this.rowOf(e);
    const text = it ? askPrefill(it.question, it.options) : '';
    if (!it || !text) return;
    trackEvent('fav_ask_click', it.module || '');
    wx.setStorageSync('redoQuestion', text);
    const qid = askQid(it.id);
    if (qid) wx.setStorageSync('redoQid', qid);
    else wx.removeStorageSync('redoQid');
    wx.removeStorageSync('redoAnswer');
    wx.navigateTo({ url: '/pkgSocial/ask/ask' });
  },

  onMove(e: WechatMiniprogram.BaseEvent) {
    const it = this.rowOf(e);
    if (!it || it.id == null) return;
    this._moveItem = it;
    this.setData({ moveOpen: true, moveFolderId: it.folder_id ?? 0 });
  },
  onCloseMove() {
    this.setData({ moveOpen: false });
  },
  async onConfirmMove(e: WechatMiniprogram.BaseEvent) {
    const it = this._moveItem;
    const fid = Number(e.currentTarget.dataset.fid);
    const f = this.data.folders.find((x) => x.id === fid);
    this.setData({ moveOpen: false });
    if (!it || !f) return;
    try {
      await setFav(it.id as number, f.id || null);
      it.folder_id = f.id;
      this.load();
      toastOk('已移入「' + f.name + '」');
    } catch (err) {
      toastErrFrom(err, '移动失败');
    }
  },

  onDiscuss(e: WechatMiniprogram.BaseEvent) {
    const it = this.rowOf(e);
    if (!it || it.id == null) return;
    wx.navigateTo({ url: '/pkgSocial/discuss/discuss?qid=' + it.id });
  },

  async onUnfav(e: WechatMiniprogram.BaseEvent) {
    const it = this.rowOf(e);
    if (!it) return;
    if (!(await confirmDanger({ title: '取消收藏这道题？', content: '取消后可随时在题库重新收藏', confirmText: '取消收藏' }))) return;
    try {
      if (!it._local) await deleteFav(it.id as number);
      // 云条目也清本机同题（题页/报告页收藏同时写本机 favQuestions 与云端，只删云端的话 load() 合并时会以本机条目复活），与 H5 同口径
      const locals = ((wx.getStorageSync('favQuestions') as LocalFav[]) || []).filter((x) => x.question !== it.question);
      wx.setStorageSync('favQuestions', locals);
      // 云端已确认删除：列表先本地收缩，再后台对账（不铺骨架）
      const next = dropFavItem(this.items, this.data.folders, it);
      this.items = next.items;
      this.setData({ folders: next.folders, hasItems: this.items.length > 0 });
      this.render();
      this.load({ known: true });
    } catch (err) {
      toastErrFrom(err, '取消收藏失败');
    }
  },

  onRedo() {
    const keys = new Set(this.data.rows.map((r) => r.key));
    const list = this.items.filter((it) => keys.has(it.id != null ? String(it.id) : it._lkey || ''));
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    wx.setStorageSync('redoSet', list.slice(0, 50));
    wx.navigateTo({ url: '/pages/practice/practice?mode=redoset' });
  },

  goPractice() {
    wx.switchTab({ url: '/pages/home/home' });
  },
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },
});
