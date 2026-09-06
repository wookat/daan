// KgQuestionCard 小程序版：题干 + 选项 + 判分后解析（practice.wxml 里注明「kg-question-card 未落地」，此为落地版）。
// 选项/解析等展示值由调用方在 ts 里算好（optList、explanation 已拼好出处），组件不做字符串方法调用。
export interface QcOption {
  k: string;
  v: string;
}

Component({
  // 复用 app.wxss 的 .q-text / .num 工具类（题干排版规则单一来源）
  options: { styleIsolation: 'apply-shared' },
  properties: {
    question: { type: String, value: '' },
    options: { type: Array, value: [] as QcOption[] },
    answer: { type: String, value: '' },
    picked: { type: String, value: '' },
    explanation: { type: String, value: '' },
    tag: { type: String, value: '' },
    tagTone: { type: String, value: 'neutral' },
    module: { type: String, value: '' },
    image: { type: String, value: '' },
    fontSize: { type: Number, value: 16 },
  },
  methods: {
    onPick(e: WechatMiniprogram.TouchEvent) {
      if (this.data.picked) return;
      this.triggerEvent('pick', { key: String(e.currentTarget.dataset.key) });
    },
    onPreview() {
      if (this.data.image) wx.previewImage({ urls: [this.data.image] });
    },
  },
});
