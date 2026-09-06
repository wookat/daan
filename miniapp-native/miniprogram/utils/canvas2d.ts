// 小程序 canvas 2d 通用工具：获取节点、按 dpr 缩放、导出临时图片、保存相册（供分享图/海报类页面复用）

// tsconfig 未引入 DOM lib，这里声明用到的子集
export interface Ctx2D {
  fillStyle: string | unknown;
  font: string;
  textBaseline: string;
  textAlign: string;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  arc(x: number, y: number, r: number, s: number, e: number): void;
  fill(): void;
  save(): void;
  restore(): void;
  clip(): void;
  scale(x: number, y: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(offset: number, color: string): void };
}

export function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 取页面内 `<canvas type="2d" id=...>` 节点，按 dpr 设置物理尺寸并返回已 scale 的上下文 */
export async function canvas2d(
  selector: string,
  w: number,
  h: number,
  scope?: WechatMiniprogram.Component.TrivialInstance | WechatMiniprogram.Page.TrivialInstance
): Promise<{ node: WechatMiniprogram.Canvas; ctx: Ctx2D }> {
  const node = await new Promise<WechatMiniprogram.Canvas>((resolve, reject) => {
    const q = scope ? wx.createSelectorQuery().in(scope) : wx.createSelectorQuery();
    q.select(selector)
      .fields({ node: true, size: true })
      .exec((res) =>
        res && res[0] && res[0].node ? resolve(res[0].node as WechatMiniprogram.Canvas) : reject(new Error('canvas 不可用'))
      );
  });
  const dpr = wx.getWindowInfo().pixelRatio || 2;
  node.width = w * dpr;
  node.height = h * dpr;
  const ctx = node.getContext('2d') as unknown as Ctx2D;
  ctx.scale(dpr, dpr);
  return { node, ctx };
}

export function canvasToTemp(node: WechatMiniprogram.Canvas): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas: node,
      success: (r) => resolve(r.tempFilePath),
      fail: (e) => reject(new Error(e.errMsg || '导出失败')),
    });
  });
}

/** 保存到相册；被拒授权时引导去设置页 */
export function saveToAlbum(filePath: string): void {
  wx.saveImageToPhotosAlbum({
    filePath,
    success: () => wx.showToast({ title: '已保存到相册', icon: 'none' }),
    fail: (e) => {
      if (String(e.errMsg).includes('auth')) {
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存图片到相册',
          success: (r) => {
            if (r.confirm) wx.openSetting();
          },
        });
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    },
  });
}
