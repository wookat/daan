<template>
  <view class="wrap">
    <view v-if="loading" class="spin">周报生成中…</view>

    <!-- 空状态 -->
    <template v-else-if="empty">
      <view class="card empty">
        <text class="empty-t">上周没有学习记录</text>
        <text class="empty-s">{{ range }}</text>
        <text class="empty-s">本周刷起来，下周一就能看到你的专属周报</text>
        <view class="cta" @click="goPractice()">去刷题 ›</view>
      </view>
    </template>

    <!-- 未结束周 -->
    <template v-else-if="pending">
      <view class="card empty">
        <text class="empty-t">该周尚未结束</text>
        <text class="empty-s">{{ range }}</text>
        <text class="empty-s">周报会在下周一自动生成，先看看上一周的吧</text>
        <view class="cta" @click="goPrevWeek()">查看上一周周报 ›</view>
      </view>
    </template>

    <!-- 加载失败 -->
    <template v-else-if="error">
      <view class="card empty">
        <text class="empty-t">加载失败</text>
        <text class="empty-s">{{ error }}</text>
        <view class="cta" @click="reload()">重试 ›</view>
      </view>
    </template>

    <template v-else-if="r">
      <view class="wr-cols">
      <view class="wr-side">
      <!-- 1. 头部概览 -->
      <view class="card hero">
        <text class="hero-range">{{ r.range }}</text>
        <view class="hero-nums">
          <view class="hn"><text class="hn-v">{{ r.summary.days }}</text><text class="hn-k">学习天数</text></view>
          <view class="hn"><text class="hn-v">{{ r.summary.n }}</text><text class="hn-k">刷题量</text></view>
          <view class="hn"><text class="hn-v">{{ pct(r.summary.acc) }}%</text><text class="hn-k">正确率</text></view>
          <view class="hn">
            <text class="hn-v">{{ trendIcon }}</text>
            <text class="hn-k">较上周</text>
          </view>
        </view>
      </view>

      <!-- 2. 徽章 -->
      <view v-if="r.badges.length" class="badges">
        <view v-for="b in r.badges" :key="b.key" class="badge">
          <text class="badge-t">{{ b.title }}</text>
          <text class="badge-s">{{ b.desc }}</text>
        </view>
      </view>

      <!-- 3. 本周 vs 上周 -->
      <view class="card">
        <view class="h">本周 vs 上周</view>
        <view class="cmp-row"><text class="cmp-k">刷题量</text><text class="cmp-v">{{ r.compare.n[0] }} 题</text><text class="cmp-p">上周 {{ r.compare.n[1] }}</text></view>
        <view class="cmp-row"><text class="cmp-k">正确率</text><text class="cmp-v">{{ pct(r.compare.acc[0]) }}%</text><text class="cmp-p">上周 {{ pct(r.compare.acc[1]) }}%</text></view>
        <view class="cmp-row"><text class="cmp-k">学习时长</text><text class="cmp-v">{{ mins(r.compare.secs[0]) }}</text><text class="cmp-p">上周 {{ mins(r.compare.secs[1]) }}</text></view>
        <view class="cmp-row"><text class="cmp-k">学习天数</text><text class="cmp-v">{{ r.compare.days[0] }} 天</text><text class="cmp-p">上周 {{ r.compare.days[1] }} 天</text></view>
      </view>
      </view>

      <view class="wr-main">

      <!-- 4. 掌握度变化 -->
      <view v-if="r.mastery.up.length || r.mastery.down.length" class="card">
        <view class="h">考点掌握变化</view>
        <view v-for="m in r.mastery.up" :key="'u' + m.submodule" class="ms-row">
          <text class="ms-tag up">↑</text>
          <text class="ms-t">{{ m.submodule }}</text>
          <text class="ms-v">{{ pct(m.prev_acc) }}% → {{ pct(m.acc) }}%</text>
        </view>
        <view v-for="m in r.mastery.down" :key="'d' + m.submodule" class="ms-row">
          <text class="ms-tag down">↓</text>
          <text class="ms-t">{{ m.submodule }}</text>
          <text class="ms-v">{{ pct(m.prev_acc) }}% → {{ pct(m.acc) }}%</text>
        </view>
      </view>

      <!-- 5. 错因分布 -->
      <view v-if="r.reasons.length" class="card">
        <view class="h">本周错因分布</view>
        <view v-for="x in r.reasons" :key="x.reason" class="rs-row">
          <text class="rs-k">{{ x.reason }}</text>
          <view class="rs-bar"><view class="rs-fill" :style="{ width: reasonPct(x.n) + '%' }" /></view>
          <text class="rs-v">{{ x.n }}<text class="rs-p">（上周 {{ x.prev_n }}）</text></text>
        </view>
      </view>

      <!-- 6. 模考回顾 -->
      <view class="card">
        <view class="h">模考回顾</view>
        <template v-if="r.mock">
          <view class="mk-line">
            <text>本周模考最高 <text class="mk-n">{{ r.mock.score }}</text> 分（共 {{ r.mock.n_exams }} 次）</text>
          </view>
          <view v-if="r.mock.event_title" class="mk-line sub">
            <text>{{ r.mock.event_title }}：<template v-if="r.mock.rank">第 {{ r.mock.rank }} 名 · </template>击败 {{ r.mock.pct }}%</text>
          </view>
          <view class="link" @click="openAttempt(r.mock.attempt_id)">查看成绩报告 ›</view>
        </template>
        <template v-else>
          <text class="mk-none">本周未模考</text>
          <view v-if="nextEvent" class="link" @click="goContest">下一场：{{ nextEvent.title }} · {{ fmtDay(nextEvent.open_at) }} ›</view>
        </template>
      </view>

      <!-- 7. 下周行动 -->
      <view v-if="r.actions.length" class="card">
        <view class="h">下周行动</view>
        <view v-for="(a, i) in r.actions" :key="i" class="act-row" @click="goAction(a)">
          <text class="act-t">{{ a.title }}</text>
          <text class="act-go">去完成 ›</text>
        </view>
      </view>

      <!-- 8. 分享 -->
      <view class="btns">
        <view class="pbtn main" @click="sharing = true; buildShare()">生成分享图</view>
      </view>
      </view>
      </view>
      <view v-if="sharing" class="mask" @click="sharing = false">
        <view class="sheet" @click.stop>
          <view class="sheet-h"><text class="sheet-t">分享周报</text><text class="sheet-x" @click="sharing = false">✕</text></view>
          <image v-if="shareImg" :src="shareImg" class="share-img" mode="widthFix" @longpress="saveShare" />
          <view v-else class="spin">{{ shareErr || '生成中…' }}</view>
          <button v-if="shareImg" class="btn" @click="saveShare">保存图片</button>
        </view>
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <canvas id="weeklyCanvas" type="2d" class="hidden-canvas" />
      <!-- #endif -->
    </template>
  </view>
