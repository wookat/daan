// 收藏页模块筛选项按本人已加载的收藏数据给出（对齐 frontend-uni/src/fav-module-opts.js）：只列有收藏的模块
// （按 keys 既定顺序），深链带入的合法 modFilter 即便当前 0 条也保留（否则 chip 行没有它的高亮、用户无从切回「全部模块」）。
// 只剩「全部模块」+ 1 个模块且筛选没有排除任何收藏时，行整体隐藏（visible=false）。

export interface ModOpt {
  label: string;
  value: string;
}

export interface FavModulePlan {
  opts: ModOpt[];
  visible: boolean;
}

export function favModulePlan(
  items: ReadonlyArray<{ module?: string | null }>,
  modFilter: string,
  keys: readonly string[],
  label: (k: string) => string,
): FavModulePlan {
  const present = new Set<string>();
  for (const it of items) {
    if (it && it.module) present.add(it.module);
  }
  const opts: ModOpt[] = [{ label: '全部模块', value: '' }];
  for (const k of keys) {
    if (present.has(k) || k === modFilter) opts.push({ label: label(k), value: k });
  }
  const visible = opts.length > 2 || (!!modFilter && !present.has(modFilter));
  return { opts, visible };
}
