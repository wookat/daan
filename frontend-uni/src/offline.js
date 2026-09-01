// 离线做题：题包下载到本地 storage，无网时可作答并本地判分；
// 作答记录（answer_log / 错题）进入本地队列，恢复网络后自动同步（按 key 去重）。
// 小程序 storage 上限 10MB → 小包（20 题/包）；H5/App 用 50 题/包。
import { request, anonUid } from './api.js';

let packSize = 50;
// #ifdef MP-WEIXIN
packSize = 20;
// #endif
export const PACK_SIZE = packSize;

export const PACK_MODULES = [
  { module: 'ziliao', name: '资料分析' },
  { module: 'shuliang', name: '数量关系' },
  { module: 'yanyu', name: '言语理解' },
  { module: 'panduan', name: '判断推理' },
  { module: 'changshi', name: '常识判断' },
];

const IDX_KEY = 'offlinePacks';
const QUEUE_KEY = 'offlineQueue';
const packKey = (module) => 'offlinePack:' + module;

// ---------- 题包 ----------

export function listPacks() {
  return uni.getStorageSync(IDX_KEY) || [];
}

export function getPack(module) {
  return uni.getStorageSync(packKey(module)) || null;
}

export async function downloadPack(module) {
  const uid = anonUid();
  const d = await request(
    '/api/questions?limit=' + PACK_SIZE + '&module=' + module + '&uid=' + encodeURIComponent(uid)
  );
  const items = (d.items || []).filter((q) => q.question && q.options && q.answer);
  if (!items.length) throw new Error('该模块暂无题目');
  const pack = { module, ts: Date.now(), items };
  uni.setStorageSync(packKey(module), pack);
  const idx = listPacks().filter((p) => p.module !== module);
  idx.push({ module, count: items.length, ts: pack.ts, size: JSON.stringify(pack).length });
  uni.setStorageSync(IDX_KEY, idx);
  return pack;
}

export function removePack(module) {
  uni.removeStorageSync(packKey(module));
  uni.setStorageSync(IDX_KEY, listPacks().filter((p) => p.module !== module));
}

export function packUsageBytes() {
  return listPacks().reduce((a, p) => a + (p.size || 0), 0);
}

// 无网启动练习：从题包随机抽一组
export function drawOffline(module, count) {
  const pack = getPack(module);
  if (!pack || !pack.items.length) return null;
  const arr = pack.items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count || 10, arr.length));
}

// ---------- 离线作答队列（联网后自动同步，按 key 去重） ----------

function getQueue() {
  return uni.getStorageSync(QUEUE_KEY) || { answers: [], mistakes: [] };
}
function setQueue(q) {
  uni.setStorageSync(QUEUE_KEY, q);
}

export function pendingCount() {
  const q = getQueue();
  return q.answers.length + q.mistakes.length;
}

// items: answer_log 条目；key = uid|qid|时间戳 防重复入队/重复上传
export function enqueueAnswers(uid, items) {
  const q = getQueue();
  const seen = new Set(q.answers.map((a) => a.key));
  for (const it of items) {
    const key = uid + '|' + (it.qid || 'x') + '|' + (it.t || Date.now());
    if (seen.has(key)) continue;
    seen.add(key);
    q.answers.push({ key, uid, item: it });
  }
  setQueue(q);
}

export function enqueueMistake(data) {
  const q = getQueue();
  const key = data.uid + '|' + (data.question_id || data.question_text || '');
  if (q.mistakes.some((m) => m.key === key)) return;
  q.mistakes.push({ key, data });
  setQueue(q);
}

let flushing = false;

export async function flushOfflineQueue() {
  if (flushing) return;
  const q = getQueue();
  if (!q.answers.length && !q.mistakes.length) return;
  flushing = true;
  try {
    // answer_log：按 uid 分组批量上传，成功后出队（不会重复上传同一 key）
    const byUid = {};
    for (const a of q.answers) (byUid[a.uid] = byUid[a.uid] || []).push(a);
    for (const [uid, arr] of Object.entries(byUid)) {
      await request('/api/answer_log', {
        method: 'POST',
        data: { uid, items: arr.map((a) => a.item) },
      });
      const done = new Set(arr.map((a) => a.key));
      const cur = getQueue();
      cur.answers = cur.answers.filter((a) => !done.has(a.key));
      setQueue(cur);
    }
    // 错题：逐条补传（后端本身按 uid+question_text 合并，无重复风险）
    for (const m of q.mistakes.slice()) {
      await request('/api/mistakes', { method: 'POST', data: m.data });
      const cur = getQueue();
      cur.mistakes = cur.mistakes.filter((x) => x.key !== m.key);
      setQueue(cur);
    }
    const left = pendingCount();
    if (!left) uni.showToast({ title: '离线作答已同步', icon: 'none' });
  } catch (e) {
    /* 仍无网络：下次联网/前台时再试 */
  } finally {
    flushing = false;
  }
}

export function watchNetwork() {
  try {
    uni.onNetworkStatusChange((res) => {
      if (res.isConnected) flushOfflineQueue();
    });
  } catch (e) { /* 端不支持则依赖 onShow 触发 */ }
}

// ---------- 错题本离线缓存 ----------

export function cacheMistakes(items, uid) {
  try {
    uni.setStorageSync('mistakesCache', { ts: Date.now(), uid: uid || '', items: (items || []).slice(0, 200) });
  } catch (e) { /* 存储满则跳过 */ }
}

export function getCachedMistakes(uid) {
  const c = uni.getStorageSync('mistakesCache') || null;
  if (c && uid && c.uid && c.uid !== uid) return null;
  return c;
}
