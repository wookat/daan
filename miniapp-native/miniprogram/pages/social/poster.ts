import { fetchCheckinSummary } from '../../api/index';
import type { CheckinSummaryResp } from '../../api/types';

const W = 660;
const H = 900;

interface PosterData extends CheckinSummaryResp {
  badge: number;
  quote: string;
}

// 小程序 canvas 2d 上下文（tsconfig 未引入 DOM lib，这里声明用到的子集）
interface Ctx2D {
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
  createLinearGradient(
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): { addColorStop(offset: number, color: string): void };
}

function roundRect(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeQuote(d: PosterData): string {
  if (d.badge) return `“解锁「连续打卡 ${d.badge} 天」徽章，坚持正在变成实力。”`;
  if (d.today_rate != null && d.today_rate >= 80)
    return `“今日正确率 ${d.today_rate}%，手感在线，保持住这个节奏。”`;
  if (d.streak >= 7) return `“连续 ${d.streak} 天没断过，习惯正在变成实力。”`;
  if (d.today_n >= 50) return `“一天 ${d.today_n} 题，量变正在悄悄积累成质变。”`;
  return '“慢一点没关系，别停下来，上岸的人都是这么过来的。”';
}

// 对照 frontend-uni/src/pkgA/social/poster.vue 的画布绘制（QR 码以站点文字替代，避免引入新依赖）
function drawPoster(ctx: Ctx2D, d: PosterData): void {
  const g = ctx.createLinearGradient(0, 0, W * 0.7, H);
  g.addColorStop(0, '#5c82ff');
  g.addColorStop(0.52, '#2e5bff');
  g.addColorStop(1, '#1e44d9');
  roundRect(ctx, 0, 0, W, H, 36);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 36);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(W - 20, 40, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(60, H - 60, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const pad = 44;
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '24px sans-serif';
  ctx.fillText(d.badge ? '岸上见 · 里程碑徽章' : '岸上见 · 学习打卡', pad, 52);

  ctx.fillStyle = '#ffffff';
  if (d.badge) {
    ctx.font = '800 64px sans-serif';
    ctx.fillText(`🏅 连续打卡 ${d.badge} 天徽章`, pad, 106);
  } else {
    ctx.font = '800 76px sans-serif';
    ctx.fillText(`连续打卡 第 ${d.streak} 天`, pad, 100);
  }

  const date = new Date();
  let sub = `${date.getMonth() + 1} 月 ${date.getDate()} 日 · 花生上岸`;
  if (d.days_to_exam != null) sub += ` · 距${d.exam_type || '考试'}还有 ${d.days_to_exam} 天`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '24px sans-serif';
  ctx.fillText(sub, pad, 200);

  // 鼓励语卡
  roundRect(ctx, pad, 258, W - pad * 2, 110, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '26px sans-serif';
  const maxW = W - pad * 2 - 48;
  let line = '';
  let y = 285;
  for (const ch of d.quote) {
    if (ctx.measureText(line + ch).width > maxW) {
      ctx.fillText(line, pad + 24, y);
      line = ch;
      y += 40;
      if (y > 340) break;
    } else line += ch;
  }
  if (line && y <= 340) ctx.fillText(line, pad + 24, y);

  // 数据栏
  const stats: Array<[string, string]> = [
    [String(d.today_n), '今日刷题'],
    [d.today_rate != null ? d.today_rate + '%' : '—', '正确率'],
    [String(d.cleared_today || 0), '错题清零'],
    [d.total >= 1000 ? (d.total / 1000).toFixed(1) + 'k' : String(d.total), '累计题量'],
  ];
  roundRect(ctx, pad, 402, W - pad * 2, 128, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  const cw = (W - pad * 2) / 4;
  stats.forEach(([v, l], i) => {
    const cx = pad + cw * i + cw / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 40px sans-serif';
    ctx.fillText(v, cx, 428);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '20px sans-serif';
    ctx.fillText(l, cx, 484);
  });
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '22px sans-serif';
  ctx.fillText('每天进步一点点，上岸就近一点点', pad, 580);

  // 底部：引导 + 站点
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '24px sans-serif';
  ctx.fillText('搜一搜「岸上见」', pad, H - 190);
  ctx.fillText('AI 刷题上岸 →', pad, H - 152);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '20px sans-serif';
  ctx.fillText('kaogong.zalize.com', pad, H - 108);
}

Page({
  data: {
    loading: true,
    imgSrc: '',
    err: '',
    streak0: false,
  },
  _badge: 0,
  _tmpPath: '',

  onLoad(query: Record<string, string>) {
    this._badge = Number(query && query.badge) || 0;
    this.build();
  },

  async build() {
    let d: PosterData;
    try {
      const s = await fetchCheckinSummary();
      d = { ...s, badge: this._badge, quote: '' };
      d.quote = makeQuote(d);
      this.setData({ streak0: !d.streak });
    } catch (e) {
      this.setData({ loading: false, err: (e as Error).message || '加载失败' });
      return;
    }
    try {
      const node = await new Promise<WechatMiniprogram.Canvas>((resolve, reject) => {
        wx.createSelectorQuery()
          .select('#posterCanvas')
          .fields({ node: true, size: true })
          .exec((res) =>
            res && res[0] && res[0].node
              ? resolve(res[0].node as WechatMiniprogram.Canvas)
              : reject(new Error('canvas 不可用'))
          );
      });
      const dpr = wx.getWindowInfo().pixelRatio || 2;
      node.width = W * dpr;
      node.height = H * dpr;
      const ctx = node.getContext('2d') as unknown as Ctx2D;
      ctx.scale(dpr, dpr);
      drawPoster(ctx, d);
      const tmp = await new Promise<string>((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas: node,
          success: (r) => resolve(r.tempFilePath),
          fail: (e) => reject(new Error(e.errMsg || '导出失败')),
        });
      });
      this._tmpPath = tmp;
      this.setData({ imgSrc: tmp });
    } catch (e) {
      this.setData({ err: (e as Error).message || '生成失败' });
    }
    this.setData({ loading: false });
  },

  onSave() {
    if (!this._tmpPath) return;
    wx.saveImageToPhotosAlbum({
      filePath: this._tmpPath,
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
  },

  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    return { title: '我在岸上见打卡刷题，一起上岸！', path: '/pages/home/home' };
  },
});
