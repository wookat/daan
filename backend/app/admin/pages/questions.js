/* B01 题库管理：表格 + 筛选 + 批量操作 + 编辑抽屉 */
(function () {
  const { api, esc, toast, MODS, modTag, openDrawer, closeDrawer, topicOptions } = Admin;
  const LIMIT = 20;
  let state = { kw: '', module: '', filter: 'all', offset: 0, qid: null, minScore: '', maxScore: '', sort: '' };
  let items = [];
  let selected = new Set();

  function qUrl() {
    const p = new URLSearchParams();
    if (state.qid) p.set('qid', state.qid);
    if (state.kw) p.set('keyword', state.kw);
    if (state.module) p.set('module', state.module);
    if (state.filter === 'flagged') p.set('flagged', '1');
    if (state.filter === 'disabled') p.set('disabled', '1');
    if (state.minScore !== '') p.set('min_score', state.minScore);
    if (state.maxScore !== '') p.set('max_score', state.maxScore);
    if (state.sort) p.set('sort', state.sort);
    p.set('offset', state.offset);
    p.set('limit', LIMIT);
    return '/api/admin/questions?' + p;
  }

  function scoreTag(s) {
    if (s === null || s === undefined) return '<span class="tag tag-gray">未打分</span>';
    const cls = s >= 80 ? 'tag-ok' : s >= 60 ? 'tag-info' : s >= 40 ? 'tag-warn' : 'tag-bad';
    return `<span class="tag ${cls}">${s}</span>`;
  }

  function statusTag(q) {
    if (q.disabled === 2) return '<span class="tag tag-warn">待审</span>';
    if (q.disabled === 1) return '<span class="tag tag-gray">已下架</span>';
    if (q.hs_down > 0) return `<span class="tag tag-bad">差评 ${q.hs_down}</span>`;
    return '<span class="tag tag-ok">已上架</span>';
  }

  async function load() {
    const box = document.getElementById('q-tbl');
    box.innerHTML = '<div class="empty">加载中…</div>';
    items = (await api(qUrl())).items;
    selected = new Set();
    renderTable();
  }

  function renderTable() {
    const box = document.getElementById('q-tbl');
    if (!items.length) { box.innerHTML = '<div class="empty"><div class="eico">📭</div>没有匹配的题目</div>'; renderBar(); return; }
    box.innerHTML = `<table class="tbl"><thead><tr>
      <th style="width:36px"><span class="sr-only">选择</span><input type="checkbox" id="q-all" aria-label="全选本页题目"></th>
      <th style="width:70px">ID</th><th>题干</th><th style="width:90px">模块</th>
      <th style="width:120px">考点</th><th style="width:60px">答案</th>
      <th style="width:66px">质量分</th>
      <th style="width:80px">状态</th><th style="width:110px">操作</th></tr></thead><tbody>
      ${items.map((q) => `<tr>
        <td><input type="checkbox" class="q-ck" data-id="${q.id}" aria-label="选择题目 ${q.id}" ${selected.has(q.id) ? 'checked' : ''}></td>
        <td>#${q.id}</td>
        <td style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(q.question)}">${esc(q.question)}</td>
        <td>${modTag(q.module)}</td>
        <td><span class="tag ${q.tag3 && q.tag3 !== 'UNKNOWN' ? 'tag-info' : 'tag-warn'}">${esc(q.tag3 || '未标注')}</span></td>
        <td><b>${esc(q.answer || '—')}</b></td>
        <td>${scoreTag(q.quality_score)}</td>
        <td>${statusTag(q)}</td>
        <td><a data-edit="${q.id}" style="color:var(--brand-600)">编辑</a>　<a data-toggle="${q.id}" style="color:${q.disabled === 1 ? 'var(--success)' : 'var(--error)'}">${q.disabled === 1 ? '上架' : '下架'}</a></td>
      </tr>`).join('')}</tbody></table>
      <div class="pager" style="display:flex;gap:10px;justify-content:flex-end;padding:12px 16px;font-size:13px">
        <a class="btn btn-ghost" id="q-prev" ${state.offset ? '' : 'style="visibility:hidden"'}>← 上一页</a>
        <a class="btn btn-ghost" id="q-next" ${items.length === LIMIT ? '' : 'style="visibility:hidden"'}>下一页 →</a>
      </div>`;
    box.querySelector('#q-all').onchange = (e) => {
      selected = e.target.checked ? new Set(items.map((q) => q.id)) : new Set();
      box.querySelectorAll('.q-ck').forEach((c) => { c.checked = e.target.checked; });
      renderBar();
    };
    box.querySelectorAll('.q-ck').forEach((c) => {
      c.onchange = () => { const id = +c.dataset.id; c.checked ? selected.add(id) : selected.delete(id); renderBar(); };
    });
    box.querySelectorAll('[data-edit]').forEach((a) => { a.onclick = () => openEdit(+a.dataset.edit); });
    box.querySelectorAll('[data-toggle]').forEach((a) => {
      a.onclick = async () => {
        const q = items.find((x) => x.id === +a.dataset.toggle);
        await api('/api/admin/questions/' + q.id, { method: 'PATCH', body: JSON.stringify({ disabled: q.disabled === 1 ? 0 : 1 }) });
        toast(q.disabled === 1 ? '已上架' : '已下架');
        load();
      };
    });
    const prev = box.querySelector('#q-prev'), next = box.querySelector('#q-next');
    if (prev) prev.onclick = () => { state.offset = Math.max(0, state.offset - LIMIT); load(); };
    if (next) next.onclick = () => { state.offset += LIMIT; load(); };
    renderBar();
  }

  function renderBar() {
    const bar = document.getElementById('q-batchbar');
    bar.style.display = selected.size ? 'flex' : 'none';
    document.getElementById('q-selcount').textContent = selected.size;
  }

  async function batchPatch(body, label) {
    if (!selected.size) return;
    if (!confirm(`确认对选中的 ${selected.size} 题执行「${label}」？`)) return;
    for (const id of selected) {
      await api('/api/admin/questions/' + id, { method: 'PATCH', body: JSON.stringify(body) });
    }
    toast(`已${label} ${selected.size} 题`);
    load();
  }

  async function openEdit(id) {
    const q = items.find((x) => x.id === id);
    if (!q) return;
    const optRows = Object.entries(q.options || {}).map(([k, v]) =>
      `<div class="fld"><div class="lb">选项 ${esc(k)}</div><input class="ipt ed-opt" data-k="${esc(k)}" style="width:100%" value="${esc(v)}"></div>`).join('');
    openDrawer(`
      <div class="drawer-h"><span class="t">编辑题目 #${q.id}</span>
        <span style="flex:1"></span><span class="x" id="ed-close">✕</span></div>
      <div class="drawer-b">
        <div class="fld"><div class="lb">题干</div><textarea class="ipt" id="ed-question" rows="5" style="width:100%">${esc(q.question)}</textarea></div>
        ${optRows}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="fld"><div class="lb">答案</div><input class="ipt" id="ed-answer" style="width:100%" value="${esc(q.answer || '')}"></div>
          <div class="fld"><div class="lb">模块</div><select class="sel" id="ed-module" style="width:100%">
            ${Object.entries(MODS).map(([k, v]) => `<option value="${k}" ${q.module === k ? 'selected' : ''}>${v}</option>`).join('')}
            ${MODS[q.module] ? '' : `<option value="${esc(q.module || '')}" selected>${esc(q.module || '（无）')}</option>`}
          </select></div>
        </div>
        <div class="fld"><div class="lb">三级考点</div><select class="sel" id="ed-tag3" style="width:100%">${await topicOptions(q.tag3)}</select></div>
        <div class="fld"><div class="lb">解析</div><textarea class="ipt" id="ed-expl" rows="4" style="width:100%">${esc(q.explanation || '')}</textarea></div>
        <div class="fld"><div class="lb">华生解析（AI 精讲）</div><textarea class="ipt" id="ed-hs" rows="4" style="width:100%">${esc(q.hs_explanation || '')}</textarea></div>
        <div class="fld"><label style="font-size:13px"><input type="checkbox" id="ed-disabled" ${q.disabled === 1 ? 'checked' : ''}> 下架此题</label>
          ${q.hs_down > 0 ? `<span class="tag tag-bad" style="margin-left:10px">差评 ${q.hs_down}</span>` : ''}
          ${q.is_real ? '<span class="tag tag-info" style="margin-left:10px">真题</span>' : ''}
          <span class="tag tag-gray" style="margin-left:10px">${esc(q.source || '无来源')}</span></div>
      </div>
      <div class="drawer-f">
        <button class="btn btn-ghost" id="ed-cancel">取消</button>
        <button class="btn btn-primary" id="ed-save">保存修改</button>
      </div>`);
    document.getElementById('ed-close').onclick = closeDrawer;
    document.getElementById('ed-cancel').onclick = closeDrawer;
    document.getElementById('ed-save').onclick = async () => {
      const options = {};
      document.querySelectorAll('.ed-opt').forEach((i) => { options[i.dataset.k] = i.value; });
      const body = {
        question: document.getElementById('ed-question').value,
        answer: document.getElementById('ed-answer').value.trim(),
        module: document.getElementById('ed-module').value,
        tag3: document.getElementById('ed-tag3').value,
        explanation: document.getElementById('ed-expl').value,
        hs_explanation: document.getElementById('ed-hs').value,
        disabled: document.getElementById('ed-disabled').checked ? 1 : 0,
      };
      if (Object.keys(options).length) body.options = options;
      try {
        await api('/api/admin/questions/' + id, { method: 'PATCH', body: JSON.stringify(body) });
        toast('已保存 #' + id);
        closeDrawer();
        load();
      } catch (e) { toast('保存失败：' + e.message, true); }
    };
  }

  async function render(el, params) {
    state = { kw: params.get('kw') || '', module: '', filter: 'all', offset: 0, qid: params.get('id') || null, minScore: '', maxScore: '', sort: '' };
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>题库管理</h1><div class="sub">搜索、编辑、上下架与批量操作</div></div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <input class="ipt" id="q-kw" aria-label="题干关键词 / 题目 ID" style="width:260px" placeholder="题干关键词 / 题目 ID" value="${esc(state.qid || state.kw)}">
        <select class="sel" id="q-module" aria-label="模块筛选"><option value="">全部模块</option>
          ${Object.entries(MODS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <div class="row" style="gap:6px">
          <span class="chip on" data-f="all">全部</span>
          <span class="chip" data-f="flagged">差评待处理</span>
          <span class="chip" data-f="disabled">已下架</span>
        </div>
        <select class="sel" id="q-score" aria-label="质量分筛选"><option value="">全部质量分</option>
          <option value="80-100">优 80-100</option><option value="60-79">良 60-79</option>
          <option value="40-59">中 40-59</option><option value="0-39">差 0-39</option></select>
        <select class="sel" id="q-sort" aria-label="排序方式"><option value="">默认排序</option>
          <option value="score_asc">质量分 ↑</option><option value="score_desc">质量分 ↓</option></select>
        <button class="btn btn-primary" id="q-go">查询</button>
      </div>
    </div>
    <div id="q-batchbar" class="card" style="display:none;margin-bottom:12px;flex-direction:row;align-items:center;gap:10px">
      <span style="font-size:13px">已选 <b id="q-selcount">0</b> 题</span>
      <button class="btn btn-ghost" id="qb-down">批量下架</button>
      <button class="btn btn-ghost" id="qb-up">批量上架</button>
      <button class="btn btn-ghost" id="qb-tag">批量改考点</button>
    </div>
    <div class="card" style="padding:0"><div id="q-tbl"></div></div>`;
    const doSearch = () => {
      const v = document.getElementById('q-kw').value.trim();
      state.qid = /^\d+$/.test(v) ? v : null;
      state.kw = state.qid ? '' : v;
      state.module = document.getElementById('q-module').value;
      const range = document.getElementById('q-score').value;
      [state.minScore, state.maxScore] = range ? range.split('-') : ['', ''];
      state.sort = document.getElementById('q-sort').value;
      state.offset = 0;
      load();
    };
    document.getElementById('q-go').onclick = doSearch;
    document.getElementById('q-kw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    el.querySelectorAll('.chip[data-f]').forEach((c) => {
      c.onclick = () => {
        el.querySelectorAll('.chip[data-f]').forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
        state.filter = c.dataset.f;
        state.offset = 0;
        load();
      };
    });
    document.getElementById('qb-down').onclick = () => batchPatch({ disabled: 1 }, '下架');
    document.getElementById('qb-up').onclick = () => batchPatch({ disabled: 0 }, '上架');
    document.getElementById('qb-tag').onclick = async () => {
      const code = prompt('输入目标考点 code（如 ZL-001，UNKNOWN 表示待定）：');
      if (code) batchPatch({ tag3: code.trim() }, '改考点为 ' + code.trim());
    };
    await load();
  }

  Admin.registerPage('questions', { title: '题库管理', crumb: '内容 / 题库管理', render });
})();
