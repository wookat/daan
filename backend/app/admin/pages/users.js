/* C01 用户与运营：用户列表 + 学习数据概览 */
(function () {
  const { api, esc, MODS, fmtDay, fmtTime, openDrawer, closeDrawer } = Admin;
  const LIMIT = 20;
  let state = { kw: '', inactive: 0, offset: 0 };

  const maskUid = (uid) => uid.length <= 8 ? uid : uid.slice(0, 4) + '····' + uid.slice(-4);

  async function load() {
    const box = document.getElementById('u-tbl');
    box.innerHTML = '<div class="empty">加载中…</div>';
    const p = new URLSearchParams({ offset: state.offset, limit: LIMIT });
    if (state.kw) p.set('keyword', state.kw);
    if (state.inactive) p.set('inactive_days', state.inactive);
    const r = await api('/api/admin/users?' + p);
    document.getElementById('u-total').textContent = r.total.toLocaleString();
    if (!r.items.length) { box.innerHTML = '<div class="empty"><div class="eico">📭</div>无匹配用户</div>'; return; }
    const now = Date.now() / 1000;
    box.innerHTML = `<table class="tbl"><thead><tr>
      <th>用户</th><th style="width:90px">累计作答</th><th style="width:80px">正确率</th>
      <th style="width:80px">错题本</th><th style="width:110px">首次使用</th><th style="width:130px">最近活跃</th><th style="width:60px"></th></tr></thead><tbody>
      ${r.items.map((u) => {
        const idle = (now - u.last_seen) / 86400;
        const act = idle < 1 ? '<span class="tag tag-ok">今日活跃</span>' : idle < 7 ? `<span class="tag tag-info">${Math.floor(idle)} 天前</span>` : `<span class="tag tag-warn">流失风险 ${Math.floor(idle)} 天</span>`;
        return `<tr><td><code>${esc(maskUid(u.uid))}</code></td>
          <td>${u.answered.toLocaleString()}</td>
          <td ${u.acc != null && u.acc < 60 ? 'style="color:var(--error)"' : ''}>${u.acc == null ? '—' : u.acc + '%'}</td>
          <td>${u.mistakes}</td><td>${fmtDay(u.first_seen)}</td><td>${act}</td>
          <td><a data-uid="${esc(u.uid)}" style="color:var(--brand-600);cursor:pointer">详情</a></td></tr>`;
      }).join('')}</tbody></table>
      <div class="pager" style="display:flex;gap:10px;justify-content:flex-end;padding:12px 16px;font-size:13px">
        <a class="btn btn-ghost" id="u-prev" ${state.offset ? '' : 'style="visibility:hidden"'}>← 上一页</a>
        <a class="btn btn-ghost" id="u-next" ${r.items.length === LIMIT ? '' : 'style="visibility:hidden"'}>下一页 →</a>
      </div>`;
    box.querySelectorAll('[data-uid]').forEach((a) => { a.onclick = () => detail(a.dataset.uid); });
    const prev = box.querySelector('#u-prev'), next = box.querySelector('#u-next');
    if (prev) prev.onclick = () => { state.offset = Math.max(0, state.offset - LIMIT); load(); };
    if (next) next.onclick = () => { state.offset += LIMIT; load(); };
  }

  async function detail(uid) {
    const d = await api('/api/admin/users/' + encodeURIComponent(uid));
    const maxN = Math.max(1, ...d.recent.map((r) => r.n));
    openDrawer(`
      <div class="drawer-h"><span class="t">用户 ${esc(maskUid(uid))}</span><span style="flex:1"></span><span class="x" id="ud-close">✕</span></div>
      <div class="drawer-b">
        <div class="kpis" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
          <div class="kpi"><div class="lb">累计作答</div><div class="v">${d.answered.toLocaleString()}</div></div>
          <div class="kpi"><div class="lb">总体正确率</div><div class="v">${d.acc == null ? '—' : d.acc + '%'}</div></div>
          <div class="kpi"><div class="lb">错题本</div><div class="v">${d.mistakes}</div></div>
          <div class="kpi"><div class="lb">最近活跃</div><div class="v" style="font-size:15px">${fmtTime(d.last_seen)}</div></div>
        </div>
        <div class="card-h"><span class="t">各模块表现</span></div>
        ${d.by_module.map((m) => `<div class="hbar"><span class="lb">${esc(MODS[m.module] || m.module)}</span>
          <div class="bar"><i style="width:${m.acc || 0}%${m.acc < 60 ? ';background:var(--error)' : ''}"></i></div>
          <span class="n">${m.acc == null ? '—' : m.acc + '%'} · ${m.n} 题</span></div>`).join('') || '<div class="empty">暂无数据</div>'}
        <div class="card-h" style="margin-top:14px"><span class="t">近 14 天作答</span></div>
        <div class="spark">${d.recent.map((r) => `<i style="height:${Math.max(6, r.n * 100 / maxN)}%" title="${r.d}：${r.n} 题，对 ${r.c}"></i>`).join('') || ''}</div>
      </div>
      <div class="drawer-f"><button class="btn btn-ghost" id="ud-close2">关闭</button></div>`);
    document.getElementById('ud-close').onclick = closeDrawer;
    document.getElementById('ud-close2').onclick = closeDrawer;
  }

  async function render(el) {
    state = { kw: '', inactive: 0, offset: 0 };
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>用户与运营</h1><div class="sub">基于作答日志的匿名用户学习数据 · 共 <b id="u-total">…</b> 个活跃设备</div></div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <input class="ipt" id="u-kw" style="width:220px" placeholder="按用户 ID 前缀搜索">
        <div class="row" style="gap:6px">
          <span class="chip on" data-in="0">全部</span>
          <span class="chip" data-in="7">7 天未活跃</span>
          <span class="chip" data-in="30">30 天未活跃</span>
        </div>
        <button class="btn btn-primary" id="u-go">查询</button>
      </div>
    </div>
    <div class="card" style="padding:0"><div id="u-tbl"></div></div>`;
    document.getElementById('u-go').onclick = () => { state.kw = document.getElementById('u-kw').value.trim(); state.offset = 0; load(); };
    document.getElementById('u-kw').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('u-go').click(); });
    el.querySelectorAll('.chip[data-in]').forEach((c) => {
      c.onclick = () => {
        el.querySelectorAll('.chip[data-in]').forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
        state.inactive = +c.dataset.in;
        state.offset = 0;
        load();
      };
    });
    await load();
  }

  Admin.registerPage('users', { title: '用户与运营', crumb: '用户 / 用户与运营', render });
})();
