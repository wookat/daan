/* 管理后台 v3 · 核心：登录 / 路由 / API / 通用 UI 工具 */
(function () {
  const $ = (id) => document.getElementById(id);
  const PAGES = {};
  const MODS = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断' };

  const token = () => localStorage.getItem('admToken') || '';

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  async function api(path, opt) {
    const r = await fetch(path, Object.assign({
      headers: { 'X-Admin-Token': token(), 'Content-Type': 'application/json' },
    }, opt || {}));
    if (r.status === 401) { showLogin('登录已失效，请重新输入管理令牌'); throw new Error('未授权'); }
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || ('HTTP ' + r.status));
    return r.json();
  }

  let toastTimer = null;
  function toast(msg, isErr) {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function modTag(mod) {
    const cls = MODS[mod] ? 'mod-tag-' + mod : 'mod-tag-other';
    return `<span class="tag ${cls}">${esc(MODS[mod] || mod || '—')}</span>`;
  }

  function fmtTime(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false });
  }

  function fmtDay(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('zh-CN');
  }

  function fmtOpts(o) {
    const opts = typeof o === 'string' ? JSON.parse(o || '{}') : (o || {});
    return Object.entries(opts).map(([k, v]) => `${k}. ${v}`).join('\n');
  }

  /* ---- 抽屉 ---- */
  function openDrawer(html) {
    $('drawer').innerHTML = html;
    $('drawer').classList.add('show');
    $('dim').classList.add('show');
  }
  function closeDrawer() {
    $('drawer').classList.remove('show');
    $('dim').classList.remove('show');
    $('drawer').innerHTML = '';
  }
  document.addEventListener('click', (e) => { if (e.target.id === 'dim') closeDrawer(); });

  /* ---- 考点树缓存 ---- */
  let taxCache = null;
  async function taxonomy() {
    if (!taxCache) taxCache = await api('/api/taxonomy');
    return taxCache;
  }
  async function topicOptions(selected) {
    const tax = await taxonomy();
    const opts = ['<option value="">（未标注）</option>', `<option value="UNKNOWN" ${selected === 'UNKNOWN' ? 'selected' : ''}>UNKNOWN 待定</option>`];
    for (const m of tax.modules) for (const g of m.groups) for (const t of g.topics)
      opts.push(`<option value="${t.code}" ${t.code === selected ? 'selected' : ''}>${t.code} ${esc(t.name)}</option>`);
    return opts.join('');
  }

  /* ---- 侧栏红点 ---- */
  async function refreshBadges() {
    try {
      const d = await api('/api/admin/dashboard');
      setBadge('badge-batches', d.todos.pending_batches);
      setBadge('badge-review', d.todos.tag3_review);
      setBadge('badge-reports', d.todos.open_reports);
    } catch (e) { /* ignore */ }
  }
  function setBadge(id, n) {
    const el = $(id);
    if (!el) return;
    el.textContent = n > 99 ? '99+' : n;
    el.classList.toggle('hidden', !n);
  }

  /* ---- 路由 ---- */
  let currentCleanup = null;
  async function route() {
    const hash = location.hash.replace(/^#\//, '') || 'dashboard';
    const [name, qs] = hash.split('?');
    const page = PAGES[name] || PAGES.dashboard;
    if (typeof currentCleanup === 'function') { currentCleanup(); currentCleanup = null; }
    document.querySelectorAll('.side nav a[data-page]').forEach((a) =>
      a.classList.toggle('on', a.dataset.page === (PAGES[name] ? name : 'dashboard')));
    $('crumb').innerHTML = `<b>${esc(page.title)}</b>　${esc(page.crumb)}`;
    document.title = page.title + ' · 考公助手管理后台';
    const el = $('content');
    el.innerHTML = '<div class="empty"><div class="eico">⏳</div>加载中…</div>';
    try {
      currentCleanup = await page.render(el, new URLSearchParams(qs || ''));
    } catch (e) {
      el.innerHTML = `<div class="empty"><div class="eico">⚠️</div>加载失败：${esc(e.message)}</div>`;
    }
    refreshBadges();
  }

  /* ---- 登录 ---- */
  function showLogin(err) {
    $('app').classList.add('hidden');
    $('login').classList.remove('hidden');
    $('login-err').textContent = err || '';
    $('login-token').focus();
  }
  async function tryLogin(tok) {
    localStorage.setItem('admToken', tok);
    await api('/api/admin/stats');
  }
  async function boot() {
    $('login-btn').onclick = async () => {
      const tok = $('login-token').value.trim();
      if (!tok) { $('login-err').textContent = '请输入令牌'; return; }
      try {
        await tryLogin(tok);
        $('login').classList.add('hidden');
        $('app').classList.remove('hidden');
        route();
      } catch (e) { $('login-err').textContent = '令牌无效：' + e.message; }
    };
    $('login-token').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('login-btn').click(); });
    $('logout').onclick = () => { localStorage.removeItem('admToken'); location.reload(); };
    $('gsearch').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const v = $('gsearch').value.trim();
      if (/^\d+$/.test(v)) location.hash = '#/questions?id=' + v;
      else if (v) location.hash = '#/questions?kw=' + encodeURIComponent(v);
    });
    window.addEventListener('hashchange', route);
    if (!token()) { showLogin(); return; }
    try {
      await api('/api/admin/stats');
      $('app').classList.remove('hidden');
      route();
    } catch (e) { /* showLogin 已在 401 时触发 */ }
  }

  window.Admin = {
    $, api, esc, toast, MODS, modTag, fmtTime, fmtDay, fmtOpts,
    openDrawer, closeDrawer, taxonomy, topicOptions, refreshBadges,
    registerPage: (name, page) => { PAGES[name] = page; },
    boot,
  };
})();
