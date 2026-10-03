<template>
  <view class="wrap">
    <view v-if="loading" class="state" aria-busy="true">
      <kg-skeleton preset="hero" class="skel" />
      <text class="state-t">正在生成海报…</text>
    </view>
    <template v-else>
      <kg-empty-state
        v-if="zeroDay"
        icon="flame"
        title="打卡 1 天后可生成海报"
        desc="今天先去刷几题，明天就能生成第一张连续打卡海报"
        cta-text="去刷题"
        @cta="goPractice"
      />
      <image v-else-if="imgSrc" class="poster" :src="imgSrc" mode="widthFix" @longpress="save" />
      <kg-empty-state
        v-else
        icon="wifi-off"
        :title="err || '生成失败'"
        cta-text="重新生成"
        @cta="retry"
      />
      <view v-if="!zeroDay" class="bar">
        <kg-button variant="primary" size="lg" block icon="save" :disabled="!imgSrc" @click="save">保存图片</kg-button>
        <!-- #ifdef MP-WEIXIN -->
        <kg-button variant="secondary" size="lg" block open-type="share" class="share">分享给好友</kg-button>
        <!-- #endif -->
        <text class="tip">保存后可分享到朋友圈 / 小红书，和考友一起上岸</text>
      </view>
    </template>
    <!-- #ifdef MP-WEIXIN -->
    <canvas id="posterCanvas" type="2d" class="hidden-canvas" />
    <!-- #endif -->
  </view>
</template>

<script>
import qrcode from 'qrcode-generator';
import { fetchCheckinSummary, request, anonUid } from '../../api.js';
import { examPosterData } from '../../exam-poster.js';

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
  g.addColorStop(0, '#4d83a6');
  g.addColorStop(0.55, '#1e4a6b');
  g.addColorStop(1, '#17394f');
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
  ctx.fillText(d.badge ? '错题邦 · 里程碑徽章' : '错题邦 · 学习打卡', pad, 52);

  ctx.fillStyle = '#ffffff';
  if (d.badge) {
    // 标题超出安全宽度时降字号，避免贴边
    const bt = `🏅 连续打卡 ${d.badge} 天徽章`;
    ctx.font = '800 64px sans-serif';
    if (ctx.measureText(bt).width > W - pad * 2) ctx.font = '800 52px sans-serif';
    ctx.fillText(bt, pad, 106);
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

  drawQr(ctx, SITE_URL);
}

