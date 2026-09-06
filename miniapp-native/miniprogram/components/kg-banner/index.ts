// KgBanner 小程序版（COMPONENTS §2.7）：顶部横幅（网络/同步/公告）。tone: info/warn/ok/bad；事件 action/close。
const ICONS: Record<string, string> = { info: 'info', warn: 'triangle-alert', ok: 'circle-check', bad: 'circle-x' };

Component({
  properties: {
    text: { type: String, value: '' },
    tone: { type: String, value: 'info' },
    icon: { type: String, value: '' },
    actionText: { type: String, value: '' },
    closable: { type: Boolean, value: true },
  },
  data: { iconName: 'info' },
  observers: {
    'icon, tone'(icon: string, tone: string) {
      this.setData({ iconName: icon || ICONS[tone] || 'info' });
    },
  },
  methods: {
    onAction() {
      this.triggerEvent('action');
    },
    onClose() {
      this.triggerEvent('close');
    },
  },
});
