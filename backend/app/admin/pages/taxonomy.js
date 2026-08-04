/* B03 考点树：树形表格 + 右侧详情/题目预览 */
(function () {
  const { api, esc, taxonomy } = Admin;
  let tax = null;
  let openMods = new Set();
  let openGroups = new Set();
  let selCode = null;

  function renderTree() {
    const box = document.getElementById('t-tree');
    const rows = [];
    for (const m of tax.modules) {
      const mOpen = openMods.has(m.key);
      rows.push(`<div class="tree-row" data-mod="${m.key}" style="cursor:pointer;font-weight:600">
        <span>${mOpen ? '▾' : '▸'}</span><span style="flex:1">${esc(m.name)}</span>
        <span class="tag tag-gray">${m.n} 题</span></div>`);
      if (!mOpen) continue;
      for (const g of m.groups) {
        const gOpen = openGroups.has(g.code);
        rows.push(`<div class="tree-row" data-grp="${g.code}" style="cursor:pointer;padding-left:36px">
          <span>${gOpen ? '▾' : '▸'}</span><span style="flex:1">${esc(g.name)}</span>
          <span class="tag tag-gray">${g.n} 题</span></div>`);
        if (!gOpen) continue;
        for (const t of g.topics) {
          rows.push(`<div class="tree-row ${selCode === t.code ? 'sel' : ''}" data-topic="${t.code}" style="cursor:pointer;padding-left:60px">
            <span class="tag tag-info">${t.code}</span><span style="flex:1">${esc(t.name)}</span>
            <span class="tag ${t.n ? 'tag-gray' : 'tag-warn'}">${t.n} 题</span></div>`);
        }
      }
    }
    rows.push(`<div class="tree-row ${selCode === 'UNKNOWN' ? 'sel' : ''}" data-topic="UNKNOWN" style="cursor:pointer">
      <span class="tag tag-warn">UNKNOWN</span><span style="flex:1">待定考点（AI 未能归类）</span>
      <span class="tag ${tax.unknown ? 'tag-bad' : 'tag-gray'}">${tax.unknown} 题</span></div>`);
    box.innerHTML = rows.join('');
    box.querySelectorAll('[data-mod]').forEach((r) => {
      r.onclick = () => { const k = r.dataset.mod; openMods.has(k) ? openMods.delete(k) : openMods.add(k); renderTree(); };
    });
    box.querySelectorAll('[data-grp]').forEach((r) => {
      r.onclick = () => { const k = r.dataset.grp; openGroups.has(k) ? openGroups.delete(k) : openGroups.add(k); renderTree(); };
    });
    box.querySelectorAll('[data-topic]').forEach((r) => {
      r.onclick = () => { selCode = r.dataset.topic; renderTree(); renderDetail(); };
    });
  }

  async function renderDetail() {
    const box = document.getElementById('t-detail');
    if (!selCode) { box.innerHTML = '<div class="empty"><div class="eico">👈</div>点击左侧考点查看详情与题目</div>'; return; }
    let info = { name: '待定考点', desc: 'AI 归类置信度不足或未匹配到考点的题目，请在「考点抽审」中处理。' };
    let n = tax.unknown;
    if (selCode !== 'UNKNOWN') {
      for (const m of tax.modules) for (const g of m.groups) for (const t of g.topics)
        if (t.code === selCode) { info = t; n = t.n; }
    }
    box.innerHTML = `
      <div class="card-h"><span class="t">${esc(selCode)} · ${esc(info.name)}</span><span class="tag tag-gray">${n} 题</span></div>
      ${info.desc ? `<div style="font-size:13px;color:var(--t2);line-height:1.7;margin-bottom:8px">${esc(info.desc)}</div>` : ''}
      ${info.usage ? `<div class="expl-box" style="margin-bottom:12px"><b>判定说明：</b>${esc(info.usage)}</div>` : ''}
      <div class="row" style="gap:8px;margin-bottom:12px">
        ${selCode === 'UNKNOWN' ? '<a class="btn btn-primary" href="#/review">去考点抽审 →</a>' : ''}
      </div>
      <div id="t-qs"><div class="empty">加载题目…</div></div>`;
    try {
      const r = await api(`/api/admin/taxonomy/questions?code=${encodeURIComponent(selCode)}&limit=10`);
      const qs = document.getElementById('t-qs');
      qs.innerHTML = r.items.length
        ? `<table class="tbl"><thead><tr><th style="width:70px">ID</th><th>题干</th><th style="width:60px">答案</th><th style="width:60px"></th></tr></thead><tbody>
           ${r.items.map((q) => `<tr><td>#${q.id}</td>
             <td style="max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(q.question)}">${esc(q.question)}</td>
             <td><b>${esc(q.answer || '—')}</b></td>
             <td><a href="#/questions?id=${q.id}" style="color:var(--brand-600)">编辑</a></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">该考点下暂无上架题目</div>';
    } catch (e) { /* ignore */ }
  }

  async function render(el) {
    tax = await taxonomy();
    selCode = null;
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>考点树</h1><div class="sub">三级考点结构与题量分布（考点定义随代码 taxonomy.json 版本管理）</div></div>
      <div class="acts"><a class="btn btn-ghost" href="#/review">考点抽审 →</a></div>
    </div>
    <div class="split-2" style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px">
      <div class="card" style="padding:8px 0" id="t-tree"></div>
      <div class="card" id="t-detail"></div>
    </div>`;
    renderTree();
    renderDetail();
  }

  Admin.registerPage('taxonomy', { title: '考点树', crumb: '内容 / 考点树', render });
})();
