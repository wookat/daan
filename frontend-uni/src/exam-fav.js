// 成绩报告解析复盘：收藏本题（与刷题页 favQuestions schema 对齐）
const FAV_LIMIT = 200;

export function isFaved(favs, question) {
  const list = Array.isArray(favs) ? favs : [];
  return !!question && list.some((f) => f && f.question === question);
}

export function toggleFav(favs, item) {
  const list = Array.isArray(favs) ? favs.slice() : [];
  if (!item || !item.question) return { list, added: false };
  const i = list.findIndex((f) => f && f.question === item.question);
  if (i >= 0) {
    list.splice(i, 1);
    return { list, added: false };
  }
  list.unshift({
    t: Date.now(),
    id: item.question_id || null,
    question: item.question,
    options: item.options,
    answer: item.answer,
    explanation: item.explanation,
    hs_explanation: item.hs_explanation,
    module: item.module,
    submodule: item.submodule,
    is_real: item.is_real,
    exam_year: item.exam_year,
    exam_region: item.exam_region,
    image: item.image,
    image_credit: item.image_credit,
  });
  if (list.length > FAV_LIMIT) list.length = FAV_LIMIT;
  return { list, added: true };
}

// 本机收藏条目对应的云端题库 id：新条目自带 id，历史条目按题干在云收藏列表里回查
export function cloudFavId(fav, cloudItems) {
  if (!fav) return null;
  if (fav.id) return fav.id;
  const list = Array.isArray(cloudItems) ? cloudItems : [];
  const hit = fav.question && list.find((it) => it && it.id && it.question === fav.question);
  return hit ? hit.id : null;
}

// 云收藏条目（/api/favs items，题目全字段 + faved_at）→ 本机 favQuestions schema
export function favFromCloud(it) {
  return {
    t: Math.round((it.faved_at || 0) * 1000) || Date.now(),
    id: it.id,
    question: it.question,
    options: it.options,
    answer: it.answer,
    explanation: it.explanation,
    hs_explanation: it.hs_explanation,
    xp_explanation: it.xp_explanation,
    xp_school: it.xp_school,
    module: it.module,
    submodule: it.submodule,
    is_real: it.is_real,
    exam_year: it.exam_year,
    exam_region: it.exam_region,
    image: it.image,
    image_credit: it.image_credit,
  };
}

// 本机收藏与云收藏（question_favs）对账：题库题以云端为准——别处（小程序/其他设备/收藏夹页）收藏的补进本机、
// 别处取消的从本机消失；无 id 条目（时政/内联题或历史条目）按题干回查云列表，命中即认领 id，否则保留为本机独有。
// 刚收藏不满 FAV_GRACE_MS 的条目云端 POST 可能尚未落库，一律保留。
export const FAV_GRACE_MS = 60 * 1000;
export function reconcileFavs(local, cloudItems, now = Date.now()) {
  const cloud = (Array.isArray(cloudItems) ? cloudItems : []).filter((it) => it && it.id && it.question);
  const byId = new Map(cloud.map((it) => [it.id, it]));
  const byQ = new Map(cloud.map((it) => [it.question, it]));
  const used = new Set();
  const out = [];
  (Array.isArray(local) ? local : []).forEach((f) => {
    if (!f || !f.question) return;
    const hit = f.id ? byId.get(f.id) : byQ.get(f.question);
    if (hit) {
      if (used.has(hit.id)) return;
      used.add(hit.id);
      out.push({ ...f, id: hit.id });
    } else if (!f.id || now - (f.t || 0) < FAV_GRACE_MS) {
      out.push(f);
    }
  });
  cloud.forEach((it) => {
    if (!used.has(it.id)) out.push(favFromCloud(it));
  });
  out.sort((a, b) => (b.t || 0) - (a.t || 0));
  if (out.length > FAV_LIMIT) out.length = FAV_LIMIT;
  return out;
}

// 云端写入失败的题库题条目降级为本机独有（id 置空），避免下次对账被当成「别处已取消」清掉
export function markFavLocalOnly(favs, question) {
  return (Array.isArray(favs) ? favs : []).map((f) => (f && f.question === question && f.id ? { ...f, id: null } : f));
}

// 恢复码跨设备恢复的收藏：来自另一 uid，云端无对应行，整体降为本机独有（同题云收藏后由对账按题干认领）
export function favsLocalOnly(favs) {
  return (Array.isArray(favs) ? favs : []).map((f) => (f && f.id ? { ...f, id: null } : f));
}
