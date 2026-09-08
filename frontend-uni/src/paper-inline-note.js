// 导出卷内无题库 id 的内联题（时政/手录）不占答题卡槽位、不参与机读判分（R525 契约）；
// 后端 paper/{code}、paper_answers、scan_sheet 回包的 inline_n 即该数，录入层与结果层统一用此文案说明「只判 N 题」。
export function inlineSkipNote(inlineN) {
  const m = Number(inlineN) || 0;
  if (m <= 0) return '';
  return '另 ' + m + ' 题为时政/手录题，不参与机读判分，请对照卷末参考答案核对';
}
