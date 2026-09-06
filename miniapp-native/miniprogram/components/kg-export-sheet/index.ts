// KgExportSheet 小程序版（对齐 H5 components/export-confirm）：PDF 导出范围/题数 + 含解析/仅答案/含答题卡三选项 → confirm(opts)
Component({
  properties: {
    visible: { type: Boolean, value: false },
    scope: { type: String, value: '当前题目' },
    count: { type: null, value: null },
    busy: { type: Boolean, value: false },
  },
  data: { withAns: true, withSheet: true, only: false, countText: '按当前设置组卷', note: '' },
  observers: {
    count(c: number | null) {
      this.setData({ countText: c != null ? c + ' 题' : '按当前设置组卷' });
    },
    'withAns, withSheet, only'(withAns: boolean, withSheet: boolean, only: boolean) {
      this.setData({
        note: only ? '只导出参考答案页，不含题目' : '导出题目' + (withAns ? ' + 答案解析' : '') + (withSheet ? ' + 机读答题卡' : ''),
      });
    },
  },
  methods: {
    onAns() {
      this.setData({ only: false, withAns: !this.data.withAns });
    },
    onOnly() {
      this.setData({ only: !this.data.only });
    },
    onSheet() {
      this.setData({ only: false, withSheet: !this.data.withSheet });
    },
    onClose() {
      this.triggerEvent('close');
    },
    onConfirm() {
      if (this.data.busy) return;
      const { only, withAns, withSheet } = this.data;
      this.triggerEvent('confirm', {
        include_answers: only || withAns,
        answer_sheet: !only && withSheet,
        include_questions: !only,
      });
    },
  },
});
