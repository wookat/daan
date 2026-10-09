// 申论专区·热点三段式域：从 shenlun.ts 拆出。方法签名 (p, …) ——页面侧用一行委托调本模块。
import { fetchShenlunHotspots, setShenlunMatFav } from '../../api/exam';
import type { ShenlunHotspot, ShenlunMaterial } from '../../api/exam-types';
import { MFAV_IDS_KEY, MFAV_SNAPS_KEY } from '../../utils/kg-shenlun';

const PAGE = 20;

export interface HotSegVM {
  name: string;
  items: Array<ShenlunHotspot['others'][number] & { faved: boolean }>;
}

export interface HotVM {
  topic: string;
  segRows: HotSegVM[];
  others: Array<ShenlunHotspot['others'][number] & { faved: boolean }>;
  othersOpen: boolean;
  expanded: boolean;
}

// 本域用到的页面实例面（结构子集——整页 this 天然满足）
export interface HotsPage {
  data: { loading: boolean; mErr: string; hotEnd: boolean; hots: HotVM[]; mFavCount: number };
  setData(d: {
    loading?: boolean;
    mErr?: string;
    hotEnd?: boolean;
    hots?: HotVM[];
    mFavCount?: number;
  }): void;
  _hotsRaw: ShenlunHotspot[];
  _hOffset: number;
  _expanded: string | number;
  _mFavIds: number[];
  _mFavs: ShenlunMaterial[];
}

export function hotvm(p: HotsPage, g: ShenlunHotspot): HotVM {
  const fav = (m: ShenlunHotspot['others'][number]) => ({ ...m, faved: p._mFavIds.includes(m.id) });
  const segRows = (['内涵', '角度', '金句'] as const)
    .map((name) => ({ name, items: ((g.segs || {})[name] || []).map(fav) }))
    .filter((r) => r.items.length);
  return {
    topic: g.topic,
    segRows,
    others: (g.others || []).map(fav),
    othersOpen: p._expanded === 'h' + g.topic,
    expanded: p._expanded === 'h' + g.topic,
  };
}

export function renderHots(p: HotsPage): void {
  p.setData({ hots: p._hotsRaw.map((g) => hotvm(p, g)), mFavCount: p._mFavIds.length });
}

export async function loadHots(p: HotsPage, append = false): Promise<void> {
  p.setData({ loading: !append, mErr: '' });
  try {
    const d = await fetchShenlunHotspots({ offset: p._hOffset, limit: PAGE });
    const items = d.items || [];
    p._hotsRaw = append ? p._hotsRaw.concat(items) : items;
    p.setData({ hotEnd: items.length < PAGE });
    renderHots(p);
  } catch (e) {
    const msg = (e as Error).message || '网络异常';
    p.setData({ mErr: msg });
    wx.showToast({ title: '加载失败：' + msg, icon: 'none' });
  }
  p.setData({ loading: false });
}

export function onHotExpand(p: HotsPage, e: WechatMiniprogram.TouchEvent): void {
  const topic = String(e.currentTarget.dataset.topic || '');
  p._expanded = p._expanded === 'h' + topic ? 0 : 'h' + topic;
  renderHots(p);
}

export function toggleHotOthers(p: HotsPage, e: WechatMiniprogram.TouchEvent): void {
  const topic = String(e.currentTarget.dataset.topic || '');
  const g = p._hotsRaw.find((x) => x.topic === topic);
  if (!g) return;
  p._expanded = p._expanded === 'o' + topic ? 'h' + topic : 'o' + topic;
  const hots = p.data.hots.map((h) => (h.topic === topic ? { ...h, othersOpen: p._expanded === 'o' + topic } : h));
  p.setData({ hots });
}

export function onHotFav(p: HotsPage, e: WechatMiniprogram.TouchEvent): void {
  const id = Number(e.currentTarget.dataset.id);
  const all = p._hotsRaw.flatMap((g) => (['内涵', '角度', '金句'] as const).flatMap((k) => g.segs[k] || []).concat(g.others));
  const m = all.find((x) => x.id === id);
  if (!m) return;
  const i = p._mFavIds.indexOf(m.id);
  const on = i < 0;
  if (on) {
    p._mFavIds.push(m.id);
    p._mFavs.unshift(m as ShenlunMaterial);
  } else {
    p._mFavIds.splice(i, 1);
    p._mFavs = p._mFavs.filter((x) => x.id !== m.id);
  }
  wx.setStorageSync(MFAV_IDS_KEY, p._mFavIds);
  wx.setStorageSync(MFAV_SNAPS_KEY, p._mFavs);
  setShenlunMatFav(m.id, on).catch(() => {});
  renderHots(p);
}
