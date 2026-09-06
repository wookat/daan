// KgOptionGroup 小程序版：单选选项组（刷题 / 模考 / 报告回顾共用）
// 状态：选中 sel；判分揭示 revealed → right/wrong/dim；排除干扰项 excl（长按切换，未作答时呈现）
// 事件：pick{key} / excl{key}
export interface OptionItem {
  k: string;
  v: string;
}

interface OptionView extends OptionItem {
  cls: string;
  checked: boolean;
  isRight: boolean;
  isWrong: boolean;
  isExcl: boolean;
}

function buildViews(
  options: OptionItem[],
  picked: string,
  answer: string,
  revealed: boolean,
  excl: string[]
): OptionView[] {
  const ex = Array.isArray(excl) ? excl : [];
  return (options || []).map((o) => {
    const isExcl = !revealed && !picked && ex.includes(o.k);
    let cls = '';
    if (revealed) {
      if (o.k === answer) cls = 'right';
      else if (o.k === picked) cls = 'wrong';
      else cls = 'dim';
    } else if (o.k === picked) cls = 'sel';
    else if (isExcl) cls = 'excl';
    return {
      ...o,
      cls,
      checked: o.k === picked,
      isRight: revealed && o.k === answer,
      isWrong: revealed && o.k === picked && o.k !== answer,
      isExcl,
    };
  });
}

Component({
  properties: {
    options: { type: Array, value: [] },
    picked: { type: String, value: '' },
    answer: { type: String, value: '' },
    revealed: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    /** 允许长按排除干扰项（模考） */
    exclusive: { type: Boolean, value: false },
    excl: { type: Array, value: [] },
    /** 选项正文字号（px，0 = 跟随 --fs-body） */
    fontSize: { type: Number, value: 0 },
  },
  data: { views: [] as OptionView[] },
  observers: {
    'options, picked, answer, revealed, excl'(
      options: OptionItem[],
      picked: string,
      answer: string,
      revealed: boolean,
      excl: string[]
    ) {
      this.setData({ views: buildViews(options, picked, answer, revealed, excl) });
    },
  },
  methods: {
    onPick(e: WechatMiniprogram.TouchEvent) {
      if (this.data.disabled || this.data.revealed) return;
      this.triggerEvent('pick', { key: String(e.currentTarget.dataset.key) });
    },
    onLong(e: WechatMiniprogram.TouchEvent) {
      if (!this.data.exclusive || this.data.disabled || this.data.revealed) return;
      this.triggerEvent('excl', { key: String(e.currentTarget.dataset.key) });
    },
  },
});