</template>

<script>
import { request, snapPeek, anonUid } from '../../api.js';

const W = 660;
const H = 760;

function roundRect(ctx, x, y, w, h, rr) {
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawShare(ctx, r) {
  const g = ctx.createLinearGradient(0, 0, W * 0.7, H);
  g.addColorStop(0, '#5B8AF8');
  g.addColorStop(1, '#2C5AD6');
  roundRect(ctx, 0, 0, W, H, 36);
  ctx.fillStyle = g;
  ctx.fill();
  const pad = 44;
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '24px sans-serif';
  ctx.fillText('错题邦 · 周学习报告', pad, 52);
  ctx.fillStyle = '#fff';
  ctx.font = '800 52px sans-serif';
  ctx.fillText(r.range, pad, 100);
  const stats = [
    [String(r.summary.days), '学习天数'],
    [String(r.summary.n), '刷题量'],
    [Math.round(r.summary.acc * 100) + '%', '正确率'],
    [Math.round(r.summary.secs / 60) + '分', '学习时长'],
  ];
  roundRect(ctx, pad, 200, W - pad * 2, 128, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  const cw = (W - pad * 2) / 4;
  stats.forEach(([v, l], i) => {
    const cx = pad + cw * i + cw / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '800 40px sans-serif';
    ctx.fillText(v, cx, 226);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '20px sans-serif';
    ctx.fillText(l, cx, 282);
  });
  ctx.textAlign = 'left';
  let y = 380;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '26px sans-serif';
  for (const b of r.badges.slice(0, 3)) {
    ctx.fillText('🏅 ' + b.title + ' · ' + b.desc, pad, y);
    y += 46;
  }
  if (r.mock) {
    ctx.fillText('📝 本周模考最高 ' + r.mock.score + ' 分', pad, y);
    y += 46;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '20px sans-serif';
  ctx.fillText('kaogong.zalize.com · 每周一自动生成', pad, H - 80);
}

export default {
  data() {
    return {
      loading: true,
      empty: false,
      pending: false,
      prevWeek: '',
      error: '',
      range: '',
      r: null,
      nextEvent: null,
      sharing: false,
      shareImg: '',
      shareErr: '',
    };
  },
  onLoad(opt) {
    this.week = opt.week || '';
    this.load();
  },
  methods: {
    pct(v) { return Math.round((v || 0) * 100); },
    mins(s) { return Math.round((s || 0) / 60) + ' 分钟'; },
    async load() {
      const p = '/api/report/weekly?uid=' + encodeURIComponent(anonUid()) + (this.week ? '&week=' + this.week : '');

      // 快照即显：uid API 长尾下先用最近成功快照铺屏，真实响应到达后覆盖
      const snap = snapPeek(p);
      if (snap) {
        this.applyReport(snap, true);
        this.loading = false;
      }

      try {
        this.applyReport(await request(p));
      } catch (e) {
        this.error = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    applyReport(d, stale) {
      this.empty = false;
      this.pending = false;
      if (d.status === 'empty') {
        this.empty = true;
        this.range = d.range || '';
      } else if (d.status === 'pending') {
        this.pending = true;
        this.range = d.range || '';
        this.prevWeek = d.prev_week || '';
      } else {
        this.r = d;
        if (!stale) {
          this.markRead(d);
          this.loadNextEvent();
        }
      }
    },
    async markRead(d) {
      try {
        const day = d.range.slice(0, 10);
        await request('/api/report/weekly/read', { method: 'POST', data: { uid: anonUid(), week: day } });
        uni.setStorageSync('weeklyReadWs', d.week_start);
      } catch (e) { /* 非关键路径 */ }
    },
    async loadNextEvent() {
      try {
        const d = await request('/api/report/weekly/next_event');
        this.nextEvent = d.event;
      } catch (e) { /* 非关键路径 */ }
    },
    reasonPct(n) {
      const max = Math.max(...this.r.reasons.map((x) => x.n), 1);
      return Math.max(6, (n / max) * 100);
    },
    trend() {
      const [cur, prev] = this.r.compare.acc;
      if (!this.r.prev.n) return 'new';
      if (cur > prev + 0.01) return 'up';
      if (cur < prev - 0.01) return 'down';
      return 'flat';
    },
    reload() {
      this.loading = true;
      this.empty = false;
      this.pending = false;
      this.error = '';
      this.load();
    },
    goPrevWeek() {
      this.week = this.prevWeek;
      this.reload();
    },
    goPractice() {
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goContest() {
      uni.navigateTo({ url: '/pkgA/exam/contest' });
    },
    openAttempt(aid) {
      uni.navigateTo({ url: '/pkgA/exam/report?attempt_id=' + aid });
    },
    goAction(a) {
      if (a.type === 'review') {
        uni.switchTab({ url: '/pages/book/book' });
      } else if (a.type === 'mock') {
        this.goContest();
      } else {
        const m = /tag3=([^&]+)/.exec(a.url || '');
        uni.setStorageSync('practiceLaunch', {
          kind: 'start',
          tag3: m ? decodeURIComponent(m[1]) : null,
          module: (/module=([^&]+)/.exec(a.url || '') || [])[1] || null,
          submodule: decodeURIComponent((/submodule=([^&]+)/.exec(a.url || '') || [])[1] || '') || null,
          adaptive: true,
        });
        uni.navigateTo({ url: '/pages/practice/practice' });
      }
    },
    fmtDay(t) {
      // 赛事时间为北京时间场次，跨时区设备也按东八区显示
      const d = new Date(t * 1000 + (new Date().getTimezoneOffset() + 8 * 60) * 60000);
      return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:00`;
    },
    async buildShare() {
      if (this.shareImg) return;
      try {
        // #ifdef H5
        const dpr = Math.min(window.devicePixelRatio || 2, 3);
        const canvas = document.createElement('canvas');
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        drawShare(ctx, this.r);
        this.shareImg = canvas.toDataURL('image/png');
        // #endif
        // #ifdef MP-WEIXIN
        const node = await new Promise((resolve, reject) => {
          uni.createSelectorQuery()
            .in(this)
            .select('#weeklyCanvas')
            .fields({ node: true, size: true })
            .exec((res) => (res && res[0] && res[0].node ? resolve(res[0].node) : reject(new Error('canvas 不可用'))));
        });
        const dpr = uni.getSystemInfoSync().pixelRatio || 2;
        node.width = W * dpr;
        node.height = H * dpr;
        const ctx = node.getContext('2d');
        ctx.scale(dpr, dpr);
        drawShare(ctx, this.r);
        this.shareImg = await new Promise((resolve, reject) => {
          uni.canvasToTempFilePath({
            canvas: node,
            success: (res) => resolve(res.tempFilePath),
            fail: (e) => reject(new Error(e.errMsg || '导出失败')),
          }, this);
        });
        // #endif
      } catch (e) {
        this.shareErr = e.message;
      }
    },
    saveShare() {
      if (!this.shareImg) return;
      // #ifdef H5
      const a = document.createElement('a');
      a.href = this.shareImg;
      a.download = 'weekly-report.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      uni.showToast({ title: '已保存图片', icon: 'none' });
      // #endif
      // #ifdef MP-WEIXIN
      uni.saveImageToPhotosAlbum({
        filePath: this.shareImg,
        success: () => uni.showToast({ title: '已保存到相册', icon: 'none' }),
        fail: () => uni.showToast({ title: '保存失败', icon: 'none' }),
      });
      // #endif
    },
  },
  computed: {
    trendIcon() {
      return { up: '↑ 进步', down: '↓ 回落', flat: '→ 持平', new: '✦ 新开始' }[this.trend()];
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 60rpx 24rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 600; margin-bottom: 20rpx; }
.empty { text-align: center; padding: 80rpx 40rpx; }
.empty-t { display: block; font-size: 32rpx; font-weight: 700; color: var(--ink); }
.empty-s { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 12rpx; }
.cta { margin-top: 32rpx; min-height: 44px; display: flex; align-items: center; justify-content: center; background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 28rpx; font-weight: 600; }
.hero { background: linear-gradient(135deg, var(--brand), #5c82ff); border: none; }
.hero-range { display: block; font-size: 26rpx; color: rgba(255, 255, 255, 0.85); text-align: center; }
.hero-nums { display: flex; margin-top: 24rpx; }
.hn { flex: 1; text-align: center; }
.hn-v { display: block; font-size: 40rpx; font-weight: 800; color: #fff; }
.hn-k { display: block; font-size: 22rpx; color: rgba(255, 255, 255, 0.8); margin-top: 6rpx; }
.badges { display: flex; gap: 16rpx; margin-bottom: 24rpx; flex-wrap: wrap; }
.badge { flex: 1; min-width: 200rpx; background: linear-gradient(135deg, #fff7ed, #fffbeb); border: 1rpx solid #fcd34d; border-radius: 16rpx; padding: 20rpx; }
.badge-t { display: block; font-size: 26rpx; font-weight: 700; color: #92400e; }
.badge-s { display: block; font-size: 22rpx; color: #b45309; margin-top: 6rpx; }
.cmp-row { display: flex; align-items: center; min-height: 44px; border-bottom: 1rpx solid var(--line); }
.cmp-row:last-child { border-bottom: none; }
.cmp-k { flex-shrink: 0; width: 150rpx; font-size: 24rpx; color: var(--ink-2); }
.cmp-v { flex: 1; font-size: 28rpx; font-weight: 700; color: var(--ink); }
.cmp-p { flex-shrink: 0; font-size: 22rpx; color: var(--ink-3); }
.ms-row { display: flex; align-items: center; gap: 14rpx; min-height: 44px; }
.ms-tag { flex-shrink: 0; width: 40rpx; height: 40rpx; line-height: 40rpx; text-align: center; border-radius: 50%; font-size: 24rpx; font-weight: 800; }
.ms-tag.up { background: var(--ok-soft); color: #15803d; }
.ms-tag.down { background: var(--bad-soft); color: #b91c1c; }
.ms-t { flex: 1; font-size: 26rpx; color: var(--ink); }
.ms-v { flex-shrink: 0; font-size: 24rpx; color: var(--ink-2); }
.rs-row { display: flex; align-items: center; gap: 14rpx; min-height: 44px; }
.rs-k { flex-shrink: 0; width: 140rpx; font-size: 24rpx; color: var(--ink-2); }
.rs-bar { flex: 1; height: 16rpx; background: var(--bad-soft); border-radius: 999rpx; overflow: hidden; }
.rs-fill { height: 100%; background: #ef4444; border-radius: 999rpx; }
.rs-v { flex-shrink: 0; font-size: 24rpx; font-weight: 600; color: var(--ink); }
.rs-p { font-size: 20rpx; color: var(--ink-3); font-weight: 400; }
.mk-line { font-size: 26rpx; color: var(--ink); margin-bottom: 10rpx; }
.mk-line.sub { font-size: 24rpx; color: var(--ink-2); }
.mk-n { font-size: 34rpx; font-weight: 800; color: var(--brand-text); }
.mk-none { display: block; font-size: 26rpx; color: var(--ink-2); margin-bottom: 12rpx; }
.link { font-size: 24rpx; color: var(--brand-text); font-weight: 600; min-height: 44px; display: flex; align-items: center; }
.act-row { display: flex; justify-content: space-between; align-items: center; min-height: 44px; padding: 10rpx 0; border-bottom: 1rpx solid var(--line); }
.act-row:last-child { border-bottom: none; }
.act-t { font-size: 26rpx; color: var(--ink); }
.act-go { flex-shrink: 0; font-size: 24rpx; color: var(--brand-text); font-weight: 600; }
.btns { display: flex; }
.pbtn { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--brand); color: var(--brand-text); border-radius: 999rpx; font-size: 28rpx; font-weight: 500; background: var(--card); }
.pbtn.main { background: var(--brand); color: #fff; }
.mask { position: fixed; inset: 0; background: rgba(15, 18, 25, 0.45); z-index: 90; display: flex; align-items: flex-end; }
.sheet { width: 100%; background: var(--card); border-radius: 28rpx 28rpx 0 0; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); max-height: 85vh; box-sizing: border-box; overflow-y: auto; }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.sheet-t { font-size: 30rpx; font-weight: 600; }
.sheet-x { font-size: 30rpx; color: var(--ink-2); padding: 8rpx 16rpx; }
.share-img { width: 100%; border-radius: 20rpx; }
.btn { background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 28rpx; margin-top: 20rpx; min-height: 44px; line-height: 44px; }
.hidden-canvas { position: fixed; left: -9999rpx; top: 0; width: 660px; height: 760px; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .mask { justify-content: center; align-items: center; }
  .sheet { width: 560px; border-radius: 24rpx; }
  .cta:hover, .link:hover, .act-row:hover, .pbtn:hover, .sheet-x:hover, .btn:hover { cursor: pointer; }
}

@media (min-width: 1024px) {
  .wr-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .wr-side { width: 420px; flex: none; position: sticky; top: 24rpx; }
  .wr-main { flex: 1; min-width: 0; }
}
/* #endif */
</style>
