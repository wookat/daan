/* 评论与举报：举报队列审核（恢复/删除）+ 评论浏览 */
(function () {
  const { api, esc, toast, fmtTime } = Admin;

  const ST = {
    ok: '<span class="tag tag-ok">正常</span>',
    hidden: '<span class="tag tag-warn">已隐藏</span>',
    deleted: '<span class="tag tag-bad">已删除</span>',
  };

  function reasonTags(reasons) {
    const cnt = {};
    String(reasons || '').split(',').filter(Boolean).forEach((r) => { cnt[r] = (cnt[r] || 0) + 1; });
    return Object.entries(cnt).map(([r, n]) => `<span class="tag tag-gray">${esc(r)}${n > 1 ? ' ×' + n : ''}</span>`).join(' ')
      || '<span style="color:var(--t4)">—</span>';
  }

  function actCell(id, status) {
    const acts = [];
    if (status !== 'ok') acts.push(`<a data-restore="${id}" style="color:var(--brand-600);cursor:pointer">恢复</a>`);
    if (status !== 'deleted') acts.push(`<a data-del="${id}" style="color:var(--error);cursor:pointer">删除</a>`);
    return acts.join('　');
  }

  function bindActs(box, reload) {
    box.querySelectorAll('[data-restore]').forEach((a) => {
      a.onclick = async () => {
        if (!confirm('恢复该评论（判定为误报，举报记录将清零）？')) return;
        await api('/api/admin/comments/' + a.dataset.restore + '/restore', { method: 'POST' });
        toast('已恢复');
        reload();
      };
    });
    box.querySelectorAll('[data-del]').forEach((a) => {
      a.onclick = async () => {
        if (!confirm('删除该评论（判定为违规）？')) return;
        await api('/api/admin/comments/' + a.dataset.del, { method: 'DELETE' });
        toast('已删除');
        reload();
      };
    });
  }

  async function render(el) {
    const reports = await api('/api/admin/comment-reports');
    const hiddenN = reports.items.filter((r) => r.status === 'hidden').length;
    const totalReports = reports.items.reduce((a, r) => a + r.report_count, 0);
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>评论与举报</h1><div class="sub">用户举报审核 · 去重举报 ≥3 自动隐藏待处理</div></div>
    </div>
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi"><div class="lb">待审核（已隐藏）</div><div class="v" style="color:${hiddenN ? 'var(--warning)' : 'var(--success)'}">${hiddenN}</div><div class="d flat">达到阈值自动下线</div></div>
      <div class="kpi"><div class="lb">被举报评论</div><div class="v">${reports.items.length}</div><div class="d flat">按评论去重</div></div>
      <div class="kpi"><div class="lb">累计举报人次</div><div class="v">${totalReports}</div><div class="d flat">同人同评论只计一次</div></div>
    </div>
    <div class="card" style="padding:0;margin-bottom:14px">
      <div class="card-h" style="padding:14px 16px 0"><span class="t">举报队列</span><span class="sub" style="font-size:12px;color:var(--t3)">恢复=误报（举报清零）· 删除=违规定性</span></div>
      <div id="cm-reports"></div>
    </div>
    <div class="card" style="padding:0">
      <div class="card-h" style="padding:14px 16px 0"><span class="t">评论浏览</span>
        <select id="cm-st" class="ipt" aria-label="举报状态筛选" style="width:120px;margin-left:auto">
          <option value="ok">正常</option><option value="hidden">已隐藏</option><option value="deleted">已删除</option>
        </select>
      </div>
      <div id="cm-list"><div class="empty">加载中…</div></div>
    </div>`;

    const rbox = el.querySelector('#cm-reports');
    rbox.innerHTML = reports.items.length ? `<table class="tbl"><thead><tr>
      <th style="width:56px">ID</th><th>内容</th><th style="width:110px">作者</th><th style="width:70px">题目</th>
      <th style="width:56px">举报</th><th>理由</th><th style="width:70px">状态</th><th style="width:110px">最近举报</th><th style="width:90px"><span class="sr-only">操作</span></th></tr></thead><tbody>
      ${reports.items.map((r) => `<tr>
        <td>#${r.comment_id}</td>
        <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.content)}">${esc(r.content)}</td>
        <td>${esc(r.nickname)}</td>
        <td><a href="#/questions?id=${r.question_id}" style="color:var(--brand-600)">#${r.question_id}</a></td>
        <td><b style="color:${r.report_count >= 3 ? 'var(--error)' : 'var(--t2)'}">${r.report_count}</b></td>
        <td>${reasonTags(r.reasons)}</td>
        <td>${ST[r.status] || esc(r.status)}</td>
        <td style="font-size:12px;color:var(--t3)">${fmtTime(r.last_at)}</td>
        <td>${actCell(r.comment_id, r.status)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty"><div class="eico">✅</div>暂无举报</div>';
    bindActs(rbox, () => render(el));

    async function loadList() {
      const st = el.querySelector('#cm-st').value;
      const box = el.querySelector('#cm-list');
      box.innerHTML = '<div class="empty">加载中…</div>';
      const d = await api('/api/admin/comments?status=' + st);
      box.innerHTML = d.items.length ? `<table class="tbl"><thead><tr>
        <th style="width:56px">ID</th><th>内容</th><th style="width:110px">作者</th><th style="width:70px">题目</th>
        <th style="width:52px">赞</th><th style="width:110px">时间</th><th style="width:90px"><span class="sr-only">操作</span></th></tr></thead><tbody>
        ${d.items.map((c) => `<tr>
          <td>#${c.id}</td>
          <td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.content)}">${esc(c.content)}</td>
          <td>${esc(c.nickname)}</td>
          <td><a href="#/questions?id=${c.question_id}" style="color:var(--brand-600)">#${c.question_id}</a></td>
          <td>${c.likes || 0}</td>
          <td style="font-size:12px;color:var(--t3)">${fmtTime(c.created_at)}</td>
          <td>${actCell(c.id, st)}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty"><div class="eico">📭</div>暂无评论</div>';
      bindActs(box, loadList);
    }
    el.querySelector('#cm-st').onchange = loadList;
    loadList();
  }

  Admin.registerPage('comments', { title: '评论与举报', crumb: '用户 / 评论与举报', render });
})();
