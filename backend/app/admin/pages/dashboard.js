/* A01 数据看板 */
(function () {
  const { api, esc, MODS } = Admin;

  function delta(cur, prev, suffix) {
    if (!prev) return '<div class="d flat">— vs 昨日</div>';
    const pct = ((cur - prev) * 100 / prev).toFixed(1);
    if (Math.abs(pct) < 0.05) return '<div class="d flat">持平 vs 昨日</div>';
    return pct > 0
      ? `<div class="d up">▲ ${pct}%${suffix || ''} vs 昨日</div>`
      : `<div class="d dn">▼ ${Math.abs(pct)}%${suffix || ''} vs 昨日</div>`;
  }

  function spark(trend, key) {
    const max = Math.max(1, ...trend.map((r) => r[key] || 0));
    return trend.map((r, i) =>
      `<i class="${i === trend.length - 1 ? 'hi' : ''}" style="height:${Math.max(4, Math.round((r[key] || 0) * 100 / max))}%" title="${r.d}：${r[key] || 0}"></i>`
    ).join('');
  }

  async function render(el) {
    const d = await api('/api/admin/dashboard');
    const t = d.today, y = d.yesterday, h = d.health;
    const healthTag = h.pct >= 95 ? '<span class="tag tag-ok">良好</span>'
      : h.pct >= 85 ? '<span class="tag tag-warn">注意</span>' : '<span class="tag tag-bad">异常</span>';
    const maxMod = Math.max(1, ...d.by_module.map((r) => r.n));
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>数据看板</h1><div class="sub">${new Date().toLocaleDateString('zh-CN')} · 统计缓存 5 分钟刷新</div></div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="lb">今日活跃用户</div><div class="v">${t.active.toLocaleString()}</div>${delta(t.active, y.active)}</div>
      <div class="kpi"><div class="lb">今日作答量</div><div class="v">${t.answered.toLocaleString()}</div>${delta(t.answered, y.answered)}</div>
      <div class="kpi"><div class="lb">新增用户</div><div class="v">${t.new_users.toLocaleString()}</div>${delta(t.new_users, y.new_users)}</div>
      <div class="kpi"><div class="lb">题库健康度 ${healthTag}</div><div class="v">${h.pct}%</div>
        <div class="d flat">在库 ${(h.active != null ? h.active : h.total).toLocaleString()} / 差评 ${h.flagged.toLocaleString()} / 待纠错 ${h.open_reports}${h.pending ? ` / <span style="color:#d97706">待审 ${h.pending.toLocaleString()}</span>` : ''} / 下架存量 ${h.disabled.toLocaleString()}</div></div>
      <div class="kpi"><div class="lb">今日 AI 调用</div><div class="v">${t.ai_calls.toLocaleString()}</div>${delta(t.ai_calls, y.ai_calls)}</div>
    </div>
    <div class="split-2" style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-h"><span class="t">近 14 天作答量趋势</span><span class="tag tag-brand">作答量</span></div>
        <div class="spark">${d.trend.length ? spark(d.trend, 'answered') : '<span style="color:var(--t4);font-size:12px">暂无作答数据</span>'}</div>
        <div class="row" style="justify-content:space-between;font-size:11px;color:var(--t4);margin-top:6px">
          <span>${esc((d.trend[0] || {}).d || '')}</span><span>${esc((d.trend[d.trend.length - 1] || {}).d || '')}</span></div>
        <div class="card-h" style="margin-top:14px"><span class="t">AI 调用趋势</span><span class="tag tag-gray">缓存新增/天</span></div>
        <div class="spark" style="height:40px">${d.trend.length ? spark(d.trend, 'ai_calls') : '<span style="color:var(--t4);font-size:12px">暂无数据</span>'}</div>
      </div>
      <div class="card">
        <div class="card-h"><span class="t">AI 通道状态</span><a class="more" href="#/settings">通道配置 →</a></div>
        <div id="dash-llm"><span style="color:var(--t3);font-size:12px">检测中…</span></div>
      </div>
    </div>
    <div class="split-2" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
      <div class="card">
        <div class="card-h"><span class="t">待办事项</span></div>
        <div class="hbar"><span class="lb" style="width:auto;flex:1">待审批次</span>
          <a class="tag ${d.todos.pending_batches ? 'tag-bad' : 'tag-gray'}" href="#/batches">${d.todos.pending_batches} 个批次</a></div>
        <div class="hbar"><span class="lb" style="width:auto;flex:1">考点抽审队列</span>
          <a class="tag ${d.todos.tag3_review ? 'tag-warn' : 'tag-gray'}" href="#/review">${d.todos.tag3_review} 题</a></div>
        <div class="hbar"><span class="lb" style="width:auto;flex:1">用户纠错待处理</span>
          <a class="tag ${d.todos.open_reports ? 'tag-bad' : 'tag-gray'}" href="#/reports">${d.todos.open_reports} 条</a></div>
        <div class="hbar"><span class="lb" style="width:auto;flex:1">内容质量巡检</span>
          <a class="tag tag-info" href="#/governance">去查看</a></div>
      </div>
      <div class="card">
        <div class="card-h"><span class="t">题库分布（${h.total.toLocaleString()} 题）</span><a class="more" href="#/questions">题库管理 →</a></div>
        ${d.by_module.map((r) => `<div class="hbar"><span class="lb">${esc(MODS[r.module] || r.module || '其他')}</span>
          <div class="bar"><i style="width:${Math.round(r.n * 100 / maxMod)}%"></i></div><span class="n">${r.n.toLocaleString()}</span></div>`).join('')}
      </div>
      <div class="card">
        <div class="card-h"><span class="t">近 7 天正确率</span><a class="more" href="#/users">学习数据 →</a></div>
        ${d.acc7.length ? d.acc7.map((r) => {
          const low = r.acc != null && r.acc < 60;
          return `<div class="hbar"><span class="lb">${esc(MODS[r.module] || r.module)}</span>
            <div class="bar"><i style="width:${r.acc || 0}%${low ? ';background:var(--error)' : ''}"></i></div>
            <span class="n"${low ? ' style="color:var(--error)"' : ''}>${r.acc == null ? '—' : r.acc + '%'}</span></div>`;
        }).join('') : '<div class="empty" style="padding:20px 0">近 7 天暂无作答</div>'}
      </div>
    </div>`;
    api('/api/admin/llm_health').then((r) => {
      const box = document.getElementById('dash-llm');
      if (!box) return;
      box.innerHTML = (r.items || []).map((it) =>
        `<div class="hbar"><span class="lb" style="width:auto;flex:1">${esc(it.name)}<span class="sub" style="margin-left:6px;font-size:11px;color:var(--t4)">${esc(it.host)}</span></span>
         <span class="tag ${it.ok ? 'tag-ok' : 'tag-bad'}">${it.ok ? '● 正常' : '✕ 异常'} ${esc(String(it.status))}</span></div>`).join('')
        || '<span style="color:var(--t3);font-size:12px">未配置通道</span>';
    }).catch(() => {
      const box = document.getElementById('dash-llm');
      if (box) box.innerHTML = '<span style="color:var(--error);font-size:12px">检测失败</span>';
    });
  }

  Admin.registerPage('dashboard', { title: '数据看板', crumb: '概览 / 数据看板', render });
})();
