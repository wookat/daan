// 离线题包（与 frontend-uni/src/offline.js 的题包部分同口径）
// 作答/错题离线队列仍走 utils/offline.ts，本文件只管题包下载 / 索引 / 抽题 / 容量守卫。
import { drawQuestions } from '../api/learn';
import type { Question } from '../api/types';

export const PACK_SIZE = 20; // 小程序 storage 10MB 上限，每包 20 题（H5 的 MP 分支同值）
export const PACK_MODULES = [
  { module: 'ziliao', name: '资料分析' },
  { module: 'shuliang', name: '数量关系' },
  { module: 'yanyu', name: '言语理解' },
  { module: 'panduan', name: '判断推理' },
  { module: 'changshi', name: '常识判断' },
];
// 微信小程序单用户 storage 上限 10MB；写题包前预估超限即拒绝
export const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024;

const IDX_KEY = 'offlinePacks';
const packKey = (module: string) => 'offlinePack:' + module;

export interface PackIndexItem {
  module: string;
  count: number;
  ts: number;
  size: number;
}
export interface OfflinePack {
  module: string;
  ts: number;
  items: Question[];
}

export function listPacks(): PackIndexItem[] {
  const v = wx.getStorageSync<PackIndexItem[] | ''>(IDX_KEY);
  return Array.isArray(v) ? v : [];
}

export function getPack(module: string): OfflinePack | null {
  const v = wx.getStorageSync<OfflinePack | ''>(packKey(module));
  return v && Array.isArray(v.items) ? v : null;
}

export function packUsageBytes(): number {
  return listPacks().reduce((a, p) => a + (p.size || 0), 0);
}

// 全局 storage 已用字节（wx.getStorageInfoSync 单位 KB）
export function storageUsedBytes(): number {
  try {
    return (wx.getStorageInfoSync().currentSize || 0) * 1024;
  } catch (e) {
    return packUsageBytes();
  }
}

export class StorageLimitError extends Error {
  constructor(need: number) {
    super('存储空间不足：本包约 ' + fmtBytes(need) + '，小程序本地上限 10MB，请先删除其他题包');
    this.name = 'StorageLimitError';
  }
}

export function fmtBytes(b: number): string {
  return b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
}

export async function downloadPack(module: string): Promise<OfflinePack> {
  const d = await drawQuestions({ limit: PACK_SIZE, module });
  const items = (d.items || []).filter((q) => q.question && q.options && q.answer);
  if (!items.length) throw new Error('该模块暂无题目');
  const pack: OfflinePack = { module, ts: Date.now(), items };
  const raw = JSON.stringify(pack);
  const size = raw.length;
  const prev = listPacks().find((p) => p.module === module);
  // 覆盖同模块旧包时先扣掉旧包体积
  const projected = storageUsedBytes() - (prev ? prev.size : 0) + size;
  if (projected > STORAGE_LIMIT_BYTES) throw new StorageLimitError(size);
  wx.setStorageSync(packKey(module), pack);
  const idx = listPacks().filter((p) => p.module !== module);
  idx.push({ module, count: items.length, ts: pack.ts, size });
  wx.setStorageSync(IDX_KEY, idx);
  return pack;
}

export function removePack(module: string): void {
  wx.removeStorageSync(packKey(module));
  wx.setStorageSync(IDX_KEY, listPacks().filter((p) => p.module !== module));
}

// 无网启动练习：从题包随机抽一组
export function drawOffline(module: string, count: number): Question[] | null {
  const pack = getPack(module);
  if (!pack || !pack.items.length) return null;
  const arr = pack.items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count || 10, arr.length));
}
