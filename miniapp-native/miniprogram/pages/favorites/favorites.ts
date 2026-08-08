import {
  createFavFolder,
  deleteFavFolder,
  fetchFavFolders,
  fetchFavsFull,
  fetchNotes,
  removeFav,
  renameFavFolder,
  setFav,
} from '../../api/index';
import type { FavFolder, FavFull, NoteItem } from '../../api/types';
import { modName } from '../../utils/stats';

interface FavView extends FavFull {
  moduleName: string;
  optKeys: string[];
}

Page({
  data: {
    tab: 'fav' as 'fav' | 'note',
    loading: true,
    err: '',
    folders: [] as FavFolder[],
    curFolder: 0 as number | 0,
    items: [] as FavView[],
    shown: [] as FavView[],
    notes: [] as NoteItem[],
    detail: null as FavView | null,
    moveFav: null as FavView | null,
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, err: '' });
    try {
      const [fo, fa, no] = await Promise.all([
        fetchFavFolders(),
        fetchFavsFull(),
        fetchNotes(),
      ]);
      const items: FavView[] = (fa.items || []).map((f) => ({
        ...f,
        moduleName: modName(f.module || ''),
        optKeys: Object.keys(f.options || {}).sort(),
      }));
      this.setData({
        loading: false,
        folders: fo.items || [],
        items,
        notes: no.items || [],
      });
      this.applyFolder(this.data.curFolder);
    } catch (e) {
      this.setData({ loading: false, err: (e as Error).message });
    }
  },

  applyFolder(fid: number) {
    const shown = fid
      ? this.data.items.filter((i) => i.folder_id === fid)
      : this.data.items;
    this.setData({ curFolder: fid, shown });
  },

  onTab(e: WechatMiniprogram.TouchEvent) {
    this.setData({ tab: String(e.currentTarget.dataset.tab) as 'fav' | 'note' });
  },
  onFolder(e: WechatMiniprogram.TouchEvent) {
    this.applyFolder(Number(e.currentTarget.dataset.fid) || 0);
  },

  onAddFolder() {
    wx.showModal({
      title: '新建收藏夹',
      editable: true,
      placeholderText: '收藏夹名称',
      success: async (r) => {
        const name = (r.content || '').trim();
        if (!r.confirm || !name) return;
        try {
          await createFavFolder(name);
          this.load();
        } catch (e) {
          wx.showToast({ title: (e as Error).message, icon: 'none' });
        }
      },
    });
  },

  onFolderLongPress(e: WechatMiniprogram.TouchEvent) {
    const fid = Number(e.currentTarget.dataset.fid);
    if (!fid) return;
    const folder = this.data.folders.find((f) => f.id === fid);
    if (!folder) return;
    wx.showActionSheet({
      itemList: ['重命名', '删除（收藏移回默认）'],
      success: (r) => {
        if (r.tapIndex === 0) {
          wx.showModal({
            title: '重命名收藏夹',
            editable: true,
            content: folder.name,
            success: async (m) => {
              const name = (m.content || '').trim();
              if (!m.confirm || !name) return;
              try {
                await renameFavFolder(fid, name);
                this.load();
              } catch (err) {
                wx.showToast({ title: (err as Error).message, icon: 'none' });
              }
            },
          });
        } else if (r.tapIndex === 1) {
          wx.showModal({
            title: '删除收藏夹',
            content: '夹内收藏将移回默认收藏夹',
            success: async (m) => {
              if (!m.confirm) return;
              try {
                await deleteFavFolder(fid);
                this.setData({ curFolder: 0 });
                this.load();
              } catch (err) {
                wx.showToast({ title: (err as Error).message, icon: 'none' });
              }
            },
          });
        }
      },
      fail: () => undefined,
    });
  },

  onItem(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const it = this.data.items.find((i) => i.id === id);
    if (it) this.setData({ detail: it });
  },
  onCloseDetail() {
    this.setData({ detail: null });
  },
  noop() {
    /* 阻止冒泡 */
  },

  async onUnfav() {
    const d = this.data.detail;
    if (!d) return;
    try {
      await removeFav(d.id);
      this.setData({ detail: null });
      wx.showToast({ title: '已取消收藏', icon: 'none' });
      this.load();
    } catch (e) {
      wx.showToast({ title: (e as Error).message, icon: 'none' });
    }
  },

  onMove() {
    const d = this.data.detail;
    if (!d) return;
    this.setData({ moveFav: d, detail: null });
  },
  onCloseMove() {
    this.setData({ moveFav: null });
  },
  async onMoveTo(e: WechatMiniprogram.TouchEvent) {
    const fav = this.data.moveFav;
    if (!fav) return;
    const fid = Number(e.currentTarget.dataset.fid) || null;
    try {
      await setFav(fav.id, fid);
      this.setData({ moveFav: null });
      wx.showToast({ title: '已移动', icon: 'none' });
      this.load();
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: 'none' });
    }
  },
});
