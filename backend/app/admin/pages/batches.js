/* B02 批次导入审核：批次列表 + 抽检工作台（键盘 1/2/S/E） + 发布/驳回 */
(function () {
  const { api, esc, toast, modTag } = Admin;
  let batches = [];
  let cur = null;        // 当前批次
  let sample = [];       // 抽检题目
  let idx = 0;
  let verdicts = {};     // question_id -> verdict
  let keyHandler = null;

  function distBar(dist) {
    const colors = { A: 'var(--mod-shuliang)', B: 'var(--mod-ziliao)', C: 'var(--mod-changshi)', D: 'var(--mod-yanyu)' };
    const total = Object.values(dist || {}).reduce((a, b) => a + b, 0);
    if (!total) return '<span style="color:var(--t4);font-size:12px">—</span>';
    const maxPct = Math.max(...Object.values(dist)) / total;
    const bar = `<div class="stackbar">${['A', 'B', 'C', 'D'].map((k) =>
      dist[k] ? `<i style="width:${dist[k] * 100 / total}%;background:${colors[k]}" title="${k}: ${dist[k]}"></i>` : '').join('')}</div>`;
    return maxPct > 0.4 ? `<div class="row" style="gap:6px">${bar}<span class="tag tag-warn">偏斜</span></div>` : bar;
  }

  function renderList() {
    const box = document.getElementById('b-list');
    if (!batches.length) { box.innerHTML = '<div class="empty"><div class="eico">📭</div>暂无导入批次</div>'; return; }
    box.innerHTML = `<table class="tbl"><thead><tr>
      <th>批次</th><th style="width:70px">题量</th><th style="width:70px">真题</th>
      <th style="width:90px">状态</th><th style="width:110px">抽检进度</th>
      <th style="width:160px">答案分布</th><th style="width:90px">操作</th></tr></thead><tbody>
      ${batches.map((b) => {
        const st = b.pending > 0 ? `<span class="tag tag-warn">待审 ${b.pending}</span>` : '<span class="tag tag-ok">已发布</span>';
        const done = (b.review_ok || 0) + (b.review_problem || 0);
        return `<tr class="${cur && cur.batch === b.batch ? 'sel' : ''}">
          <td><b>${esc(b.batch)}</b></td><td>${b.n}</td><td>${b.real_n || 0}</td><td>${st}</td>
          <td>${done ? `${done} 题（<span style="color:var(--success)">${b.review_ok || 0}✓</span> / <span style="color:var(--error)">${b.review_problem || 0}✕</span>）` : '<span style="color:var(--t4)">未抽检</span>'}</td>
          <td>${distBar(b.answer_dist)}</td>
          <td><a data-open="${esc(b.batch)}" style="color:var(--brand-600)">抽检</a></td></tr>`;
      }).join('')}</tbody></table>`;
    box.querySelectorAll('[data-open]').forEach((a) => { a.onclick = () => openBatch(a.dataset.open); });
  }

  async function openBatch(bid) {
    cur = batches.find((b) => b.batch === bid);
    const r = await api(`/api/admin/batches/${encodeURIComponent(bid)}/sample?limit=10`);
    sample = r.items;
    verdicts = {};
    (r.reviews || []).forEach((v) => { verdicts[v.question_id] = v.verdict; });
    idx = 0;
    renderWb();
    document.getElementById('b-wb').scrollIntoView({ behavior: 'smooth' });
  }

  function renderWb() {
    const box = document.getElementById('b-wb');
    if (!cur) { box.innerHTML = ''; return; }
    if (!sample.length) {
      box.innerHTML = `<div class="card"><div class="empty">批次 ${esc(cur.batch)} 无可抽检题目</div></div>`;
      return;
    }
    const q = sample[idx];
    const done = Object.keys(verdicts).length;
    const okN = Object.values(verdicts).filter((v) => v === 'ok').length;
    const badN = done - okN;
    const opts = Object.entries(q.options || {});
    box.innerHTML = `
    <div class="card" style="padding:0;margin-top:14px">
      <div class="wb-head">
        <b>抽检工作台 · ${esc(cur.batch)}</b>
        <span class="tag ${cur.pending > 0 ? 'tag-warn' : 'tag-ok'}">${cur.pending > 0 ? '待审 ' + cur.pending + ' 题' : '已发布'}</span>
        <span style="flex:1"></span>
        <span style="font-size:12px;color:var(--t3)">第 ${idx + 1} / ${sample.length} 题 · 合格 <b style="color:var(--success)">${okN}</b> · 问题 <b style="color:var(--error)">${badN}</b></span>
        <div class="progress" style="width:120px"><i style="width:${done * 100 / sample.length}%"></i></div>
      </div>
      <div class="wb-body">
        <div class="row" style="gap:8px;margin-bottom:10px">
          <span class="tag tag-gray">#${q.id}</span>${modTag(q.module)}
          ${q.is_real ? '<span class="tag tag-info">真题</span>' : ''}
          <span class="tag ${verdicts[q.id] === 'ok' ? 'tag-ok' : verdicts[q.id] === 'problem' ? 'tag-bad' : 'tag-gray'}">
            ${verdicts[q.id] === 'ok' ? '✓ 合格' : verdicts[q.id] === 'problem' ? '✕ 有问题' : '未评'}</span>
        </div>
        <div class="q-text">${esc(q.question)}</div>
        <div style="display:grid;gap:8px">${opts.map(([k, v]) =>
          `<div class="opt-row ${String(q.answer || '').toUpperCase().startsWith(k) ? 'ans' : ''}"><b>${k}.</b><span>${esc(v)}</span></div>`).join('')}</div>
        ${q.explanation ? `<div class="expl-box"><b>解析：</b>${esc(q.explanation)}</div>` : ''}
      </div>
      <div class="wb-foot">
        <button class="btn btn-ghost" id="wb-prev">← 上一题</button>
        <button class="btn btn-ghost" id="wb-next">下一题 <span class="kbd">S</span></button>
        <span style="flex:1"></span>
        <button class="btn btn-ghost" id="wb-edit">编辑此题 <span class="kbd">E</span></button>
        <button class="btn" style="background:var(--success-bg);color:var(--success)" id="wb-ok">合格 <span class="kbd">1</span></button>
        <button class="btn" style="background:var(--error-bg);color:var(--error)" id="wb-bad">有问题 <span class="kbd">2</span></button>
      </div>
      <div class="wb-foot" style="border-top:1px dashed var(--border)">
        <span style="font-size:12px;color:var(--t3)">抽检完成后决策：</span>
        <span style="flex:1"></span>
        <button class="btn btn-primary" id="wb-publish" ${cur.pending > 0 ? '' : 'disabled style="opacity:.5"'}>✔ 发布批次（上架 ${cur.pending} 题）</button>
        <button class="btn btn-danger" id="wb-reject" ${cur.pending > 0 ? '' : 'disabled style="opacity:.5"'}>✕ 驳回批次（删除待审题）</button>
      </div>
    </div>`;
    document.getElementById('wb-prev').onclick = () => nav(-1);
    document.getElementById('wb-next').onclick = () => nav(1);
    document.getElementById('wb-ok').onclick = () => mark('ok');
    document.getElementById('wb-bad').onclick = () => mark('problem');
    document.getElementById('wb-edit').onclick = () => { location.hash = '#/questions?id=' + q.id; };
    document.getElementById('wb-publish').onclick = () => decide(true);
    document.getElementById('wb-reject').onclick = () => decide(false);
  }

  function nav(d) { idx = Math.min(sample.length - 1, Math.max(0, idx + d)); renderWb(); }

  async function mark(verdict) {
    const q = sample[idx];
    let note = null;
    if (verdict === 'problem') note = prompt('问题备注（可留空）：') || null;
    verdicts[q.id] = verdict;
    await api(`/api/admin/batches/${encodeURIComponent(cur.batch)}/sample_reviews`, {
      method: 'POST', body: JSON.stringify({ question_id: q.id, verdict, note }),
    });
    if (idx < sample.length - 1) idx++;
    renderWb();
  }

  async function decide(approve) {
    const label = approve ? `发布批次 ${cur.batch}（上架 ${cur.pending} 题）` : `驳回批次 ${cur.batch}（永久删除 ${cur.pending} 道待审题）`;
    if (!confirm('确认' + label + '？')) return;
    if (!approve && !confirm('二次确认：驳回将删除该批次全部待审题，不可恢复！')) return;
    const r = await api(`/api/admin/batches/${encodeURIComponent(cur.batch)}/decide`, {
      method: 'POST', body: JSON.stringify({ approve }),
    });
    toast((approve ? '已发布 ' : '已驳回 ') + r.n + ' 题');
    batches = (await api('/api/admin/batches')).items;
    cur = batches.find((b) => b.batch === cur.batch) || null;
    renderList();
    renderWb();
  }

  async function render(el) {
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>批次导入审核</h1><div class="sub">抽检 → 发布 / 驳回闭环 · 快捷键：1 合格 · 2 有问题 · S 下一题 · E 编辑</div></div>
    </div>
    <div class="card" style="padding:0"><div id="b-list"></div></div>
    <div id="b-wb"></div>`;
    batches = (await api('/api/admin/batches')).items;
    cur = null; sample = [];
    renderList();
    keyHandler = (e) => {
      if (!cur || !sample.length) return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.key === '1') mark('ok');
      else if (e.key === '2') mark('problem');
      else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowRight') nav(1);
      else if (e.key === 'ArrowLeft') nav(-1);
      else if (e.key === 'e' || e.key === 'E') { location.hash = '#/questions?id=' + sample[idx].id; }
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }

  Admin.registerPage('batches', { title: '批次导入审核', crumb: '内容 / 批次导入审核', render });
})();
