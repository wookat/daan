function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch (e) {
    return fallback;
  }
}

// 供 option 工厂复用的 VIS 调色板（独立出 kg-echart，避免首页引入 predict-card 时提前拉入 ECharts）
export function visColors() {
  return {
    brand: cssVar('--brand', '#2e5bff'),
    brandSoft2: cssVar('--brand-soft-2', '#dbe6ff'),
    ink: cssVar('--ink', '#17181c'),
    ink2: cssVar('--ink-2', '#40434e'),
    ink3: cssVar('--ink-3', '#6b7280'),
    line: cssVar('--line', '#e7e9f0'),
    fill: cssVar('--fill', '#f2f3f7'),
    card: cssVar('--card', '#ffffff'),
    ok: cssVar('--ok', '#16a34a'),
    warn: cssVar('--warn', '#d97706'),
    bad: cssVar('--bad', '#dc2626'),
    lvUntouched: cssVar('--lv-untouched', '#b0b4c0'),
    lvRumen: cssVar('--lv-rumen', '#d97706'),
    lvGonggu: cssVar('--lv-gonggu', '#2e5bff'),
    lvShulian: cssVar('--lv-shulian', '#7c3aed'),
    lvJingtong: cssVar('--lv-jingtong', '#16a34a'),
  };
}
