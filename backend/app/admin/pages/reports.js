/* B05 纠错处理：左队列 + 右结构化处理面板 */
(function () {
  const { api, esc, toast, modTag, fmtTime, refreshBadges } = Admin;
  let status = 'open';
  let items = [];
  let sel = null;
  let question = null;

  const RTYPE = { wrong_answer: '答案有误', wrong_explanation: '解析有误', typo: '题干/选项错字', other: '其他' };

  async function load() {
    const r = await api('/api/admin/question_reports?status=' + status);
    items = r.items;
    sel = items[0] || null;
    renderList();
    renderPanel();
  }

  function renderList() {
    const box = document.getElementById('rp-list');
    document.querySelectorAll('.chip[data-st]').forEach((c) => c.classList.toggle('on', c.dataset.st === status));
    if (!items.length) { box.innerHTML = `<div class="empty"><div class="eico">✅</div>没有${status === 'open' ? '待处理' : ''}纠错</div>`; return; }
    box.innerHTML = items.map((r) => `
      <div class="tree-row ${sel && sel.id === r.id ? 'sel' : ''}" data-id="${r.id}" style="cursor:pointer;align-items:flex-start;padding:10px 14px">
        <div style="flex:1;min-width:0">
          <div class="row" style="gap:6px;margin-bottom:4px">
            <span class="tag tag-bad">${esc(RTYPE[r.reason] || r.reason || '反馈')}</span>
            <span class="tag tag-gray">题 #${r.question_id ?? '—'}</span>
            <span style="font-size:11px;color:var(--t4)">${fmtTime(r.created_at)}</span>
          </div>
          <div style="font-size:12px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.detail || '（无补充说明）')}</div>
        </div>
      </div>`).join('');
    box.querySelectorAll('[data-id]').forEach((row) => {
      row.onclick = () => { sel = items.find((x) => x.id === +row.dataset.id); renderList(); renderPanel(); };
    });
  }

  async function renderPanel() {
    const box = document.getElementById('rp-panel');
    if (!sel) { box.innerHTML = '<div class="empty"><div class="eico">👈</div>选择左侧纠错记录</div>'; return; }
    question = null;
    box.innerHTML = '<div class="empty">加载题目…</div>';
    if (sel.question_id) {
      try { question = ((await api('/api/admin/questions?qid=' + sel.question_id)).items || [])[0] || null; } catch (e) { /* */ }
    }
    const q = question;
    box.innerHTML = `
      <div class="card-h"><span class="t">纠错 #${sel.id} · ${esc(RTYPE[sel.reason] || sel.reason || '')}</span>
        <span class="tag ${sel.status === 'open' ? 'tag-warn' : sel.status === 'fixed' ? 'tag-ok' : 'tag-gray'}">${sel.status === 'open' ? '待处理' : sel.status === 'fixed' ? '已修复' : '已驳回'}</span></div>
      <div class="expl-box" style="margin-bottom:12px"><b>用户反馈：</b>${esc(sel.detail || '（无补充说明）')}</div>
      ${q ? `
        <div class="row" style="gap:6px;margin-bottom:8px"><span class="tag tag-gray">#${q.id}</span>${modTag(q.module)}
          ${q.disabled === 1 ? '<span class="tag tag-gray">已下架</span>' : '<span class="tag tag-ok">上架中</span>'}</div>
        <div class="q-text" style="font-size:13px">${esc(q.question)}</div>
        <div style="display:grid;gap:6px;margin-bottom:10px">${Object.entries(q.options || {}).map(([k, v]) =>
          `<div class="opt-row ${String(q.answer || '').toUpperCase().startsWith(k) ? 'ans' : ''}" style="padding:6px 10px;font-size:12px"><b>${k}.</b><span>${esc(v)}</span></div>`).join('')}</div>
        ${q.explanation ? `<div class="expl-box" style="font-size:12px">${esc(q.explanation)}</div>` : ''}
        <div class="row" style="gap:8px;margin:12px 0">
          <a class="btn btn-ghost" href="#/questions?id=${q.id}">编辑此题 →</a>
          ${q.disabled !== 1 ? `<button class="btn btn-ghost" id="rp-down" style="color:var(--error)">直接下架</button>` : ''}
        </div>` : (sel.question_id ? '<div class="empty">题目不存在或已删除</div>' : '<div class="empty">该反馈未关联具体题目</div>')}
      <div class="fld"><div class="lb">处理备注（可选）</div>
        <textarea class="ipt" id="rp-note" rows="2" style="width:100%" placeholder="处理说明，如：已修正答案 B→C">${esc(sel.note || '')}</textarea></div>
      <div class="row" style="gap:8px">
        <button class="btn btn-primary" id="rp-fixed">✔ 标记已修复</button>
        <button class="btn btn-ghost" id="rp-rejected">✕ 驳回（无效反馈）</button>
        ${sel.status !== 'open' ? '<button class="btn btn-ghost" id="rp-reopen">重新打开</button>' : ''}
      </div>`;
    const down = document.getElementById('rp-down');
    if (down) down.onclick = async () => {
      if (!confirm(`确认下架题目 #${q.id}？`)) return;
      await api('/api/admin/questions/' + q.id, { method: 'PATCH', body: JSON.stringify({ disabled: 1 }) });
      toast('已下架 #' + q.id);
      renderPanel();
    };
    const setStatus = (st) => async () => {
      const note = document.getElementById('rp-note').value.trim();
      await api('/api/admin/question_reports/' + sel.id, {
        method: 'PATCH', body: JSON.stringify({ status: st, note: note || null }),
      });
      toast(st === 'fixed' ? '已标记修复' : st === 'rejected' ? '已驳回' : '已重新打开');
      refreshBadges();
      load();
    };
    document.getElementById('rp-fixed').onclick = setStatus('fixed');
    document.getElementById('rp-rejected').onclick = setStatus('rejected');
    const reopen = document.getElementById('rp-reopen');
    if (reopen) reopen.onclick = setStatus('open');
  }

  async function render(el) {
    status = 'open';
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>纠错处理</h1><div class="sub">用户反馈 → 核实 → 修复/驳回 闭环</div></div>
      <div class="acts">
        <span class="chip on" data-st="open">待处理</span>
        <span class="chip" data-st="fixed">已修复</span>
        <span class="chip" data-st="rejected">已驳回</span>
      </div>
    </div>
    <div class="split-2" style="display:grid;grid-template-columns:1fr 1.4fr;gap:14px">
      <div class="card" style="padding:8px 0;max-height:70vh;overflow:auto" id="rp-list"></div>
      <div class="card" id="rp-panel"></div>
    </div>`;
    el.querySelectorAll('.chip[data-st]').forEach((c) => {
      c.onclick = () => { status = c.dataset.st; load(); };
    });
    await load();
  }

  Admin.registerPage('reports', { title: '纠错处理', crumb: '内容 / 纠错处理', render });
})();
