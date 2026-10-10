// 玩法端点：异步 PK / 组队打卡 / 题目分享 / 分享漏斗埋点辅助
import { request, anonUid, getAuthUser } from './client';
import { qShareCopy } from '../exam-copy.js';

// ---------- 答题 PK（异步） ----------

export function pkNickname() {
  const u = getAuthUser();
  if (u && u.nickname) return u.nickname;
  if (u && u.phone) {
    const p = String(u.phone);
    return '考友' + (p.includes('@') ? p.split('@')[0].slice(0, 4) : p.slice(-4));
  }
  // 匿名昵称按 uid 隔离，避免同设备切换身份后串用他人昵称；旧全局键迁移到当前 uid 一次
  const key = 'pkNickname:' + anonUid();
  let n = uni.getStorageSync(key);
  if (!n) {
    n = uni.getStorageSync('pkNickname');
    if (n) uni.removeStorageSync('pkNickname');
    else n = '考友' + Math.random().toString(36).slice(2, 6).toUpperCase();
    uni.setStorageSync(key, n);
  }
  return n;
}

export function pkCreate(module) {
  return request('/api/pk/create', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname(), module: module || null } });
}

export function pkJoin(code) {
  return request('/api/pk/join', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname(), code } });
}

export function pkRandomMatch(module) {
  return request('/api/pk/random_match', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname(), module: module || null } });
}

export function pkMatch(code) {
  return request(`/api/pk/match/${encodeURIComponent(code)}?uid=${encodeURIComponent(anonUid())}`);
}

export function pkSubmit(code, items) {
  return request('/api/pk/submit', { method: 'POST', data: { uid: anonUid(), code, items }, timeout: 20000 });
}

export function pkMine() {
  return request(`/api/pk/mine?uid=${encodeURIComponent(anonUid())}`);
}

export function pkResult(code) {
  return request(`/api/pk/result/${encodeURIComponent(code)}`);
}

// ---------- 组队打卡 / 题目分享 ----------

export function teamCreate(name) {
  return request('/api/team/create', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname(), name } });
}

export function teamJoin(code) {
  return request('/api/team/join', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname(), code } });
}

export function teamLeave(teamId) {
  return request('/api/team/leave', { method: 'POST', data: { uid: anonUid(), team_id: teamId } });
}

export function teamMine() {
  return request(`/api/team/mine?uid=${encodeURIComponent(anonUid())}`);
}

export function teamPanel(teamId) {
  return request(`/api/team/${teamId}/panel?uid=${encodeURIComponent(anonUid())}`);
}

export function shareCreate(questionId, teamId) {
  return request('/api/share/create', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), question_id: questionId, team_id: teamId || null },
  });
}

export function shareDetail(sid) {
  return request(`/api/share/${encodeURIComponent(sid)}?uid=${encodeURIComponent(anonUid())}`);
}

export function shareAnswer(sid, picked, secs) {
  return request(`/api/share/${encodeURIComponent(sid)}/answer`, {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), picked, secs: secs || 0 },
  });
}

// 分享分桶：按 uid 稳定分 a/b，只随 URL 下发供 share_open/share_answer/share_copy 漏斗对比
export function shareVariant() {
  const uid = anonUid();
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) & 0x7fffffff;
  return h % 2 === 0 ? 'a' : 'b';
}

/** correct: true/false 为分享者本题真实结果；未作答（如题面社交栏）不传 */
export function qShareText(mod, sid, correct) {
  const url = `https://kaogong.zalize.com/s/${sid}?v=${shareVariant()}`;
  return qShareCopy(mod, url, correct);
}

// 把分享落地页地址栏回写为服务端短链（/s/{sid}、/p/{rid}），地址栏转发/浏览器原生分享
// 不再携带聊天应用会截断的 #/? hash 路由；站内一旦导航即把 path 还原为 /，避免刷新误落分享页
export function canonicalizeSharePath(path) {
  // #ifdef H5
  try {
    window.history.replaceState(null, '', path);
    window.addEventListener(
      'hashchange',
      () => window.history.replaceState(null, '', '/' + window.location.hash),
      { once: true }
    );
  } catch (e) {
    /* 老旧 webview 无 History API 时静默降级 */
  }
  // #endif
}

export function pkLeaderboard() {
  return request(`/api/pk/leaderboard?uid=${encodeURIComponent(anonUid())}`);
}
