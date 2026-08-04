/* B07 时政与申论管理 */
(function () {
  const { api, esc, fmtDay } = Admin;
  const LIMIT = 15;
  let szOffset = 0;

  async function loadShizheng() {
    const box = document.getElementById('ct-sz');
    box.innerHTML = '<div class="empty">加载中…</div>';
    const r = await api(`/api/admin/shizheng?offset=${szOffset}&limit=${LIMIT}`);
    document.getElementById('ct-sz-total').textContent = r.total.toLocaleString();
    const today = new Date().toISOString().slice(0, 10);
    box.innerHTML = r.items.length ? `<table class="tbl"><thead><tr>
      <th style="width:100px">日期</th><th>题干</th><th style="width:56px">答案</th><th style="width:130px">来源</th></tr></thead><tbody>
      ${r.items.map((q) => {
        const fresh = q.date >= today ? ' <span class="tag tag-ok">今日</span>' : '';
        return `<tr><td>${esc(q.date || '—')}${fresh}</td>
          <td style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(q.question)}">${esc(q.question)}</td>
          <td><b>${esc(q.answer || '—')}</b></td>
          <td style="font-size:12px;color:var(--t3);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.source_note || '—')}</td></tr>`;
      }).join('')}</tbody></table>
      <div class="pager" style="display:flex;gap:10px;justify-content:flex-end;padding:12px 16px;font-size:13px">
        <a class="btn btn-ghost" id="sz-prev" ${szOffset ? '' : 'style="visibility:hidden"'}>← 上一页</a>
        <a class="btn btn-ghost" id="sz-next" ${szOffset + LIMIT < r.total ? '' : 'style="visibility:hidden"'}>下一页 →</a>
      </div>` : '<div class="empty"><div class="eico">📭</div>暂无时政题</div>';
    const prev = box.querySelector('#sz-prev'), next = box.querySelector('#sz-next');
    if (prev) prev.onclick = () => { szOffset = Math.max(0, szOffset - LIMIT); loadShizheng(); };
    if (next) next.onclick = () => { szOffset += LIMIT; loadShizheng(); };
  }

  async function render(el) {
    szOffset = 0;
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>时政与申论</h1><div class="sub">时政每日题与申论真题/素材库（导入经 /api/import 接口）</div></div>
    </div>
    <div class="card" style="padding:0;margin-bottom:14px">
      <div class="card-h" style="padding:14px 16px 0"><span class="t">时政题库</span><span class="tag tag-gray">共 <b id="ct-sz-total">…</b> 题</span></div>
      <div id="ct-sz"></div>
    </div>
    <div class="split-2" style="display:grid;grid-template-columns:1.3fr 1fr;gap:14px">
      <div class="card" style="padding:0">
        <div class="card-h" style="padding:14px 16px 0"><span class="t">申论真题卷</span><span class="tag tag-gray" id="ct-sl-total"></span></div>
        <div id="ct-sl"><div class="empty">加载中…</div></div>
      </div>
      <div class="card" style="padding:0">
        <div class="card-h" style="padding:14px 16px 0"><span class="t">申论素材库</span><span class="tag tag-gray" id="ct-mat-total"></span></div>
        <div id="ct-mat"><div class="empty">加载中…</div></div>
      </div>
    </div>`;
    loadShizheng();
    api('/api/admin/shenlun_overview').then((r) => {
      document.getElementById('ct-sl-total').innerHTML = `共 ${r.totals.questions} 题`;
      document.getElementById('ct-mat-total').innerHTML = `共 ${r.totals.materials} 篇`;
      document.getElementById('ct-sl').innerHTML = r.papers.length ? `<table class="tbl"><thead><tr>
        <th style="width:60px">年份</th><th>地区 / 卷</th><th style="width:56px">题数</th><th style="width:80px">参考答案</th><th style="width:56px">下架</th></tr></thead><tbody>
        ${r.papers.map((p) => `<tr><td>${p.exam_year || '—'}</td>
          <td>${esc([p.exam_region, p.paper].filter(Boolean).join(' · ') || '—')}</td>
          <td>${p.n}</td>
          <td>${p.with_ref >= p.n ? '<span class="tag tag-ok">齐全</span>' : `<span class="tag tag-warn">${p.with_ref}/${p.n}</span>`}</td>
          <td>${p.disabled_n || 0}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty"><div class="eico">📭</div>暂无申论题</div>';
      document.getElementById('ct-mat').innerHTML = r.materials.length ? `<table class="tbl"><thead><tr>
        <th>主题</th><th style="width:90px">类型</th><th style="width:56px">篇数</th></tr></thead><tbody>
        ${r.materials.map((m) => `<tr><td>${esc(m.topic || '—')}</td><td>${esc(m.type || '—')}</td><td>${m.n}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty"><div class="eico">📭</div>暂无素材</div>';
    });
  }

  Admin.registerPage('content', { title: '时政与申论', crumb: '内容 / 时政与申论', render });
})();
