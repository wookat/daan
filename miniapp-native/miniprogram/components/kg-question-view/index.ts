// KgQuestionView：只读题目视图（题干 + 选项判定标记 + 解析），供搜索详情 / 练习历史 / 按卷查看等复用。
// options 传原始 Record<string,string>，组件内排好序，页面不必各自算 optList。
Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    question: { type: String, value: '' },
    options: { type: Object, value: {} as Record<string, string> },
    answer: { type: String, value: '' },
    picked: { type: String, value: '' },
    explanation: { type: String, value: '' },
    hsExplanation: { type: String, value: '' },
    showExplanation: { type: Boolean, value: true },
    dense: { type: Boolean, value: false },
  },
  data: { optList: [] as Array<{ k: string; v: string }> },
  observers: {
    options(o: Record<string, string> | null) {
      const src = o && typeof o === 'object' ? o : {};
      this.setData({
        optList: Object.keys(src)
          .sort()
          .map((k) => ({ k, v: src[k] })),
      });
    },
  },
});
