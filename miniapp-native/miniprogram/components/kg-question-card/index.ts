// KgQuestionCard 小程序版：题卡（题头 序号/模块/来源 + 标记按钮 + 题干 + 配图 + 选项 slot + 尾部 slot）
// 事件：mark（点击标记）
import { moduleLabel } from '../../utils/module-meta';

Component({
  options: { multipleSlots: true },
  properties: {
    /** 1-based 题号 */
    index: { type: Number, value: 0 },
    total: { type: Number, value: 0 },
    module: { type: String, value: '' },
    submodule: { type: String, value: '' },
    /** 来源/年份地区等小字 */
    meta: { type: String, value: '' },
    question: { type: String, value: '' },
    image: { type: String, value: '' },
    imageCredit: { type: String, value: '' },
    /** 是否显示标记按钮（模考） */
    markable: { type: Boolean, value: false },
    marked: { type: Boolean, value: false },
    /** 题干字号（px，0 = 跟随 --fs-body） */
    fontSize: { type: Number, value: 0 },
    variant: { type: String, value: 'raised' },
  },
  data: { modName: '' },
  observers: {
    module(m: string) {
      this.setData({ modName: m ? moduleLabel(m) : '' });
    },
  },
  methods: {
    onMark() {
      this.triggerEvent('mark');
    },
    onPreview() {
      if (this.data.image) wx.previewImage({ urls: [this.data.image] });
    },
  },
});
