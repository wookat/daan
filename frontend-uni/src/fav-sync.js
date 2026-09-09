import { fetchFavs } from './api.js';
import { reconcileFavs } from './exam-fav.js';

let inflight = null;

// 拉本人云收藏（question_favs）与本机 favQuestions 对账后落盘，返回对账后的列表；
// 云端不可用时返回 null，调用方保持本机态。并发调用共用同一请求。
export function syncCloudFavs() {
  if (inflight) return inflight;
  inflight = fetchFavs()
    .then((d) => {
      const list = reconcileFavs(uni.getStorageSync('favQuestions') || [], d && d.items);
      uni.setStorageSync('favQuestions', list);
      return list;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
