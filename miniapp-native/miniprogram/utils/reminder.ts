// 学习提醒：小程序端订阅消息占位（模板 ID 待 AppID 配置后填入即可启用）
// storage key 与 frontend-uni/src/reminder.js 一致：remindOn / remindTime

export const MP_SUBSCRIBE_TEMPLATE_ID = '';

const DEFAULT_TIME = '20:30';

export interface ReminderSettings {
  on: boolean;
  time: string;
}

export function getReminderSettings(): ReminderSettings {
  return {
    on: !!wx.getStorageSync('remindOn'),
    time: wx.getStorageSync<string>('remindTime') || DEFAULT_TIME,
  };
}

export function setReminderSettings(s: ReminderSettings): void {
  wx.setStorageSync('remindOn', s.on ? '1' : '');
  if (s.time) wx.setStorageSync('remindTime', s.time);
}

export function mpSubscribeAvailable(): boolean {
  return !!MP_SUBSCRIBE_TEMPLATE_ID;
}

export function requestMpSubscribe(): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    if (!MP_SUBSCRIBE_TEMPLATE_ID) {
      resolve({ ok: false, reason: 'no_template' });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [MP_SUBSCRIBE_TEMPLATE_ID],
      success: (res) => {
        const r = res as unknown as Record<string, string>;
        resolve({ ok: r[MP_SUBSCRIBE_TEMPLATE_ID] === 'accept' });
      },
      fail: () => resolve({ ok: false, reason: 'fail' }),
    });
  });
}
