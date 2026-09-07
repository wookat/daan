// 运行配置项（需老板侧资源到位后填入；留空即隐藏对应入口）

// 微信订阅消息模板 ID：mp 后台「订阅消息」申请通过后填入即启用「学习提醒」入口
export const SUBSCRIBE_TMPL_ID = '';

// H5 站点（分享链接落地页）
export const SITE_URL = 'https://kaogong.zalize.com';

export function subscribeAvailable(): boolean {
  return !!SUBSCRIBE_TMPL_ID && typeof wx.requestSubscribeMessage === 'function';
}
