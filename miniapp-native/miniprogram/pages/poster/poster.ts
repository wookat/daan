import { fetchCheckinSummary } from '../../api/index';
import type { CheckinSummary } from '../../api/types';

// tsconfig 未引 DOM lib，声明用到的 2d 上下文子集
interface Canvas2D {
  scale(x: number, y: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, s: number, e: number): void;
  closePath(): void;
  stroke(): void;
  fill(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): {
    addColorStop(offset: number, color: string): void;
  };
  strokeStyle: string;
  fillStyle: string | { addColorStop(offset: number, color: string): void };
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

const W = 320;
const H = 480;

function roundRect(ctx: Canvas2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, (Math.PI * 3) / 2);
  ctx.closePath();
}

Page({
  data: {
    loading: true,
    err: '',
    saving: false,
  },
  _canvas: null as WechatMiniprogram.Canvas | null,

  onReady() {
    this.load();
  },

  async load() {
    let c: CheckinSummary;
    try {
      c = await fetchCheckinSummary();
    } catch (e) {
      this.setData({ loading: false, err: (e as Error).message });
      return;
    }
    const query = this.createSelectorQuery();
    query
      .select('#poster')
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node) {
          this.setData({ loading: false, err: '画布初始化失败' });
          return;
        }
        const canvas = info.node as WechatMiniprogram.Canvas;
        this._canvas = canvas;
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d') as Canvas2D;
        ctx.scale(dpr, dpr);
        this.draw(ctx, c);
        this.setData({ loading: false });
      });
  },

  draw(ctx: Canvas2D, c: CheckinSummary) {
    // 背景渐变
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#3b6ff5');
    bg.addColorStop(1, '#6c9bff');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '15px sans-serif';
    const now = new Date();
    ctx.fillText(
      `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`,
      W / 2,
      44
    );

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('今日打卡成功', W / 2, 80);

    // 白色内容卡
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 24, 110, W - 48, 250, 16);
    ctx.fill();

    ctx.fillStyle = '#3b6ff5';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(String(c.streak), W / 2, 175);
    ctx.fillStyle = '#40434e';
    ctx.font = '15px sans-serif';
    ctx.fillText('连续打卡天数', W / 2, 212);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#7d818f';
    const rate = c.today_rate != null ? ` · 正确率 ${c.today_rate}%` : '';
    ctx.fillText(`今日刷题 ${c.today_n} 道${rate}`, W / 2, 250);
    ctx.fillText(`清空错题 ${c.cleared_today} 道 · 累计 ${c.total} 题`, W / 2, 275);
    if (c.days_to_exam != null) {
      ctx.fillStyle = '#d97706';
      ctx.fillText(`距离${c.exam_type || '考试'}还有 ${c.days_to_exam} 天`, W / 2, 305);
    }
    ctx.fillStyle = '#b0b4c0';
    ctx.font = '12px sans-serif';
    ctx.fillText('坚持的人，运气不会太差', W / 2, 338);

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('考公刷题助手', W / 2, 400);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px sans-serif';
    ctx.fillText('每天进步一点点，上岸更近一步', W / 2, 424);
  },

  async onSave() {
    if (!this._canvas || this.data.saving) return;
    this.setData({ saving: true });
    try {
      const { tempFilePath } = await wx.canvasToTempFilePath({
        canvas: this._canvas,
      });
      await wx.saveImageToPhotosAlbum({ filePath: tempFilePath });
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (e) {
      const msg = (e as { errMsg?: string }).errMsg || '';
      if (msg.includes('auth')) {
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存到相册后重试',
          confirmText: '去设置',
          success: (r) => {
            if (r.confirm) wx.openSetting({});
          },
        });
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    }
    this.setData({ saving: false });
  },

  onShareAppMessage() {
    return {
      title: '我在考公刷题助手打卡啦，一起上岸！',
      path: '/pages/home/home',
    };
  },
});
