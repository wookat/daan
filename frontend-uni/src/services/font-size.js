// 字号三档（小/标准/大）——题干与选项/解析字号，做题/做卷/复习共用口径。
// 统一输出 px（对应 375px 基准下的 26/30/34 与 24/28/32 rpx），避免 iPad 768–959px 下 rpx 线性放大 2× 撑爆题面与遮挡选项。
const Q_SIZES = [13, 15, 17];
const OPT_SIZES = [12, 14, 16];

export function normFontLv(lv) {
  return lv === 0 || lv === 1 || lv === 2 ? lv : 1;
}

export function fontSizes(lv) {
  const n = normFontLv(lv);
  return { q: Q_SIZES[n] + 'px', opt: OPT_SIZES[n] + 'px' };
}
