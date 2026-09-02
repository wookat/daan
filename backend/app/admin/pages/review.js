/* B04 考点抽审工作台：全键盘流 J/K 切题 · 1-9 选考点 · Enter 保存 · A 采纳 AI · X 解析 · Z 撤销 */
(function () {
  const { api, esc, toast, MODS, modTag, taxonomy, refreshBadges } = Admin;
  let queue = [];
  let total = 0;
  let idx = 0;
  let selected = null;      // 选中的候选 code
  let showExpl = false;
  let lastSaved = null;     // {qid, prevTag3} 供撤销
  let candidates = [];
  let keyHandler = null;
  let modFilter = '';

  async function load() {
    const r = await api('/api/admin/tag3_review?limit=100' + (modFilter ? '&module=' + modFilter : ''));
    queue = r.items;
    total = r.total;
    idx = 0;
    await renderWb();
  }

  async function buildCandidates(item) {
    const tax = await taxonomy();
    const out = [];
    const aiCode = item.tag3;
    for (const m of tax.modules) {
      if (item.module && m.key !== item.module) continue;
      for (const g of m.groups) for (const t of g.topics) out.push({ ...t, group: g.name });
    }
    // AI 建议排最前，其余按组顺序，取前 9
    out.sort((a, b) => (b.code === aiCode) - (a.code === aiCode));
    return out.slice(0, 9);
  }

  async function renderWb() {
    const box = document.getElementById('rv-wb');
    document.getElementById('rv-count').textContent = total;
    if (!queue.length) {
      box.innerHTML = `<div class="card"><div class="empty"><div class="eico">🎉</div>队列已清空，暂无待抽审考点</div></div>`;
      return;
    }
    const item = queue[idx];
    selected = item.tag3 && item.tag3 !== 'UNKNOWN' ? item.tag3 : null;
    showExpl = false;
    candidates = await buildCandidates(item);
    const opts = Object.entries(typeof item.options === 'string' ? JSON.parse(item.options || '{}') : (item.options || {}));
    box.innerHTML = `
    <div class="card" style="padding:0">
      <div class="wb-head">
        <b>第 ${idx + 1} / ${queue.length} 题</b>
        <span class="tag tag-gray">#${item.question_id}</span>${modTag(item.module)}
        ${item.confidence != null ? `<span class="tag ${item.confidence < 0.5 ? 'tag-bad' : 'tag-warn'}">AI 置信度 ${(item.confidence * 100).toFixed(0)}%</span>` : ''}
        <span style="flex:1"></span>
        <span style="font-size:12px;color:var(--t3)">${esc(item.reason || '')}</span>
        <div class="progress" style="width:120px"><i style="width:${(idx + 1) * 100 / queue.length}%"></i></div>
      </div>
      <div class="wb-body">
        <div class="q-text">${esc(item.question)}</div>
        <div style="display:grid;gap:8px;margin-bottom:14px">${opts.map(([k, v]) =>
          `<div class="opt-row ${String(item.answer || '').toUpperCase().startsWith(k) ? 'ans' : ''}"><b>${k}.</b><span>${esc(v)}</span></div>`).join('')}</div>
        <div id="rv-expl" class="expl-box hidden"><b>解析：</b>${esc(item.explanation || '（无解析）')}</div>
        <div style="font-size:12px;color:var(--t3);margin:12px 0 8px">候选考点（按 <span class="kbd">1</span>-<span class="kbd">9</span> 选择）：
          当前标注 <span class="tag ${item.cur_tag3 && item.cur_tag3 !== 'UNKNOWN' ? 'tag-info' : 'tag-warn'}">${esc(item.cur_tag3 || '未标注')}</span>
          ${item.tag3 ? `　AI 建议 <span class="tag tag-brand">${esc(item.tag3)}</span>` : ''}</div>
        <div class="row" style="gap:8px;flex-wrap:wrap" id="rv-chips">
          ${candidates.map((c, i) => `<span class="chip ${selected === c.code ? 'on' : ''}" data-code="${c.code}">
            <span class="kbd" style="margin-right:4px">${i + 1}</span>${c.code} ${esc(c.name)}${c.code === item.tag3 ? ' ⭐' : ''}</span>`).join('')}
          <span class="chip ${selected === 'UNKNOWN' ? 'on' : ''}" data-code="UNKNOWN"><span class="kbd" style="margin-right:4px">0</span>UNKNOWN 待定</span>
        </div>
      </div>
      <div class="wb-foot">
        <button class="btn btn-ghost" id="rv-prev">上一题 <span class="kbd">K</span></button>
        <button class="btn btn-ghost" id="rv-next">下一题 <span class="kbd">J</span></button>
        <button class="btn btn-ghost" id="rv-expl-btn">看解析 <span class="kbd">X</span></button>
        <span style="flex:1"></span>
        ${lastSaved ? `<button class="btn btn-ghost" id="rv-undo">撤销上一次 <span class="kbd">Z</span></button>` : ''}
        ${item.tag3 && item.tag3 !== 'UNKNOWN' ? `<button class="btn btn-ghost" id="rv-adopt">采纳 AI 建议 <span class="kbd">A</span></button>` : ''}
        <button class="btn btn-primary" id="rv-save">保存并下一题 <span class="kbd">Enter</span></button>
      </div>
    </div>`;
    box.querySelectorAll('#rv-chips .chip').forEach((c) => {
      c.onclick = () => selectCode(c.dataset.code);
    });
    document.getElementById('rv-prev').onclick = () => nav(-1);
    document.getElementById('rv-next').onclick = () => nav(1);
    document.getElementById('rv-expl-btn').onclick = toggleExpl;
    document.getElementById('rv-save').onclick = save;
    const adopt = document.getElementById('rv-adopt');
    if (adopt) adopt.onclick = () => { selectCode(item.tag3); save(); };
    const undo = document.getElementById('rv-undo');
    if (undo) undo.onclick = undoLast;
  }

  function selectCode(code) {
    selected = code;
    document.querySelectorAll('#rv-chips .chip').forEach((c) =>
      c.classList.toggle('on', c.dataset.code === code));
  }

  function nav(d) {
    if (!queue.length) return;
    idx = (idx + d + queue.length) % queue.length;
    renderWb();
  }

  function toggleExpl() {
    showExpl = !showExpl;
    document.getElementById('rv-expl').classList.toggle('hidden', !showExpl);
  }

  async function save() {
    if (!queue.length) return;
    if (!selected) { toast('请先按 1-9 选择考点', true); return; }
    const item = queue[idx];
    try {
      await api('/api/admin/questions/' + item.question_id, {
        method: 'PATCH', body: JSON.stringify({ tag3: selected }),
      });
      lastSaved = { qid: item.question_id, prevTag3: item.cur_tag3 || null };
      toast(`#${item.question_id} → ${selected}`);
      queue.splice(idx, 1);
      total = Math.max(0, total - 1);
      if (idx >= queue.length) idx = 0;
      refreshBadges();
      renderWb();
    } catch (e) { toast('保存失败：' + e.message, true); }
  }

  async function undoLast() {
    if (!lastSaved) return;
    try {
      await api('/api/admin/questions/' + lastSaved.qid, {
        method: 'PATCH', body: JSON.stringify({ tag3: lastSaved.prevTag3 || 'UNKNOWN' }),
      });
      await api('/api/admin/tag3_review/reopen', {
        method: 'POST', body: JSON.stringify({ question_id: lastSaved.qid }),
      });
      toast(`已撤销 #${lastSaved.qid}，重新入队`);
      lastSaved = null;
      load();
    } catch (e) { toast('撤销失败：' + e.message, true); }
  }

  async function render(el) {
    lastSaved = null;
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>考点抽审</h1><div class="sub">待抽审 <b id="rv-count">…</b> 题 · 全键盘流：<span class="kbd">J</span>/<span class="kbd">K</span> 切题 · <span class="kbd">1</span>-<span class="kbd">9</span> 选考点 · <span class="kbd">Enter</span> 保存 · <span class="kbd">A</span> 采纳 AI · <span class="kbd">X</span> 解析 · <span class="kbd">Z</span> 撤销</div></div>
      <div class="acts"><select class="sel" id="rv-mod" aria-label="模块筛选"><option value="">全部模块</option>
        ${Object.entries(MODS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    </div>
    <div id="rv-wb"></div>`;
    document.getElementById('rv-mod').onchange = (e) => { modFilter = e.target.value; load(); };
    await load();
    keyHandler = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (!queue.length) return;
      const item = queue[idx];
      if (e.key === 'j' || e.key === 'J') nav(1);
      else if (e.key === 'k' || e.key === 'K') nav(-1);
      else if (e.key >= '1' && e.key <= '9') { const c = candidates[+e.key - 1]; if (c) selectCode(c.code); }
      else if (e.key === '0') selectCode('UNKNOWN');
      else if (e.key === 'Enter') save();
      else if ((e.key === 'a' || e.key === 'A') && item.tag3) { selectCode(item.tag3); save(); }
      else if (e.key === 'x' || e.key === 'X') toggleExpl();
      else if ((e.key === 'z' || e.key === 'Z') && lastSaved) undoLast();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }

  Admin.registerPage('review', { title: '考点抽审', crumb: '内容 / 考点抽审', render });
})();