function drawQr(ctx, url) {
  const pad = 44;
  const qr = qrcode(0, 'M');
  qr.addData(url);
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

function drawExamPoster(ctx, d) {
  const g = ctx.createLinearGradient(0, 0, W * 0.7, H);
  g.addColorStop(0, '#4d83a6');
  g.addColorStop(0.55, '#1e4a6b');
  g.addColorStop(1, '#17394f');
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
  ctx.fillText('错题邦 · 模考成绩单', pad, 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 34px sans-serif';
  let title = d.title;
  while (ctx.measureText(title).width > W - pad * 2 && title.length > 4) title = title.slice(0, -2);
  if (title !== d.title) title += '…';
  ctx.fillText(title, pad, 110);

  const date = new Date();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '24px sans-serif';
  ctx.fillText(`${date.getMonth() + 1} 月 ${date.getDate()} 日 · 花生上岸`, pad, 168);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 120px sans-serif';
  ctx.fillText(String(d.score), pad, 240);
  const sw = ctx.measureText(String(d.score)).width;
  ctx.font = '600 36px sans-serif';
  ctx.fillText('分', pad + sw + 14, 318);

  const stats = [[`${d.correct}/${d.total}`, '答对题数']];
  if (d.beatenPct != null) stats.push([d.beatenPct + '%', '超过的考友']);
  roundRect(ctx, pad, 420, W - pad * 2, 128, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  const cw = (W - pad * 2) / stats.length;
  stats.forEach(([v, l], i) => {
    const cx = pad + cw * i + cw / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 40px sans-serif';
    ctx.fillText(v, cx, 446);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '20px sans-serif';
    ctx.fillText(l, cx, 502);
  });
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '22px sans-serif';
  ctx.fillText('每一次模考，都是上岸前的彩排', pad, 588);

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '24px sans-serif';
  ctx.fillText(d.kind === 'zhenti' && d.paperId ? '扫码同卷模考' : '扫码一起刷题', pad, H - 190);
  ctx.fillText('和我比一比 →', pad, H - 152);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '20px sans-serif';
  ctx.fillText('kaogong.zalize.com', pad, H - 108);
  drawQr(ctx, d.qrUrl);
}

export default {
  data() {
    return { loading: true, imgSrc: '', err: '', tmpPath: '', badge: 0, mode: '', attemptId: 0, streak: null };
  },
  onLoad(query) {
    this.badge = Number(query && query.badge) || 0;
    this.mode = (query && query.mode) || '';
    this.attemptId = Number(query && query.attempt_id) || 0;
    this.build();
  },
  // #ifdef MP-WEIXIN
  onShareAppMessage() {
    return { title: '我在错题邦打卡刷题，一起上岸！', path: '/pages/practice/practice' };
  },
  // #endif
  computed: {
    /** 打卡海报：连签 0 天没有可展示的成绩，禁止保存（PAGES §3.3）；模考成绩单不受此限 */
    zeroDay() {
      return this.mode !== 'exam' && !this.badge && this.streak != null && Number(this.streak) <= 0;
    },
  },
  methods: {
    makeQuote(d) {
      if (d.badge) return `“解锁「连续打卡 ${d.badge} 天」徽章，坚持正在变成实力。”`;
      if (d.today_rate != null && d.today_rate >= 80) return `“今日正确率 ${d.today_rate}%，手感在线，保持住这个节奏。”`;
      if (d.streak >= 7) return `“连续 ${d.streak} 天没断过，习惯正在变成实力。”`;
      if (d.today_n >= 50) return `“一天 ${d.today_n} 题，量变正在悄悄积累成质变。”`;
      return '“慢一点没关系，别停下来，上岸的人都是这么过来的。”';
    },
    goPractice() {
      uni.switchTab({ url: '/pages/home/home' });
    },
    retry() {
      this.loading = true;
      this.err = '';
      this.build();
    },
    async build() {
      let d;
      let draw = drawPoster;
      if (this.mode === 'exam') {
        draw = drawExamPoster;
        try {
          const uid = encodeURIComponent(anonUid());
          const report = await request('/api/exam/report/' + this.attemptId + '?uid=' + uid);
          const rank = await request('/api/exam/rank/' + this.attemptId + '?uid=' + uid).catch(() => null);
          d = examPosterData(report, rank);
          if (!d) throw new Error('成绩数据不完整');
        } catch (e) {
          this.err = /timeout|超时|网络/i.test(String(e && e.message)) ? '网络不给力，成绩数据没取到' : e.message;
          this.loading = false;
          return;
        }
      } else {
        try {
          d = await fetchCheckinSummary();
        } catch (e) {
          this.err = /timeout|超时|网络/i.test(String(e && e.message)) ? '网络不给力，打卡数据没取到' : e.message;
          this.loading = false;
          return;
        }
        this.streak = Number(d.streak) || 0;
        d.badge = this.badge;
        d.quote = this.makeQuote(d);
      }
      try {
        // #ifdef H5
        const dpr = Math.min(window.devicePixelRatio || 2, 3);
        const canvas = document.createElement('canvas');
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        draw(ctx, d);
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
        draw(ctx, d);
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
      if (!this.imgSrc || this.zeroDay) return;
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
.wrap { padding: var(--sp-16) var(--page-x) var(--sp-48); display: flex; flex-direction: column; align-items: center; min-height: 100vh; box-sizing: border-box; }
.state { width: 100%; max-width: 320px; display: flex; flex-direction: column; align-items: center; gap: var(--sp-16); padding: var(--sp-24) 0; }
.skel { width: 100%; }
.state-t { color: var(--ink-3); font-size: var(--fs-sub); }
.poster { width: 100%; max-width: 320px; border-radius: var(--r-lg); box-shadow: var(--sh-2); }
.bar { width: 100%; max-width: 320px; margin-top: var(--sp-24); display: flex; flex-direction: column; gap: var(--sp-12); }
.tip { text-align: center; font-size: var(--fs-caption); color: var(--ink-3); line-height: var(--lh-caption); }
.hidden-canvas { position: fixed; left: -9999px; top: 0; width: 660px; height: 900px; }

/* T5 工具页：任何断点都单列（≤480） */
/* #ifdef H5 */
@media (min-width: 700px) {
  .wrap { max-width: 480px !important; }
}
/* #endif */
</style>
