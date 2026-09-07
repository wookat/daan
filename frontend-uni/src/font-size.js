// 字号三档（小/标准/大）——题干与选项/解析字号，做题/做卷/复习共用口径
const Q_SIZES = [26, 30, 34];
const OPT_SIZES = [24, 28, 32];

export function normFontLv(lv) {
  return lv === 0 || lv === 1 || lv === 2 ? lv : 1;
}

export function fontSizes(lv) {
  const n = normFontLv(lv);
  return { q: Q_SIZES[n] + 'rpx', opt: OPT_SIZES[n] + 'rpx' };
}
