<template>
  <view class="wrap">
    <view v-if="loading" class="loading">正在生成海报…</view>
    <template v-else>
      <image v-if="imgSrc" class="poster" :src="imgSrc" mode="widthFix" @longpress="save" />
      <view v-else class="loading">{{ err || '生成失败' }}</view>
      <view class="bar">
        <button class="btn" :disabled="!imgSrc" @click="save">保存图片</button>
        <!-- #ifdef MP-WEIXIN -->
        <button class="btn ghost" open-type="share">分享给好友</button>
        <!-- #endif -->
        <view class="tip">保存后可分享到朋友圈 / 小红书，和考友一起上岸</view>
      </view>
    </template>
    <!-- #ifdef MP-WEIXIN -->
    <canvas id="posterCanvas" type="2d" class="hidden-canvas" />
    <!-- #endif -->
  </view>
</template>

<script>
import qrcode from 'qrcode-generator';
import { fetchCheckinSummary } from '../../api.js';

const SITE_URL = 'https://kaogong.zalize.com';
const W = 660;
const H = 900;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPoster(ctx, d) {
  // 背景渐变
  const g = ctx.createLinearGradient(0, 0, W * 0.7, H);
  g.addColorStop(0, '#5B8AF8');
  g.addColorStop(0.55, '#3B6FF5');
  g.addColorStop(1, '#2C5AD6');
  roundRect(ctx, 0, 0, W, H, 36);
  ctx.fillStyle = g;
  ctx.fill();
  // 装饰圆
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
  ctx.fillText('考公错题助手 · 学习打卡', pad, 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 76px sans-serif';
  ctx.fillText(`连续打卡 第 ${d.streak} 天`, pad, 100);

  const date = new Date();
  let sub = `${date.getMonth() + 1} 月 ${date.getDate()} 日 · 花生上岸`;
  if (d.days_to_exam != null) sub += ` · 距${d.exam_type || '考试'}还有 ${d.days_to_exam} 天`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '24px sans-serif';
  ctx.fillText(sub, pad, 200);

  // 鼓励语卡
  const quote = d.quote;
  roundRect(ctx, pad, 258, W - pad * 2, 110, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '26px sans-serif';
  const maxW = W - pad * 2 - 48;
  let line = '';
  let y = 285;
  for (const ch of quote) {
    if (ctx.measureText(line + ch).width > maxW) {
      ctx.fillText(line, pad + 24, y);
      line = ch;
      y += 40;
      if (y > 340) break;
    } else line += ch;
  }
  if (line && y <= 340) ctx.fillText(line, pad + 24, y);

  // 数据栏
  const stats = [
    [String(d.today_n), '今日刷题'],
    [d.today_rate != null ? d.today_rate + '%' : '—', '正确率'],
    [String(d.cleared_today), '错题清零'],
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

  // 打卡日历点缀：最近 14 天连续感（简单点阵）
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '22px sans-serif';
  ctx.fillText('每天进步一点点，上岸就近一点点', pad, 580);

  // 底部：引导 + 二维码
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '24px sans-serif';
  ctx.fillText('扫码和我一起', pad, H - 190);
  ctx.fillText('AI 刷题上岸 →', pad, H - 152);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '20px sans-serif';
  ctx.fillText('kaogong.zalize.com', pad, H - 108);

  // 二维码
  const qr = qrcode(0, 'M');
  qr.addData(SITE_URL);
  qr.make();
  const n = qr.getModuleCount();
  const qsize = 170;
  const qx = W - pad - qsize;
  const qy = H - 60 - qsize;
  roundRect(ctx, qx - 12, qy - 12, qsize + 24, qsize + 24, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const cell = qsize / n;
  ctx.fillStyle = '#1f2430';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(qx + c * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}

export default {
  data() {
    return { loading: true, imgSrc: '', err: '', tmpPath: '' };
  },
  onLoad() {
    this.build();
  },
  // #ifdef MP-WEIXIN
  onShareAppMessage() {
    return { title: '我在考公错题助手打卡刷题，一起上岸！', path: '/pages/practice/practice' };
  },
  // #endif
  methods: {
    makeQuote(d) {
      if (d.today_rate != null && d.today_rate >= 80) return `“今日正确率 ${d.today_rate}%，手感在线，保持住这个节奏。”`;
      if (d.streak >= 7) return `“连续 ${d.streak} 天没断过，习惯正在变成实力。”`;
      if (d.today_n >= 50) return `“一天 ${d.today_n} 题，量变正在悄悄积累成质变。”`;
      return '“慢一点没关系，别停下来，上岸的人都是这么过来的。”';
    },
    async build() {
      let d;
      try {
        d = await fetchCheckinSummary();
      } catch (e) {
        this.err = e.message;
        this.loading = false;
        return;
      }
      d.quote = this.makeQuote(d);
      try {
        // #ifdef H5
        const dpr = Math.min(window.devicePixelRatio || 2, 3);
        const canvas = document.createElement('canvas');
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        drawPoster(ctx, d);
        this.imgSrc = canvas.toDataURL('image/png');
        // #endif
        // #ifdef MP-WEIXIN
        const node = await new Promise((resolve, reject) => {
          uni.createSelectorQuery()
            .in(this)
            .select('#posterCanvas')
            .fields({ node: true, size: true })
            .exec((res) => (res && res[0] && res[0].node ? resolve(res[0].node) : reject(new Error('canvas 不可用'))));
        });
        const dpr = uni.getSystemInfoSync().pixelRatio || 2;
        node.width = W * dpr;
        node.height = H * dpr;
        const ctx = node.getContext('2d');
        ctx.scale(dpr, dpr);
        drawPoster(ctx, d);
        const tmp = await new Promise((resolve, reject) => {
          uni.canvasToTempFilePath({
            canvas: node,
            success: (r) => resolve(r.tempFilePath),
            fail: (e) => reject(new Error(e.errMsg || '导出失败')),
          }, this);
        });
        this.tmpPath = tmp;
        this.imgSrc = tmp;
        // #endif
        // #ifndef H5 || MP-WEIXIN
        this.err = '当前端暂不支持生成海报';
        // #endif
      } catch (e) {
        this.err = e.message;
      }
      this.loading = false;
    },
    save() {
      if (!this.imgSrc) return;
      // #ifdef H5
      const a = document.createElement('a');
      a.href = this.imgSrc;
      a.download = 'kaogong-checkin-' + new Date().toISOString().slice(0, 10) + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      uni.showToast({ title: '已保存图片', icon: 'none' });
      // #endif
      // #ifdef MP-WEIXIN
      uni.saveImageToPhotosAlbum({
        filePath: this.tmpPath,
        success: () => uni.showToast({ title: '已保存到相册', icon: 'none' }),
        fail: (e) => {
          if (String(e.errMsg).includes('auth')) {
            uni.showModal({
              title: '需要相册权限',
              content: '请在设置中允许保存图片到相册',
              success: (r) => r.confirm && uni.openSetting(),
            });
          } else uni.showToast({ title: '保存失败', icon: 'none' });
        },
      });
      // #endif
    },
  },
};
</script>

<style scoped>
.wrap { padding: 32rpx; display: flex; flex-direction: column; align-items: center; min-height: 100vh; background: #eceef3; box-sizing: border-box; }
.loading { color: var(--ink-3, #8f959e); font-size: 26rpx; padding: 120rpx 0; }
.poster { width: 640rpx; border-radius: 32rpx; box-shadow: 0 16rpx 48rpx rgba(44, 90, 214, 0.35); }
.bar { width: 100%; margin-top: 32rpx; }
.btn { background: #3b6ff5; color: #fff; font-size: 28rpx; border-radius: 18rpx; }
.btn.ghost { background: #fff; color: #3b6ff5; border: 1rpx solid #3b6ff5; margin-top: 16rpx; }
.tip { text-align: center; font-size: 22rpx; color: var(--ink-3, #8f959e); margin-top: 18rpx; }
.hidden-canvas { position: fixed; left: -9999rpx; top: 0; width: 660px; height: 900px; }
</style>
