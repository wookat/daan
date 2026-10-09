// 社交与收藏端点：每题讨论区 / 收藏夹与笔记 / 打卡海报数据
import { request, anonUid } from './client';

// ---------- 每题讨论区 ----------

export function fetchComments(questionId, sort) {
  return request(`/api/comments?question_id=${questionId}&sort=${sort || 'hot'}&uid=${encodeURIComponent(anonUid())}`);
}

export function fetchCommentCount(questionId) {
  return request(`/api/comments/count?question_id=${questionId}`);
}

export function postComment(questionId, content, parentId) {
  return request('/api/comments', {
    method: 'POST',
    data: { question_id: questionId, content, parent_id: parentId || null },
  });
}

export function likeComment(cid) {
  return request(`/api/comments/${cid}/like`, { method: 'POST' });
}

export function deleteOwnComment(cid) {
  return request(`/api/comments/${cid}`, { method: 'DELETE' });
}

export function reportComment(cid, reason) {
  return request(`/api/comments/${cid}/report`, { method: 'POST', data: { reason } });
}

export function fetchCommentInbox() {
  return request('/api/comments/inbox');
}

export function fetchCommentsPlaza() {
  return request('/api/comments/plaza');
}

export function readCommentInbox() {
  return request('/api/comments/inbox/read', { method: 'POST' });
}

// ---------- 收藏夹 / 笔记 ----------

export function fetchFavFolders() {
  return request(`/api/favs/folders?uid=${encodeURIComponent(anonUid())}`);
}

export function createFavFolder(name, icon) {
  return request('/api/favs/folders', { method: 'POST', data: { uid: anonUid(), name, icon } });
}

export function renameFavFolder(fid, name) {
  return request(`/api/favs/folders/${fid}`, { method: 'PATCH', data: { uid: anonUid(), name } });
}

export function deleteFavFolder(fid) {
  return request(`/api/favs/folders/${fid}?uid=${encodeURIComponent(anonUid())}`, { method: 'DELETE' });
}

export function fetchFavs(folderId, module) {
  let p = `/api/favs?uid=${encodeURIComponent(anonUid())}`;
  if (folderId != null) p += `&folder_id=${folderId}`;
  if (module) p += `&module=${module}`;
  return request(p);
}

// 收藏对账专用：只接受服务端真实回包。显式 timeout 走 request 的直连分支——不进 GET 合并缓存、
// 网络错误不回退 apiSnap 快照（快照是 POST 之前的旧列表，拿它对账会把刚收藏的题当「别处已取消」删掉）
export function fetchFavsLive() {
  return request(`/api/favs?uid=${encodeURIComponent(anonUid())}`, { timeout: 12000 });
}

export function setFav(questionId, folderId) {
  return request('/api/favs', { method: 'POST', data: { uid: anonUid(), question_id: questionId, folder_id: folderId || null } });
}

export function removeFav(questionId) {
  return request(`/api/favs?uid=${encodeURIComponent(anonUid())}&question_id=${questionId}`, { method: 'DELETE' });
}

export function favStatus(questionId) {
  return request(`/api/favs/status?uid=${encodeURIComponent(anonUid())}&question_id=${questionId}`);
}

export function fetchNotes() {
  return request(`/api/notes?uid=${encodeURIComponent(anonUid())}`);
}

export function fetchNote(questionId) {
  return request(`/api/notes?uid=${encodeURIComponent(anonUid())}&question_id=${questionId}`);
}

export function saveNote(questionId, content) {
  return request('/api/notes', { method: 'POST', data: { uid: anonUid(), question_id: questionId, content } });
}

// ---------- 打卡海报 ----------

export function fetchCheckinSummary() {
  return request(`/api/checkin/summary?uid=${encodeURIComponent(anonUid())}`);
}

export function fetchCheckinBadges() {
  return request(`/api/checkin/badges?uid=${encodeURIComponent(anonUid())}`);
}
