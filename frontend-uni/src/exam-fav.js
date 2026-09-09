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
