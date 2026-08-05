/* B08 重复题治理：重复/近重复簇工作台（看簇 → 对比 → 一键保留最优/下架其余） */
(function () {
  const { api, esc, toast, modTag, openDrawer, closeDrawer } = Admin;
  const LIMIT = 20;
  let state = { offset: 0, status: 'open' };
  let stats = null;

  function scoreTag(s) {
    if (s === null || s === undefined) return '<span class="tag tag-gray">未打分</span>';
    const cls = s >= 80 ? 'tag-ok' : s >= 60 ? 'tag-info' : s >= 40 ? 'tag-warn' : 'tag-bad';
    return `<span class="tag ${cls}">${s}</span>`;
  }

  async function load() {
    const box = document.getElementById('dp-tbl');
    box.innerHTML = '<div class="empty">加载中…</div>';
    const p = new URLSearchParams({ offset: state.offset, limit: LIMIT, status: state.status });
    const r = await api('/api/admin/dup_clusters?' + p);
    stats = r.stats;
    renderStats();
    if (!r.items.length) {
      box.innerHTML = '<div class="empty"><div class="eico">✅</div>没有待处理的重复簇</div>';
      return;
    }
    box.innerHTML = `<table class="tbl"><thead><tr>
      <th style="width:70px">簇 ID</th><th>样例题干</th><th style="width:60px">题数</th>
      <th style="width:100px">跨模块</th><th style="width:70px">答案数</th>
      <th style="width:80px">最高相似</th><th style="width:80px">操作</th></tr></thead><tbody>
      ${r.items.map((c) => `<tr>
        <td>#${c.cluster_id}</td>
        <td style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.sample)}">${esc(c.sample)}</td>
        <td><b>${c.n}</b></td>
        <td>${c.modules_n > 1 ? `<span class="tag tag-warn">${esc(c.modules)}</span>` : modTag(c.modules)}</td>
        <td>${c.answers_n > 1 ? `<span class="tag tag-bad">${c.answers_n} 种</span>` : '<span class="tag tag-gray">1 种</span>'}</td>
        <td>${(c.max_sim * 100).toFixed(0)}%</td>
        <td><a data-open="${c.cluster_id}" style="color:var(--brand-600);cursor:pointer">对比处理</a></td>
      </tr>`).join('')}</tbody></table>
      <div class="pager" style="display:flex;gap:10px;justify-content:flex-end;padding:12px 16px;font-size:13px">
        <a class="btn btn-ghost" id="dp-prev" ${state.offset ? '' : 'style="visibility:hidden"'}>← 上一页</a>
        <a class="btn btn-ghost" id="dp-next" ${r.items.length === LIMIT ? '' : 'style="visibility:hidden"'}>下一页 →</a>
      </div>`;
    box.querySelectorAll('[data-open]').forEach((a) => { a.onclick = () => openCluster(+a.dataset.open); });
    const prev = box.querySelector('#dp-prev'), next = box.querySelector('#dp-next');
    if (prev) prev.onclick = () => { state.offset = Math.max(0, state.offset - LIMIT); load(); };
    if (next) next.onclick = () => { state.offset += LIMIT; load(); };
  }

  function renderStats() {
    const el = document.getElementById('dp-kpis');
    if (!el || !stats) return;
    el.innerHTML = `
      <div class="kpi"><div class="lb">待处理簇</div><div class="v" style="color:${stats.open_clusters ? 'var(--warning)' : 'var(--success)'}">${stats.open_clusters}</div><div class="d flat">涉及 ${stats.open_questions} 题</div></div>
      <div class="kpi"><div class="lb">已处理簇</div><div class="v">${stats.resolved}</div><div class="d flat">保留最优/下架其余</div></div>
      <div class="kpi"><div class="lb">已忽略簇</div><div class="v">${stats.ignored}</div><div class="d flat">人工判定非重复</div></div>
      <div class="kpi"><div class="lb">索引更新</div><div class="v" style="font-size:15px">${stats.meta.clusters_built_at ? new Date(+stats.meta.clusters_built_at * 1000).toLocaleString('zh-CN') : '未构建'}</div><div class="d flat">scripts/build_similarity_index.py</div></div>`;
  }

  async function openCluster(cid) {
    const r = await api('/api/admin/dup_clusters/' + cid);
    const best = r.items.length ? r.items[0].id : null;
    openDrawer(`
      <div class="drawer-h"><span class="t">重复簇 #${cid}（${r.items.length} 题）</span>
        <span style="flex:1"></span><span class="x" id="dp-close">✕</span></div>
      <div class="drawer-b">
        ${r.items.map((q) => `
        <div class="card" style="margin-bottom:12px;border:1px solid ${q.id === best ? 'var(--success)' : 'var(--line)'}">
          <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <b>#${q.id}</b> ${modTag(q.module)} ${scoreTag(q.quality_score)}
            <span class="tag tag-gray">相似 ${(q.similarity * 100).toFixed(0)}%</span>
            ${q.is_real ? '<span class="tag tag-info">真题</span>' : ''}
            ${q.disabled === 1 ? '<span class="tag tag-gray">已下架</span>' : ''}
            ${q.id === best ? '<span class="tag tag-ok">推荐保留</span>' : ''}
            <span style="flex:1"></span>
            <button class="btn btn-ghost dp-keep" data-keep="${q.id}" style="padding:2px 10px">保留此题</button>
          </div>
          <div style="font-size:13px;white-space:pre-wrap;margin-bottom:6px">${esc(q.question)}</div>
          <div style="font-size:12px;color:var(--t3)">${Object.entries(q.options || {}).map(([k, v]) => `${esc(k)}. ${esc(v)}`).join('　')}</div>
          <div style="font-size:12px;margin-top:6px">答案 <b>${esc(q.answer || '—')}</b> · 考点 ${esc(q.tag3 || '未标注')} · 来源 ${esc(q.source || '无')}</div>
          <div style="font-size:12px;color:var(--t3);margin-top:4px;max-height:60px;overflow:auto">${esc((q.explanation || q.hs_explanation || '（无解析）').slice(0, 300))}</div>
        </div>`).join('')}
      </div>
      <div class="drawer-f">
        <button class="btn btn-ghost" id="dp-ignore">非重复，忽略此簇</button>
        <span style="flex:1"></span>
        ${best ? `<button class="btn btn-primary" id="dp-keepbest">一键保留最优（#${best}）</button>` : ''}
      </div>`);
    document.getElementById('dp-close').onclick = closeDrawer;
    const resolve = async (keep) => {
      const label = keep === null ? '忽略此簇' : `保留 #${keep} 并下架其余 ${r.items.length - 1} 题`;
      if (!confirm(`确认${label}？`)) return;
      try {
        await api('/api/admin/dup_clusters/' + cid + '/resolve', {
          method: 'POST', body: JSON.stringify({ keep_qid: keep }),
        });
        toast(keep === null ? '已忽略' : '已保留 #' + keep);
        closeDrawer();
        load();
      } catch (e) { toast('处理失败：' + e.message, true); }
    };
    document.getElementById('dp-ignore').onclick = () => resolve(null);
    const kb = document.getElementById('dp-keepbest');
    if (kb) kb.onclick = () => resolve(best);
    document.querySelectorAll('.dp-keep').forEach((b) => { b.onclick = () => resolve(+b.dataset.keep); });
  }

  async function render(el) {
    state = { offset: 0, status: 'open' };
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>重复题治理</h1><div class="sub">simhash + n-gram 相似索引产出的重复/近重复簇（含跨模块）</div></div>
    </div>
    <div class="kpis" id="dp-kpis" style="grid-template-columns:repeat(4,1fr)"></div>
    <div class="card" style="margin-bottom:12px">
      <div class="row" style="gap:6px">
        <span class="chip on" data-s="open">待处理</span>
        <span class="chip" data-s="resolved">已处理</span>
        <span class="chip" data-s="ignored">已忽略</span>
      </div>
    </div>
    <div class="card" style="padding:0"><div id="dp-tbl"></div></div>`;
    el.querySelectorAll('.chip[data-s]').forEach((c) => {
      c.onclick = () => {
        el.querySelectorAll('.chip[data-s]').forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
        state.status = c.dataset.s;
        state.offset = 0;
        load();
      };
    });
    await load();
  }

  Admin.registerPage('dedup', { title: '重复题治理', crumb: '内容 / 重复题治理', render });
})();
