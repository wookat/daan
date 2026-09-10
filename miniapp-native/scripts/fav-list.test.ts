// R575：小程序收藏页取消收藏先本地收缩（与 H5 frontend-uni/src/fav-list.js 同口径）。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { describe, expect, it } from 'vitest';
import { dropFavItem } from '../miniprogram/utils/fav-list';

describe('dropFavItem', () => {
  const folders = () => [
    { id: 0, n: 3 },
    { id: 7, n: 1 },
  ];
  const cloud = { id: 11, folder_id: 7 };
  const local = { id: null, _lkey: 'L0', folder_id: 0 };

  it('云条目按身份删除并减所属夹计数', () => {
    const r = dropFavItem([cloud, local], folders(), cloud);
    expect(r.items).toEqual([local]);
    expect(r.folders).toEqual([
      { id: 0, n: 3 },
      { id: 7, n: 0 },
    ]);
  });

  it('本机条目按 _lkey 匹配归默认夹；未命中原样返回；计数不为负', () => {
    const r = dropFavItem([cloud, local], folders(), { id: null, _lkey: 'L0' });
    expect(r.items).toEqual([cloud]);
    expect(r.folders[0].n).toBe(2);
    expect(dropFavItem([cloud], folders(), { id: 999 }).items).toEqual([cloud]);
    expect(dropFavItem([cloud], [{ id: 7, n: 0 }], cloud).folders).toEqual([{ id: 7, n: 0 }]);
  });
});
