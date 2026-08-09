import { pkResult, trackEvent } from '../../api/index';
import type { PkResultResp } from '../../api/types';
import { MODULE_NAMES } from '../../utils/stats';

const SITE = 'https://kaogong.zalize.com';

function fmtMs(ms?: number | null): string {
  if (ms == null) return '—';
  return (ms / 1000).toFixed(1) + 's';
}

Page({
  data: {
    rid: '',
    loading: true,
    errMsg: '',
    d: null as PkResultResp | null,
    modLabel: '',
    creatorName: '',
    opponentName: '',
    creatorAv: '',
    opponentAv: '',
    creatorMeta: '',
    opponentMeta: '',
    resultText: '',
  },

  onLoad(query: Record<string, string>) {
    const rid = query && query.rid ? String(query.rid) : '';
    this.setData({ rid });
    trackEvent('pk_result_open', 'pk_share', rid || null);
    wx.setStorageSync('regSource', 'pk_share');
    this.load();
  },

  async load() {
    const { rid } = this.data;
    if (!rid) {
      this.setData({ loading: false, errMsg: '战绩链接无效' });
      return;
    }
    try {
      const d = await pkResult(rid);
      // 同名对局用角色区分（对齐轮24：服务端返回 role）
      const sameName = d.creator.name === d.opponent.name;
      const creatorName = sameName ? `${d.creator.name}（发起方）` : d.creator.name;
      const opponentName = sameName ? `${d.opponent.name}（应战方）` : d.opponent.name;
      let resultText = '平局';
      if (d.winner !== 'draw') {
        resultText = `${d.winner === 'creator' ? creatorName : opponentName} 获胜`;
      }
      this.setData({
        d,
        modLabel: MODULE_NAMES[d.module || ''] || '混合模块',
        creatorName,
        opponentName,
        creatorAv: (d.creator.name || '?').slice(0, 1),
        opponentAv: (d.opponent.name || '?').slice(0, 1),
        creatorMeta: `答对 ${d.creator.correct}/${d.n_questions} · ${fmtMs(d.creator.time_ms)}`,
        opponentMeta: `答对 ${d.opponent.correct}/${d.n_questions} · ${fmtMs(d.opponent.time_ms)}`,
        resultText,
      });
    } catch (e) {
      this.setData({ errMsg: (e as Error).message || '战绩不存在或对局未结束' });
    }
    this.setData({ loading: false });
  },

  onCopyLink() {
    trackEvent('pk_result_copy', 'pk_share', this.data.rid);
    wx.setClipboardData({
      data: `【答题PK战绩】不服来战：${SITE}/#/pkgA/share/pk-result?rid=${this.data.rid}`,
      success: () => wx.showToast({ title: '战绩链接已复制，发给考友吧', icon: 'none' }),
    });
  },

  onChallenge() {
    trackEvent('pk_result_challenge', 'pk_share', this.data.rid);
    // 原生小程序暂未上线 PK 对局，引导先去刷题练手
    wx.navigateTo({ url: '/pages/practice/practice?count=10&source=pk_share' });
  },

  // 微信右上角转发：卡片直达本战绩落地页
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const { d, creatorName, opponentName, rid } = this.data;
    return {
      title: d
        ? `${creatorName} vs ${opponentName} 的答题 PK 战绩，不服来战！`
        : '答题 PK 战绩，不服来战！',
      path: `/pages/share/pk-result?rid=${rid}`,
    };
  },
});
