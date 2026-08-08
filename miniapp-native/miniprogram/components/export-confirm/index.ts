// 导出 PDF 确认弹层：含解析 / 仅答案 / 含答题卡 三选项（与 frontend-uni export-confirm 对齐）

Component({
  properties: {
    visible: { type: Boolean, value: false },
    scope: { type: String, value: '当前题目' },
    count: { type: null, value: null },
    busy: { type: Boolean, value: false },
  },
  data: {
    withAns: true,
    withSheet: true,
    only: false,
  },
  methods: {
    onClose() {
      this.triggerEvent('close');
    },
    noop() {
      /* 阻止冒泡 */
    },
    toggleAns() {
      this.setData({ only: false, withAns: !this.data.withAns });
    },
    toggleOnly() {
      this.setData({ only: !this.data.only });
    },
    toggleSheet() {
      this.setData({ only: false, withSheet: !this.data.withSheet });
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
